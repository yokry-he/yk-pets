/**
 * 文件职责 / File responsibility
 * 为玩球和飞扑接球提供唯一的共享坐标源，避免球、身体、视线和爪子各自复制运动公式。
 * Provides the single shared coordinate source for ball play and diving catch so props, body, gaze, and paws never duplicate motion formulas.
 */
import { Vector3 } from 'three'
import { smoothStep } from './chrome-extension-cloud-fox-motion-runtime'

export interface BallMotionPose {
  position: Vector3
  velocity: Vector3
  activeSide: -1 | 1
  height: number
}

export interface CatchMotionPose {
  ballPosition: Vector3
  bodyTarget: Vector3
  pawTarget: Vector3
  facingYaw: number
  activeSide: -1 | 1
}

const TAU = Math.PI * 2

export function createBallMotionPose(progress: number): BallMotionPose {
  const phase = progress * TAU * 2
  const sine = Math.sin(phase)
  const cosine = Math.cos(phase)
  const height = Math.abs(sine)
  const verticalDirection = sine === 0 ? 0 : Math.sign(sine)
  const position = new Vector3(sine * .72, -.74 + height * 1.38, .92)
  const velocity = new Vector3(
    cosine * .72 * TAU * 2,
    cosine * verticalDirection * 1.38 * TAU * 2,
    0,
  )
  return {
    position,
    velocity,
    activeSide: position.x < 0 ? -1 : 1,
    height,
  }
}

/**
 * 飞扑回退为稳定的正面构图：球从右上方进入画面，在两前爪之间完成接球；身体只做小幅前冲和上抬。
 * The catch uses the stable original front composition: the ball enters from upper-right and finishes between both paws while the body only lifts and lunges slightly forward.
 */
export function createCatchMotionPose(progress: number): CatchMotionPose {
  const travel = smoothStep(.04, .68, progress)
  const catchAir = smoothStep(.12, .28, progress) * (1 - smoothStep(.7, .9, progress))
  const catchLand = smoothStep(.72, .88, progress) * (1 - smoothStep(.92, 1, progress))
  const ballPosition = new Vector3(
    .58 * (1 - travel),
    1.34 - travel * .9 + Math.sin(travel * Math.PI) * .34,
    1.06,
  )
  const bodyTarget = new Vector3(
    .1 * catchAir,
    Math.sin(progress * Math.PI) * .34 * catchAir,
    .3 * catchAir - .08 * catchLand,
  )
  const pawTarget = ballPosition.clone().sub(bodyTarget)
  return {
    ballPosition,
    bodyTarget,
    pawTarget,
    facingYaw: 0,
    activeSide: ballPosition.x > .08 ? 1 : -1,
  }
}
