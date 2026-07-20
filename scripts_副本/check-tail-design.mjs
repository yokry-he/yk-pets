import { readFileSync } from 'node:fs'

const extensionTail = readFileSync(new URL('../apps/extension/components/avatar/CloudFox.vue', import.meta.url), 'utf8')
const playgroundTail = readFileSync(new URL('../apps/playground/app/components/pet/CloudFox.vue', import.meta.url), 'utf8')
const zhDoc = readFileSync(new URL('../docs/zh-CN/TAIL-DESIGN.md', import.meta.url), 'utf8')
const enDoc = readFileSync(new URL('../docs/en/TAIL-DESIGN.md', import.meta.url), 'utf8')

const requirements = [
  ['segmented curve geometry', extensionTail.includes('tailBaseCurve') && extensionTail.includes('tailMidCurve') && extensionTail.includes('tailTipCurve')],
  ['delayed tail joints', extensionTail.includes('tailMidGroup') && extensionTail.includes('tailTipGroup') && extensionTail.includes('midWave') && extensionTail.includes('tipWave')],
  ['energy tail tip', extensionTail.includes('tailEnergy') && extensionTail.includes('AdditiveBlending') && extensionTail.includes(':tone-mapped="false"')],
  ['playground parity', playgroundTail.includes('tailBaseCurve') && playgroundTail.includes('tailTipGroup')],
  ['bilingual tail documents', zhDoc.includes('分段柔性云尾') && enDoc.includes('segmented flexible cloud tail')],
]

const failures = requirements.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('尾巴设计检查失败 / Tail design check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`尾巴设计检查通过，共 ${requirements.length} 项。 / Tail design check passed for ${requirements.length} requirements.`)
