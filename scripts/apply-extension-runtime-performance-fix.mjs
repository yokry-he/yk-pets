#!/usr/bin/env node
/**
 * 文件职责 / File responsibility
 * 一次性应用浏览器扩展运行时性能修复，并由临时工作流在完成后删除。
 * Applies one-time browser-extension runtime performance fixes and is removed by the temporary workflow afterwards.
 */
import { readFile, writeFile } from 'node:fs/promises'

function replaceRequired(content, search, replacement, label) {
  if (!content.includes(search)) throw new Error(`Missing migration anchor: ${label}`)
  return content.replace(search, replacement)
}

async function patchFile(path, transform) {
  const before = await readFile(path, 'utf8')
  const after = transform(before)
  if (after === before) throw new Error(`Migration produced no changes for ${path}`)
  await writeFile(path, after)
}

await patchFile('apps/extension/components/avatar/ProductionAvatarCanvas.vue', (source) => {
  let next = replaceRequired(
    source,
    "const pixelRatio = computed<[number, number]>(() => props.compact ? [1, 1.2] : [1, 1.4])",
    "const pixelRatio = computed<[number, number]>(() => props.compact ? [.75, 1] : [.9, 1.25])\nconst frameRateLimit = computed(() => props.compact ? 30 : 40)",
    'compact canvas DPR',
  )
  next = replaceRequired(
    next,
    `      :dpr="pixelRatio"\n      :style="tresStyle"\n      alpha\n      antialias`,
    `      :dpr="pixelRatio"\n      :fps-limit="frameRateLimit"\n      :style="tresStyle"\n      :antialias="!compact"\n      render-mode="always"\n      power-preference="low-power"\n      alpha`,
    'TresCanvas runtime options',
  )
  return next
})

await patchFile('apps/extension/components/avatar/ConfiguredCloudFox.vue', (source) => {
  let next = replaceRequired(
    source,
    'let appearanceDirty = true',
    'let appearanceDirty = true\nlet appearanceRetryFrames = 0',
    'appearance retry state',
  )
  next = replaceRequired(
    next,
    `watch(() => visual.value.bellyPatchDesign.style, style => replaceTexture(bellyTexture, createBellyTexture(style)), { immediate: true })\nwatch(() => visual.value.symbols.chest, symbol => replaceTexture(chestTexture, createSymbolTexture(symbol.text, symbol.color, symbol.glowIntensity)), { immediate: true, deep: true })\nwatch(() => visual.value.symbols.back, symbol => replaceTexture(backTexture, createSymbolTexture(symbol.text, symbol.color, symbol.glowIntensity)), { immediate: true, deep: true })\nwatch(visual, () => { appearanceDirty = true }, { deep: true, immediate: true })`,
    `watch(\n  () => [visual.value.bellyPatchDesign.mode, visual.value.bellyPatchDesign.style] as const,\n  ([mode, style]) => replaceTexture(bellyTexture, mode === 'custom' ? createBellyTexture(style) : undefined),\n  { immediate: true },\n)\nwatch(\n  () => visual.value.symbols.chest,\n  symbol => replaceTexture(chestTexture, symbol.enabled ? createSymbolTexture(symbol.text, symbol.color, symbol.glowIntensity) : undefined),\n  { immediate: true, deep: true },\n)\nwatch(\n  () => visual.value.symbols.back,\n  symbol => replaceTexture(backTexture, symbol.enabled ? createSymbolTexture(symbol.text, symbol.color, symbol.glowIntensity) : undefined),\n  { immediate: true, deep: true },\n)\nwatch(visual, () => {\n  appearanceRetryFrames = 0\n  appearanceDirty = true\n}, { deep: true, immediate: true })`,
    'lazy appearance textures',
  )
  next = replaceRequired(
    next,
    `  const group = root.value\n  if (!group) return`,
    `  const group = root.value\n  if (!group) {\n    appearanceDirty = appearanceRetryFrames < 12\n    return\n  }`,
    'missing appearance root retry',
  )
  next = replaceRequired(
    next,
    `  appearanceDirty = false\n}\n\nuseLoop().onBeforeRender(() => {\n  if (appearanceDirty || !legacyCore.value || !legacyBelly.value) applyAppearance()\n})`,
    `  const resolved = Boolean(legacyCore.value && legacyBelly.value)\n  appearanceDirty = !resolved && appearanceRetryFrames < 12\n}\n\nuseLoop().onBeforeRender(() => {\n  if (!appearanceDirty) return\n  appearanceRetryFrames += 1\n  applyAppearance()\n})`,
    'bounded scene traversal',
  )
  return next
})

