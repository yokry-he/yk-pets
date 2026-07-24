/*
 * 文件职责 / File responsibility
 * 作为 Pet Studio 所有可编辑数值字段的唯一控制注册表，统一默认值、推荐范围、扩展硬范围、步长、所属分区与渲染消费者。
 * Serves as the sole control registry for every editable numeric Pet Studio field, unifying defaults, recommended ranges, hard ranges, steps, sections, and renderer consumers.
 */
export type StudioControlSection = 'face' | 'body' | 'limbs' | 'belly' | 'tail' | 'antenna' | 'glow' | 'symbols'

export interface StudioNumericControlDefinition {
  path: string
  label: string
  section: StudioControlSection
  defaultValue: number
  recommendedRange: readonly [number, number]
  hardRange: readonly [number, number]
  step: number
  rendererConsumer: string
}

const control = (
  path: string,
  label: string,
  section: StudioControlSection,
  defaultValue: number,
  recommendedRange: readonly [number, number],
  hardRange: readonly [number, number],
  step: number,
  rendererConsumer: string,
): StudioNumericControlDefinition => Object.freeze({ path, label, section, defaultValue, recommendedRange, hardRange, step, rendererConsumer })

export const STUDIO_CONTROL_REGISTRY = Object.freeze({
  'proportions.bodyWidth': control('proportions.bodyWidth', '身体宽度', 'body', 1, [.68, 1.42], [.35, 2.2], .01, 'ExtensionCloudFoxBodyShape'),
  'proportions.bodyHeight': control('proportions.bodyHeight', '身体高度', 'body', 1, [.72, 1.46], [.35, 2.2], .01, 'ExtensionCloudFoxBodyShape'),
  'proportions.bodyDepth': control('proportions.bodyDepth', '身体厚度', 'body', 1, [.68, 1.38], [.35, 2.2], .01, 'ExtensionCloudFoxBodyShape'),
  'proportions.headScale': control('proportions.headScale', '头部大小', 'face', 1, [.8, 1.24], [.45, 1.9], .01, 'ExtensionCloudFoxHeadShape'),
  'proportions.limbLength': control('proportions.limbLength', '四肢长度', 'limbs', 1, [.56, 1.08], [.25, 1.9], .01, 'ExtensionCloudFoxBody'),
  'proportions.limbThickness': control('proportions.limbThickness', '四肢粗细', 'limbs', 1, [.72, 1.34], [.3, 2.1], .01, 'ExtensionCloudFoxBody'),
  'proportions.limbSpacing': control('proportions.limbSpacing', '四肢间距', 'limbs', 1, [.78, 1.24], [.35, 1.9], .01, 'ExtensionCloudFoxBody'),
  'proportions.pawScale': control('proportions.pawScale', '爪子大小', 'limbs', 1, [.78, 1.38], [.35, 2.2], .01, 'ExtensionCloudFoxBody'),
  'proportions.earScale': control('proportions.earScale', '耳朵大小', 'face', 1, [.72, 1.34], [.35, 2.1], .01, 'ExtensionCloudFoxHead'),
  'proportions.eyeScale': control('proportions.eyeScale', '眼睛大小', 'face', 1, [.74, 1.38], [.35, 2.1], .01, 'ExtensionCloudFoxEyeShape'),
  'proportions.eyeSpacing': control('proportions.eyeSpacing', '眼睛间距', 'face', 1, [.78, 1.22], [.45, 1.75], .01, 'ExtensionCloudFoxHead'),
  'proportions.tailLength': control('proportions.tailLength', '尾巴整体长度', 'tail', 1, [.72, 1.42], [.3, 2.8], .01, 'ExtensionCloudFoxTail'),
  'proportions.tailWidth': control('proportions.tailWidth', '尾巴整体粗细', 'tail', 1, [.72, 1.38], [.25, 2.3], .01, 'ExtensionCloudFoxTail'),
  'proportions.antennaScale': control('proportions.antennaScale', '触角整体比例', 'antenna', 1, [.7, 1.4], [.2, 2.5], .01, 'ExtensionCloudFoxHead'),

  'frontPawDesign.rootHeight': control('frontPawDesign.rootHeight', '根部上下位置', 'limbs', 0, [-.38, .38], [-.65, .65], .01, 'ExtensionCloudFoxBody'),
  'frontPawDesign.embedDepth': control('frontPawDesign.embedDepth', '根部埋入身体', 'limbs', .06, [.035, .34], [0, .55], .01, 'ExtensionCloudFoxBody'),
  'frontPawDesign.forwardOffset': control('frontPawDesign.forwardOffset', '根部前后位置', 'limbs', .06, [-.18, .28], [-.45, .55], .01, 'ExtensionCloudFoxBody'),
  'frontPawDesign.lateralOffset': control('frontPawDesign.lateralOffset', '根部左右位置', 'limbs', 0, [-.28, .28], [-.65, .65], .01, 'ExtensionCloudFoxBody'),
  'frontPawDesign.outwardAngle': control('frontPawDesign.outwardAngle', '左右张开角度', 'limbs', .06, [-.35, .72], [-1.35, 1.35], .01, 'cloud-fox-limb-motion'),
  'frontPawDesign.forwardAngle': control('frontPawDesign.forwardAngle', '前后摆角', 'limbs', 0, [-.78, .78], [-1.35, 1.35], .01, 'cloud-fox-limb-motion'),
  'frontPawDesign.shoulderScale': control('frontPawDesign.shoulderScale', '肩部大小', 'limbs', 1, [.62, 1.72], [.35, 2.25], .01, 'ExtensionCloudFoxBody'),
  'frontPawDesign.wristScale': control('frontPawDesign.wristScale', '手腕粗细', 'limbs', 1, [.5, 1.62], [.35, 2.25], .01, 'ExtensionCloudFoxBody'),
  'frontPawDesign.palmScale': control('frontPawDesign.palmScale', '爪掌大小', 'limbs', 1, [.52, 1.9], [.35, 2.25], .01, 'ExtensionCloudFoxBody'),
  'frontPawDesign.leftOffsetX': control('frontPawDesign.leftOffsetX', '左爪左右微调', 'limbs', 0, [-.24, .24], [-.65, .65], .01, 'ExtensionCloudFoxBody'),
  'frontPawDesign.leftOffsetY': control('frontPawDesign.leftOffsetY', '左爪上下微调', 'limbs', 0, [-.24, .24], [-.65, .65], .01, 'ExtensionCloudFoxBody'),
  'frontPawDesign.leftOffsetZ': control('frontPawDesign.leftOffsetZ', '左爪前后微调', 'limbs', 0, [-.18, .18], [-.45, .55], .01, 'ExtensionCloudFoxBody'),
  'frontPawDesign.rightOffsetX': control('frontPawDesign.rightOffsetX', '右爪左右微调', 'limbs', 0, [-.24, .24], [-.65, .65], .01, 'ExtensionCloudFoxBody'),
  'frontPawDesign.rightOffsetY': control('frontPawDesign.rightOffsetY', '右爪上下微调', 'limbs', 0, [-.24, .24], [-.65, .65], .01, 'ExtensionCloudFoxBody'),
  'frontPawDesign.rightOffsetZ': control('frontPawDesign.rightOffsetZ', '右爪前后微调', 'limbs', 0, [-.18, .18], [-.45, .55], .01, 'ExtensionCloudFoxBody'),

  'customization.belly.width': control('customization.belly.width', '肚皮宽度', 'belly', 1, [.65, 1.3], [.2, 2], .01, 'ExtensionCloudFoxBellyPatch'),
  'customization.belly.height': control('customization.belly.height', '肚皮高度', 'belly', 1, [.65, 1.25], [.2, 2], .01, 'ExtensionCloudFoxBellyPatch'),
  'customization.belly.offsetX': control('customization.belly.offsetX', '肚皮左右位置', 'belly', 0, [-.36, .36], [-.7, .7], .01, 'ExtensionCloudFoxBellyPatch'),
  'customization.belly.offsetY': control('customization.belly.offsetY', '肚皮上下位置', 'belly', 0, [-.36, .36], [-.7, .7], .01, 'ExtensionCloudFoxBellyPatch'),
  'customization.belly.rotation': control('customization.belly.rotation', '肚皮旋转', 'belly', 0, [-Math.PI, Math.PI], [-Math.PI, Math.PI], .02, 'ExtensionCloudFoxBellyPatch'),
  'customization.belly.softness': control('customization.belly.softness', '肚皮边缘柔和度', 'belly', .72, [0, 1], [0, 1], .01, 'ExtensionCloudFoxBellyPatch'),

  'customization.mouth.offsetX': control('customization.mouth.offsetX', '嘴巴左右位置', 'face', 0, [-.12, .12], [-.35, .35], .01, 'ExtensionCloudFoxFaceCustomization'),
  'customization.mouth.offsetY': control('customization.mouth.offsetY', '嘴巴上下位置', 'face', 0, [-.12, .12], [-.35, .35], .01, 'ExtensionCloudFoxFaceCustomization'),
  'customization.mouth.surfaceOffset': control('customization.mouth.surfaceOffset', '嘴巴表面深度', 'face', .008, [-.012, .04], [-.05, .12], .002, 'ExtensionCloudFoxFaceCustomization'),
  'customization.mouth.width': control('customization.mouth.width', '嘴巴宽度', 'face', 1, [.72, 1.28], [.35, 1.8], .01, 'ExtensionCloudFoxFaceCustomization'),
  'customization.mouth.height': control('customization.mouth.height', '嘴巴高度', 'face', 1, [.72, 1.28], [.35, 1.8], .01, 'ExtensionCloudFoxFaceCustomization'),
  'customization.mouth.rotation': control('customization.mouth.rotation', '嘴巴旋转', 'face', 0, [-.35, .35], [-.8, .8], .01, 'ExtensionCloudFoxFaceCustomization'),
  'customization.mouth.curve': control('customization.mouth.curve', '嘴线曲率', 'face', 1, [.72, 1.28], [.4, 1.8], .01, 'ExtensionCloudFoxFaceCustomization'),
  'customization.mouth.thickness': control('customization.mouth.thickness', '嘴线粗细', 'face', 1, [.72, 1.35], [.5, 2], .01, 'ExtensionCloudFoxFaceCustomization'),
  'customization.mouth.defaultOpen': control('customization.mouth.defaultOpen', '默认开口', 'face', .58, [.35, .82], [.2, 1.2], .01, 'ExtensionCloudFoxFaceCustomization'),
  'customization.mouth.maxOpen': control('customization.mouth.maxOpen', '最大开口', 'face', 1.12, [.86, 1.38], [.4, 2], .01, 'ExtensionCloudFoxFaceCustomization'),
  'customization.mouth.tongueScale': control('customization.mouth.tongueScale', '舌头大小', 'face', 1, [.72, 1.28], [.3, 1.8], .01, 'ExtensionCloudFoxFaceCustomization'),
  'customization.mouth.tongueOffsetY': control('customization.mouth.tongueOffsetY', '舌头上下位置', 'face', 0, [-.08, .08], [-.2, .2], .01, 'ExtensionCloudFoxFaceCustomization'),

  'antennaDesign.spacing': control('antennaDesign.spacing', '触角间距', 'antenna', .48, [.18, .72], [.08, 1.3], .01, 'ExtensionCloudFoxHead'),
  'antennaDesign.length': control('antennaDesign.length', '触角长度', 'antenna', .34, [.2, .8], [.1, 2], .01, 'ExtensionCloudFoxHead'),
  'antennaDesign.thickness': control('antennaDesign.thickness', '触角粗细', 'antenna', .052, [.02, .1], [.008, .22], .002, 'ExtensionCloudFoxHead'),
  'antennaDesign.tilt': control('antennaDesign.tilt', '触角倾斜角度', 'antenna', .24, [-.8, .8], [-1.35, 1.35], .01, 'ExtensionCloudFoxHead'),

  'orbitDesign.radius': control('orbitDesign.radius', '轨道半径', 'glow', 1.36, [1.02, 1.9], [.6, 3], .01, 'ExtensionCloudFoxOrbit'),
  'orbitDesign.verticalScale': control('orbitDesign.verticalScale', '轨道纵向比例', 'glow', .82, [.58, 1.15], [.2, 2], .01, 'ExtensionCloudFoxOrbit'),
  'orbitDesign.tilt': control('orbitDesign.tilt', '轨道倾斜', 'glow', .52, [-1.2, 1.2], [-Math.PI, Math.PI], .02, 'ExtensionCloudFoxOrbit'),
  'orbitDesign.speed': control('orbitDesign.speed', '轨道速度', 'glow', .34, [.05, 1.5], [0, 3.5], .01, 'ExtensionCloudFoxOrbit'),
  'orbitDesign.intensity': control('orbitDesign.intensity', '轨道亮度', 'glow', 1.15, [.15, 3.2], [0, 6], .05, 'ExtensionCloudFoxOrbit'),
  'orbitDesign.particleCount': control('orbitDesign.particleCount', '轨道粒子数', 'glow', 10, [0, 24], [0, 64], 1, 'ExtensionCloudFoxOrbit'),
  'glow.intensity': control('glow.intensity', '发光强度', 'glow', 1, [.35, 2.6], [0, 6], .05, 'ExtensionAlignedCloudFox'),
  'glow.pulseSpeed': control('glow.pulseSpeed', '脉冲速度', 'glow', 1, [.4, 2.5], [0, 5], .05, 'ExtensionAlignedCloudFox'),
} as const)

export type StudioControlPath = keyof typeof STUDIO_CONTROL_REGISTRY

export function getStudioControl(path: StudioControlPath): StudioNumericControlDefinition {
  return STUDIO_CONTROL_REGISTRY[path]
}

export function getStudioHardRange(path: StudioControlPath): readonly [number, number] {
  return STUDIO_CONTROL_REGISTRY[path].hardRange
}

export function isStudioValueOutsideRecommended(path: StudioControlPath, value: number) {
  const [minimum, maximum] = STUDIO_CONTROL_REGISTRY[path].recommendedRange
  return value < minimum || value > maximum
}
