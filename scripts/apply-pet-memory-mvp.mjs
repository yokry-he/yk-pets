#!/usr/bin/env node
// One-time repository migration for the local-first Pet Memory MVP.
import { readFile, writeFile } from 'node:fs/promises'

async function replaceOnce(path, before, after, label) {
  const source = await readFile(path, 'utf8')
  if (!source.includes(before)) throw new Error(`${label}: source token not found in ${path}`)
  const next = source.replace(before, after)
  if (next === source) throw new Error(`${label}: replacement did not change ${path}`)
  await writeFile(path, next)
}

async function appendIfMissing(path, marker, content) {
  const source = await readFile(path, 'utf8')
  if (source.includes(marker)) return
  await writeFile(path, `${source.trimEnd()}\n\n${content.trim()}\n`)
}

await replaceOnce(
  'apps/extension/entrypoints/content.ts',
  `} from '@nova/shared/messages'\nimport overlayStyles`,
  `} from '@nova/shared/messages'\nimport { PET_MEMORY_STORAGE_KEY, memoryMatchesPage, normalizePetMemoryStore } from '@nova/shared/pet-memory'\nimport overlayStyles`,
  'content memory import',
)

await replaceOnce(
  'apps/extension/entrypoints/content.ts',
  `    let previewIssueId: string | null = null\n`,
  `    let previewIssueId: string | null = null\n    let memoryRefreshTimer: number | null = null\n`,
  'content memory timer',
)

await replaceOnce(
  'apps/extension/entrypoints/content.ts',
  `    setupPerformanceObservers(performanceState)\n`,
  `    setupPerformanceObservers(performanceState)\n\n    async function refreshPageMemoryCount() {\n      const stored = await chrome.storage.local.get(PET_MEMORY_STORAGE_KEY)\n      const store = normalizePetMemoryStore(stored[PET_MEMORY_STORAGE_KEY])\n      const memoryCount = store.cards.filter(card => memoryMatchesPage(card, location.href)).length\n      overlay.patch({ memoryCount })\n    }\n\n    function schedulePageMemoryRefresh() {\n      if (memoryRefreshTimer !== null) return\n      memoryRefreshTimer = window.setTimeout(() => {\n        memoryRefreshTimer = null\n        refreshPageMemoryCount().catch(() => undefined)\n      }, 80)\n    }\n\n    function onMemoryStorageChanged(changes: Record<string, chrome.storage.StorageChange>, areaName: string) {\n      if (areaName !== 'local' || !changes[PET_MEMORY_STORAGE_KEY]) return\n      schedulePageMemoryRefresh()\n    }\n\n    chrome.storage.onChanged.addListener(onMemoryStorageChanged)\n    refreshPageMemoryCount().catch(() => undefined)\n    window.addEventListener('pagehide', () => {\n      if (memoryRefreshTimer !== null) window.clearTimeout(memoryRefreshTimer)\n      chrome.storage.onChanged.removeListener(onMemoryStorageChanged)\n    }, { once: true })\n`,
  'content memory count',
)

await replaceOnce(
  'apps/extension/entrypoints/content.ts',
  `      if (message.type === 'NOVA_GET_PAGE_CONTEXT') {\n        sendResponse({ ok: true, url: location.href, title: document.title })\n        return false\n      }\n\n      return false\n`,
  `      if (message.type === 'NOVA_GET_PAGE_CONTEXT') {\n        sendResponse({ ok: true, url: location.href, title: document.title })\n        return false\n      }\n\n      if (message.type === 'YK_PET_MEMORY_GET_CONTEXT') {\n        sendResponse({\n          ok: true,\n          pageUrl: location.href,\n          pageTitle: document.title || location.hostname,\n          selection: document.getSelection()?.toString().trim().slice(0, 4_000) || undefined,\n        })\n        return false\n      }\n\n      return false\n`,
  'content memory context',
)

