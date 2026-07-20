/**
 * YK-PETS 品牌兼容层。
 *
 * v0.6.10 的组件、消息与存储中仍存在 NOVA 技术标识。该模块负责：
 * 1. 将用户可见文案统一为 YK-PETS，并将当前宠物显示为云灵（Zeph）；
 * 2. 把 nova:* 存储键迁移并镜像到 yk-pets:*；
 * 3. 为后续逐组件移除旧标识提供单一过渡边界。
 */

export const YK_PETS_PRODUCT_NAME = 'YK-PETS Browser Agent'
export const YK_PETS_PET_NAME = '云灵'
export const YK_PETS_PET_NAME_EN = 'Zeph'
export const YK_PETS_PET_SPECIES = '云狐'
export const YK_PETS_PET_SPECIES_EN = 'Cloud Fox'

const LEGACY_PREFIX = 'nova:'
const CURRENT_PREFIX = 'yk-pets:'

type ObservableRoot = ParentNode & Node

const BRAND_REPLACEMENTS: ReadonlyArray<readonly [string, string]> = [
  ['NOVA Browser Agent', YK_PETS_PRODUCT_NAME],
  ['NOVA Local Agent', 'YK-PETS Local Agent'],
  ['NOVA 思考中', `${YK_PETS_PET_NAME}思考中`],
  ['控制 NOVA 的动作与表现', `控制${YK_PETS_PET_NAME}（${YK_PETS_PET_NAME_EN}）的动作与表现`],
  ['NOVA 正在进入网页', `${YK_PETS_PET_NAME}正在进入网页`],
  ['NOVA 3D 模型', `${YK_PETS_PET_NAME} 3D 模型`],
  ['由 NOVA 写入', '由 YK-PETS 写入'],
  ['网页内 3D NOVA', `网页内 3D ${YK_PETS_PET_NAME}`],
  ['3D NOVA', `3D ${YK_PETS_PET_NAME}`],
  ['NOVA', 'YK-PETS'],
]

export function replaceLegacyBrandText(value: string): string {
  return BRAND_REPLACEMENTS.reduce((next, [legacy, replacement]) => next.replaceAll(legacy, replacement), value)
}

export async function migrateLegacyStorage(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return
  const stored = await chrome.storage.local.get(null)
  const migration: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(stored)) {
    if (!key.startsWith(LEGACY_PREFIX)) continue
    const nextKey = `${CURRENT_PREFIX}${key.slice(LEGACY_PREFIX.length)}`
    if (!(nextKey in stored)) migration[nextKey] = value
  }

  if (Object.keys(migration).length) await chrome.storage.local.set(migration)
}

export function installStorageCompatibilityMirror(): () => void {
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return () => undefined
  let synchronizing = false

  const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName !== 'local' || synchronizing) return
    const mirrored: Record<string, unknown> = {}
    const removed: string[] = []

    for (const [key, change] of Object.entries(changes)) {
      const mirrorKey = key.startsWith(LEGACY_PREFIX)
        ? `${CURRENT_PREFIX}${key.slice(LEGACY_PREFIX.length)}`
        : key.startsWith(CURRENT_PREFIX)
          ? `${LEGACY_PREFIX}${key.slice(CURRENT_PREFIX.length)}`
          : null
      if (!mirrorKey) continue
      if (change.newValue === undefined) removed.push(mirrorKey)
      else mirrored[mirrorKey] = change.newValue
    }

    if (!Object.keys(mirrored).length && !removed.length) return
    synchronizing = true
    Promise.all([
      Object.keys(mirrored).length ? chrome.storage.local.set(mirrored) : Promise.resolve(),
      removed.length ? chrome.storage.local.remove(removed) : Promise.resolve(),
    ]).finally(() => {
      synchronizing = false
    })
  }

  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}

function updateAttributes(element: Element) {
  for (const attribute of ['title', 'aria-label', 'placeholder', 'alt']) {
    const current = element.getAttribute(attribute)
    if (!current) continue
    const next = replaceLegacyBrandText(current)
    if (next !== current) element.setAttribute(attribute, next)
  }
}

export function installYkPetsBranding(root: ObservableRoot = document): () => void {
  const observedRoots = new Set<Node>()
  let observeRoot: (candidate: ObservableRoot) => void

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'characterData' && mutation.target.nodeValue) {
        const next = replaceLegacyBrandText(mutation.target.nodeValue)
        if (next !== mutation.target.nodeValue) mutation.target.nodeValue = next
      }
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.TEXT_NODE && node.nodeValue) {
          node.nodeValue = replaceLegacyBrandText(node.nodeValue)
        }
        else if (node instanceof Element || node instanceof DocumentFragment) {
          brandTree(node)
        }
      }
    }
  })

  function brandTree(currentRoot: ObservableRoot) {
    if (currentRoot instanceof Element) updateAttributes(currentRoot)

    const walker = document.createTreeWalker(currentRoot, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
    let node: Node | null = walker.currentNode
    while (node) {
      if (node.nodeType === Node.TEXT_NODE && node.nodeValue) {
        const next = replaceLegacyBrandText(node.nodeValue)
        if (next !== node.nodeValue) node.nodeValue = next
      }
      else if (node instanceof Element) {
        updateAttributes(node)
        if (node.shadowRoot) observeRoot(node.shadowRoot)
      }
      node = walker.nextNode()
    }
  }

  observeRoot = (candidate) => {
    if (observedRoots.has(candidate)) return
    observedRoots.add(candidate)
    brandTree(candidate)
    observer.observe(candidate, { childList: true, subtree: true, characterData: true })
  }

  observeRoot(root)
  return () => {
    observer.disconnect()
    observedRoots.clear()
  }
}

export function installYkPetsCompatibility(root: ObservableRoot = document): () => void {
  migrateLegacyStorage().catch(error => console.warn('[YK-PETS storage migration]', error))
  const removeStorageMirror = installStorageCompatibilityMirror()
  const removeBranding = installYkPetsBranding(root)
  return () => {
    removeStorageMirror()
    removeBranding()
  }
}
