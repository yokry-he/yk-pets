<!--
  文件职责 / File responsibility
  保留 AvatarCanvas 调用接口，按本地运行偏好延迟创建或销毁 <yk-pet> 3D 渲染器，并在关闭 3D 时提供轻量云灵入口。
  Preserves the AvatarCanvas API, lazily creates or destroys the <yk-pet> 3D renderer from local preferences, and provides a lightweight Zeph entry when 3D is disabled.
-->
<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import {
  createPetRecipeEnvelope,
  normalizePetRecipeEnvelope,
  YK_PET_RECIPE_STORAGE_KEY,
  type PetRecipeEnvelope,
} from '@yk-pets/pet-core'
import type { YkPetElement } from '@yk-pets/pet-web-component'
import type { NovaPetBehavior } from '@nova/shared/messages'
import {
  createDefaultPetRuntimePreferences,
  normalizePetRuntimePreferences,
  type YkPetIdleMotionId,
  type YkPetRuntimePreferences,
  YK_PET_RUNTIME_PREFERENCES_STORAGE_KEY,
} from '@nova/shared/pet-runtime-preferences'
import { PET_MOTIONS, getPetMotion } from './pet-motions'
import type { PetEmotion } from './types'

const ProductionAvatarCanvas = defineAsyncComponent(() => import('./ProductionAvatarCanvas.vue'))

type PetElementCandidate = HTMLElement & {
  setState?: YkPetElement['setState']
}

const props = withDefaults(defineProps<{
  behavior: string
  emotion: PetEmotion
  speaking?: boolean
  score?: number
  compact?: boolean
  transparent?: boolean
  pointer?: { x: number; y: number }
  motionKey?: number
  recipe?: PetRecipeEnvelope | null
}>(), {
  speaking: false,
  score: 100,
  compact: false,
  transparent: false,
  pointer: () => ({ x: 0, y: 0 }),
  motionKey: 0,
  recipe: null,
})

const mountHost = shallowRef<HTMLDivElement>()
const petElement = shallowRef<PetElementCandidate>()
const fallbackActive = ref(false)
const runtimeReady = ref(false)
const runtimePreferences = ref<YkPetRuntimePreferences>(createDefaultPetRuntimePreferences())
const uiMotionPermit = ref(false)
const manualMotionPermit = ref<NovaPetBehavior | null>(null)
const activeRecipe = shallowRef<PetRecipeEnvelope>(createPetRecipeEnvelope({
  speciesId: 'cloud-fox',
  rendererId: 'extension-cloud-fox',
  source: 'default',
  appearance: {},
}))
const effectiveRecipe = computed(() => props.recipe || activeRecipe.value)
const load3dPet = computed(() => runtimePreferences.value.load3dPet)
const effectiveBehavior = computed(() => {
  const motion = getPetMotion(props.behavior as NovaPetBehavior)
  if (!motion?.idleEligible) return props.behavior
  if (uiMotionPermit.value || manualMotionPermit.value === props.behavior) return props.behavior
  if (!runtimePreferences.value.idleEnabled) return 'idle'
  return runtimePreferences.value.idleMotionIds.includes(motion.id as YkPetIdleMotionId) ? props.behavior : 'idle'
})
const render3d = computed(() => runtimeReady.value && load3dPet.value)
const hostStyle = computed(() => ({
  position: 'relative' as const,
  display: 'block',
  width: '100%',
  height: `${props.compact ? 214 : 242}px`,
  minWidth: '0',
  minHeight: '0',
  overflow: 'visible',
}))

let readinessTimer: number | null = null
let stateFlushFrame: number | null = null
let mountGeneration = 0
let lastStateSignature = ''
let uiMotionPermitTimer: number | null = null
let manualMotionPermitTimer: number | null = null

function hasExtensionStorage() {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local)
}

function hasPetStateApi(element: PetElementCandidate | undefined): element is PetElementCandidate & { setState: YkPetElement['setState'] } {
  return Boolean(element) && typeof element?.setState === 'function'
}

function clearReadinessTimer() {
  if (readinessTimer === null) return
  window.clearTimeout(readinessTimer)
  readinessTimer = null
}

function clearStateFlush() {
  if (stateFlushFrame === null) return
  window.cancelAnimationFrame(stateFlushFrame)
  stateFlushFrame = null
}

function schedulePetElementUpdate() {
  if (!render3d.value || fallbackActive.value || stateFlushFrame !== null) return
  stateFlushFrame = window.requestAnimationFrame(() => {
    stateFlushFrame = null
    updatePetElement()
  })
}

