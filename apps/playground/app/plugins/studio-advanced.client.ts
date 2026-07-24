/**
 * 文件职责 / File responsibility
 * 为 Pet Studio 安装参数搜索、只读经典对比、点击式部位聚焦、本地方案库和最近编辑历史，并在销毁时恢复临时对比快照。
 * Installs parameter search, read-only classic comparison, clickable part focus, local schemes, and recent history for Pet Studio, restoring temporary comparison snapshots on disposal.
 */
import { nextTick, watch } from 'vue'
import { createExtensionClassicAppearance } from '~/domain/extension-cloud-fox-default'
import { normalizeCustomizableAppearance } from '~/domain/pet-part-customization'
import { usePetAppearanceStore } from '~/stores/pet-appearance'

const STYLE_ID = 'yk-studio-advanced-style'
const EXPERIENCE_ATTRIBUTE = 'data-yk-studio-advanced'

type StudioSection = '身份' | '头部' | '身体' | '颜色' | '尾巴触角' | '发光轨道' | '标志' | '检查'
interface SearchEntry {
  label: string
  section: StudioSection
  keywords: string
}

const SEARCH_ENTRIES: readonly SearchEntry[] = [
  { label: '鼻子形状与颜色', section: '头部', keywords: '鼻子 nose 三角 感应器 纽扣 爱心 颜色' },
  { label: '嘴巴形状与舌头', section: '头部', keywords: '嘴巴 mouth 微笑 猫系 线条 张嘴 嘟嘴 舌头' },
  { label: '眼睛与耳朵', section: '头部', keywords: '眼睛 eyes 耳朵 ears 高光 内耳 耳尖' },
  { label: '身体形状与比例', section: '身体', keywords: '身体 body 宽度 高度 厚度 四肢 爪子' },
  { label: '肚皮形状与位置', section: '身体', keywords: '肚皮 belly 椭圆 蛋形 盾牌 水滴 豆形 爱心 云朵 胸毛' },
  { label: '所有部位颜色', section: '颜色', keywords: '颜色 color palette 全部位 材质' },
  { label: '尾巴与触角', section: '尾巴触角', keywords: '尾巴 tail 触角 antenna 分段 尾尖' },
  { label: '发光与身体轨道', section: '发光轨道', keywords: '发光 glow 轨道 orbit 粒子' },
  { label: '胸口与后背标志', section: '标志', keywords: '标志 symbol 胸口 后背 字母' },
  { label: '外观检查', section: '检查', keywords: '检查 audit 穿模 边界 风险' },
]

