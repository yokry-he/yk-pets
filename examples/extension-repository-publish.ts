import {
  ExtensionPetRuntime,
  type RepositoryFeature,
} from '@yk-pets/pet-extension-runtime'
import type { SitePolicyManager } from '@yk-pets/pet-site-policy'
import type { PetRendererFactory } from '@yk-pets/pet-runtime-adaptive'

interface RepositoryPublishContext {
  approvalToken: string
  sessionId: string
  planDigest: string
}

interface RepositoryPublishResult {
  status: 'committed' | 'pushed' | 'draft-created' | 'partial'
  commitSha: string
}

export function createRepositoryEnabledRuntime(options: {
  sitePolicies: SitePolicyManager
  renderer2d: PetRendererFactory
  loadRenderer3d: () => Promise<PetRendererFactory>
  askBackgroundForApproval(context: RepositoryPublishContext): Promise<boolean>
  publishThroughBackground(context: RepositoryPublishContext, signal?: AbortSignal): Promise<RepositoryPublishResult>
}) {
  return new ExtensionPetRuntime<unknown, unknown, unknown, unknown, unknown, unknown, RepositoryPublishContext, RepositoryPublishResult>({
    sitePolicies: options.sitePolicies,
    renderer2d: options.renderer2d,
    loadRenderer3d: options.loadRenderer3d,
    authorizeRepositoryPublish: context => options.askBackgroundForApproval(context),
    loadRepositoryFeature: async (): Promise<RepositoryFeature<RepositoryPublishContext, RepositoryPublishResult>> => ({
      run: (context, signal) => options.publishThroughBackground(context, signal),
    }),
  })
}

// The fixed extension message is:
// { type: 'repository:publish', context: { approvalToken, sessionId, planDigest } }
// The content page never receives the local repository path or GitHub credentials.
