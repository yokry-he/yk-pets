#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const file = relative => path.join(root, relative)

async function text(relative) { return readFile(file(relative), 'utf8') }
async function save(relative, content) { await writeFile(file(relative), content) }
function replaceOnce(content, before, after, label) {
  const index = content.indexOf(before)
  if (index < 0) throw new Error(`Missing replacement target: ${label}`)
  if (content.indexOf(before, index + before.length) >= 0) throw new Error(`Ambiguous replacement target: ${label}`)
  return content.slice(0, index) + after + content.slice(index + before.length)
}

// 1. Add explicit belly modes and backwards-compatible normalization.
{
  const relative = 'apps/playground/app/domain/pet-species-registry.ts'
  let content = await text(relative)
  content = replaceOnce(content,
`export type BellyPatchStyle = typeof BELLY_PATCH_STYLES[number]['id']
export interface BellyPatchDesignRecipe {
  visible: boolean
`,
`export type BellyPatchStyle = typeof BELLY_PATCH_STYLES[number]['id']
export const BELLY_PATCH_MODES = [
  { id: 'model-default', label: '模型默认肚皮', labelEn: 'Model Default' },
  { id: 'custom', label: 'Studio 自定义肚皮', labelEn: 'Studio Custom' },
  { id: 'none', label: '不显示肚皮', labelEn: 'None' },
] as const
export type BellyPatchMode = typeof BELLY_PATCH_MODES[number]['id']
export interface BellyPatchDesignRecipe {
  mode: BellyPatchMode
  visible: boolean
`, 'belly mode type')
  content = replaceOnce(content,
`export function defaultBellyPatchDesign(): BellyPatchDesignRecipe {
  return { visible: true, style: 'shield', width: 1, height: 1, offsetY: 0 }
}`,
`export function defaultBellyPatchDesign(): BellyPatchDesignRecipe {
  return { mode: 'model-default', visible: true, style: 'shield', width: 1, height: 1, offsetY: 0 }
}`, 'default belly mode')
  content = replaceOnce(content,
`  const bellyStyles = BELLY_PATCH_STYLES.map(item => item.id)
  const chestModes = CHEST_DISPLAY_MODES.map(item => item.id)
`,
`  const bellyStyles = BELLY_PATCH_STYLES.map(item => item.id)
  const bellyModes = BELLY_PATCH_MODES.map(item => item.id)
  const chestModes = CHEST_DISPLAY_MODES.map(item => item.id)
`, 'belly mode normalization list')
  content = replaceOnce(content,
`  const chestMode = candidate.chestDisplay && chestModes.includes(candidate.chestDisplay.mode as ChestDisplayMode)
    ? candidate.chestDisplay.mode as ChestDisplayMode
    : migratedChestMode
  return {
`,
`  const chestMode = candidate.chestDisplay && chestModes.includes(candidate.chestDisplay.mode as ChestDisplayMode)
    ? candidate.chestDisplay.mode as ChestDisplayMode
    : migratedChestMode
  const customBellyGeometry = Boolean(candidate.bellyPatchDesign) && (
    belly.style !== bellyFallback.style
    || (typeof belly.width === 'number' && Math.abs(belly.width - bellyFallback.width) > .001)
    || (typeof belly.height === 'number' && Math.abs(belly.height - bellyFallback.height) > .001)
    || (typeof belly.offsetY === 'number' && Math.abs(belly.offsetY - bellyFallback.offsetY) > .001)
  )
  const bellyMode: BellyPatchMode = bellyModes.includes(belly.mode as BellyPatchMode)
    ? belly.mode as BellyPatchMode
    : belly.visible === false
      ? 'none'
      : customBellyGeometry
        ? 'custom'
        : 'model-default'
  return {
`, 'belly mode migration')
  content = replaceOnce(content,
`    bellyPatchDesign: {
      visible: belly.visible !== false,
      style: bellyStyles.includes(belly.style as BellyPatchStyle) ? belly.style as BellyPatchStyle : bellyFallback.style,
      width: number(belly.width, ...BELLY_PATCH_DESIGN_RANGES.width, bellyFallback.width),
      height: number(belly.height, ...BELLY_PATCH_DESIGN_RANGES.height, bellyFallback.height),
      offsetY: number(belly.offsetY, ...BELLY_PATCH_DESIGN_RANGES.offsetY, bellyFallback.offsetY),
    },
`,
`    bellyPatchDesign: {
      mode: bellyMode,
      visible: bellyMode !== 'none',
      style: bellyStyles.includes(belly.style as BellyPatchStyle) ? belly.style as BellyPatchStyle : bellyFallback.style,
      width: number(belly.width, ...BELLY_PATCH_DESIGN_RANGES.width, bellyFallback.width),
      height: number(belly.height, ...BELLY_PATCH_DESIGN_RANGES.height, bellyFallback.height),
      offsetY: number(belly.offsetY, ...BELLY_PATCH_DESIGN_RANGES.offsetY, bellyFallback.offsetY),
    },
`, 'normalized belly mode')
  await save(relative, content)
}

