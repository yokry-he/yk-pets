import assert from 'node:assert/strict'
import test from 'node:test'
import { type PetRenderer, type PetRendererFactory, type PetVisualState, type RendererKind } from '../../pet-runtime-adaptive/src/index.ts'
import { MemoryKeyValueStore, SitePolicyManager } from '../../pet-site-policy/src/index.ts'
import { ExtensionPetRuntime, createExtensionRuntimeMessageHandler, validateCommand } from '../src/index.ts'

class FakeRenderer implements PetRenderer {
  mounted = 0
  started = 0
  stopped = 0
  disposed = 0
  visible = true
  updates: PetVisualState[] = []
  readonly kind: RendererKind
  constructor(kind: RendererKind) { this.kind = kind }
  mount(): void { this.mounted += 1 }
  update(state: PetVisualState): void { this.updates.push(state) }
  start(): void { this.started += 1 }
  stop(): void { this.stopped += 1 }
  setVisible(visible: boolean): void { this.visible = visible }
  snapshot() { return { state: this.updates.at(-1) } }
  restore(snapshot: { state?: PetVisualState }): void { if (snapshot.state) this.updates.push(snapshot.state) }
  dispose(): void { this.disposed += 1 }
}

function factory(kind: RendererKind, created: FakeRenderer[]): PetRendererFactory {
  return { kind, create: () => { const renderer = new FakeRenderer(kind); created.push(renderer); return renderer } }
}

function createRuntime(options: {
  manager?: SitePolicyManager
  fail3d?: boolean
  audit?: boolean
  auditResult?: unknown
  analysis?: boolean
  analysisResult?: unknown
  modification?: boolean
  modificationResult?: unknown
  authorizeModification?: (context: { planId: string }) => boolean | Promise<boolean>
  repository?: boolean
  repositoryResult?: unknown
  authorizeRepository?: (context: { sessionId: string }) => boolean | Promise<boolean>
  collaboration?: boolean
  collaborationResult?: unknown
  authorizeCollaboration?: (context: { action: string }) => boolean | Promise<boolean>
} = {}) {
  const created2d: FakeRenderer[] = []
  const created3d: FakeRenderer[] = []
  let rendererLoads = 0
  let auditLoads = 0
  let analysisLoads = 0
  let modificationLoads = 0
  let repositoryLoads = 0
  let collaborationLoads = 0
  const manager = options.manager ?? new SitePolicyManager(new MemoryKeyValueStore())
  const runtime = new ExtensionPetRuntime<{ page: string }, unknown, { selector: string }, unknown, { planId: string }, unknown, { sessionId: string }, unknown, { action: string }, unknown>({
    sitePolicies: manager,
    renderer2d: factory('2d', created2d),
    loadRenderer3d: () => {
      rendererLoads += 1
      if (options.fail3d) throw new Error('3D chunk failed')
      return factory('3d', created3d)
    },
    loadAuditFeature: options.audit === false ? undefined : () => {
      auditLoads += 1
      return { run: context => options.auditResult ?? { page: context.page, score: 96 } }
    },
    loadAnalysisFeature: options.analysis === false ? undefined : () => {
      analysisLoads += 1
      return { run: context => options.analysisResult ?? { selector: context.selector, source: 'src/App.vue' } }
    },
    loadModificationFeature: options.modification === false ? undefined : () => {
      modificationLoads += 1
      return { run: context => options.modificationResult ?? { planId: context.planId, status: 'applied' } }
    },
    authorizeModification: options.authorizeModification ?? (() => true),
    loadRepositoryFeature: options.repository === false ? undefined : () => {
      repositoryLoads += 1
      return { run: context => options.repositoryResult ?? { sessionId: context.sessionId, status: 'draft-created' } }
    },
    authorizeRepositoryPublish: options.authorizeRepository ?? (() => true),
    loadCollaborationFeature: options.collaboration === false ? undefined : () => {
      collaborationLoads += 1
      return { run: context => options.collaborationResult ?? { action: context.action, status: 'synced' } }
    },
    authorizeCollaborationAction: options.authorizeCollaboration ?? (() => true),
    adaptive: { switchCooldownMs: 0, degradeVotes: 1, recoverVotes: 1 },
  })
  return {
    runtime, manager, created2d, created3d,
    get rendererLoads() { return rendererLoads },
    get auditLoads() { return auditLoads },
    get analysisLoads() { return analysisLoads },
    get modificationLoads() { return modificationLoads },
    get repositoryLoads() { return repositoryLoads },
    get collaborationLoads() { return collaborationLoads },
  }
}