function detachPetElement() {
  const element = petElement.value
  if (!element) return
  element.removeEventListener('yk-pet-ready', onPetReady)
  element.removeEventListener('yk-pet-error', onPetError)
  element.remove()
  petElement.value = undefined
}

function stop3dRenderer() {
  mountGeneration += 1
  clearReadinessTimer()
  clearStateFlush()
  detachPetElement()
  fallbackActive.value = false
  lastStateSignature = ''
}

function activateFallback(reason: string) {
  if (!render3d.value || fallbackActive.value) return
  clearReadinessTimer()
  clearStateFlush()
  console.warn('[YK-PETS yk-pet fallback]', reason)
  detachPetElement()
  fallbackActive.value = true
}

function probeRenderedCanvas() {
  readinessTimer = null
  if (!render3d.value || fallbackActive.value) return
  const element = petElement.value
  if (!hasPetStateApi(element)) {
    activateFallback('The <yk-pet> node was not upgraded and has no setState() API.')
    return
  }
  const canvas = element.shadowRoot?.querySelector('canvas')
  const rect = canvas?.getBoundingClientRect()
  if (!canvas || !rect || rect.width < 2 || rect.height < 2) activateFallback('The Web Component renderer did not create a visible canvas in time.')
}

function scheduleRendererProbe(delay = 900) {
  clearReadinessTimer()
  readinessTimer = window.setTimeout(probeRenderedCanvas, delay)
}

function onPetReady() {
  scheduleRendererProbe(700)
}

function onPetError(event: Event) {
  const message = (event as CustomEvent<{ message?: string }>).detail?.message || 'Unknown Web Component renderer error.'
  activateFallback(message)
}

function updatePetElement() {
  if (!render3d.value || fallbackActive.value) return
  const element = petElement.value
  if (!element) return
  if (!hasPetStateApi(element)) {
    activateFallback('The <yk-pet> node did not upgrade in the content-script execution world.')
    return
  }

  const recipe = effectiveRecipe.value
  const signature = [
    recipe.recipeId,
    recipe.updatedAt,
    effectiveBehavior.value,
    props.emotion,
    props.speaking ? 1 : 0,
    props.score,
    props.compact ? 1 : 0,
    props.transparent ? 1 : 0,
    Math.round(props.pointer.x * 100) / 100,
    Math.round(props.pointer.y * 100) / 100,
    props.motionKey,
  ].join('|')
  if (signature === lastStateSignature) return

  try {
    element.setState({
      recipe,
      speciesId: recipe.speciesId,
      rendererId: recipe.rendererId,
      behavior: effectiveBehavior.value,
      renderProps: {
        emotion: props.emotion,
        speaking: props.speaking,
        score: props.score,
        compact: props.compact,
        transparent: props.transparent,
        pointer: props.pointer,
        motionKey: props.motionKey,
      },
    })
    lastStateSignature = signature
  }
  catch (error) {
    activateFallback(error instanceof Error ? error.message : String(error))
  }
}

async function mountPetElement() {
  if (!render3d.value || fallbackActive.value || petElement.value) return
  const generation = ++mountGeneration
  await nextTick()
  if (generation !== mountGeneration || !render3d.value || !mountHost.value) return

  try {
    const { registerExtensionCloudFoxPetElement } = await import('../../entrypoints/content/yk-pet-adapter')
    if (generation !== mountGeneration || !render3d.value || !mountHost.value) return
    registerExtensionCloudFoxPetElement()
    const element = document.createElement('yk-pet') as PetElementCandidate
    globalThis.customElements?.upgrade(element)
    Object.assign(element.style, {
      display: 'block',
      width: '100%',
      height: '100%',
      minWidth: '0',
      minHeight: '0',
    })
    element.addEventListener('yk-pet-ready', onPetReady)
    element.addEventListener('yk-pet-error', onPetError)
    petElement.value = element
    mountHost.value.append(element)

    if (!hasPetStateApi(element)) activateFallback('The <yk-pet> custom element is unavailable or was claimed by the host page.')
    else {
      updatePetElement()
      scheduleRendererProbe(1200)
    }
  }
  catch (error) {
    activateFallback(error instanceof Error ? error.message : String(error))
  }
}

