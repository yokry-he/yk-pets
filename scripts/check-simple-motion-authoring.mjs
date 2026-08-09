#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(path, 'utf8')
const authoring = read('packages/pet-core/src/motion/simple-motion-authoring.ts')
const compiler = read('packages/pet-core/src/motion/simple-motion-compiler.ts')
const assets = read('apps/playground/app/stores/studio-assets.ts')
const editor = read('apps/playground/app/stores/studio-motion-editor.ts')

assert.match(authoring, /SIMPLE_MOTION_AUTHORING_EXTENSION_KEY/)
assert.match(authoring, /createSimpleMotionRecipe/)
assert.match(compiler, /compileSimpleMotionRecipe/)
assert.match(compiler, /SIMPLE_MOTION_CORRECTION_LAYER_ID/)
assert.match(assets, /createMotionFromIntent\(intent: SimpleMotionIntent/)
assert.match(assets, /compileSimpleMotionRecipe/)
assert.match(editor, /selectedStageId:/)
assert.match(editor, /authoringMode: 'guided'/)
assert.match(editor, /updateSimpleStage/)
assert.match(editor, /selectSimpleStage/)
assert.match(editor, /duplicateSimpleStage/)
assert.match(editor, /moveSimpleStage/)
assert.match(editor, /removeSimpleStage/)

console.log('Simple motion authoring store gate passed.')
