#!/usr/bin/env node
/**
 * 文件职责 / File responsibility
 * 锁定动作工坊预览、属性页签、视口对齐、独立滚动、中文界面和窄侧栏无横向溢出的产品合同。
 * Locks Motion Studio preview, property tabs, viewport alignment, local scrolling, Chinese UI, and narrow-sidebar no-horizontal-overflow contracts.
 */
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const motionPage = read('apps/playground/app/pages/studio/motion.vue')
const previewToolbar = read('apps/playground/app/components/studio/StudioPreviewToolbar.vue')
const canvas = read('apps/playground/app/components/studio/CloudFoxStudioCanvas.vue')
const proceduralPet = read('apps/playground/app/components/studio/ProceduralPet.vue')
const transformEditor = read('apps/playground/app/components/studio/StudioMotionTransformEditor.vue')
const advancedTools = read('apps/playground/app/components/studio/StudioMotionAdvancedTools.vue')
const poseEditor = read('apps/playground/app/components/studio/StudioMotionPoseEditor.vue')
const curveEditor = read('apps/playground/app/components/studio/StudioMotionCurveEditor.vue')
const propEvents = read('apps/playground/app/components/studio/StudioMotionPropEvents.vue')
const timeline = read('apps/playground/app/components/studio/StudioMotionTimeline.vue')
const layout = read('apps/playground/app/layouts/studio.vue')

const checks = [
  ['motion preview defaults smaller and exposes a bounded scale control', motionPage.includes('defaultScale: .72') && previewToolbar.includes('min=".4" max="1.2"') && previewToolbar.includes('预览大小')],
  ['motion preview starts higher through the canonical preview wrapper', motionPage.includes('const previewPosition = [0, .32, 0] as const') && motionPage.includes(':preview-position="previewPosition"') && canvas.includes('previewPosition?: readonly [number, number, number]') && proceduralPet.includes('previewPositionVector') && proceduralPet.includes(':position="previewPositionVector"')],
  ['property settings are grouped into bounded tabs instead of one long stack', motionPage.includes("type PropertyTab = 'basic' | 'pose' | 'advanced' | 'props'") && motionPage.includes("const propertyTab = ref<PropertyTab>('pose')") && motionPage.includes('class="property-tabs"') && motionPage.includes('class="property-tab-body"') && motionPage.includes('grid-template-rows:auto auto minmax(0,1fr) auto')],
  ['desktop property panel aligns with the editor and uses the available viewport height', layout.includes(':global(.motion-workspace){') && layout.includes('height:calc(100dvh - 55px)!important') && layout.includes('align-items:stretch!important') && layout.includes(':global(.motion-workspace .property-panel){') && layout.includes('align-self:stretch!important') && layout.includes('height:100%!important') && layout.includes('max-height:100%!important')],
  ['tab content is the sole vertical scroller and reserves floating-action clearance', layout.includes(':global(.motion-workspace .property-tab-body){') && layout.includes('overflow-y:auto!important') && layout.includes('padding:0 6px 76px 0!important') && layout.includes('touch-action:pan-y') && layout.includes('-webkit-overflow-scrolling:touch')],
  ['motion preview supports drag rotation toolbar scaling and reset without wheel binding', motionPage.includes('beginPreviewRotate') && motionPage.includes('movePreviewRotate') && motionPage.includes('@scale="updatePreviewScale"') && !motionPage.includes('@wheel') && !motionPage.includes('wheelPreview') && motionPage.includes('resetPreviewTransform')],
  ['preview transform is view-only and passed through the canonical canvas', motionPage.includes(':preview-scale="previewScale"') && motionPage.includes(':preview-rotation="previewRotationRadians"') && canvas.includes('previewScale?: number') && canvas.includes('previewRotation?: readonly [number, number, number]')],
  ['one generic preview wrapper applies scale and Euler rotation without adding a canvas', proceduralPet.includes('previewScaleVector') && proceduralPet.includes('previewRotationEuler') && proceduralPet.includes('<TresGroup :position="previewPositionVector" :scale="previewScaleVector" :rotation="previewRotationEuler">') && !proceduralPet.includes('<TresCanvas')],
  ['right property panel explicitly prevents horizontal overflow', motionPage.includes('.property-panel{') && motionPage.includes('overflow-x:hidden') && motionPage.includes('.property-panel :deep(input)') && motionPage.includes('grid-template-columns:repeat(2,minmax(0,1fr))')],
  ['narrow direct controls use shrinkable columns', transformEditor.includes('grid-template-columns:minmax(0,1fr) 26px minmax(58px,72px) 26px 26px') && transformEditor.includes('overflow-x:hidden')],
  ['advanced layers and prop styles use shrinkable responsive grids', advancedTools.includes('grid-template-columns:minmax(0,1fr) minmax(0,78px) 58px') && propEvents.includes('grid-template-columns:repeat(2,minmax(0,1fr))') && propEvents.includes('overflow-x:hidden')],
  ['primary motion UI is Chinese-first', motionPage.includes('<small>动作编辑器</small>') && previewToolbar.includes('正面') && transformEditor.includes('<small>直接操控</small>') && poseEditor.includes('<small>逐通道编辑</small>') && curveEditor.includes('入切线') && timeline.includes('>轨道<')],
  ['motion layer interpolation and prop event choices are localized', advancedTools.includes('>覆盖</option>') && advancedTools.includes('>叠加</option>') && poseEditor.includes("step: '阶梯'") && propEvents.includes("create: '创建'") && propEvents.includes("destroy: '销毁'")],
  ['Studio navigation uses Chinese descriptions instead of English subtitles', layout.includes('{{ item.description }}') && !layout.includes('{{ item.labelEn }}') && layout.includes('<span>工坊</span>')],
]

const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('Motion Studio usability check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`Motion Studio usability passed: ${checks.length} checks.`)
