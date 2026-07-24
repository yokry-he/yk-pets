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
delete legacyRecipe.hindPawDesign
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
const fullyMigratedLegacy = normalizeCustomizableAppearance(legacyRecipe)
assert.equal(fullyMigratedLegacy.hindPawDesign.style, 'soft')
assert.equal(fullyMigratedLegacy.hindPawDesign.mirror, true)
assert.equal(fullyMigratedLegacy.hindPawDesign.pawScaleZ, 1)

const tailPatched = applyPetAppearanceLocalPatch(original, {
  tailDesign: {
    lateralOffset: .26,
    tipGlow: { enabled: false, color: '#ff66cc' },
    segments: original.tailDesign.segments.map((segment, index) => index === 1 ? { ...segment, offsetX: .18, offsetZ: -.12 } : segment),
  },
})
assertOnlyChanged(original, tailPatched, ['tailDesign', 'customization.colors.tailGlow'])
assert.equal(tailPatched.tailDesign.lateralOffset, .26)
assert.equal(tailPatched.tailDesign.tipGlow.color, '#ff66cc')

const earPatched = applyPetAppearanceLocalPatch(original, {
  earDesign: { outerColor: '#f4f7ff', innerColor: '#8b6cff', tipColor: '#77f2df', innerGlowIntensity: 1.35 },
})
assertOnlyChanged(original, earPatched, ['earDesign', 'customization.colors.earOuter', 'customization.colors.earInner', 'customization.colors.earTip'])
assert.equal(earPatched.earDesign.innerGlowIntensity, 1.35)

const frontPatched = applyPetAppearanceLocalPatch(original, {
  frontPawDesign: { style: 'mitten', embedDepth: .16, outwardAngle: .18, shoulderScale: 1.24, mirror: false, leftOffsetX: -.12 },
})
assertOnlyChanged(original, frontPatched, ['frontPawDesign'])
assert.equal(frontPatched.frontPawDesign.style, 'mitten')
assert.equal(frontPatched.frontPawDesign.leftOffsetX, -.12)

const hindPatched = applyPetAppearanceLocalPatch(original, {
  hindPawDesign: {
    style: 'haunch', mirror: false, rootHeight: .12, legLengthScale: 1.28, haunchScale: 1.42,
    pawScaleZ: 1.36, toeLift: .24, toeOutwardAngle: .18, heelDrop: .08, rightOffsetZ: .14,
  },
})
assertOnlyChanged(original, hindPatched, ['hindPawDesign'])
assert.equal(hindPatched.hindPawDesign.style, 'haunch')
assert.equal(hindPatched.hindPawDesign.mirror, false)
assert.equal(hindPatched.hindPawDesign.rootHeight, .12)
assert.equal(hindPatched.hindPawDesign.legLengthScale, 1.28)
assert.equal(hindPatched.hindPawDesign.haunchScale, 1.42)
assert.equal(hindPatched.hindPawDesign.pawScaleZ, 1.36)
assert.equal(hindPatched.hindPawDesign.toeLift, .24)
assert.equal(hindPatched.hindPawDesign.rightOffsetZ, .14)

const heartPatched = applyPetAppearanceLocalPatch(original, {
  bellyPatchDesign: { style: 'heart', width: 1.18, height: .82, offsetY: .1 },
})
assertOnlyChanged(original, heartPatched, ['bellyPatchDesign', 'customization.belly'])
assert.equal(heartPatched.customization.belly.shape, 'heart')

const symbolPatched = applyPetAppearanceLocalPatch(original, {
  chestDisplay: { mode: 'hybrid' },
  symbols: { chest: { enabled: true, scale: 1.42, offsetX: .08 }, back: { enabled: true, offsetY: .28 } },
})
assertOnlyChanged(original, symbolPatched, ['chestDisplay', 'symbols'])
assert.equal(symbolPatched.chestDisplay.mode, 'hybrid')

const mouthPatched = applyPetAppearanceLocalPatch(original, {
  customization: { mouth: { width: 1.24, surfaceOffset: .018, tongueVisible: false } },
})
assertOnlyChanged(original, mouthPatched, ['customization.mouth'])
assert.equal(mouthPatched.customization.mouth.width, 1.24)

console.log('Pet Studio local patch isolation passed for legacy migration, tail, ear, front paw, hind paw, belly, mouth, and symbols.')
