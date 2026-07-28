/**
 * 文件职责 / File responsibility
 * 定义可复制的只读 Studio 长编排动作，以语义关键帧组合舞蹈、武术、体操、冲刺和内置道具事件。
 * Defines copyable long-form Studio choreography using semantic keyframes for dance, martial arts, gymnastics, sprinting, and built-in props.
 */
import {
  createStudioMotionAsset,
  type CloudFoxRigChannelId,
  type MotionPropEvent,
  type MotionPropEventTrack,
  type MotionTrack,
  type StudioMotionAssetV2,
} from '@yk-pets/pet-core'
import { BASIC_BIPED_STUDIO_MOTIONS } from './studio-basic-biped-motions'

type Point = readonly [timeMs: number, value: number]
type NormalizedPoint = readonly [progress: number, value: number]

function track(channelId: CloudFoxRigChannelId, points: readonly Point[]): MotionTrack {
  return {
    id: `track-${channelId}`,
    layerId: 'base',
    channelId,
    muted: false,
    keyframes: points.map(([timeMs, value], index) => ({
      id: `key-${channelId.replaceAll('.', '-')}-${timeMs}-${index}`,
      timeMs,
      value,
      interpolation: 'smooth',
    })),
  }
}

function phraseTrack(channelId: CloudFoxRigChannelId, durationMs: number, points: readonly NormalizedPoint[]) {
  return track(channelId, points.map(([progress, value]) => [Math.round(durationMs * progress), value]))
}

function beatTrack(channelId: CloudFoxRigChannelId, durationMs: number, values: readonly number[]) {
  const lastIndex = Math.max(1, values.length - 1)
  return phraseTrack(channelId, durationMs, values.map((value, index) => [index / lastIndex, value]))
}

function propTrack(
  propId: string,
  instanceId: string,
  durationMs: number,
  mountId: 'left-front-paw' | 'right-front-paw',
  accents: readonly number[],
): MotionPropEventTrack {
  const accentEvents: MotionPropEvent[] = accents.map((progress, index) => ({
    id: `${instanceId}-accent-${index}`,
    timeMs: Math.round(durationMs * progress),
    kind: 'style',
    style: { glow: index % 2 === 0 ? 2.8 : 1.5, opacity: 1, particleRate: index % 2 === 0 ? 22 : 8 },
  }))
  return {
    id: `prop-track-${instanceId}`,
    instanceId,
    propId,
    events: [
      { id: `${instanceId}-create`, timeMs: 0, kind: 'create' },
      { id: `${instanceId}-attach`, timeMs: 0, kind: 'attach', mountId, space: 'mount', transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } },
      ...accentEvents,
      { id: `${instanceId}-destroy`, timeMs: durationMs, kind: 'destroy' },
    ],
  }
}

function motion(input: Pick<StudioMotionAssetV2, 'id' | 'nameZh' | 'nameEn' | 'durationMs' | 'loopMode'> & { tracks: MotionTrack[]; propIds?: string[]; propEventTracks?: MotionPropEventTrack[] }) {
  return createStudioMotionAsset({ ...input, displayFps: 30, propIds: input.propIds || [], propEventTracks: input.propEventTracks || [], createdAt: 1, updatedAt: 1 })
}

