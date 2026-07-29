import assert from 'node:assert/strict'
import { EXTENSION_CLASSIC_CLOUD_FOX_SCHEME } from '../apps/playground/app/domain/chrome-extension-cloud-fox-profile'
import { createExtensionClassicAppearance } from '../apps/playground/app/domain/extension-cloud-fox-default'
import { applyPetAppearanceLocalPatch } from '../apps/playground/app/domain/pet-appearance-patch'
import { normalizeCustomizableAppearance } from '../apps/playground/app/domain/pet-part-customization'
import { normalizeMultiSpeciesAppearance } from '../apps/playground/app/domain/pet-species-registry'

const rawOriginal = createExtensionClassicAppearance()
const original = normalizeCustomizableAppearance(rawOriginal)
assert.deepEqual(rawOriginal.proportions, {
  ...rawOriginal.proportions,
  bodyWidth: .85,
  bodyHeight: .77,
  bodyDepth: 1,
  headScale: 1.24,
  tailLength: 1.36,
  tailWidth: .9,
})
assert.deepEqual(
  {
    rootHeight: rawOriginal.frontPawDesign.rootHeight,
    embedDepth: rawOriginal.frontPawDesign.embedDepth,
    forwardOffset: rawOriginal.frontPawDesign.forwardOffset,
    lateralOffset: rawOriginal.frontPawDesign.lateralOffset,
    shoulderScale: rawOriginal.frontPawDesign.shoulderScale,
    outwardAngle: rawOriginal.frontPawDesign.outwardAngle,
    forwardAngle: rawOriginal.frontPawDesign.forwardAngle,
  },
  { rootHeight: .1, embedDepth: .25, forwardOffset: -.13, lateralOffset: .28, shoulderScale: 1.62, outwardAngle: .55, forwardAngle: .1 },
)
assert.deepEqual(
  {
    rootOffsetX: rawOriginal.tailDesign.rootOffsetX,
    rootOffsetY: rawOriginal.tailDesign.rootOffsetY,
    rootOffsetZ: rawOriginal.tailDesign.rootOffsetZ,
    rootExtensionLength: rawOriginal.tailDesign.rootExtensionLength,
    rootExtensionWidth: rawOriginal.tailDesign.rootExtensionWidth,
    lateralOffset: rawOriginal.tailDesign.lateralOffset,
    direction: rawOriginal.tailDesign.direction,
    segments: rawOriginal.tailDesign.segments,
  },
  {
    rootOffsetX: 0,
    rootOffsetY: -.21,
    rootOffsetZ: .09,
    rootExtensionLength: .12,
    rootExtensionWidth: .15,
    lateralOffset: -.03,
    direction: 'left',
    segments: [
      { length: .7, width: .16, offsetX: .01, offsetY: 0, offsetZ: 0, rotationX: 0, rotationY: -.061592653589793, rotationZ: -.081592653589793 },
      { length: .58, width: .16, offsetX: 0, offsetY: 0, offsetZ: 0, rotationX: 0, rotationY: 0, rotationZ: .1 },
      { length: .52, width: .16, offsetX: 0, offsetY: 0, offsetZ: 0, rotationX: 0, rotationY: 0, rotationZ: .16 },
    ],
  },
)
assert.equal(rawOriginal.parts.headShape, 'classic-round')
assert.equal(rawOriginal.parts.eyes, 'round')
assert.equal(rawOriginal.parts.mouth, 'smile')
assert.equal(rawOriginal.proportions.limbLength, 1)
assert.equal(rawOriginal.proportions.limbThickness, 1)
assert.equal(rawOriginal.proportions.pawScale, 1)
assert.equal(rawOriginal.frontPawDesign.wristScale, 1)
assert.equal(rawOriginal.frontPawDesign.palmScale, 1)
assert.equal(rawOriginal.tailDesign.tipGlow.color, EXTENSION_CLASSIC_CLOUD_FOX_SCHEME.palette.tailTip)
for (const [rawPetId, normalizedPetId] of [[' My Pet ', 'my-pet'], ['M@y P!et', 'm-y-p-et'], ['   ', 'zeph']] as const) {
  const normalized = normalizeCustomizableAppearance({
    ...rawOriginal,
    identity: { ...rawOriginal.identity, petId: rawPetId },
  })
  assert.equal(normalized.identity.petId, normalizedPetId)
}
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
delete legacyRecipe.customization
const migratedLegacy = normalizeMultiSpeciesAppearance(legacyRecipe)
assert.equal(migratedLegacy.chestDisplay.mode, 'energy-core')
const fullyMigratedLegacy = normalizeCustomizableAppearance(legacyRecipe)
assert.equal(fullyMigratedLegacy.hindPawDesign.style, 'soft')
assert.deepEqual(fullyMigratedLegacy.customization.nose, { offsetX: 0, offsetY: 0, surfaceOffset: .012, scaleX: 1, scaleY: 1, scaleZ: 1, rotation: 0 })

