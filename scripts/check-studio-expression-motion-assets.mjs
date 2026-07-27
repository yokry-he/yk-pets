/**
 * 文件职责 / File responsibility
 * 校验表情造型、动作安全形变和 Studio 内置动作/道具资产的注册与统一渲染接线。
 * Verifies expression shapes, motion-safe deformation, and built-in Studio motion/prop registration and renderer wiring.
 */
import fs from 'node:fs'

const read = path => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : ''
const phase = read('apps/playground/app/domain/pet-studio-phase2.ts')
const eye = read('apps/playground/app/components/studio/ExtensionCloudFoxEyeShape.vue')
const head = read('apps/playground/app/components/studio/ExtensionCloudFoxHead.vue')
const face = read('apps/playground/app/components/studio/ExtensionCloudFoxFaceCustomization.vue')
const controls = read('packages/pet-core/src/motion/motion-controls.ts')
const builtInProps = read('apps/playground/app/domain/studio-built-in-props.ts')
const builtInMotions = read('apps/playground/app/domain/studio-built-in-motions.ts')
const assets = read('apps/playground/app/stores/studio-assets.ts')
const library = read('apps/playground/app/pages/studio/library.vue')
const motionPage = read('apps/playground/app/pages/studio/motion.vue')

const eyeIds = ['happy-crescent', 'angry', 'sad', 'surprised', 'heart', 'spiral']
const noseIds = ['cat', 'crystal', 'starlight']
const propIds = ['builtin-nebula-staff', 'builtin-energy-sword', 'builtin-starlight-fan', 'builtin-glow-sticks', 'builtin-ribbon', 'builtin-energy-orb']
const motionIds = ['builtin-energetic-step', 'builtin-starlight-sway', 'builtin-horse-stance-punch', 'builtin-nebula-staff-spin', 'builtin-cartwheel', 'builtin-sprint-stop']

const checks = [
  ['新增六种眼睛并进入眼睛渲染器', eyeIds.every(id => phase.includes(`'${id}'`) && eye.includes(id))],
  ['新增三种鼻子并进入鼻子渲染器', noseIds.every(id => phase.includes(`'${id}'`) && face.includes(id))],
  ['眼睛消费动作安全形变', ['eye.scale', 'eye.spacing', 'eye.pupilScale', 'eye.expressionTilt'].every(id => head.includes(id))],
  ['鼻子消费动作安全形变', ['nose.scale.x', 'nose.scale.y', 'nose.scale.z', 'nose.offset.y', 'nose.sniff', 'nose.glow'].every(id => face.includes(id))],
  ['动作部件树包含鼻子和安全形变控件', controls.includes("id: 'nose'") && controls.includes("'eye.expressionTilt'") && controls.includes("'tail.fluff'")],
  ['六个内置道具使用稳定 ID', propIds.every(id => builtInProps.includes(id))],
  ['内置道具可复制到用户资产', assets.includes('copyBuiltInProp') && library.includes('复制到道具工坊')],
  ['六个内置动作使用稳定 ID', motionIds.every(id => builtInMotions.includes(id))],
  ['内置动作升级为长编排', [
    'const energeticDuration = 8000',
    'const starlightSwayDuration = 10000',
    'durationMs: 8400',
    'const staffSpinDuration = 12000',
    'durationMs: 8800',
    'durationMs: 9200',
  ].every(source => builtInMotions.includes(source))],
  ['动作模板包含内置道具事件', builtInMotions.includes('builtin-nebula-staff') && builtInMotions.includes('builtin-glow-sticks') && builtInMotions.includes('propEventTracks')],
  ['内置动作可复制且预览解析内置道具', assets.includes('copyBuiltInMotion') && library.includes('复制到动作工坊') && motionPage.includes('BUILT_IN_STUDIO_PROPS')],
]

const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('Studio expression and motion asset check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`Studio expression and motion assets passed: ${checks.length} checks.`)
