/**
 * 文件职责 / File responsibility
 * 生成新手可一键复制的五个双足萌宠基础动作，并保留接触与事件候选元数据。
 */

import {
  createStudioMotionAsset,
  type CloudFoxRigChannelId,
  type MotionTrack,
  type StudioMotionAssetV2,
  type StudioMotionLoopMode,
} from '@yk-pets/pet-core'

export type BasicBipedMotionTemplateId = 'idle' | 'walk' | 'jump' | 'wave' | 'straight-punch'
export type BasicBipedMotionEmotion = 'gentle' | 'cheerful' | 'focused'

export interface BasicBipedMotionOptions {
  speed?: number
  strength?: number
  amplitude?: number
  emotion?: BasicBipedMotionEmotion
  loopMode?: StudioMotionLoopMode
}

type Point = readonly [progress: number, value: number]
type TrackSpec = readonly [channelId: CloudFoxRigChannelId, points: readonly Point[]]

interface TemplateDefinition {
  id: `builtin-biped-${string}`
  nameZh: string
  nameEn: string
  durationMs: number
  loopMode: StudioMotionLoopMode
  tracks: readonly TrackSpec[]
  contacts?: readonly { contactId: 'foot.left' | 'foot.right', start: number, end: number, confidence: number }[]
  events?: readonly { id: string, kind: 'takeoff' | 'landing' | 'wave-peak' | 'hit', progress: number }[]
}

const clamp = (value: number | undefined, fallback: number, minimum: number, maximum: number) => {
  const finite = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.max(minimum, Math.min(maximum, finite))
}
const emotionScale: Readonly<Record<BasicBipedMotionEmotion, number>> = { gentle: .82, cheerful: 1.08, focused: 1 }

