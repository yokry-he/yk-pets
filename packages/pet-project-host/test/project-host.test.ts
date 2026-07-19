import assert from 'node:assert/strict'
import test from 'node:test'
import { InMemoryWorkspaceAdapter } from '../../pet-file-transaction/src/index.ts'
import { sha256Hex } from '../../pet-patch-plan/src/index.ts'
import {
  WORKSPACE_HOST_CHANNEL,
  WorkspaceRpcAdapter,
  createChromeBackgroundWorkspaceTransport,
  createCiWorkspaceTransport,
  createWorkspaceHostMessageHandler,
  validateWorkspaceHostRequest,
  type WorkspaceHostRequest,
} from '../src/index.ts'

function setup(authorize: () => boolean = () => true) {
  const host = new InMemoryWorkspaceAdapter('demo', { 'src/App.ts': 'old' })
  const handler = createWorkspaceHostMessageHandler(host, { authorize })
  const transport = createChromeBackgroundWorkspaceTransport(message => handler(message, { subject: 'user', origin: 'chrome-extension://yk-pets', transport: 'extension-background' }))
  return { host, handler, client: new WorkspaceRpcAdapter('demo', transport) }
}

test('RPC adapter reads and conditionally writes through fixed host commands', async () => {
  const { client, host } = setup()
  const before = await client.read('src/App.ts')
  if (before.kind !== 'file') throw new Error('fixture')
  const after = await client.write('src/App.ts', 'new', { kind: 'file', sha256: before.sha256 })
  assert.equal(after.content, 'new')
  assert.equal((await host.files())['src/App.ts'], 'new')
})

test('every host request passes explicit authorization', async () => {
  const setupValue = setup(() => false)
  await assert.rejects(setupValue.client.read('src/App.ts'), /authorization denied/)
})

test('host rejects project mismatch', async () => {
  const { handler } = setup()
  const response = await handler({ channel: WORKSPACE_HOST_CHANNEL, requestId: 'r1', projectId: 'other', command: { type: 'workspace:get-revision' } })
  assert.equal(response.ok, false)
  if (!response.ok) assert.match(response.error, /Project does not match/)
})

test('unknown commands and path traversal are rejected before authorization', () => {
  assert.throws(() => validateWorkspaceHostRequest({ channel: WORKSPACE_HOST_CHANNEL, requestId: 'r', projectId: 'demo', command: { type: 'shell:exec', command: 'rm -rf /' } }), /Unsupported/)
  assert.throws(() => validateWorkspaceHostRequest({ channel: WORKSPACE_HOST_CHANNEL, requestId: 'r', projectId: 'demo', command: { type: 'workspace:read', path: '../secret' } }), /traversal/)
})

test('write content limit is enforced', () => {
  assert.throws(() => validateWorkspaceHostRequest({ channel: WORKSPACE_HOST_CHANNEL, requestId: 'r', projectId: 'demo', command: { type: 'workspace:write', path: 'a.ts', content: '12345', expected: { kind: 'missing' } } }, 4), /exceeds/)
})

test('delete is compare-and-swap protected', async () => {
  const { client } = setup()
  await assert.rejects(client.delete('src/App.ts', await sha256Hex('stale')), /SHA-256 mismatch/)
  const entry = await client.read('src/App.ts')
  if (entry.kind !== 'file') throw new Error('fixture')
  await client.delete('src/App.ts', entry.sha256)
  assert.equal((await client.read('src/App.ts')).kind, 'missing')
})

test('malformed or forged responses are rejected', async () => {
  const requestIds: string[] = []
  const client = new WorkspaceRpcAdapter('demo', { send: async request => {
    requestIds.push(request.requestId)
    return { channel: WORKSPACE_HOST_CHANNEL, requestId: 'other', ok: true, result: {} }
  } })
  await assert.rejects(client.getRevision(), /response envelope/)
  assert.equal(requestIds.length, 1)
})

test('request timeout terminates a host that ignores abort', async () => {
  const client = new WorkspaceRpcAdapter('demo', { send: () => new Promise(() => {}) }, { timeoutMs: 10 })
  await assert.rejects(client.getRevision(), /timed out/)
})

test('caller abort is propagated', async () => {
  const client = new WorkspaceRpcAdapter('demo', { send: () => new Promise(() => {}) }, { timeoutMs: 1000 })
  const controller = new AbortController()
  const pending = client.getRevision(controller.signal)
  controller.abort(new Error('cancelled by user'))
  await assert.rejects(pending, /cancelled by user/)
})

test('CI transport preserves the strict request envelope', async () => {
  let seen: WorkspaceHostRequest | undefined
  const transport = createCiWorkspaceTransport(request => {
    seen = request
    return { channel: WORKSPACE_HOST_CHANNEL, requestId: request.requestId, ok: true, result: { revision: 'ci-rev' } }
  })
  const client = new WorkspaceRpcAdapter('demo', transport)
  assert.equal(await client.getRevision(), 'ci-rev')
  assert.equal(seen?.command.type, 'workspace:get-revision')
})

test('authorization receives sender context and normalized command', async () => {
  let origin = ''
  let path = ''
  const host = new InMemoryWorkspaceAdapter('demo', { 'src/App.ts': 'old' })
  const handler = createWorkspaceHostMessageHandler(host, { authorize: input => {
    origin = input.context.origin ?? ''
    path = input.command.type === 'workspace:read' ? input.command.path : ''
    return true
  } })
  const request = { channel: WORKSPACE_HOST_CHANNEL, requestId: 'r1', projectId: 'demo', command: { type: 'workspace:read', path: 'src//App.ts' } }
  const response = await handler(request, { origin: 'https://app.example' })
  assert.equal(response.ok, true)
  assert.equal(origin, 'https://app.example')
  assert.equal(path, 'src/App.ts')
})

test('oversized read responses are blocked by both host and client limits', async () => {
  const host = new InMemoryWorkspaceAdapter('demo', { 'large.txt': '12345' })
  const handler = createWorkspaceHostMessageHandler(host, { authorize: () => true, maxContentBytes: 4 })
  const transport = createChromeBackgroundWorkspaceTransport(message => handler(message))
  const client = new WorkspaceRpcAdapter('demo', transport, { maxContentBytes: 4 })
  await assert.rejects(client.read('large.txt'), /exceeds limit/)
})