const energeticDuration = 8000
const energeticStep = motion({
  id: 'builtin-energetic-step', nameZh: '元气踏步舞', nameEn: 'Energetic Step', durationMs: energeticDuration, loopMode: 'loop',
  tracks: [
    beatTrack('root.position.x', energeticDuration, [0, -.18, -.42, -.2, .18, .42, .18, 0, -.3, 0, .3, 0, -.38, -.12, .38, .12, 0]),
    beatTrack('root.position.y', energeticDuration, [0, .08, .28, .06, 0, .1, .3, .08, 0, .14, .34, .08, 0, .18, .42, .12, 0]),
    beatTrack('root.rotation.y', energeticDuration, [0, -.08, -.2, -.08, .08, .2, .08, 0, -.28, 0, .28, 0, -.45, 0, .45, .12, 0]),
    beatTrack('body.rotation.z', energeticDuration, [0, .1, .22, .08, -.12, -.24, -.08, 0, .2, -.12, -.22, .12, .3, -.18, -.3, .14, 0]),
    beatTrack('body.rotation.y', energeticDuration, [0, -.12, -.3, -.1, .14, .32, .1, 0, -.36, .18, .38, -.18, -.42, .2, .44, -.12, 0]),
    beatTrack('head.rotation.z', energeticDuration, [0, -.08, -.16, -.05, .1, .18, .05, 0, -.18, .1, .2, -.08, -.24, .12, .25, -.1, 0]),
    beatTrack('head.rotation.y', energeticDuration, [0, .1, .22, .08, -.12, -.24, -.08, 0, .28, -.14, -.3, .14, .34, -.18, -.35, .12, 0]),
    beatTrack('frontPaw.left.rotation.z', energeticDuration, [0, -.35, -.9, -.45, .35, .85, .4, 0, -1.15, -.25, .8, .15, -1.3, -.35, .95, .2, 0]),
    beatTrack('frontPaw.right.rotation.z', energeticDuration, [0, .45, .9, .35, -.4, -.85, -.35, 0, .7, .2, -1.15, -.2, .95, .3, -1.3, -.15, 0]),
    beatTrack('hindPaw.left.rotation.z', energeticDuration, [0, .15, .38, .08, -.12, -.32, -.08, 0, .3, -.08, -.3, .08, .36, .1, -.36, -.08, 0]),
    beatTrack('hindPaw.right.rotation.z', energeticDuration, [0, -.12, -.32, -.08, .15, .38, .08, 0, -.28, .08, .3, -.08, -.34, -.1, .36, .08, 0]),
    beatTrack('tail.root.rotation.z', energeticDuration, [0, -.18, -.42, -.2, .08, .38, .18, 0, -.5, -.18, .42, .16, -.55, -.2, .52, .2, 0]),
    beatTrack('tail.mid.rotation.z', energeticDuration, [0, -.08, -.28, -.32, -.1, .2, .34, .18, -.2, -.42, .12, .4, .1, -.48, -.12, .38, 0]),
    beatTrack('eye.left.closure', energeticDuration, [0, 0, 0, .75, 0, 0, 0, 0, 0, .9, 0, 0, 0, .85, 0, 0, 0]),
    beatTrack('eye.right.closure', energeticDuration, [0, 0, 0, .75, 0, 0, 0, 0, .85, 0, 0, 0, 0, .85, 0, 0, 0]),
    beatTrack('mouth.curve', energeticDuration, [0, .2, .45, .3, .15, .42, .3, .1, .5, .25, .55, .25, .7, .35, .7, .25, 0]),
  ],
})