async function restoreStoredState() {
  if (!hasExtensionStorage()) {
    runtimePreferences.value = createDefaultPetRuntimePreferences()
    runtimeReady.value = true
    return
  }
  try {
    const stored = await chrome.storage.local.get([YK_PET_RECIPE_STORAGE_KEY, YK_PET_RUNTIME_PREFERENCES_STORAGE_KEY])
    if (!props.recipe) {
      const normalized = normalizePetRecipeEnvelope(stored[YK_PET_RECIPE_STORAGE_KEY])
      if (normalized) activeRecipe.value = normalized
    }
    runtimePreferences.value = normalizePetRuntimePreferences(stored[YK_PET_RUNTIME_PREFERENCES_STORAGE_KEY])
  }
  catch (error) {
    console.warn('[YK-PETS runtime restore]', error)
    runtimePreferences.value = createDefaultPetRuntimePreferences()
  }
  runtimeReady.value = true
}

function onStorageChanged(changes: Record<string, chrome.storage.StorageChange>, areaName: string) {
  if (areaName !== 'local') return
  if (!props.recipe && changes[YK_PET_RECIPE_STORAGE_KEY]) {
    const normalized = normalizePetRecipeEnvelope(changes[YK_PET_RECIPE_STORAGE_KEY]?.newValue)
    if (normalized) {
      activeRecipe.value = normalized
      schedulePetElementUpdate()
    }
  }
  if (changes[YK_PET_RUNTIME_PREFERENCES_STORAGE_KEY]) {
    runtimePreferences.value = normalizePetRuntimePreferences(changes[YK_PET_RUNTIME_PREFERENCES_STORAGE_KEY]?.newValue)
    schedulePetElementUpdate()
  }
}

watch(
  () => [
    effectiveBehavior.value,
    props.emotion,
    props.speaking,
    props.score,
    props.compact,
    props.transparent,
    props.pointer.x,
    props.pointer.y,
    props.motionKey,
    props.recipe,
  ] as const,
  schedulePetElementUpdate,
)
watch(render3d, (enabled) => {
  if (!enabled) {
    stop3dRenderer()
    return
  }
  fallbackActive.value = false
  mountPetElement().catch(error => activateFallback(error instanceof Error ? error.message : String(error)))
}, { flush: 'post' })

function clearUiMotionPermit() {
  if (uiMotionPermitTimer !== null) window.clearTimeout(uiMotionPermitTimer)
  uiMotionPermitTimer = null
  uiMotionPermit.value = false
}

function allowUiMotion(duration = 1600) {
  clearUiMotionPermit()
  uiMotionPermit.value = true
  uiMotionPermitTimer = window.setTimeout(clearUiMotionPermit, duration)
}

function clearManualMotionPermit() {
  if (manualMotionPermitTimer !== null) window.clearTimeout(manualMotionPermitTimer)
  manualMotionPermitTimer = null
  manualMotionPermit.value = null
}

function onOverlayInteraction(event: Event) {
  const path = event.composedPath()
  const insideOverlay = path.some(node => node instanceof HTMLElement && node.classList.contains('nova-pet-shell'))
  if (!insideOverlay) return
  allowUiMotion()
  if (event.type !== 'click') return
  const button = path.find(node => node instanceof HTMLButtonElement && node.classList.contains('nova-menu-action')) as HTMLButtonElement | undefined
  const ariaLabel = button?.getAttribute('aria-label') || ''
  const motion = PET_MOTIONS.find(item => ariaLabel.startsWith(`${item.label}：`))
  if (!motion) return
  clearManualMotionPermit()
  manualMotionPermit.value = motion.behavior
  manualMotionPermitTimer = window.setTimeout(clearManualMotionPermit, motion.duration + 900)
}

onMounted(async () => {
  document.addEventListener('pointerdown', onOverlayInteraction, true)
  document.addEventListener('click', onOverlayInteraction, true)
  if (hasExtensionStorage()) chrome.storage.onChanged.addListener(onStorageChanged)
  await restoreStoredState()
  if (render3d.value) await mountPetElement()
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onOverlayInteraction, true)
  document.removeEventListener('click', onOverlayInteraction, true)
  clearUiMotionPermit()
  clearManualMotionPermit()
  stop3dRenderer()
  if (hasExtensionStorage()) chrome.storage.onChanged.removeListener(onStorageChanged)
})
</script>