const frontPatched = applyPetAppearanceLocalPatch(original, { frontPawDesign: { style: 'mitten', embedDepth: .16, mirror: false, leftOffsetX: -.12 } })
assertOnlyChanged(original, frontPatched, ['frontPawDesign'])
const hindPatched = applyPetAppearanceLocalPatch(original, { hindPawDesign: { style: 'haunch', mirror: false, haunchScale: 1.42, pawScaleZ: 1.36, toeLift: .24 } })
assertOnlyChanged(original, hindPatched, ['hindPawDesign'])
const nosePatched = applyPetAppearanceLocalPatch(original, { customization: { nose: { offsetX: .16, offsetY: -.08, surfaceOffset: .028, scaleX: 1.32, scaleY: .82, scaleZ: 1.18, rotation: .24 } } })
assertOnlyChanged(original, nosePatched, ['customization.nose'])
const mouthPatched = applyPetAppearanceLocalPatch(original, { customization: { mouth: { width: 1.24, surfaceOffset: .018, tongueVisible: false } } })
assertOnlyChanged(original, mouthPatched, ['customization.mouth'])

const independentColors = normalizeCustomizableAppearance({
  ...original,
  customization: { ...original.customization, colors: { ...original.customization.colors, paws: '#112233', antennaRod: '#445566', eyeHighlight: '#778899', energyCore: '#aabbcc' } },
})
assert.equal(independentColors.customization.colors.paws, '#112233')
assert.equal(independentColors.customization.colors.antennaRod, '#445566')
assert.equal(independentColors.customization.colors.eyeHighlight, '#778899')
assert.equal(independentColors.customization.colors.energyCore, '#aabbcc')
assert.notEqual(independentColors.customization.colors.paws, independentColors.customization.colors.antennaRod)
assert.notEqual(independentColors.customization.colors.eyeHighlight, independentColors.customization.colors.energyCore)

const extended = normalizeCustomizableAppearance({
  ...original,
  earDesign: { ...original.earDesign, innerGlowIntensity: 5.4 },
  tailDesign: {
    ...original.tailDesign,
    rootOffsetX: 1.12,
    rootOffsetY: -.96,
    rootExtensionLength: 1.45,
    rootExtensionWidth: .72,
    lateralOffset: 1.7,
    tipGlow: { ...original.tailDesign.tipGlow, intensity: 5.5, auraScale: 4.4 },
    segments: original.tailDesign.segments.map((segment, index) => index === 0
      ? { ...segment, length: 1.5, width: .72, offsetX: 1.05, offsetY: -.9, rotationZ: 2.7 }
      : segment),
  },
  symbols: {
    chest: { ...original.symbols.chest, scale: 2.7, offsetX: .92, offsetY: -.84, offsetZ: .65, rotation: 2.4, glowIntensity: 5.3 },
    back: { ...original.symbols.back, scale: 2.55, offsetX: -.88, offsetY: .95, offsetZ: .58, rotation: -2.2, glowIntensity: 5.1 },
  },
})
assert.equal(extended.earDesign.innerGlowIntensity, 5.4)
assert.equal(extended.tailDesign.rootOffsetX, 1.12)
assert.equal(extended.tailDesign.rootOffsetY, -.96)
assert.equal(extended.tailDesign.rootExtensionLength, 1.45)
assert.equal(extended.tailDesign.rootExtensionWidth, .72)
assert.equal(extended.tailDesign.lateralOffset, 1.7)
assert.equal(extended.tailDesign.tipGlow.intensity, 5.5)
assert.equal(extended.tailDesign.tipGlow.auraScale, 4.4)
assert.equal(extended.tailDesign.segments[0]?.length, 1.5)
assert.equal(extended.tailDesign.segments[0]?.width, .72)
assert.equal(extended.tailDesign.segments[0]?.offsetX, 1.05)
assert.equal(extended.tailDesign.segments[0]?.rotationZ, 2.7)
assert.equal(extended.symbols.chest.scale, 2.7)
assert.equal(extended.symbols.chest.offsetX, .92)
assert.equal(extended.symbols.chest.offsetZ, .65)
assert.equal(extended.symbols.chest.glowIntensity, 5.3)
assert.equal(extended.symbols.back.scale, 2.55)
assert.equal(extended.symbols.back.offsetY, .95)
assert.equal(extended.symbols.back.glowIntensity, 5.1)

const tailPatched = applyPetAppearanceLocalPatch(original, { tailDesign: { lateralOffset: .26, tipGlow: { enabled: false, color: '#ff66cc' } } })
assertOnlyChanged(original, tailPatched, ['tailDesign', 'customization.colors.tailGlow'])
const earPatched = applyPetAppearanceLocalPatch(original, { earDesign: { outerColor: '#f4f7ff', innerColor: '#8b6cff', tipColor: '#77f2df', innerGlowIntensity: 1.35 } })
assertOnlyChanged(original, earPatched, ['earDesign', 'customization.colors.earOuter', 'customization.colors.earInner', 'customization.colors.earTip'])
const heartPatched = applyPetAppearanceLocalPatch(original, { bellyPatchDesign: { style: 'heart', width: 1.18, height: .82, offsetY: .1 } })
assertOnlyChanged(original, heartPatched, ['bellyPatchDesign', 'customization.belly'])
const symbolPatched = applyPetAppearanceLocalPatch(original, { chestDisplay: { mode: 'hybrid' }, symbols: { chest: { enabled: true, scale: 1.42 }, back: { enabled: true, offsetY: .28 } } })
assertOnlyChanged(original, symbolPatched, ['chestDisplay', 'symbols'])

console.log('Pet Studio local patch and extended-range regression passed for front/hind paws, nose, colors, ear, belly, tail, and symbols.')
