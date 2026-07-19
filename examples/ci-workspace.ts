import {
  WorkspaceRpcAdapter,
  createCiWorkspaceTransport,
  createWorkspaceHostMessageHandler,
  type WorkspaceAdapter,
  type WorkspaceHostRequest,
} from '@yk-pets/pet-platform-adaptive'

export function createCiAdapter(adapter: WorkspaceAdapter) {
  const handler = createWorkspaceHostMessageHandler(adapter, {
    authorize: ({ projectId, context }) => projectId === adapter.projectId && context.transport === 'ci',
  })
  const transport = createCiWorkspaceTransport(
    (request: WorkspaceHostRequest) => handler(request, { subject: 'ci-job', transport: 'ci' }),
  )
  return new WorkspaceRpcAdapter(adapter.projectId, transport)
}
