/**
 * 锁定复杂双足萌宠的 Three 运行时边界，避免退回网络 GLB 导入或遗漏资源释放。
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const runtimePath = resolve(root, 'apps/playground/app/three/create-complex-biped-pet-object.ts')
const rendererPath = resolve(root, 'apps/playground/app/components/studio/ComplexBipedPetRenderer.vue')
const canvasPath = resolve(root, 'apps/playground/app/components/studio/CloudFoxStudioCanvas.vue')
const appearancePath = resolve(root, 'apps/playground/app/components/studio/StudioAppearanceWorkspace.vue')
const motionPath = resolve(root, 'apps/playground/app/pages/studio/motion.vue')
const propsPath = resolve(root, 'apps/playground/app/pages/studio/props.vue')
const libraryPath = resolve(root, 'apps/playground/app/pages/studio/library.vue')
const layoutPath = resolve(root, 'apps/playground/app/layouts/studio.vue')
const packagePath = resolve(root, 'package.json')
const runtime = existsSync(runtimePath) ? readFileSync(runtimePath, 'utf8') : ''
const renderer = existsSync(rendererPath) ? readFileSync(rendererPath, 'utf8') : ''
const canvas = existsSync(canvasPath) ? readFileSync(canvasPath, 'utf8') : ''
const appearance = existsSync(appearancePath) ? readFileSync(appearancePath, 'utf8') : ''
const motion = existsSync(motionPath) ? readFileSync(motionPath, 'utf8') : ''
const props = existsSync(propsPath) ? readFileSync(propsPath, 'utf8') : ''
const library = existsSync(libraryPath) ? readFileSync(libraryPath, 'utf8') : ''
const layout = existsSync(layoutPath) ? readFileSync(layoutPath, 'utf8') : ''
const packageManifest = JSON.parse(readFileSync(packagePath, 'utf8'))

function script(source) {
  return source.match(/<script setup[^>]*>([\s\S]*?)<\/script>/)?.[1] || ''
}

function template(source) {
  const start = source.search(/<template(?:\s[^>]*)?>/)
  const contentStart = start < 0 ? -1 : source.indexOf('>', start) + 1
  const end = source.lastIndexOf('</template>')
  return contentStart > 0 && end > contentStart ? source.slice(contentStart, end) : ''
}

function hasCanvasReplacementStructure(source) {
  const sourceScript = script(source)
  const sourceTemplate = template(source)
  return /complexRecipe\??\s*:\s*CharacterModelRecipeV1/.test(sourceScript)
    && /complexPetId\??\s*:\s*string/.test(sourceScript)
    && /normalizeBipedPetModelRecipe/.test(sourceScript)
    && /function\s+complexRecipeSignature\s*\(/.test(sourceScript)
    && /const\s+complexPreviewKey\s*=\s*computed/.test(sourceScript)
    && /props\.complexPetId/.test(sourceScript)
    && !/compileBipedPetCharacter/.test(sourceScript)
    && /CANONICAL_VIEW_YAW[\s\S]*front:\s*0[\s\S]*left:\s*Math\.PI\s*\/\s*2[\s\S]*back:\s*Math\.PI[\s\S]*right:\s*-Math\.PI\s*\/\s*2/.test(sourceScript)
    && /const\s+complexPreviewRotation\s*=\s*computed/.test(sourceScript)
    && /CANONICAL_VIEW_YAW\[props\.view]\s*\+\s*props\.previewRotation\[1\]/.test(sourceScript)
    && /['"]complex-compiled['"]\s*:/.test(sourceScript)
    && /function\s+onComplexCompilation\s*\(/.test(sourceScript)
    && /emit\(['"]complex-compiled['"]/.test(sourceScript)
    && /ComplexBipedPetRenderer/.test(sourceScript)
    && (sourceTemplate.match(/<TresCanvas\b/g) || []).length === 1
    && /watch\(\(\)\s*=>\s*\[props\.modelMode,\s*complexPreviewKey\.value]\s*as const/.test(sourceScript)
    && !/watch\([\s\S]*?props\.complexRecipe[\s\S]*?deep:\s*true/.test(sourceScript)
    && /<TresGroup\b[^>]*v-if="showComplexRenderer"[^>]*:position="vec3\(previewPosition\)"[^>]*:rotation="vec3\(complexPreviewRotation\)"[^>]*:scale="vec3\(\[previewScale,\s*previewScale,\s*previewScale\]\)"/.test(sourceTemplate)
    && /<ComplexBipedPetRenderer\b[^>]*:key="complexPreviewKey"[^>]*@compilation="onComplexCompilation"/.test(sourceTemplate)
    && /<ProceduralPet\b[^>]*v-else/.test(sourceTemplate)
    && /v-if="showComplexRenderer"/.test(sourceTemplate)
}

function hasSharedRecipeReadOnlyWiring(source) {
  const sourceScript = script(source)
  const sourceTemplate = template(source)
  return /useStudioModelVariantsStore/.test(sourceScript)
    && /const\s+complexRecipe\s*=\s*computed/.test(sourceScript)
    && /:complex-recipe="complexRecipe"/.test(sourceTemplate)
    && !/commitComplexCompilation/.test(sourceScript)
    && !/ensureComplexDraft/.test(sourceScript)
}

const checks = [
  ['运行时创建 Bone、Skeleton 与 SkinnedMesh', /\bBone\b/.test(runtime) && /\bSkeleton\b/.test(runtime) && /\bSkinnedMesh\b/.test(runtime)],
  ['运行时提供 position、skinIndex、skinWeight 与 index 属性', ['position', 'skinIndex', 'skinWeight', 'setIndex'].every(token => runtime.includes(token))],
  ['运行时计算法线和包围体', runtime.includes('computeVertexNormals') && runtime.includes('computeBoundingBox') && runtime.includes('computeBoundingSphere')],
  ['运行时更新世界矩阵后绑定骨架', runtime.includes('updateMatrixWorld(true)') && runtime.includes('.bind(')],
  ['运行时释放 geometry、material 与 skeleton', ['geometry', 'material', 'skeleton'].every(resource => new RegExp(`${resource}(?:\\?\\.)?dispose\\(\\)`).test(runtime))],
  ['Vue 适配器编译配方并保持非深代理运行时', renderer.includes('compileBipedPetCharacter') && renderer.includes('shallowRef') && renderer.includes('watch') && renderer.includes('onBeforeUnmount')],
  ['Vue 适配器使用同一规范化配方编译与创建材质', renderer.includes('normalizeBipedPetModelRecipe') && renderer.includes('normalizedRecipe')],
  ['Vue 适配器以稳定运行时键避免重复销毁和重建', renderer.includes('lastRuntimeKey')],
  ['Vue primitive 禁用自动释放，避免重复 dispose', renderer.includes('<primitive') && renderer.includes(':dispose="false"')],
  ['运行时与适配器不走网络或 GLB 导入', !/\bfetch\s*\(/.test(`${runtime}\n${renderer}`) && !`${runtime}\n${renderer}`.includes('GLTFLoader')],
  ['适配器只在编译摘要实质变化时 emit', renderer.includes('hash') && renderer.includes('status') && renderer.includes('diagnostics') && renderer.includes('lastEmitted')],
  ['统一 Canvas 以单个 TresCanvas 互斥替换复杂与简单 renderer，并转发真实编译事件', hasCanvasReplacementStructure(canvas)],
  ['外观工坊在 blur 后以外观领域规范化宠物身份，并由 Store 原子复核编译结果', /const\s+activeModelPetId\s*=\s*ref/.test(script(appearance)) && /function\s+commitPetId\s*\(/.test(script(appearance)) && /@blur="commitPetId"/.test(template(appearance)) && /const\s+normalizedPetId\s*=\s*normalizeCustomizableAppearance\(recipe\.value\)\.identity\.petId/.test(script(appearance)) && /recipe\.value\.identity\.petId\s*=\s*normalizedPetId/.test(script(appearance)) && !/watch\(\[currentPetId/.test(script(appearance)) && !/compileBipedPetCharacter/.test(script(appearance)) && /modelVariants\.commitComplexCompilation\(activeModelPetId\.value/.test(script(appearance)) && /:complex-pet-id="activeModelPetId"/.test(template(appearance))],
  ['动作与道具工坊只读取同一持久化复杂配方和最终宠物身份', hasSharedRecipeReadOnlyWiring(motion) && hasSharedRecipeReadOnlyWiring(props) && /:complex-pet-id="currentPetId"/.test(template(motion)) && /:complex-pet-id="currentPetId"/.test(template(props))],
  ['资产库在客户端稳定区域展示中文复杂模型状态并使用统一 petId 回退', /currentPetId\s*=\s*computed\(\(\)\s*=>\s*appearance\.recipe\.identity\.petId\.trim\(\)\s*\|\|\s*session\.selectedAppearanceId\s*\|\|\s*'active-appearance'/.test(script(library)) && /<ClientOnly>/.test(template(library)) && /复杂模型状态加载中/.test(template(library)) && /function\s+formatCompilationStatus\s*\(/.test(script(library)) && /status\s*===\s*'ready'/.test(script(library)) && /status\s*===\s*'blocked'/.test(script(library)) && /status\s*===\s*'draft'/.test(script(library)) && /biped-pet\/v1/.test(template(library)) && /biped-pet-generator\/v1/.test(template(library)) && /complex\.compilation\?\.diagnostics\.length/.test(template(library)) && /complex\.completion/.test(template(library))],
  ['Studio 布局不再声明复杂模式的简单兼容预览', !layout.includes('骨骼渲染器完成前') && !layout.includes('简单模型兼容预览') && layout.includes('复杂模型由站内配方自动生成')],
  ['package 注册门禁并纳入根 typecheck 链', Boolean(packageManifest.scripts?.['check:studio-complex-biped-model']) && packageManifest.scripts.typecheck.includes('pnpm run check:studio-complex-biped-model')],
]

const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('复杂双足萌宠 Three 运行时门禁失败：')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log('复杂双足萌宠 Three 运行时门禁通过。')
}
