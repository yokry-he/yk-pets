import assert from 'node:assert/strict'
import { createExtensionClassicAppearance } from '../apps/playground/app/domain/extension-cloud-fox-default'
import { applyPetAppearanceLocalPatch } from '../apps/playground/app/domain/pet-appearance-patch'
import { normalizeMultiSpeciesAppearance } from '../apps/playground/app/domain/pet-species-registry'

const original = createExtensionClassicAppearance()

const legacyRecipe = JSON.parse(JSON.stringify(original))
delete legacyRecipe.bellyPatchDesign
const migratedLegacy = normalizeMultiSpeciesAppearance(legacyRecipe)
assert.equal(migratedLegacy.bellyPatchDesign.style, 'shield')

const nonTailSnapshot = JSON.stringify({
  identity: original.identity,
  parts: original.parts,
  proportions: original.proportions,
  palette: original.palette,
  glow: original.glow,
  bellyPatchDesign: original.bellyPatchDesign,
  frontPawDesign: original.frontPawDesign,
  orbitDesign: original.orbitDesign,
  earDesign: original.earDesign,
  antennaDesign: original.antennaDesign,
  symbols: original.symbols,
  speciesParts: original.speciesParts,
})

const tailPatched = applyPetAppearanceLocalPatch(original, {
  tailDesign: {
    lateralOffset: .26,
    tipGlow: { enabled: false, color: '#ff66cc' },
    segments: original.tailDesign.segments.map((segment, index) => (
      index === 1 ? { ...segment, offsetX: .18, offsetZ: -.12 } : segment
    )),
  },
})
assert.equal(JSON.stringify({
  identity: tailPatched.identity,
  parts: tailPatched.parts,
  proportions: tailPatched.proportions,
  palette: tailPatched.palette,
  glow: tailPatched.glow,
  bellyPatchDesign: tailPatched.bellyPatchDesign,
  frontPawDesign: tailPatched.frontPawDesign,
  orbitDesign: tailPatched.orbitDesign,
  earDesign: tailPatched.earDesign,
  antennaDesign: tailPatched.antennaDesign,
  symbols: tailPatched.symbols,
  speciesParts: tailPatched.speciesParts,
}), nonTailSnapshot)
assert.equal(tailPatched.tailDesign.lateralOffset, .26)
assert.equal(tailPatched.tailDesign.tipGlow.enabled, false)
assert.equal(tailPatched.tailDesign.tipGlow.color, '#ff66cc')
assert.equal(tailPatched.tailDesign.segments[1]?.offsetX, .18)
assert.equal(tailPatched.tailDesign.segments[1]?.offsetZ, -.12)

const nonEarSnapshot = JSON.stringify({
  identity: original.identity,
  parts: original.parts,
  proportions: original.proportions,
  palette: original.palette,
  glow: original.glow,
  bellyPatchDesign: original.bellyPatchDesign,
  frontPawDesign: original.frontPawDesign,
  orbitDesign: original.orbitDesign,
  tailDesign: original.tailDesign,
  antennaDesign: original.antennaDesign,
  symbols: original.symbols,
  speciesParts: original.speciesParts,
})
const earPatched = applyPetAppearanceLocalPatch(original, {
  earDesign: {
    outerColor: '#f4f7ff',
    innerColor: '#8b6cff',
    tipColor: '#77f2df',
    innerGlowIntensity: 1.35,
  },
})
assert.equal(JSON.stringify({
  identity: earPatched.identity,
  parts: earPatched.parts,
  proportions: earPatched.proportions,
  palette: earPatched.palette,
  glow: earPatched.glow,
  bellyPatchDesign: earPatched.bellyPatchDesign,
  frontPawDesign: earPatched.frontPawDesign,
  orbitDesign: earPatched.orbitDesign,
  tailDesign: earPatched.tailDesign,
  antennaDesign: earPatched.antennaDesign,
  symbols: earPatched.symbols,
  speciesParts: earPatched.speciesParts,
}), nonEarSnapshot)
assert.equal(earPatched.earDesign.outerColor, '#f4f7ff')
assert.equal(earPatched.earDesign.innerColor, '#8b6cff')
assert.equal(earPatched.earDesign.tipColor, '#77f2df')
assert.equal(earPatched.earDesign.innerGlowIntensity, 1.35)

