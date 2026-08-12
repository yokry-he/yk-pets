#!/usr/bin/env node
/**
 * 文件职责 / File responsibility
 * 锁定固定 URL 驱动的云狐视觉审计页，确保身体、头型、眼睛、肚皮和视角组合可被浏览器截图稳定复现。
 * Locks the fixed URL-driven Cloud Fox visual audit page so body, head, eye, belly, and view combinations remain reproducible for browser screenshots.
 */
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const page = read('apps/playground/app/pages/studio-visual-audit.vue')
const canvas = read('apps/playground/app/components/studio/CloudFoxStudioCanvas.vue')
const checks = [
  ['audit route identifies a deterministic Cloud Fox case', page.includes('data-visual-audit="cloud-fox"') && page.includes(':data-case-id="caseId"')],
  ['URL query controls every visual axis', ['body','head','eyes','belly','view'].every(key => page.includes(`queryValue('${key}')`))],
  ['audit recipe starts from the production classic appearance', page.includes('createExtensionClassicAppearance') && page.includes('normalizeCustomizableAppearance')],
  ['audit fixes motion background and camera focus', page.includes('behavior="idle"') && page.includes('background="dark"') && page.includes('focus="full"')],
  ['audit uses the canonical Studio canvas rather than another renderer', page.includes('<CloudFoxStudioCanvas') && !page.includes('TresCanvas')],
  ['canonical canvas keeps fixed section-independent fitting', canvas.includes('fitRatio') && !canvas.includes('focusZoom') && !canvas.includes('focusLift')],
]
const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('Cloud Fox visual audit route check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`Cloud Fox visual audit route passed: ${checks.length} checks.`)
