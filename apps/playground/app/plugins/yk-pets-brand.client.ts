/**
 * 文件职责 / File responsibility
 * 在 Nuxt Playground 中统一 YK-PETS 品牌，并把当前宠物显示为云灵（Zeph）。
 * Normalizes YK-PETS branding in the Nuxt Playground and displays the current pet as Zeph（云灵）.
 */

const replacements: ReadonlyArray<readonly [string, string]> = [
  ['NOVA Browser Agent', 'YK-PETS Browser Agent'],
  ['NOVA 思考中', '云灵思考中'],
  ['NOVA 云狐', '云灵（Zeph）· 云狐'],
  ['3D NOVA', '3D 云灵（Zeph）'],
  ['NOVA', 'YK-PETS'],
]

function replaceBrand(value: string) {
  return replacements.reduce((next, [legacy, replacement]) => next.replaceAll(legacy, replacement), value)
}

function updateElement(element: Element) {
  for (const attribute of ['title', 'aria-label', 'placeholder', 'alt']) {
    const current = element.getAttribute(attribute)
    if (!current) continue
    const next = replaceBrand(current)
    if (next !== current) element.setAttribute(attribute, next)
  }
}

function updateTree(root: ParentNode & Node) {
  if (root instanceof Element) updateElement(root)
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  let node: Node | null = walker.currentNode
  while (node) {
    if (node.nodeType === Node.TEXT_NODE && node.nodeValue) {
      const next = replaceBrand(node.nodeValue)
      if (next !== node.nodeValue) node.nodeValue = next
    }
    else if (node instanceof Element) {
      updateElement(node)
    }
    node = walker.nextNode()
  }
}

export default defineNuxtPlugin(() => {
  onNuxtReady(() => {
    updateTree(document)
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData' && mutation.target.nodeValue) {
          const next = replaceBrand(mutation.target.nodeValue)
          if (next !== mutation.target.nodeValue) mutation.target.nodeValue = next
        }
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.TEXT_NODE && node.nodeValue) node.nodeValue = replaceBrand(node.nodeValue)
          else if (node instanceof Element || node instanceof DocumentFragment) updateTree(node)
        }
      }
    })
    observer.observe(document, { childList: true, subtree: true, characterData: true })
  })
})
