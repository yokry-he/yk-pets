/**
 * 文件职责 / File responsibility
 * 在 Side Panel 中提供 3D 云灵加载总开关、闲时动作总开关和逐项自动播放选择，并持久化到扩展本地存储。
 * Adds Side Panel controls for 3D Zeph loading, idle auto-play, and per-motion selection while persisting them in extension-local storage.
 */
import {
  createDefaultPetRuntimePreferences,
  normalizePetRuntimePreferences,
  YK_PET_RECOMMENDED_IDLE_MOTION_IDS,
  YK_PET_RUNTIME_PREFERENCES_STORAGE_KEY,
  type YkPetIdleMotionId,
  type YkPetRuntimePreferences,
} from '@nova/shared/pet-runtime-preferences'
import { PET_MOTIONS, type PetMotionIdleTier } from '../../components/avatar/pet-motions'

const TIER_LABELS: Record<Exclude<PetMotionIdleTier, 'never'>, string> = {
  normal: '轻量动作',
  rare: '生活动作',
  high: '高能动作',
  easter: '彩蛋动作',
}

export async function installPetRuntimeSettingsTools(documentRef: Document) {
  if (documentRef.querySelector('[data-yk-pet-runtime-settings]')) return
  const shell = await waitForShell(documentRef)
  if (!shell || documentRef.querySelector('[data-yk-pet-runtime-settings]')) return

  const card = documentRef.createElement('section')
  card.dataset.ykPetRuntimeSettings = 'true'
  card.className = 'yk-pet-runtime-settings'
  card.innerHTML = createMarkup()
  installStyles(documentRef)

  const anchor = shell.querySelector('.pet-entry-card')
  if (anchor?.parentElement) anchor.insertAdjacentElement('afterend', card)
  else shell.prepend(card)

  const load3dInput = card.querySelector<HTMLInputElement>('[data-load-3d]')!
  const idleEnabledInput = card.querySelector<HTMLInputElement>('[data-idle-enabled]')!
  const motionInputs = [...card.querySelectorAll<HTMLInputElement>('[data-idle-motion]')]
  const status = card.querySelector<HTMLElement>('[data-runtime-status]')!
  const motionRegion = card.querySelector<HTMLElement>('[data-motion-region]')!
  let preferences = createDefaultPetRuntimePreferences()
  let saveTimer: number | null = null
  let statusTimer: number | null = null

  const render = (next: YkPetRuntimePreferences) => {
    preferences = next
    load3dInput.checked = next.load3dPet
    idleEnabledInput.checked = next.idleEnabled
    motionRegion.dataset.disabled = String(!next.idleEnabled)
    for (const input of motionInputs) input.checked = next.idleMotionIds.includes(input.value as YkPetIdleMotionId)
    const selected = next.idleMotionIds.length
    status.textContent = next.idleEnabled
      ? `已选择 ${selected} 个闲时动作。高能和彩蛋动作默认关闭，可按需开启。`
      : '闲时动作已关闭；手动动作仍然可用。'
  }

  const readFromControls = (): YkPetRuntimePreferences => normalizePetRuntimePreferences({
    load3dPet: load3dInput.checked,
    idleEnabled: idleEnabledInput.checked,
    idleMotionIds: motionInputs.filter(input => input.checked).map(input => input.value),
  })

  const save = async () => {
    if (saveTimer !== null) window.clearTimeout(saveTimer)
    saveTimer = null
    preferences = readFromControls()
    render(preferences)
    status.textContent = '正在保存设置…'
    try {
      await chrome.storage.local.set({ [YK_PET_RUNTIME_PREFERENCES_STORAGE_KEY]: preferences })
      status.textContent = preferences.load3dPet
        ? '设置已保存，已打开网页会立即更新。'
        : '设置已保存；3D/WebGL 场景已关闭，仅保留轻量入口。'
    }
    catch (error) {
      status.textContent = `保存失败：${error instanceof Error ? error.message : String(error)}`
    }
    if (statusTimer !== null) window.clearTimeout(statusTimer)
    statusTimer = window.setTimeout(() => render(preferences), 2800)
  }

  const scheduleSave = () => {
    if (saveTimer !== null) window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => save().catch(() => undefined), 90)
  }

  load3dInput.addEventListener('change', scheduleSave)
  idleEnabledInput.addEventListener('change', scheduleSave)
  motionInputs.forEach(input => input.addEventListener('change', scheduleSave))
  card.querySelector('[data-recommended-idle]')?.addEventListener('click', () => {
    const recommended = new Set<string>(YK_PET_RECOMMENDED_IDLE_MOTION_IDS)
    motionInputs.forEach(input => { input.checked = recommended.has(input.value) })
    idleEnabledInput.checked = true
    scheduleSave()
  })
  card.querySelector('[data-clear-idle]')?.addEventListener('click', () => {
    motionInputs.forEach(input => { input.checked = false })
    scheduleSave()
  })

  const onStorageChanged = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName !== 'local' || !changes[YK_PET_RUNTIME_PREFERENCES_STORAGE_KEY]) return
    render(normalizePetRuntimePreferences(changes[YK_PET_RUNTIME_PREFERENCES_STORAGE_KEY]?.newValue))
  }
  chrome.storage.onChanged.addListener(onStorageChanged)
  window.addEventListener('pagehide', () => {
    if (saveTimer !== null) window.clearTimeout(saveTimer)
    if (statusTimer !== null) window.clearTimeout(statusTimer)
    chrome.storage.onChanged.removeListener(onStorageChanged)
  }, { once: true })

  try {
    const stored = await chrome.storage.local.get(YK_PET_RUNTIME_PREFERENCES_STORAGE_KEY)
    render(normalizePetRuntimePreferences(stored[YK_PET_RUNTIME_PREFERENCES_STORAGE_KEY]))
  }
  catch (error) {
    render(preferences)
    status.textContent = `读取设置失败：${error instanceof Error ? error.message : String(error)}`
  }
}