const templates: Readonly<Record<BasicBipedMotionTemplateId, TemplateDefinition>> = {
  idle: {
    id: 'builtin-biped-idle', nameZh: '待机呼吸', nameEn: 'Idle Breathing', durationMs: 3600, loopMode: 'loop',
    tracks: [
      ['root.position.y', [[0, 0], [.25, .07], [.5, 0], [.75, -.035], [1, 0]]],
      ['body.rotation.x', [[0, 0], [.25, -.055], [.5, 0], [.75, .035], [1, 0]]],
      ['head.rotation.x', [[0, 0], [.25, .035], [.5, 0], [.75, -.025], [1, 0]]],
      ['frontPaw.left.rotation.z', [[0, 0], [.25, -.04], [.5, 0], [.75, .025], [1, 0]]],
      ['frontPaw.right.rotation.z', [[0, 0], [.25, .04], [.5, 0], [.75, -.025], [1, 0]]],
      ['tail.root.rotation.z', [[0, 0], [.25, .09], [.5, 0], [.75, -.09], [1, 0]]],
      ['ear.left.rotation.z', [[0, 0], [.5, .035], [1, 0]]],
      ['ear.right.rotation.z', [[0, 0], [.5, -.035], [1, 0]]],
    ],
  },
  walk: {
    id: 'builtin-biped-walk', nameZh: '行走循环', nameEn: 'Walk Cycle', durationMs: 1200, loopMode: 'loop',
    contacts: [
      { contactId: 'foot.left', start: 0, end: .48, confidence: .9 },
      { contactId: 'foot.right', start: .5, end: .98, confidence: .9 },
    ],
    tracks: [
      ['root.position.y', [[0, 0], [.25, .08], [.5, 0], [.75, .08], [1, 0]]],
      ['body.rotation.z', [[0, -.08], [.25, 0], [.5, .08], [.75, 0], [1, -.08]]],
      ['head.rotation.z', [[0, .04], [.25, 0], [.5, -.04], [.75, 0], [1, .04]]],
      ['frontPaw.left.rotation.z', [[0, -.65], [.5, .65], [1, -.65]]],
      ['frontPaw.right.rotation.z', [[0, .65], [.5, -.65], [1, .65]]],
      ['hindPaw.left.rotation.x', [[0, .7], [.5, -.55], [1, .7]]],
      ['hindPaw.right.rotation.x', [[0, -.55], [.5, .7], [1, -.55]]],
      ['tail.root.rotation.z', [[0, .2], [.5, -.2], [1, .2]]],
    ],
  },
  jump: {
    id: 'builtin-biped-jump', nameZh: '起跳与落地', nameEn: 'Jump and Landing', durationMs: 2400, loopMode: 'once',
    events: [
      { id: 'jump-takeoff', kind: 'takeoff', progress: .3 },
      { id: 'jump-landing', kind: 'landing', progress: .76 },
    ],
    tracks: [
      ['root.position.y', [[0, 0], [.18, -.28], [.3, .05], [.5, 1.15], [.7, .35], [.76, -.25], [.88, .08], [1, 0]]],
      ['body.rotation.x', [[0, 0], [.18, .24], [.3, -.18], [.5, -.08], [.76, .28], [1, 0]]],
      ['head.rotation.x', [[0, 0], [.18, -.12], [.3, .1], [.76, -.16], [1, 0]]],
      ['frontPaw.left.rotation.z', [[0, 0], [.18, -.45], [.42, -1.1], [.7, -.75], [.82, -.25], [1, 0]]],
      ['frontPaw.right.rotation.z', [[0, 0], [.18, .45], [.42, 1.1], [.7, .75], [.82, .25], [1, 0]]],
      ['hindPaw.left.rotation.x', [[0, 0], [.18, 1.1], [.32, -.35], [.65, -.65], [.76, 1.25], [1, 0]]],
      ['hindPaw.right.rotation.x', [[0, 0], [.18, 1.1], [.32, -.35], [.65, -.65], [.76, 1.25], [1, 0]]],
      ['tail.root.rotation.x', [[0, 0], [.3, -.35], [.5, .25], [.76, -.45], [1, 0]]],
    ],
  },
  wave: {
    id: 'builtin-biped-wave', nameZh: '招手', nameEn: 'Friendly Wave', durationMs: 3200, loopMode: 'once',
    events: [
      { id: 'wave-peak-1', kind: 'wave-peak', progress: .43 },
      { id: 'wave-peak-2', kind: 'wave-peak', progress: .59 },
    ],
    tracks: [
      ['root.position.y', [[0, 0], [.18, .04], [.72, .04], [1, 0]]],
      ['body.rotation.z', [[0, 0], [.18, -.08], [.72, -.08], [1, 0]]],
      ['head.rotation.z', [[0, 0], [.22, .12], [.72, .08], [1, 0]]],
      ['frontPaw.left.rotation.z', [[0, 0], [.22, -.18], [.72, -.15], [1, 0]]],
      ['frontPaw.right.rotation.z', [[0, 0], [.22, 1.35], [.72, 1.35], [.9, .45], [1, 0]]],
      ['frontPaw.right.tip.rotation.z', [[0, 0], [.3, -.35], [.43, .55], [.51, -.55], [.59, .55], [.67, -.3], [.8, 0], [1, 0]]],
      ['tail.root.rotation.z', [[0, 0], [.22, -.2], [.45, .25], [.65, -.18], [1, 0]]],
    ],
  },
  'straight-punch': {
    id: 'builtin-biped-straight-punch', nameZh: '直拳组合', nameEn: 'Straight Punch Combo', durationMs: 4000, loopMode: 'once',
    contacts: [
      { contactId: 'foot.left', start: .12, end: .9, confidence: .78 },
      { contactId: 'foot.right', start: .12, end: .9, confidence: .82 },
    ],
    events: [
      { id: 'lead-hit', kind: 'hit', progress: .44 },
      { id: 'rear-hit', kind: 'hit', progress: .68 },
    ],
    tracks: [
      ['root.position.y', [[0, 0], [.14, -.12], [.82, -.12], [1, 0]]],
      ['root.position.x', [[0, 0], [.35, -.08], [.44, .12], [.56, -.08], [.68, .18], [.82, 0], [1, 0]]],
      ['body.rotation.y', [[0, 0], [.2, -.3], [.4, .22], [.48, -.15], [.62, -.45], [.68, .5], [.8, .12], [1, 0]]],
      ['head.rotation.y', [[0, 0], [.2, .15], [.44, -.12], [.68, -.2], [.82, 0], [1, 0]]],
      ['frontPaw.left.rotation.z', [[0, 0], [.2, -1], [.4, -.3], [.44, -1.35], [.55, -.8], [.8, -.65], [1, 0]]],
      ['frontPaw.right.rotation.z', [[0, 0], [.2, 1], [.5, .75], [.62, .3], [.68, 1.45], [.8, .7], [1, 0]]],
      ['frontPaw.left.tip.rotation.x', [[0, 0], [.4, -.2], [.44, .35], [.55, 0], [1, 0]]],
      ['frontPaw.right.tip.rotation.x', [[0, 0], [.62, .2], [.68, -.4], [.8, 0], [1, 0]]],
      ['hindPaw.left.rotation.x', [[0, 0], [.2, .35], [.68, .42], [1, 0]]],
      ['hindPaw.right.rotation.x', [[0, 0], [.2, .42], [.68, .55], [1, 0]]],
      ['tail.root.rotation.z', [[0, 0], [.4, .28], [.68, -.42], [.82, .18], [1, 0]]],
    ],
  },
}

