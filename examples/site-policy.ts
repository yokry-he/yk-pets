import { SitePolicyManager, createChromeStorageAdapter } from '@yk-pets/pet-site-policy'

const policies = new SitePolicyManager(
  createChromeStorageAdapter(chrome.storage.local),
)

await policies.addRule({
  id: 'docs-lightweight',
  pattern: 'https://docs.example.com/*',
  policy: { renderer: '2d', audioEnabled: false },
  priority: 100,
})

policies.setSessionOverride(location.href, { mode: 'paused' }, 30 * 60 * 1_000)

const current = await policies.resolve(location.href)
console.log(current.mode, current.renderer, current.matchedRuleIds)
