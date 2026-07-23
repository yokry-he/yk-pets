#!/usr/bin/env node
/**
 * 文件职责 / File responsibility
 * 防止宠物记忆的本地存储、快捷捕捉、JSON 导入、摘录重新定位、当前页面徽章、Side Panel 工作区和宠物反馈链路回退。
 * Prevents regressions in pet-memory local storage, quick capture, JSON import, excerpt relocation, current-page badges, Side Panel workspace, and pet feedback flows.
 */
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const domain = read('packages/shared/src/pet-memory.ts')
const navigation = read('packages/shared/src/pet-memory-navigation.ts')
const sharedPackage = read('packages/shared/package.json')
const messages = read('packages/shared/src/messages.ts')
const repository = read('apps/extension/features/pet-memory/infrastructure/chrome-pet-memory-repository.ts')
const composable = read('apps/extension/features/pet-memory/presentation/composables/usePetMemory.ts')
const component = read('apps/extension/features/pet-memory/presentation/components/PetMemory.vue')
const memoryImportTools = read('apps/extension/entrypoints/sidepanel/pet-memory-import-tools.ts')
const memoryCurrentPageTools = read('apps/extension/entrypoints/sidepanel/pet-memory-current-page-tools.ts')
const sidePanelMain = read('apps/extension/entrypoints/sidepanel/main.ts')
const background = read('apps/extension/entrypoints/background.ts')
const content = read('apps/extension/entrypoints/content.ts')
const memoryBadgeContent = read('apps/extension/entrypoints/pet-memory-badge.content.ts')
const memoryHighlightContent = read('apps/extension/entrypoints/pet-memory-highlight.content.ts')
const overlay = read('apps/extension/entrypoints/content/NovaPetOverlay.vue')
const app = read('apps/extension/entrypoints/sidepanel/App.vue')
const issueCard = read('apps/extension/entrypoints/sidepanel/components/IssueCard.vue')
const manifest = read('apps/extension/wxt.config.ts')
const rootPackage = read('package.json')
const importTest = read('scripts/test-pet-memory-import.ts')

