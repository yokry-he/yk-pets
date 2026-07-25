#!/usr/bin/env node
/**
 * 文件职责 / File responsibility
 * 锁定版本化道具实体、参数化组件树、材质锚点编辑、迁移预算和唯一场景预览。
 * Locks versioned prop entities, parametric component trees, material/anchor editing, migration budgets, and sole-scene preview.
 */
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const domain = read('packages/pet-core/src/props/prop-asset.ts')
const tests = read('packages/pet-core/test/prop-asset.test.ts')
const workspace = read('apps/playground/app/domain/studio-workspace.ts')
const store = read('apps/playground/app/stores/studio-assets.ts')
const page = read('apps/playground/app/pages/studio/props.vue')
const model = read('apps/playground/app/components/studio/StudioPropModel.vue')
const node = read('apps/playground/app/components/studio/StudioPropComponentNode.vue')
const instances = read('apps/playground/app/components/studio/ExtensionCloudFoxPropInstances.vue')
const canvas = read('apps/playground/app/components/studio/CloudFoxStudioCanvas.vue')
const checks = [
  ['schema defines components materials anchors and budgets', domain.includes('STUDIO_PROP_ASSET_SCHEMA_VERSION = 2') && domain.includes('STUDIO_PROP_COMPONENT_LIMIT = 48') && domain.includes('StudioPropComponent') && domain.includes('StudioPropMaterial') && domain.includes('StudioPropAnchor')],
  ['all required parametric primitive families are present', ['sphere','box','cylinder','cone','torus','capsule','crystal','text','particles'].every(token => domain.includes(`'${token}'`))],
  ['legacy props migrate into normalized entities', domain.includes('legacy-prop-migrated') && domain.includes('anchorIds') && store.includes('normalizePropAssetCollection') && workspace.includes('StudioPropAssetV2')],
  ['store exposes component tree anchor duplicate import and replacement commands', ['addPropComponent','duplicatePropComponent','removePropComponent','updatePropAnchor','duplicateProp','importProp','replaceProp'].every(token => store.includes(token))],
  ['Prop Studio edits hierarchy transforms geometry materials and anchors', page.includes('道具组件层级') && page.includes('父组件') && page.includes('geometry-grid') && page.includes('material-grid') && page.includes('内部锚点') && page.includes('导入 JSON') && page.includes('导出 JSON')],
  ['formal preview renders the versioned model in the existing Cloud Fox canvas', page.includes(':prop-instances="previewInstances"') && page.includes('preserve-prop-materials') && instances.includes('StudioPropModel') && model.includes('StudioPropComponentNode') && !model.includes('<TresCanvas') && !node.includes('<TresCanvas') && canvas.includes('<TresCanvas')],
  ['recursive renderer supports hierarchy and all primitive renderers', node.includes('children') && node.includes('StudioPropComponentNode') && ['TresSphereGeometry','TresBoxGeometry','TresCylinderGeometry','TresConeGeometry','TresTorusGeometry','TresCapsuleGeometry','TresOctahedronGeometry'].every(token => node.includes(token))],
  ['tests cover migration budgets hierarchy anchors and editing', ['legacy prop metadata', 'components normalize ranges', 'component and anchor editing'].every(token => tests.includes(token))],
  ['no network upload polling websocket or second canvas', [domain, store, page, model, node].every(source => !source.includes('fetch(') && !source.includes('WebSocket') && !source.includes('setInterval(')) && !page.includes('<TresCanvas')],
]
const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) { console.error('Prop entity editor check failed:'); for (const failure of failures) console.error(`- ${failure}`); process.exit(1) }
console.log(`Prop entity editor passed: ${checks.length} checks.`)