const starlightSwayDuration = 10000
const starlightSway = motion({
  id: 'builtin-starlight-sway', nameZh: '星光摆胯舞', nameEn: 'Starlight Sway', durationMs: starlightSwayDuration, loopMode: 'loop',
  propIds: ['builtin-glow-sticks'],
  propEventTracks: [propTrack('builtin-glow-sticks', 'glow-sticks-main', starlightSwayDuration, 'right-front-paw', [.18, .42, .68, .86])],
  tracks: [
    beatTrack('root.position.x', starlightSwayDuration, [0, -.25, -.5, -.22, .22, .5, .24, 0, -.35, -.1, .35, .1, -.42, 0, .42, 0, 0]),
    beatTrack('root.position.y', starlightSwayDuration, [0, .08, .18, .05, .12, .28, .08, 0, .16, .36, .12, .02, .2, .46, .16, .06, 0]),
    beatTrack('root.rotation.y', starlightSwayDuration, [0, -.18, -.4, -.18, .2, .42, .18, 0, -.65, -.25, .65, .25, -1.1, 0, 1.1, .3, 0]),
    beatTrack('body.rotation.z', starlightSwayDuration, [0, .12, .3, .1, -.14, -.32, -.1, 0, .38, -.12, -.4, .12, .48, -.2, -.48, .16, 0]),
    beatTrack('body.rotation.y', starlightSwayDuration, [0, -.16, -.36, -.12, .18, .38, .12, 0, -.5, .18, .52, -.18, -.62, .24, .64, -.2, 0]),
    beatTrack('head.rotation.z', starlightSwayDuration, [0, -.1, -.22, -.08, .12, .24, .08, 0, -.3, .1, .32, -.1, -.34, .14, .36, -.12, 0]),
    beatTrack('frontPaw.left.rotation.z', starlightSwayDuration, [0, -.4, -1.15, -.65, -.15, .5, 1.2, .35, -1.35, -.55, .9, .25, -1.5, -.4, 1.25, .3, 0]),
    beatTrack('frontPaw.right.rotation.z', starlightSwayDuration, [0, .25, .8, 1.2, .55, -.2, -.85, -.45, .75, 1.35, .3, -1.1, .55, 1.5, -.35, -1.2, 0]),
    beatTrack('frontPaw.left.tip.rotation.z', starlightSwayDuration, [0, .2, .8, -.3, -.7, .25, .9, 0, -1.1, .5, 1.2, -.45, -1.35, .7, 1.4, -.5, 0]),
    beatTrack('frontPaw.right.tip.rotation.z', starlightSwayDuration, [0, -.25, -.75, .35, .8, -.25, -.95, 0, 1.15, -.55, -1.25, .5, 1.35, -.75, -1.45, .55, 0]),
    beatTrack('tail.mid.rotation.z', starlightSwayDuration, [0, -.12, -.38, -.46, -.18, .2, .5, .34, -.28, -.58, .12, .6, .22, -.68, -.15, .55, 0]),
    beatTrack('eye.expressionTilt', starlightSwayDuration, [0, .15, .35, .1, -.18, -.38, -.12, 0, .45, -.15, -.48, .15, .62, -.2, -.62, .2, 0]),
    beatTrack('mouth.curve', starlightSwayDuration, [0, .2, .45, .25, .15, .4, .3, .1, .5, .3, .58, .25, .72, .4, .75, .3, 0]),
    beatTrack('antenna.glow', starlightSwayDuration, [0, .15, .85, .25, .1, .75, .2, 0, .95, .25, .8, .18, 1, .3, .9, .2, 0]),
    beatTrack('nose.glow', starlightSwayDuration, [0, 0, .55, .1, 0, .4, .05, 0, .7, .1, .5, .05, .8, .15, .65, .05, 0]),
  ],
})

const horseStancePunch = motion({
  id: 'builtin-horse-stance-punch', nameZh: '马步组合拳', nameEn: 'Horse Stance Combination', durationMs: 8400, loopMode: 'once',
  tracks: [
    track('root.position.y', [[0, 0], [700, -.08], [1300, -.42], [2500, -.42], [3600, -.44], [4700, -.4], [6100, -.46], [7000, -.42], [7900, -.15], [8400, 0]]),
    track('root.position.x', [[0, 0], [1300, -.18], [2500, -.08], [3600, .08], [4700, -.08], [6100, .16], [7000, .05], [8400, 0]]),
    track('body.rotation.y', [[0, 0], [900, -.18], [1700, -.4], [2200, .18], [2750, .42], [3300, -.18], [3900, -.46], [4700, .35], [5400, -.38], [5900, -.65], [6250, .58], [6900, .22], [7800, -.12], [8400, 0]]),
    track('body.rotation.z', [[0, 0], [1300, .08], [2500, -.12], [3600, .12], [4700, -.15], [6100, .18], [7000, -.08], [8400, 0]]),
    track('head.rotation.y', [[0, 0], [900, .28], [1700, .45], [2200, -.3], [2750, -.45], [3300, .32], [3900, .48], [4700, -.4], [5400, .45], [6250, -.55], [7000, -.2], [8400, 0]]),
    track('frontPaw.left.rotation.z', [[0, 0], [700, -.45], [1300, -.9], [1900, -1.2], [2200, -.15], [2500, -.7], [3300, -1.1], [3900, -.25], [4700, -1.25], [5400, -.5], [6100, -1.1], [7000, -.65], [7900, -.25], [8400, 0]]),
    track('frontPaw.right.rotation.z', [[0, 0], [700, .45], [1300, .9], [1900, .35], [2500, 1.25], [2750, .18], [3300, .8], [3900, 1.3], [4700, .25], [5400, 1.15], [5900, .3], [6250, 1.5], [7000, .7], [7900, .25], [8400, 0]]),
    track('frontPaw.left.length', [[0, 0], [1800, 0], [2200, .38], [2450, .28], [2750, 0], [3650, 0], [3900, .42], [4300, .25], [4700, 0], [5800, 0], [6250, .48], [6650, .22], [7000, 0], [8400, 0]]),
    track('frontPaw.right.length', [[0, 0], [2200, 0], [2500, .4], [2900, .25], [3300, 0], [4400, 0], [4700, .44], [5050, .24], [5400, 0], [5900, 0], [6250, .52], [6700, .24], [7000, 0], [8400, 0]]),
    track('hindPaw.left.rotation.z', [[0, 0], [1300, .48], [2500, .42], [3600, .5], [4700, .42], [6100, .55], [7000, .4], [8400, 0]]),
    track('hindPaw.right.rotation.z', [[0, 0], [1300, -.48], [2500, -.42], [3600, -.5], [4700, -.42], [6100, -.55], [7000, -.4], [8400, 0]]),
    track('eye.expressionTilt', [[0, 0], [700, -.25], [1300, -.65], [2500, -.8], [3900, -.7], [4700, -.85], [6100, -1], [7000, -.55], [7900, -.2], [8400, 0]]),
    track('eye.gaze.x', [[0, 0], [900, -.35], [1900, -.7], [2450, .75], [3300, -.75], [4450, .8], [5600, -.6], [6200, .9], [7000, .2], [8400, 0]]),
    track('tail.root.rotation.z', [[0, 0], [1300, -.35], [2200, .28], [2750, -.25], [3900, .35], [4700, -.4], [5400, .3], [6250, -.55], [7000, .28], [8400, 0]]),
    track('mouth.curve', [[0, 0], [1300, -.15], [2500, -.35], [3900, -.4], [4700, -.5], [6250, -.65], [7000, -.2], [8400, 0]]),
  ],
})