export default defineNuxtPlugin(async () => {
  if (!import.meta.client || !location.pathname.startsWith('/studio')) return
  await nextTick()
  const page = await waitForElement<HTMLElement>('.studio-page')
  if (!page || page.hasAttribute(EXPERIENCE_ATTRIBUTE)) return

  page.setAttribute(EXPERIENCE_ATTRIBUTE, 'true')
  installStyles()
  const store = usePetAppearanceStore()
  store.hydrate()

  const topbar = page.querySelector<HTMLElement>('.topbar')
  const preview = page.querySelector<HTMLElement>('.preview-panel')
  const inspector = page.querySelector<HTMLElement>('.inspector')
  if (!topbar || !preview || !inspector) return

  const search = createSearch()
  const compare = createCompareControl()
  const hotspots = createHotspots()
  const advanced = createAdvancedPanel()
  const actions = topbar.querySelector('.actions')
  if (actions) topbar.insertBefore(search.root, actions)
  else topbar.append(search.root)
  preview.append(hotspots)
  inspector.querySelector(':scope > header')?.insertAdjacentElement('afterend', advanced.root)
  preview.querySelector('.preview-toolbar')?.append(compare.root)

  let compareSnapshot = ''
  let disposed = false

  const selectSection = (section: StudioSection) => {
    const button = [...page.querySelectorAll<HTMLButtonElement>('.part-nav button')]
      .find(item => item.textContent?.includes(section))
    button?.click()
  }

  const renderSearch = () => {
    const query = search.input.value.trim().toLowerCase()
    search.results.replaceChildren()
    if (!query) {
      search.results.hidden = true
      return
    }
    const matches = SEARCH_ENTRIES.filter(entry => `${entry.label} ${entry.keywords}`.toLowerCase().includes(query)).slice(0, 8)
    search.results.hidden = matches.length === 0
    for (const entry of matches) {
      const button = document.createElement('button')
      button.type = 'button'
      const title = document.createElement('strong')
      const section = document.createElement('small')
      title.textContent = entry.label
      section.textContent = entry.section
      button.append(title, section)
      button.addEventListener('click', () => {
        selectSection(entry.section)
        search.input.value = ''
        renderSearch()
      })
      search.results.append(button)
    }
  }

  const restoreComparison = () => {
    if (!compareSnapshot) return
    store.recipe = normalizeCustomizableAppearance(JSON.parse(compareSnapshot))
    compareSnapshot = ''
    document.body.removeAttribute('data-yk-studio-compare')
    compare.button.textContent = '对比经典'
    compare.button.setAttribute('aria-pressed', 'false')
    compare.status.textContent = '当前外观'
  }

  const toggleComparison = () => {
    if (compareSnapshot) {
      restoreComparison()
      return
    }
    compareSnapshot = JSON.stringify(store.recipe)
    store.recipe = normalizeCustomizableAppearance(createExtensionClassicAppearance())
    document.body.setAttribute('data-yk-studio-compare', 'true')
    compare.button.textContent = '返回当前'
    compare.button.setAttribute('aria-pressed', 'true')
    compare.status.textContent = `${countChangedGroups(JSON.parse(compareSnapshot))} 组配置不同 · 只读经典预览`
  }

  const renderHistory = () => {
    advanced.history.textContent = `${formatTime(store.draftSavedAt)} · 撤销 ${store.undoStack.length} / 重做 ${store.redoStack.length}`
    advanced.changes.replaceChildren()
    const groups = changedGroups(compareSnapshot ? JSON.parse(compareSnapshot) : store.recipe)
    if (!groups.length) {
      const empty = document.createElement('small')
      empty.textContent = '当前与经典外观一致'
      advanced.changes.append(empty)
    }
    else {
      for (const group of groups) {
        const chip = document.createElement('span')
        chip.textContent = group
        advanced.changes.append(chip)
      }
    }
  }

  const renderSchemes = () => {
    advanced.list.replaceChildren()
    if (!store.customSchemes.length) {
      const empty = document.createElement('p')
      empty.className = 'yk-advanced-empty'
      empty.textContent = '还没有本地方案。命名保存后可以快速切换。'
      advanced.list.append(empty)
      return
    }
    for (const scheme of store.customSchemes) {
      const article = document.createElement('article')
      const copy = document.createElement('div')
      const name = document.createElement('strong')
      const time = document.createElement('small')
      const actions = document.createElement('span')
      const apply = document.createElement('button')
      const remove = document.createElement('button')
      name.textContent = scheme.name
      time.textContent = new Date(scheme.createdAt).toLocaleString()
      apply.type = remove.type = 'button'
      apply.textContent = '应用'
      remove.textContent = '删除'
      remove.className = 'danger'
      apply.addEventListener('click', () => {
        restoreComparison()
        store.applyCustomScheme(scheme.id)
        renderHistory()
      })
      remove.addEventListener('click', () => {
        store.deleteCustomScheme(scheme.id)
        renderSchemes()
      })
      copy.append(name, time)
      actions.append(apply, remove)
      article.append(copy, actions)
      advanced.list.append(article)
    }
  }

  const saveScheme = () => {
    const name = advanced.name.value.trim()
    if (!name) {
      advanced.name.focus()
      advanced.status.textContent = '请输入方案名称。'
      return
    }
    restoreComparison()
    store.saveCustomScheme(name)
    advanced.name.value = ''
    advanced.status.textContent = '当前外观已保存到本地方案库。'
    renderSchemes()
  }

  const onKeydown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null
    const editing = target?.matches('input,textarea,select,[contenteditable=true]')
    if (event.key === '/' && !editing) {
      event.preventDefault()
      search.input.focus()
    }
    if (event.key === 'Escape') {
      search.input.value = ''
      renderSearch()
      restoreComparison()
    }
  }

  search.input.addEventListener('input', renderSearch)
  compare.button.addEventListener('click', toggleComparison)
  advanced.save.addEventListener('click', saveScheme)
  advanced.name.addEventListener('keydown', event => {
    if (event.key === 'Enter') saveScheme()
  })
  hotspots.querySelectorAll<HTMLButtonElement>('[data-studio-section]').forEach(button => {
    button.addEventListener('click', () => selectSection(button.dataset.studioSection as StudioSection))
  })
  window.addEventListener('keydown', onKeydown)

  const stopHistory = watch(
    () => [store.undoStack.length, store.redoStack.length, store.draftSavedAt, store.dirty, JSON.stringify(store.recipe)] as const,
    () => renderHistory(),
    { flush: 'post' },
  )
  const stopSchemes = watch(() => store.customSchemes.length, () => renderSchemes())
  renderHistory()
  renderSchemes()

  window.addEventListener('pagehide', () => {
    if (disposed) return
    disposed = true
    restoreComparison()
    stopHistory()
    stopSchemes()
    window.removeEventListener('keydown', onKeydown)
    search.root.remove()
    compare.root.remove()
    hotspots.remove()
    advanced.root.remove()
  }, { once: true })
})