const healthyProbe = { now: 1, webglSupported: true, averageFps: 60, longTaskRatio: 0.01, deviceMemoryGb: 8 }

test('hidden sites do not initialize either renderer bundle', async () => {
  const setup = createRuntime()
  await setup.manager.addRule({ id: 'hidden', pattern: 'https://hidden.example/*', policy: { mode: 'hidden' } })
  await setup.runtime.start({} as Element, 'https://hidden.example/page', healthyProbe)
  assert.equal(setup.runtime.status.mounted, false)
  assert.equal(setup.runtime.status.renderer, null)
  assert.equal(setup.runtime.status.lifecycle.activity, 'hidden')
  assert.equal(setup.rendererLoads, 0)
  assert.equal(setup.created2d.length, 0)
  await setup.runtime.dispose()
})

test('paused sites mount lightweight 2D but do not load 3D', async () => {
  const setup = createRuntime()
  await setup.manager.addRule({ id: 'paused', pattern: 'https://paused.example/*', policy: { mode: 'paused' } })
  await setup.runtime.start({} as Element, 'https://paused.example/page', healthyProbe)
  assert.equal(setup.runtime.status.renderer, '2d')
  assert.equal(setup.runtime.status.lifecycle.activity, 'paused')
  assert.equal(setup.rendererLoads, 0)
  assert.ok(setup.created2d[0]!.stopped >= 1)
  await setup.runtime.dispose()
})

test('healthy enabled site dynamically loads and mounts 3D', async () => {
  const setup = createRuntime()
  await setup.runtime.start({} as Element, 'https://app.example/page', healthyProbe)
  assert.equal(setup.runtime.status.renderer, '3d')
  assert.equal(setup.rendererLoads, 1)
  assert.equal(setup.created3d.length, 1)
  assert.equal(setup.runtime.status.lifecycle.activity, 'active')
  await setup.runtime.dispose()
})

test('3D feature failure is contained by adaptive 2D fallback', async () => {
  const setup = createRuntime({ fail3d: true })
  await setup.runtime.start({} as Element, 'https://app.example/page', healthyProbe)
  assert.equal(setup.rendererLoads, 1)
  assert.equal(setup.runtime.status.renderer, '2d')
  assert.equal(setup.created2d.length, 1)
  await setup.runtime.dispose()
})

test('manual lifecycle pause stops and resumes the active renderer', async () => {
  const setup = createRuntime()
  await setup.runtime.start({} as Element, 'https://app.example/page', healthyProbe)
  const renderer = setup.created3d[0]!
  await setup.runtime.lifecycle.setManualPaused(true)
  assert.equal(setup.runtime.status.lifecycle.reason, 'manual')
  assert.ok(renderer.stopped >= 1)
  await setup.runtime.lifecycle.setManualPaused(false)
  assert.equal(setup.runtime.status.lifecycle.activity, 'active')
  assert.ok(renderer.started >= 1)
  await setup.runtime.dispose()
})

test('site hidden after startup pauses and hides the existing renderer', async () => {
  const setup = createRuntime()
  await setup.runtime.start({} as Element, 'https://app.example/page', healthyProbe)
  const renderer = setup.created3d[0]!
  await setup.runtime.setCurrentSitePolicy({ mode: 'hidden' })
  assert.equal(setup.runtime.status.lifecycle.activity, 'hidden')
  assert.equal(renderer.visible, false)
  assert.ok(renderer.stopped >= 1)
  await setup.runtime.dispose()
})

test('audit collector is loaded only when an audit is requested', async () => {
  const manager = new SitePolicyManager(undefined, { defaultPolicy: { renderer: '2d' } })
  const setup = createRuntime({ manager })
  await setup.runtime.start({} as Element, 'https://docs.example/page', { ...healthyProbe, webglSupported: false })
  assert.equal(setup.auditLoads, 0)
  const result = await setup.runtime.runAudit({ page: '/docs' })
  assert.deepEqual(result, { page: '/docs', score: 96 })
  assert.equal(setup.auditLoads, 1)
  await setup.runtime.runAudit({ page: '/next' })
  assert.equal(setup.auditLoads, 1)
  await setup.runtime.dispose()
})