// 2. Make the extension classic recipe use the model's built-in belly.
{
  const relative = 'apps/playground/app/domain/extension-cloud-fox-default.ts'
  let content = await text(relative)
  content = replaceOnce(content,
`    bellyPatchDesign: {
      visible: true,
`,
`    bellyPatchDesign: {
      mode: 'model-default',
      visible: true,
`, 'extension classic belly mode')
  await save(relative, content)
}

// 3. Replace the Studio editor with an explicit three-mode control.
await save('apps/playground/app/components/studio/StudioBellyPatchEditor.vue', `<!--
  文件职责 / File responsibility
  编辑模型默认、自定义和隐藏三种肚皮模式，以及自定义轮廓参数。
  Edits model-default, custom, and hidden belly modes plus custom silhouette parameters.
-->
<script setup lang="ts">
import {
  BELLY_PATCH_DESIGN_RANGES,
  BELLY_PATCH_MODES,
  BELLY_PATCH_STYLES,
} from '~/domain/pet-species-registry'
import { usePetAppearanceStore } from '~/stores/pet-appearance'

const store = usePetAppearanceStore()
const design = computed(() => store.recipe.bellyPatchDesign)
const customEnabled = computed(() => design.value.mode === 'custom')
function updateMode() {
  design.value.visible = design.value.mode !== 'none'
  store.markDirty()
}
</script>

<template>
  <section class="card">
    <h3>白色肚皮</h3>
    <label>
      显示模式
      <select v-model="design.mode" @focus="store.checkpoint" @change="updateMode">
        <option v-for="item in BELLY_PATCH_MODES" :key="item.id" :value="item.id">{{ item.label }}</option>
      </select>
    </label>
    <p class="hint">
      {{ design.mode === 'model-default' ? '使用正式 Cloud Fox 模型自带的经典肚皮，不再叠加第二层。' : design.mode === 'custom' ? '隐藏模型默认肚皮，仅显示下方自定义轮廓。' : '模型默认肚皮与自定义肚皮都不显示。' }}
    </p>
    <fieldset :disabled="!customEnabled">
      <label>
        自定义样式
        <select v-model="design.style" @focus="store.checkpoint" @change="store.markDirty">
          <option v-for="item in BELLY_PATCH_STYLES" :key="item.id" :value="item.id">{{ item.label }}</option>
        </select>
      </label>
      <label>宽度 {{ design.width.toFixed(2) }}<input v-model.number="design.width" type="range" :min="BELLY_PATCH_DESIGN_RANGES.width[0]" :max="BELLY_PATCH_DESIGN_RANGES.width[1]" step=".01" @pointerdown="store.checkpoint" @input="store.markDirty"></label>
      <label>高度 {{ design.height.toFixed(2) }}<input v-model.number="design.height" type="range" :min="BELLY_PATCH_DESIGN_RANGES.height[0]" :max="BELLY_PATCH_DESIGN_RANGES.height[1]" step=".01" @pointerdown="store.checkpoint" @input="store.markDirty"></label>
      <label>上下位置 {{ design.offsetY.toFixed(2) }}<input v-model.number="design.offsetY" type="range" :min="BELLY_PATCH_DESIGN_RANGES.offsetY[0]" :max="BELLY_PATCH_DESIGN_RANGES.offsetY[1]" step=".01" @pointerdown="store.checkpoint" @input="store.markDirty"></label>
    </fieldset>
  </section>
</template>

<style scoped>
.card{display:flex;flex-direction:column;gap:9px;padding:10px;border:1px solid #ffffff18;border-radius:10px;background:#ffffff08}.card h3,.card p{margin:0}.card label,.card fieldset{display:flex;flex-direction:column;gap:5px;color:#bbc2dc;font-size:13px}.card fieldset{margin:0;padding:0;border:0;gap:9px}.card fieldset:disabled{opacity:.42}.card select{min-height:38px;border:1px solid #ffffff22;border-radius:9px;padding:7px;color:#fff;background:#111526}.card input[type=range]{width:100%;accent-color:#7066ff}.hint{color:#8f99b8;font-size:12px;line-height:1.55}
</style>
`)

