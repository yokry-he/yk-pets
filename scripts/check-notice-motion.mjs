import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(process.cwd())
const [overlay, avatar, fox, css] = await Promise.all([
  readFile(resolve(root, 'apps/extension/entrypoints/content/NovaPetOverlay.vue'), 'utf8'),
  readFile(resolve(root, 'apps/extension/components/avatar/AvatarCanvas.vue'), 'utf8'),
  readFile(resolve(root, 'apps/extension/components/avatar/CloudFox.vue'), 'utf8'),
  readFile(resolve(root, 'apps/extension/entrypoints/content/nova-pet-overlay.css'), 'utf8'),
])

const checks = [
  ['notice defaults to hidden', overlay.includes('const noticeOpen = ref(false)')],
  ['notice is event driven', overlay.includes('showNotice(') && overlay.includes('watch(() => props.state.busy')],
  ['notice has close action', overlay.includes('nova-pet-status__close') && overlay.includes('@click="closeNotice"')],
  ['notice links to side panel', overlay.includes('nova-pet-status__details') && overlay.includes('openNoticeDetails')],
  ['motion registry activates runMotion', overlay.includes("if (item.kind === 'motion') runMotion(item)")],
  ['motion restart token increments', overlay.includes('motionNonce.value += 1')],
  ['motion key reaches avatar', overlay.includes(':motion-key="motionNonce"') && avatar.includes('motionKey: props.motionKey') && avatar.includes('petElement.value?.setState')],
  ['motion key resets model timeline', fox.includes('props.motionKey !== previousMotionKey')],
  ['idle carousel remains enabled', overlay.includes('scheduleIdleCarousel()') && overlay.includes("runMotion(item, 'idle')")],
  ['thought bubble and menu are independent', overlay.includes('v-if="noticeOpen"') && overlay.includes('class="nova-pet-mode-control"')],
  ['click motion toast removed', !overlay.includes('motionToast') && !css.includes('nova-pet-motion-toast')],
]

const failed = checks.filter(([, passed]) => !passed)
for (const [name, passed] of checks) console.log(`${passed ? '✓' : '✗'} ${name}`)
if (failed.length) process.exit(1)
console.log(`\n${checks.length} notice/motion checks passed.`)