test('site audit policy blocks collector loading', async () => {
  const manager = new SitePolicyManager(undefined, { defaultPolicy: { renderer: '2d', auditEnabled: false } })
  const setup = createRuntime({ manager })
  await setup.runtime.start({} as Element, 'https://private.example/', { ...healthyProbe, webglSupported: false })
  await assert.rejects(setup.runtime.runAudit({ page: '/' }), /disabled/)
  assert.equal(setup.auditLoads, 0)
  await setup.runtime.dispose()
})

test('origin persistence survives a new policy manager instance', async () => {
  const storage = new MemoryKeyValueStore()
  const manager = new SitePolicyManager(storage, { defaultPolicy: { renderer: '2d' } })
  const setup = createRuntime({ manager })
  await setup.runtime.start({} as Element, 'https://persist.example/page', { ...healthyProbe, webglSupported: false })
  await setup.runtime.setCurrentSitePolicy({ audioEnabled: false }, 'origin')
  const reloaded = new SitePolicyManager(storage)
  assert.equal((await reloaded.resolve('https://persist.example/other')).audioEnabled, false)
  await setup.runtime.dispose()
})

test('message handler validates commands and returns status after execution', async () => {
  const manager = new SitePolicyManager(undefined, { defaultPolicy: { renderer: '2d' } })
  const setup = createRuntime({ manager })
  await setup.runtime.start({} as Element, 'https://app.example/', { ...healthyProbe, webglSupported: false })
  const handler = createExtensionRuntimeMessageHandler(setup.runtime)
  const paused = await handler({ type: 'runtime:set-manual-paused', paused: true })
  assert.equal(paused.ok, true)
  assert.equal(paused.status.lifecycle.activity, 'paused')
  const invalid = await handler({ type: 'renderer:force', renderer: '4d' })
  assert.equal(invalid.ok, false)
  assert.match(invalid.error, /Invalid renderer/)
  assert.throws(() => validateCommand({ type: 'site:set-policy', policy: {}, ttlMs: -1 }), /ttlMs/)
  await setup.runtime.dispose()
})

test('navigation applies the destination site policy', async () => {
  const manager = new SitePolicyManager(undefined, { defaultPolicy: { renderer: '2d' } })
  await manager.addRule({ id: 'quiet', pattern: 'https://quiet.example/*', policy: { mode: 'hidden' } })
  const setup = createRuntime({ manager })
  await setup.runtime.start({} as Element, 'https://active.example/', { ...healthyProbe, webglSupported: false })
  assert.equal(setup.runtime.status.lifecycle.activity, 'active')
  await setup.runtime.navigate('https://quiet.example/page')
  assert.equal(setup.runtime.status.lifecycle.activity, 'hidden')
  await setup.runtime.dispose()
})


test('deep analysis is lazy-loaded only when requested', async () => {
  const manager = new SitePolicyManager(undefined, { defaultPolicy: { renderer: '2d' } })
  const setup = createRuntime({ manager })
  await setup.runtime.start({} as Element, 'https://app.example/', { ...healthyProbe, webglSupported: false })
  assert.equal(setup.analysisLoads, 0)
  const result = await setup.runtime.runAnalysis({ selector: '#save' })
  assert.deepEqual(result, { selector: '#save', source: 'src/App.vue' })
  assert.equal(setup.analysisLoads, 1)
  await setup.runtime.runAnalysis({ selector: '#next' })
  assert.equal(setup.analysisLoads, 1)
  await setup.runtime.dispose()
})

test('site audit policy also gates deep analysis without loading its bundle', async () => {
  const manager = new SitePolicyManager(undefined, { defaultPolicy: { renderer: '2d', auditEnabled: false } })
  const setup = createRuntime({ manager })
  await setup.runtime.start({} as Element, 'https://private.example/', { ...healthyProbe, webglSupported: false })
  await assert.rejects(setup.runtime.runAnalysis({ selector: 'body' }), /disabled/)
  assert.equal(setup.analysisLoads, 0)
  await setup.runtime.dispose()
})