await patchFile('apps/extension/components/avatar/AvatarCanvas.vue', (source) => {
  let next = replaceRequired(
    source,
    'let readinessTimer: number | null = null',
    `let readinessTimer: number | null = null\nlet stateFlushFrame: number | null = null\nlet lastStateSignature = ''`,
    'state flush tracking',
  )
  next = replaceRequired(
    next,
    `function clearReadinessTimer() {\n  if (readinessTimer === null) return\n  window.clearTimeout(readinessTimer)\n  readinessTimer = null\n}`,
    `function clearReadinessTimer() {\n  if (readinessTimer === null) return\n  window.clearTimeout(readinessTimer)\n  readinessTimer = null\n}\n\nfunction clearStateFlush() {\n  if (stateFlushFrame === null) return\n  window.cancelAnimationFrame(stateFlushFrame)\n  stateFlushFrame = null\n}\n\nfunction schedulePetElementUpdate() {\n  if (fallbackActive.value || stateFlushFrame !== null) return\n  stateFlushFrame = window.requestAnimationFrame(() => {\n    stateFlushFrame = null\n    updatePetElement()\n  })\n}`,
    'coalesced renderer updates',
  )
  next = replaceRequired(
    next,
    `  clearReadinessTimer()\n  console.warn('[YK-PETS yk-pet fallback]', reason)`,
    `  clearReadinessTimer()\n  clearStateFlush()\n  console.warn('[YK-PETS yk-pet fallback]', reason)`,
    'fallback flush cleanup',
  )
  next = replaceRequired(
    next,
    `  try {\n    element.setState({\n      recipe: effectiveRecipe.value,\n      speciesId: effectiveRecipe.value.speciesId,\n      rendererId: effectiveRecipe.value.rendererId,`,
    `  const recipe = effectiveRecipe.value\n  const signature = [\n    recipe.recipeId,\n    recipe.updatedAt,\n    props.behavior,\n    props.emotion,\n    props.speaking ? 1 : 0,\n    props.score,\n    props.compact ? 1 : 0,\n    props.transparent ? 1 : 0,\n    Math.round(props.pointer.x * 100) / 100,\n    Math.round(props.pointer.y * 100) / 100,\n    props.motionKey,\n  ].join('|')\n  if (signature === lastStateSignature) return\n\n  try {\n    element.setState({\n      recipe,\n      speciesId: recipe.speciesId,\n      rendererId: recipe.rendererId,`,
    'renderer state signature',
  )
  next = replaceRequired(
    next,
    `      },\n    })\n  }\n  catch (error) {`,
    `      },\n    })\n    lastStateSignature = signature\n  }\n  catch (error) {`,
    'signature commit after renderer update',
  )
  next = replaceRequired(next, '  updatePetElement()\n}\n\nfunction onStorageChanged', '  schedulePetElementUpdate()\n}\n\nfunction onStorageChanged', 'recipe restore scheduling')
  next = replaceRequired(next, '  activeRecipe.value = normalized\n  updatePetElement()\n}\n\nwatch(', '  activeRecipe.value = normalized\n  schedulePetElementUpdate()\n}\n\nwatch(', 'storage update scheduling')
  next = replaceRequired(
    next,
    `  updatePetElement,\n  { deep: true },\n)`,
    `  schedulePetElementUpdate,\n)`,
    'shallow watcher scheduling',
  )
  next = replaceRequired(
    next,
    `onBeforeUnmount(() => {\n  clearReadinessTimer()`,
    `onBeforeUnmount(() => {\n  clearReadinessTimer()\n  clearStateFlush()`,
    'state flush unmount cleanup',
  )
  return next
})

