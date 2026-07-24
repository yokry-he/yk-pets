import assert from 'node:assert/strict'
import { createExtensionClassicAppearance } from '../apps/playground/app/domain/extension-cloud-fox-default'
import { applyPetAppearanceLocalPatch } from '../apps/playground/app/domain/pet-appearance-patch'
import { normalizeCustomizableAppearance } from '../apps/playground/app/domain/pet-part-customization'
import { normalizeMultiSpeciesAppearance } from '../apps/playground/app/domain/pet-species-registry'

const rawOriginal = createExtensionClassicAppearance()
const original = normalizeCustomizableAppearance(rawOriginal)

type JsonRecord = Record<string, unknown>
function snapshotExcept(value: unknown, paths: string[]) {
  const clone = JSON.parse(JSON.stringify(value)) as JsonRecord
  for (const path of paths) {
    const segments = path.split('.')
    let target: JsonRecord | undefined = clone
    for (const segment of segments.slice(0, -1)) {
      const next = target?.[segment]
      target = next && typeof next === 'object' && !Array.isArray(next) ? next as JsonRecord : undefined
    }
    if (target) delete target[segments.at(-1)!]
  }
  return JSON.stringify(clone)
}
function assertOnlyChanged(before: unknown, after: unknown, ownedPaths: string[]) {
  assert.equal(snapshotExcept(after, ownedPaths), snapshotExcept(before, ownedPaths))
}

const legacyRecipe = JSON.parse(JSON.stringify(rawOriginal))
delete legacyRecipe.bellyPatchDesign
delete legacyRecipe.chestDisplay
delete legacyRecipe.symbols.chest.offsetX
delete legacyRecipe.symbols.chest.offsetY
delete legacyRecipe.symbols.chest.offsetZ
delete legacyRecipe.symbols.back.offsetX
delete legacyRecipe.symbols.back.offsetY
delete legacyRecipe.symbols.back.offsetZ
const migratedLegacy = normalizeMultiSpeciesAppearance(legacyRecipe)
assert.deepEqual(migratedLegacy.bellyPatchDesign, { mode: 'model-default', visible: true, style: 'shield', width: 1, height: 1, offsetY: 0 })
assert.equal(migratedLegacy.chestDisplay.mode, 'energy-core')
assert.equal(migratedLegacy.symbols.back.offsetY, .18)
const legacySymbolRecipe = JSON.parse(JSON.stringify(legacyRecipe))
legacySymbolRecipe.symbols.chest.enabled = true
assert.equal(normalizeMultiSpeciesAppearance(legacySymbolRecipe).chestDisplay.mode, 'symbol')

const tailPatched = applyPetAppearanceLocalPatch(original, {
  tailDesign: {
    lateralOffset: .26,
    tipGlow: { enabled: false, color: '#ff66cc' },
    segments: original.tailDesign.segments.map((segment, index) => index === 1 ? { ...segment, offsetX: .18, offsetZ: -.12 } : segment),
  },
})
assertOnlyChanged(original, tailPatched, ['tailDesign', 'customization.colors.tailGlow'])
assert.equal(tailPatched.tailDesign.lateralOffset, .26)
assert.equal(tailPatched.tailDesign.tipGlow.enabled, false)
assert.equal(tailPatched.tailDesign.tipGlow.color, '#ff66cc')
assert.equal(tailPatched.customization.colors.tailGlow, '#ff66cc')
assert.equal(tailPatched.tailDesign.segments[1]?.offsetX, .18)
assert.equal(tailPatched.tailDesign.segments[1]?.offsetZ, -.12)

const earPatched = applyPetAppearanceLocalPatch(original, {
  earDesign: { outerColor: '#f4f7ff', innerColor: '#8b6cff', tipColor: '#77f2df', innerGlowIntensity: 1.35 },
})
assertOnlyChanged(original, earPatched, ['earDesign', 'customization.colors.earOuter', 'customization.colors.earInner', 'customization.colors.earTip'])
assert.equal(earPatched.earDesign.outerColor, '#f4f7ff')
assert.equal(earPatched.earDesign.innerColor, '#8b6cff')
assert.equal(earPatched.earDesign.tipColor, '#77f2df')
assert.equal(earPatched.earDesign.innerGlowIntensity, 1.35)
assert.equal(earPatched.customization.colors.earOuter, '#f4f7ff')
assert.equal(earPatched.customization.colors.earInner, '#8b6cff')
assert.equal(earPatched.customization.colors.earTip, '#77f2df')

const pawPatched = applyPetAppearanceLocalPatch(original, {
  frontPawDesign: { style: 'mitten', embedDepth: .16, outwardAngle: .18, shoulderScale: 1.24, mirror: false, leftOffsetX: -.12 },
})
assertOnlyChanged(original, pawPatched, ['frontPawDesign'])
assert.equal(pawPatched.frontPawDesign.style, 'mitten')
assert.equal(pawPatched.frontPawDesign.embedDepth, .16)
assert.equal(pawPatched.frontPawDesign.outwardAngle, .18)
assert.equal(pawPatched.frontPawDesign.shoulderScale, 1.24)
assert.equal(pawPatched.frontPawDesign.mirror, false)
assert.equal(pawPatched.frontPawDesign.leftOffsetX, -.12)

const heartPatched = applyPetAppearanceLocalPatch(original, {
  bellyPatchDesign: { style: 'heart', width: 1.18, height: .82, offsetY: .1 },
})
assertOnlyChanged(original, heartPatched, ['bellyPatchDesign', 'customization.belly'])
assert.deepEqual(heartPatched.bellyPatchDesign, { mode: 'custom', visible: true, style: 'heart', width: 1.18, height: .82, offsetY: .1 })
assert.equal(heartPatched.customization.belly.shape, 'heart')
assert.equal(heartPatched.customization.belly.width, 1.18)
assert.equal(heartPatched.customization.belly.height, .82)
assert.equal(heartPatched.customization.belly.offsetY, .1)

const symbolPatched = applyPetAppearanceLocalPatch(original, {
  chestDisplay: { mode: 'hybrid' },
  symbols: {
    chest: { enabled: true, scale: 1.42, offsetX: .08, offsetY: .12, offsetZ: .14 },
    back: { enabled: true, offsetY: .28, offsetZ: .08 },
  },
})
assertOnlyChanged(original, symbolPatched, ['chestDisplay', 'symbols'])
assert.equal(symbolPatched.chestDisplay.mode, 'hybrid')
assert.equal(symbolPatched.symbols.chest.enabled, true)
assert.equal(symbolPatched.symbols.chest.scale, 1.42)
assert.equal(symbolPatched.symbols.back.enabled, true)

const mouthPatched = applyPetAppearanceLocalPatch(original, {
  customization: { mouth: { width: 1.24, surfaceOffset: .018, tongueVisible: false } },
})
assertOnlyChanged(original, mouthPatched, ['customization.mouth'])
assert.equal(mouthPatched.customization.mouth.width, 1.24)
assert.equal(mouthPatched.customization.mouth.surfaceOffset, .018)
assert.equal(mouthPatched.customization.mouth.tongueVisible, false)

console.log('Pet Studio local patch isolation passed for legacy migration, tail, ear, extended paw, belly, mouth, and symbols.')