const checks = [
  ['versioned local-first memory domain', domain.includes("PET_MEMORY_STORAGE_KEY = 'yk-pets:pet-memory:v1'") && domain.includes('PetMemoryCard') && domain.includes('normalizePetMemoryStore')],
  ['background serializes memory mutations', repository.includes('mutationQueue') && repository.includes('enqueueMutation') && repository.includes('PET_MEMORY_MAX_CARDS')],
  ['runtime protocol covers memory CRUD import and draft focus', messages.includes("type: 'YK_PET_MEMORY_CREATE'") && messages.includes("type: 'YK_PET_MEMORY_IMPORT'") && messages.includes("type: 'YK_PET_MEMORY_UPDATE'") && messages.includes("type: 'YK_PET_MEMORY_DRAFT_READY'")],
  ['JSON import is additive validated and capacity bounded', domain.includes('planPetMemoryImport') && domain.includes('duplicateCount') && domain.includes('conflictCount') && repository.includes('importPetMemoryCards') && repository.includes('store.cards = plan.cards')],
  ['JSON import has runtime UI loading success and failure states', background.includes("message.type === 'YK_PET_MEMORY_IMPORT'") && composable.includes('importing') && composable.includes('importJson') && memoryImportTools.includes('导入 JSON') && memoryImportTools.includes('formatImportResult') && memoryImportTools.includes('导入失败：') && sidePanelMain.includes('installPetMemoryImportTools')],
  ['JSON import behavior has executable regression coverage', rootPackage.includes('test:pet-memory-import') && importTest.includes('planPetMemoryImport') && importTest.includes('truncatedCount') && importTest.includes('assert.throws')],
  ['excerpt relocation protocol opens source pages and reports matches', messages.includes("type: 'YK_PET_MEMORY_HIGHLIGHT'") && memoryImportTools.includes('relocateMemoryCard') && memoryImportTools.includes('waitForTabComplete') && memoryImportTools.includes('定位摘录') && memoryImportTools.includes('formatRelocateResult')],
  ['excerpt relocation scans only on explicit requests within fixed bounds', memoryHighlightContent.includes("message.type !== 'YK_PET_MEMORY_HIGHLIGHT'") && memoryHighlightContent.includes('MAX_TEXT_SCAN_NODES') && memoryHighlightContent.includes('MAX_TEXT_SCAN_CHARACTERS') && memoryHighlightContent.includes('document.createTreeWalker') && !memoryHighlightContent.includes('setInterval(')],
  ['excerpt relocation uses exact ranges accessible states and reduced motion', memoryHighlightContent.includes('selection?.addRange') && memoryHighlightContent.includes('range.getClientRects') && memoryHighlightContent.includes("prefers-reduced-motion: reduce") && memoryHighlightContent.includes('HIGHLIGHT_DURATION_MS') && memoryImportTools.includes("aria-label', '打开来源页面并重新定位这段网页摘录")],
  ['current-page badge request is versioned fresh and exported', navigation.includes("PET_MEMORY_CURRENT_PAGE_REQUEST_KEY = 'yk-pets:pending-current-page-filter:v1'") && navigation.includes('PET_MEMORY_CURRENT_PAGE_REQUEST_TTL_MS') && navigation.includes('normalizePetMemoryCurrentPageRequest') && sharedPackage.includes('"./pet-memory-navigation"')],
  ['current-page badge is an independent keyboard-accessible control', memoryBadgeContent.includes("document.createElement('button')") && memoryBadgeContent.includes('event.stopPropagation()') && memoryBadgeContent.includes("setAttribute('aria-label'") && memoryBadgeContent.includes('focus-visible') && memoryBadgeContent.includes('pointer-events:auto')],
  ['current-page badge preserves the Side Panel user gesture', memoryBadgeContent.includes('Promise.all([requestWrite, openRequest])') && memoryBadgeContent.includes("type: 'NOVA_OPEN_SIDE_PANEL'") && memoryBadgeContent.includes("action: 'open-memory'") && memoryBadgeContent.includes('PET_MEMORY_CURRENT_PAGE_REQUEST_KEY')],
  ['Side Panel resets stale filters and focuses Current Page', memoryCurrentPageTools.includes('clearSearch(controls.search)') && memoryCurrentPageTools.includes('controls.allTags?.click()') && memoryCurrentPageTools.includes('controls.pageButton.click()') && memoryCurrentPageTools.includes('controls.pageButton.focus') && memoryCurrentPageTools.includes('已显示当前页面的')],
  ['current-page bridge is event-driven and lifecycle-cleaned', sidePanelMain.includes('installPetMemoryCurrentPageTools') && memoryCurrentPageTools.includes('chrome.storage.onChanged.addListener') && memoryCurrentPageTools.includes('chrome.runtime.onMessage.addListener') && memoryCurrentPageTools.includes("window.addEventListener('pagehide'") && !memoryCurrentPageTools.includes('setInterval(') && !memoryBadgeContent.includes('setInterval(')],
  ['selection and page context menus are installed', background.includes("contexts: ['selection']") && background.includes("contexts: ['page']") && background.includes('saveSelectionMemory')],
  ['keyboard shortcut opens a focused memory draft', manifest.includes("'quick-pet-memory'") && background.includes('openMemoryComposer') && background.includes('focusComposer: true')],
  ['Side Panel memory workspace supports capture search status and export', component.includes('交给云灵记住') && component.includes('memory-search') && component.includes('runPrimaryAction') && component.includes("exportMemories('markdown')")],
  ['memory UI supports archive undo and keyboard save', component.includes('undoArchiveCard') && component.includes("event.key === 'Enter'")],
  ['current-page memory badge reaches the pet overlay', content.includes('refreshPageMemoryCount') && overlay.includes('nova-pet-memory-badge') && messages.includes('memoryCount?: number')],
  ['audit issues can become memory cards', issueCard.includes("remember: [issue: AuditIssue]") && app.includes('rememberIssue') && app.includes("type: 'audit-issue'")],
  ['memory workspace is a primary Side Panel tab', app.includes("workspace = ref<'memory' | 'audit' | 'network'>('memory')") && app.includes('宠物记忆') && app.includes('<PetMemory')],
  ['memory changes refresh across extension contexts', composable.includes("message.type !== 'YK_PET_MEMORY_UPDATED'") && background.includes('notifyPetMemoryUpdated')],
  ['manifest declares the minimum new capture permission', manifest.includes("'contextMenus'") && !manifest.includes("'unlimitedStorage'")],
  ['root typecheck includes pet-memory gate', rootPackage.includes('check-pet-memory.mjs')],
]

const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('pet memory check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`pet memory check passed: ${checks.length} checks.`)
