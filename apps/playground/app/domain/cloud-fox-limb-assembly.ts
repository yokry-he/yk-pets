/*
 * 文件职责 / File responsibility
 * 统一计算简单模型的肩部过渡连接与踝脚父子链，避免渲染组件分别摆放关节两端造成可见断层。
 * Computes simple-model shoulder bridges and ankle-foot chains in one place so render nodes cannot drift apart.
 */

export type CloudFoxLimbVector3 = readonly [number, number, number]

export interface FrontPawConnectionInput {
  bodyCenter: CloudFoxLimbVector3
  bodyRadii: CloudFoxLimbVector3
  shoulderCenter: CloudFoxLimbVector3
  shoulderRadius: number
}

export interface FrontPawConnectionAssembly {
  bodyAnchor: CloudFoxLimbVector3
  shoulderAnchor: CloudFoxLimbVector3
  center: CloudFoxLimbVector3
  localCenter: CloudFoxLimbVector3
  direction: CloudFoxLimbVector3
  length: number
  radius: number
}

export interface HindPawChainInput {
  legLength: number
  baseLegLength: number
  footBasePosition: CloudFoxLimbVector3
  heelDrop: number
}

export interface HindPawChainAssembly {
  legLength: number
  legCenter: CloudFoxLimbVector3
  anklePosition: CloudFoxLimbVector3
  footPositionFromAnkle: CloudFoxLimbVector3
  footCenter: CloudFoxLimbVector3
}

const MINIMUM_SEGMENT_LENGTH = .001
const MINIMUM_LEG_LENGTH = .04
const MINIMUM_RADIUS = .001

const addScaled = (origin: CloudFoxLimbVector3, direction: CloudFoxLimbVector3, scale: number): CloudFoxLimbVector3 => [
  origin[0] + direction[0] * scale,
  origin[1] + direction[1] * scale,
  origin[2] + direction[2] * scale,
]

/**
 * 身体可能是椭球、圆角方体或胶囊；这里用共同的包络半径求出保守锚点。
 * 锚点主动进入身体与肩球内部，使连接在侧视角和动作旋转中仍保持重叠。
 */
export function createFrontPawConnectionAssembly(input: FrontPawConnectionInput): FrontPawConnectionAssembly {
  const bodyRadii: CloudFoxLimbVector3 = [
    Math.max(MINIMUM_RADIUS, Math.abs(input.bodyRadii[0])),
    Math.max(MINIMUM_RADIUS, Math.abs(input.bodyRadii[1])),
    Math.max(MINIMUM_RADIUS, Math.abs(input.bodyRadii[2])),
  ]
  const offset: CloudFoxLimbVector3 = [
    input.shoulderCenter[0] - input.bodyCenter[0],
    input.shoulderCenter[1] - input.bodyCenter[1],
    input.shoulderCenter[2] - input.bodyCenter[2],
  ]
  const shoulderDistance = Math.max(MINIMUM_SEGMENT_LENGTH, Math.hypot(...offset))
  const direction: CloudFoxLimbVector3 = shoulderDistance === MINIMUM_SEGMENT_LENGTH && Math.hypot(...offset) < MINIMUM_SEGMENT_LENGTH
    ? [1, 0, 0]
    : [offset[0] / shoulderDistance, offset[1] / shoulderDistance, offset[2] / shoulderDistance]
  const bodySurfaceDistance = 1 / Math.hypot(
    direction[0] / bodyRadii[0],
    direction[1] / bodyRadii[1],
    direction[2] / bodyRadii[2],
  )
  const shoulderRadius = Math.max(MINIMUM_RADIUS, Math.abs(input.shoulderRadius))
  const radius = Math.max(.025, Math.min(.11, shoulderRadius * .64))
  const bodyPenetration = Math.max(radius * 1.45, bodySurfaceDistance * .13)
  const bodyAnchorDistance = Math.max(0, bodySurfaceDistance - bodyPenetration)
  const shoulderAnchorDistance = Math.max(
    bodyAnchorDistance + MINIMUM_SEGMENT_LENGTH,
    shoulderDistance - shoulderRadius * .52,
  )
  const bodyAnchor = addScaled(input.bodyCenter, direction, bodyAnchorDistance)
  const shoulderAnchor = addScaled(input.bodyCenter, direction, shoulderAnchorDistance)
  const length = Math.max(MINIMUM_SEGMENT_LENGTH, shoulderAnchorDistance - bodyAnchorDistance)
  const center = addScaled(bodyAnchor, direction, length / 2)

  return {
    bodyAnchor,
    shoulderAnchor,
    center,
    localCenter: [
      center[0] - input.shoulderCenter[0],
      center[1] - input.shoulderCenter[1],
      center[2] - input.shoulderCenter[2],
    ],
    direction,
    length,
    radius,
  }
}

/**
 * 腿段以髋部为中心，踝节点固定在圆柱末端；脚掌只保存相对踝节点的偏移。
 * 因此改变腿长或旋转父级时，腿、踝和脚掌会作为一条链同步运动。
 */
export function createHindPawChainAssembly(input: HindPawChainInput): HindPawChainAssembly {
  const legLength = Math.max(MINIMUM_LEG_LENGTH, Math.abs(input.legLength))
  const baseLegLength = Math.max(MINIMUM_LEG_LENGTH, Math.abs(input.baseLegLength))
  const legCenter: CloudFoxLimbVector3 = [0, 0, 0]
  const anklePosition: CloudFoxLimbVector3 = [0, -legLength / 2, 0]
  const footPositionFromAnkle: CloudFoxLimbVector3 = [
    input.footBasePosition[0],
    input.footBasePosition[1] + baseLegLength / 2 - input.heelDrop,
    input.footBasePosition[2],
  ]
  const footCenter: CloudFoxLimbVector3 = [
    anklePosition[0] + footPositionFromAnkle[0],
    anklePosition[1] + footPositionFromAnkle[1],
    anklePosition[2] + footPositionFromAnkle[2],
  ]

  return { legLength, legCenter, anklePosition, footPositionFromAnkle, footCenter }
}