const nonPawSnapshot = JSON.stringify({
  identity: original.identity,
  parts: original.parts,
  proportions: original.proportions,
  palette: original.palette,
  glow: original.glow,
  bellyPatchDesign: original.bellyPatchDesign,
  orbitDesign: original.orbitDesign,
  earDesign: original.earDesign,
  tailDesign: original.tailDesign,
  antennaDesign: original.antennaDesign,
  symbols: original.symbols,
  speciesParts: original.speciesParts,
})
const pawPatched = applyPetAppearanceLocalPatch(original, {
  frontPawDesign: {
    style: 'mitten',
    embedDepth: .16,
    outwardAngle: .18,
    shoulderScale: 1.24,
  },
})
assert.equal(JSON.stringify({
  identity: pawPatched.identity,
  parts: pawPatched.parts,
  proportions: pawPatched.proportions,
  palette: pawPatched.palette,
  glow: pawPatched.glow,
  bellyPatchDesign: pawPatched.bellyPatchDesign,
  orbitDesign: pawPatched.orbitDesign,
  earDesign: pawPatched.earDesign,
  tailDesign: pawPatched.tailDesign,
  antennaDesign: pawPatched.antennaDesign,
  symbols: pawPatched.symbols,
  speciesParts: pawPatched.speciesParts,
}), nonPawSnapshot)
assert.equal(pawPatched.frontPawDesign.style, 'mitten')
assert.equal(pawPatched.frontPawDesign.embedDepth, .16)
assert.equal(pawPatched.frontPawDesign.outwardAngle, .18)
assert.equal(pawPatched.frontPawDesign.shoulderScale, 1.24)

const nonBellySnapshot = JSON.stringify({
  identity: original.identity,
  parts: original.parts,
  proportions: original.proportions,
  palette: original.palette,
  glow: original.glow,
  frontPawDesign: original.frontPawDesign,
  orbitDesign: original.orbitDesign,
  earDesign: original.earDesign,
  tailDesign: original.tailDesign,
  antennaDesign: original.antennaDesign,
  symbols: original.symbols,
  speciesParts: original.speciesParts,
})
const ovalPatched = applyPetAppearanceLocalPatch(original, {
  bellyPatchDesign: { style: 'oval' },
})
assert.equal(ovalPatched.bellyPatchDesign.style, 'oval')
assert.equal(JSON.stringify({
  identity: ovalPatched.identity,
  parts: ovalPatched.parts,
  proportions: ovalPatched.proportions,
  palette: ovalPatched.palette,
  glow: ovalPatched.glow,
  frontPawDesign: ovalPatched.frontPawDesign,
  orbitDesign: ovalPatched.orbitDesign,
  earDesign: ovalPatched.earDesign,
  tailDesign: ovalPatched.tailDesign,
  antennaDesign: ovalPatched.antennaDesign,
  symbols: ovalPatched.symbols,
  speciesParts: ovalPatched.speciesParts,
}), nonBellySnapshot)

const ovalRoundTrip = normalizeMultiSpeciesAppearance(JSON.parse(JSON.stringify(ovalPatched)))
const shieldRoundTrip = normalizeMultiSpeciesAppearance(JSON.parse(JSON.stringify(original)))
assert.equal(ovalRoundTrip.bellyPatchDesign.style, 'oval')
assert.equal(shieldRoundTrip.bellyPatchDesign.style, 'shield')
assert.deepEqual(ovalRoundTrip.orbitDesign, original.orbitDesign)

console.log('Pet Studio local patch isolation passed: legacy belly migration, oval/shield round trips, and tail, ear, paw, belly edits preserve unrelated sections.')