// 4. Ensure the Studio preview uses canonical geometry for model-default mode.
{
  const relative = 'apps/playground/app/components/studio/ExtensionCloudFoxBellyPatch.vue'
  let content = await text(relative)
  content = replaceOnce(content,
`const bodyScale = computed(() => vector([
  scheme.model.body.scale[0] * props.appearance.proportions.bodyWidth,
  scheme.model.body.scale[1] * props.appearance.proportions.bodyHeight,
  scheme.model.body.scale[2] * props.appearance.proportions.bodyDepth,
]))
`,
`const bodyScale = computed(() => vector([
  scheme.model.body.scale[0] * props.appearance.proportions.bodyWidth,
  scheme.model.body.scale[1] * props.appearance.proportions.bodyHeight,
  scheme.model.body.scale[2] * props.appearance.proportions.bodyDepth,
]))
const effectiveDesign = computed<BellyPatchDesignRecipe>(() => props.appearance.bellyPatchDesign.mode === 'model-default'
  ? { ...props.appearance.bellyPatchDesign, visible: true, style: 'shield', width: 1, height: 1, offsetY: 0 }
  : { ...props.appearance.bellyPatchDesign, visible: props.appearance.bellyPatchDesign.mode !== 'none' })
`, 'studio effective belly design')
  content = content.replace('() => props.appearance.bellyPatchDesign,', '() => effectiveDesign.value,')
  content = content.replaceAll('appearance.bellyPatchDesign.visible', "appearance.bellyPatchDesign.mode !== 'none'")
  await save(relative, content)
}

// 5. Teach the extension appearance mapper about belly modes.
{
  const relative = 'apps/extension/components/avatar/appearance.ts'
  let content = await text(relative)
  content = replaceOnce(content,
`export type ExtensionBellyPatchStyle = 'oval' | 'shield' | 'bean' | 'teardrop' | 'heart'
`,
`export type ExtensionBellyPatchStyle = 'oval' | 'shield' | 'bean' | 'teardrop' | 'heart'
export type ExtensionBellyPatchMode = 'model-default' | 'custom' | 'none'
`, 'extension belly mode type')
  content = replaceOnce(content,
`  bellyPatchDesign: {
    visible: boolean
`,
`  bellyPatchDesign: {
    mode: ExtensionBellyPatchMode
    visible: boolean
`, 'extension belly mode interface')
  content = replaceOnce(content,
`  bellyPatchDesign: { visible: true, style: 'shield', width: 1, height: 1, offsetY: 0 },
`,
`  bellyPatchDesign: { mode: 'model-default', visible: true, style: 'shield', width: 1, height: 1, offsetY: 0 },
`, 'extension belly mode default')
  content = replaceOnce(content,
`  const bellyStyles: ExtensionBellyPatchStyle[] = ['oval', 'shield', 'bean', 'teardrop', 'heart']
  const chestModes: ExtensionChestDisplayMode[] = ['none', 'energy-core', 'symbol', 'hybrid']
`,
`  const bellyStyles: ExtensionBellyPatchStyle[] = ['oval', 'shield', 'bean', 'teardrop', 'heart']
  const bellyModes: ExtensionBellyPatchMode[] = ['model-default', 'custom', 'none']
  const chestModes: ExtensionChestDisplayMode[] = ['none', 'energy-core', 'symbol', 'hybrid']
  const customBellyGeometry = belly.style !== undefined && (
    belly.style !== defaults.bellyPatchDesign.style
    || (typeof belly.width === 'number' && Math.abs(belly.width - 1) > .001)
    || (typeof belly.height === 'number' && Math.abs(belly.height - 1) > .001)
    || (typeof belly.offsetY === 'number' && Math.abs(belly.offsetY) > .001)
  )
  const bellyMode: ExtensionBellyPatchMode = bellyModes.includes(belly.mode as ExtensionBellyPatchMode)
    ? belly.mode as ExtensionBellyPatchMode
    : belly.visible === false
      ? 'none'
      : customBellyGeometry
        ? 'custom'
        : 'model-default'
`, 'extension belly mode normalization')
  content = replaceOnce(content,
`    bellyPatchDesign: {
      visible: belly.visible !== false,
`,
`    bellyPatchDesign: {
      mode: bellyMode,
      visible: bellyMode !== 'none',
`, 'extension normalized belly mode')
  await save(relative, content)
}

