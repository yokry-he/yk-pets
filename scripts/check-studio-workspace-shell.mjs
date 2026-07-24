#!/usr/bin/env node
/**
 * 文件职责 / File responsibility
 * 锁定统一 Studio 壳、四个独立路由、共享会话与资产库，并防止外观工坊迁移时丢失现有能力。
 * Locks the unified Studio shell, four routed workspaces, shared session and asset library, and prevents appearance capability loss during migration.
 */
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const domain = read('apps/playground/app/domain/studio-workspace.ts')
const session = read('apps/playground/app/stores/studio-session.ts')
const assets = read('apps/playground/app/stores/studio-assets.ts')
const layout = read('apps/playground/app/layouts/studio.vue')
const legacy = read('apps/playground/app/pages/studio.vue')
const appearancePage = read('apps/playground/app/pages/studio/appearance.vue')
const appearanceWorkspace = read('apps/playground/app/components/studio/StudioAppearanceWorkspace.vue')
const motionPage = read('apps/playground/app/pages/studio/motion.vue')
const propPage = read('apps/playground/app/pages/studio/props.vue')
const libraryPage = read('apps/playground/app/pages/studio/library.vue')
const manifest = read('apps/extension/wxt.config.ts')

const routes = ['/studio/appearance', '/studio/motion', '/studio/props', '/studio/library']
const checks = [
  ['four workspaces have stable independent routes', routes.every(path => domain.includes(`path: '${path}'`)) && domain.includes("StudioWorkspaceId = 'appearance' | 'motion' | 'props' | 'library'")],
  ['shared shell owns navigation and context jumps', layout.includes('STUDIO_WORKSPACES') && layout.includes('selectedAppearanceId') && layout.includes('selectedMotionId') && layout.includes('selectedPropId') && layout.includes('<slot />')],
  ['legacy Studio URL redirects to appearance', legacy.includes("navigateTo('/studio/appearance'") && legacy.includes('replace: true')],
  ['appearance workspace uses the shared shell', appearancePage.includes("layout: 'studio'") && appearancePage.includes('<StudioAppearanceWorkspace')],
  ['appearance migration keeps complete existing editors', appearanceWorkspace.includes('StudioFrontPawEditor') && appearanceWorkspace.includes('StudioHindPawEditor') && appearanceWorkspace.includes('StudioBellyPatchEditor') && appearanceWorkspace.includes('StudioTailEditor') && appearanceWorkspace.includes('保存并用于同步') && appearanceWorkspace.includes('exportRecipe')],
  ['session context is locally persisted and editor-agnostic', session.includes('STUDIO_SESSION_STORAGE_KEY') && session.includes('previewView') && session.includes('lastWorkspace') && !session.includes('fetch(') && !session.includes('setInterval(')],
  ['shared asset store owns stable motion and prop IDs', assets.includes("createStudioAssetId('motion')") && assets.includes("createStudioAssetId('prop')") && assets.includes('durationMs') && assets.includes('defaultAnchor') && assets.includes('propIds')],
  ['motion workspace has asset metadata preview timeline and prop dependencies', motionPage.includes("layout: 'studio'") && motionPage.includes('CloudFoxStudioCanvas') && motionPage.includes('durationMs') && motionPage.includes('loopMode') && motionPage.includes('时间轴基础') && motionPage.includes('道具依赖')],
  ['prop workspace has asset metadata anchors hierarchy and motion jump', propPage.includes("layout: 'studio'") && propPage.includes('defaultAnchor') && propPage.includes('anchorIds') && propPage.includes('道具组件层级') && propPage.includes('/studio/motion?prop=')],
  ['asset library links appearance motions and props', libraryPage.includes("layout: 'studio'") && libraryPage.includes('EXTENSION_CLOUD_FOX_MOTIONS.length') && libraryPage.includes('editMotion') && libraryPage.includes('editProp')],
  ['new shell adds no upload polling websocket or Chrome permission', [domain, session, assets, layout, motionPage, propPage, libraryPage].every(source => !source.includes('fetch(') && !source.includes('WebSocket') && !source.includes('setInterval(')) && manifest.includes("permissions: ['activeTab', 'contextMenus', 'scripting', 'storage', 'sidePanel', 'tts']")],
]
const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('Studio workspace shell check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`Studio workspace shell passed: ${checks.length} checks.`)