function createMarkup() {
  const groups = (['normal', 'rare', 'high', 'easter'] as const).map((tier) => {
    const motions = PET_MOTIONS.filter(motion => motion.idleEligible && motion.idleTier === tier)
    return `
      <fieldset class="yk-pet-runtime-settings__group">
        <legend>${TIER_LABELS[tier]}</legend>
        <div class="yk-pet-runtime-settings__chips">
          ${motions.map(motion => `
            <label title="${escapeAttribute(motion.description)}">
              <input data-idle-motion type="checkbox" value="${escapeAttribute(motion.id)}">
              <span aria-hidden="true">${escapeHtml(motion.icon)}</span>${escapeHtml(motion.label)}
            </label>
          `).join('')}
        </div>
      </fieldset>
    `
  }).join('')

  return `
    <div class="yk-pet-runtime-settings__heading">
      <div><span>PET RUNTIME</span><h2>网页宠物性能与闲时动作</h2></div><b>LOCAL</b>
    </div>
    <label class="yk-pet-runtime-settings__switch">
      <input data-load-3d type="checkbox">
      <span><strong>加载 3D 云灵</strong><small>关闭后不创建 WebGL 场景，只保留可点击的轻量入口。</small></span>
    </label>
    <label class="yk-pet-runtime-settings__switch">
      <input data-idle-enabled type="checkbox">
      <span><strong>自动播放闲时动作</strong><small>关闭不会影响你从动作菜单手动触发。</small></span>
    </label>
    <div data-motion-region class="yk-pet-runtime-settings__motions">${groups}</div>
    <div class="yk-pet-runtime-settings__actions">
      <button data-recommended-idle type="button">恢复推荐动作</button>
      <button data-clear-idle type="button">全部取消</button>
    </div>
    <small data-runtime-status role="status" aria-live="polite">正在读取本地设置…</small>
  `
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
  if (documentRef.getElementById('yk-pet-runtime-settings-style')) return
  const style = documentRef.createElement('style')
  style.id = 'yk-pet-runtime-settings-style'
  style.textContent = `
    .yk-pet-runtime-settings{display:flex;flex-direction:column;gap:12px;margin:12px 0;padding:14px;border:1px solid rgba(82,224,208,.24);border-radius:18px;background:linear-gradient(145deg,rgba(13,23,39,.96),rgba(9,13,29,.96));color:#eef1ff;box-shadow:0 16px 38px rgba(0,0,0,.18)}
    .yk-pet-runtime-settings__heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.yk-pet-runtime-settings__heading span{color:#8f99b8;font:800 9px/1 ui-monospace,monospace;letter-spacing:.16em}.yk-pet-runtime-settings h2{margin:4px 0 0;font-size:16px}.yk-pet-runtime-settings__heading b{padding:5px 7px;border-radius:8px;color:#72ead8;background:rgba(82,224,208,.12);font:800 10px/1 ui-monospace,monospace}
    .yk-pet-runtime-settings__switch{display:flex;align-items:flex-start;gap:10px;padding:10px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(4,8,20,.36);cursor:pointer}.yk-pet-runtime-settings__switch input{width:18px;height:18px;margin:2px 0 0;accent-color:#52e0d0}.yk-pet-runtime-settings__switch span{display:flex;flex-direction:column;gap:3px}.yk-pet-runtime-settings__switch strong{font-size:13px}.yk-pet-runtime-settings__switch small,.yk-pet-runtime-settings>[data-runtime-status]{color:#9fa8c8;line-height:1.5}
    .yk-pet-runtime-settings__motions{display:flex;flex-direction:column;gap:9px;transition:opacity .16s ease}.yk-pet-runtime-settings__motions[data-disabled=true]{opacity:.5}.yk-pet-runtime-settings__group{min-width:0;margin:0;padding:9px;border:1px solid rgba(255,255,255,.09);border-radius:12px}.yk-pet-runtime-settings__group legend{padding:0 5px;color:#aeb7d5;font-size:11px}.yk-pet-runtime-settings__chips{display:flex;flex-wrap:wrap;gap:6px}.yk-pet-runtime-settings__chips label{display:flex;align-items:center;gap:5px;min-height:30px;padding:5px 8px;border:1px solid rgba(130,121,255,.22);border-radius:999px;color:#cbd2eb;background:rgba(112,102,255,.08);font-size:11px;cursor:pointer}.yk-pet-runtime-settings__chips label:has(input:checked){border-color:rgba(82,224,208,.58);color:#ecfffb;background:rgba(82,224,208,.14)}.yk-pet-runtime-settings__chips input{width:14px;height:14px;margin:0;accent-color:#52e0d0}
    .yk-pet-runtime-settings__actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.yk-pet-runtime-settings button{min-height:36px;border:1px solid rgba(130,121,255,.35);border-radius:10px;color:#fff;background:rgba(112,102,255,.13);cursor:pointer}.yk-pet-runtime-settings button:last-child{border-color:rgba(255,255,255,.15);background:rgba(255,255,255,.05)}.yk-pet-runtime-settings input:focus-visible,.yk-pet-runtime-settings button:focus-visible{outline:2px solid #52e0d0;outline-offset:2px}
    @media (prefers-reduced-motion:reduce){.yk-pet-runtime-settings__motions{transition:none}}
  `
  documentRef.head.append(style)
}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

function escapeAttribute(value: string) {
  return escapeHtml(value)
}