function makeTrack(channelId: CloudFoxRigChannelId, points: readonly Point[], durationMs: number, valueScale: number): MotionTrack {
  return {
    id: `track-${channelId}`,
    layerId: 'base',
    channelId,
    muted: false,
    keyframes: points.map(([progress, value], index) => ({
      id: `key-${channelId.replaceAll('.', '-')}-${index}`,
      timeMs: Math.round(durationMs * progress),
      value: value * valueScale,
      interpolation: 'smooth',
    })),
  }
}

export function createBasicBipedStudioMotion(templateId: BasicBipedMotionTemplateId, options: BasicBipedMotionOptions = {}): StudioMotionAssetV2 {
  const template = templates[templateId]
  const speed = clamp(options.speed, 1, .5, 2)
  const strength = clamp(options.strength, 1, .6, 1.5)
  const amplitude = clamp(options.amplitude, 1, .6, 1.5)
  const emotion = options.emotion && options.emotion in emotionScale ? options.emotion : 'cheerful'
  const durationMs = Math.round(template.durationMs / speed)
  const valueScale = strength * amplitude * emotionScale[emotion]
  const metadata = {
    contacts: (template.contacts || []).map(item => ({
      contactId: item.contactId,
      startMs: Math.round(durationMs * item.start),
      endMs: Math.round(durationMs * item.end),
      confidence: item.confidence,
    })),
    events: (template.events || []).map(item => ({
      id: item.id,
      kind: item.kind,
      timeMs: Math.round(durationMs * item.progress),
    })),
  }
  return createStudioMotionAsset({
    id: template.id,
    nameZh: template.nameZh,
    nameEn: template.nameEn,
    durationMs,
    displayFps: 30,
    loopMode: options.loopMode ?? template.loopMode,
    tracks: template.tracks.map(([channelId, points]) => makeTrack(channelId, points, durationMs, valueScale)),
    propIds: [],
    propEventTracks: [],
    extensions: { 'yk-pets/biped-motion/v1': metadata },
    createdAt: 1,
    updatedAt: 1,
  })
}

export const BASIC_BIPED_STUDIO_MOTIONS: readonly StudioMotionAssetV2[] = Object.freeze([
  createBasicBipedStudioMotion('idle'),
  createBasicBipedStudioMotion('walk'),
  createBasicBipedStudioMotion('jump'),
  createBasicBipedStudioMotion('wave'),
  createBasicBipedStudioMotion('straight-punch'),
])
