import {
  ConfirmationBroker,
  PermissionStore,
  PolicyEngine,
  ToolCatalog,
  createLocalAgentToolDeclarations,
} from '@yk-pets/pet-agent-policy'

const catalog = new ToolCatalog()
createLocalAgentToolDeclarations().forEach(tool => catalog.register(tool))
const grants = new PermissionStore()
grants.grant({
  id: 'project-session',
  subject: 'current-user',
  toolPattern: 'patch.*',
  scopes: ['project:read', 'project:write', 'patch:*'],
  projects: ['/workspace/my-project/**'],
  confirmation: 'prompt',
})
const confirmations = new ConfirmationBroker()
const policy = new PolicyEngine(catalog, { grants, confirmations })