function createSearch() {
  const root = document.createElement('div')
  root.className = 'yk-studio-search'
  const label = document.createElement('label')
  const icon = document.createElement('span')
  const input = document.createElement('input')
  const key = document.createElement('kbd')
  const results = document.createElement('div')
  icon.textContent = '⌕'
  input.type = 'search'
  input.placeholder = '搜索部位或参数'
  input.setAttribute('aria-label', '搜索 Studio 部位和参数')
  key.textContent = '/'
  results.className = 'yk-studio-search-results'
  results.hidden = true
  label.append(icon, input, key)
  root.append(label, results)
  return { root, input, results }
}

function createCompareControl() {
  const root = document.createElement('div')
  root.className = 'yk-studio-compare'
  const button = document.createElement('button')
  const status = document.createElement('small')
  button.type = 'button'
  button.textContent = '对比经典'
  button.setAttribute('aria-pressed', 'false')
  status.textContent = '当前外观'
  root.append(button, status)
  return { root, button, status }
}

function createHotspots() {
  const root = document.createElement('div')
  root.className = 'yk-studio-hotspots'
  root.setAttribute('aria-label', '点击选择宠物部位')
  const entries: Array<[StudioSection, string]> = [['头部', 'face'], ['身体', 'body'], ['尾巴触角', 'tail'], ['标志', 'symbol']]
  for (const [section, className] of entries) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = className
    button.dataset.studioSection = section
    button.textContent = section === '尾巴触角' ? '尾巴' : section
    button.setAttribute('aria-label', `选择${section}`)
    root.append(button)
  }
  return root
}

function createAdvancedPanel() {
  const root = document.createElement('section')
  root.className = 'yk-studio-advanced-panel'
  const heading = document.createElement('header')
  const copy = document.createElement('div')
  const eyebrow = document.createElement('span')
  const title = document.createElement('h2')
  const history = document.createElement('small')
  const form = document.createElement('div')
  const name = document.createElement('input')
  const save = document.createElement('button')
  const status = document.createElement('p')
  const changesTitle = document.createElement('strong')
  const changes = document.createElement('div')
  const list = document.createElement('div')
  eyebrow.textContent = 'ADVANCED STUDIO'
  title.textContent = '方案与最近修改'
  name.placeholder = '本地方案名称'
  name.maxLength = 32
  save.type = 'button'
  save.textContent = '保存方案'
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')
  status.textContent = '方案只保存在本机。'
  changesTitle.textContent = '与经典外观的差异'
  changes.className = 'yk-studio-change-groups'
  list.className = 'yk-studio-scheme-list'
  copy.append(eyebrow, title, history)
  heading.append(copy)
  form.append(name, save)
  root.append(heading, form, status, changesTitle, changes, list)
  return { root, name, save, status, history, changes, list }
}