await replaceOnce(
  'apps/extension/entrypoints/content.ts',
  `      const isNavigationAction = action === 'open-report' || action === 'network-lab' || action === 'connect-agent'\n`,
  `      const isNavigationAction = action === 'open-report' || action === 'open-memory' || action === 'network-lab' || action === 'connect-agent'\n`,
  'content memory navigation',
)

await replaceOnce(
  'apps/extension/entrypoints/content.ts',
  `    'open-report': '我把详细报告打开给你。',\n`,
  `    'open-report': '我把详细报告打开给你。',\n    'open-memory': '正在打开宠物记忆，之前保存的网页上下文都在那里。',\n`,
  'content memory speech',
)

await replaceOnce(
  'apps/extension/entrypoints/content.ts',
  `    agentConnected: false,\n`,
  `    agentConnected: false,\n    memoryCount: 0,\n`,
  'content memory initial state',
)

await replaceOnce(
  'apps/extension/entrypoints/content/NovaPetOverlay.vue',
  `  {\n    id: 'report',\n`,
  `  {\n    id: 'memory',\n    kind: 'action',\n    mode: 'features',\n    action: 'open-memory',\n    icon: '✎',\n    label: '宠物记忆',\n    description: '记录当前网页、选中文字和稍后要处理的任务',\n  },\n  {\n    id: 'report',\n`,
  'overlay memory feature item',
)

await replaceOnce(
  'apps/extension/entrypoints/content/NovaPetOverlay.vue',
  `  if (action === 'open-report' || isAgentAction(action)) closeMenu()\n`,
  `  if (action === 'open-report' || action === 'open-memory' || isAgentAction(action)) closeMenu()\n`,
  'overlay memory close menu',
)

await replaceOnce(
  'apps/extension/entrypoints/content/NovaPetOverlay.vue',
  `      <span v-if="state.issueCount" class="nova-pet-badge">{{ state.issueCount > 99 ? '99+' : state.issueCount }}</span>\n`,
  `      <span v-if="state.memoryCount" class="nova-pet-memory-badge" :title="\`当前页面有 ${state.memoryCount} 条宠物记忆\`">✎ {{ state.memoryCount > 99 ? '99+' : state.memoryCount }}</span>\n      <span v-if="state.issueCount" class="nova-pet-badge">{{ state.issueCount > 99 ? '99+' : state.issueCount }}</span>\n`,
  'overlay memory badge',
)

await appendIfMissing(
  'apps/extension/entrypoints/content/nova-pet-overlay.css',
  '.nova-pet-memory-badge',
  `.nova-pet-memory-badge {
  position: absolute;
  left: 16px;
  top: 22px;
  min-width: 34px;
  height: 25px;
  display: grid;
  place-items: center;
  padding: 0 7px;
  border: 2px solid rgba(9,12,25,.88);
  border-radius: 999px;
  color: #f2f0ff;
  background: linear-gradient(110deg, #7066ff, #5d8cff);
  box-shadow: 0 8px 18px rgba(0,0,0,.22), 0 0 18px rgba(112,102,255,.2);
  font-weight: 850;
  font-size: 9px;
  pointer-events: none;
}`,
)

await replaceOnce(
  'apps/extension/entrypoints/sidepanel/App.vue',
  `import NetworkLab from '../../features/network-lab/presentation/components/NetworkLab.vue'\n`,
  `import NetworkLab from '../../features/network-lab/presentation/components/NetworkLab.vue'\nimport PetMemory from '../../features/pet-memory/presentation/components/PetMemory.vue'\n`,
  'side panel memory import',
)

await replaceOnce(
  'apps/extension/entrypoints/sidepanel/App.vue',
  `const workspace = ref<'audit' | 'network'>('audit')\n`,
  `const workspace = ref<'memory' | 'audit' | 'network'>('memory')\n`,
  'side panel memory workspace state',
)

