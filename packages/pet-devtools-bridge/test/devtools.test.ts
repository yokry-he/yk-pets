import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ChromeDebuggerTransport,
  RestrictedCdpClient,
  matchesOriginPattern,
  redactSensitiveData,
  type CdpEventListener,
  type CdpTarget,
  type CdpTransport,
  type ChromeDebuggerApi,
} from '../src/index.ts'

class FakeTransport implements CdpTransport {
  attached = false
  target: CdpTarget | null = null
  listeners = new Set<CdpEventListener>()
  calls: Array<{ method: string; params?: Record<string, unknown> }> = []
  responses = new Map<string, unknown>()
  never = new Set<string>()
  async attach(target: CdpTarget) { this.attached = true; this.target = target }
  async detach() { this.attached = false; this.target = null }
  async send(method: string, params?: Record<string, unknown>) {
    this.calls.push({ method, params })
    if (this.never.has(method)) return new Promise(() => {})
    return this.responses.get(method) ?? {}
  }
  onEvent(listener: CdpEventListener) { this.listeners.add(listener); return () => this.listeners.delete(listener) }
  emit(method: string, params: unknown, at = 1) { for (const listener of this.listeners) listener({ method, params, at }) }
}

test('default policy permanently rejects arbitrary JavaScript evaluation', async () => {
  const transport = new FakeTransport()
  const client = new RestrictedCdpClient(transport)
  await client.attach({ tabId: 7, origin: 'https://app.example' })
  await assert.rejects(client.send('Runtime.evaluate', { expression: 'document.cookie' }), /permanently denied/)
  assert.equal(transport.calls.length, 0)
})

test('caller cannot add a permanently denied method to its allowlist', () => {
  assert.throws(() => new RestrictedCdpClient(new FakeTransport(), { allowedMethods: ['Page.navigate'] }), /permanently denied/)
})

test('target is bound to an explicit allowed origin', async () => {
  const client = new RestrictedCdpClient(new FakeTransport(), { allowedOrigins: ['https://*.example.com'] })
  await client.attach({ tabId: 1, origin: 'https://docs.example.com' })
  await client.detach()
  await assert.rejects(client.attach({ tabId: 2, origin: 'https://attacker.invalid' }), /outside/)
})

test('origin matcher handles exact origins, ports, and one-label wildcards', () => {
  assert.equal(matchesOriginPattern('https://app.example.com', 'https://*.example.com'), true)
  assert.equal(matchesOriginPattern('https://deep.app.example.com', 'https://*.example.com'), false)
  assert.equal(matchesOriginPattern('https://app.example.com:8443', 'https://app.example.com:8443'), true)
  assert.equal(matchesOriginPattern('https://app.example.com', 'https://app.example.com:8443'), false)
})

test('command parameters are validated before transport execution', async () => {
  const transport = new FakeTransport()
  const client = new RestrictedCdpClient(transport)
  await client.attach({ tabId: 1, origin: 'https://app.example' })
  await assert.rejects(client.send('DOM.querySelector', { nodeId: 1, selector: 'div\nscript' }), /Invalid selector/)
  await assert.rejects(client.send('DOM.getBoxModel', { nodeId: 1, secretOption: true }), /Unsupported/)
  assert.equal(transport.calls.length, 0)
})

test('command budget is enforced and recorded', async () => {
  const client = new RestrictedCdpClient(new FakeTransport(), { maxCommands: 1 })
  await client.attach({ tabId: 1, origin: 'https://app.example' })
  await client.send('Performance.getMetrics')
  await assert.rejects(client.send('Performance.getMetrics'), /budget/)
  assert.equal(client.commandCount, 1)
  assert.deepEqual(client.history.map(item => item.outcome), ['success', 'denied'])
})

test('timeout rejects even when the transport ignores completion', async () => {
  const transport = new FakeTransport()
  transport.never.add('Performance.getMetrics')
  const client = new RestrictedCdpClient(transport, { timeoutMs: 10 })
  await client.attach({ tabId: 1, origin: 'https://app.example' })
  await assert.rejects(client.send('Performance.getMetrics'), /timed out/)
  assert.equal(client.history[0]!.outcome, 'timeout')
})

