import {
  WorkspaceRpcAdapter,
  createChromeBackgroundWorkspaceTransport,
  createWorkspaceHostMessageHandler,
  type WorkspaceAdapter,
} from '@yk-pets/pet-platform-adaptive'

// Background side: wrap the trusted workspace adapter and authorize every fixed command.
export function createBackgroundHandler(adapter: WorkspaceAdapter) {
  return createWorkspaceHostMessageHandler(adapter, {
    maxContentBytes: 2_000_000,
    authorize: ({ projectId, command, context }) => {
      if (context.transport !== 'extension-background') return false
      if (context.subject !== 'signed-in-user') return false
      if (projectId !== adapter.projectId) return false
      return ['workspace:get-revision', 'workspace:read', 'workspace:write', 'workspace:delete'].includes(command.type)
    },
  })
}

// Side Panel / feature side: only a strict request envelope crosses the extension boundary.
export function createSidePanelWorkspace(
  projectId: string,
  sendMessage: (message: unknown) => Promise<unknown>,
) {
  return new WorkspaceRpcAdapter(
    projectId,
    createChromeBackgroundWorkspaceTransport(message => sendMessage(message)),
    { timeoutMs: 10_000, maxContentBytes: 2_000_000 },
  )
}
