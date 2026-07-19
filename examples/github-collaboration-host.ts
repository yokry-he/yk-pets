import { GitHubProvider, type GitHubProviderCommand, type GitHubProviderInvoker } from '@yk-pets/pet-github-provider'

// This function belongs in a trusted extension Background, Local Agent Host, or CI Host.
// It maps fixed YK Pets commands to the host's authenticated GitHub client.
const invokeGitHub: GitHubProviderInvoker = async (command: GitHubProviderCommand) => {
  switch (command.type) {
    case 'pull-request:get':
    case 'checks:list':
    case 'review-threads:list':
    case 'reviews:list':
    case 'checks:rerun-failed':
    case 'review-thread:reply':
    case 'review-thread:resolve':
    case 'pull-request:merge':
    case 'pull-request:close':
    case 'branch:delete':
      throw new Error(`Bind ${command.type} to the trusted GitHub client in the host process`)
  }
}

export const github = new GitHubProvider(invokeGitHub, {
  allowedRepositories: ['example/yk-pets-project'],
  maxReviewBodyLength: 8_000,
})