await patchFile('apps/extension/entrypoints/content/NovaPetOverlay.vue', (source) => {
  let next = replaceRequired(
    source,
    `const PAGE_SIZE = 6\nconst MENU_MODE_STORAGE_KEY`,
    `const PAGE_SIZE = 6\nconst POINTER_UPDATE_INTERVAL_MS = 34\nconst MENU_MODE_STORAGE_KEY`,
    'pointer update interval',
  )
  next = replaceRequired(
    next,
    `const pointer = ref({ x: 0, y: 0 })\nconst offset`,
    `const pointer = ref({ x: 0, y: 0 })\nlet pointerUpdateTimer: number | null = null\nlet pendingPointer = { x: 0, y: 0 }\nlet lastPointerUpdateAt = 0\nlet avatarBounds: DOMRect | null = null\nconst offset`,
    'pointer throttle state',
  )
  next = replaceRequired(
    next,
    `function preloadMotionVoices() {\n  for (const asset of new Set(Object.values(motionVoiceAssets).filter((value): value is string => Boolean(value)))) {\n    loadMotionVoiceData(asset).catch(error => console.warn('[NOVA motion voice preload]', asset, error))\n  }\n}\n\n`,
    '',
    'eager audio preload function',
  )
  next = replaceRequired(
    next,
    `function onPointerMove(event: PointerEvent) {\n  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()\n  pointer.value = {\n    x: Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1)),\n    y: Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1)),\n  }\n\n  const drag = dragState.value`,
    `function flushPointerUpdate() {\n  pointerUpdateTimer = null\n  lastPointerUpdateAt = performance.now()\n  const current = pointer.value\n  if (Math.abs(current.x - pendingPointer.x) < .005 && Math.abs(current.y - pendingPointer.y) < .005) return\n  pointer.value = pendingPointer\n}\n\nfunction schedulePointerUpdate(nextPointer: { x: number; y: number }) {\n  pendingPointer = nextPointer\n  if (pointerUpdateTimer !== null) return\n  const delay = Math.max(0, POINTER_UPDATE_INTERVAL_MS - (performance.now() - lastPointerUpdateAt))\n  pointerUpdateTimer = window.setTimeout(flushPointerUpdate, delay)\n}\n\nfunction onPointerMove(event: PointerEvent) {\n  const drag = dragState.value\n  if (!drag) {\n    const rect = avatarBounds || (event.currentTarget as HTMLElement).getBoundingClientRect()\n    if (rect.width > 0 && rect.height > 0) {\n      schedulePointerUpdate({\n        x: Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1)),\n        y: Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1)),\n      })\n    }\n  }`,
    'pointer move throttling',
  )
  next = replaceRequired(
    next,
    `  const target = event.currentTarget as HTMLElement\n  target.setPointerCapture(event.pointerId)`,
    `  const target = event.currentTarget as HTMLElement\n  avatarBounds = target.getBoundingClientRect()\n  target.setPointerCapture(event.pointerId)`,
    'pointer bounds capture',
  )
  next = replaceRequired(
    next,
    `function onPointerLeave() {\n  avatarHovered = false\n  hoverGreetingPlayed = false\n  if (!dragState.value) pointer.value = { x: 0, y: 0 }\n}\n\nfunction onAvatarEnter() {\n  avatarHovered = true`,
    `function onPointerLeave() {\n  avatarHovered = false\n  hoverGreetingPlayed = false\n  avatarBounds = null\n  if (pointerUpdateTimer !== null) window.clearTimeout(pointerUpdateTimer)\n  pointerUpdateTimer = null\n  pendingPointer = { x: 0, y: 0 }\n  if (!dragState.value) pointer.value = { x: 0, y: 0 }\n}\n\nfunction onAvatarEnter(event: MouseEvent) {\n  avatarHovered = true\n  avatarBounds = (event.currentTarget as HTMLElement | null)?.getBoundingClientRect() || null`,
    'pointer leave and enter lifecycle',
  )
  next = replaceRequired(next, '  preloadMotionVoices()\n', '', 'eager audio preload call')
  next = replaceRequired(
    next,
    `onBeforeUnmount(() => {\n  if (behaviorTimer) window.clearTimeout(behaviorTimer)`,
    `onBeforeUnmount(() => {\n  if (behaviorTimer) window.clearTimeout(behaviorTimer)\n  if (pointerUpdateTimer !== null) window.clearTimeout(pointerUpdateTimer)\n  pointerUpdateTimer = null`,
    'pointer timer cleanup',
  )
  return next
})