const staffSpinDuration = 12000
const nebulaStaffSpin = motion({
  id: 'builtin-nebula-staff-spin', nameZh: '星云棍术组合', nameEn: 'Nebula Staff Combination', durationMs: staffSpinDuration, loopMode: 'once',
  propIds: ['builtin-nebula-staff'],
  propEventTracks: [propTrack('builtin-nebula-staff', 'nebula-staff-main', staffSpinDuration, 'right-front-paw', [.19, .43, .66, .82])],
  tracks: [
    track('root.position.x', [[0, 0], [900, -.25], [2100, -.4], [3200, -.1], [4300, .35], [5400, .15], [6500, -.3], [7600, .1], [8700, .55], [9800, .2], [10800, 0], [12000, 0]]),
    track('root.position.y', [[0, 0], [900, -.12], [2100, .12], [3200, 0], [4300, .18], [5400, -.1], [6500, .22], [7600, 0], [8700, .55], [9300, .95], [9800, -.18], [10800, .08], [12000, 0]]),
    track('root.rotation.y', [[0, 0], [900, -.25], [2100, .35], [3200, 1.1], [4300, 2.1], [5400, 2.7], [6500, 3.4], [7600, 4.6], [8700, 5.5], [9300, 6.05], [9800, 6.28], [10800, 6.28], [12000, 6.28]]),
    track('body.rotation.z', [[0, 0], [900, -.18], [2100, .24], [3200, -.3], [4300, .32], [5400, -.35], [6500, .38], [7600, -.4], [8700, .28], [9300, -.22], [9800, .35], [10800, -.12], [12000, 0]]),
    track('body.rotation.y', [[0, 0], [900, .25], [2100, -.45], [3200, .55], [4300, -.65], [5400, .75], [6500, -.85], [7600, .9], [8700, -.7], [9300, .55], [9800, -.6], [10800, .2], [12000, 0]]),
    track('head.rotation.y', [[0, 0], [900, .35], [2100, -.55], [3200, .65], [4300, -.75], [5400, .8], [6500, -.9], [7600, .85], [8700, -.65], [9300, .6], [9800, -.7], [10800, .25], [12000, 0]]),
    track('frontPaw.left.rotation.x', [[0, 0], [900, -.5], [2100, .9], [3200, -.85], [4300, .95], [5400, -1], [6500, .8], [7600, -.9], [8700, 1.1], [9300, -.65], [9800, -1.2], [10800, -.35], [12000, 0]]),
    track('frontPaw.right.rotation.x', [[0, 0], [900, .75], [2100, -.95], [3200, 1.05], [4300, -1.1], [5400, 1.15], [6500, -.9], [7600, 1.05], [8700, -.85], [9300, 1.2], [9800, .35], [10800, .45], [12000, 0]]),
    track('frontPaw.left.rotation.z', [[0, 0], [900, -.8], [2100, -.2], [3200, .65], [4300, -.75], [5400, .7], [6500, -.9], [7600, .8], [8700, -.55], [9300, -1.2], [9800, -.4], [10800, -.8], [12000, 0]]),
    track('frontPaw.right.rotation.z', [[0, 0], [900, .8], [2100, .25], [3200, -.7], [4300, .8], [5400, -.75], [6500, .95], [7600, -.85], [8700, .6], [9300, 1.25], [9800, .45], [10800, .85], [12000, 0]]),
    track('frontPaw.right.tip.rotation.z', [[0, 0], [900, .4], [1500, 2.2], [2100, 4.4], [2700, 6.1], [3200, 4.8], [3800, 2.3], [4300, 0], [4900, -2.2], [5400, -4.5], [6000, -6.1], [6500, -3.4], [7100, 0], [7600, 3.1], [8200, 6.2], [8700, 4], [9300, 1.2], [9800, -1.8], [10800, -.5], [12000, 0]]),
    track('hindPaw.left.rotation.z', [[0, 0], [900, .35], [2100, -.2], [3200, .42], [4300, -.35], [5400, .5], [6500, -.4], [7600, .48], [8700, -.3], [9300, -.55], [9800, .45], [10800, .2], [12000, 0]]),
    track('hindPaw.right.rotation.z', [[0, 0], [900, -.35], [2100, .2], [3200, -.42], [4300, .35], [5400, -.5], [6500, .4], [7600, -.48], [8700, .3], [9300, .55], [9800, -.45], [10800, -.2], [12000, 0]]),
    track('tail.tip.rotation.z', [[0, 0], [900, -.25], [2100, .45], [3200, -.55], [4300, .6], [5400, -.65], [6500, .7], [7600, -.72], [8700, .62], [9300, -.5], [9800, .75], [10800, -.25], [12000, 0]]),
    track('eye.gaze.x', [[0, 0], [900, .25], [2100, -.5], [3200, .6], [4300, -.7], [5400, .75], [6500, -.8], [7600, .8], [8700, -.65], [9300, .55], [9800, -.75], [10800, .2], [12000, 0]]),
    track('antenna.glow', [[0, 0], [900, .1], [2100, .75], [3200, .2], [4300, .9], [5400, .25], [6500, 1], [7600, .3], [8700, .85], [9300, 1], [9800, .95], [10800, .2], [12000, 0]]),
  ],
})

