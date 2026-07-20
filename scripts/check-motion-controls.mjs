import { readFileSync } from 'node:fs'

const files = {
  protocol: readFileSync(new URL('../packages/shared/src/messages.ts', import.meta.url), 'utf8'),
  overlay: readFileSync(new URL('../apps/extension/entrypoints/content/NovaPetOverlay.vue', import.meta.url), 'utf8'),
  registry: readFileSync(new URL('../apps/extension/components/avatar/pet-motions.ts', import.meta.url), 'utf8'),
  styles: readFileSync(new URL('../apps/extension/entrypoints/content/nova-pet-overlay.css', import.meta.url), 'utf8'),
}

const motions = ['greeting', 'jumping', 'flapping', 'resting', 'stretching', 'eating']
const failures = []

for (const motion of motions) {
  if (!files.protocol.includes(`'${motion}'`)) failures.push(`${motion}: shared behavior protocol`)
  if (!files.registry.includes(`behavior: '${motion}'`)) failures.push(`${motion}: motion registry`)
}

const requirements = [
  ['three peer modes', files.overlay.includes("type MenuMode = 'features' | 'motions' | 'agent'")],
  ['motion registry metadata', files.registry.includes("category: 'social'") && files.registry.includes('idleEligible') && files.registry.includes('idleTier')],
  ['page size supports future motions', files.overlay.includes('const PAGE_SIZE = 6') && files.overlay.includes('visibleItems')],
  ['normal idle randomized delay', files.overlay.includes('10_000 + Math.round(Math.random() * 8_000)')],
  ['rare prop idle randomized delay', files.overlay.includes('34_000 + Math.round(Math.random() * 30_000)')],
  ['no repeated idle motion', files.overlay.includes('item.behavior !== lastIdleBehavior')],
  ['busy state pauses carousel', files.overlay.includes('props.state.busy || menuOpen.value') && files.overlay.includes('watch(() => props.state.busy')],
  ['visibility pauses carousel', files.overlay.includes("document.addEventListener('visibilitychange'")],
  ['pure icon motion buttons', files.overlay.includes('<span aria-hidden="true">{{ item.icon }}</span>')],
  ['independent tooltip', files.overlay.includes('showTooltip(item, $event)') && files.styles.includes('.nova-pet-tooltip')],
  ['removed motions stay out of registry', ['spinning', 'playing', 'playing-ball', 'paw-tap'].every(motion => !files.registry.includes(`behavior: '${motion}'`))],
]

for (const [name, passed] of requirements) if (!passed) failures.push(name)
if (failures.length) {
  console.error('动作控制与闲时轮播检查失败:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`动作控制与闲时轮播检查通过，共 ${motions.length + requirements.length} 项。`)
