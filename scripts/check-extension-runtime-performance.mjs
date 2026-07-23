/**
 * 文件职责 / File responsibility
 * 防止网页宠物重新引入无限帧率、同步加载 WebGL、不可见持续渲染、未节流传播、同步大 DOM 扫描和常驻滚动监听。
 * Prevents uncapped rendering, eager WebGL loading, invisible continuous rendering, unthrottled propagation, synchronous large-DOM scans, and permanent scroll listeners.
 */
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const rootPackage = read('package.json')
const productionCanvas = read('apps/extension/components/avatar/ProductionAvatarCanvas.vue')
const core = read('apps/playground/app/components/studio/ExtensionAlignedCloudFox.vue')
const fireworks = read('apps/playground/app/components/studio/ProductionCloudFoxFireworks.vue')
const fireworksDomain = read('apps/playground/app/domain/production-cloud-fox-fireworks.ts')
const avatarHost = read('apps/extension/components/avatar/AvatarCanvas.vue')
const overlay = read('apps/extension/entrypoints/content/NovaPetOverlay.vue')
const content = read('apps/extension/entrypoints/content.ts')
const checks = [
  ['TresJS canvas keeps fixed full-quality FPS and DPR', productionCanvas.includes(':fps-limit="frameRateLimit"') && productionCanvas.includes("props.compact ? [.75, 1] : [.9, 1.25]") && productionCanvas.includes('props.compact ? 30 : 40')],
  ['visual lighting remains complete', productionCanvas.includes(':antialias="!compact"') && (productionCanvas.match(/<TresPointLight/g)?.length || 0) === 2],
  ['pointer updates are throttled before renderer propagation', overlay.includes('POINTER_UPDATE_INTERVAL_MS = 34') && overlay.includes('schedulePointerUpdate') && overlay.includes('pointerUpdateTimer')],
  ['motion audio remains on demand', !overlay.includes('preloadMotionVoices()')],
  ['Web Component updates are coalesced and deduplicated', avatarHost.includes('schedulePetElementUpdate') && avatarHost.includes('lastStateSignature') && !avatarHost.includes('{ deep: true }')],
  ['3D renderer is lazy and can be destroyed', avatarHost.includes("await import('../../entrypoints/content/yk-pet-adapter')") && avatarHost.includes('stop3dRenderer') && avatarHost.includes('detachPetElement')],
  ['offscreen state is event-driven', avatarHost.includes('new IntersectionObserver') && avatarHost.includes('viewportActive') && !avatarHost.includes('setInterval(')],
  ['hidden and offscreen rendering pauses the shared loop', core.includes('loop.stop()') && core.includes('loop.start()') && core.includes('props.active') && core.includes('visibilitychange')],
  ['resume restarts the current shared action cleanly instead of jumping', core.includes('resumeNonce') && core.includes('effectiveMotionKey')],
  ['fireworks reuse one fixed particle pool', fireworks.includes('const particles = shallowRef<Mesh[]>([])') && fireworksDomain.includes('PRODUCTION_FIREWORK_PARTICLE_COUNT = 48') && !fireworks.includes('setInterval(') && fireworks.includes('const directions = Array.from')],
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
