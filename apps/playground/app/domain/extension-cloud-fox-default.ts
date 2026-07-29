/**
 * 文件职责 / File responsibility
 * 将 Chrome 扩展经典云狐视觉方案映射为 Studio 外观与场景，并应用用户确认的默认头身、肩臂和尾巴形体。
 * Maps the production Chrome extension Cloud Fox scheme into Studio recipes with the user-approved default body, shoulder-arm, and tail silhouette.
 */
import { EXTENSION_CLASSIC_CLOUD_FOX_SCHEME } from './chrome-extension-cloud-fox-profile'
import { normalizeCustomizableAppearance } from './pet-part-customization'
import type { MultiSpeciesAppearanceRecipe } from './pet-species-registry'
import type { PetSceneRecipe } from './pet-scene'

export const EXTENSION_CLASSIC_VISUAL_SCHEME_ID = EXTENSION_CLASSIC_CLOUD_FOX_SCHEME.id

export function createExtensionClassicAppearance(): MultiSpeciesAppearanceRecipe {
  const palette = EXTENSION_CLASSIC_CLOUD_FOX_SCHEME.palette
  return normalizeCustomizableAppearance({
    schemaVersion: 2,
    speciesId: 'cloud-fox',
    identity: { petId: 'zeph', nameZh: '云灵', nameEn: 'Zeph', monogram: 'Z' },
    parts: {
      bodyShape: 'ellipsoid', headShape: 'classic-round', ears: 'pointed', eyes: 'round', nose: 'soft', mouth: 'smile', tail: 'cloud',
      antenna: 'twin', antennaRod: 'tapered', antennaTip: 'orb',
    },
    proportions: {
      bodyScale: 1, bodyWidth: .85, bodyHeight: .77, bodyDepth: 1, headScale: 1.24, limbLength: 1, limbThickness: 1, limbSpacing: 1,
      pawScale: 1, earScale: 1, eyeScale: 1, eyeSpacing: 1, tailLength: 1.36, tailWidth: .9, antennaScale: 1,
    },
    palette: {
      coat: palette.coat, coatShadow: palette.coatShadow, coatWarm: palette.coatWarm, innerEar: palette.primaryGlow, eye: palette.eye,
      primaryGlow: palette.primaryGlow, secondaryGlow: palette.secondaryGlow, tailGlow: palette.tailTip, antennaGlow: palette.secondaryGlow,
      symbolGlow: palette.secondaryGlow, highlight: palette.coatWarm, shade: palette.coatShadow, halo: palette.primaryGlow,
    },
    earDesign: {
      outerColor: palette.coat, innerColor: palette.primaryGlow, tipColor: palette.coatWarm,
      innerGlowEnabled: true, innerGlowColor: palette.primaryGlow, innerGlowIntensity: .25,
    },
    bellyPatchDesign: { mode: 'custom', visible: true, style: 'oval', width: 1, height: 1, offsetY: 0 },
    chestDisplay: { mode: 'energy-core' },
    frontPawDesign: {
      style: 'soft', rootHeight: .1, embedDepth: .25, forwardOffset: -.13, outwardAngle: .55, forwardAngle: .1,
      lateralOffset: .28, shoulderScale: 1.62, wristScale: 1, palmScale: 1,
    },
    glow: { mode: 'emotion', tailEnabled: true, antennaEnabled: true, intensity: 1.65, pulseSpeed: 1 },
    symbols: {
      chest: { enabled: false, text: 'Z', color: palette.secondaryGlow, scale: 1, rotation: 0, glowIntensity: 1.8, offsetX: 0, offsetY: 0, offsetZ: 0 },
      back: { enabled: false, text: 'YK', color: palette.primaryGlow, scale: 1, rotation: 0, glowIntensity: 1.6, offsetX: 0, offsetY: .18, offsetZ: .02 },
    },
    tailDesign: {
      rootOffsetX: 0, rootOffsetY: -.21, rootOffsetZ: .09, rootExtensionLength: .12, rootExtensionWidth: .15, lateralOffset: -.03,
      direction: 'left', tipGlow: { enabled: true, color: palette.tailTip, intensity: 1.65, auraScale: 1.55 },
      segments: [
        { length: .7, width: .16, offsetX: .01, offsetY: 0, offsetZ: 0, rotationX: 0, rotationY: -.061592653589793, rotationZ: -.081592653589793 },
        { length: .58, width: .16, offsetX: 0, offsetY: 0, offsetZ: 0, rotationX: 0, rotationY: 0, rotationZ: .1 },
        { length: .52, width: .16, offsetX: 0, offsetY: 0, offsetZ: 0, rotationX: 0, rotationY: 0, rotationZ: .16 },
      ],
    },
    antennaDesign: { spacing: .48, length: .34, thickness: .052, tilt: .24 },
  })
}

export function createExtensionClassicScene(): PetSceneRecipe {
  const scheme = EXTENSION_CLASSIC_CLOUD_FOX_SCHEME
  return {
    schemaVersion: 1, presetId: 'deep-nebula', transparent: false, background: scheme.scene.baseColor, backgroundSecondary: '#282052',
    halo: { enabled: false, color: scheme.palette.primaryGlow, intensity: 0, scale: 1.5 },
    particles: { enabled: false, color: '#bafdf3', count: 0, size: .032, speed: 0 },
    groundShadow: { enabled: false, opacity: 0, softness: .82, scale: 1.22 }, contrastMode: 'dark', actionLinked: true,
  }
}

export function isExtensionClassicScene(scene: PetSceneRecipe) {
  const classic = createExtensionClassicScene()
  return scene.presetId === classic.presetId && scene.transparent === classic.transparent && scene.background === classic.background
    && scene.backgroundSecondary === classic.backgroundSecondary && scene.halo.enabled === false && scene.particles.enabled === false && scene.groundShadow.enabled === false
}
