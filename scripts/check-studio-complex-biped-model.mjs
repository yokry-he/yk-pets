/**
 * 锁定复杂双足萌宠的 Three 运行时边界，避免退回网络 GLB 导入或遗漏资源释放。
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const runtimePath = resolve(root, 'apps/playground/app/three/create-complex-biped-pet-object.ts')
const rendererPath = resolve(root, 'apps/playground/app/components/studio/ComplexBipedPetRenderer.vue')
const packagePath = resolve(root, 'package.json')
const runtime = existsSync(runtimePath) ? readFileSync(runtimePath, 'utf8') : ''
const renderer = existsSync(rendererPath) ? readFileSync(rendererPath, 'utf8') : ''
const packageManifest = JSON.parse(readFileSync(packagePath, 'utf8'))

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