await patchFile('apps/extension/entrypoints/content.ts', (source) => {
  let next = replaceRequired(
    source,
    `    let previewIssueId: string | null = null`,
    `    let previewIssueId: string | null = null\n    let auditRunning = false`,
    'audit reentrancy state',
  )
  next = replaceRequired(
    next,
    `      const enabledCategories = categoriesForRules(enabledRuleCodes)\n      overlay.patch({`,
    `      const enabledCategories = categoriesForRules(enabledRuleCodes)\n      if (auditRunning) throw new Error('页面审计正在进行，请稍候。')\n      auditRunning = true\n      overlay.patch({`,
    'audit reentrancy guard',
  )
  next = replaceRequired(
    next,
    `        throw error\n      }\n    }`,
    `        throw error\n      }\n      finally {\n        auditRunning = false\n      }\n    }`,
    'audit reentrancy cleanup',
  )
  next = replaceRequired(
    next,
    `// 审计流水线：DOM 规则与性能规则合并后统一评分和排序。 / Audit pipeline: merge DOM and performance findings before scoring and ordering.\nasync function runAudit`,
    `const MAX_AUDIT_ELEMENTS_PER_RULE = 160\n\nfunction yieldToMain() {\n  return new Promise<void>((resolve) => {\n    if (document.visibilityState === 'visible') window.requestAnimationFrame(() => resolve())\n    else window.setTimeout(resolve, 0)\n  })\n}\n\n// 审计流水线：DOM 规则与性能规则合并后统一评分和排序。 / Audit pipeline: merge DOM and performance findings before scoring and ordering.\nasync function runAudit`,
    'cooperative audit helper',
  )
  next = replaceRequired(
    next,
    `  auditImages(issues, enabled)\n  auditFormControls(issues, enabled)\n  auditInteractiveNames(issues, enabled)\n  auditDocumentStructure(issues, enabled)\n  auditBestPractices(issues, enabled)\n  const metrics = collectMetrics(performanceState)\n  auditPerformance(issues, metrics, enabled)`,
    `  auditImages(issues, enabled)\n  await yieldToMain()\n  auditFormControls(issues, enabled)\n  await yieldToMain()\n  auditInteractiveNames(issues, enabled)\n  await yieldToMain()\n  auditDocumentStructure(issues, enabled)\n  await yieldToMain()\n  auditBestPractices(issues, enabled)\n  await yieldToMain()\n  const metrics = collectMetrics(performanceState)\n  auditPerformance(issues, metrics, enabled)`,
    'cooperative audit stages',
  )
  next = next.replaceAll('.slice(0, 250)', '.slice(0, MAX_AUDIT_ELEMENTS_PER_RULE)')
  next = replaceRequired(
    next,
    `  const viewport = window.visualViewport\n  window.addEventListener('scroll', update, true)\n  window.addEventListener('resize', update)\n  viewport?.addEventListener('resize', update)\n  viewport?.addEventListener('scroll', update)\n\n  mountWhenReady(host)`,
    `  const viewport = window.visualViewport\n  let highlightTracking = false\n  const startHighlightTracking = () => {\n    if (highlightTracking) return\n    highlightTracking = true\n    window.addEventListener('scroll', update, true)\n    window.addEventListener('resize', update)\n    viewport?.addEventListener('resize', update)\n    viewport?.addEventListener('scroll', update)\n  }\n  const stopHighlightTracking = () => {\n    if (!highlightTracking) return\n    highlightTracking = false\n    window.removeEventListener('scroll', update, true)\n    window.removeEventListener('resize', update)\n    viewport?.removeEventListener('resize', update)\n    viewport?.removeEventListener('scroll', update)\n  }\n\n  mountWhenReady(host)`,
    'lazy highlight tracking',
  )
  next = replaceRequired(
    next,
    `    show(element: HTMLElement, title: string) {\n      if (target !== element) {`,
    `    show(element: HTMLElement, title: string) {\n      startHighlightTracking()\n      if (target !== element) {`,
    'highlight tracking start',
  )
  next = replaceRequired(
    next,
    `    hide() {\n      resizeObserver.disconnect()\n      target = null\n      host.hidden = true`,
    `    hide() {\n      resizeObserver.disconnect()\n      stopHighlightTracking()\n      target = null\n      host.hidden = true`,
    'highlight tracking stop',
  )
  return next
})