// 6. Fix default-belly/core identification and only draw custom geometry in custom mode.
{
  const relative = 'apps/extension/components/avatar/ConfiguredCloudFox.vue'
  let content = await text(relative)
  content = replaceOnce(content,
`    if (!legacyCore.value && Math.abs(mesh.position.y + .26) < .01 && Math.abs(mesh.position.z - .74) < .02) legacyCore.value = mesh
    if (!legacyBelly.value && Math.abs(mesh.position.y + .26) < .01 && Math.abs(mesh.position.z - .73) < .02 && mesh.scale.z < .3) legacyBelly.value = mesh
`,
`    const isClassicBelly = Math.abs(mesh.position.y + .26) < .01 && Math.abs(mesh.position.z - .73) < .02 && mesh.scale.z < .3
    const isEnergyCore = Math.abs(mesh.position.y + .26) < .01 && Math.abs(mesh.position.z - .74) < .02 && mesh.scale.z >= .3
    if (!legacyBelly.value && isClassicBelly) legacyBelly.value = mesh
    if (!legacyCore.value && isEnergyCore) legacyCore.value = mesh
`, 'separate belly and energy core')
  content = replaceOnce(content,
`  if (legacyBelly.value) legacyBelly.value.visible = false
`,
`  if (legacyBelly.value) legacyBelly.value.visible = visual.value.bellyPatchDesign.mode === 'model-default'
`, 'default belly visibility')
  content = content.replace('v-if="visual.bellyPatchDesign.visible"', 'v-if="visual.bellyPatchDesign.mode === \'custom\'"')
  await save(relative, content)
}

