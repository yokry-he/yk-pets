/**
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
  card.innerHTML = `
    <div class="yk-pet-studio-tools__heading"><div><span>PET STUDIO</span><h2>宠物形象</h2></div><b>JSON</b></div>
    <p>打开宠物工坊继续编辑，或直接导入 Studio 导出的 JSON 替换当前网页宠物。</p>
    <label>宠物工坊地址<input data-studio-url type="url" value="${escapeAttribute(String(stored[STUDIO_URL_KEY] || DEFAULT_STUDIO_URL))}"></label>
    <div class="yk-pet-studio-tools__actions"><button data-open-studio type="button">打开宠物工坊</button><button data-import-recipe type="button">导入外观</button></div>
    <input data-recipe-file hidden type="file" accept=".json,application/json">
    <small data-status>导入后会立即写入扩展并更新已打开网页中的宠物。</small>
  `

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
      status.textContent = `已应用 ${selected.name}。当前网页宠物会自动更新；旧页面可刷新一次。`
    }
    catch (error) {
      status.textContent = `导入失败：${error instanceof Error ? error.message : String(error)}`
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
  style.textContent = `
    .yk-pet-studio-tools{display:flex;flex-direction:column;gap:10px;margin:12px 0;padding:14px;border:1px solid rgba(112,102,255,.28);border-radius:18px;background:linear-gradient(145deg,rgba(19,24,48,.94),rgba(9,13,29,.94));color:#eef1ff;box-shadow:0 16px 38px rgba(0,0,0,.18)}
    .yk-pet-studio-tools__heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.yk-pet-studio-tools__heading span{color:#8f99b8;font:800 9px/1 ui-monospace,monospace;letter-spacing:.16em}.yk-pet-studio-tools h2{margin:4px 0 0;font-size:16px}.yk-pet-studio-tools__heading b{padding:5px 7px;border-radius:8px;color:#72ead8;background:rgba(82,224,208,.12);font:800 10px/1 ui-monospace,monospace}.yk-pet-studio-tools p,.yk-pet-studio-tools small{margin:0;color:#9fa8c8;line-height:1.55}.yk-pet-studio-tools label{display:flex;flex-direction:column;gap:6px;color:#cbd2eb;font-size:12px}.yk-pet-studio-tools input[type=url]{min-height:38px;padding:0 10px;border:1px solid rgba(255,255,255,.13);border-radius:10px;color:#fff;background:rgba(4,8,20,.55)}.yk-pet-studio-tools__actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.yk-pet-studio-tools button{min-height:40px;border:1px solid rgba(130,121,255,.4);border-radius:11px;color:#fff;background:rgba(112,102,255,.18);cursor:pointer}.yk-pet-studio-tools button:last-child{border-color:rgba(82,224,208,.45);background:rgba(82,224,208,.14)}
  `
  documentRef.head.append(style)
}

function escapeAttribute(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}