await replaceOnce(
  'apps/extension/entrypoints/sidepanel/App.vue',
  `async function generatePatch(issue: AuditIssue) {\n`,
  `async function rememberIssue(issue: AuditIssue) {\n  const response = await chrome.runtime.sendMessage({\n    type: 'YK_PET_MEMORY_CREATE',\n    input: {\n      type: 'audit-issue',\n      title: issue.title,\n      content: issue.description,\n      selector: issue.selector,\n      pageUrl: report.value?.url || currentTab.value?.url,\n      pageTitle: report.value?.title || currentTab.value?.title,\n      status: 'todo',\n      priority: issue.severity === 'high' ? 'high' : issue.severity === 'low' ? 'low' : 'medium',\n      tags: ['页面审计', auditCategoryLabel(issue.category)],\n      relatedAuditIssueId: issue.id,\n    },\n  } satisfies NovaRuntimeMessage) as { ok?: boolean; error?: string } | undefined\n  if (!response?.ok) {\n    pageError.value = response?.error || '无法保存审计问题。'\n    return\n  }\n  workspace.value = 'memory'\n  await syncPetState({ behavior: 'greeting', speech: '这个审计问题已经加入宠物记忆和待办。', busy: false })\n}\n\nasync function generatePatch(issue: AuditIssue) {\n`,
  'side panel audit memory conversion',
)

await replaceOnce(
  'apps/extension/entrypoints/sidepanel/App.vue',
  `function onRuntimeMessage(message: NovaRuntimeMessage) {\n  if (message.type === 'NOVA_REPORT_UPDATED'`,
  `function onRuntimeMessage(message: NovaRuntimeMessage) {\n  if (message.type === 'YK_PET_MEMORY_DRAFT_READY' && message.tabId === currentTab.value?.id) {\n    workspace.value = 'memory'\n    return\n  }\n\n  if (message.type === 'NOVA_REPORT_UPDATED'`,
  'side panel memory draft routing',
)

await replaceOnce(
  'apps/extension/entrypoints/sidepanel/App.vue',
  `  if (action === 'open-report') {\n`,
  `  if (action === 'open-memory') {\n    workspace.value = 'memory'\n    showAgent.value = false\n    await nextTick()\n    document.querySelector('.memory-workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' })\n    await syncPetState({ behavior: 'greeting', speech: '宠物记忆已经打开。', busy: false })\n    return\n  }\n\n  if (action === 'open-report') {\n`,
  'side panel pet memory action',
)

await replaceOnce(
  'apps/extension/entrypoints/sidepanel/App.vue',
  `    <nav class="workspace-tabs" aria-label="工作区切换">\n      <button type="button" :class="{ active: workspace === 'audit' }" @click="workspace = 'audit'">页面审计</button>\n      <button type="button" :class="{ active: workspace === 'network' }" @click="workspace = 'network'">网络实验室</button>\n    </nav>\n\n    <template v-if="workspace === 'audit'">\n`,
  `    <nav class="workspace-tabs" aria-label="工作区切换">\n      <button type="button" :class="{ active: workspace === 'memory' }" @click="workspace = 'memory'">宠物记忆</button>\n      <button type="button" :class="{ active: workspace === 'audit' }" @click="workspace = 'audit'">页面审计</button>\n      <button type="button" :class="{ active: workspace === 'network' }" @click="workspace = 'network'">网络实验室</button>\n    </nav>\n\n    <PetMemory\n      v-if="workspace === 'memory'"\n      :tab="currentTab"\n      :active="workspace === 'memory'"\n      @pet-state="syncPetState"\n    />\n\n    <template v-else-if="workspace === 'audit'">\n`,
  'side panel memory tab and component',
)

await replaceOnce(
  'apps/extension/entrypoints/sidepanel/App.vue',
  `           @rollback-preview="rollbackPreview"\n           @patch="generatePatch"\n`,
  `           @rollback-preview="rollbackPreview"\n           @remember="rememberIssue"\n           @patch="generatePatch"\n`,
  'side panel remember issue event',
)

