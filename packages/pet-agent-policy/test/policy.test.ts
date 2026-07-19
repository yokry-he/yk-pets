import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ConfirmationBroker,
  GovernedToolExecutor,
  PermissionStore,
  PolicyDeniedError,
  PolicyEngine,
  ToolCatalog,
  createLocalAgentToolDeclarations,
  validateJsonSchema,
  wildcardMatch,
} from '../src/index.ts'

function setup() {
  const catalog = new ToolCatalog()
  for (const tool of createLocalAgentToolDeclarations()) catalog.register(tool)
  const grants = new PermissionStore()
  const confirmations = new ConfirmationBroker()
  const policy = new PolicyEngine(catalog, { grants, confirmations })
  return { catalog, grants, confirmations, policy }
}

test('catalog declares all five shared Local Agent tools', () => {
  const { catalog } = setup()
  assert.deepEqual(catalog.list().map(tool => tool.id), ['local-agent.connect', 'patch.generate', 'patch.apply', 'checks.run', 'patch.rollback'])
})

test('undeclared tool is denied', () => {
  const { policy } = setup()
  const result = policy.evaluate({ subject: 'user', toolId: 'shell.exec', requestedScopes: ['shell:*'] })
  assert.equal(result.allow, false)
  assert.match(result.reason, /not declared/)
})

test('grant must cover every requested scope', () => {
  const { grants, policy } = setup()
  grants.grant({ id: 'g1', subject: 'user', toolPattern: 'patch.generate', scopes: ['project:read'], confirmation: 'preapproved' })
  const result = policy.evaluate({ subject: 'user', toolId: 'patch.generate', requestedScopes: ['project:read', 'patch:generate'] })
  assert.equal(result.allow, false)
})

test('high-risk write requires explicit confirmation', () => {
  const { grants, policy } = setup()
  grants.grant({ id: 'g1', subject: 'user', toolPattern: 'patch.apply', scopes: ['project:write', 'patch:apply'], confirmation: 'preapproved' })
  const result = policy.evaluate({ subject: 'user', toolId: 'patch.apply', requestedScopes: ['project:write', 'patch:apply'] })
  assert.equal(result.allow, false)
  assert.equal(result.requiresConfirmation, true)
})

test('confirmation token is one-time and scope-bound', () => {
  const { grants, confirmations, policy } = setup()
  grants.grant({ id: 'g1', subject: 'user', toolPattern: 'patch.apply', scopes: ['project:write', 'patch:apply'], confirmation: 'preapproved' })
  const token = confirmations.issue({ subject: 'user', toolId: 'patch.apply', scopes: ['project:write', 'patch:apply'], now: 100 })
  const context = { subject: 'user', toolId: 'patch.apply', requestedScopes: ['project:write', 'patch:apply'], confirmationToken: token, now: 101 }
  assert.equal(policy.evaluate(context).allow, true)
  assert.equal(policy.evaluate(context).allow, false)
})

test('deny rule overrides grants', () => {
  const { catalog, grants, confirmations } = setup()
  grants.grant({ id: 'g1', subject: 'user', toolPattern: 'checks.run', scopes: ['project:execute', 'checks:run'], confirmation: 'preapproved' })
  const token = confirmations.issue({ subject: 'user', toolId: 'checks.run', scopes: ['project:execute', 'checks:run'] })
  const policy = new PolicyEngine(catalog, { grants, confirmations, rules: [{ id: 'deny-prod', effect: 'deny', toolPattern: 'checks.run', projects: ['*/production/*'], reason: 'Production execution blocked' }] })
  const result = policy.evaluate({ subject: 'user', toolId: 'checks.run', requestedScopes: ['project:execute', 'checks:run'], projectRoot: '/work/production/app', confirmationToken: token })
  assert.equal(result.allow, false)
  assert.equal(result.reason, 'Production execution blocked')
})

test('max-use grant is consumed', () => {
  const { grants, policy } = setup()
  grants.grant({ id: 'one', subject: 'user', toolPattern: 'patch.generate', scopes: ['project:read', 'patch:generate'], maxUses: 1, confirmation: 'preapproved' })
  const context = { subject: 'user', toolId: 'patch.generate', requestedScopes: ['project:read', 'patch:generate'] }
  assert.equal(policy.evaluate(context).allow, true)
  assert.equal(policy.evaluate(context).allow, false)
})

test('governed executor validates input', async () => {
  const { catalog, grants, policy } = setup()
  grants.grant({ id: 'g', subject: 'user', toolPattern: 'local-agent.connect', scopes: ['agent:connect'], confirmation: 'preapproved' })
  const executor = new GovernedToolExecutor(policy)
  await assert.rejects(
    executor.execute({ context: { subject: 'user', toolId: 'local-agent.connect', requestedScopes: ['agent:connect'] }, input: {} }, async () => ({ ok: true })),
    /Invalid tool input/,
  )
})

test('governed executor blocks denied calls', async () => {
  const { policy } = setup()
  const executor = new GovernedToolExecutor(policy)
  await assert.rejects(
    executor.execute({ context: { subject: 'user', toolId: 'patch.generate', requestedScopes: ['project:read', 'patch:generate'] }, input: {} }, async () => ({ ok: true })),
    error => error instanceof PolicyDeniedError,
  )
})

test('JSON schema reports required and additional properties', () => {
  const errors = validateJsonSchema({ type: 'object', required: ['name'], properties: { name: { type: 'string' } }, additionalProperties: false }, { extra: 1 })
  assert.deepEqual(errors, ['$.name is required', '$.extra is not allowed'])
})

test('wildcard matcher supports namespaced scopes', () => {
  assert.equal(wildcardMatch('project:*', 'project:write'), true)
  assert.equal(wildcardMatch('patch.*', 'patch.apply'), true)
  assert.equal(wildcardMatch('patch.*', 'checks.run'), false)
})

test('governed executor enforces timeout even when handler ignores abort', async () => {
  const catalog = new ToolCatalog()
  catalog.register({
    id: 'test.timeout', version: '1.0.0', title: 'Timeout', description: 'Timeout test tool.',
    scopes: ['test:run'], risk: 'low', sideEffects: ['read'], execution: 'browser', confirmation: 'never', timeoutMs: 10,
  })
  const grants = new PermissionStore()
  grants.grant({ id: 'timeout-grant', subject: 'user', toolPattern: 'test.timeout', scopes: ['test:run'], confirmation: 'preapproved' })
  const executor = new GovernedToolExecutor(new PolicyEngine(catalog, { grants }))
  await assert.rejects(
    executor.execute(
      { context: { subject: 'user', toolId: 'test.timeout', requestedScopes: ['test:run'] }, input: {} },
      () => new Promise(() => {}),
    ),
    /timed out after 10ms/,
  )
})
