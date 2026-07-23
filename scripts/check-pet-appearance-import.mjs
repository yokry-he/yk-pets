#!/usr/bin/env node
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
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
for (const [name, ok] of checks) console.log(`${ok ? '✓' : '✗'} ${name}`)
if (failures.length) process.exit(1)
console.log(`\n${checks.length} pet appearance/import checks passed.`)
