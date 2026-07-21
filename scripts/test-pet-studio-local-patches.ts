import assert from 'node:assert/strict'
import { createExtensionClassicAppearance } from '../apps/playground/app/domain/extension-cloud-fox-default'
import { applyPetAppearanceLocalPatch } from '../apps/playground/app/domain/pet-appearance-patch'

const original = createExtensionClassicAppearance()
const nonTailSnapshot = JSON.stringify({
  identity: original.identity,
  parts: original.parts,
  proportions: original.proportions,
  palette: original.palette,
  glow: original.glow,
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
  tailDesign: earPatched.tailDesign,
  antennaDesign: earPatched.antennaDesign,
  symbols: earPatched.symbols,
  speciesParts: earPatched.speciesParts,
}), nonEarSnapshot)
assert.equal(earPatched.earDesign.outerColor, '#f4f7ff')
assert.equal(earPatched.earDesign.innerColor, '#8b6cff')
assert.equal(earPatched.earDesign.tipColor, '#77f2df')
assert.equal(earPatched.earDesign.innerGlowIntensity, 1.35)

console.log('Pet Studio local patch isolation passed: tail and ear edits preserve all unrelated appearance sections.')
