import assert from 'node:assert/strict'
import { createExtensionClassicAppearance } from '../apps/playground/app/domain/extension-cloud-fox-default'
import { applyPetAppearanceLocalPatch } from '../apps/playground/app/domain/pet-appearance-patch'
import { normalizeMultiSpeciesAppearance } from '../apps/playground/app/domain/pet-species-registry'

const original = createExtensionClassicAppearance()

const legacyRecipe = JSON.parse(JSON.stringify(original))
delete legacyRecipe.bellyPatchDesign
delete legacyRecipe.chestDisplay
delete legacyRecipe.symbols.chest.offsetX
delete legacyRecipe.symbols.chest.offsetY
delete legacyRecipe.symbols.chest.offsetZ
delete legacyRecipe.symbols.back.offsetX
delete legacyRecipe.symbols.back.offsetY
delete legacyRecipe.symbols.back.offsetZ
const migratedLegacy = normalizeMultiSpeciesAppearance(legacyRecipe)
assert.deepEqual(migratedLegacy.bellyPatchDesign, {
  visible: true,
  style: 'shield',
  width: 1,
  height: 1,
  offsetY: 0,
})
assert.equal(migratedLegacy.chestDisplay.mode, 'energy-core')
assert.equal(migratedLegacy.symbols.back.offsetY, .18)

const legacySymbolRecipe = JSON.parse(JSON.stringify(legacyRecipe))
legacySymbolRecipe.symbols.chest.enabled = true
const migratedLegacySymbol = normalizeMultiSpeciesAppearance(legacySymbolRecipe)
assert.equal(migratedLegacySymbol.chestDisplay.mode, 'symbol')

const nonTailSnapshot = JSON.stringify({
  identity: original.identity,
  parts: original.parts,
  proportions: original.proportions,
  palette: original.palette,
  glow: original.glow,
  bellyPatchDesign: original.bellyPatchDesign,
  chestDisplay: original.chestDisplay,
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
  chestDisplay: tailPatched.chestDisplay,
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
  chestDisplay: original.chestDisplay,
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
  chestDisplay: earPatched.chestDisplay,
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
  chestDisplay: original.chestDisplay,
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
  chestDisplay: pawPatched.chestDisplay,
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
  chestDisplay: original.chestDisplay,
  frontPawDesign: original.frontPawDesign,
  orbitDesign: original.orbitDesign,
  earDesign: original.earDesign,
  tailDesign: original.tailDesign,
  antennaDesign: original.antennaDesign,
  symbols: original.symbols,
  speciesParts: original.speciesParts,
})
const heartPatched = applyPetAppearanceLocalPatch(original, {
  bellyPatchDesign: {
    style: 'heart',
    width: 1.18,
    height: .82,
    offsetY: .1,
  },
})
assert.deepEqual(heartPatched.bellyPatchDesign, {
  visible: true,
  style: 'heart',
  width: 1.18,
  height: .82,
  offsetY: .1,
})
assert.equal(JSON.stringify({
  identity: heartPatched.identity,
  parts: heartPatched.parts,
  proportions: heartPatched.proportions,
  palette: heartPatched.palette,
  glow: heartPatched.glow,
  chestDisplay: heartPatched.chestDisplay,
  frontPawDesign: heartPatched.frontPawDesign,
  orbitDesign: heartPatched.orbitDesign,
  earDesign: heartPatched.earDesign,
  tailDesign: heartPatched.tailDesign,
  antennaDesign: heartPatched.antennaDesign,
  symbols: heartPatched.symbols,
  speciesParts: heartPatched.speciesParts,
}), nonBellySnapshot)

const symbolPatched = applyPetAppearanceLocalPatch(original, {
  chestDisplay: { mode: 'hybrid' },
  symbols: {
    chest: { enabled: true, scale: 1.42, offsetX: .08, offsetY: .12, offsetZ: .14 },
    back: { enabled: true, offsetY: .28, offsetZ: .08 },
  },
})
assert.equal(symbolPatched.chestDisplay.mode, 'hybrid')
assert.equal(symbolPatched.symbols.chest.scale, 1.42)
assert.equal(symbolPatched.symbols.chest.offsetX, .08)
assert.equal(symbolPatched.symbols.chest.offsetY, .12)
assert.equal(symbolPatched.symbols.chest.offsetZ, .14)
assert.equal(symbolPatched.symbols.back.offsetY, .28)
assert.equal(symbolPatched.symbols.back.offsetZ, .08)
assert.deepEqual(symbolPatched.bellyPatchDesign, original.bellyPatchDesign)
assert.deepEqual(symbolPatched.orbitDesign, original.orbitDesign)

const heartRoundTrip = normalizeMultiSpeciesAppearance(JSON.parse(JSON.stringify(heartPatched)))
const shieldRoundTrip = normalizeMultiSpeciesAppearance(JSON.parse(JSON.stringify(original)))
assert.equal(heartRoundTrip.bellyPatchDesign.style, 'heart')
assert.equal(heartRoundTrip.bellyPatchDesign.width, 1.18)
assert.equal(shieldRoundTrip.bellyPatchDesign.style, 'shield')
assert.deepEqual(heartRoundTrip.orbitDesign, original.orbitDesign)

console.log('Pet Studio local patch isolation passed: legacy migration, five-style belly sizing, chest modes, symbol placement, and unrelated-section preservation.')
