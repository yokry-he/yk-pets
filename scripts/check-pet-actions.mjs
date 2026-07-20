import { readFileSync } from 'node:fs'

const actions = [
  'audit',
  'previous-issue',
  'next-issue',
  'preview-current',
  'rollback-preview',
  'open-report',
  'connect-agent',
  'generate-patch',
  'apply-patch',
  'run-checks',
  'rollback-patch',
]

const files = {
  protocol: readFileSync(new URL('../packages/shared/src/messages.ts', import.meta.url), 'utf8'),
  overlay: readFileSync(new URL('../apps/extension/entrypoints/content/NovaPetOverlay.vue', import.meta.url), 'utf8'),
  content: readFileSync(new URL('../apps/extension/entrypoints/content.ts', import.meta.url), 'utf8'),
  sidepanel: readFileSync(new URL('../apps/extension/entrypoints/sidepanel/App.vue', import.meta.url), 'utf8'),
}

const failures = []
for (const action of actions) {
  if (!files.protocol.includes(`'${action}'`)) failures.push(`${action}: shared protocol`)
  if (!files.overlay.includes(`'${action}'`)) failures.push(`${action}: animal interaction overlay`)

  const handledInPage = ['audit', 'previous-issue', 'next-issue', 'preview-current', 'rollback-preview'].includes(action)
  const target = handledInPage ? files.content : files.sidepanel
  if (!target.includes(`'${action}'`)) failures.push(`${action}: ${handledInPage ? 'content handler' : 'side-panel handler'}`)
}

if (failures.length) {
  console.error('动物功能动作检查失败 / Animal action contract check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`动物功能动作检查通过，共 ${actions.length} 项。 / Animal action contract check passed for ${actions.length} actions.`)