const performanceCheck = `import { readFileSync } from 'node:fs'\n\nconst read = path => readFileSync(new URL(\`../\${path}\`, import.meta.url), 'utf8')\nconst rootPackage = read('package.json')\nconst productionCanvas = read('apps/extension/components/avatar/ProductionAvatarCanvas.vue')\nconst configuredFox = read('apps/extension/components/avatar/ConfiguredCloudFox.vue')\nconst avatarHost = read('apps/extension/components/avatar/AvatarCanvas.vue')\nconst overlay = read('apps/extension/entrypoints/content/NovaPetOverlay.vue')\nconst content = read('apps/extension/entrypoints/content.ts')\n\nconst checks = [\n  ['TresJS canvas caps FPS and compact DPR', productionCanvas.includes(':fps-limit="frameRateLimit"') && productionCanvas.includes("props.compact ? [.75, 1]") && productionCanvas.includes('power-preference="low-power"')],\n  ['compact overlay disables antialiasing', productionCanvas.includes(':antialias="!compact"')],\n  ['pointer updates are throttled before renderer propagation', overlay.includes('POINTER_UPDATE_INTERVAL_MS = 34') && overlay.includes('schedulePointerUpdate') && overlay.includes('pointerUpdateTimer')],\n  ['motion audio loads on demand instead of preloading every asset', !overlay.includes('preloadMotionVoices()')],\n  ['Web Component renderer updates are coalesced and deduplicated', avatarHost.includes('schedulePetElementUpdate') && avatarHost.includes('lastStateSignature') && !avatarHost.includes('{ deep: true }')],\n  ['appearance scene traversal has a bounded retry window', configuredFox.includes('appearanceRetryFrames < 12') && configuredFox.includes('if (!appearanceDirty) return')],\n  ['page audit yields between DOM rule groups', content.includes('await yieldToMain()') && content.includes('MAX_AUDIT_ELEMENTS_PER_RULE = 160')],\n  ['concurrent audit requests are rejected', content.includes('if (auditRunning)') && content.includes('auditRunning = false')],\n  ['highlight scroll tracking is active only while highlighted', content.includes('startHighlightTracking') && content.includes('stopHighlightTracking')],\n  ['root typecheck includes extension performance gate', rootPackage.includes('check-extension-runtime-performance.mjs')],\n]\n\nconst failures = checks.filter(([, passed]) => !passed).map(([name]) => name)\nif (failures.length) {\n  console.error('extension runtime performance check failed:')\n  for (const failure of failures) console.error(\`- \${failure}\`)\n  process.exit(1)\n}\nconsole.log(\`extension runtime performance check passed: \${checks.length} checks.\`)\n`
await writeFile('scripts/check-extension-runtime-performance.mjs', performanceCheck)

const packagePath = 'package.json'
const packageJson = JSON.parse(await readFile(packagePath, 'utf8'))
packageJson.scripts.typecheck = packageJson.scripts.typecheck.replace(
  'node scripts/check-pet-core-web-component.mjs &&',
  'node scripts/check-pet-core-web-component.mjs && node scripts/check-extension-runtime-performance.mjs &&',
)
packageJson.scripts['check:extension-performance'] = 'node scripts/check-extension-runtime-performance.mjs'
await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`)

console.log('Applied extension runtime performance fixes.')
