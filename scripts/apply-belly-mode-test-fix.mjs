#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'

async function replaceFile(path, replacements) {
  let content = await readFile(path, 'utf8')
  for (const [before, after, label] of replacements) {
    if (!content.includes(before)) throw new Error(`Missing target: ${label}`)
    content = content.replace(before, after)
  }
  await writeFile(path, content)
}

await replaceFile('apps/playground/app/domain/pet-appearance-patch.ts', [[
`export function applyPetAppearanceLocalPatch(
  current: MultiSpeciesAppearanceRecipe,
  patch: PetAppearanceLocalPatch,
): MultiSpeciesAppearanceRecipe {
  return normalizeMultiSpeciesAppearance({
`,
`export function applyPetAppearanceLocalPatch(
  current: MultiSpeciesAppearanceRecipe,
  patch: PetAppearanceLocalPatch,
): MultiSpeciesAppearanceRecipe {
  const bellyPatch = patch.bellyPatchDesign
  const changesCustomGeometry = Boolean(bellyPatch) && [
    bellyPatch?.style,
    bellyPatch?.width,
    bellyPatch?.height,
    bellyPatch?.offsetY,
  ].some(value => value !== undefined)
  const bellyPatchDesign = bellyPatch
    ? {
        ...current.bellyPatchDesign,
        ...bellyPatch,
        ...(!bellyPatch.mode && bellyPatch.visible === false ? { mode: 'none' as const } : {}),
        ...(!bellyPatch.mode && changesCustomGeometry ? { mode: 'custom' as const, visible: true } : {}),
      }
    : current.bellyPatchDesign

  return normalizeMultiSpeciesAppearance({
`, 'local patch prelude'], [
`    bellyPatchDesign: { ...current.bellyPatchDesign, ...patch.bellyPatchDesign },
`,
`    bellyPatchDesign,
`, 'local belly patch merge']])

await replaceFile('scripts/test-pet-studio-local-patches.ts', [[
`assert.deepEqual(migratedLegacy.bellyPatchDesign, {
  visible: true,
`,
`assert.deepEqual(migratedLegacy.bellyPatchDesign, {
  mode: 'model-default',
  visible: true,
`, 'legacy belly expected mode'], [
`assert.deepEqual(heartPatched.bellyPatchDesign, {
  visible: true,
`,
`assert.deepEqual(heartPatched.bellyPatchDesign, {
  mode: 'custom',
  visible: true,
`, 'custom belly expected mode'], [
`assert.equal(heartRoundTrip.bellyPatchDesign.style, 'heart')
assert.equal(heartRoundTrip.bellyPatchDesign.width, 1.18)
assert.equal(shieldRoundTrip.bellyPatchDesign.style, 'shield')
`,
`assert.equal(heartRoundTrip.bellyPatchDesign.mode, 'custom')
assert.equal(heartRoundTrip.bellyPatchDesign.style, 'heart')
assert.equal(heartRoundTrip.bellyPatchDesign.width, 1.18)
assert.equal(shieldRoundTrip.bellyPatchDesign.mode, 'model-default')
assert.equal(shieldRoundTrip.bellyPatchDesign.style, 'shield')
`, 'belly mode round trip']])

console.log('Belly patch local semantics and tests updated.')
