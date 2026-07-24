/*
 * 文件职责 / File responsibility
 * 定义六种云狐眼睛的统一视觉尺寸、深度与最小眨眼比例，确保不同头型和动作下仍然可见。
 * Defines shared visual size, depth, and minimum blink ratios for six Cloud Fox eyes so every style remains visible across head shapes and motions.
 */
export interface CloudFoxEyeStyleMetrics {
  width: number
  height: number
  depth: number
  blinkFloor: number
}

export const CLOUD_FOX_EYE_STYLE_METRICS: Readonly<Record<string, CloudFoxEyeStyleMetrics>> = Object.freeze({
  round: Object.freeze({ width: .32, height: .24, depth: .18, blinkFloor: .08 }),
  oval: Object.freeze({ width: .27, height: .42, depth: .18, blinkFloor: .08 }),
  spark: Object.freeze({ width: .42, height: .42, depth: .11, blinkFloor: .42 }),
  visor: Object.freeze({ width: 1.44, height: .32, depth: .16, blinkFloor: 1 }),
  sleepy: Object.freeze({ width: .36, height: .14, depth: .06, blinkFloor: 1 }),
  diamond: Object.freeze({ width: .32, height: .44, depth: .2, blinkFloor: .34 }),
})

export function getCloudFoxEyeStyleMetrics(style: string): CloudFoxEyeStyleMetrics {
  return CLOUD_FOX_EYE_STYLE_METRICS[style] || CLOUD_FOX_EYE_STYLE_METRICS.round!
}

export function getCloudFoxEyeBlinkFloor(style: string) {
  return getCloudFoxEyeStyleMetrics(style).blinkFloor
}
