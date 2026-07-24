/**
 * 文件职责 / File responsibility
 * 防止 3D 加载、闲时动作、手动动作豁免、不可见暂停和 Side Panel 云灵设置收纳在统一架构中失效。
 * Prevents regressions in 3D loading, idle motions, manual exemptions, invisible pausing, and Side Panel Zeph settings grouping.
 */
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const shared = read('packages/shared/src/pet-runtime-preferences.ts')
const sharedPackage = read('packages/shared/package.json')
const avatar = read('apps/extension/components/avatar/AvatarCanvas.vue')
const settings = read('apps/extension/entrypoints/sidepanel/pet-runtime-settings-tools.ts')
const studio = read('apps/extension/entrypoints/sidepanel/pet-studio-tools.ts')
const experience = read('apps/extension/entrypoints/sidepanel/sidepanel-experience-tools.ts')
const main = read('apps/extension/entrypoints/sidepanel/main.ts')
const motions = read('apps/extension/components/avatar/pet-motions.ts')
const configured = read('apps/extension/components/avatar/ConfiguredCloudFox.vue')
const wxt = read('apps/extension/wxt.config.ts')
const core = read('apps/playground/app/components/studio/ExtensionAlignedCloudFox.vue')
const app = read('apps/extension/entrypoints/sidepanel/App.vue')
const unifiedSource = configured.includes("from 'yk-pets-unified-cloud-fox'")
  && wxt.includes('../playground/app/components/studio/ExtensionAlignedCloudFox.vue')
const checks = [
  ['shared runtime preference contract is exported', shared.includes("YK_PET_RUNTIME_PREFERENCES_STORAGE_KEY = 'yk-pets:runtime-preferences:v1'") && sharedPackage.includes('pet-runtime-preferences')],
  ['recommended idle defaults avoid high energy and easter motions', shared.includes('YK_PET_RECOMMENDED_IDLE_MOTION_IDS') && !shared.match(/YK_PET_RECOMMENDED_IDLE_MOTION_IDS[\s\S]*?'fireworks-show'/)],
  ['3D renderer waits for local preferences', avatar.includes('runtimeReady.value && load3dPet.value') && avatar.includes('await restoreStoredState()')],
  ['disabling 3D destroys the active renderer', avatar.includes('function stop3dRenderer()') && avatar.includes('detachPetElement()') && avatar.includes('data-render-mode="render3d ? \'3d\' : \'static\'"')],
  ['3D implementation remains lazy', avatar.includes("await import('../../entrypoints/content/yk-pet-adapter')") && avatar.includes("defineAsyncComponent(() => import('./ProductionAvatarCanvas.vue'))")],
  ['idle preferences suppress only automatic motions', avatar.includes('effectiveBehavior') && avatar.includes('runtimePreferences.value.idleEnabled') && avatar.includes('idleMotionIds.includes')],
  ['manual motion clicks remain available', avatar.includes('manualMotionPermit') && avatar.includes("node.classList.contains('nova-menu-action')") && avatar.includes('motion.duration + 900')],
  ['offscreen visibility reaches the shared renderer', avatar.includes('viewportActive') && avatar.includes('active: viewportActive.value') && configured.includes(':active="active"') && core.includes('props.active')],
  ['Side Panel exposes both master switches and motion checkboxes', settings.includes('data-load-3d') && settings.includes('data-idle-enabled') && settings.includes('data-idle-motion')],
  ['Side Panel options come from the canonical motion registry', settings.includes('PET_MOTIONS.filter') && motions.includes('idleEligible')],
  ['five workspaces put runtime and Studio tools under Zeph', experience.includes("type SidePanelMode = 'home' | 'memory' | 'audit' | 'network' | 'pet'") && experience.includes('[data-yk-pet-runtime-settings]') && experience.includes('[data-yk-pet-studio-tools]') && experience.includes('content.append(node)')],
  ['task home reuses current memory audit network and Agent flows', experience.includes('PET_MEMORY_STORAGE_KEY') && experience.includes('nova:report:') && experience.includes('.audit-button') && experience.includes('.agent-toggle')],
  ['experience is event-driven and lifecycle-cleaned', experience.includes('MutationObserver') && experience.includes('chrome.storage.onChanged.addListener') && experience.includes('chrome.tabs.onActivated.addListener') && experience.includes('chrome.runtime.onMessage.addListener') && experience.includes("window.addEventListener('pagehide'") && !experience.includes('setInterval(')],
  ['Side Panel installers remain canonical', main.includes('installPetRuntimeSettingsTools(document)') && main.includes('installPetStudioTools(document)') && main.includes('installSidePanelExperienceTools(document)') && studio.includes('YK_PET_RECIPE_STORAGE_KEY')],
  ['Network Lab and Local Agent flows remain present', app.includes("workspace = ref<'memory' | 'audit' | 'network'>") && app.includes('<NetworkLab') && app.includes('ensureAgentConnected')],
  ['all recipes use the same Studio composition topology', unifiedSource && !configured.includes('recipeDriven') && !configured.includes('<CloudFox')],
]
const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('pet runtime preference check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`pet runtime preference check passed: ${checks.length} checks.`)