test('message handler validates and executes deep analysis commands', async () => {
  const manager = new SitePolicyManager(undefined, { defaultPolicy: { renderer: '2d' } })
  const setup = createRuntime({ manager, analysisResult: { report: 'ok' } })
  await setup.runtime.start({} as Element, 'https://app.example/', { ...healthyProbe, webglSupported: false })
  const handler = createExtensionRuntimeMessageHandler(setup.runtime)
  const response = await handler({ type: 'analysis:run', context: { selector: '#app' } })
  assert.equal(response.ok, true)
  assert.deepEqual(response.result, { report: 'ok' })
  assert.equal(setup.analysisLoads, 1)
  assert.deepEqual(validateCommand({ type: 'analysis:run', context: { selector: '#app' } }), { type: 'analysis:run', context: { selector: '#app' } })
  await setup.runtime.dispose()
})

test('safe modification feature is loaded only after host authorization', async () => {
  const manager = new SitePolicyManager(undefined, { defaultPolicy: { renderer: '2d' } })
  const setup = createRuntime({ manager })
  await setup.runtime.start({} as Element, 'https://app.example/', { ...healthyProbe, webglSupported: false })
  assert.equal(setup.modificationLoads, 0)
  const result = await setup.runtime.runModification({ planId: 'plan-1' })
  assert.deepEqual(result, { planId: 'plan-1', status: 'applied' })
  assert.equal(setup.modificationLoads, 1)
  await setup.runtime.dispose()
})

test('denied modification does not load its feature bundle', async () => {
  const manager = new SitePolicyManager(undefined, { defaultPolicy: { renderer: '2d' } })
  const setup = createRuntime({ manager, authorizeModification: () => false })
  await setup.runtime.start({} as Element, 'https://app.example/', { ...healthyProbe, webglSupported: false })
  await assert.rejects(setup.runtime.runModification({ planId: 'plan-denied' }), /not authorized/)
  assert.equal(setup.modificationLoads, 0)
  await setup.runtime.dispose()
})

test('site audit policy blocks source modification before authorization and loading', async () => {
  const manager = new SitePolicyManager(undefined, { defaultPolicy: { renderer: '2d', auditEnabled: false } })
  let authorizationCalls = 0
  const setup = createRuntime({ manager, authorizeModification: () => { authorizationCalls += 1; return true } })
  await setup.runtime.start({} as Element, 'https://private.example/', { ...healthyProbe, webglSupported: false })
  await assert.rejects(setup.runtime.runModification({ planId: 'plan-private' }), /disabled/)
  assert.equal(authorizationCalls, 0)
  assert.equal(setup.modificationLoads, 0)
  await setup.runtime.dispose()
})

test('message handler validates and executes safe modification commands', async () => {
  const manager = new SitePolicyManager(undefined, { defaultPolicy: { renderer: '2d' } })
  const setup = createRuntime({ manager, modificationResult: { status: 'rolled-back' } })
  await setup.runtime.start({} as Element, 'https://app.example/', { ...healthyProbe, webglSupported: false })
  const handler = createExtensionRuntimeMessageHandler(setup.runtime)
  const response = await handler({ type: 'modification:run', context: { planId: 'plan-2' } })
  assert.equal(response.ok, true)
  assert.deepEqual(response.result, { status: 'rolled-back' })
  assert.deepEqual(validateCommand({ type: 'modification:run', context: { planId: 'plan-2' } }), { type: 'modification:run', context: { planId: 'plan-2' } })
  await setup.runtime.dispose()
})


test('repository publish feature is loaded only after independent host authorization', async () => {
  const manager = new SitePolicyManager(undefined, { defaultPolicy: { renderer: '2d' } })
  const setup = createRuntime({ manager })
  await setup.runtime.start({} as Element, 'https://app.example/', { ...healthyProbe, webglSupported: false })
  assert.equal(setup.repositoryLoads, 0)
  const result = await setup.runtime.runRepositoryPublish({ sessionId: 'session-1' })
  assert.deepEqual(result, { sessionId: 'session-1', status: 'draft-created' })
  assert.equal(setup.repositoryLoads, 1)
  await setup.runtime.dispose()
})

test('denied repository publish does not download its feature bundle', async () => {
  const manager = new SitePolicyManager(undefined, { defaultPolicy: { renderer: '2d' } })
  const setup = createRuntime({ manager, authorizeRepository: () => false })
  await setup.runtime.start({} as Element, 'https://app.example/', { ...healthyProbe, webglSupported: false })
  await assert.rejects(setup.runtime.runRepositoryPublish({ sessionId: 'session-denied' }), /not authorized/)
  assert.equal(setup.repositoryLoads, 0)
  await setup.runtime.dispose()
})

