<!--
  文件职责 / File responsibility
  提供固定相机、固定动作和 URL 参数驱动的单案例云狐视觉审计画布，供人工验收与未来浏览器截图回归稳定复现。
  Provides a fixed-camera, fixed-motion, URL-driven single-case Cloud Fox visual audit canvas for manual acceptance and future browser screenshot regression.
-->
<script setup lang="ts">
import CloudFoxStudioCanvas from '~/components/studio/CloudFoxStudioCanvas.vue'
import { CLOUD_FOX_BODY_SHAPES, CLOUD_FOX_HEAD_SHAPES, type CloudFoxBodyShape, type CloudFoxHeadShape } from '~/domain/cloud-fox-appearance'
import { createExtensionClassicAppearance } from '~/domain/extension-cloud-fox-default'
import { PET_BELLY_SHAPES, normalizeCustomizableAppearance, type PetBellyShape } from '~/domain/pet-part-customization'
import { PET_STUDIO_PART_OPTIONS } from '~/domain/pet-studio-phase2'
import type { CloudFoxStudioView } from '~/domain/pet-studio-phase4'

const route = useRoute()
useHead({
  title: 'Cloud Fox Visual Audit · YK-PETS',
  bodyAttrs: { class: 'yk-pets-studio-page' },
})

const bodyIds = new Set(CLOUD_FOX_BODY_SHAPES.map(item => item.id))
const headIds = new Set(CLOUD_FOX_HEAD_SHAPES.map(item => item.id))
const eyeIds = new Set(PET_STUDIO_PART_OPTIONS.eyes.map(item => item.id))
const bellyIds = new Set(PET_BELLY_SHAPES.map(item => item.id))
const viewIds = new Set<CloudFoxStudioView>(['front', 'left', 'back', 'right'])
const queryValue = (key: string) => String(route.query[key] || '')
const select = <T extends string>(value: string, valid: ReadonlySet<string>, fallback: T) => valid.has(value) ? value as T : fallback

const bodyShape = computed(() => select(queryValue('body'), bodyIds, 'ellipsoid' as CloudFoxBodyShape))
const headShape = computed(() => select(queryValue('head'), headIds, 'classic-round' as CloudFoxHeadShape))
const eyeStyle = computed(() => select(queryValue('eyes'), eyeIds, 'round'))
const bellyShape = computed(() => select(queryValue('belly'), bellyIds, 'ellipse' as PetBellyShape))
const view = computed(() => select(queryValue('view'), viewIds, 'front' as CloudFoxStudioView))
const recipe = computed(() => {
  const next = normalizeCustomizableAppearance(createExtensionClassicAppearance())
  next.parts.bodyShape = bodyShape.value
  next.parts.headShape = headShape.value
  next.parts.eyes = eyeStyle.value as typeof next.parts.eyes
  next.customization.belly.shape = bellyShape.value
  next.customization.belly.visible = true
  next.customization.belly.width = 1
  next.customization.belly.height = 1
  next.customization.belly.offsetX = 0
  next.customization.belly.offsetY = 0
  next.customization.belly.rotation = 0
  return next
})
const caseId = computed(() => `${headShape.value}__${bodyShape.value}__${eyeStyle.value}__${bellyShape.value}__${view.value}`)
</script>

<template>
  <main class="audit-page" data-visual-audit="cloud-fox" :data-case-id="caseId">
    <header>
      <div>
        <NuxtLink to="/studio">← 返回 Pet Studio</NuxtLink>
        <small>DETERMINISTIC VISUAL AUDIT</small>
        <h1>Cloud Fox 单案例视觉审计</h1>
      </div>
      <code>{{ caseId }}</code>
    </header>
    <section class="audit-stage" aria-label="固定视觉审计画布">
      <ClientOnly>
        <CloudFoxStudioCanvas
          :appearance="recipe"
          behavior="idle"
          :motion-key="0"
          :view="view"
          background="dark"
          focus="full"
        />
        <template #fallback><div class="loading">正在装配固定审计场景…</div></template>
      </ClientOnly>
    </section>
    <footer>
      <span>body={{ bodyShape }}</span>
      <span>head={{ headShape }}</span>
      <span>eyes={{ eyeStyle }}</span>
      <span>belly={{ bellyShape }}</span>
      <span>view={{ view }}</span>
    </footer>
  </main>
</template>

<style scoped>
.audit-page{min-height:100vh;padding:24px;color:#eef1ff;background:#080b14}.audit-page>header,.audit-page>footer,.audit-stage{width:min(960px,calc(100vw - 32px));margin:0 auto}.audit-page>header{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:14px}.audit-page a{color:#76dfd1;text-decoration:none}.audit-page small{display:block;margin-top:12px;color:#777f9f;font:800 9px/1 ui-monospace,monospace;letter-spacing:.16em}.audit-page h1{margin:7px 0 0;font-size:24px}.audit-page code{max-width:48%;overflow:hidden;color:#aeb7d8;text-overflow:ellipsis;white-space:nowrap}.audit-stage{height:720px;overflow:hidden;border-radius:22px}.loading{display:grid;height:100%;place-items:center;border:1px solid #ffffff18;border-radius:22px}.audit-page>footer{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.audit-page>footer span{padding:6px 9px;border:1px solid #ffffff18;border-radius:999px;color:#aeb7d8;background:#ffffff08;font:700 10px/1 ui-monospace,monospace}@media(max-width:760px){.audit-page{padding:12px}.audit-page>header{align-items:start;flex-direction:column}.audit-page code{max-width:100%}.audit-stage{height:72vw;min-height:430px}}
</style>
