<!--
  文件职责 / File responsibility
  程序化云狐模型与全部姿态、视线、道具和高能动作运行时。
  Procedural cloud-fox model and runtime for poses, gaze, props, and high-energy motions.
-->
<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useLoop } from '@tresjs/core'
import { AdditiveBlending, CatmullRomCurve3, Color, Euler, Vector3 } from 'three'
import type { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from 'three'
import type { PetEmotion } from './types'

// 数学与插值工具：所有动作共用，保持帧率变化下的平滑过渡。 / Math and interpolation helpers shared by all motions for frame-rate-independent smoothing.
function vec3(x: number, y: number, z: number) {
  return new Vector3(x, y, z)
}

function euler(x: number, y: number, z: number) {
  return new Euler(x, y, z)
}

function damp(current: number, target: number, lambda: number, delta: number) {
  return current + (target - current) * Math.min(1, 1 - Math.exp(-lambda * delta))
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value))
}

function applyDeadzone(value: number, deadzone = 0.1) {
  const magnitude = Math.abs(value)
  if (magnitude <= deadzone) return 0
  return Math.sign(value) * ((magnitude - deadzone) / (1 - deadzone))
}

function smoothStep(start: number, end: number, value: number) {
  const progress = clamp01((value - start) / Math.max(0.0001, end - start))
  return progress * progress * (3 - 2 * progress)
}

function mix(start: number, end: number, progress: number) {
  return start + (end - start) * progress
}

function pulse(progress: number, start: number, end: number) {
  if (progress <= start || progress >= end) return 0
  return Math.sin(((progress - start) / (end - start)) * Math.PI)
}

function wrapAngleNear(current: number, target: number) {
  let wrapped = target
  while (wrapped - current > Math.PI) wrapped -= Math.PI * 2
  while (wrapped - current < -Math.PI) wrapped += Math.PI * 2
  return wrapped
}

// 尾巴三段持续向身体外侧延伸，避免尾尖折返穿身 / Every tail segment keeps extending away from the torso to prevent body crossing.
const tailBaseCurve = new CatmullRomCurve3([
  vec3(0, 0, 0),
  vec3(-0.22, 0.02, 0),
  vec3(-0.43, 0.09, 0),
  vec3(-0.58, 0.22, 0),
])
const tailMidCurve = new CatmullRomCurve3([
  vec3(0, 0, 0),
  vec3(-0.14, 0.12, 0),
  vec3(-0.29, 0.29, 0),
  vec3(-0.42, 0.44, 0),
])
const tailTipCurve = new CatmullRomCurve3([
  vec3(0, 0, 0),
  vec3(-0.12, 0.11, 0),
  vec3(-0.25, 0.24, 0),
  vec3(-0.38, 0.34, 0),
])

// 模型锚点与动作时长常量：修改造型时应同步检查道具和动作阶段。 / Model anchors and motion durations; geometry changes require prop and phase regression checks.
const FRONT_PAW_LEFT_X = -0.5
const FRONT_PAW_RIGHT_X = 0.5
const FRONT_PAW_BASE_Y = -0.04
const FRONT_PAW_BASE_Z = 0.82
const FRONT_PAW_TIP_LOCAL_Y = -0.38
const FRONT_PAW_ANCHOR_LOCAL_Y = -0.08
const FRONT_PAW_ANCHOR_LOCAL_Z = 0.09
const LEFT_EYE_BASE_X = -0.31
const RIGHT_EYE_BASE_X = 0.31
const EYE_BASE_Y = 0.08
const HIND_PAW_BASE_Y = -1.08
const GROUND_Y = -1.42
const WAVE_DURATION_SECONDS = 2.4
const STRETCH_DURATION_SECONDS = 7
const BALL_DURATION_SECONDS = 8.4
const EAT_DURATION_SECONDS = 8
const BACKFLIP_DURATION_SECONDS = 4.3
const TAIL_TORNADO_DURATION_SECONDS = 5
const DIVING_CATCH_DURATION_SECONDS = 7
const ENERGY_BURST_DURATION_SECONDS = 6.2
const SHY_PEEK_DURATION_SECONDS = 4.5
const STAR_JUGGLE_DURATION_SECONDS = 8.2
const CLOUD_NAP_DURATION_SECONDS = 18
const SPARKLE_SNEEZE_DURATION_SECONDS = 3.9
const FIREWORKS_DURATION_SECONDS = 12
const CURIOUS_SCAN_DURATION_SECONDS = 4
const PAW_TAP_DURATION_SECONDS = 2.5
const ANTENNA_CHARGE_DURATION_SECONDS = 5.2
const TAIL_GLOW_DURATION_SECONDS = 5.2
const FIREWORK_PARTICLE_COUNT = 48
const FIREWORK_PARTICLE_INDEXES = Array.from({ length: FIREWORK_PARTICLE_COUNT }, (_, index) => index)
const FIREWORK_PALETTES = [
  ['#f7fbff', '#72f2ff', '#7a6fff', '#d788ff'],
  ['#fff7cf', '#ffd36a', '#ff8aae', '#ffffff'],
  ['#dffff4', '#52e0d0', '#7bd8ff', '#9a8cff'],
  ['#ffe9fb', '#ff91dc', '#a788ff', '#ffffff'],
] as const
const BALL_RADIUS = 0.34
const MEAL_TABLE_HEIGHT = 0.84
const MEAL_BOWL_LOCAL_Y = MEAL_TABLE_HEIGHT + 0.13

const props = defineProps<{
  behavior: string
  emotion: PetEmotion
  speaking: boolean
  pointer: { x: number; y: number }
  secretMode: boolean
  motionKey: number
  theme: 'dark' | 'light'
}>()

// 场景 Rig 与部件引用：根节点负责位移，Action Rig 负责全身动作，Look Rig 负责视线。 / Scene rigs and part refs: root handles position, Action Rig handles body motion, and Look Rig handles gaze.
const petGroup = shallowRef<Group>()
const positionRig = shallowRef<Group>()
const actionRig = shallowRef<Group>()
const lookRig = shallowRef<Group>()
const torsoGroup = shallowRef<Group>()
const headGroup = shallowRef<Group>()
const eyeGroup = shallowRef<Group>()
const leftEye = shallowRef<Group>()
const rightEye = shallowRef<Group>()
const mouthGroup = shallowRef<Group>()
const cheeksGroup = shallowRef<Group>()
const leftEar = shallowRef<Group>()
const rightEar = shallowRef<Group>()
const tailGroup = shallowRef<Group>()
const tailMidGroup = shallowRef<Group>()
const tailTipGroup = shallowRef<Group>()
const tailMidMesh = shallowRef<Mesh>()
const tailTipMesh = shallowRef<Mesh>()
const tailEnergy = shallowRef<Mesh>()
const tailAura = shallowRef<Mesh>()
const haloGroup = shallowRef<Group>()
const coreMesh = shallowRef<Mesh>()
const leftAntenna = shallowRef<Group>()
const rightAntenna = shallowRef<Group>()
const leftAntennaTip = shallowRef<Mesh>()
const rightAntennaTip = shallowRef<Mesh>()
// 肩部根节点保持稳定，前臂与爪端承担主要动作 / Shoulder roots stay planted while forearms and paw tips carry most motion.
const leftPaw = shallowRef<Group>()
const rightPaw = shallowRef<Group>()
const leftForearm = shallowRef<Group>()
const rightForearm = shallowRef<Group>()
const leftPawTip = shallowRef<Group>()
const rightPawTip = shallowRef<Group>()
const leftPawAnchor = shallowRef<Group>()
const rightPawAnchor = shallowRef<Group>()
const mouthAnchor = shallowRef<Group>()
const leftHindLeg = shallowRef<Group>()
const rightHindLeg = shallowRef<Group>()
const shadowCore = shallowRef<Mesh>()
const shadowSoft = shallowRef<Mesh>()
const ballGroup = shallowRef<Group>()
const mealGroup = shallowRef<Group>()
const bowlGroup = shallowRef<Group>()
const foodGroup = shallowRef<Group>()
const tailTrailGroup = shallowRef<Group>()
const tailTrailPrimary = shallowRef<Mesh>()
const tailTrailSecondary = shallowRef<Mesh>()
const tailParticleGroup = shallowRef<Group>()
const tailParticleA = shallowRef<Mesh>()
const tailParticleB = shallowRef<Mesh>()
const tailParticleC = shallowRef<Mesh>()
const burstRingGroup = shallowRef<Group>()
const burstRingA = shallowRef<Mesh>()
const burstRingB = shallowRef<Mesh>()
const impactRing = shallowRef<Mesh>()
const fireworkGroup = shallowRef<Group>()
const fireworkRocket = shallowRef<Mesh>()
const fireworkRocketTrail = shallowRef<Mesh>()
const fireworkBurstGroup = shallowRef<Group>()
const fireworkParticles = shallowRef<Mesh[]>([])
const cloudNapGroup = shallowRef<Group>()
const cloudNapZzzGroup = shallowRef<Group>()
const starJuggleGroup = shallowRef<Group>()
const starOrbA = shallowRef<Mesh>()
const starOrbB = shallowRef<Mesh>()
const starOrbC = shallowRef<Mesh>()
const sneezeSparkGroup = shallowRef<Group>()
const sneezeSparkA = shallowRef<Mesh>()
const sneezeSparkB = shallowRef<Mesh>()
const sneezeSparkC = shallowRef<Mesh>()

// 主题材质：秘密模式只改变能量色，不改变模型拓扑。 / Theme materials: secret mode changes energy colors without changing model topology.
const coat = computed(() => props.theme === 'dark' ? '#e9ecff' : '#ffffff')
const coatShadow = computed(() => props.theme === 'dark' ? '#aeb6e8' : '#c5cced')
const coatWarm = computed(() => props.theme === 'dark' ? '#f9fbff' : '#ffffff')
const accent = computed(() => props.secretMode ? '#ff69d4' : '#7066ff')
const secondary = computed(() => props.secretMode ? '#6cf4ff' : '#52e0d0')
const tailTipBase = computed(() => props.secretMode ? '#fff0ff' : '#caffff')
const eyeColor = computed(() => props.behavior === 'sleeping' ? '#69708f' : '#141629')

// 动画运行时状态：每次 behavior 或 motionKey 变化都重新计算阶段起点。 / Animation runtime state: behavior or motionKey changes restart phase timing.
const { onBeforeRender } = useLoop()
let previousBehavior = props.behavior
let previousMotionKey = props.motionKey
let behaviorStartedAt = 0
let spinStartRotation = 0
let backflipStartRotation = 0
let tornadoStartRotation = 0
const reducedMotionPreferred = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const anchorWorld = new Vector3()
const pawAnchorOffsetY = FRONT_PAW_TIP_LOCAL_Y + FRONT_PAW_ANCHOR_LOCAL_Y
const pawAnchorOffsetZ = FRONT_PAW_ANCHOR_LOCAL_Z
const leftPawLocal = new Vector3(FRONT_PAW_LEFT_X, FRONT_PAW_BASE_Y + pawAnchorOffsetY, FRONT_PAW_BASE_Z + pawAnchorOffsetZ)
const rightPawLocal = new Vector3(FRONT_PAW_RIGHT_X, FRONT_PAW_BASE_Y + pawAnchorOffsetY, FRONT_PAW_BASE_Z + pawAnchorOffsetZ)
const mouthLocal = new Vector3(0, 0, 1.08)
const leftPawFallback = new Vector3(FRONT_PAW_LEFT_X, FRONT_PAW_BASE_Y + pawAnchorOffsetY, FRONT_PAW_BASE_Z + pawAnchorOffsetZ)
const rightPawFallback = new Vector3(FRONT_PAW_RIGHT_X, FRONT_PAW_BASE_Y + pawAnchorOffsetY, FRONT_PAW_BASE_Z + pawAnchorOffsetZ)
const mouthFallback = new Vector3(0, 0, 1.08)
const tailFlashColor = new Color()
const fireworkDirections = Array.from({ length: FIREWORK_PARTICLE_COUNT }, () => new Vector3())
let fireworkSeed = 0
let activeFireworkBurst = -1
let fireworkBurstX = 0
let fireworkBurstY = 2.7

function setFireworkParticleRef(value: unknown, index: number) {
  if (value) fireworkParticles.value[index] = value as Mesh
}

function configureFireworkBurst(index: number) {
  activeFireworkBurst = index
  const style = (fireworkSeed + index) % 4
  const palette = FIREWORK_PALETTES[(fireworkSeed + index * 2) % FIREWORK_PALETTES.length]!
  fireworkBurstX = [-0.72, 0.68, 0][(fireworkSeed + index) % 3] || 0
  fireworkBurstY = 2.55 + ((fireworkSeed + index) % 3) * 0.22

  for (let particleIndex = 0; particleIndex < FIREWORK_PARTICLE_COUNT; particleIndex += 1) {
    const direction = fireworkDirections[particleIndex]!
    const angle = (particleIndex / FIREWORK_PARTICLE_COUNT) * Math.PI * 2
    if (style === 0) {
      const y = 1 - ((particleIndex + 0.5) / FIREWORK_PARTICLE_COUNT) * 2
      const radius = Math.sqrt(Math.max(0, 1 - y * y))
      const theta = particleIndex * 2.3999632297
      direction.set(Math.cos(theta) * radius, y * 0.92, Math.sin(theta) * radius * 0.48)
    }
    else if (style === 1) {
      direction.set(Math.cos(angle), Math.sin(angle), Math.sin(angle * 3) * 0.16).normalize()
    }
    else if (style === 2) {
      const x = Math.pow(Math.sin(angle), 3)
      const y = (13 * Math.cos(angle) - 5 * Math.cos(angle * 2) - 2 * Math.cos(angle * 3) - Math.cos(angle * 4)) / 16
      direction.set(x, y, Math.sin(angle * 2) * 0.1).normalize()
    }
    else {
      const ray = particleIndex % 2 === 0 ? 1 : 0.44
      direction.set(Math.cos(angle) * ray, Math.sin(angle) * ray, Math.sin(particleIndex * 1.71) * 0.14).normalize()
    }
    const particle = fireworkParticles.value[particleIndex]
    if (particle) {
      const material = particle.material as MeshBasicMaterial
      material.color.set(palette[particleIndex % palette.length]!)
      material.opacity = 0
      particle.scale.setScalar(0.001)
      particle.position.set(0, 0, 0)
    }
  }
}

function readAnchorInPositionRig(anchor: Group | undefined, fallback: Vector3, target: Vector3) {
  const rig = positionRig.value
  if (!anchor || !rig) return target.copy(fallback)
  anchor.getWorldPosition(anchorWorld)
  target.copy(anchorWorld)
  rig.worldToLocal(target)
  return target
}

/**
 * 每帧先解析动作阶段，再依次更新位移、旋转、缩放、视线、四肢、尾巴、道具和特效。
 * Each frame resolves motion phases before updating position, rotation, scale, gaze, limbs, tail, props, and effects.
 */
