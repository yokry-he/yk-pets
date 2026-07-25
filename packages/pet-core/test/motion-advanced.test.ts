/**
 * 文件职责 / File responsibility
 * 验证高级插值、动作层、镜像预设、IK、音效规范化和本地 GLB 安全校验。
 * Verifies advanced interpolation, motion layers, mirroring/presets, IK, audio normalization, and local GLB safety validation.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addMotionLayer,
  applyMotionPosePreset,
  createStudioMotionAsset,
  evaluateNormalizedMotionAsset,
  mirrorMotionAsset,
  normalizeMotionAsset,
  solveTwoBoneIk2D,
  updateMotionLayer,
  validateLocalGlb,
} from '../src/index.ts'

test('smooth and bezier interpolation evaluate deterministically', () => {
  const asset = normalizeMotionAsset({ id:'advanced', nameZh:'高级', nameEn:'Advanced', durationMs:1000, tracks:[
    { id:'smooth', channelId:'root.position.y', layerId:'base', keyframes:[{id:'a',timeMs:0,value:0,interpolation:'smooth'},{id:'b',timeMs:1000,value:2,interpolation:'linear'}] },
    { id:'bezier', channelId:'head.rotation.x', layerId:'base', keyframes:[{id:'c',timeMs:0,value:0,interpolation:'bezier',outTangent:1},{id:'d',timeMs:1000,value:1,interpolation:'linear',inTangent:1}] },
  ]}).asset
  assert.equal(evaluateNormalizedMotionAsset(asset, 500).values['root.position.y'], 1)
  assert.equal(evaluateNormalizedMotionAsset(asset, 500).values['head.rotation.x'], .5)
})

test('override and additive layers compose by weight and priority', () => {
  let asset = createStudioMotionAsset({ id:'layers', nameZh:'层', nameEn:'Layers', durationMs:1000, tracks:[], createdAt:1, updatedAt:1 })
  asset = addMotionLayer(asset, 'Additive', 'additive')
  const layerId = asset.layers.find(layer => layer.id !== 'base')!.id
  asset = updateMotionLayer(asset, layerId, { weight:.5, priority:2 })
  asset = normalizeMotionAsset({ ...asset, tracks:[
    { id:'base-y', channelId:'root.position.y', layerId:'base', muted:false, keyframes:[{id:'base',timeMs:0,value:1,interpolation:'linear'}] },
    { id:'add-y', channelId:'root.position.y', layerId, muted:false, keyframes:[{id:'add',timeMs:0,value:2,interpolation:'linear'}] },
  ]}).asset
  assert.equal(evaluateNormalizedMotionAsset(asset, 0).values['root.position.y'], 2)
})

test('mirroring, presets, and IK remain framework independent', () => {
  let asset = normalizeMotionAsset({ id:'mirror', nameZh:'镜像', nameEn:'Mirror', durationMs:1000, tracks:[{id:'left',channelId:'frontPaw.left.rotation.z',layerId:'base',keyframes:[{id:'k',timeMs:0,value:.6,interpolation:'linear'}]}] }).asset
  const mirrored = normalizeMotionAsset(mirrorMotionAsset(asset)).asset
  assert.equal(mirrored.tracks[0]?.channelId, 'frontPaw.right.rotation.z')
  assert.equal(mirrored.tracks[0]?.keyframes[0]?.value, -.6)
  asset = normalizeMotionAsset(applyMotionPosePreset(asset, 'wave-right', 250)).asset
  assert.ok(asset.tracks.some(track => track.channelId === 'frontPaw.right.rotation.x'))
  const neutral = normalizeMotionAsset(applyMotionPosePreset(asset, 'neutral', 500)).asset
  assert.ok(neutral.tracks.some(track => track.channelId === 'mouth.open' && track.keyframes.some(keyframe => keyframe.timeMs === 500 && keyframe.value === 0)))
  const ik = solveTwoBoneIk2D(1, .5, .8, .7)
  assert.equal(ik.reachable, true)
  assert.ok(Number.isFinite(ik.upperAngle) && Number.isFinite(ik.lowerAngle))
})

test('audio cues normalize and local GLB rejects external resources', () => {
  const asset = normalizeMotionAsset({ id:'audio', nameZh:'音效', nameEn:'Audio', durationMs:1000, audioCues:[{id:'cue',timeMs:1200,kind:'tone',frequency:99999,volume:2}] }).asset
  assert.deepEqual(asset.audioCues.map(cue => [cue.timeMs,cue.frequency,cue.volume]), [[1000,4000,1]])
  const json = JSON.stringify({ asset:{version:'2.0'}, buffers:[{uri:'remote.bin'}] })
  const padded = json.padEnd(Math.ceil(json.length/4)*4, ' ')
  const total = 20 + padded.length
  const buffer = new ArrayBuffer(total); const view = new DataView(buffer); const bytes = new Uint8Array(buffer)
  bytes.set(new TextEncoder().encode('glTF'),0); view.setUint32(4,2,true); view.setUint32(8,total,true); view.setUint32(12,padded.length,true); view.setUint32(16,0x4E4F534A,true); bytes.set(new TextEncoder().encode(padded),20)
  const result = validateLocalGlb(buffer)
  assert.equal(result.valid, false)
  assert.ok(result.diagnostics.includes('external-uri-forbidden'))
  const embeddedJson = JSON.stringify({ asset:{version:'2.0'}, images:[{uri:'data:image/png;base64,AA=='}] })
  const embeddedPadded = embeddedJson.padEnd(Math.ceil(embeddedJson.length/4)*4, ' ')
  const embeddedTotal = 20 + embeddedPadded.length
  const embeddedBuffer = new ArrayBuffer(embeddedTotal); const embeddedView = new DataView(embeddedBuffer); const embeddedBytes = new Uint8Array(embeddedBuffer)
  embeddedBytes.set(new TextEncoder().encode('glTF'),0); embeddedView.setUint32(4,2,true); embeddedView.setUint32(8,embeddedTotal,true); embeddedView.setUint32(12,embeddedPadded.length,true); embeddedView.setUint32(16,0x4E4F534A,true); embeddedBytes.set(new TextEncoder().encode(embeddedPadded),20)
  assert.equal(validateLocalGlb(embeddedBuffer).valid, true)
})