test('events are allowlisted, redacted, and bounded', async () => {
  const transport = new FakeTransport()
  const client = new RestrictedCdpClient(transport, { eventBufferSize: 2 })
  await client.attach({ tabId: 1, origin: 'https://app.example' })
  transport.emit('Network.requestWillBeSent', { cookie: 'x' })
  transport.emit('Log.entryAdded', { authorization: 'Bearer abc' }, 2)
  transport.emit('Runtime.exceptionThrown', { text: 'first' }, 3)
  transport.emit('Runtime.consoleAPICalled', { text: 'second' }, 4)
  assert.equal(client.events().length, 2)
  assert.deepEqual(client.events().map(event => event.method), ['Runtime.exceptionThrown', 'Runtime.consoleAPICalled'])
})

test('sensitive response fields and credential strings are redacted', () => {
  assert.deepEqual(redactSensitiveData({ cookie: 'a=b', nested: { authorization: 'Bearer abc', url: 'https://x.test/?token=secret' } }), {
    cookie: '[REDACTED]',
    nested: { authorization: '[REDACTED]', url: 'https://x.test/?token=[REDACTED]' },
  })
})

test('element snapshot uses only read-only inspection commands', async () => {
  const transport = new FakeTransport()
  transport.responses.set('DOM.describeNode', { node: { nodeId: 9 } })
  transport.responses.set('DOM.getBoxModel', { model: { width: 20 } })
  transport.responses.set('CSS.getMatchedStylesForNode', { matchedCSSRules: [] })
  transport.responses.set('Accessibility.getPartialAXTree', { nodes: [] })
  const client = new RestrictedCdpClient(transport)
  await client.attach({ tabId: 1, origin: 'https://app.example' })
  const snapshot = await client.captureElementSnapshot(9)
  assert.deepEqual(transport.calls.map(call => call.method), [
    'DOM.describeNode', 'DOM.getBoxModel', 'CSS.getMatchedStylesForNode', 'Accessibility.getPartialAXTree',
  ])
  assert.deepEqual(snapshot.node, { node: { nodeId: 9 } })
})

test('performance metrics are normalized and sorted', async () => {
  const transport = new FakeTransport()
  transport.responses.set('Performance.getMetrics', { metrics: [{ name: 'Z', value: 2 }, { name: 'A', value: 1 }, { name: 9, value: 3 }] })
  transport.responses.set('Page.getLayoutMetrics', { cssLayoutViewport: { clientWidth: 100 } })
  const client = new RestrictedCdpClient(transport)
  await client.attach({ tabId: 1, origin: 'https://app.example' })
  const snapshot = await client.capturePerformanceSnapshot()
  assert.deepEqual(snapshot.metrics, [{ name: 'A', value: 1 }, { name: 'Z', value: 2 }])
})

test('Chrome debugger transport filters events by attached tab and detaches cleanly', async () => {
  let listener: ((source: { tabId: number }, method: string, params?: unknown) => void) | undefined
  const calls: string[] = []
  const api: ChromeDebuggerApi = {
    async attach() { calls.push('attach') },
    async detach() { calls.push('detach') },
    async sendCommand(_target, method) { calls.push(method); return { ok: true } },
    onEvent: {
      addListener(value) { listener = value },
      removeListener(value) { if (listener === value) listener = undefined },
    },
  }
  const transport = new ChromeDebuggerTransport(api, '1.3', () => 10)
  const events: string[] = []
  transport.onEvent(event => events.push(event.method))
  await transport.attach({ tabId: 4, origin: 'https://app.example' })
  listener?.({ tabId: 5 }, 'Log.entryAdded', {})
  listener?.({ tabId: 4 }, 'Log.entryAdded', {})
  await transport.send('Log.enable')
  await transport.detach()
  assert.deepEqual(events, ['Log.entryAdded'])
  assert.deepEqual(calls, ['attach', 'Log.enable', 'detach'])
})
