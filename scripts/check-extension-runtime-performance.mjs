/**
 * 文件职责 / File responsibility
 * 防止网页宠物重新引入无限帧率、同步加载 WebGL、未节流状态传播、同步大 DOM 扫描和常驻滚动监听。
 * Prevents the in-page pet from reintroducing uncapped rendering, eager WebGL loading, unthrottled state propagation, synchronous large-DOM scans, or permanent scroll listeners.
 */
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const rootPackage = read('package.json')
const productionCanvas = read('apps/extension/components/avatar/ProductionAvatarCanvas.vue')
const configuredFox = read('apps/extension/components/avatar/ConfiguredCloudFox.vue')
const avatarHost = read('apps/extension/components/avatar/AvatarCanvas.vue')
const overlay = read('apps/extension/entrypoints/content/NovaPetOverlay.vue')
const content = read('apps/extension/entrypoints/content.ts')

const checks = [
  ['TresJS canvas preserves established FPS and DPR caps', productionCanvas.includes(':fps-limit="frameRateLimit"') && productionCanvas.includes("props.compact ? [.75, 1]") && productionCanvas.includes('props.compact ? 30 : 40') && productionCanvas.includes('power-preference="low-power"')],
  ['compact overlay disables antialiasing without removing scene lights', productionCanvas.includes(':antialias="!compact"') && !productionCanvas.includes('<TresPointLight v-if=') && productionCanvas.match(/<TresPointLight/g)?.length === 2],
  ['pointer updates are throttled before renderer propagation', overlay.includes('POINTER_UPDATE_INTERVAL_MS = 34') && overlay.includes('schedulePointerUpdate') && overlay.includes('pointerUpdateTimer')],
  ['motion audio loads on demand instead of preloading every asset', !overlay.includes('preloadMotionVoices()')],
  ['Web Component renderer updates are coalesced and deduplicated', avatarHost.includes('schedulePetElementUpdate') && avatarHost.includes('lastStateSignature') && !avatarHost.includes('{ deep: true }')],
  ['3D renderer is lazy and can be destroyed', avatarHost.includes("await import('../../entrypoints/content/yk-pet-adapter')") && avatarHost.includes('stop3dRenderer') && avatarHost.includes('detachPetElement')],
  ['appearance scene traversal has a bounded retry window', configuredFox.includes('appearanceRetryFrames < 12') && configuredFox.includes('if (!appearanceDirty) return')],
  ['page audit yields between DOM rule groups', content.includes('await yieldToMain()') && content.includes('MAX_AUDIT_ELEMENTS_PER_RULE = 160')],
  ['concurrent audit requests are rejected', content.includes('if (auditRunning)') && content.includes('auditRunning = false')],
  ['highlight scroll tracking is active only while highlighted', content.includes('startHighlightTracking') && content.includes('stopHighlightTracking')],
  ['root typecheck includes extension performance gate', rootPackage.includes('check-extension-runtime-performance.mjs')],
]

const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('extension runtime performance check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`extension runtime performance check passed: ${checks.length} checks.`)