<template>
  <div class="avatar-web-component-shell" :style="hostStyle" :data-render-mode="render3d ? '3d' : 'static'">
    <div
      v-if="render3d && !fallbackActive"
      ref="mountHost"
      class="avatar-web-component-host"
      style="display:block;width:100%;height:100%;min-width:0;min-height:0;overflow:visible"
    />
    <ProductionAvatarCanvas
      v-else-if="render3d && fallbackActive"
      :behavior="effectiveBehavior"
      :emotion="emotion"
      :speaking="speaking"
      :score="score"
      :compact="compact"
      :transparent="transparent"
      :pointer="pointer"
      :motion-key="motionKey"
      :recipe="effectiveRecipe"
    />
    <div v-else class="avatar-static-fallback" role="img" aria-label="3D 云灵已关闭，点击仍可打开 YK-PETS 功能">
      <span class="avatar-static-fallback__ear avatar-static-fallback__ear--left" />
      <span class="avatar-static-fallback__ear avatar-static-fallback__ear--right" />
      <span class="avatar-static-fallback__antenna avatar-static-fallback__antenna--left" />
      <span class="avatar-static-fallback__antenna avatar-static-fallback__antenna--right" />
      <span class="avatar-static-fallback__eye avatar-static-fallback__eye--left" />
      <span class="avatar-static-fallback__eye avatar-static-fallback__eye--right" />
      <span class="avatar-static-fallback__nose" />
      <strong>YK</strong>
      <small>3D OFF</small>
    </div>
  </div>
</template>

<style scoped>
.avatar-web-component-shell,.avatar-web-component-host{display:block;width:100%;height:100%;min-width:0;min-height:0;overflow:visible}.avatar-static-fallback{position:absolute;right:12px;bottom:8px;width:168px;height:190px;border:1px solid rgba(112,102,255,.36);border-radius:48% 48% 44% 44%;background:radial-gradient(circle at 50% 36%,#f7f9ff 0 34%,#d9def4 35% 54%,#929bc3 55% 100%);box-shadow:0 18px 42px rgba(47,43,126,.18),inset 0 0 30px rgba(255,255,255,.68);filter:drop-shadow(0 12px 18px rgba(21,24,55,.16));pointer-events:none}.avatar-static-fallback::after{content:"";position:absolute;left:50%;bottom:21px;width:74px;height:82px;translate:-50% 0;border-radius:48%;background:rgba(247,249,255,.78);box-shadow:0 0 20px rgba(112,102,255,.12)}.avatar-static-fallback__ear{position:absolute;top:-16px;width:48px;height:70px;background:#eef1ff;clip-path:polygon(50% 0,100% 100%,0 100%);filter:drop-shadow(0 4px 5px rgba(65,59,150,.2))}.avatar-static-fallback__ear--left{left:14px;rotate:-13deg}.avatar-static-fallback__ear--right{right:14px;rotate:13deg}.avatar-static-fallback__antenna{position:absolute;top:-31px;width:9px;height:42px;border-radius:999px;background:#8f98bf}.avatar-static-fallback__antenna::after{content:"";position:absolute;left:50%;top:-8px;width:20px;height:20px;translate:-50% 0;border:5px solid #7066ff;border-radius:50%;background:#dffcff}.avatar-static-fallback__antenna--left{left:61px;rotate:-7deg}.avatar-static-fallback__antenna--right{right:61px;rotate:7deg}.avatar-static-fallback__eye{position:absolute;top:42px;width:36px;height:50px;border-radius:50%;background:#11152d;box-shadow:inset 7px 8px 0 rgba(255,255,255,.08)}.avatar-static-fallback__eye::after{content:"";position:absolute;right:8px;top:9px;width:8px;height:10px;border-radius:50%;background:#8ffff0}.avatar-static-fallback__eye--left{left:38px}.avatar-static-fallback__eye--right{right:38px}.avatar-static-fallback__nose{position:absolute;left:50%;top:98px;width:18px;height:13px;translate:-50% 0;border-radius:50%;background:#252942;z-index:2}.avatar-static-fallback strong{position:absolute;left:50%;bottom:47px;translate:-50% 0;z-index:2;color:#7066ff;font:900 24px/1 ui-sans-serif,system-ui;text-shadow:0 0 12px rgba(112,102,255,.35)}.avatar-static-fallback small{position:absolute;left:50%;bottom:-3px;translate:-50% 0;padding:4px 7px;border-radius:999px;color:#d8dcf2;background:rgba(15,18,39,.8);font:800 8px/1 ui-monospace,monospace;letter-spacing:.12em;white-space:nowrap}@media(prefers-reduced-motion:reduce){.avatar-static-fallback{filter:none}}
</style>