test('site audit policy blocks repository publishing before authorization and loading', async () => {
  const manager = new SitePolicyManager(undefined, { defaultPolicy: { renderer: '2d', auditEnabled: false } })
  let calls = 0
  const setup = createRuntime({ manager, authorizeRepository: () => { calls += 1; return true } })
  await setup.runtime.start({} as Element, 'https://private.example/', { ...healthyProbe, webglSupported: false })
  await assert.rejects(setup.runtime.runRepositoryPublish({ sessionId: 'session-private' }), /disabled/)
  assert.equal(calls, 0)
  assert.equal(setup.repositoryLoads, 0)
  await setup.runtime.dispose()
})

test('message handler validates and executes repository publish commands', async () => {
  const manager = new SitePolicyManager(undefined, { defaultPolicy: { renderer: '2d' } })
  const setup = createRuntime({ manager, repositoryResult: { status: 'pushed' } })
  await setup.runtime.start({} as Element, 'https://app.example/', { ...healthyProbe, webglSupported: false })
  const handler = createExtensionRuntimeMessageHandler(setup.runtime)
  const response = await handler({ type: 'repository:publish', context: { sessionId: 'session-2' } })
  assert.equal(response.ok, true)
  assert.deepEqual(response.result, { status: 'pushed' })
  assert.deepEqual(validateCommand({ type: 'repository:publish', context: { sessionId: 'session-2' } }), { type: 'repository:publish', context: { sessionId: 'session-2' } })
  await setup.runtime.dispose()
})


test('remote collaboration is lazy and independently authorized', async () => {
  const manager = new SitePolicyManager(undefined, { defaultPolicy: { renderer: '2d' } })
  const setup = createRuntime({ manager })
  await setup.runtime.start({} as Element, 'https://app.example/', { ...healthyProbe, webglSupported: false })
  assert.equal(setup.collaborationLoads, 0)
  const result = await setup.runtime.runCollaboration({ action: 'sync' })
  assert.deepEqual(result, { action: 'sync', status: 'synced' })
  assert.equal(setup.collaborationLoads, 1)
  await setup.runtime.dispose()
})

test('denied collaboration does not load the remote feature', async () => {
  const manager = new SitePolicyManager(undefined, { defaultPolicy: { renderer: '2d' } })
  const setup = createRuntime({ manager, authorizeCollaboration: () => false })
  await setup.runtime.start({} as Element, 'https://app.example/', { ...healthyProbe, webglSupported: false })
  await assert.rejects(setup.runtime.runCollaboration({ action: 'merge' }), /not authorized/)
  assert.equal(setup.collaborationLoads, 0)
  await setup.runtime.dispose()
})

test('audit policy blocks collaboration before authorization and loading', async () => {
  const manager = new SitePolicyManager(undefined, { defaultPolicy: { renderer: '2d', auditEnabled: false } })
  let calls = 0
  const setup = createRuntime({ manager, authorizeCollaboration: () => { calls += 1; return true } })
  await setup.runtime.start({} as Element, 'https://private.example/', { ...healthyProbe, webglSupported: false })
  await assert.rejects(setup.runtime.runCollaboration({ action: 'sync' }), /disabled/)
  assert.equal(calls, 0)
  assert.equal(setup.collaborationLoads, 0)
  await setup.runtime.dispose()
})

test('message handler validates and executes collaboration commands', async () => {
  const manager = new SitePolicyManager(undefined, { defaultPolicy: { renderer: '2d' } })
  const setup = createRuntime({ manager, collaborationResult: { status: 'eligible' } })
  await setup.runtime.start({} as Element, 'https://app.example/', { ...healthyProbe, webglSupported: false })
  const handler = createExtensionRuntimeMessageHandler(setup.runtime)
  const response = await handler({ type: 'collaboration:run', context: { action: 'evaluate-merge' } })
  assert.equal(response.ok, true)
  assert.deepEqual(response.result, { status: 'eligible' })
  assert.deepEqual(validateCommand({ type: 'collaboration:run', context: { action: 'sync' } }), { type: 'collaboration:run', context: { action: 'sync' } })
  await setup.runtime.dispose()
})