const cartwheel = motion({
  id: 'builtin-cartwheel', nameZh: '灵巧体操组合', nameEn: 'Agile Gymnastics Combo', durationMs: 8800, loopMode: 'once',
  tracks: [
    track('root.position.x', [[0, -1.6], [600, -1.35], [1200, -1], [1800, -.65], [2500, -.3], [3300, .1], [4000, .45], [4800, .75], [5600, .9], [6400, 1.05], [7200, 1.15], [8000, 1.2], [8800, 1.2]]),
    track('root.position.y', [[0, 0], [600, .08], [1200, 0], [1800, -.25], [2500, .45], [3300, 1.35], [4000, .55], [4800, -.22], [5600, .65], [6200, 1.25], [6800, .18], [7200, -.12], [8000, .08], [8800, 0]]),
    track('root.rotation.z', [[0, 0], [1200, -.08], [1800, -.35], [2500, .35], [3300, 2.9], [4000, 5.7], [4800, 6.28], [5600, 5.9], [6200, 3.2], [6800, .2], [7200, -.12], [8000, -.08], [8800, 0]]),
    track('root.rotation.y', [[0, 0], [1800, -.1], [2500, .2], [3300, -.25], [4000, .18], [4800, 0], [5600, .7], [6200, 3.25], [6800, 6.2], [7200, 6.28], [8000, 6.28], [8800, 6.28]]),
    track('body.rotation.y', [[0, 0], [1200, .15], [1800, -.2], [2500, .45], [3300, -.65], [4000, .7], [4800, -.3], [5600, .5], [6200, -.8], [6800, .35], [7200, -.15], [8000, .1], [8800, 0]]),
    track('head.rotation.z', [[0, 0], [1200, .08], [1800, .25], [2500, -.4], [3300, -.6], [4000, .55], [4800, -.2], [5600, -.35], [6200, .5], [6800, -.25], [7200, .18], [8000, -.12], [8800, 0]]),
    track('frontPaw.left.rotation.z', [[0, 0], [1200, -.35], [1800, -1.2], [2500, -1.45], [3300, -.7], [4000, .8], [4800, 1.25], [5600, -.9], [6200, -1.35], [6800, .65], [7200, .85], [8000, -.2], [8800, 0]]),
    track('frontPaw.right.rotation.z', [[0, 0], [1200, .3], [1800, -.65], [2500, -1.3], [3300, .75], [4000, 1.4], [4800, .55], [5600, .9], [6200, -1.2], [6800, -.7], [7200, .8], [8000, .2], [8800, 0]]),
    track('frontPaw.left.rotation.x', [[0, 0], [1800, -.4], [2500, .8], [3300, -1], [4000, .9], [4800, -.35], [5600, .65], [6200, -.85], [6800, .3], [7200, -.2], [8800, 0]]),
    track('frontPaw.right.rotation.x', [[0, 0], [1800, .35], [2500, -.75], [3300, .95], [4000, -.9], [4800, .4], [5600, -.6], [6200, .9], [6800, -.35], [7200, .2], [8800, 0]]),
    track('hindPaw.left.rotation.z', [[0, 0], [1200, .25], [1800, -.35], [2500, -.85], [3300, .95], [4000, -.7], [4800, .45], [5600, -.8], [6200, .9], [6800, -.5], [7200, .6], [8000, .2], [8800, 0]]),
    track('hindPaw.right.rotation.z', [[0, 0], [1200, -.25], [1800, .35], [2500, .85], [3300, -.95], [4000, .7], [4800, -.45], [5600, .8], [6200, -.9], [6800, .5], [7200, -.6], [8000, -.2], [8800, 0]]),
    track('tail.mid.rotation.z', [[0, 0], [1200, -.18], [1800, .32], [2500, -.55], [3300, .72], [4000, -.68], [4800, .6], [5600, -.72], [6200, .8], [6800, -.55], [7200, .62], [8000, -.2], [8800, 0]]),
    track('tail.tip.rotation.y', [[0, 0], [1800, -.25], [2500, .5], [3300, -.65], [4000, .75], [4800, -.55], [5600, .65], [6200, -.75], [6800, .5], [7200, -.35], [8800, 0]]),
    track('eye.scale', [[0, 0], [1200, .1], [1800, .25], [2500, .45], [4800, .35], [5600, .5], [6800, .3], [7200, .15], [8000, .05], [8800, 0]]),
    track('mouth.open', [[0, 0], [1200, .1], [1800, .25], [3300, .35], [4800, .15], [5600, .4], [6800, .55], [7200, .15], [8000, .05], [8800, 0]]),
  ],
})

