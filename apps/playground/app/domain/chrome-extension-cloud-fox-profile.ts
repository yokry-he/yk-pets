/**
 * 文件职责 / File responsibility
 * 将 Chrome 扩展正式云狐中的精确模型、材质、相机、灯光和背景参数提取为可复用视觉方案。
 * Extracts exact production Chrome extension Cloud Fox values into reusable visual schemes.
 */
export type VisualVector3 = readonly [number, number, number]
export type VisualEuler3 = readonly [number, number, number]
export type VisualCurve = readonly VisualVector3[]

export const EXTENSION_CLASSIC_CLOUD_FOX_SCHEME = {
  id: 'extension-classic',
  label: '扩展经典云灵',
  labelEn: 'Extension Classic Zeph',
  source: 'chrome-extension-production',
  palette: {
    coat: '#e9ecff',
    coatShadow: '#aeb6e8',
    coatWarm: '#f9fbff',
    muzzle: '#f7f8ff',
    eye: '#141629',
    nose: '#25263b',
    mouth: '#24263c',
    tongue: '#ff87ad',
    cheek: '#ff91b7',
    primaryGlow: '#7066ff',
    secondaryGlow: '#52e0d0',
    tailTip: '#caffff',
  },
  model: {
    rootPosition: [0, 0.18, 0],
    body: {
      position: [0, -0.32, 0],
      scale: [0.94, 1.12, 0.82],
      radius: 1,
      warmPatchPosition: [0, -0.26, 0.73],
      warmPatchScale: [0.48, 0.56, 0.2],
      warmPatchRadius: 1,
    },
    head: {
      position: [0, 0.92, 0.06],
      scale: [1.02, 0.88, 0.9],
      radius: 0.9,
      muzzlePosition: [0, -0.22, 0.79],
      muzzleScale: [0.48, 0.34, 0.36],
      muzzleRadius: 0.65,
      earOffset: [0.56, 0.65, -0.04],
      earRotationZ: 0.16,
      earOuter: [0.35, 0.9, 4],
      earInnerPosition: [0, -0.03, 0.09],
      earInnerScale: [0.55, 0.68, 0.5],
      earInner: [0.35, 0.78, 4],
      eyeOffset: [0.31, 0.08, 0.77],
      eyeScale: [0.16, 0.22, 0.1],
      eyeHighlightPosition: [0.04, 0.05, 0.105],
      eyeHighlightScale: [0.045, 0.065, 0.025],
      cheekOffset: [0.52, -0.16, 0.79],
      cheekScale: [0.13, 0.07, 0.03],
      nosePosition: [0, -0.24, 1.015],
      noseScale: [0.11, 0.085, 0.07],
      mouthPosition: [0, -0.39, 0.985],
      mouthScale: [0.15, 0.075, 0.04],
      tonguePosition: [0, -0.025, 0.035],
      tongueScale: [0.075, 0.026, 0.015],
    },
    antenna: {
      offset: [0.24, 0.7, 0.05],
      rotation: [0.12, 0.06, 0.24],
      rodPosition: [0, 0.16, 0],
      rod: [0.028, 0.052, 0.34, 12],
      tipPosition: [0.015, 0.35, 0.02],
      tipRadius: 0.08,
      auraScale: 1.7,
    },
    frontPaw: {
      offset: [0.5, -0.04, 0.82],
      forearmPosition: [0, -0.18, 0.01],
      forearm: [0.085, 0.11, 0.36, 20],
      tipPosition: [0, -0.38, 0.04],
      tipRadius: 0.12,
      tipScale: [1.05, 0.85, 1.2],
    },
    hindPaw: {
      offset: [0.48, -1.08, 0.22],
      legRotation: [0.08, 0, 0.04],
      leg: [0.12, 0.15, 0.34, 20],
      tipPosition: [0, -0.22, 0.06],
      tipRadius: 0.14,
      tipScale: [1.18, 0.9, 1.35],
    },
    chestCore: {
      position: [0, -0.26, 0.74],
      radius: 0.19,
      emissiveIntensity: 1.8,
    },
    tail: {
      position: [-0.58, -0.48, -0.34],
      rotation: [0.03, 0.08, -0.08],
      baseCurve: [[0, 0, 0], [-0.22, 0.02, 0], [-0.43, 0.09, 0], [-0.58, 0.22, 0]],
      baseRadius: 0.27,
      midPosition: [-0.58, 0.22, 0],
      midRotation: [0, 0, 0.1],
      midCurve: [[0, 0, 0], [-0.14, 0.12, 0], [-0.29, 0.29, 0], [-0.42, 0.44, 0]],
      midRadius: 0.22,
      tipPosition: [-0.42, 0.44, 0.03],
      tipRotation: [0, 0, 0.16],
      tipCurve: [[0, 0, 0], [-0.12, 0.11, 0], [-0.25, 0.24, 0], [-0.38, 0.34, 0]],
      tipRadius: 0.16,
      energyPosition: [-0.38, 0.34, 0],
      energyRadius: 0.15,
      auraPosition: [-0.38, 0.34, -0.01],
      auraRadius: 0.2,
      auraScale: 1.55,
    },
    shadow: {
      softPosition: [0, -1.76, 0],
      softRadius: 1.18,
      softColor: '#48507f',
      softOpacity: 0.1,
      corePosition: [0, -1.75, 0.01],
      coreRadius: 0.86,
      coreColor: '#252b4b',
      coreOpacity: 0.22,
    },
  },
  scene: {
    baseColor: '#0a0d18',
    containerBackground: 'radial-gradient(circle at 50% 76%, rgba(82, 224, 208, .1), transparent 34%), radial-gradient(circle at 50% 8%, rgba(112, 102, 255, .18), transparent 42%), #0a0d18',
    nebulaBackground: 'radial-gradient(circle at 50% 58%, rgba(255, 255, 255, .09) 0%, rgba(255, 255, 255, .04) 8%, rgba(111, 103, 255, .22) 26%, rgba(70, 52, 185, .16) 42%, rgba(82, 224, 208, .14) 55%, rgba(14, 18, 40, .06) 72%, rgba(14, 18, 40, 0) 84%), radial-gradient(circle at 58% 50%, rgba(82, 224, 208, .18), rgba(82, 224, 208, 0) 52%), radial-gradient(circle at 42% 48%, rgba(112, 102, 255, .22), rgba(112, 102, 255, 0) 50%)',
    glowBackground: 'radial-gradient(ellipse, rgba(82, 224, 208, .32), rgba(112, 102, 255, .18) 38%, transparent 72%)',
    camera: {
      normalPosition: [0, 0.42, 8.8],
      compactPosition: [0, 0.08, 9.7],
      widePosition: [0, 0.72, 10.8],
      compactWidePosition: [0, 0.62, 11.3],
      normalFov: 35,
      compactFov: 33,
      wideFov: 38,
      normalDpr: [1, 1.4],
      compactDpr: [1, 1.2],
      compactScale: 0.92,
    },
    lights: {
      ambientIntensity: 1.35,
      directionalPosition: [4, 6, 4],
      directionalIntensity: 3.8,
      primaryPosition: [-3, 1, 2],
      primaryIntensity: 3.6,
      primarySecretIntensity: 7,
      secondaryPosition: [3, -1, 2],
      secondaryIntensity: 2.8,
      secondarySecretIntensity: 6,
    },
  },
} as const

export const CLOUD_FOX_VISUAL_SCHEMES = Object.freeze({
  [EXTENSION_CLASSIC_CLOUD_FOX_SCHEME.id]: EXTENSION_CLASSIC_CLOUD_FOX_SCHEME,
})

export type CloudFoxVisualSchemeId = keyof typeof CLOUD_FOX_VISUAL_SCHEMES

export function getCloudFoxVisualScheme(id: CloudFoxVisualSchemeId = 'extension-classic'): CloudFoxVisualScheme {
  return structuredClone(CLOUD_FOX_VISUAL_SCHEMES[id])
}
