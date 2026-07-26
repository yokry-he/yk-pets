#!/usr/bin/env node
/**
 * 文件职责 / File responsibility
 * 锁定三个 Studio 工坊共享的自由旋转交互，并确保固定视角按钮清除旧偏移后落到绝对标准视角。
 * Locks shared free rotation across all three Studio workspaces and ensures canonical-view buttons clear offsets before selecting an absolute view.
 */
import { existsSync, readFileSync } from 'node:fs'

const read = relativePath => existsSync(new URL(`../${relativePath}`, import.meta.url))
  ? readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
  : ''

const orientation = read('apps/playground/app/composables/useStudioPreviewOrientation.ts')
const motion = read('apps/playground/app/pages/studio/motion.vue')
const appearance = read('apps/playground/app/components/studio/StudioAppearanceWorkspace.vue')
const props = read('apps/playground/app/pages/studio/props.vue')
const packageJson = read('package.json')

const selectViewBlock = orientation.slice(orientation.indexOf('function selectPreviewView'), orientation.indexOf('return {'))
const workspaces = [motion, appearance, props]
const checks = [
  ['shared preview orientation composable exists', orientation.includes('useStudioPreviewOrientation') && orientation.includes('previewRotationRadians')],
  ['canonical view selection clears free rotation before applying the view', selectViewBlock.indexOf('resetPreviewRotation()') >= 0 && selectViewBlock.indexOf('resetPreviewRotation()') < selectViewBlock.indexOf('applyView(view)')],
  ['drag rotation derives from pointer-start rotation and wraps degrees', orientation.includes('rotationY + (event.clientX - previewDrag.startX)') && orientation.includes('rotationX + (event.clientY - previewDrag.startY)') && orientation.includes('wrapStudioPreviewDegrees')],
  ['motion workspace delegates preview orientation to the shared composable', motion.includes('useStudioPreviewOrientation') && !motion.includes('function beginPreviewRotate') && motion.includes('selectPreviewView(view')],
  ['all workspaces pass shared rotation into the canonical canvas', workspaces.every(source => source.includes(':preview-rotation="previewRotationRadians"'))],
  ['appearance workspace exposes drag rotation without replacing hotspot actions', appearance.includes('class="preview-rotate-surface"') && appearance.includes('@pointerdown="beginPreviewRotate"') && appearance.includes('.part-hotspots')],
  ['prop workspace exposes drag rotation and keeps its mount badge interactive', props.includes('class="preview-rotate-surface"') && props.includes('@pointerdown="beginPreviewRotate"') && props.includes('.anchor-badge')],
  ['fixed view buttons in all workspaces use the resetting setView action', motion.includes('@click="setView(id)"') && appearance.includes('@click="setView(id)"') && props.includes('@click="setView(item)"')],
  ['root typecheck includes the preview orientation contract', packageJson.includes('node scripts/check-studio-preview-orientation.mjs')],
]

const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('Studio preview orientation check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`Studio preview orientation passed: ${checks.length} checks.`)