function changedGroups(input: unknown) {
  const current = normalizeCustomizableAppearance(input)
  const defaults = normalizeCustomizableAppearance(createExtensionClassicAppearance())
  const groups: Array<[string, boolean]> = [
    ['头部', current.parts.eyes !== defaults.parts.eyes || current.parts.nose !== defaults.parts.nose || current.parts.mouth !== defaults.parts.mouth || current.proportions.headScale !== defaults.proportions.headScale],
    ['身体', current.parts.bodyShape !== defaults.parts.bodyShape || current.proportions.bodyWidth !== defaults.proportions.bodyWidth || current.proportions.bodyHeight !== defaults.proportions.bodyHeight],
    ['颜色', JSON.stringify(current.customization.colors) !== JSON.stringify(defaults.customization.colors)],
    ['肚皮', JSON.stringify(current.customization.belly) !== JSON.stringify(defaults.customization.belly)],
    ['尾巴触角', JSON.stringify(current.tailDesign) !== JSON.stringify(defaults.tailDesign) || JSON.stringify(current.antennaDesign) !== JSON.stringify(defaults.antennaDesign)],
    ['发光轨道', JSON.stringify(current.glow) !== JSON.stringify(defaults.glow) || JSON.stringify(current.orbitDesign) !== JSON.stringify(defaults.orbitDesign)],
    ['标志', JSON.stringify(current.symbols) !== JSON.stringify(defaults.symbols)],
  ]
  return groups.filter(([, changed]) => changed).map(([label]) => label)
}

function countChangedGroups(input: unknown) {
  return changedGroups(input).length
}

