import assert from 'node:assert/strict'
import test from 'node:test'
import { Canvas2DPetRenderer, CloudFox2DScene, createCanvas2DRendererFactory, defineYkPets2DElement } from '../src/index.ts'

class FakeContext {
  calls: string[] = []
  globalAlpha = 1
  fillStyle: any = ''
  strokeStyle: any = ''
  lineWidth = 1
  lineCap: any = 'butt'
  lineJoin: any = 'miter'
  shadowBlur = 0
  shadowColor = ''
  font = ''
  textAlign: any = 'start'
  save(){this.calls.push('save')} restore(){this.calls.push('restore')} clearRect(){this.calls.push('clearRect')}
  translate(){this.calls.push('translate')} rotate(){this.calls.push('rotate')} scale(){this.calls.push('scale')}
  beginPath(){this.calls.push('beginPath')} closePath(){this.calls.push('closePath')} moveTo(){this.calls.push('moveTo')}
  lineTo(){this.calls.push('lineTo')} bezierCurveTo(){this.calls.push('bezierCurveTo')} quadraticCurveTo(){this.calls.push('quadraticCurveTo')}
  arc(){this.calls.push('arc')} ellipse(){this.calls.push('ellipse')} fill(){this.calls.push('fill')} stroke(){this.calls.push('stroke')}
  fillText(){this.calls.push('fillText')}
}

test('scene renders a procedural fox without image assets', () => {
  const scene = new CloudFox2DScene()
  const context = new FakeContext()
  scene.update(0.016, { behavior: 'idle' })
  scene.render(context as any, 240, 260, 1)
  assert.ok(context.calls.filter(call => call === 'ellipse').length >= 8)
  assert.ok(context.calls.includes('bezierCurveTo'))
  assert.ok(!context.calls.includes('drawImage'))
})

test('jumping advances scene time and adds transforms', () => {
  const scene = new CloudFox2DScene()
  const context = new FakeContext()
  scene.update(0.2, { behavior: 'jumping' })
  scene.render(context as any, 240, 260, 1)
  assert.equal(scene.state.behavior, 'jumping')
  assert.ok(scene.elapsed > 0)
  assert.ok(context.calls.includes('translate'))
})

test('renderer snapshot and restore preserve state', () => {
  const renderer = new Canvas2DPetRenderer({ autoStart: false })
  renderer.update({ behavior: 'thinking', emotion: 'curious' })
  const snapshot = renderer.snapshot()
  const next = new Canvas2DPetRenderer({ autoStart: false })
  next.restore(snapshot)
  assert.equal(next.snapshot().state?.behavior, 'thinking')
  assert.equal(next.snapshot().state?.emotion, 'curious')
})

test('factory exposes structural 2D renderer contract', () => {
  const factory = createCanvas2DRendererFactory({ autoStart: false })
  assert.equal(factory.kind, '2d')
  assert.equal(factory.create().kind, '2d')
})

test('custom element definition is inert outside a browser', () => {
  assert.equal(defineYkPets2DElement(), null)
})


test('renderer visibility stops and restarts animation intent', () => {
  const context = new FakeContext()
  const canvas = {
    width: 0,
    height: 0,
    hidden: false,
    style: { width: '', height: '', visibility: '' },
    getContext: () => context,
  }
  const renderer = new Canvas2DPetRenderer({ autoStart: false })
  renderer.attachCanvas(canvas as any)
  renderer.setVisible(false)
  assert.equal(canvas.hidden, true)
  assert.equal(canvas.style.visibility, 'hidden')
  renderer.setVisible(true)
  assert.equal(canvas.hidden, false)
  assert.equal(canvas.style.visibility, 'visible')
})