onBeforeRender(({ elapsed, delta }) => {
  const root = petGroup.value
  const pet = positionRig.value
  const action = actionRig.value
  const look = lookRig.value
  const head = headGroup.value
  if (!root || !pet || !action || !look || !head) return

  const state = props.behavior
  if (state !== previousBehavior || props.motionKey !== previousMotionKey) {
    previousBehavior = state
    previousMotionKey = props.motionKey
    behaviorStartedAt = elapsed
    if (state === 'spinning') spinStartRotation = action.rotation.y % (Math.PI * 2)
    if (state === 'backflip') backflipStartRotation = action.rotation.x % (Math.PI * 2)
    if (state === 'tail-tornado') tornadoStartRotation = action.rotation.y % (Math.PI * 2)
    if ((state === 'playing-ball' || state === 'diving-catch') && ballGroup.value) {
      ballGroup.value.position.set(FRONT_PAW_LEFT_X - 0.03, FRONT_PAW_BASE_Y - 0.5, FRONT_PAW_BASE_Z + 0.16)
      ballGroup.value.scale.setScalar(0.001)
    }
    if (state === 'energy-burst' && burstRingGroup.value) {
      burstRingGroup.value.scale.setScalar(0.001)
      burstRingGroup.value.visible = true
    }
    if (state === 'eating') {
      mealGroup.value?.scale.setScalar(0.001)
      bowlGroup.value?.scale.set(1, 1, 1)
      foodGroup.value?.scale.set(1, 1, 1)
    }
    if (state === 'fireworks-show') {
      fireworkSeed = Math.floor(Math.random() * 1000)
      activeFireworkBurst = -1
      if (fireworkGroup.value) fireworkGroup.value.visible = true
      if (fireworkRocket.value) fireworkRocket.value.scale.setScalar(0.001)
      if (fireworkRocketTrail.value) fireworkRocketTrail.value.scale.set(0.001, 0.001, 0.001)
      fireworkParticles.value.forEach((particle) => {
        particle.scale.setScalar(0.001)
        ;(particle.material as MeshBasicMaterial).opacity = 0
      })
    }
    if (state === 'cloud-nap') cloudNapGroup.value?.scale.setScalar(0.001)
    if (state === 'star-juggle') starJuggleGroup.value?.scale.setScalar(0.001)
    if (state === 'sparkle-sneeze') sneezeSparkGroup.value?.scale.setScalar(0.001)
  }
  const stateElapsed = Math.max(0, elapsed - behaviorStartedAt)

  // 行为标志统一在帧开头计算，避免后续各部件重复判断字符串。 / Resolve behavior flags once per frame so downstream rigs do not repeat string checks.
  const isSleeping = state === 'sleeping'
  const isThinking = state === 'thinking'
  const isHappy = state === 'happy' || state === 'talking'
  const isExcited = state === 'excited' || props.secretMode
  const isConfused = state === 'confused'
  const isWaking = state === 'waking'
  const isGreeting = state === 'greeting'
  const isPlaying = state === 'playing'
  const isSpinning = state === 'spinning'
  const isListening = state === 'listening'
  const isJumping = state === 'jumping'
  const isFlapping = state === 'flapping'
  const isResting = state === 'resting'
  const isStretching = state === 'stretching'
  const isPlayingBall = state === 'playing-ball'
  const isEating = state === 'eating'
  const isBackflip = state === 'backflip'
  const isTailTornado = state === 'tail-tornado'
  const isDivingCatch = state === 'diving-catch'
  const isEnergyBurst = state === 'energy-burst'
  const isShyPeek = state === 'shy-peek'
  const isStarJuggle = state === 'star-juggle'
  const isCloudNap = state === 'cloud-nap'
  const isSparkleSneeze = state === 'sparkle-sneeze'
  const isFireworksShow = state === 'fireworks-show'
  const isCuriousScan = state === 'curious-scan'
  const isPawTap = state === 'paw-tap'
  const isAntennaCharge = state === 'antenna-charge'
  const isTailGlow = state === 'tail-glow'
  const isGlowMotion = isAntennaCharge || isTailGlow
  const isHighEnergy = isBackflip || isTailTornado || isDivingCatch || isEnergyBurst || isFireworksShow
  const isTalking = props.speaking || state === 'talking'

  // 浏览器指针 Y 向下为正；头部俯仰与眼球局部位移分别在各自坐标系中只转换一次。 / Browser pointer Y is positive downward; head pitch and local eye offsets each convert it exactly once in their own coordinate system.
  const pointerX = applyDeadzone(props.pointer.x)
  const pointerY = applyDeadzone(props.pointer.y)
  const pointerNearCenter = pointerX === 0 && pointerY === 0
  const scanX = isCuriousScan
    ? Math.sin(stateElapsed * 3.2) * 0.32
    : pointerNearCenter && !isSleeping && !isSpinning && !isResting && !isEating && !isPlayingBall && !isDivingCatch && !isCloudNap && !isStarJuggle && !isFireworksShow
      ? Math.sin(elapsed * 0.85) * 0.12
      : 0

  // 动作阶段进度均归一化为 0–1，便于使用相同的缓入、保持和缓出函数。 / Motion phases are normalized to 0–1 so enter, hold, and exit easing can be shared.
  const greetingProgress = isGreeting ? Math.min(1, stateElapsed / WAVE_DURATION_SECONDS) : 0
  const greetingEnter = isGreeting ? smoothStep(0.02, 0.22, greetingProgress) : 0
  const greetingExit = isGreeting ? 1 - smoothStep(0.78, 0.98, greetingProgress) : 0
  const greetingPose = greetingEnter * greetingExit
  const greetingWave = isGreeting && greetingProgress > 0.2 && greetingProgress < 0.82
    ? Math.sin(((greetingProgress - 0.2) / 0.62) * Math.PI * 6) * greetingPose
    : 0

  const jumpProgress = Math.min(1, stateElapsed / 1.25)
  const jumpOffset = isJumping ? Math.sin(jumpProgress * Math.PI) * 0.9 : 0
  const jumpLanding = isJumping ? Math.pow(Math.sin(jumpProgress * Math.PI), 2) : 0
  const stretchProgress = isStretching ? Math.min(1, stateElapsed / STRETCH_DURATION_SECONDS) : 0
  const ballProgress = isPlayingBall ? Math.min(1, stateElapsed / BALL_DURATION_SECONDS) : 0
  const eatProgress = isEating ? Math.min(1, stateElapsed / EAT_DURATION_SECONDS) : 0
  const backflipProgress = isBackflip ? Math.min(1, stateElapsed / BACKFLIP_DURATION_SECONDS) : 0
  const tornadoProgress = isTailTornado ? Math.min(1, stateElapsed / TAIL_TORNADO_DURATION_SECONDS) : 0
  const catchProgress = isDivingCatch ? Math.min(1, stateElapsed / DIVING_CATCH_DURATION_SECONDS) : 0
  const energyProgress = isEnergyBurst ? Math.min(1, stateElapsed / ENERGY_BURST_DURATION_SECONDS) : 0
  const shyProgress = isShyPeek ? Math.min(1, stateElapsed / SHY_PEEK_DURATION_SECONDS) : 0
  const juggleProgress = isStarJuggle ? Math.min(1, stateElapsed / STAR_JUGGLE_DURATION_SECONDS) : 0
  const cloudNapProgress = isCloudNap ? Math.min(1, stateElapsed / CLOUD_NAP_DURATION_SECONDS) : 0
  const sneezeProgress = isSparkleSneeze ? Math.min(1, stateElapsed / SPARKLE_SNEEZE_DURATION_SECONDS) : 0
  const fireworksProgress = isFireworksShow ? Math.min(1, stateElapsed / FIREWORKS_DURATION_SECONDS) : 0
  const curiousProgress = isCuriousScan ? Math.min(1, stateElapsed / CURIOUS_SCAN_DURATION_SECONDS) : 0
  const pawTapProgress = isPawTap ? Math.min(1, stateElapsed / PAW_TAP_DURATION_SECONDS) : 0
  const antennaProgress = isAntennaCharge ? Math.min(1, stateElapsed / ANTENNA_CHARGE_DURATION_SECONDS) : 0
  const tailGlowProgress = isTailGlow ? Math.min(1, stateElapsed / TAIL_GLOW_DURATION_SECONDS) : 0
  const highMotionScale = reducedMotionPreferred ? 0.34 : 1
  const backflipFlight = isBackflip ? smoothStep(0.14, 0.3, backflipProgress) * (1 - smoothStep(0.72, 0.9, backflipProgress)) : 0
  const backflipLift = isBackflip ? Math.sin(clamp01((backflipProgress - 0.12) / 0.76) * Math.PI) * 1.18 * highMotionScale : 0
  const tornadoStrength = isTailTornado ? smoothStep(0.08, 0.25, tornadoProgress) * (1 - smoothStep(0.76, 0.97, tornadoProgress)) : 0
  const catchDive = isDivingCatch ? smoothStep(0.16, 0.44, catchProgress) * (1 - smoothStep(0.78, 0.96, catchProgress)) : 0
  const energyCharge = isEnergyBurst ? smoothStep(0.06, 0.46, energyProgress) * (1 - smoothStep(0.86, 0.99, energyProgress)) : 0
  const energyRelease = isEnergyBurst ? pulse(energyProgress, 0.42, 0.94) : 0
  const shyPose = isShyPeek ? smoothStep(0.04, 0.24, shyProgress) * (1 - smoothStep(0.78, 0.98, shyProgress)) : 0
  const jugglePose = isStarJuggle ? smoothStep(0.04, 0.2, juggleProgress) * (1 - smoothStep(0.84, 0.98, juggleProgress)) : 0
  const cloudNapPose = isCloudNap ? smoothStep(0.04, 0.22, cloudNapProgress) * (1 - smoothStep(0.82, 0.98, cloudNapProgress)) : 0
  const sneezeCharge = isSparkleSneeze ? smoothStep(0.05, 0.46, sneezeProgress) * (1 - smoothStep(0.72, 0.96, sneezeProgress)) : 0
  const sneezeRelease = isSparkleSneeze ? pulse(sneezeProgress, 0.44, 0.74) : 0
  const curiousPose = isCuriousScan ? smoothStep(0.03, 0.2, curiousProgress) * (1 - smoothStep(0.78, 0.98, curiousProgress)) : 0
  const pawTapPose = isPawTap ? smoothStep(0.04, 0.18, pawTapProgress) * (1 - smoothStep(0.82, 0.98, pawTapProgress)) : 0
  const pawTapBeat = isPawTap ? Math.max(0, Math.sin(pawTapProgress * Math.PI * 8)) * pawTapPose : 0
  const antennaChargePose = isAntennaCharge ? smoothStep(0.04, 0.44, antennaProgress) * (1 - smoothStep(0.86, 0.99, antennaProgress)) : 0
  const antennaRelease = isAntennaCharge ? pulse(antennaProgress, 0.42, 0.9) : 0
  const tailGlowPose = isTailGlow ? smoothStep(0.04, 0.22, tailGlowProgress) * (1 - smoothStep(0.84, 0.99, tailGlowProgress)) : 0
  const tailGlowWave = isTailGlow ? (0.5 + Math.sin(tailGlowProgress * Math.PI * 8) * 0.5) * tailGlowPose : 0
  const stretchEnter = isStretching ? smoothStep(0.04, 0.27, stretchProgress) : 0
  const stretchExit = isStretching ? 1 - smoothStep(0.76, 0.98, stretchProgress) : 0
  const stretchStrength = stretchEnter * stretchExit
  const stretchHoldBreath = isStretching && stretchProgress > 0.27 && stretchProgress < 0.76
    ? Math.sin((stretchProgress - 0.27) / 0.49 * Math.PI * 2) * 0.018
    : 0
  const spinProgress = isSpinning ? Math.min(1, stateElapsed / 1.9) : 0

  const bobSpeed = isSleeping
    ? 1.1
    : isThinking
      ? 3.2
      : isPlaying || isFlapping || isPlayingBall || isStarJuggle || isPawTap || isGlowMotion || isHighEnergy
        ? isTailTornado ? 7.2 : isFireworksShow ? 2.1 : 4.7
        : isExcited
          ? 3.2
          : isEating || isStretching
            ? 1.35
            : 1.9
  const bobAmount = isSleeping
    ? 0.03
    : isHappy
      ? 0.11
      : isPlaying || isFlapping || isPlayingBall || isStarJuggle || isPawTap || isGlowMotion || isHighEnergy
        ? isTailTornado ? 0.07 : isFireworksShow ? 0.035 : 0.13
        : isExcited
          ? 0.15
          : isResting || isEating || isStretching
            ? 0.018
            : 0.07
  const baseY = isResting ? -0.28 : isCloudNap ? -0.38 - cloudNapPose * 0.2 : isStretching ? 0.18 + stretchStrength * 0.12 : isEating ? 0.1 : isEnergyBurst ? 0.12 - energyCharge * 0.09 : isAntennaCharge ? 0.13 - antennaChargePose * 0.04 : isFireworksShow ? 0.02 : 0.18
  const hopBoost = isHappy ? Math.max(0, Math.sin(elapsed * 8.5)) * 0.11 : 0
  const flapHop = isFlapping ? Math.max(0, Math.sin(stateElapsed * 9)) * 0.12 : 0
  const ballHop = isPlayingBall ? Math.max(0, Math.sin(stateElapsed * 5.4)) * 0.06 : 0
  const targetY = baseY + Math.sin(elapsed * bobSpeed) * bobAmount + hopBoost + jumpOffset + flapHop + ballHop + backflipLift + (isDivingCatch ? Math.sin(catchProgress * Math.PI) * 0.32 * highMotionScale : 0) + (isStarJuggle ? Math.max(0, Math.sin(juggleProgress * Math.PI * 4)) * 0.05 : 0) + pawTapBeat * 0.035
  const targetX = isPlaying
    ? Math.sin(elapsed * 2.4) * 0.2
    : isPlayingBall
      ? Math.sin(ballProgress * Math.PI * 4) * 0.075
      : isDivingCatch
        ? mix(0, clamp((ballGroup.value?.position.x || 0) * 0.24, -0.32, 0.32), catchDive)
        : isCloudNap
          ? -0.12 * cloudNapPose
          : 0
  pet.position.y = damp(pet.position.y, targetY, isJumping ? 10 : 5.2, delta)
  pet.position.x = damp(pet.position.x, targetX, 4.8, delta)

  // 高空烟花由三个连续发射阶段组成，每次从精选花型和配色池中确定一个稳定组合。 / The high-altitude show uses three launches, each selecting a curated shape and palette.
  if (fireworkGroup.value) {
    fireworkGroup.value.visible = isFireworksShow
    if (isFireworksShow) {
      const scaled = Math.min(2.999, fireworksProgress * 3)
      const burstIndex = Math.floor(scaled)
      const localProgress = scaled - burstIndex
      if (activeFireworkBurst !== burstIndex) configureFireworkBurst(burstIndex)
      const launchProgress = smoothStep(0.02, 0.38, localProgress)
      const burstProgress = clamp01((localProgress - 0.36) / 0.64)
      const burstEase = 1 - Math.pow(1 - burstProgress, 2.4)
      const fade = 1 - smoothStep(0.72, 0.99, burstProgress)
      const launchStartX = burstIndex % 2 === 0 ? -0.48 : 0.48
      const launchStartY = -0.2

      if (fireworkRocket.value) {
        fireworkRocket.value.visible = localProgress < 0.43
        fireworkRocket.value.position.set(
          mix(launchStartX, fireworkBurstX, launchProgress),
          mix(launchStartY, fireworkBurstY, launchProgress) + Math.sin(launchProgress * Math.PI) * 0.14,
          0.48,
        )
        fireworkRocket.value.scale.setScalar(localProgress < 0.43 ? 0.9 + launchProgress * 0.22 : 0.001)
      }
      if (fireworkRocketTrail.value) {
        fireworkRocketTrail.value.visible = localProgress < 0.43
        fireworkRocketTrail.value.position.set(
          mix(launchStartX, fireworkBurstX, launchProgress),
          mix(launchStartY - 0.22, fireworkBurstY - 0.28, launchProgress),
          0.45,
        )
        fireworkRocketTrail.value.scale.set(0.5 + launchProgress * 0.8, 1.2 + launchProgress * 1.4, 0.5)
        ;(fireworkRocketTrail.value.material as MeshBasicMaterial).opacity = (1 - smoothStep(0.28, 0.43, localProgress)) * 0.5
      }
      if (fireworkBurstGroup.value) {
        fireworkBurstGroup.value.position.set(fireworkBurstX, fireworkBurstY, 0.4)
        fireworkBurstGroup.value.rotation.z += delta * 0.14
      }
      fireworkParticles.value.forEach((particle, particleIndex) => {
        const direction = fireworkDirections[particleIndex]!
        const stagger = (particleIndex % 7) * 0.012
        const localBurst = clamp01((burstProgress - stagger) / Math.max(0.1, 1 - stagger))
        const distance = burstEase * (0.34 + (particleIndex % 5) * 0.045) * (reducedMotionPreferred ? 1.15 : 2.65)
        particle.position.set(
          direction.x * distance,
          direction.y * distance - Math.pow(localBurst, 2) * 0.42,
          direction.z * distance,
        )
        const particleScale = Math.max(0.001, (0.8 + (particleIndex % 4) * 0.11) * Math.sin(localBurst * Math.PI) * fade)
        particle.scale.setScalar(particleScale)
        ;(particle.material as MeshBasicMaterial).opacity = Math.max(0, Math.sin(localBurst * Math.PI) * fade * 0.94)
      })
    }
    else {
      fireworkParticles.value.forEach((particle) => {
        particle.scale.setScalar(0.001)
        ;(particle.material as MeshBasicMaterial).opacity = 0
      })
    }
  }

  if (cloudNapGroup.value) {
    cloudNapGroup.value.visible = isCloudNap
    const cloudScale = isCloudNap ? Math.max(0.001, cloudNapPose * (1 + Math.sin(elapsed * 1.4) * 0.025)) : 0.001
    cloudNapGroup.value.scale.setScalar(cloudScale)
    cloudNapGroup.value.position.x = pet.position.x
    cloudNapGroup.value.position.y = -1.02 + Math.sin(elapsed * 1.15) * 0.028
    cloudNapGroup.value.rotation.z = Math.sin(elapsed * 0.7) * 0.018
  }
  if (cloudNapZzzGroup.value) {
    cloudNapZzzGroup.value.visible = isCloudNap && cloudNapPose > 0.2
    cloudNapZzzGroup.value.position.y = 0.72 + ((stateElapsed * 0.16) % 0.72)
    cloudNapZzzGroup.value.position.x = 0.88 + Math.sin(elapsed * 0.9) * 0.05
    cloudNapZzzGroup.value.scale.setScalar(Math.max(0.001, cloudNapPose * (0.72 + Math.sin(elapsed * 1.7) * 0.08)))
  }

  if (starJuggleGroup.value) {
    starJuggleGroup.value.visible = isStarJuggle
    starJuggleGroup.value.scale.setScalar(isStarJuggle ? Math.max(0.001, jugglePose) : 0.001)
    starJuggleGroup.value.rotation.y += delta * (isStarJuggle ? 0.55 : 0)
    const stars = [starOrbA.value, starOrbB.value, starOrbC.value]
    stars.forEach((star, index) => {
      if (!star) return
      const phase = juggleProgress * Math.PI * 6 + index * (Math.PI * 2 / 3)
      const arc = Math.max(0, Math.sin(phase))
      star.position.x = Math.cos(phase) * 0.76
      star.position.y = 0.18 + arc * 1.35 + index * 0.025
      star.position.z = 0.82 + Math.sin(phase * 0.5) * 0.16
      star.rotation.z += delta * (2.2 + index * 0.45)
      star.scale.setScalar(0.78 + arc * 0.28)
    })
  }

  if (sneezeSparkGroup.value) {
    const spark = sneezeRelease
    sneezeSparkGroup.value.visible = isSparkleSneeze && spark > 0.01
    sneezeSparkGroup.value.scale.setScalar(Math.max(0.001, spark * (reducedMotionPreferred ? 0.55 : 1.2)))
    sneezeSparkGroup.value.position.x = 0.06 + spark * 0.52
    sneezeSparkGroup.value.rotation.z += delta * 3.5
    ;[sneezeSparkA.value, sneezeSparkB.value, sneezeSparkC.value].forEach((mesh, index) => {
      if (!mesh) return
      const angle = index * 2.1 + elapsed * 1.8
      mesh.position.x = Math.cos(angle) * (0.16 + spark * 0.28)
      mesh.position.y = Math.sin(angle) * (0.12 + spark * 0.22)
      ;(mesh.material as MeshBasicMaterial).opacity = spark * (0.72 - index * 0.12)
    })
  }

  if (isSpinning) {
    const easedSpin = 1 - Math.pow(1 - spinProgress, 3)
    action.rotation.y = spinStartRotation + easedSpin * Math.PI * 2
  }
  else if (isTailTornado) {
    const easedSpin = smoothStep(0.12, 0.9, tornadoProgress)
    action.rotation.y = tornadoStartRotation + easedSpin * Math.PI * (reducedMotionPreferred ? 0.55 : 5)
  }
  else {
    if (Math.abs(action.rotation.y) >= Math.PI * 2 - 0.001) {
      action.rotation.y -= Math.round(action.rotation.y / (Math.PI * 2)) * Math.PI * 2
    }
    action.rotation.y = damp(action.rotation.y, wrapAngleNear(action.rotation.y, 0), 5.4, delta)
  }

  let swayTargetY = pointerX * 0.18 + (isPlaying ? Math.sin(elapsed * 2.4) * 0.08 : 0)
  if (isExcited) swayTargetY = Math.sin(elapsed * 2.2) * 0.42
  else if (isCuriousScan) swayTargetY = Math.sin(curiousProgress * Math.PI * 4) * 0.32 * curiousPose
  else if (isEating || isStretching || isBackflip || isTailTornado || isEnergyBurst || isAntennaCharge || isCloudNap) swayTargetY = 0
  else if (isFireworksShow) swayTargetY = fireworkBurstX * 0.08
  else if (isStarJuggle) swayTargetY = Math.sin(juggleProgress * Math.PI * 6) * 0.1
  else if (isPlayingBall || isDivingCatch) swayTargetY = clamp((ballGroup.value?.position.x || 0) * 0.08, -0.1, 0.1)
  look.rotation.y = damp(look.rotation.y, swayTargetY, 4.2, delta)

  let targetPetRotX = 0
  if (isListening) targetPetRotX = -0.14
  else if (isSleeping) targetPetRotX = 0.16
  else if (isResting) targetPetRotX = 0.22
  else if (isEating) targetPetRotX = 0.055
  else if (isCloudNap) targetPetRotX = 0.08 + cloudNapPose * 0.08
  else if (isAntennaCharge) targetPetRotX = -antennaChargePose * 0.08 + antennaRelease * 0.06
  else if (isTailGlow) targetPetRotX = -tailGlowPose * 0.035
  else if (isSparkleSneeze) targetPetRotX = -sneezeCharge * 0.12 + sneezeRelease * 0.18
  else if (isFireworksShow) targetPetRotX = -0.04
  else if (isStretching) targetPetRotX = -0.05 - stretchStrength * 0.08
  else if (isWaking) targetPetRotX = -0.08
  else if (isJumping) targetPetRotX = -Math.sin(jumpProgress * Math.PI) * 0.12

  if (isBackflip) {
    const flipProgress = smoothStep(0.18, 0.82, backflipProgress)
    action.rotation.x = backflipStartRotation - flipProgress * Math.PI * (reducedMotionPreferred ? 0.42 : 2)
  }
  else {
    if (Math.abs(action.rotation.x) >= Math.PI * 2 - 0.001) {
      action.rotation.x -= Math.round(action.rotation.x / (Math.PI * 2)) * Math.PI * 2
    }
    const highPoseX = isDivingCatch ? -catchDive * 0.34 : isEnergyBurst ? energyCharge * 0.06 : isFireworksShow ? -0.05 : targetPetRotX
    action.rotation.x = damp(action.rotation.x, highPoseX, 5.4, delta)
  }

  if (isWaking) {
    action.rotation.z = Math.sin(elapsed * 7) * 0.035
  }
  else if (isTailTornado) {
    action.rotation.z = Math.sin(tornadoProgress * Math.PI * 12) * 0.06 * tornadoStrength
  }
  else if (isDivingCatch) {
    action.rotation.z = damp(action.rotation.z, Math.sin(catchProgress * Math.PI) * 0.12, 8, delta)
  }
  else if (isShyPeek) {
    action.rotation.z = damp(action.rotation.z, -0.08 * shyPose, 7, delta)
  }
  else if (isCloudNap) {
    // 云朵午睡将身体平放在云面上，进入与退出仍通过阻尼保持柔和。 / Cloud nap lays the body flat across the cloud while damped entry and exit preserve a soft transition.
    action.rotation.z = damp(action.rotation.z, -1.52 * cloudNapPose, 4.2, delta)
  }
  else if (isCuriousScan) {
    action.rotation.z = damp(action.rotation.z, Math.sin(curiousProgress * Math.PI * 3) * 0.08 * curiousPose, 7, delta)
  }
  else if (isSparkleSneeze) {
    action.rotation.z = damp(action.rotation.z, Math.sin(sneezeProgress * Math.PI * 3) * 0.035 * sneezeCharge, 9, delta)
  }
  else if (isPlaying || isFlapping) {
    action.rotation.z = Math.sin(elapsed * (isFlapping ? 8 : 5)) * (isFlapping ? 0.055 : 0.03)
  }
  else {
    action.rotation.z = damp(action.rotation.z, 0, 7, delta)
  }

  const jumpSquashX = isJumping ? 1 + Math.sin(jumpProgress * Math.PI) * 0.07 : 1
  const jumpSquashY = isJumping ? 1 - jumpLanding * 0.08 : 1
  const stretchEase = stretchStrength
  const targetScaleX = (isBackflip ? 1 - backflipFlight * 0.08 : isTailTornado ? 0.92 + tornadoStrength * 0.08 : isDivingCatch ? 1 + catchDive * 0.12 : isEnergyBurst ? 1 - energyCharge * 0.08 : isCloudNap ? 1.12 + cloudNapPose * 0.08 : isSparkleSneeze ? 1 + sneezeRelease * 0.08 : isSpinning ? 0.94 : isHappy ? 1.02 : isResting ? 1.1 : isStretching ? 1 - stretchEase * 0.035 : 1) * jumpSquashX
  const targetScaleY = (isBackflip
    ? 1 + backflipFlight * 0.1
    : isTailTornado
      ? 1.04 - tornadoStrength * 0.08
      : isDivingCatch
        ? 1 - catchDive * 0.1
        : isEnergyBurst
          ? 1 - energyCharge * 0.1 + energyRelease * 0.13
          : isCloudNap
            ? 0.78 + (1 - cloudNapPose) * 0.22
            : isSparkleSneeze
              ? 1 - sneezeCharge * 0.05 + sneezeRelease * 0.12
              : isSpinning
    ? 1.06
    : isHappy
      ? 0.98 + Math.sin(elapsed * 8.5) * 0.02
      : isResting
        ? 0.78
        : isStretching
          ? 1 + stretchEase * 0.13 + stretchHoldBreath
          : isEating
            ? 0.96 + Math.sin(elapsed * 7) * 0.012
            : 1 + Math.sin(elapsed * 1.9) * 0.01) * jumpSquashY
  const targetScaleZ = isDivingCatch ? 1 + catchDive * 0.12 : isEnergyBurst ? 1 + energyRelease * 0.08 : isAntennaCharge ? 1 + antennaRelease * 0.06 : isTailGlow ? 1 + tailGlowWave * 0.035 : isCloudNap ? 1.04 : isSparkleSneeze ? 1 + sneezeRelease * 0.06 : isListening ? 0.98 : isResting ? 1.08 : isStretching ? 0.98 + stretchEase * 0.025 : 1
  action.scale.x = damp(action.scale.x, targetScaleX, 6, delta)
  action.scale.y = damp(action.scale.y, targetScaleY, 6, delta)
  action.scale.z = damp(action.scale.z, targetScaleZ, 6, delta)

  // 视线优先级：球 > 饭盆 > 动作目标 > 鼠标。 / Gaze priority: ball > bowl > motion target > pointer.
  const ballLookX = isPlayingBall || isDivingCatch
    ? clamp((ballGroup.value?.position.x || 0) * 0.42, -0.48, 0.48)
    : 0
  const ballLookY = isPlayingBall || isDivingCatch
    ? clamp((head.position.y - (ballGroup.value?.position.y || GROUND_Y)) * 0.16, -0.24, 0.48)
    : 0
  let headTargetYRotation = pointerX * 0.34 + scanX + greetingWave * 0.025
  if (isSleeping || isResting || isEating || isStretching || isCloudNap) headTargetYRotation = 0
  else if (isCuriousScan) headTargetYRotation = Math.sin(curiousProgress * Math.PI * 4) * 0.42 * curiousPose
  else if (isFireworksShow) headTargetYRotation = clamp(fireworkBurstX * 0.18, -0.24, 0.24)
  else if (isStarJuggle) headTargetYRotation = Math.sin(juggleProgress * Math.PI * 6) * 0.28
  else if (isShyPeek) headTargetYRotation = -0.18 * shyPose
  else if (isPlayingBall || isDivingCatch) headTargetYRotation = ballLookX

  let headTargetXRotation = pointerY * 0.18 + (isHappy ? Math.sin(elapsed * 8.5) * 0.03 : 0)
  if (isSleeping) headTargetXRotation = 0.35
  else if (isCloudNap) headTargetXRotation = 0.04
  else if (isResting) headTargetXRotation = 0.28
  else if (isEating) headTargetXRotation = 0.34 + Math.sin(elapsed * 7.4) * 0.018
  else if (isFireworksShow) headTargetXRotation = -0.42 + Math.sin(fireworksProgress * Math.PI * 6) * 0.035
  else if (isSparkleSneeze) headTargetXRotation = -0.18 * sneezeCharge + 0.34 * sneezeRelease
  else if (isShyPeek) headTargetXRotation = -0.04 - shyPose * 0.04
  else if (isStretching) headTargetXRotation = -0.28 - stretchEase * 0.22
  else if (isCuriousScan) headTargetXRotation = -0.08 + Math.sin(curiousProgress * Math.PI * 2) * 0.08 * curiousPose
  else if (isPlayingBall || isDivingCatch) headTargetXRotation = ballLookY
  else if (isListening) headTargetXRotation = -0.22 + pointerY * 0.1

  let headTargetZRotation = 0
  if (isConfused) headTargetZRotation = 0.28 + Math.sin(elapsed * 5.5) * 0.05
  else if (isShyPeek) headTargetZRotation = 0.2 * shyPose
  else if (isCloudNap) headTargetZRotation = 0.14 * cloudNapPose
  else if (isCuriousScan) headTargetZRotation = Math.sin(curiousProgress * Math.PI * 3) * 0.2 * curiousPose
  else if (isSparkleSneeze) headTargetZRotation = -0.06 * sneezeCharge + Math.sin(sneezeProgress * Math.PI * 5) * 0.1 * sneezeRelease
  else if (isEnergyBurst) headTargetZRotation = Math.sin(elapsed * 5.5) * 0.035 * energyCharge
  else if (isGreeting) headTargetZRotation = Math.sin(elapsed * 6) * 0.12
  else if (isPlaying || isFlapping || isStarJuggle) headTargetZRotation = Math.sin(elapsed * 4.5) * 0.06

  head.rotation.y += (headTargetYRotation - head.rotation.y) * Math.min(1, delta * 5.5)
  head.rotation.x += (headTargetXRotation - head.rotation.x) * Math.min(1, delta * 5.5)
  head.rotation.z += (headTargetZRotation - head.rotation.z) * Math.min(1, delta * 5.5)

  const headTargetPositionY = isCloudNap
    ? 0.82
    : isResting
      ? 0.62
      : isEating
        ? 0.34
        : isShyPeek
          ? 0.92 + shyPose * 0.03
          : isFireworksShow
            ? 0.94
            : isStretching
              ? 0.92 + stretchEase * 0.14
              : isEnergyBurst
                ? 0.92 + energyCharge * 0.06
                : isListening
                  ? 0.82
                  : 0.92
  const headTargetPositionZ = isCloudNap
    ? 0.38
    : isResting
      ? 0.3
      : isEating
        ? 0.42
        : isShyPeek
          ? 0.12 + shyPose * 0.06
          : isStretching
            ? 0.06 - stretchEase * 0.05
            : isEnergyBurst
              ? 0.04 - energyCharge * 0.04
              : isListening
                ? 0.12
                : 0.06
  head.position.y += (headTargetPositionY - head.position.y) * Math.min(1, delta * 5)
  head.position.z += (headTargetPositionZ - head.position.z) * Math.min(1, delta * 5)

  if (torsoGroup.value) {
    const torso = torsoGroup.value
    torso.position.y = damp(torso.position.y, isCloudNap ? -cloudNapPose * 0.04 : isStretching ? stretchEase * 0.08 : isEating ? -0.025 : 0, 6, delta)
    torso.position.z = damp(torso.position.z, isCloudNap ? cloudNapPose * 0.12 : isStretching ? -stretchEase * 0.025 : isEating ? 0.055 : 0, 6, delta)
    torso.rotation.x = damp(torso.rotation.x, isCloudNap ? -cloudNapPose * 0.08 : isStretching ? -stretchEase * 0.1 : isEating ? 0.055 : 0, 6, delta)
    torso.scale.x = damp(torso.scale.x, isCloudNap ? 1.1 : isStretching ? 1 - stretchEase * 0.03 : 1, 6, delta)
    torso.scale.y = damp(torso.scale.y, isCloudNap ? 0.94 : isStretching ? 1 + stretchEase * 0.09 : 1, 6, delta)
    torso.scale.z = damp(torso.scale.z, isCloudNap ? 1.08 : isStretching ? 1 + stretchEase * 0.025 : 1, 6, delta)
  }

  if (eyeGroup.value) {
    const blinkPulse = Math.pow(Math.max(0, Math.sin(elapsed * 0.68)), 28)
    const blinkSpeedUp = isPlaying || isExcited || isFlapping
      ? Math.pow(Math.max(0, Math.sin(elapsed * 1.4)), 36)
      : 0
    const happySquint = isHappy || isGreeting || isJumping || isFlapping || isHighEnergy || isStarJuggle || isShyPeek ? 0.72 : 1
    const targetEyeY = isSleeping || isResting || isCloudNap
      ? 0.1
      : isSparkleSneeze && sneezeRelease > 0.12
        ? 0.08
        : isFireworksShow
          ? 0.9
          : happySquint - Math.max(blinkPulse, blinkSpeedUp) * 0.9
    const targetEyeX = isListening ? 1.06 : isThinking ? 0.96 : isExcited ? 1.08 : 1
    eyeGroup.value.scale.y += (Math.max(0.08, targetEyeY) - eyeGroup.value.scale.y) * Math.min(1, delta * 18)
    eyeGroup.value.scale.x += (targetEyeX - eyeGroup.value.scale.x) * Math.min(1, delta * 10)
    const eyeShiftY = isListening ? 0.03 : isConfused ? 0.015 : 0
    eyeGroup.value.position.y += (eyeShiftY - eyeGroup.value.position.y) * Math.min(1, delta * 6)
  }

  if (leftEye.value && rightEye.value) {
    const leftY = isConfused ? 1.12 : 1
    const rightY = isConfused ? 0.82 : 1
    leftEye.value.scale.y += (leftY - leftEye.value.scale.y) * Math.min(1, delta * 8)
    rightEye.value.scale.y += (rightY - rightEye.value.scale.y) * Math.min(1, delta * 8)
    leftEye.value.rotation.z += ((isConfused ? -0.06 : 0) - leftEye.value.rotation.z) * Math.min(1, delta * 8)
    rightEye.value.rotation.z += ((isConfused ? 0.08 : 0) - rightEye.value.rotation.z) * Math.min(1, delta * 8)

    let eyeOffsetX = pointerX * 0.038
    // 眼球局部 Y 向上为正，所以鼠标向下时使用负偏移。 / Local eye Y points upward, so a downward pointer uses a negative offset.
    let eyeOffsetY = -pointerY * 0.036
    if (isPlayingBall || isDivingCatch) {
      eyeOffsetX = clamp((ballGroup.value?.position.x || 0) * 0.038, -0.052, 0.052)
      eyeOffsetY = clamp(((ballGroup.value?.position.y || GROUND_Y) - head.position.y) * 0.032, -0.058, 0.052)
    }
    else if (isFireworksShow) {
      eyeOffsetX = clamp(fireworkBurstX * 0.025, -0.045, 0.045)
      eyeOffsetY = 0.052
    }
    else if (isStarJuggle) {
      eyeOffsetX = Math.sin(juggleProgress * Math.PI * 6) * 0.045
      eyeOffsetY = 0.018 + Math.max(0, Math.sin(juggleProgress * Math.PI * 6)) * 0.026
    }
    else if (isCuriousScan) {
      eyeOffsetX = Math.sin(curiousProgress * Math.PI * 4) * 0.052 * curiousPose
      eyeOffsetY = Math.cos(curiousProgress * Math.PI * 2) * 0.012 * curiousPose
    }
    else if (isShyPeek) {
      eyeOffsetX = -0.024 * shyPose
      eyeOffsetY = -0.006
    }
    else if (isEating) {
      eyeOffsetX = 0
      eyeOffsetY = -0.048
    }
    else if (isStretching) {
      eyeOffsetX = 0
      eyeOffsetY = 0.026
    }

    leftEye.value.position.x = damp(leftEye.value.position.x, LEFT_EYE_BASE_X + eyeOffsetX, 10, delta)
    rightEye.value.position.x = damp(rightEye.value.position.x, RIGHT_EYE_BASE_X + eyeOffsetX, 10, delta)
    leftEye.value.position.y = damp(leftEye.value.position.y, EYE_BASE_Y + eyeOffsetY, 10, delta)
    rightEye.value.position.y = damp(rightEye.value.position.y, EYE_BASE_Y + eyeOffsetY, 10, delta)
  }

  if (mouthGroup.value) {
    const talkOpen = isTalking ? 0.55 + Math.abs(Math.sin(elapsed * 10.8)) * 1.25 : 0.5
    const eatOpen = isEating ? 0.35 + Math.abs(Math.sin(elapsed * 8.4)) * 0.58 : talkOpen
    const targetMouthY = isSleeping || isResting || isCloudNap
      ? 0.16
      : isSparkleSneeze
        ? 0.32 + sneezeCharge * 0.2 + sneezeRelease * 0.52
        : isShyPeek
          ? 0.28 + shyPose * 0.16
          : isEating
            ? eatOpen
            : isConfused
              ? 0.34
              : isHappy || isGreeting || isJumping || isFlapping || isHighEnergy || isStarJuggle
                ? 0.72
                : talkOpen
    const targetMouthX = isHappy || isGreeting || isJumping || isFlapping || isHighEnergy || isStarJuggle
      ? 1.3
      : isShyPeek
        ? 0.82
        : isConfused
          ? 0.82
          : isSleeping || isResting || isCloudNap
            ? 0.72
            : 1
    mouthGroup.value.scale.y += (targetMouthY - mouthGroup.value.scale.y) * Math.min(1, delta * 15)
    mouthGroup.value.scale.x += (targetMouthX - mouthGroup.value.scale.x) * Math.min(1, delta * 10)
    mouthGroup.value.rotation.z += ((isConfused ? -0.12 : 0) - mouthGroup.value.rotation.z) * Math.min(1, delta * 8)
  }

  if (cheeksGroup.value) {
    const showCheeks = isHappy || isGreeting || isPlaying || isJumping || isFlapping || isExcited || isStretching || isPlayingBall || isEating || isHighEnergy || isGlowMotion || isShyPeek || isStarJuggle || isSparkleSneeze
    const cheekScale = showCheeks ? (isShyPeek ? 1.35 : isSparkleSneeze ? 1.18 : 1) + Math.sin(elapsed * 4.2) * 0.05 : 0.001
    cheeksGroup.value.scale.x += (cheekScale - cheeksGroup.value.scale.x) * Math.min(1, delta * 7)
    cheeksGroup.value.scale.y += (cheekScale - cheeksGroup.value.scale.y) * Math.min(1, delta * 7)
    cheeksGroup.value.scale.z += (cheekScale - cheeksGroup.value.scale.z) * Math.min(1, delta * 7)
  }

  const earBase = isListening ? 0.1 : isResting || isCloudNap ? -0.08 : isShyPeek ? -0.04 * shyPose : 0
  const earEnergy = isThinking
    ? 0.18
    : isHappy
      ? -0.11
      : isConfused
        ? 0.22
        : isGreeting
          ? 0.04
          : isSparkleSneeze
            ? Math.sin(sneezeProgress * Math.PI * 8) * 0.12 * sneezeCharge
            : isHighEnergy
            ? Math.sin(elapsed * (isTailTornado ? 14 : 9)) * (isEnergyBurst ? 0.14 * energyCharge : 0.1)
            : isFlapping
              ? Math.sin(elapsed * 10) * 0.09
              : 0
  if (leftEar.value && rightEar.value) {
    leftEar.value.rotation.z = -0.16 + earBase + earEnergy + Math.sin(elapsed * (isPlaying ? 6 : 2.6)) * 0.028
    rightEar.value.rotation.z = 0.16 - earBase - earEnergy - Math.sin(elapsed * (isPlaying ? 6 : 2.6)) * 0.028
  }

  const antennaCharge = isAntennaCharge
    ? antennaChargePose * 1.2 + antennaRelease * 0.9
    : isEnergyBurst
      ? energyCharge + energyRelease * 0.78
      : isFireworksShow
        ? 0.7 + Math.sin(fireworksProgress * Math.PI * 6) * 0.18
        : isSparkleSneeze
          ? sneezeCharge + sneezeRelease * 0.7
          : isStarJuggle
            ? 0.42
            : isExcited || isThinking
              ? 0.36
              : isHighEnergy
                ? 0.28
                : 0.12
  const antennaSway = Math.sin(elapsed * (isEnergyBurst ? 9 : isExcited ? 6.5 : 3.4)) * (isEnergyBurst ? 0.08 : 0.035)
  if (leftAntenna.value && rightAntenna.value) {
    const converge = isAntennaCharge ? antennaChargePose * 0.42 : 0
    leftAntenna.value.rotation.z = damp(leftAntenna.value.rotation.z, -0.15 - antennaCharge * 0.1 + converge - antennaSway, 8, delta)
    rightAntenna.value.rotation.z = damp(rightAntenna.value.rotation.z, 0.15 + antennaCharge * 0.1 - converge + antennaSway, 8, delta)
    leftAntenna.value.scale.y = damp(leftAntenna.value.scale.y, 1 + antennaCharge * 0.16, 7, delta)
    rightAntenna.value.scale.y = damp(rightAntenna.value.scale.y, 1 + antennaCharge * 0.16, 7, delta)
  }
  if (leftAntennaTip.value && rightAntennaTip.value) {
    const antennaGlow = 1 + antennaCharge * 0.9 + Math.sin(elapsed * (isEnergyBurst ? 16 : 8)) * 0.12
    leftAntennaTip.value.scale.setScalar(antennaGlow)
    rightAntennaTip.value.scale.setScalar(antennaGlow)
    ;(leftAntennaTip.value.material as { emissiveIntensity?: number }).emissiveIntensity = 1.6 + antennaCharge * 5.6
    ;(rightAntennaTip.value.material as { emissiveIntensity?: number }).emissiveIntensity = 1.6 + antennaCharge * 5.6
  }

  if (tailGroup.value) {
    const wagSpeed = isHappy
      ? 6.8
      : isTailTornado
        ? 14.5
        : isTailGlow
        ? 5.4
        : isBackflip || isDivingCatch || isEnergyBurst || isFireworksShow
          ? isFireworksShow ? 4.6 : 9.4
          : isPlaying || isFlapping || isPlayingBall || isStarJuggle
        ? 8.4
        : isExcited || isJumping
          ? 7.6
          : isStretching
            ? 2.1
            : isEating
              ? 1.7
              : isCloudNap
                ? 0.8
                : isResting
                  ? 1.25
                  : 2.35
    const wagAmount = isHappy
      ? 0.18
      : isTailTornado
        ? 0.52 * highMotionScale
        : isTailGlow
        ? 0.2 + tailGlowWave * 0.14
        : isBackflip || isDivingCatch || isEnergyBurst || isFireworksShow
          ? (isFireworksShow ? 0.18 : 0.32) * highMotionScale
          : isPlaying || isFlapping || isPlayingBall || isStarJuggle
        ? 0.26
        : isExcited || isJumping
          ? 0.22
          : isStretching
            ? 0.13
            : isEating
              ? 0.04
              : isCloudNap
                ? 0.012
                : isResting
                  ? 0.025
                  : 0.075
    const rootWave = Math.sin(elapsed * wagSpeed)
    const midWave = Math.sin(elapsed * wagSpeed - 0.62)
    const tipWave = Math.sin(elapsed * wagSpeed - 1.18)
    const restFold = isResting || isSleeping || isCloudNap ? -0.1 : 0

    const stretchTailLift = isStretching ? stretchEase : 0
    // 尾根小幅转动，中段与尾尖逐级放大并延迟 / The root stays restrained while the middle and tip amplify the delayed wave.
    const rootTargetZ = -0.08 + rootWave * wagAmount * 0.24 + restFold * 0.45 - stretchTailLift * 0.05
    const rootTargetX = 0.03 + Math.cos(elapsed * wagSpeed * 0.45) * 0.018 - stretchTailLift * 0.06
    const rootTargetY = 0.08 + Math.sin(elapsed * wagSpeed * 0.32) * wagAmount * 0.08
    tailGroup.value.rotation.z += (rootTargetZ - tailGroup.value.rotation.z) * Math.min(1, delta * 6.5)
    tailGroup.value.rotation.x += (rootTargetX - tailGroup.value.rotation.x) * Math.min(1, delta * 5)
    tailGroup.value.rotation.y += (rootTargetY - tailGroup.value.rotation.y) * Math.min(1, delta * 5)

    if (tailMidGroup.value) {
      const midTargetZ = 0.1 + midWave * wagAmount * 0.62 + restFold * 0.42 + stretchTailLift * 0.14
      const midTargetY = Math.cos(elapsed * wagSpeed - 0.45) * wagAmount * 0.1
      tailMidGroup.value.rotation.z += (midTargetZ - tailMidGroup.value.rotation.z) * Math.min(1, delta * 7.2)
      tailMidGroup.value.rotation.y += (midTargetY - tailMidGroup.value.rotation.y) * Math.min(1, delta * 6.2)
    }

    if (tailTipGroup.value) {
      const tipTargetZ = 0.16 + tipWave * wagAmount * 1.02 + restFold * 0.28 + stretchTailLift * 0.22
      const tipTargetY = Math.cos(elapsed * wagSpeed - 0.8) * wagAmount * 0.18 + stretchTailLift * 0.04
      tailTipGroup.value.rotation.z += (tipTargetZ - tailTipGroup.value.rotation.z) * Math.min(1, delta * 8)
      tailTipGroup.value.rotation.y += (tipTargetY - tailTipGroup.value.rotation.y) * Math.min(1, delta * 6.5)
    }

    if (tailEnergy.value) {
      const glowBoost = isTailGlow
        ? 0.22 + tailGlowPose * 0.32 + tailGlowWave * 0.22
        : isAntennaCharge
          ? antennaChargePose * 0.14 + antennaRelease * 0.1
          : isEnergyBurst
            ? energyCharge * 0.32 + energyRelease * 0.18
            : isHighEnergy
              ? 0.18
              : isExcited
                ? 0.12
                : 0
      const tailPulse = 1 + Math.sin(elapsed * (isExcited ? 8 : isThinking || isPlayingBall ? 5 : 2.8)) * (isExcited || isPlayingBall ? 0.14 : 0.06) + glowBoost
      tailEnergy.value.scale.setScalar(tailPulse)
      const flashTail = !reducedMotionPreferred && (isTailGlow || isTailTornado || isEnergyBurst || isStarJuggle || isFireworksShow)
      const flashPulse = flashTail ? 0.5 + Math.sin(elapsed * 11) * 0.5 : 0
      const material = tailEnergy.value.material as MeshBasicMaterial
      if (flashTail) {
        tailFlashColor.setHSL((elapsed * 0.72) % 1, 0.92, 0.7)
        material.color.copy(tailFlashColor)
      }
      else {
        material.color.set(tailTipBase.value)
      }
    }

    if (tailMidMesh.value) {
      const material = tailMidMesh.value.material as MeshStandardMaterial
      material.emissive?.set(secondary.value)
      material.emissiveIntensity = isTailGlow ? 0.35 + tailGlowWave * 1.6 : 0.04
    }
    if (tailTipMesh.value) {
      const material = tailTipMesh.value.material as MeshStandardMaterial
      const flashTail = !reducedMotionPreferred && (isTailGlow || isTailTornado || isEnergyBurst || isStarJuggle || isFireworksShow)
      const flashPulse = flashTail ? 0.5 + Math.sin(elapsed * 11) * 0.5 : 0
      if (flashTail) {
        tailFlashColor.setHSL((elapsed * 0.72 + 0.08) % 1, 0.94, 0.72)
        material.color.copy(tailFlashColor)
        material.emissive.copy(tailFlashColor)
      }
      else {
        material.color.set(tailTipBase.value)
        material.emissive.set(tailTipBase.value)
      }
      material.emissiveIntensity = isTailGlow ? 3.2 + tailGlowWave * 4.2 + flashPulse * 2.4 : props.secretMode ? 3.8 : 2.6 + flashPulse * 2.6
    }
    if (tailAura.value) {
      const material = tailAura.value.material as MeshBasicMaterial
      const flashTail = !reducedMotionPreferred && (isTailGlow || isTailTornado || isEnergyBurst || isStarJuggle || isFireworksShow)
      if (flashTail) {
        tailFlashColor.setHSL((elapsed * 0.72 + 0.16) % 1, 0.9, 0.72)
        material.color.copy(tailFlashColor)
      }
      else material.color.set(tailTipBase.value)
      material.opacity = flashTail ? 0.38 + (0.5 + Math.sin(elapsed * 11) * 0.5) * 0.26 : props.secretMode ? 0.4 : 0.34
    }

    const highTailEnergy = isTailGlow || isPlaying || isPlayingBall || isStarJuggle || isJumping || isSpinning || isExcited || isHighEnergy
    const trailStrength = highTailEnergy ? (isFireworksShow ? 0.48 : 0.34) : isHappy || isThinking ? 0.14 : isEating || isResting || isCloudNap ? 0.03 : 0.07
    if (tailTrailGroup.value) {
      tailTrailGroup.value.scale.x = damp(tailTrailGroup.value.scale.x, highTailEnergy ? 1.18 : 0.82, 7, delta)
      tailTrailGroup.value.rotation.z = damp(tailTrailGroup.value.rotation.z, -tipWave * wagAmount * 0.8, 6, delta)
    }
    if (tailTrailPrimary.value) {
      ;(tailTrailPrimary.value.material as { opacity?: number }).opacity = trailStrength
      tailTrailPrimary.value.scale.x = 0.8 + Math.abs(tipWave) * (highTailEnergy ? 0.55 : 0.16)
    }
    if (tailTrailSecondary.value) {
      ;(tailTrailSecondary.value.material as { opacity?: number }).opacity = trailStrength * 0.5
      tailTrailSecondary.value.scale.x = 0.72 + Math.abs(midWave) * (highTailEnergy ? 0.42 : 0.12)
    }

    const particleStrength = highTailEnergy ? (isFireworksShow ? 0.92 : 0.72) : isThinking ? 0.38 : isEating || isResting || isCloudNap ? 0.04 : 0.16
    if (tailParticleGroup.value) {
      tailParticleGroup.value.rotation.z += delta * (highTailEnergy ? 1.6 : 0.45)
      tailParticleGroup.value.scale.setScalar(0.82 + Math.sin(elapsed * 2.8) * 0.08)
    }
    const particles = [tailParticleA.value, tailParticleB.value, tailParticleC.value]
    particles.forEach((particle, index) => {
      if (!particle) return
      const phase = elapsed * (1.35 + index * 0.18) + index * 2.1
      particle.position.x = -0.4 + Math.cos(phase) * (0.1 + index * 0.03)
      particle.position.y = 0.34 + Math.sin(phase * 1.2) * (0.1 + index * 0.025)
      particle.position.z = 0.04 + Math.sin(phase * 0.8) * 0.06
      particle.scale.setScalar(0.55 + Math.sin(phase * 1.7) * 0.18)
      ;(particle.material as { opacity?: number }).opacity = Math.max(0.02, particleStrength * (0.55 + Math.sin(phase) * 0.35))
    })
  }

  if (haloGroup.value) {
    haloGroup.value.rotation.y += delta * (isAntennaCharge ? 4.4 : isTailGlow ? 2.6 : isEnergyBurst ? 5.2 : isTailTornado ? 4.6 : isThinking ? 1.8 : isExcited ? 3.3 : isSpinning ? 2.5 : 0.45)
    haloGroup.value.rotation.z += delta * (isAntennaCharge ? 2.1 : isTailGlow ? 1.4 : isEnergyBurst ? 2.4 : isTailTornado ? 2 : isExcited ? 1.1 : isPlaying || isFlapping ? 0.6 : 0.12)
    haloGroup.value.position.y = 0.08 + Math.sin(elapsed * 1.8) * 0.03
    let haloScale = 1
    if (props.secretMode) haloScale = 1.28 + Math.sin(elapsed * 3) * 0.05
    else if (isFireworksShow) haloScale = 1.12 + Math.sin(elapsed * 2.2) * 0.035
    else if (isStarJuggle) haloScale = 1.06 + Math.sin(elapsed * 3.2) * 0.025
    else if (isListening) haloScale = 1.04
    else if (isJumping) haloScale = 1 + jumpOffset * 0.12
    else if (isAntennaCharge) haloScale = 1 + antennaChargePose * 0.18 + antennaRelease * 0.12
    else if (isTailGlow) haloScale = 1 + tailGlowWave * 0.08
    else if (isResting) haloScale = 0.9
    haloGroup.value.scale.setScalar(haloScale)
  }

  if (coreMesh.value) {
    let corePulse = 1 + Math.sin(elapsed * (isThinking ? 5 : isExcited || isFlapping ? 8 : 2.8)) * (isExcited || isFlapping ? 0.15 : 0.08)
    if (isEnergyBurst) corePulse = 1 + energyCharge * 0.48 + energyRelease * 0.28 + Math.sin(elapsed * 12) * 0.08 * energyCharge
    else if (isAntennaCharge) corePulse = 1 + antennaChargePose * 0.3 + antennaRelease * 0.42 + Math.sin(elapsed * 11) * 0.06 * antennaChargePose
    else if (isTailGlow) corePulse = 1 + tailGlowWave * 0.16
    else if (isFireworksShow) corePulse = 1.12 + Math.sin(elapsed * 9) * 0.12
    else if (isSparkleSneeze) corePulse = 1 + sneezeCharge * 0.28 + sneezeRelease * 0.34
    else if (isStarJuggle) corePulse = 1.08 + Math.sin(elapsed * 6.5) * 0.1
    coreMesh.value.scale.setScalar(corePulse)
    const material = coreMesh.value.material as MeshStandardMaterial
    material.emissiveIntensity = isAntennaCharge ? 2.2 + antennaChargePose * 4 + antennaRelease * 3 : isTailGlow ? 2 + tailGlowWave * 2.2 : props.secretMode ? 4 : 1.8
  }

  if (shadowCore.value && shadowSoft.value) {
    const heightRatio = Math.max(0, Math.min(1, Math.max(jumpOffset / 0.9, backflipLift / 1.18, isDivingCatch ? Math.sin(catchProgress * Math.PI) * 0.42 : 0, isCloudNap ? cloudNapPose * 0.18 : 0)))
    const landingPunch = isJumping
      ? Math.pow(Math.sin(jumpProgress * Math.PI), 6) * 0.08
      : isBackflip
        ? pulse(backflipProgress, 0.76, 0.96) * 0.16
        : isDivingCatch
          ? pulse(catchProgress, 0.68, 0.9) * 0.12
          : isEnergyBurst
            ? energyRelease * 0.08
            : 0
    const shadowScaleX = 1.02 - heightRatio * 0.34 + landingPunch + stretchEase * 0.04
    const shadowScaleY = 0.34 - heightRatio * 0.08 + landingPunch * 0.18 + stretchEase * 0.018
    const shadowOpacity = 0.22 - heightRatio * 0.12 + landingPunch * 0.12
    const softOpacity = 0.1 - heightRatio * 0.05 + landingPunch * 0.06

    shadowCore.value.scale.x = damp(shadowCore.value.scale.x, shadowScaleX, 10, delta)
    shadowCore.value.scale.y = damp(shadowCore.value.scale.y, shadowScaleY, 10, delta)
    shadowSoft.value.scale.x = damp(shadowSoft.value.scale.x, shadowScaleX * 1.26, 8, delta)
    shadowSoft.value.scale.y = damp(shadowSoft.value.scale.y, shadowScaleY * 1.8, 8, delta)
    shadowCore.value.position.x = damp(shadowCore.value.position.x, pet.position.x * 0.12, 5, delta)
    shadowSoft.value.position.x = damp(shadowSoft.value.position.x, pet.position.x * 0.08, 4, delta)
    ;(shadowCore.value.material as { opacity?: number }).opacity = shadowOpacity
    ;(shadowSoft.value.material as { opacity?: number }).opacity = softOpacity
  }

  if (leftHindLeg.value && rightHindLeg.value) {
    const baseHindY = HIND_PAW_BASE_Y
    const baseHindZ = 0.22
    const hindSwing = isPlaying ? Math.sin(elapsed * 5.2) * 0.05 : 0
    const hindLift = isJumping ? Math.sin(jumpProgress * Math.PI) * 0.16 : 0
    const hindRest = isCloudNap ? -0.14 * cloudNapPose : isResting ? -0.08 : isStretching ? -stretchEase * 0.015 : 0
    const leftHindTargetY = baseHindY + hindRest + hindSwing + hindLift
    const rightHindTargetY = baseHindY + hindRest - hindSwing + hindLift
    const hindRotX = isCloudNap
      ? -0.58 * cloudNapPose
      : isResting
        ? -0.44
        : isStretching
        ? -0.04 - stretchEase * 0.04
        : isJumping
          ? 0.22 - hindLift * 0.5
          : isPlaying
            ? 0.08
            : 0.02
    const leftHindRotZ = -0.04 + hindSwing * 0.35
    const rightHindRotZ = 0.04 - hindSwing * 0.35

    leftHindLeg.value.position.y = damp(leftHindLeg.value.position.y, leftHindTargetY, 8, delta)
    rightHindLeg.value.position.y = damp(rightHindLeg.value.position.y, rightHindTargetY, 8, delta)
    leftHindLeg.value.position.z = damp(leftHindLeg.value.position.z, baseHindZ, 7, delta)
    rightHindLeg.value.position.z = damp(rightHindLeg.value.position.z, baseHindZ, 7, delta)
    leftHindLeg.value.rotation.x = damp(leftHindLeg.value.rotation.x, hindRotX, 7, delta)
    rightHindLeg.value.rotation.x = damp(rightHindLeg.value.rotation.x, hindRotX, 7, delta)
    leftHindLeg.value.rotation.z = damp(leftHindLeg.value.rotation.z, leftHindRotZ, 8, delta)
    rightHindLeg.value.rotation.z = damp(rightHindLeg.value.rotation.z, rightHindRotZ, 8, delta)
  }

  if (
    leftPaw.value && rightPaw.value
    && leftForearm.value && rightForearm.value
    && leftPawTip.value && rightPawTip.value
  ) {
    const leftTap = isPlayingBall ? pulse(ballProgress, 0.16, 0.31) + pulse(ballProgress, 0.68, 0.8) * 0.45 : 0
    const rightTap = isPlayingBall ? pulse(ballProgress, 0.48, 0.63) + pulse(ballProgress, 0.78, 0.9) * 0.35 : 0
    const breath = Math.sin(elapsed * 1.9) * 0.012
    const wave = greetingWave
    const dance = isPlaying ? Math.sin(elapsed * 7.2) : 0
    const flap = isFlapping ? Math.sin(stateElapsed * 11.5) : 0

    // 肩部只允许很小的位移与转角 / Shoulder roots only receive small offsets and rotations.
    let leftShoulderX = FRONT_PAW_LEFT_X
    let rightShoulderX = FRONT_PAW_RIGHT_X
    let leftShoulderY = FRONT_PAW_BASE_Y + breath
    let rightShoulderY = FRONT_PAW_BASE_Y + breath
    let leftShoulderZ = FRONT_PAW_BASE_Z
    let rightShoulderZ = FRONT_PAW_BASE_Z
    let leftShoulderRotX = 0
    let rightShoulderRotX = 0
    let leftShoulderRotZ = -0.035
    let rightShoulderRotZ = 0.035

    // 前臂负责抬起、前伸和收拢 / Forearms carry lifting, reaching and folding.
    let leftForearmRotX = 0
    let rightForearmRotX = 0
    let leftForearmRotZ = -0.06
    let rightForearmRotZ = 0.06
    let leftForearmScaleY = 1
    let rightForearmScaleY = 1

    // 爪端负责挥动、拍击和接触反馈 / Paw tips handle waving, tapping and contact follow-through.
    let leftTipRotX = 0
    let rightTipRotX = 0
    let leftTipRotZ = 0
    let rightTipRotZ = 0

    if (isBackflip) {
      const fold = Math.sin(backflipProgress * Math.PI) * highMotionScale
      leftShoulderY += fold * 0.025
      rightShoulderY += fold * 0.025
      leftForearmRotX = -0.25 - fold * 0.42
      rightForearmRotX = -0.25 - fold * 0.42
      leftForearmRotZ = 0.12 + fold * 0.3
      rightForearmRotZ = -0.12 - fold * 0.3
      leftTipRotX = -fold * 0.32
      rightTipRotX = -fold * 0.32
    }
    else if (isTailTornado) {
      leftForearmRotX = -0.34 * tornadoStrength
      rightForearmRotX = -0.34 * tornadoStrength
      leftForearmRotZ = 0.2 + tornadoStrength * 0.32
      rightForearmRotZ = -0.2 - tornadoStrength * 0.32
      leftTipRotZ = tornadoStrength * 0.18
      rightTipRotZ = -tornadoStrength * 0.18
    }
    else if (isDivingCatch) {
      const reach = smoothStep(0.18, 0.54, catchProgress) * (1 - smoothStep(0.82, 0.98, catchProgress))
      const hold = smoothStep(0.54, 0.72, catchProgress) * (1 - smoothStep(0.9, 0.99, catchProgress))
      leftShoulderZ += reach * 0.04
      rightShoulderZ += reach * 0.04
      leftForearmRotX = -0.18 - reach * 0.68
      rightForearmRotX = -0.18 - reach * 0.68
      leftForearmRotZ = -0.06 + hold * 0.36
      rightForearmRotZ = 0.06 - hold * 0.36
      leftForearmScaleY = 1 + reach * 0.12
      rightForearmScaleY = 1 + reach * 0.12
      leftTipRotX = -reach * 0.46
      rightTipRotX = -reach * 0.46
      leftTipRotZ = hold * 0.28
      rightTipRotZ = -hold * 0.28
    }
    else if (isEnergyBurst) {
      const gather = energyCharge
      const flare = energyRelease
      leftShoulderY += gather * 0.035
      rightShoulderY += gather * 0.035
      leftForearmRotX = -gather * 0.42 + flare * 0.12
      rightForearmRotX = -gather * 0.42 + flare * 0.12
      leftForearmRotZ = mix(-0.06, 0.92, gather) - flare * 1.25
      rightForearmRotZ = mix(0.06, -0.92, gather) + flare * 1.25
      leftTipRotX = -gather * 0.34
      rightTipRotX = -gather * 0.34
      leftTipRotZ = flare * 0.34
      rightTipRotZ = -flare * 0.34
    }
    else if (isFireworksShow) {
      const salute = smoothStep(0.02, 0.18, fireworksProgress) * (1 - smoothStep(0.92, 0.99, fireworksProgress))
      const activeRight = Math.floor(Math.min(2.999, fireworksProgress * 3)) % 2 === 0
      leftShoulderY += salute * 0.055
      rightShoulderY += salute * 0.055
      if (activeRight) {
        rightForearmRotZ = mix(0.06, 2.58, salute)
        rightForearmScaleY = 1 + salute * 0.12
        rightTipRotZ = Math.sin(fireworksProgress * Math.PI * 9) * 0.08 * salute
        leftForearmRotZ = -0.22 * salute
      }
      else {
        leftForearmRotZ = mix(-0.06, -2.58, salute)
        leftForearmScaleY = 1 + salute * 0.12
        leftTipRotZ = Math.sin(fireworksProgress * Math.PI * 9) * 0.08 * salute
        rightForearmRotZ = 0.22 * salute
      }
    }
    else if (isShyPeek) {
      leftShoulderY += shyPose * 0.08
      rightShoulderY += shyPose * 0.08
      leftShoulderZ += shyPose * 0.04
      rightShoulderZ += shyPose * 0.04
      leftForearmRotX = -0.18 * shyPose
      rightForearmRotX = -0.18 * shyPose
      leftForearmRotZ = mix(-0.06, -1.34, shyPose)
      rightForearmRotZ = mix(0.06, 1.18, shyPose)
      leftTipRotZ = -0.16 * shyPose
      rightTipRotZ = 0.2 * shyPose
    }
    else if (isStarJuggle) {
      const juggleWave = Math.sin(juggleProgress * Math.PI * 6)
      leftShoulderY += jugglePose * 0.04
      rightShoulderY += jugglePose * 0.04
      leftForearmRotX = -0.18 - Math.max(0, juggleWave) * 0.32
      rightForearmRotX = -0.18 - Math.max(0, -juggleWave) * 0.32
      leftForearmRotZ = -0.3 + juggleWave * 0.38
      rightForearmRotZ = 0.3 + juggleWave * 0.38
      leftTipRotZ = juggleWave * 0.22
      rightTipRotZ = -juggleWave * 0.22
    }
    else if (isCloudNap) {
      leftShoulderX += 0.05 * cloudNapPose
      rightShoulderX -= 0.08 * cloudNapPose
      leftShoulderY -= 0.03 * cloudNapPose
      rightShoulderY += 0.02 * cloudNapPose
      leftShoulderZ += 0.1 * cloudNapPose
      rightShoulderZ += 0.12 * cloudNapPose
      leftForearmRotX = -0.52 * cloudNapPose
      rightForearmRotX = -0.58 * cloudNapPose
      leftForearmRotZ = 0.48 * cloudNapPose
      rightForearmRotZ = -0.38 * cloudNapPose
      leftTipRotX = -0.32 * cloudNapPose
      rightTipRotX = -0.34 * cloudNapPose
      leftTipRotZ = 0.12 * cloudNapPose
      rightTipRotZ = -0.16 * cloudNapPose
    }
    else if (isSparkleSneeze) {
      leftShoulderY += sneezeCharge * 0.07
      rightShoulderY += sneezeCharge * 0.07
      leftForearmRotZ = mix(-0.06, -1.1, sneezeCharge) - sneezeRelease * 0.22
      rightForearmRotZ = mix(0.06, 1.1, sneezeCharge) + sneezeRelease * 0.22
      leftTipRotZ = -0.12 * sneezeCharge + sneezeRelease * 0.24
      rightTipRotZ = 0.12 * sneezeCharge - sneezeRelease * 0.24
    }
    else if (isPawTap) {
      rightShoulderY -= pawTapBeat * 0.018
      rightShoulderZ += pawTapBeat * 0.025
      rightForearmRotX = -0.18 - pawTapBeat * 0.38
      rightForearmRotZ = 0.06 + pawTapPose * 0.16
      rightTipRotX = pawTapBeat * 0.42
      rightTipRotZ = -pawTapBeat * 0.1
      leftTipRotZ = Math.sin(elapsed * 2.2) * 0.02
    }
    else if (isAntennaCharge) {
      leftShoulderY += antennaChargePose * 0.05
      rightShoulderY += antennaChargePose * 0.05
      leftForearmRotZ = mix(-0.06, -0.7, antennaChargePose) - antennaRelease * 0.32
      rightForearmRotZ = mix(0.06, 0.7, antennaChargePose) + antennaRelease * 0.32
      leftTipRotZ = -antennaChargePose * 0.1 + antennaRelease * 0.2
      rightTipRotZ = antennaChargePose * 0.1 - antennaRelease * 0.2
    }
    else if (isTailGlow) {
      leftForearmRotZ = -0.06 + tailGlowWave * 0.08
      rightForearmRotZ = 0.06 - tailGlowWave * 0.08
      leftTipRotZ = tailGlowWave * 0.06
      rightTipRotZ = -tailGlowWave * 0.06
    }
    else if (isCuriousScan) {
      rightShoulderY += curiousPose * 0.03
      rightForearmRotZ = 0.06 + Math.sin(curiousProgress * Math.PI * 3) * 0.12 * curiousPose
      rightTipRotZ = Math.sin(curiousProgress * Math.PI * 5) * 0.08 * curiousPose
    }
    else if (isResting) {
      leftShoulderY -= 0.1
      rightShoulderY -= 0.1
      leftShoulderZ += 0.04
      rightShoulderZ += 0.04
      leftForearmRotX = -0.38
      rightForearmRotX = -0.38
      leftForearmRotZ = 0.06
      rightForearmRotZ = -0.06
      leftTipRotX = -0.18
      rightTipRotX = -0.18
    }
    else if (isStretching) {
      // 伸懒腰改为双爪上举、胸口打开和头部后仰，不再向前趴下。 / Stretching now raises both paws, opens the chest and tilts the head back instead of crouching forward.
      leftShoulderX += stretchEase * 0.02
      rightShoulderX -= stretchEase * 0.02
      leftShoulderY += stretchEase * 0.15
      rightShoulderY += stretchEase * 0.15
      leftShoulderZ += stretchEase * 0.018
      rightShoulderZ += stretchEase * 0.018
      leftShoulderRotX = -stretchEase * 0.045
      rightShoulderRotX = -stretchEase * 0.045
      leftShoulderRotZ = -0.035 - stretchEase * 0.05
      rightShoulderRotZ = 0.035 + stretchEase * 0.05
      leftForearmRotX = -stretchEase * 0.12
      rightForearmRotX = -stretchEase * 0.12
      leftForearmRotZ = mix(-0.06, -2.7, stretchEase)
      rightForearmRotZ = mix(0.06, 2.7, stretchEase)
      leftForearmScaleY = 1 + stretchEase * 0.18
      rightForearmScaleY = 1 + stretchEase * 0.18
      leftTipRotX = -stretchEase * 0.18
      rightTipRotX = -stretchEase * 0.18
      leftTipRotZ = stretchEase * 0.16
      rightTipRotZ = -stretchEase * 0.16
    }
    else if (isEating) {
      leftShoulderY -= 0.025
      rightShoulderY -= 0.025
      leftShoulderZ += 0.035
      rightShoulderZ += 0.035
      leftForearmRotX = -0.23
      rightForearmRotX = -0.23
      leftForearmRotZ = -0.12
      rightForearmRotZ = 0.12
      leftTipRotX = 0.1 + Math.sin(elapsed * 6.5) * 0.025
      rightTipRotX = 0.1 + Math.sin(elapsed * 6.5 + 0.8) * 0.025
    }
    else if (isPlayingBall) {
      leftShoulderZ += leftTap * 0.035
      rightShoulderZ += rightTap * 0.035
      leftShoulderY += leftTap * 0.015
      rightShoulderY += rightTap * 0.015
      leftShoulderRotX = -leftTap * 0.07
      rightShoulderRotX = -rightTap * 0.07
      leftForearmRotX = -0.14 - leftTap * 0.54
      rightForearmRotX = -0.14 - rightTap * 0.54
      leftForearmRotZ = -0.06 - leftTap * 0.11
      rightForearmRotZ = 0.06 + rightTap * 0.11
      leftTipRotX = -0.1 - leftTap * 0.42
      rightTipRotX = -0.1 - rightTap * 0.42
      leftTipRotZ = leftTap * 0.14
      rightTipRotZ = -rightTap * 0.14
    }
    else if (isGreeting) {
      // 招手先把前臂竖起，再以手腕为轴让爪端左右摆动；肩部只做轻微配合。 / Waving first raises the forearm upright, then swings the paw tip side to side around the wrist while the shoulder only assists slightly.
      rightShoulderY += greetingPose * 0.1
      rightShoulderZ += greetingPose * 0.018
      rightShoulderRotZ = 0.035 + greetingPose * 0.045
      rightForearmRotX = -greetingPose * 0.08
      rightForearmRotZ = mix(0.06, 2.7, greetingPose)
      rightForearmScaleY = 1 + greetingPose * 0.08
      rightTipRotX = -greetingPose * 0.16
      rightTipRotZ = greetingPose * 0.12 + wave * 0.36
      leftTipRotZ = Math.sin(elapsed * 2.2) * 0.018
    }
    else if (isFlapping) {
      leftShoulderY += 0.045
      rightShoulderY += 0.045
      leftShoulderRotZ = 0.04
      rightShoulderRotZ = -0.04
      leftForearmRotZ = 0.92 + flap * 0.14
      rightForearmRotZ = -0.92 - flap * 0.14
      leftTipRotZ = flap * 0.22
      rightTipRotZ = -flap * 0.22
    }
    else if (isPlaying) {
      leftForearmRotZ = -0.06 + dance * 0.24
      rightForearmRotZ = 0.06 - dance * 0.24
      leftTipRotZ = Math.sin(elapsed * 9.2) * 0.12
      rightTipRotZ = -Math.sin(elapsed * 9.2 + 0.65) * 0.12
    }
    else if (isJumping) {
      const fold = Math.sin(jumpProgress * Math.PI)
      leftShoulderY += fold * 0.035
      rightShoulderY += fold * 0.035
      leftShoulderZ += fold * 0.035
      rightShoulderZ += fold * 0.035
      leftForearmRotX = -fold * 0.28
      rightForearmRotX = -fold * 0.28
      leftForearmRotZ = 0.06 + fold * 0.24
      rightForearmRotZ = -0.06 - fold * 0.24
      leftTipRotX = -fold * 0.2
      rightTipRotX = -fold * 0.2
    }
    else if (isListening) {
      rightShoulderY += 0.02
      rightForearmRotZ = -0.24
      rightTipRotZ = -0.08
    }
    else if (isHappy) {
      const cheer = Math.max(0, Math.sin(elapsed * 8.5))
      leftForearmRotZ = -0.06 + cheer * 0.13
      rightForearmRotZ = 0.06 - cheer * 0.13
      leftTipRotZ = cheer * 0.08
      rightTipRotZ = -cheer * 0.08
    }

    leftPaw.value.position.x = damp(leftPaw.value.position.x, leftShoulderX, 9, delta)
    rightPaw.value.position.x = damp(rightPaw.value.position.x, rightShoulderX, 9, delta)
    leftPaw.value.position.y = damp(leftPaw.value.position.y, leftShoulderY, 9, delta)
    rightPaw.value.position.y = damp(rightPaw.value.position.y, rightShoulderY, 9, delta)
    leftPaw.value.position.z = damp(leftPaw.value.position.z, leftShoulderZ, 8, delta)
    rightPaw.value.position.z = damp(rightPaw.value.position.z, rightShoulderZ, 8, delta)
    leftPaw.value.rotation.x = damp(leftPaw.value.rotation.x, leftShoulderRotX, 8, delta)
    rightPaw.value.rotation.x = damp(rightPaw.value.rotation.x, rightShoulderRotX, 8, delta)
    leftPaw.value.rotation.z = damp(leftPaw.value.rotation.z, leftShoulderRotZ, 9, delta)
    rightPaw.value.rotation.z = damp(rightPaw.value.rotation.z, rightShoulderRotZ, 9, delta)

    leftForearm.value.rotation.x = damp(leftForearm.value.rotation.x, leftForearmRotX, 9, delta)
    rightForearm.value.rotation.x = damp(rightForearm.value.rotation.x, rightForearmRotX, 9, delta)
    leftForearm.value.rotation.z = damp(leftForearm.value.rotation.z, leftForearmRotZ, 10, delta)
    rightForearm.value.rotation.z = damp(rightForearm.value.rotation.z, rightForearmRotZ, 10, delta)
    leftForearm.value.scale.y = damp(leftForearm.value.scale.y, leftForearmScaleY, 8, delta)
    rightForearm.value.scale.y = damp(rightForearm.value.scale.y, rightForearmScaleY, 8, delta)

    leftPawTip.value.rotation.x = damp(leftPawTip.value.rotation.x, leftTipRotX, 11, delta)
    rightPawTip.value.rotation.x = damp(rightPawTip.value.rotation.x, rightTipRotX, 11, delta)
    leftPawTip.value.rotation.z = damp(leftPawTip.value.rotation.z, leftTipRotZ, 13, delta)
    rightPawTip.value.rotation.z = damp(rightPawTip.value.rotation.z, rightTipRotZ, 13, delta)
  }

  readAnchorInPositionRig(
    leftPawAnchor.value,
    leftPawFallback,
    leftPawLocal,
  )
  readAnchorInPositionRig(
    rightPawAnchor.value,
    rightPawFallback,
    rightPawLocal,
  )
  readAnchorInPositionRig(mouthAnchor.value, mouthFallback, mouthLocal)

  if (ballGroup.value) {
    const visible = isPlayingBall || isDivingCatch
    const activeBallProgress = isDivingCatch ? catchProgress : ballProgress
    const enter = visible ? smoothStep(0.015, 0.09, activeBallProgress) : 0
    const exit = visible ? 1 - smoothStep(0.92, 0.995, activeBallProgress) : 0
    const visibility = enter * exit
    const leftStartX = leftPawLocal.x - 0.03
    const leftStartY = leftPawLocal.y - 0.11
    const leftStartZ = leftPawLocal.z + 0.08
    const rightReachX = rightPawLocal.x + 0.34
    const leftReachX = leftPawLocal.x - 0.28
    // 球落到脚下更低的位置，并保持足够大的轮廓。 / The ball settles lower beneath the paws while retaining a clearly readable silhouette.
    const groundBallY = GROUND_Y + 0.06

    let targetBallX = leftStartX
    let targetBallY = leftStartY
    let targetBallZ = leftStartZ

    if (isDivingCatch) {
      if (catchProgress < 0.2) {
        const enterBall = smoothStep(0.02, 0.2, catchProgress)
        targetBallX = mix(-1.42, -0.72, enterBall)
        targetBallY = mix(0.92, 0.56, enterBall)
        targetBallZ = FRONT_PAW_BASE_Z + 0.28
      }
      else if (catchProgress < 0.58) {
        const flight = smoothStep(0.2, 0.58, catchProgress)
        targetBallX = mix(-0.72, 0.74, flight)
        targetBallY = 0.54 + Math.sin(flight * Math.PI) * 0.58
        targetBallZ = FRONT_PAW_BASE_Z + 0.3 + Math.sin(flight * Math.PI) * 0.1
      }
      else {
        const catchSettle = smoothStep(0.58, 0.9, catchProgress)
        const centerX = (leftPawLocal.x + rightPawLocal.x) * 0.5
        const centerY = (leftPawLocal.y + rightPawLocal.y) * 0.5 + 0.13
        targetBallX = mix(0.74, centerX, catchSettle)
        targetBallY = mix(0.58, centerY, catchSettle)
        targetBallZ = mix(FRONT_PAW_BASE_Z + 0.32, (leftPawLocal.z + rightPawLocal.z) * 0.5 + 0.14, catchSettle)
      }
    }
    else if (ballProgress < 0.2) {
      const gather = smoothStep(0.06, 0.2, ballProgress)
      targetBallX = leftStartX + Math.sin(ballProgress * Math.PI * 8) * 0.025 * gather
      targetBallY = leftStartY + Math.sin(ballProgress * Math.PI * 6) * 0.035 * gather
    }
    else if (ballProgress < 0.5) {
      const travel = smoothStep(0.2, 0.5, ballProgress)
      targetBallX = mix(leftStartX, rightReachX, travel)
      targetBallY = groundBallY + Math.abs(Math.sin(travel * Math.PI * 3)) * 0.62
      targetBallZ = mix(leftStartZ, FRONT_PAW_BASE_Z + 0.18, travel)
    }
    else if (ballProgress < 0.76) {
      const travel = smoothStep(0.5, 0.76, ballProgress)
      targetBallX = mix(rightReachX, leftReachX, travel)
      targetBallY = groundBallY + Math.abs(Math.sin(travel * Math.PI * 2.5)) * 0.5
      targetBallZ = FRONT_PAW_BASE_Z + 0.18 + Math.sin(travel * Math.PI) * 0.08
    }
    else {
      const settle = smoothStep(0.76, 0.94, ballProgress)
      const centerX = (leftPawLocal.x + rightPawLocal.x) * 0.5
      targetBallX = mix(leftReachX, centerX, settle)
      targetBallY = mix(groundBallY + Math.abs(Math.sin(settle * Math.PI * 1.5)) * 0.28, groundBallY, settle)
      targetBallZ = mix(FRONT_PAW_BASE_Z + 0.18, (leftPawLocal.z + rightPawLocal.z) * 0.5 + 0.05, settle)
    }

    ballGroup.value.visible = visibility > 0.01
    ballGroup.value.position.x = damp(ballGroup.value.position.x, targetBallX, 11, delta)
    ballGroup.value.position.y = damp(ballGroup.value.position.y, targetBallY, 13, delta)
    ballGroup.value.position.z = damp(ballGroup.value.position.z, targetBallZ, 9, delta)
    ballGroup.value.rotation.y += delta * 3.6
    ballGroup.value.rotation.z -= delta * 3.1
    ballGroup.value.scale.setScalar(damp(ballGroup.value.scale.x, Math.max(0.001, visibility), 12, delta))
  }

  if (burstRingGroup.value) {
    const visible = isEnergyBurst || isBackflip || isDivingCatch || isPawTap || isAntennaCharge
    let impact = 0
    if (isBackflip) impact = pulse(backflipProgress, 0.74, 0.98)
    else if (isDivingCatch) impact = pulse(catchProgress, 0.62, 0.9)
    else if (isPawTap) impact = pawTapBeat * 0.34
    else if (isAntennaCharge) impact = antennaRelease * 0.48
    else if (isEnergyBurst) impact = energyRelease
    burstRingGroup.value.visible = visible && impact > 0.01
    const multiplier = isEnergyBurst || isAntennaCharge ? 2.8 : 1.9
    const targetScale = Math.max(0.001, 0.24 + impact * multiplier * highMotionScale)
    burstRingGroup.value.scale.setScalar(damp(burstRingGroup.value.scale.x, targetScale, 12, delta))
    burstRingGroup.value.rotation.z += delta * (isEnergyBurst || isAntennaCharge ? 1.8 : 0.8)
    if (burstRingA.value) {
      ;(burstRingA.value.material as { opacity?: number }).opacity = impact * 0.62
      burstRingA.value.rotation.z += delta * 1.7
    }
    if (burstRingB.value) {
      ;(burstRingB.value.material as { opacity?: number }).opacity = impact * 0.38
      burstRingB.value.rotation.z -= delta * 1.25
    }
    if (impactRing.value) {
      ;(impactRing.value.material as { opacity?: number }).opacity = impact * 0.48
      impactRing.value.scale.setScalar(0.8 + impact * 0.8)
    }
  }

  if (mealGroup.value) {
    const visible = isEating
    const enter = visible ? smoothStep(0.02, 0.12, eatProgress) : 0
    const exit = visible ? 1 - smoothStep(0.9, 0.99, eatProgress) : 0
    const visibility = enter * exit
    const mealTargetX = mouthLocal.x
    const mealTargetZ = mouthLocal.z + 0.02
    mealGroup.value.visible = visibility > 0.01
    mealGroup.value.scale.setScalar(damp(mealGroup.value.scale.x, Math.max(0.001, visibility), 10, delta))
    mealGroup.value.position.x = damp(mealGroup.value.position.x, mealTargetX, 9, delta)
    mealGroup.value.position.y = damp(mealGroup.value.position.y, GROUND_Y + Math.sin(elapsed * 2) * 0.006, 8, delta)
    mealGroup.value.position.z = damp(mealGroup.value.position.z, mealTargetZ, 9, delta)
    if (foodGroup.value) {
      const foodRemaining = Math.max(0.08, 1 - Math.max(0, (eatProgress - 0.18) / 0.62) * 0.88)
      foodGroup.value.scale.y = damp(foodGroup.value.scale.y, foodRemaining, 7, delta)
      foodGroup.value.rotation.y += delta * 0.35
    }
  }
})
</script>

