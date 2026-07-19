import type { ExtensionPetRuntimeOptions } from '@yk-pets/pet-extension-runtime'

export interface CollaborationCommand {
  action: 'sync' | 'retry-failed-checks' | 'apply-review-plan' | 'merge' | 'cleanup-after-merge'
  repository: string
  number: number
  approvalToken?: string
}

export function addCollaborationFeature<TOptions extends ExtensionPetRuntimeOptions<any, any, any, any, any, any, any, any, CollaborationCommand, unknown>>(options: TOptions): TOptions {
  return {
    ...options,
    loadCollaborationFeature: async () => {
      const module = await import('@yk-pets/pet-remote-release')
      return {
        async run(context: CollaborationCommand) {
          // Send only the fixed business command to the trusted Background/Local Host.
          // The host owns GitHub credentials and constructs module.RemoteReleaseCoordinator.
          return { schema: module.REMOTE_APPROVAL_SCHEMA, acceptedAction: context.action }
        },
      }
    },
    authorizeCollaborationAction: async context => {
      if (context.action === 'sync') return true
      return typeof context.approvalToken === 'string' && context.approvalToken.length > 0
    },
  }
}