// 7. Add a direct Side Panel import/open-Studio card without coupling it to the large App component.
await save('apps/extension/entrypoints/sidepanel/pet-studio-tools.ts', `/**
 * Side Panel pet appearance tools: open Studio and import a Studio JSON recipe directly into extension storage.
 */
import {
  createPetRecipeEnvelope,
  isRecord,
  normalizePetRecipeEnvelope,
  YK_PET_RECIPE_STORAGE_KEY,
} from '@yk-pets/pet-core'

const STUDIO_URL_KEY = 'yk-pets:studio-url'
const DEFAULT_STUDIO_URL = 'http://localhost:3000/studio'

export async function installPetStudioTools(documentRef: Document) {
  if (documentRef.querySelector('[data-yk-pet-studio-tools]')) return
  const shell = await waitForShell(documentRef)
  if (!shell || documentRef.querySelector('[data-yk-pet-studio-tools]')) return

  const stored = await chrome.storage.local.get(STUDIO_URL_KEY)
  const card = documentRef.createElement('section')
  card.dataset.ykPetStudioTools = 'true'
  card.className = 'yk-pet-studio-tools'
  card.innerHTML = \`
    <div class="yk-pet-studio-tools__heading"><div><span>PET STUDIO</span><h2>宠物形象</h2></div><b>JSON</b></div>
    <p>打开宠物工坊继续编辑，或直接导入 Studio 导出的 JSON 替换当前网页宠物。</p>
    <label>宠物工坊地址<input data-studio-url type="url" value="\${escapeAttribute(String(stored[STUDIO_URL_KEY] || DEFAULT_STUDIO_URL))}"></label>
    <div class="yk-pet-studio-tools__actions"><button data-open-studio type="button">打开宠物工坊</button><button data-import-recipe type="button">导入外观</button></div>
    <input data-recipe-file hidden type="file" accept=".json,application/json">
    <small data-status>导入后会立即写入扩展并更新已打开网页中的宠物。</small>
  \`

  installStyles(documentRef)
  const anchor = shell.querySelector('.pet-voice-card, .pet-entry-card')
  if (anchor?.parentElement) anchor.insertAdjacentElement('afterend', card)
  else shell.prepend(card)

  const urlInput = card.querySelector<HTMLInputElement>('[data-studio-url]')!
  const fileInput = card.querySelector<HTMLInputElement>('[data-recipe-file]')!
  const status = card.querySelector<HTMLElement>('[data-status]')!

  card.querySelector('[data-open-studio]')?.addEventListener('click', async () => {
    const url = normalizeStudioUrl(urlInput.value)
    urlInput.value = url
    await chrome.storage.local.set({ [STUDIO_URL_KEY]: url })
    try { await chrome.tabs.create({ url }) }
    catch { window.open(url, '_blank', 'noopener,noreferrer') }
  })

  card.querySelector('[data-import-recipe]')?.addEventListener('click', () => fileInput.click())
  fileInput.addEventListener('change', async () => {
    const selected = fileInput.files?.[0]
    fileInput.value = ''
    if (!selected) return
    status.textContent = '正在读取并校验外观配方…'
    try {
      const payload = JSON.parse(await selected.text())
      const envelope = toRecipeEnvelope(payload)
      await chrome.storage.local.set({ [YK_PET_RECIPE_STORAGE_KEY]: envelope })
      status.textContent = \`已应用 \${selected.name}。当前网页宠物会自动更新；旧页面可刷新一次。\`
    }
    catch (error) {
      status.textContent = \`导入失败：\${error instanceof Error ? error.message : String(error)}\`
    }
  })
}

function toRecipeEnvelope(payload: unknown) {
  const existing = normalizePetRecipeEnvelope(payload)
  if (existing) return existing
  if (!isRecord(payload)) throw new Error('JSON 顶层必须是对象。')
  const speciesId = typeof payload.speciesId === 'string' ? payload.speciesId : 'cloud-fox'
  if (speciesId !== 'cloud-fox') throw new Error('当前扩展正式渲染器只支持 cloud-fox 配方。')
  return createPetRecipeEnvelope({
    speciesId,
    rendererId: 'extension-cloud-fox',
    source: 'import',
    appearance: payload,
  })
}

function normalizeStudioUrl(input: string) {
  const candidate = input.trim() || DEFAULT_STUDIO_URL
  const url = new URL(candidate)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('宠物工坊地址必须使用 http 或 https。')
  return url.toString()
}

function waitForShell(documentRef: Document) {
  return new Promise<HTMLElement | null>((resolve) => {
    const existing = documentRef.querySelector<HTMLElement>('.sidepanel-shell')
    if (existing) return resolve(existing)
    const observer = new MutationObserver(() => {
      const shell = documentRef.querySelector<HTMLElement>('.sidepanel-shell')
      if (!shell) return
      observer.disconnect()
      resolve(shell)
    })
    observer.observe(documentRef.documentElement, { childList: true, subtree: true })
    window.setTimeout(() => { observer.disconnect(); resolve(documentRef.querySelector<HTMLElement>('.sidepanel-shell')) }, 3000)
  })
}

function installStyles(documentRef: Document) {
  if (documentRef.getElementById('yk-pet-studio-tools-style')) return
  const style = documentRef.createElement('style')
  style.id = 'yk-pet-studio-tools-style'
  style.textContent = \`
    .yk-pet-studio-tools{display:flex;flex-direction:column;gap:10px;margin:12px 0;padding:14px;border:1px solid rgba(112,102,255,.28);border-radius:18px;background:linear-gradient(145deg,rgba(19,24,48,.94),rgba(9,13,29,.94));color:#eef1ff;box-shadow:0 16px 38px rgba(0,0,0,.18)}
    .yk-pet-studio-tools__heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.yk-pet-studio-tools__heading span{color:#8f99b8;font:800 9px/1 ui-monospace,monospace;letter-spacing:.16em}.yk-pet-studio-tools h2{margin:4px 0 0;font-size:16px}.yk-pet-studio-tools__heading b{padding:5px 7px;border-radius:8px;color:#72ead8;background:rgba(82,224,208,.12);font:800 10px/1 ui-monospace,monospace}.yk-pet-studio-tools p,.yk-pet-studio-tools small{margin:0;color:#9fa8c8;line-height:1.55}.yk-pet-studio-tools label{display:flex;flex-direction:column;gap:6px;color:#cbd2eb;font-size:12px}.yk-pet-studio-tools input[type=url]{min-height:38px;padding:0 10px;border:1px solid rgba(255,255,255,.13);border-radius:10px;color:#fff;background:rgba(4,8,20,.55)}.yk-pet-studio-tools__actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.yk-pet-studio-tools button{min-height:40px;border:1px solid rgba(130,121,255,.4);border-radius:11px;color:#fff;background:rgba(112,102,255,.18);cursor:pointer}.yk-pet-studio-tools button:last-child{border-color:rgba(82,224,208,.45);background:rgba(82,224,208,.14)}
  \`
  documentRef.head.append(style)
}

function escapeAttribute(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}
`)