function formatTime(value: string) {
  if (!value) return '尚无自动草稿'
  return `草稿 ${new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function waitForElement<T extends Element>(selector: string, timeoutMs = 4_000) {
  return new Promise<T | null>((resolve) => {
    const existing = document.querySelector<T>(selector)
    if (existing) return resolve(existing)
    const observer = new MutationObserver(() => {
      const node = document.querySelector<T>(selector)
      if (!node) return
      observer.disconnect()
      clearTimeout(timeout)
      resolve(node)
    })
    observer.observe(document.documentElement, { childList: true, subtree: true })
    const timeout = window.setTimeout(() => {
      observer.disconnect()
      resolve(document.querySelector<T>(selector))
    }, timeoutMs)
  })
}

function installStyles() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .topbar{flex-wrap:wrap}.yk-studio-search{position:relative;align-self:center;min-width:250px}.yk-studio-search label{display:grid;grid-template-columns:22px minmax(0,1fr) 20px;align-items:center;gap:4px;min-height:38px;padding:0 8px;border:1px solid #ffffff20;border-radius:11px;background:#080d18}.yk-studio-search input{min-width:0;border:0;outline:0;color:#fff;background:transparent}.yk-studio-search kbd{color:#77809f;font:700 9px/1 ui-monospace,monospace}.yk-studio-search-results{position:absolute;z-index:40;left:0;right:0;top:44px;display:grid;gap:4px;padding:7px;border:1px solid #ffffff20;border-radius:12px;background:#0b1020f7;box-shadow:0 18px 48px #0009}.yk-studio-search-results[hidden]{display:none}.yk-studio-search-results button{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:36px;padding:0 9px;border:1px solid transparent;border-radius:8px;color:#dfe5ff;text-align:left;background:transparent;cursor:pointer}.yk-studio-search-results button:hover,.yk-studio-search-results button:focus-visible{border-color:#52e0d055;background:#52e0d010}.yk-studio-search-results small{color:#77809f}
    .yk-studio-compare{display:flex;align-items:center;gap:7px;margin-left:auto}.yk-studio-compare button{min-height:29px;padding:0 8px;border:1px solid #52e0d044;border-radius:8px;color:#eafffb;background:#52e0d012;cursor:pointer}.yk-studio-compare small{color:#77809f;font-size:8px}.yk-studio-hotspots{position:absolute;z-index:8;inset:74px 0 70px;pointer-events:none}.yk-studio-hotspots button{position:absolute;min-height:27px;padding:0 8px;border:1px solid #52e0d055;border-radius:999px;color:#dffff9;background:#0c1822cc;font-size:9px;opacity:.74;pointer-events:auto;cursor:pointer;backdrop-filter:blur(8px)}.yk-studio-hotspots button:hover,.yk-studio-hotspots button:focus-visible{opacity:1;transform:scale(1.04)}.yk-studio-hotspots .face{left:48%;top:16%}.yk-studio-hotspots .body{left:47%;top:49%}.yk-studio-hotspots .tail{left:18%;top:57%}.yk-studio-hotspots .symbol{right:18%;top:46%}
    .yk-studio-advanced-panel{display:grid;gap:9px;margin:10px 12px 0;padding:11px;border:1px solid #7066ff33;border-radius:13px;background:linear-gradient(145deg,#12172a,#0a0f1e)}.yk-studio-advanced-panel header div{display:grid;gap:3px}.yk-studio-advanced-panel header span{color:#777f9f;font:800 8px/1 ui-monospace,monospace;letter-spacing:.14em}.yk-studio-advanced-panel h2{margin:0;font-size:14px}.yk-studio-advanced-panel header small,.yk-studio-advanced-panel>p{margin:0;color:#7f89aa;font-size:9px}.yk-studio-advanced-panel>div:nth-of-type(1){display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px}.yk-studio-advanced-panel input{min-width:0;min-height:34px;border:1px solid #ffffff20;border-radius:9px;padding:0 9px;color:#fff;background:#080d18}.yk-studio-advanced-panel button{min-height:32px;padding:0 8px;border:1px solid #7066ff44;border-radius:8px;color:#fff;background:#7066ff12;cursor:pointer}.yk-studio-change-groups{display:flex!important;grid-template-columns:none!important;flex-wrap:wrap;gap:5px}.yk-studio-change-groups span{padding:5px 7px;border-radius:999px;color:#dfe5ff;background:#7066ff18;font-size:9px}.yk-studio-change-groups small{color:#77809f}.yk-studio-scheme-list{display:grid!important;grid-template-columns:none!important;gap:6px}.yk-studio-scheme-list article{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px;border:1px solid #ffffff14;border-radius:9px;background:#ffffff05}.yk-studio-scheme-list article>div{display:grid;gap:2px}.yk-studio-scheme-list small{color:#77809f;font-size:8px}.yk-studio-scheme-list article>span{display:flex;gap:4px}.yk-studio-scheme-list button.danger{border-color:#ff809544;color:#ffb0bf;background:#ff809510}.yk-advanced-empty{margin:0;color:#77809f;font-size:9px}
    body[data-yk-studio-compare=true] .inspector .controls,body[data-yk-studio-compare=true] .topbar .actions{opacity:.42;pointer-events:none}body[data-yk-studio-compare=true] .preview-panel{box-shadow:0 0 0 2px #52e0d055 inset,0 18px 48px #0004}.yk-studio-search button:focus-visible,.yk-studio-compare button:focus-visible,.yk-studio-hotspots button:focus-visible,.yk-studio-advanced-panel button:focus-visible,.yk-studio-advanced-panel input:focus-visible{outline:2px solid #52e0d0;outline-offset:2px}@media(max-width:1120px){.yk-studio-search{order:3;width:100%;min-width:0}}@media(prefers-reduced-motion:reduce){.yk-studio-hotspots button{transition:none!important}}
  `
  document.head.append(style)
}
