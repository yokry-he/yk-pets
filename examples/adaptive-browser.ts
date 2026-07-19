import { AdaptiveRendererController, BrowserRuntimeMonitor } from '@yk-pets/pet-runtime-adaptive'
import { createCanvas2DRendererFactory } from '@yk-pets/pet-renderer-canvas2d'
import { createThreeRendererFactory } from '@yk-pets/pet-renderer-three'

const host = document.querySelector('#yk-pets-host')!
const controller = new AdaptiveRendererController({
  '2d': createCanvas2DRendererFactory(),
  '3d': createThreeRendererFactory(),
}, {
  minimumFps: 38,
  degradeVotes: 3,
  recoverVotes: 6,
  switchCooldownMs: 30_000,
})

await controller.mount(host, { now: Date.now(), webglSupported: true })
const monitor = new BrowserRuntimeMonitor()
monitor.start(probe => void controller.recordProbe(probe))
controller.update({ behavior: 'idle', emotion: 'happy' })
