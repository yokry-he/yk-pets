import { createCanvas2DRendererFactory } from '@yk-pets/pet-renderer-canvas2d'
import { ExtensionPetRuntime, createExtensionRuntimeMessageHandler } from '@yk-pets/pet-extension-runtime'
import { SitePolicyManager, createChromeStorageAdapter } from '@yk-pets/pet-site-policy'

const host = document.createElement('div')
const shadowRoot = host.attachShadow({ mode: 'open' })
document.documentElement.append(host)

const runtime = new ExtensionPetRuntime({
  sitePolicies: new SitePolicyManager(createChromeStorageAdapter(chrome.storage.local)),
  renderer2d: createCanvas2DRendererFactory({ width: 240, height: 260 }),
  loadRenderer3d: async () => {
    const module = await import(chrome.runtime.getURL('chunks/pet-3d.js'))
    return module.rendererFactory
  },
  loadAuditFeature: async () => {
    const module = await import(chrome.runtime.getURL('chunks/audit-collector.js'))
    return module.auditFeature
  },
  adaptive: { switchCooldownMs: 30_000 },
})

await runtime.start(shadowRoot, location.href, {
  now: Date.now(),
  webglSupported: true,
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
})
runtime.attachBrowserLifecycle({ target: host })

const handleMessage = createExtensionRuntimeMessageHandler(runtime)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void handleMessage(message).then(sendResponse)
  return true
})