<template>
  <TresGroup ref="petGroup">
    <!-- 接触阴影 / Contact shadow -->
    <TresMesh ref="shadowSoft" :position="vec3(0, -1.76, 0)" :rotation="euler(-Math.PI / 2, 0, 0)">
      <TresCircleGeometry :args="[1.18, 48]" />
      <TresMeshBasicMaterial color="#48507f" transparent :opacity="0.1" />
    </TresMesh>

    <TresMesh ref="shadowCore" :position="vec3(0, -1.75, 0.01)" :rotation="euler(-Math.PI / 2, 0, 0)">
      <TresCircleGeometry :args="[0.86, 48]" />
      <TresMeshBasicMaterial color="#252b4b" transparent :opacity="0.22" />
    </TresMesh>

    <!-- 高能动作波纹固定在地面层，不跟随身体空翻或飞扑。 / High-energy rings stay on the ground instead of rotating with the body. -->
    <TresGroup ref="burstRingGroup" :position="vec3(0, -1.69, 0.18)" :rotation="euler(-Math.PI / 2, 0, 0)" :scale="vec3(0.001, 0.001, 0.001)" :visible="false">
      <TresMesh ref="burstRingA">
        <TresTorusGeometry :args="[0.72, 0.035, 12, 80]" />
        <TresMeshBasicMaterial :color="accent" transparent :opacity="0" :depth-write="false" />
      </TresMesh>
      <TresMesh ref="burstRingB" :rotation="euler(0, 0, 0.42)">
        <TresTorusGeometry :args="[1.02, 0.022, 12, 80]" />
        <TresMeshBasicMaterial :color="secondary" transparent :opacity="0" :depth-write="false" />
      </TresMesh>
      <TresMesh ref="impactRing" :scale="vec3(0.8, 0.8, 0.8)">
        <TresRingGeometry :args="[0.38, 0.48, 64]" />
        <TresMeshBasicMaterial color="#ffffff" transparent :opacity="0" :depth-write="false" />
      </TresMesh>
    </TresGroup>

    <!-- 高空烟花：发射体与爆炸粒子独立于身体 Rig，避免跟随宠物旋转。 / High-altitude fireworks stay outside the body rig so bursts never rotate with the pet. -->
    <TresGroup ref="fireworkGroup" :visible="false">
      <TresMesh ref="fireworkRocket" :position="vec3(-0.48, -0.2, 0.48)" :scale="vec3(0.001, 0.001, 0.001)">
        <TresSphereGeometry :args="[0.085, 18, 18]" />
        <TresMeshStandardMaterial :color="secondary" :emissive="secondary" :emissive-intensity="4.5" :roughness="0.08" />
      </TresMesh>
      <TresMesh ref="fireworkRocketTrail" :position="vec3(-0.48, -0.42, 0.45)" :scale="vec3(0.001, 0.001, 0.001)">
        <TresSphereGeometry :args="[0.075, 16, 16]" />
        <TresMeshBasicMaterial :color="accent" transparent :opacity="0" :depth-write="false" />
      </TresMesh>
      <TresGroup ref="fireworkBurstGroup" :position="vec3(0, 2.7, 0.4)">
        <TresMesh
          v-for="particleIndex in FIREWORK_PARTICLE_INDEXES"
          :key="particleIndex"
          :ref="value => setFireworkParticleRef(value, particleIndex)"
          :scale="vec3(0.001, 0.001, 0.001)"
        >
          <TresSphereGeometry :args="[0.052, 10, 10]" />
          <TresMeshBasicMaterial color="#ffffff" transparent :opacity="0" :depth-write="false" />
        </TresMesh>
      </TresGroup>
    </TresGroup>

    <!-- 三层 Rig：位置、全身动作、视线。 / Three rigs: position, full-body action, and gaze. -->
    <TresGroup ref="positionRig" :position="vec3(0, 0.18, 0)">
      <TresGroup ref="actionRig">
        <TresGroup ref="lookRig">
    <!-- 分段柔性云尾 / Segmented flexible cloud tail -->
    <TresGroup ref="tailGroup" :position="vec3(-0.58, -0.48, -0.34)" :rotation="euler(0.03, 0.08, -0.08)">
      <TresMesh cast-shadow>
        <TresTubeGeometry :args="[tailBaseCurve, 24, 0.27, 14, false]" />
        <TresMeshStandardMaterial :color="coatShadow" :roughness="0.32" :metalness="0.02" />
      </TresMesh>

      <TresGroup ref="tailMidGroup" :position="vec3(-0.58, 0.22, 0)" :rotation="euler(0, 0, 0.1)">
        <TresMesh ref="tailMidMesh" cast-shadow>
          <TresTubeGeometry :args="[tailMidCurve, 22, 0.22, 14, false]" />
          <TresMeshStandardMaterial :color="coat" :roughness="0.27" :metalness="0.02" />
        </TresMesh>

        <TresGroup ref="tailTipGroup" :position="vec3(-0.42, 0.44, 0.03)" :rotation="euler(0, 0, 0.16)">
          <TresMesh ref="tailTipMesh" cast-shadow>
            <TresTubeGeometry :args="[tailTipCurve, 20, 0.16, 14, false]" />
            <TresMeshStandardMaterial
              :color="tailTipBase"
              :emissive="tailTipBase"
              :emissive-intensity="secretMode ? 3 : 1.65"
              :roughness="0.14"
              :metalness="0.04"
            />
          </TresMesh>
          <TresMesh ref="tailEnergy" :position="vec3(-0.38, 0.34, 0)" :scale="vec3(1, 1, 1)">
            <TresSphereGeometry :args="[0.15, 28, 28]" />
            <TresMeshBasicMaterial
              :color="tailTipBase"
              :tone-mapped="false"
            />
          </TresMesh>
          <TresMesh ref="tailAura" :position="vec3(-0.38, 0.34, -0.01)" :scale="vec3(1.55, 1.55, 1.55)">
            <TresSphereGeometry :args="[0.2, 24, 24]" />
            <TresMeshBasicMaterial
              :color="tailTipBase"
              transparent
              :opacity="secretMode ? 0.4 : 0.34"
              :blending="AdditiveBlending"
              :depth-write="false"
              :tone-mapped="false"
            />
          </TresMesh>

          <!-- 尾尖拖尾与星点 / Tail-tip trails and stardust -->
          <TresGroup ref="tailTrailGroup" :position="vec3(-0.26, 0.25, -0.04)" :rotation="euler(0, 0, 0.14)">
            <TresMesh ref="tailTrailPrimary" :position="vec3(0.18, -0.1, -0.02)" :scale="vec3(1, 1, 1)">
              <TresSphereGeometry :args="[0.12, 20, 20]" />
              <TresMeshBasicMaterial :color="secondary" transparent :opacity="0.08" :depth-write="false" />
            </TresMesh>
            <TresMesh ref="tailTrailSecondary" :position="vec3(0.34, -0.2, -0.04)" :scale="vec3(1, 0.72, 0.72)">
              <TresSphereGeometry :args="[0.1, 18, 18]" />
              <TresMeshBasicMaterial :color="accent" transparent :opacity="0.04" :depth-write="false" />
            </TresMesh>
          </TresGroup>

          <TresGroup ref="tailParticleGroup">
            <TresMesh ref="tailParticleA" :position="vec3(-0.38, 0.38, 0.02)">
              <TresSphereGeometry :args="[0.035, 12, 12]" />
              <TresMeshBasicMaterial :color="secondary" transparent :opacity="0.15" :depth-write="false" />
            </TresMesh>
            <TresMesh ref="tailParticleB" :position="vec3(-0.46, 0.28, 0.06)">
              <TresSphereGeometry :args="[0.028, 12, 12]" />
              <TresMeshBasicMaterial :color="accent" transparent :opacity="0.12" :depth-write="false" />
            </TresMesh>
            <TresMesh ref="tailParticleC" :position="vec3(-0.3, 0.46, -0.04)">
              <TresSphereGeometry :args="[0.024, 12, 12]" />
              <TresMeshBasicMaterial color="#ffffff" transparent :opacity="0.1" :depth-write="false" />
            </TresMesh>
          </TresGroup>
        </TresGroup>
      </TresGroup>
    </TresGroup>

    <!-- 身体 / Body -->
    <TresGroup ref="torsoGroup">
      <TresMesh :position="vec3(0, -0.32, 0)" :scale="vec3(0.94, 1.12, 0.82)" cast-shadow>
        <TresSphereGeometry :args="[1, 64, 64]" />
        <TresMeshStandardMaterial :color="coatShadow" :roughness="0.34" :metalness="0.04" />
      </TresMesh>

      <TresMesh :position="vec3(0, -0.26, 0.73)" :scale="vec3(0.48, 0.56, 0.2)">
        <TresSphereGeometry :args="[1, 48, 48]" />
        <TresMeshStandardMaterial :color="coatWarm" :roughness="0.4" />
      </TresMesh>
    </TresGroup>

    <!-- 前爪动作原则：肩根稳定，前臂负责抬伸，爪端负责挥动和触碰。 / Paw principle: stable shoulders, forearm lift/reach, paw-tip wave/contact. -->
    <!-- 前爪：肩部 / 前臂 / 爪端三级控制 / Front paws: shoulder / forearm / paw-tip rig -->
    <TresGroup ref="leftPaw" :position="vec3(FRONT_PAW_LEFT_X, FRONT_PAW_BASE_Y, FRONT_PAW_BASE_Z)">
      <TresGroup ref="leftForearm" :rotation="euler(0, 0, -0.06)">
        <TresMesh :position="vec3(0, -0.18, 0.01)">
          <TresCylinderGeometry :args="[0.085, 0.11, 0.36, 20]" />
          <TresMeshStandardMaterial :color="coat" :roughness="0.26" />
        </TresMesh>
        <TresGroup ref="leftPawTip" :position="vec3(0, FRONT_PAW_TIP_LOCAL_Y, 0.04)">
          <TresMesh :scale="vec3(1.05, 0.85, 1.2)">
            <TresSphereGeometry :args="[0.12, 24, 24]" />
            <TresMeshStandardMaterial :color="coatWarm" :roughness="0.26" />
          </TresMesh>
          <TresGroup ref="leftPawAnchor" :position="vec3(0, FRONT_PAW_ANCHOR_LOCAL_Y, FRONT_PAW_ANCHOR_LOCAL_Z)" />
        </TresGroup>
      </TresGroup>
    </TresGroup>

    <TresGroup ref="rightPaw" :position="vec3(FRONT_PAW_RIGHT_X, FRONT_PAW_BASE_Y, FRONT_PAW_BASE_Z)">
      <TresGroup ref="rightForearm" :rotation="euler(0, 0, 0.06)">
        <TresMesh :position="vec3(0, -0.18, 0.01)">
          <TresCylinderGeometry :args="[0.085, 0.11, 0.36, 20]" />
          <TresMeshStandardMaterial :color="coat" :roughness="0.26" />
        </TresMesh>
        <TresGroup ref="rightPawTip" :position="vec3(0, FRONT_PAW_TIP_LOCAL_Y, 0.04)">
          <TresMesh :scale="vec3(1.05, 0.85, 1.2)">
            <TresSphereGeometry :args="[0.12, 24, 24]" />
            <TresMeshStandardMaterial :color="coatWarm" :roughness="0.26" />
          </TresMesh>
          <TresGroup ref="rightPawAnchor" :position="vec3(0, FRONT_PAW_ANCHOR_LOCAL_Y, FRONT_PAW_ANCHOR_LOCAL_Z)" />
        </TresGroup>
      </TresGroup>
    </TresGroup>

    <!-- 后爪 / Hind paws -->
    <TresGroup ref="leftHindLeg" :position="vec3(-0.48, -1.08, 0.22)">
      <TresMesh :rotation="euler(0.08, 0, -0.04)">
        <TresCylinderGeometry :args="[0.12, 0.15, 0.34, 20]" />
        <TresMeshStandardMaterial :color="coatShadow" :roughness="0.32" />
      </TresMesh>
      <TresMesh :position="vec3(0, -0.22, 0.06)" :scale="vec3(1.18, 0.9, 1.35)">
        <TresSphereGeometry :args="[0.14, 24, 24]" />
        <TresMeshStandardMaterial :color="coatWarm" :roughness="0.3" />
      </TresMesh>
    </TresGroup>

    <TresGroup ref="rightHindLeg" :position="vec3(0.48, -1.08, 0.22)">
      <TresMesh :rotation="euler(0.08, 0, 0.04)">
        <TresCylinderGeometry :args="[0.12, 0.15, 0.34, 20]" />
        <TresMeshStandardMaterial :color="coatShadow" :roughness="0.32" />
      </TresMesh>
      <TresMesh :position="vec3(0, -0.22, 0.06)" :scale="vec3(1.18, 0.9, 1.35)">
        <TresSphereGeometry :args="[0.14, 24, 24]" />
        <TresMeshStandardMaterial :color="coatWarm" :roughness="0.3" />
      </TresMesh>
    </TresGroup>

    <!-- 胸口能量核心 / Chest energy core -->
    <TresMesh ref="coreMesh" :position="vec3(0, -0.26, 0.74)">
      <TresSphereGeometry :args="[0.19, 32, 32]" />
      <TresMeshStandardMaterial
        :color="secondary"
        :emissive="secondary"
        :emissive-intensity="secretMode ? 4 : 1.8"
        :metalness="0.25"
        :roughness="0.12"
      />
    </TresMesh>

    <!-- 头部 / Head -->
    <TresGroup ref="headGroup" :position="vec3(0, 0.92, 0.06)">
      <TresGroup ref="leftEar" :position="vec3(-0.56, 0.65, -0.04)" :rotation="euler(0, 0, -0.16)">
        <TresMesh cast-shadow>
          <TresConeGeometry :args="[0.35, 0.9, 4]" />
          <TresMeshStandardMaterial :color="coat" :roughness="0.3" />
        </TresMesh>
        <TresMesh :position="vec3(0, -0.03, 0.09)" :scale="vec3(0.55, 0.68, 0.5)">
          <TresConeGeometry :args="[0.35, 0.78, 4]" />
          <TresMeshStandardMaterial :color="accent" :emissive="accent" :emissive-intensity="0.25" />
        </TresMesh>
      </TresGroup>

      <TresGroup ref="rightEar" :position="vec3(0.56, 0.65, -0.04)" :rotation="euler(0, 0, 0.16)">
        <TresMesh cast-shadow>
          <TresConeGeometry :args="[0.35, 0.9, 4]" />
          <TresMeshStandardMaterial :color="coat" :roughness="0.3" />
        </TresMesh>
        <TresMesh :position="vec3(0, -0.03, 0.09)" :scale="vec3(0.55, 0.68, 0.5)">
          <TresConeGeometry :args="[0.35, 0.78, 4]" />
          <TresMeshStandardMaterial :color="accent" :emissive="accent" :emissive-intensity="0.25" />
        </TresMesh>
      </TresGroup>

      <TresGroup ref="leftAntenna" :position="vec3(-0.24, 0.7, 0.05)" :rotation="euler(0.12, 0.06, -0.24)">
        <TresMesh :position="vec3(0, 0.16, 0)">
          <TresCylinderGeometry :args="[0.028, 0.052, 0.34, 12]" />
          <TresMeshStandardMaterial :color="coatWarm" :roughness="0.22" :metalness="0.04" />
        </TresMesh>
        <TresMesh ref="leftAntennaTip" :position="vec3(0.015, 0.35, 0.02)">
          <TresSphereGeometry :args="[0.08, 20, 20]" />
          <TresMeshStandardMaterial :color="secondary" :emissive="secondary" :emissive-intensity="1.6" transparent :opacity="0.9" :roughness="0.1" />
        </TresMesh>
        <TresMesh :position="vec3(0.015, 0.35, 0.02)" :scale="vec3(1.7, 1.7, 1.7)">
          <TresSphereGeometry :args="[0.08, 16, 16]" />
          <TresMeshBasicMaterial :color="accent" transparent :opacity="0.14" :depth-write="false" />
        </TresMesh>
      </TresGroup>

      <TresGroup ref="rightAntenna" :position="vec3(0.24, 0.7, 0.05)" :rotation="euler(0.12, -0.06, 0.24)">
        <TresMesh :position="vec3(0, 0.16, 0)">
          <TresCylinderGeometry :args="[0.028, 0.052, 0.34, 12]" />
          <TresMeshStandardMaterial :color="coatWarm" :roughness="0.22" :metalness="0.04" />
        </TresMesh>
        <TresMesh ref="rightAntennaTip" :position="vec3(-0.015, 0.35, 0.02)">
          <TresSphereGeometry :args="[0.08, 20, 20]" />
          <TresMeshStandardMaterial :color="secondary" :emissive="secondary" :emissive-intensity="1.6" transparent :opacity="0.9" :roughness="0.1" />
        </TresMesh>
        <TresMesh :position="vec3(-0.015, 0.35, 0.02)" :scale="vec3(1.7, 1.7, 1.7)">
          <TresSphereGeometry :args="[0.08, 16, 16]" />
          <TresMeshBasicMaterial :color="accent" transparent :opacity="0.14" :depth-write="false" />
        </TresMesh>
      </TresGroup>

      <TresMesh :scale="vec3(1.02, 0.88, 0.9)" cast-shadow>
        <TresSphereGeometry :args="[0.9, 64, 64]" />
        <TresMeshStandardMaterial :color="coat" :roughness="0.28" :metalness="0.04" />
      </TresMesh>

      <TresMesh :position="vec3(0, -0.22, 0.79)" :scale="vec3(0.48, 0.34, 0.36)">
        <TresSphereGeometry :args="[0.65, 48, 48]" />
        <TresMeshStandardMaterial color="#f7f8ff" :roughness="0.34" />
      </TresMesh>

      <!-- 眼睛与表情 / Eyes and facial expressions -->
      <TresGroup ref="eyeGroup">
        <TresGroup ref="leftEye" :position="vec3(LEFT_EYE_BASE_X, EYE_BASE_Y, 0.77)">
          <TresMesh :scale="vec3(0.16, 0.22, 0.1)">
            <TresSphereGeometry :args="[1, 32, 32]" />
            <TresMeshStandardMaterial :color="eyeColor" :roughness="0.08" />
          </TresMesh>
          <TresMesh :position="vec3(0.04, 0.05, 0.105)" :scale="vec3(0.045, 0.065, 0.025)">
            <TresSphereGeometry :args="[1, 20, 20]" />
            <TresMeshBasicMaterial :color="secondary" />
          </TresMesh>
        </TresGroup>

        <TresGroup ref="rightEye" :position="vec3(RIGHT_EYE_BASE_X, EYE_BASE_Y, 0.77)">
          <TresMesh :scale="vec3(0.16, 0.22, 0.1)">
            <TresSphereGeometry :args="[1, 32, 32]" />
            <TresMeshStandardMaterial :color="eyeColor" :roughness="0.08" />
          </TresMesh>
          <TresMesh :position="vec3(0.04, 0.05, 0.105)" :scale="vec3(0.045, 0.065, 0.025)">
            <TresSphereGeometry :args="[1, 20, 20]" />
            <TresMeshBasicMaterial :color="secondary" />
          </TresMesh>
        </TresGroup>
      </TresGroup>

      <TresGroup ref="cheeksGroup" :scale="vec3(0.001, 0.001, 0.001)">
        <TresMesh :position="vec3(-0.52, -0.16, 0.79)" :scale="vec3(0.13, 0.07, 0.03)">
          <TresSphereGeometry :args="[1, 24, 24]" />
          <TresMeshBasicMaterial color="#ff91b7" transparent :opacity="0.32" />
        </TresMesh>
        <TresMesh :position="vec3(0.52, -0.16, 0.79)" :scale="vec3(0.13, 0.07, 0.03)">
          <TresSphereGeometry :args="[1, 24, 24]" />
          <TresMeshBasicMaterial color="#ff91b7" transparent :opacity="0.32" />
        </TresMesh>
      </TresGroup>

      <TresMesh :position="vec3(0, -0.24, 1.015)" :scale="vec3(0.11, 0.085, 0.07)">
        <TresSphereGeometry :args="[1, 24, 24]" />
        <TresMeshStandardMaterial color="#25263b" :roughness="0.22" />
      </TresMesh>

      <TresGroup ref="mouthAnchor" :position="vec3(0, -0.49, 1.04)" />

      <TresGroup ref="mouthGroup" :position="vec3(0, -0.39, 0.985)">
        <TresMesh :scale="vec3(0.15, 0.075, 0.04)">
          <TresSphereGeometry :args="[1, 28, 28]" />
          <TresMeshStandardMaterial color="#24263c" :roughness="0.2" />
        </TresMesh>
        <TresMesh :position="vec3(0, -0.025, 0.035)" :scale="vec3(0.075, 0.026, 0.015)">
          <TresSphereGeometry :args="[1, 20, 20]" />
          <TresMeshBasicMaterial color="#ff87ad" />
        </TresMesh>
      </TresGroup>


      <TresGroup ref="sneezeSparkGroup" :position="vec3(0.06, -0.22, 1.18)" :scale="vec3(0.001, 0.001, 0.001)" :visible="false">
        <TresMesh ref="sneezeSparkA" :position="vec3(0.18, 0.04, 0)">
          <TresOctahedronGeometry :args="[0.1, 0]" />
          <TresMeshBasicMaterial :color="secondary" transparent :opacity="0" :depth-write="false" />
        </TresMesh>
        <TresMesh ref="sneezeSparkB" :position="vec3(-0.12, 0.12, 0.04)">
          <TresOctahedronGeometry :args="[0.075, 0]" />
          <TresMeshBasicMaterial :color="accent" transparent :opacity="0" :depth-write="false" />
        </TresMesh>
        <TresMesh ref="sneezeSparkC" :position="vec3(0.02, -0.14, -0.02)">
          <TresSphereGeometry :args="[0.06, 12, 12]" />
          <TresMeshBasicMaterial color="#ffffff" transparent :opacity="0" :depth-write="false" />
        </TresMesh>
      </TresGroup>
    </TresGroup>

    <!-- 数据光环只由真实任务状态驱动；普通思考动作和工作区导航不显示加载圈。 / Data orbits are driven only by real task state; ordinary thinking motions and workspace navigation never show loading. -->
    <TresGroup v-if="speaking" ref="haloGroup" :position="vec3(0, 0.08, -0.18)" :rotation="euler(0.85, 0.2, 0)">
      <TresMesh>
        <TresTorusGeometry :args="[1.85, 0.018, 12, 120]" />
        <TresMeshBasicMaterial :color="accent" transparent :opacity="secretMode ? 0.92 : 0.32" />
      </TresMesh>
      <TresMesh :rotation="euler(1.1, 0.35, 0.6)">
        <TresTorusGeometry :args="[1.48, 0.012, 12, 120]" />
        <TresMeshBasicMaterial :color="secondary" transparent :opacity="secretMode ? 0.86 : 0.22" />
      </TresMesh>
      <TresMesh v-if="secretMode" :rotation="euler(0.3, 1.1, 0.2)">
        <TresTorusGeometry :args="[2.1, 0.025, 16, 140]" />
        <TresMeshBasicMaterial color="#ffdc79" transparent :opacity="0.72" />
      </TresMesh>
    </TresGroup>
        </TresGroup>
      </TresGroup>

      <!-- 生活状态道具：云朵午睡与星星杂耍。 / Lifestyle props for cloud napping and star juggling. -->
      <TresGroup ref="cloudNapGroup" :position="vec3(-0.02, -1.02, 0.12)" :scale="vec3(0.001, 0.001, 0.001)" :visible="false">
        <TresMesh :position="vec3(-0.5, 0, 0)" :scale="vec3(0.82, 0.46, 0.72)">
          <TresSphereGeometry :args="[0.7, 32, 32]" />
          <TresMeshStandardMaterial :color="coatWarm" :emissive="secondary" :emissive-intensity="0.2" transparent :opacity="0.92" :roughness="0.38" />
        </TresMesh>
        <TresMesh :position="vec3(0.05, 0.08, 0.02)" :scale="vec3(1.12, 0.62, 0.88)">
          <TresSphereGeometry :args="[0.72, 32, 32]" />
          <TresMeshStandardMaterial :color="coat" :emissive="accent" :emissive-intensity="0.16" transparent :opacity="0.94" :roughness="0.34" />
        </TresMesh>
        <TresMesh :position="vec3(0.62, -0.02, -0.02)" :scale="vec3(0.78, 0.42, 0.68)">
          <TresSphereGeometry :args="[0.68, 28, 28]" />
          <TresMeshStandardMaterial :color="coatWarm" :emissive="secondary" :emissive-intensity="0.18" transparent :opacity="0.9" :roughness="0.38" />
        </TresMesh>
        <TresGroup ref="cloudNapZzzGroup" :position="vec3(0.88, 0.72, 0.3)" :visible="false">
          <TresMesh :position="vec3(0, 0, 0)" :scale="vec3(1, 1, 1)">
            <TresTorusGeometry :args="[0.11, 0.025, 8, 28, 4.8]" />
            <TresMeshBasicMaterial :color="secondary" transparent :opacity="0.62" :depth-write="false" />
          </TresMesh>
          <TresMesh :position="vec3(0.18, 0.2, 0)" :scale="vec3(0.72, 0.72, 0.72)">
            <TresTorusGeometry :args="[0.11, 0.025, 8, 28, 4.8]" />
            <TresMeshBasicMaterial :color="accent" transparent :opacity="0.5" :depth-write="false" />
          </TresMesh>
        </TresGroup>
      </TresGroup>

      <TresGroup ref="starJuggleGroup" :position="vec3(0, 0.15, 0.08)" :scale="vec3(0.001, 0.001, 0.001)" :visible="false">
        <TresMesh ref="starOrbA">
          <TresOctahedronGeometry :args="[0.16, 0]" />
          <TresMeshStandardMaterial :color="secondary" :emissive="secondary" :emissive-intensity="2.8" :roughness="0.08" />
        </TresMesh>
        <TresMesh ref="starOrbB">
          <TresOctahedronGeometry :args="[0.15, 0]" />
          <TresMeshStandardMaterial :color="accent" :emissive="accent" :emissive-intensity="2.6" :roughness="0.08" />
        </TresMesh>
        <TresMesh ref="starOrbC">
          <TresOctahedronGeometry :args="[0.13, 0]" />
          <TresMeshStandardMaterial color="#ffffff" :emissive="secondary" :emissive-intensity="2.2" :roughness="0.08" />
        </TresMesh>
      </TresGroup>

      <!-- 互动道具 / Interactive props -->
        <TresGroup ref="ballGroup" :position="vec3(FRONT_PAW_LEFT_X, FRONT_PAW_BASE_Y - 0.5, FRONT_PAW_BASE_Z + 0.16)" :scale="vec3(0.001, 0.001, 0.001)" :visible="behavior === 'playing-ball' || behavior === 'diving-catch'">
          <TresMesh>
            <TresSphereGeometry :args="[BALL_RADIUS, 32, 32]" />
            <TresMeshStandardMaterial
              :color="secondary"
              :emissive="secondary"
              :emissive-intensity="1.25"
              :roughness="0.18"
              :metalness="0.08"
              transparent
              :opacity="0.9"
            />
          </TresMesh>
          <TresMesh :scale="vec3(1.28, 1.28, 1.28)">
            <TresSphereGeometry :args="[BALL_RADIUS, 24, 24]" />
            <TresMeshBasicMaterial :color="accent" transparent :opacity="0.1" :depth-write="false" />
          </TresMesh>
          <TresMesh :rotation="euler(Math.PI / 2, 0, 0)">
            <TresTorusGeometry :args="[BALL_RADIUS * 0.68, 0.017, 10, 48]" />
            <TresMeshBasicMaterial color="#ffffff" transparent :opacity="0.5" />
          </TresMesh>
        </TresGroup>

        <TresGroup ref="mealGroup" :position="vec3(0, GROUND_Y, 1.08)" :scale="vec3(0.001, 0.001, 0.001)" :visible="behavior === 'eating'">
          <!-- 抬高餐桌让饭盆靠近嘴部 / A raised meal table brings the bowl close to the mouth. -->
          <TresGroup>
            <TresMesh :position="vec3(0, 0.1, 0)" :scale="vec3(1, 0.42, 1)">
              <TresCylinderGeometry :args="[0.48, 0.62, 0.16, 40]" />
              <TresMeshStandardMaterial :color="coatShadow" :roughness="0.34" :metalness="0.06" />
            </TresMesh>
            <TresMesh :position="vec3(0, MEAL_TABLE_HEIGHT * 0.48, 0)">
              <TresCylinderGeometry :args="[0.16, 0.2, MEAL_TABLE_HEIGHT * 0.72, 32]" />
              <TresMeshStandardMaterial :color="accent" :emissive="accent" :emissive-intensity="0.16" :roughness="0.3" :metalness="0.1" />
            </TresMesh>
            <TresMesh :position="vec3(0, MEAL_TABLE_HEIGHT, 0)" :scale="vec3(1.16, 0.42, 1)">
              <TresCylinderGeometry :args="[0.62, 0.67, 0.16, 40]" />
              <TresMeshStandardMaterial :color="coat" :roughness="0.28" :metalness="0.06" />
            </TresMesh>
          </TresGroup>

          <TresGroup ref="bowlGroup" :position="vec3(0, MEAL_BOWL_LOCAL_Y, 0)">
            <TresMesh :scale="vec3(1.18, 0.48, 1)">
              <TresCylinderGeometry :args="[0.38, 0.48, 0.22, 40]" />
              <TresMeshStandardMaterial :color="accent" :emissive="accent" :emissive-intensity="0.24" :roughness="0.28" :metalness="0.12" />
            </TresMesh>
            <TresMesh :position="vec3(0, 0.13, 0)" :scale="vec3(1, 0.28, 1)">
              <TresCylinderGeometry :args="[0.31, 0.31, 0.1, 40]" />
              <TresMeshStandardMaterial color="#151b35" :roughness="0.3" />
            </TresMesh>
            <TresGroup ref="foodGroup" :position="vec3(0, 0.19, 0)">
              <TresMesh :position="vec3(-0.12, 0.02, 0.03)">
                <TresSphereGeometry :args="[0.075, 18, 18]" />
                <TresMeshStandardMaterial :color="secondary" :emissive="secondary" :emissive-intensity="0.75" />
              </TresMesh>
              <TresMesh :position="vec3(0.08, 0.035, -0.07)">
                <TresSphereGeometry :args="[0.068, 18, 18]" />
                <TresMeshStandardMaterial color="#ffd977" emissive="#ffd977" :emissive-intensity="0.55" />
              </TresMesh>
              <TresMesh :position="vec3(0.13, 0.02, 0.08)">
                <TresSphereGeometry :args="[0.058, 18, 18]" />
                <TresMeshStandardMaterial :color="accent" :emissive="accent" :emissive-intensity="0.5" />
              </TresMesh>
            </TresGroup>
          </TresGroup>
        </TresGroup>
    </TresGroup>
  </TresGroup>
</template>