await replaceOnce(
  'apps/extension/entrypoints/sidepanel/components/IssueCard.vue',
  `  rollbackPreview: [issue: AuditIssue]\n  patch: [issue: AuditIssue]\n`,
  `  rollbackPreview: [issue: AuditIssue]\n  remember: [issue: AuditIssue]\n  patch: [issue: AuditIssue]\n`,
  'issue memory emit',
)

await replaceOnce(
  'apps/extension/entrypoints/sidepanel/components/IssueCard.vue',
  `      <button type="button" :disabled="!agentConnected || busy" @click="emit('patch', issue)">\n`,
  `      <button type="button" @click="emit('remember', issue)">记住</button>\n      <button type="button" :disabled="!agentConnected || busy" @click="emit('patch', issue)">\n`,
  'issue memory button',
)

await replaceOnce(
  'apps/extension/features/pet-memory/presentation/components/PetMemory.vue',
  `import type { NovaPetVisualState } from '@nova/shared/messages'\n`,
  `import type { NovaPetVisualState, NovaRuntimeMessage } from '@nova/shared/messages'\n`,
  'memory component runtime import',
)

await replaceOnce(
  'apps/extension/features/pet-memory/presentation/components/PetMemory.vue',
  `onMounted(async () => {\n  await memory.refresh()\n  await consumePendingIntent()\n})\n`,
  `onMounted(async () => {\n  chrome.runtime.onMessage.addListener(onMemoryRuntimeMessage)\n  await memory.refresh()\n  await consumePendingIntent()\n})\n`,
  'memory component draft listener mount',
)

await replaceOnce(
  'apps/extension/features/pet-memory/presentation/components/PetMemory.vue',
  `onBeforeUnmount(() => clearUndoTimer())\n\nasync function consumePendingIntent() {\n`,
  `onBeforeUnmount(() => {\n  clearUndoTimer()\n  chrome.runtime.onMessage.removeListener(onMemoryRuntimeMessage)\n})\n\nfunction onMemoryRuntimeMessage(message: NovaRuntimeMessage) {\n  if (message.type !== 'YK_PET_MEMORY_DRAFT_READY' || message.tabId !== props.tab?.id || !props.active) return\n  consumePendingIntent().catch(() => undefined)\n}\n\nasync function consumePendingIntent() {\n`,
  'memory component draft listener cleanup',
)

await replaceOnce(
  'apps/extension/entrypoints/background.ts',
  `  window.setTimeout(() => {\n`,
  `  setTimeout(() => {\n`,
  'background service worker timeout',
)

const packagePath = 'package.json'
const packageJson = JSON.parse(await readFile(packagePath, 'utf8'))
if (!packageJson.scripts.typecheck.includes('check-pet-memory.mjs')) {
  packageJson.scripts.typecheck = packageJson.scripts.typecheck.replace(
    'node scripts/check-pet-appearance-import.mjs &&',
    'node scripts/check-pet-appearance-import.mjs && node scripts/check-pet-memory.mjs &&',
  )
}
packageJson.scripts['check:pet-memory'] = 'node scripts/check-pet-memory.mjs'
await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`)

await appendIfMissing(
  'apps/extension/entrypoints/sidepanel/style.css',
  '.workspace-tabs {',
  `.workspace-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  margin-top: 10px;
  padding: 4px;
  border: 1px solid #232941;
  border-radius: 12px;
  background: #0b0f1d;
}
.workspace-tabs button {
  min-width: 0;
  min-height: 34px;
  padding: 0 6px;
  border: 0;
  border-radius: 9px;
  color: #7e87a8;
  background: transparent;
  cursor: pointer;
  font-size: 9px;
  font-weight: 750;
}
.workspace-tabs button.active {
  color: #f2f3ff;
  background: linear-gradient(145deg, rgba(112,102,255,.22), rgba(82,224,208,.08));
  box-shadow: inset 0 0 0 1px rgba(112,102,255,.22);
}`,
)

console.log('Pet Memory MVP migration applied.')