{
  const relative = 'apps/extension/entrypoints/sidepanel/main.ts'
  let content = await text(relative)
  content = replaceOnce(content,
`import { installYkPetsCompatibility } from '../../brand'
import './style.css'
`,
`import { installYkPetsCompatibility } from '../../brand'
import { installPetStudioTools } from './pet-studio-tools'
import './style.css'
`, 'sidepanel pet tools import')
  content = replaceOnce(content,
`createApp(App).mount('#app')
installYkPetsCompatibility(document)
`,
`createApp(App).mount('#app')
installYkPetsCompatibility(document)
installPetStudioTools(document).catch(error => console.warn('[YK-PETS pet studio tools]', error))
`, 'sidepanel pet tools install')
  await save(relative, content)
}

// 8. Add a deterministic regression gate.
await save('scripts/check-pet-appearance-import.mjs', `#!/usr/bin/env node
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL(\`../\${path}\`, import.meta.url), 'utf8')
const registry = read('apps/playground/app/domain/pet-species-registry.ts')
const classic = read('apps/playground/app/domain/extension-cloud-fox-default.ts')
const editor = read('apps/playground/app/components/studio/StudioBellyPatchEditor.vue')
const configured = read('apps/extension/components/avatar/ConfiguredCloudFox.vue')
const appearance = read('apps/extension/components/avatar/appearance.ts')
const preview = read('apps/playground/app/components/studio/ExtensionCloudFoxBellyPatch.vue')
const sidepanel = read('apps/extension/entrypoints/sidepanel/pet-studio-tools.ts')
const main = read('apps/extension/entrypoints/sidepanel/main.ts')
const checks = [
  ['schema has three belly modes', registry.includes("'model-default'") && registry.includes("'custom'") && registry.includes("'none'") && registry.includes('mode: BellyPatchMode')],
  ['classic default uses model belly', classic.includes("mode: 'model-default'")],
  ['Studio exposes mode control', editor.includes('BELLY_PATCH_MODES') && editor.includes('design.mode') && editor.includes('customEnabled')],
  ['Studio preview canonicalizes model default', preview.includes('effectiveDesign') && preview.includes("mode === 'model-default'")],
  ['extension separates default belly and energy core', configured.includes('isClassicBelly') && configured.includes('isEnergyCore') && configured.includes("mode === 'model-default'")],
  ['custom extension belly only draws in custom mode', configured.includes("bellyPatchDesign.mode === 'custom'") && appearance.includes('ExtensionBellyPatchMode')],
  ['Side Panel imports raw Studio JSON into active recipe storage', sidepanel.includes('YK_PET_RECIPE_STORAGE_KEY') && sidepanel.includes('createPetRecipeEnvelope') && sidepanel.includes('chrome.storage.local.set')],
  ['Side Panel opens configurable Studio URL', sidepanel.includes('yk-pets:studio-url') && sidepanel.includes('chrome.tabs.create')],
  ['Side Panel installs pet tools', main.includes('installPetStudioTools(document)')],
]
const failures = checks.filter(([,ok]) => !ok)
for (const [name, ok] of checks) console.log(\`\${ok ? '✓' : '✗'} \${name}\`)
if (failures.length) process.exit(1)
console.log(\`\\n\${checks.length} pet appearance/import checks passed.\`)
`)

{
  const relative = 'package.json'
  const packageJson = JSON.parse(await text(relative))
  if (!packageJson.scripts.typecheck.includes('check-pet-appearance-import.mjs')) {
    packageJson.scripts.typecheck = packageJson.scripts.typecheck.replace(
      'node scripts/check-pet-core-web-component.mjs',
      'node scripts/check-pet-core-web-component.mjs && node scripts/check-pet-appearance-import.mjs',
    )
  }
  packageJson.scripts['check:pet-appearance-import'] = 'node scripts/check-pet-appearance-import.mjs'
  await save(relative, `${JSON.stringify(packageJson, null, 2)}\n`)
}

console.log('Pet belly modes and Side Panel appearance import migration applied.')