const sprintStop = motion({
  id: 'builtin-sprint-stop', nameZh: '冲刺急停挑战', nameEn: 'Sprint Stop Challenge', durationMs: 9200, loopMode: 'once',
  tracks: [
    track('root.position.x', [[0, -3], [700, -2.95], [1400, -2.7], [2100, -2.2], [2800, -1.45], [3500, -.5], [4200, .55], [4900, 1.55], [5600, 2.35], [6300, 2.85], [7000, 3.05], [7600, 3.12], [8300, 3.12], [9200, 3.12]]),
    track('root.position.y', [[0, 0], [700, -.18], [1050, .08], [1400, 0], [1750, .15], [2100, 0], [2450, .2], [2800, 0], [3150, .22], [3500, 0], [3850, .24], [4200, 0], [4550, .22], [4900, 0], [5250, .18], [5600, 0], [6300, -.12], [7000, -.28], [7600, -.1], [8300, .06], [9200, 0]]),
    track('body.rotation.z', [[0, -.38], [700, -.48], [1400, -.42], [2100, -.35], [2800, -.28], [3500, -.22], [4200, -.18], [4900, -.14], [5600, -.1], [6300, .12], [7000, .48], [7600, .2], [8300, -.08], [9200, 0]]),
    track('body.rotation.y', [[0, 0], [1400, -.15], [2100, .16], [2800, -.18], [3500, .2], [4200, -.22], [4900, .24], [5600, -.18], [6300, .28], [7000, -.55], [7600, .35], [8300, -.18], [9200, 0]]),
    track('head.rotation.z', [[0, .12], [1400, .18], [2800, .1], [4200, .05], [5600, 0], [6300, -.15], [7000, -.4], [7600, .25], [8300, -.2], [9200, 0]]),
    track('frontPaw.left.rotation.z', [[0, -.4], [350, -.75], [700, .75], [1050, -.9], [1400, .9], [1750, -1.05], [2100, 1.05], [2450, -1.15], [2800, 1.15], [3150, -1.2], [3500, 1.2], [3850, -1.25], [4200, 1.25], [4550, -1.3], [4900, 1.3], [5250, -1.35], [5600, 1.35], [6300, -.4], [7000, -1.25], [7600, -.55], [8300, -.15], [9200, 0]]),
    track('frontPaw.right.rotation.z', [[0, .4], [350, .75], [700, -.75], [1050, .9], [1400, -.9], [1750, 1.05], [2100, -1.05], [2450, 1.15], [2800, -1.15], [3150, 1.2], [3500, -1.2], [3850, 1.25], [4200, -1.25], [4550, 1.3], [4900, -1.3], [5250, 1.35], [5600, -1.35], [6300, .4], [7000, 1.25], [7600, .55], [8300, .15], [9200, 0]]),
    track('hindPaw.left.rotation.z', [[0, .2], [700, -.35], [1400, .45], [2100, -.55], [2800, .65], [3500, -.72], [4200, .78], [4900, -.82], [5600, .85], [6300, -.3], [7000, .72], [7600, .25], [8300, .08], [9200, 0]]),
    track('hindPaw.right.rotation.z', [[0, -.2], [700, .35], [1400, -.45], [2100, .55], [2800, -.65], [3500, .72], [4200, -.78], [4900, .82], [5600, -.85], [6300, .3], [7000, -.72], [7600, -.25], [8300, -.08], [9200, 0]]),
    track('tail.root.rotation.z', [[0, -.25], [700, .35], [1400, -.42], [2100, .48], [2800, -.55], [3500, .6], [4200, -.65], [4900, .68], [5600, -.72], [6300, .3], [7000, 1], [7600, -.55], [8300, .22], [9200, 0]]),
    track('tail.mid.rotation.z', [[0, -.1], [700, -.35], [1400, .4], [2100, -.45], [2800, .52], [3500, -.58], [4200, .62], [4900, -.65], [5600, .7], [6300, -.25], [7000, .85], [7600, -.72], [8300, .3], [9200, 0]]),
    track('ear.left.rotation.z', [[0, .15], [1400, .22], [2800, .28], [4200, .32], [5600, .35], [6300, -.1], [7000, -.55], [7600, .38], [8300, -.18], [9200, 0]]),
    track('ear.right.rotation.z', [[0, -.15], [1400, -.22], [2800, -.28], [4200, -.32], [5600, -.35], [6300, .1], [7000, .55], [7600, -.38], [8300, .18], [9200, 0]]),
    track('eye.expressionTilt', [[0, -.45], [1400, -.55], [2800, -.65], [4200, -.72], [5600, -.8], [6300, -.5], [7000, .7], [7600, .35], [8300, -.1], [9200, 0]]),
    track('eye.gaze.x', [[0, .55], [1400, .65], [2800, .75], [4200, .8], [5600, .85], [6300, .5], [7000, -.65], [7600, -.8], [8300, -.35], [9200, 0]]),
    track('mouth.open', [[0, .08], [1400, .12], [2800, .18], [4200, .24], [5600, .32], [6300, .45], [7000, .65], [7600, .28], [8300, .12], [9200, 0]]),
  ],
})

export const BUILT_IN_STUDIO_MOTIONS: readonly StudioMotionAssetV2[] = Object.freeze([
  ...BASIC_BIPED_STUDIO_MOTIONS,
  energeticStep, starlightSway, horseStancePunch, nebulaStaffSpin, cartwheel, sprintStop,
])

export function getBuiltInStudioMotion(id: string) {
  return BUILT_IN_STUDIO_MOTIONS.find(item => item.id === id)
}
