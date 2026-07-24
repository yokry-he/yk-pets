import { readFileSync } from 'node:fs'

const files = {
  overlay: readFileSync(new URL('../apps/extension/entrypoints/content/NovaPetOverlay.vue', import.meta.url), 'utf8'),
  avatar: readFileSync(new URL('../apps/extension/components/avatar/ProductionAvatarCanvas.vue', import.meta.url), 'utf8'),
  styles: readFileSync(new URL('../apps/extension/entrypoints/content/nova-pet-overlay.css', import.meta.url), 'utf8'),
  content: readFileSync(new URL('../apps/extension/entrypoints/content.ts', import.meta.url), 'utf8'),
}

const requirements = [
  ['14-star nebula', files.overlay.includes('v-for="star in 14"') && files.styles.includes('.nova-pet-star:nth-child(14)')],
  ['energy pulse', files.overlay.includes('nova-pet-energy-pulse') && files.styles.includes('@keyframes nova-energy-pulse')],
  ['registry radial menu', files.overlay.includes('nova-pet-menu-ring') && files.overlay.includes('orbitStyle(index)')],
  ['full-body camera', files.avatar.includes('vec3(0, 0.08, 9.7)') && files.avatar.includes('compact ? 33 : 35')],
  ['transparent renderer', files.avatar.includes(':clear-alpha="transparent ? 0 : 1"') && files.avatar.includes(':clear-color="transparent ?') && !files.avatar.includes('@ready=')],
  ['single active preview', files.content.includes('rollbackPreview(previews)\n      const result = applyPreview')],
  ['cross-issue rollback fallback', files.content.includes('issueId && previews.has(issueId)')],
  ['top-level tooltip', files.overlay.includes('nova-pet-tooltip') && files.styles.includes('z-index: 60')],
]

const failures = requirements.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('星云宠物交互检查失败:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`星云宠物交互检查通过，共 ${requirements.length} 项。`)
