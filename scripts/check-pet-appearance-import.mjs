#!/usr/bin/env node
/**
 * 文件职责 / File responsibility
 * 校验默认、Studio 和导入配方都进入同一个完整可配置 Cloud Fox 组件，并保持显式肚皮与全局部位颜色迁移。
 * Verifies that default, Studio, and imported recipes enter one complete customizable Cloud Fox component while preserving explicit belly and all-part color migration.
 */
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const customization = read('apps/playground/app/domain/pet-part-customization.ts')
const classic = read('apps/playground/app/domain/extension-cloud-fox-default.ts')
const editor = read('apps/playground/app/components/studio/StudioBellyPatchEditor.vue')
const configured = read('apps/extension/components/avatar/ConfiguredCloudFox.vue')
const wxt = read('apps/extension/wxt.config.ts')
const core = read('apps/playground/app/components/studio/ExtensionAlignedCloudFox.vue')
const body = read('apps/playground/app/components/studio/ExtensionCloudFoxBody.vue')
const head = read('apps/playground/app/components/studio/ExtensionCloudFoxHead.vue')
const face = read('apps/playground/app/components/studio/ExtensionCloudFoxFaceCustomization.vue')
const tail = read('apps/playground/app/components/studio/ExtensionCloudFoxTail.vue')
const preview = read('apps/playground/app/components/studio/ExtensionCloudFoxBellyPatch.vue')
const sidepanel = read('apps/extension/entrypoints/sidepanel/pet-studio-tools.ts')
const main = read('apps/extension/entrypoints/sidepanel/main.ts')
const unifiedSource = configured.includes("from 'yk-pets-unified-cloud-fox'")
  && wxt.includes('../playground/app/components/studio/ExtensionAlignedCloudFox.vue')
const checks = [
  ['belly migration is explicit and ellipse-first', customization.includes("shape: 'ellipse'") && customization.includes('normalizeBelly') && customization.includes('legacyBelly')],
  ['Studio exposes visual belly shape controls', editor.includes('PET_BELLY_SHAPES') && editor.includes('shape-grid') && editor.includes('恢复椭圆默认')],
  ['canonical preview consumes explicit belly customization', preview.includes('resolvePetCustomization') && preview.includes("shape === 'ellipse'") && !preview.includes("mode === 'model-default'")],
  ['one customization normalizer handles every recipe source', configured.includes('normalizeCustomizableAppearance') && configured.includes('createExtensionClassicAppearance')],
  ['extension has no default/import topology branch', configured.includes('<ExtensionAlignedCloudFox') && !configured.includes('recipeDriven') && !configured.includes('<CloudFox')],
  ['extension resolves the exact Studio composition source', unifiedSource],
  ['canonical renderer consumes complete appearance channels', body.includes('frontPawDesign') && body.includes('symbols.chest') && head.includes('earDesign') && face.includes('appearance.parts.nose') && face.includes('appearance.parts.mouth') && tail.includes('tailDesign') && core.includes('ExtensionCloudFoxOrbit')],
  ['Side Panel imports raw Studio JSON into active recipe storage', sidepanel.includes('YK_PET_RECIPE_STORAGE_KEY') && sidepanel.includes('createPetRecipeEnvelope') && sidepanel.includes('chrome.storage.local.set')],
  ['Side Panel opens configurable Studio URL', sidepanel.includes('yk-pets:studio-url') && sidepanel.includes('chrome.tabs.create')],
  ['Side Panel installs pet tools', main.includes('installPetStudioTools(document)')],
]
const failures = checks.filter(([, ok]) => !ok)
for (const [name, ok] of checks) console.log(`${ok ? '✓' : '✗'} ${name}`)
if (failures.length) process.exit(1)
console.log(`\n${checks.length} pet appearance/import checks passed.`)
