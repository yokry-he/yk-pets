import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const extensionModel = read('apps/extension/components/avatar/CloudFox.vue')
const extensionCanvas = read('apps/extension/components/avatar/AvatarCanvas.vue')
const profile = read('apps/playground/app/domain/chrome-extension-cloud-fox-profile.ts')
const defaults = read('apps/playground/app/domain/extension-cloud-fox-default.ts')
const studioRenderer = [
  read('apps/playground/app/components/studio/ExtensionAlignedCloudFox.vue'),
  read('apps/playground/app/components/studio/ExtensionCloudFoxBody.vue'),
  read('apps/playground/app/components/studio/ExtensionCloudFoxHead.vue'),
  read('apps/playground/app/components/studio/ExtensionCloudFoxTail.vue'),
].join('\n')
const studioCanvas = read('apps/playground/app/components/studio/CloudFoxStudioCanvas.vue')
const store = read('apps/playground/app/stores/pet-appearance.ts')

const exactPairs = [
  ['coat color', "'#e9ecff'"],
  ['coat shadow', "'#aeb6e8'"],
  ['coat warm', "'#f9fbff'"],
  ['primary glow', "'#7066ff'"],
  ['secondary glow', "'#52e0d0'"],
  ['tail tip', "'#caffff'"],
  ['body scale', '0.94, 1.12, 0.82'],
  ['body position', '0, -0.32, 0'],
  ['head position', '0, 0.92, 0.06'],
  ['head scale', '1.02, 0.88, 0.9'],
  ['ear offset', '0.56, 0.65, -0.04'],
  ['eye offset', '0.31, 0.08, 0.77'],
  ['front paw offset', '0.5, -0.04, 0.82'],
  ['hind paw offset', '0.48, -1.08, 0.22'],
  ['tail position', '-0.58, -0.48, -0.34'],
  ['tail base radius', '0.27'],
  ['tail mid radius', '0.22'],
  ['tail tip radius', '0.16'],
  ['antenna offset', '0.24, 0.7, 0.05'],
  ['antenna rod', '0.028, 0.052, 0.34'],
]

const checks = exactPairs.map(([name, token]) => [name, extensionModel.includes(token) && profile.includes(token)])
checks.push(
  ['normal camera', extensionCanvas.includes('vec3(0, 0.42, 8.8)') && profile.includes('normalPosition: [0, 0.42, 8.8]')],
  ['compact camera', extensionCanvas.includes('vec3(0, 0.08, 9.7)') && profile.includes('compactPosition: [0, 0.08, 9.7]')],
  ['wide camera', extensionCanvas.includes('vec3(0, 0.72, 10.8)') && profile.includes('widePosition: [0, 0.72, 10.8]')],
  ['ambient light', extensionCanvas.includes(':intensity="1.35"') && profile.includes('ambientIntensity: 1.35')],
  ['directional light', extensionCanvas.includes(':intensity="3.8"') && profile.includes('directionalIntensity: 3.8')],
  ['point lights', extensionCanvas.includes(':intensity="secretMode ? 7 : 3.6"') && extensionCanvas.includes(':intensity="secretMode ? 6 : 2.8"') && profile.includes('primarySecretIntensity: 7') && profile.includes('secondarySecretIntensity: 6')],
  ['base background', extensionCanvas.includes('#0a0d18') && profile.includes("baseColor: '#0a0d18'")],
  ['nebula background', extensionCanvas.includes('rgba(111, 103, 255, .22)') && profile.includes('rgba(111, 103, 255, .22)')],
  ['default appearance mapping', defaults.includes('createExtensionClassicAppearance') && defaults.includes("bodyShape: 'ellipsoid'") && defaults.includes('symbols:')],
  ['default scene mapping', defaults.includes('createExtensionClassicScene') && defaults.includes("presetId: 'deep-nebula'") && defaults.includes('halo: { enabled: false') && defaults.includes('groundShadow: { enabled: false')],
  ['studio exact renderer', studioRenderer.includes('EXTENSION_CLASSIC_CLOUD_FOX_SCHEME') && studioRenderer.includes('TresTubeGeometry') && studioRenderer.includes('s.model.head.muzzlePosition')],
  ['studio exact camera and lights', studioCanvas.includes('scheme.scene.camera.normalPosition') && studioCanvas.includes('scheme.scene.lights.directionalIntensity')],
  ['store uses extension defaults', store.includes('createExtensionClassicAppearance()') && store.includes('createExtensionClassicScene()') && store.includes('applyExtensionClassic')],
)

const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('Chrome extension / Studio visual alignment check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`Chrome extension / Studio visual alignment passed: ${checks.length} exact checks.`)
