<!--
  文件职责 / File responsibility
  网页内宠物覆盖层，协调菜单模式、提示气泡、动作分页和拖拽交互。
  In-page pet overlay coordinating menu modes, thought bubbles, motion pagination, and dragging.
-->
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { NOVA_PET_VOICE_PRESETS, type NovaPetAction, type NovaPetBehavior, type NovaPetVisualState, type NovaPetVoicePreset, type NovaRuntimeMessage } from '@nova/shared/messages'
import AvatarCanvas from '../../components/avatar/AvatarCanvas.vue'
import { PET_MOTIONS } from '../../components/avatar/pet-motions'
import type { PetMotionCategory, PetMotionIdleTier, PetMotionIntensity, PetMotionKind, PetPropKind } from '../../components/avatar/pet-motions'

const props = defineProps<{
  state: NovaPetVisualState
}>()

const emit = defineEmits<{
  action: [action: NovaPetAction]
}>()

type MenuMode = 'features' | 'motions' | 'agent'
type MenuState = 'closed' | MenuMode

type MenuItem = ActionMenuItem | MotionMenuItem

interface MenuItemBase {
  id: string
  mode: MenuMode
  icon: string
  label: string
  description: string
}

interface ActionMenuItem extends MenuItemBase {
  kind: 'action'
  action: NovaPetAction
  disabled?: () => boolean
  active?: () => boolean
  danger?: boolean
}

interface MotionMenuItem extends MenuItemBase {
  kind: 'motion'
  behavior: NovaPetBehavior
  duration: number
  idleEligible: boolean
  idleTier: PetMotionIdleTier
  intensity: PetMotionIntensity
  category: PetMotionCategory
  motionKind: PetMotionKind
  prop: PetPropKind
  interruptible: boolean
}

interface TooltipState {
  title: string
  description: string
  left: number
  top: number
  placement: 'above' | 'below'
}

interface ModeDefinition {
  id: MenuMode
  icon: string
  label: string
  description: string
}

// 菜单注册表与固定六槽位布局。 / Menu registries and fixed six-slot layout.
const PAGE_SIZE = 6
const MENU_MODE_STORAGE_KEY = 'nova:pet-menu-mode'
const PET_VOICE_STORAGE_KEY = 'nova:pet:voice-preset'
const ORBIT_SLOTS = [
  { x: -148, y: 42 },
  { x: -170, y: -12 },
  { x: -158, y: -68 },
  { x: -118, y: -116 },
  { x: -60, y: -148 },
  { x: 10, y: -132 },
] as const

const modeDefinitions: ModeDefinition[] = [
  { id: 'features', icon: '✦', label: '功能', description: '审计当前页面并查看完整报告' },
  { id: 'motions', icon: '◉', label: '动作', description: '控制 NOVA 的动作与表现' },
  { id: 'agent', icon: '⌘', label: '工程', description: '连接本地 Agent、生成补丁并验证项目' },
]
// UI 状态分为菜单、动作反馈、提示气泡、拖拽和闲时调度五组。 / UI state is grouped into menu, motion feedback, notices, dragging, and idle scheduling.
const shellRef = ref<HTMLElement>()
const menuState = ref<MenuState>('closed')
const lastMenuMode = ref<MenuMode>('features')
const modePickerOpen = ref(false)
const currentPage = reactive<Record<MenuMode, number>>({
  features: 0,
  motions: 0,
  agent: 0,
})

const motionItems: MotionMenuItem[] = PET_MOTIONS
  .slice()
  .sort((left, right) => left.order - right.order)
  .map(motion => ({
    id: motion.id,
    kind: 'motion' as const,
    mode: 'motions' as const,
    behavior: motion.behavior,
    label: motion.label,
    description: motion.description,
    icon: motion.icon,
    duration: motion.duration,
    idleEligible: motion.idleEligible,
    idleTier: motion.idleTier,
    intensity: motion.intensity,
    category: motion.category,
    motionKind: motion.kind,
    prop: motion.prop,
    interruptible: motion.interruptible,
  }))

const menuOpen = computed(() => menuState.value !== 'closed')
const activeMode = computed<MenuMode>(() => menuState.value === 'closed' ? lastMenuMode.value : menuState.value)
const activeModeDefinition = computed(() => modeDefinitions.find(mode => mode.id === activeMode.value) || modeDefinitions[0]!)
const localBehavior = ref<NovaPetBehavior | null>(null)
const localSpeech = ref('')
const localNoticeTitle = ref('')
const pointer = ref({ x: 0, y: 0 })
const offset = ref({ right: 18, bottom: 18 })
const pulseNonce = ref(0)
const motionNonce = ref(0)
const noticeOpen = ref(false)
const petVoicePreset = ref<NovaPetVoicePreset>('alien')
const tooltip = ref<TooltipState | null>(null)
const dragState = ref<{
  pointerId: number
  startX: number
  startY: number
  startRight: number
  startBottom: number
  moved: boolean
} | null>(null)
type BehaviorRequestSource = 'hover' | 'ui' | 'manual' | 'idle' | 'system'
interface QueuedBehaviorRequest {
  behavior: NovaPetBehavior
  duration: number
  idlePlayback: boolean
  source: BehaviorRequestSource
  priority: number
}

let behaviorTimer: number | null = null
let behaviorTransitionTimer: number | null = null
let queuedBehavior: QueuedBehaviorRequest | null = null
let activeBehaviorRequest: NovaPetBehavior | null = null
let avatarHovered = false
let hoverGreetingPlayed = false
let idleTimer: number | null = null
let rareIdleTimer: number | null = null
let highIdleTimer: number | null = null
let easterIdleTimer: number | null = null
let noticeTimer: number | null = null
let lastIdleBehavior: NovaPetBehavior | null = null
let motionVoiceContext: AudioContext | null = null
let motionVoiceSource: AudioBufferSourceNode | null = null
let motionVoiceGain: GainNode | null = null
let motionVoiceRequest = 0
let systemMotionVoiceActive = false
const motionVoiceData = new Map<string, Promise<ArrayBuffer>>()
const motionVoiceBuffers = new Map<string, Promise<AudioBuffer>>()

const behavior = computed(() => localBehavior.value || props.state.behavior)
const displaySpeech = computed(() => localSpeech.value || props.state.speech)
const noticeTitle = computed(() => localNoticeTitle.value || 'NOVA 思考中')
const avatarPointer = computed(() => behavior.value === 'idle' || behavior.value === 'listening' ? pointer.value : { x: 0, y: 0 })
const currentProgress = computed(() => {
  if (!props.state.issueCount) return '暂无问题'
  return `${Math.min(props.state.currentIssueIndex + 1, props.state.issueCount)} / ${props.state.issueCount}`
})
const previewLabel = computed(() => props.state.previewActive ? '撤销预览' : '预览修复')
const previewAction = computed<NovaPetAction>(() => props.state.previewActive ? 'rollback-preview' : 'preview-current')
const noticeHasDetails = computed(() => props.state.score > 0 || props.state.issueCount > 0 || props.state.busy || props.state.previewActive || props.state.behavior === 'confused')
const showAuditControls = computed(() => props.state.issueCount > 0 && !props.state.busy)
const containerStyle = computed(() => ({
  right: `${offset.value.right}px`,
  bottom: `${offset.value.bottom}px`,
}))

// 功能和工程项通过注册表生成；复杂操作只发出协议动作。 / Feature and engineering items are registry-driven; complex operations emit protocol actions only.
const featureItems = computed<ActionMenuItem[]>(() => [
  {
    id: 'audit',
    kind: 'action',
    mode: 'features',
    action: 'audit',
    icon: '✦',
    label: props.state.issueCount ? '重新审计' : '页面审计',
    description: '检查当前页面的性能、结构和无障碍问题',
    disabled: () => props.state.busy,
  },
  {
    id: 'report',
    kind: 'action',
    mode: 'features',
    action: 'open-report',
    icon: '▤',
    label: '完整报告',
    description: '在右侧栏查看审计结果和页面指标',
  },
])

const agentItems = computed<ActionMenuItem[]>(() => [
  {
    id: 'network-lab',
    kind: 'action',
    mode: 'agent',
    action: 'network-lab',
    icon: '⇄',
    label: '网络实验室',
    description: '拦截请求、配置 Mock、修改响应并分析慢资源',
  },
  {
    id: 'connect-agent',
    kind: 'action',
    mode: 'agent',
    action: 'connect-agent',
    icon: '⌁',
    label: props.state.agentConnected ? 'Agent 已连接' : '连接 Agent',
    description: props.state.agentConnected ? '本地项目 Agent 当前已连接' : '打开右侧栏并连接本地项目 Agent',
    active: () => props.state.agentConnected,
  },
  {
    id: 'generate-patch',
    kind: 'action',
    mode: 'agent',
    action: 'generate-patch',
    icon: '⌘',
    label: '生成补丁',
    description: '为当前审计问题生成源码补丁',
    disabled: () => !props.state.issueCount || props.state.busy,
  },
  {
    id: 'apply-patch',
    kind: 'action',
    mode: 'agent',
    action: 'apply-patch',
    icon: '✓',
    label: '应用补丁',
    description: '在右侧栏确认后写入已经生成的补丁',
    disabled: () => props.state.busy,
  },
  {
    id: 'run-checks',
    kind: 'action',
    mode: 'agent',
    action: 'run-checks',
    icon: '◇',
    label: '项目验证',
    description: '运行类型检查、测试和生产构建',
    disabled: () => props.state.busy,
  },
  {
    id: 'rollback-patch',
    kind: 'action',
    mode: 'agent',
    action: 'rollback-patch',
    icon: '↶',
    label: '回滚补丁',
    description: '恢复最近一次由 NOVA 写入的源码修改',
    disabled: () => props.state.busy,
    danger: true,
  },
])

const activeItems = computed<MenuItem[]>(() => {
  if (activeMode.value === 'features') return featureItems.value
  if (activeMode.value === 'agent') return agentItems.value
  return motionItems
})

const pageCount = computed(() => Math.max(1, Math.ceil(activeItems.value.length / PAGE_SIZE)))
const visibleItems = computed(() => {
  const page = Math.min(currentPage[activeMode.value], pageCount.value - 1)
  const start = page * PAGE_SIZE
  return activeItems.value.slice(start, start + PAGE_SIZE)
})

const idlePresets = motionItems.filter(item => item.idleEligible && item.idleTier === 'normal')
const rareIdlePresets = motionItems.filter(item => item.idleEligible && item.idleTier === 'rare')
const highIdlePresets = motionItems.filter(item => item.idleEligible && item.idleTier === 'high')
const easterIdlePresets = motionItems.filter(item => item.idleEligible && item.idleTier === 'easter')

function emitPulse() {
  pulseNonce.value += 1
}

function clearNoticeTimer() {
  if (!noticeTimer) return
  window.clearTimeout(noticeTimer)
  noticeTimer = null
}

function showNotice(duration = 5200) {
  clearNoticeTimer()
  noticeOpen.value = true
  if (duration <= 0) return
  noticeTimer = window.setTimeout(() => {
    noticeOpen.value = false
    noticeTimer = null
  }, duration)
}

function closeNotice() {
  clearNoticeTimer()
  noticeOpen.value = false
}

function openNoticeDetails() {
  runAction('open-report')
}

function markInteraction() {
  cancelIdleCarousel()
  cancelRareIdleCarousel()
  cancelHighIdleCarousel()
  cancelEasterIdleCarousel()
  scheduleIdleCarousel()
  scheduleRareIdleCarousel()
  scheduleHighIdleCarousel()
  scheduleEasterIdleCarousel()
}

function runAction(action: NovaPetAction) {
  emitPulse()
  markInteraction()
  hideTooltip()
  emit('action', action)
  playBehavior(action === 'audit' || action === 'generate-patch' || action === 'run-checks' ? 'thinking' : 'greeting', 900, false, 'ui')
  if (action === 'open-report' || isAgentAction(action)) closeMenu()
}

function isAgentAction(action: NovaPetAction) {
  return ['network-lab', 'connect-agent', 'generate-patch', 'apply-patch', 'run-checks', 'rollback-patch'].includes(action)
}

function toggleMenu() {
  if (dragState.value?.moved) return
  emitPulse()
  markInteraction()
  if (menuState.value === 'closed') {
    menuState.value = lastMenuMode.value
    modePickerOpen.value = false
    playBehavior(lastMenuMode.value === 'motions' ? 'listening' : 'greeting', 850, false, 'ui')
  }
  else {
    closeMenu()
    playBehavior('idle', 650, false, 'ui')
  }
}

function closeMenu() {
  menuState.value = 'closed'
  modePickerOpen.value = false
  hideTooltip()
}

function toggleModePicker() {
  modePickerOpen.value = !modePickerOpen.value
  hideTooltip()
  emitPulse()
}

function switchMenuMode(mode: MenuMode) {
  modePickerOpen.value = false
  if (menuState.value === mode) {
    hideTooltip()
    return
  }
  emitPulse()
  markInteraction()
  hideTooltip()
  menuState.value = mode
  lastMenuMode.value = mode
  persistMenuMode(mode)
  playBehavior(mode === 'motions' ? 'listening' : mode === 'agent' ? 'thinking' : 'greeting', 750, false, 'ui')
}

function openAgentMode() {
  modePickerOpen.value = false
  if (menuState.value === 'closed') {
    menuState.value = 'agent'
    lastMenuMode.value = 'agent'
    persistMenuMode('agent')
  }
  else {
    switchMenuMode('agent')
  }
}

function runQuickAudit() {
  runAction('audit')
}

// 手动和闲时动作共用入口，但手动触发拥有更高优先级并重启动画令牌。 / Manual and idle motions share one entry point; manual actions take priority and restart the motion token.
function runMotion(item: MotionMenuItem, source: 'manual' | 'idle' = 'manual') {
  if (props.state.busy) return
  // 当前动作仍在播放时重复点击不重启动画、不重复播放音效。 / Re-selecting the active motion neither restarts animation nor replays audio.
  if (activeBehaviorRequest === item.behavior && (behaviorTimer || behaviorTransitionTimer || localBehavior.value)) return
  if (queuedBehavior?.behavior === item.behavior) return
  if (source === 'manual') {
    emitPulse()
    markInteraction()
    hideTooltip()
  }
  else {
    lastIdleBehavior = item.behavior
  }
  playBehavior(item.behavior, item.duration, source === 'idle', source === 'idle' ? 'idle' : 'manual')
  showMotionFeedback(item, source)
}

function showMotionFeedback(item: MotionMenuItem, source: 'manual' | 'idle') {
  if (source !== 'manual') return
  playMotionVoice(item.behavior)
}

const motionVoiceAssets: Partial<Record<NovaPetBehavior, string>> = {
  greeting: 'greeting.mp3', jumping: 'jumping.mp3', flapping: 'flapping.mp3', resting: 'resting.mp3', stretching: 'stretching.mp3',
  eating: 'eating.mp3', backflip: 'backflip.mp3', 'tail-tornado': 'tail-tornado.mp3', 'diving-catch': 'diving-catch.mp3',
  'energy-burst': 'energy-burst.mp3', 'shy-peek': 'shy-peek.mp3', 'star-juggle': 'star-juggle.mp3', 'cloud-nap': 'cloud-nap.mp3',
  'sparkle-sneeze': 'sparkle-sneeze.mp3', 'fireworks-show': 'fireworks-show.mp3', 'curious-scan': 'curious-scan.mp3',
  'antenna-charge': 'antenna-charge.mp3', 'tail-glow': 'tail-glow.mp3',
}

const motionSpeechText: Partial<Record<NovaPetBehavior, string>> = {
  greeting: '嗨！看到你啦，今天也一起加油吧。',
  jumping: '轻轻蓄力，跳起来！',
  flapping: '扑腾扑腾，我在努力保持平衡。',
  resting: '让我安静趴一会儿，马上恢复精神。',
  stretching: '伸个大大的懒腰，把能量重新拉满。',
  eating: '补充一点星云能量，下一份任务交给我。',
  backflip: '看好啦，空翻，落地！',
  'tail-tornado': '尾巴开始聚风，旋风马上形成。',
  'diving-catch': '锁定能量球，我要飞扑接住它！',
  'energy-burst': '核心充能完成，释放星云能量！',
  'shy-peek': '我只是，偷偷看一眼。',
  'star-juggle': '一颗，两颗，三颗，星星都接稳啦。',
  'cloud-nap': '云朵软软的，让我平躺睡久一点。',
  'sparkle-sneeze': '阿嚏！不小心喷出一团星光！',
  'fireworks-show': '抬头看，今晚的烟花为你点亮。',
  'curious-scan': '触角雷达启动，正在好奇地观察四周。',
  'antenna-charge': '双触角汇聚中，能量脉冲正在成形。',
  'tail-glow': '能量沿着尾巴流动，尾尖亮起来啦。',
}

async function playMotionVoice(next: NovaPetBehavior) {
  stopMotionVoice()
  if (petVoicePreset.value === 'mute') return
  if (petVoicePreset.value === 'cute-girl' || petVoicePreset.value === 'cute-animal') {
    const text = motionSpeechText[next]
    if (!text) return
    const request = motionVoiceRequest
    systemMotionVoiceActive = true
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'NOVA_TTS_SPEAK',
        text,
        preset: petVoicePreset.value,
      } satisfies NovaRuntimeMessage) as { ok?: boolean; error?: string; voiceName?: string } | undefined
      if (request !== motionVoiceRequest) return
      if (!response?.ok) throw new Error(response?.error || '系统语音未能开始播放')
    }
    catch (error) {
      if (request === motionVoiceRequest) systemMotionVoiceActive = false
      console.warn('[NOVA system motion voice]', petVoicePreset.value, error)
    }
    return
  }

  const asset = motionVoiceAssets[next]
  if (!asset) return
  const request = motionVoiceRequest
  try {
    const context = ensureMotionVoiceContext()
    // resume() 必须在用户点击的同步调用链中触发，随后才等待资源解码。 / resume() must start inside the user gesture before awaiting resource decoding.
    const resume = context.state === 'suspended' ? context.resume() : Promise.resolve()
    const [buffer] = await Promise.all([loadMotionVoiceBuffer(context, asset), resume])
    if (request !== motionVoiceRequest) return

    const source = context.createBufferSource()
    const gain = context.createGain()
    source.buffer = buffer
    gain.gain.value = 0.9
    source.connect(gain)
    gain.connect(context.destination)
    motionVoiceSource = source
    motionVoiceGain = gain
    source.addEventListener('ended', () => {
      if (motionVoiceSource === source) {
        motionVoiceSource = null
        motionVoiceGain = null
      }
      source.disconnect()
      gain.disconnect()
    }, { once: true })
    source.start(0)
  }
  catch (error) {
    // 保留可诊断错误，但绝不回退到“滴”声。 / Keep failures diagnosable, but never fall back to notification beeps.
    console.warn('[NOVA motion voice]', asset, error)
  }
}

function stopMotionVoice() {
  motionVoiceRequest += 1
  if (systemMotionVoiceActive) {
    systemMotionVoiceActive = false
    chrome.runtime.sendMessage({ type: 'NOVA_TTS_STOP' } satisfies NovaRuntimeMessage).catch(() => undefined)
  }
  if (motionVoiceSource) {
    try {
      motionVoiceSource.stop()
    }
    catch {
      // 音源可能已经自然结束。 / The source may already have ended naturally.
    }
    motionVoiceSource.disconnect()
  }
  motionVoiceGain?.disconnect()
  motionVoiceSource = null
  motionVoiceGain = null
}

function ensureMotionVoiceContext() {
  if (motionVoiceContext) return motionVoiceContext
  const Context = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Context) throw new Error('当前浏览器不支持 Web Audio')
  motionVoiceContext = new Context({ latencyHint: 'interactive' })
  return motionVoiceContext
}

function loadMotionVoiceData(asset: string) {
  const existing = motionVoiceData.get(asset)
  if (existing) return existing
  const request = fetch(chrome.runtime.getURL(`audio/motions/zh-CN/${asset}`), { cache: 'force-cache' })
    .then((response) => {
      if (!response.ok) throw new Error(`语音资源加载失败：HTTP ${response.status}`)
      return response.arrayBuffer()
    })
  motionVoiceData.set(asset, request)
  request.catch(() => motionVoiceData.delete(asset))
  return request
}

function loadMotionVoiceBuffer(context: AudioContext, asset: string) {
  const existing = motionVoiceBuffers.get(asset)
  if (existing) return existing
  const request = loadMotionVoiceData(asset)
    .then(data => context.decodeAudioData(data.slice(0)))
  motionVoiceBuffers.set(asset, request)
  request.catch(() => motionVoiceBuffers.delete(asset))
  return request
}

function preloadMotionVoices() {
  for (const asset of new Set(Object.values(motionVoiceAssets).filter((value): value is string => Boolean(value)))) {
    loadMotionVoiceData(asset).catch(error => console.warn('[NOVA motion voice preload]', asset, error))
  }
}

async function restorePetVoicePreset() {
  const stored = await chrome.storage.local.get(PET_VOICE_STORAGE_KEY)
  petVoicePreset.value = normalizePetVoicePreset(stored[PET_VOICE_STORAGE_KEY])
}

function normalizePetVoicePreset(value: unknown): NovaPetVoicePreset {
  return typeof value === 'string' && NOVA_PET_VOICE_PRESETS.includes(value as NovaPetVoicePreset)
    ? value as NovaPetVoicePreset
    : 'alien'
}

function onPetVoiceStorageChanged(changes: Record<string, chrome.storage.StorageChange>, areaName: string) {
  if (areaName !== 'local' || !changes[PET_VOICE_STORAGE_KEY]) return
  stopMotionVoice()
  petVoicePreset.value = normalizePetVoicePreset(changes[PET_VOICE_STORAGE_KEY]?.newValue)
}

function activateMenuItem(item: MenuItem) {
  if (isItemDisabled(item)) return
  if (item.kind === 'motion') runMotion(item)
  else runAction(item.action)
}

function isItemDisabled(item: MenuItem) {
  return item.kind === 'action' ? Boolean(item.disabled?.()) : props.state.busy
}

function isItemActive(item: MenuItem) {
  return item.kind === 'action' && Boolean(item.active?.())
}

function orbitStyle(index: number) {
  const slot = ORBIT_SLOTS[index] || ORBIT_SLOTS[0]
  return {
    '--orbit-x': `${slot.x}px`,
    '--orbit-y': `${slot.y}px`,
    '--orbit-delay': `${index * 28}ms`,
  }
}

function changePage(nextPage: number) {
  const mode = activeMode.value
  currentPage[mode] = Math.max(0, Math.min(pageCount.value - 1, nextPage))
  hideTooltip()
  emitPulse()
}

function onMenuWheel(event: WheelEvent) {
  if (pageCount.value <= 1) return
  event.preventDefault()
  const delta = event.deltaY > 0 ? 1 : -1
  const next = (currentPage[activeMode.value] + delta + pageCount.value) % pageCount.value
  changePage(next)
}

function showTooltip(item: MenuItem, event: Event) {
  return showTooltipContent(item.label, item.description, event)
}

function showModeTooltip(mode: ModeDefinition, event: Event) {
  return showTooltipContent(mode.label, mode.description, event)
}

async function showTooltipContent(title: string, description: string, event: Event) {
  const target = event.currentTarget as HTMLElement | null
  const shell = shellRef.value
  if (!target || !shell) return
  await nextTick()
  const targetRect = target.getBoundingClientRect()
  const shellRect = shell.getBoundingClientRect()
  const tooltipWidth = 184
  const estimatedHeight = 64
  const centerX = targetRect.left - shellRect.left + targetRect.width / 2
  const maxLeft = shellRect.width - tooltipWidth / 2 - 8
  const left = Math.max(tooltipWidth / 2 + 8, Math.min(maxLeft, centerX))
  const aboveTop = targetRect.top - shellRect.top - estimatedHeight - 10
  const placement = aboveTop >= 8 ? 'above' : 'below'
  const top = placement === 'above'
    ? aboveTop
    : targetRect.bottom - shellRect.top + 10

  tooltip.value = {
    title,
    description,
    left,
    top,
    placement,
  }
}

function hideTooltip() {
  tooltip.value = null
}

function persistMenuMode(mode: MenuMode) {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return
  chrome.storage.local.set({ [MENU_MODE_STORAGE_KEY]: mode }).catch(() => undefined)
}

async function restoreMenuMode() {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return
  try {
    const stored = await chrome.storage.local.get(MENU_MODE_STORAGE_KEY)
    const value = stored[MENU_MODE_STORAGE_KEY]
    if (value === 'features' || value === 'motions' || value === 'agent') lastMenuMode.value = value
  }
  catch {
    // 菜单模式持久化失败不应影响宠物使用。 / Menu-mode persistence failures must not block pet interactions.
  }
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!menuOpen.value) return
  const path = event.composedPath()
  if (shellRef.value && path.includes(shellRef.value)) return
  closeMenu()
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && menuOpen.value) closeMenu()
}

function onPointerMove(event: PointerEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  pointer.value = {
    x: Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1)),
    y: Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1)),
  }

  const drag = dragState.value
  if (!drag || drag.pointerId !== event.pointerId) return
  const deltaX = event.clientX - drag.startX
  const deltaY = event.clientY - drag.startY
  if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) drag.moved = true

  const maxRight = Math.max(8, window.innerWidth - 420)
  const maxBottom = Math.max(8, window.innerHeight - 470)
  offset.value = {
    right: Math.max(8, Math.min(maxRight, drag.startRight - deltaX)),
    bottom: Math.max(8, Math.min(maxBottom, drag.startBottom - deltaY)),
  }
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  markInteraction()
  const target = event.currentTarget as HTMLElement
  target.setPointerCapture(event.pointerId)
  dragState.value = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startRight: offset.value.right,
    startBottom: offset.value.bottom,
    moved: false,
  }
}

function onPointerUp(event: PointerEvent) {
  const target = event.currentTarget as HTMLElement
  if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
  window.setTimeout(() => {
    dragState.value = null
  }, 0)
}

function onPointerLeave() {
  avatarHovered = false
  hoverGreetingPlayed = false
  if (!dragState.value) pointer.value = { x: 0, y: 0 }
}

function onAvatarEnter() {
  avatarHovered = true
  // 悬停只更新视线意图，不再触发任何行为状态，因此无法打断或排队动作。 / Hover only updates gaze intent and never starts a behavior, so it cannot interrupt or queue motions.
}

function behaviorPriority(source: BehaviorRequestSource) {
  if (source === 'system') return 5
  if (source === 'manual') return 4
  if (source === 'ui') return 3
  if (source === 'hover') return 2
  return 1
}

function playBehavior(
  next: NovaPetBehavior,
  duration: number,
  idlePlayback = false,
  source: BehaviorRequestSource = idlePlayback ? 'idle' : 'ui',
) {
  if (!idlePlayback) {
    cancelIdleCarousel()
    cancelRareIdleCarousel()
    cancelHighIdleCarousel()
    cancelEasterIdleCarousel()
  }

  const request: QueuedBehaviorRequest = {
    behavior: next,
    duration: Math.max(320, duration),
    idlePlayback,
    source,
    priority: behaviorPriority(source),
  }

  // 用户直接选择动作时，先结束当前动作并回到短暂中性姿态，再立即切换到新动作。 / Direct user motion selection interrupts the current motion through a short neutral blend.
  if (source === 'manual' && (behaviorTimer || behaviorTransitionTimer || localBehavior.value)) {
    interruptBehavior(request)
    return
  }

  if (behaviorTimer || behaviorTransitionTimer || localBehavior.value) {
    // 队列只保留最有意义的下一动作；主动画播放期间直接忽略悬停动作。 / The queue keeps the most relevant next intent and ignores hover while a main motion is active.
    if (source === 'hover') return
    if (!queuedBehavior || request.priority >= queuedBehavior.priority) queuedBehavior = request
    return
  }

  startBehavior(request)
}

function interruptBehavior(request: QueuedBehaviorRequest) {
  queuedBehavior = null
  activeBehaviorRequest = request.behavior
  if (behaviorTimer) window.clearTimeout(behaviorTimer)
  if (behaviorTransitionTimer) window.clearTimeout(behaviorTransitionTimer)
  behaviorTimer = null
  behaviorTransitionTimer = null
  localSpeech.value = ''
  localNoticeTitle.value = ''
  localBehavior.value = 'idle'
  motionNonce.value += 1
  behaviorTransitionTimer = window.setTimeout(() => {
    behaviorTransitionTimer = null
    startBehavior(request)
  }, 240)
}

function startBehavior(request: QueuedBehaviorRequest) {
  if (behaviorTransitionTimer) {
    window.clearTimeout(behaviorTransitionTimer)
    behaviorTransitionTimer = null
  }
  motionNonce.value += 1
  activeBehaviorRequest = request.behavior
  if (request.source === 'hover') hoverGreetingPlayed = true
  localBehavior.value = request.behavior
  behaviorTimer = window.setTimeout(() => finishBehavior(request), request.duration)
}

function finishBehavior(request: QueuedBehaviorRequest) {
  behaviorTimer = null
  localSpeech.value = ''
  localNoticeTitle.value = ''

  // 通过短暂的中性稳定姿态，让阻尼关节完成收尾后再进入下一动作。 / A short neutral settling pose lets damped rigs finish before the next motion starts.
  localBehavior.value = 'idle'
  behaviorTransitionTimer = window.setTimeout(() => {
    behaviorTransitionTimer = null
    localBehavior.value = null
    const next = queuedBehavior
    queuedBehavior = null
    if (next) {
      startBehavior(next)
      return
    }
    activeBehaviorRequest = null
    scheduleIdleCarousel()
    scheduleRareIdleCarousel()
    scheduleHighIdleCarousel()
    scheduleEasterIdleCarousel()
  }, 260)
}

function clearBehaviorQueue() {
  queuedBehavior = null
  activeBehaviorRequest = null
  if (behaviorTimer) window.clearTimeout(behaviorTimer)
  if (behaviorTransitionTimer) window.clearTimeout(behaviorTransitionTimer)
  behaviorTimer = null
  behaviorTransitionTimer = null
}

function cancelIdleCarousel() {
  if (!idleTimer) return
  window.clearTimeout(idleTimer)
  idleTimer = null
}

function cancelRareIdleCarousel() {
  if (!rareIdleTimer) return
  window.clearTimeout(rareIdleTimer)
  rareIdleTimer = null
}

function cancelHighIdleCarousel() {
  if (!highIdleTimer) return
  window.clearTimeout(highIdleTimer)
  highIdleTimer = null
}

function cancelEasterIdleCarousel() {
  if (!easterIdleTimer) return
  window.clearTimeout(easterIdleTimer)
  easterIdleTimer = null
}

function canPlayIdleMotion() {
  if (props.state.busy || menuOpen.value || document.visibilityState !== 'visible') return false
  if (localBehavior.value || behaviorTimer || behaviorTransitionTimer || queuedBehavior) return false
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  return true
}

// 三层闲时调度分别控制普通、生活和高能动作，避免高能动作频繁打扰。 / Three idle tiers schedule normal, lifestyle, and high-energy motions without frequent disruption.
function scheduleIdleCarousel() {
  cancelIdleCarousel()
  if (!canPlayIdleMotion()) return
  const delay = 10_000 + Math.round(Math.random() * 8_000)
  idleTimer = window.setTimeout(() => {
    if (!canPlayIdleMotion()) return scheduleIdleCarousel()
    const candidates = idlePresets.filter(item => item.behavior !== lastIdleBehavior)
    const item = candidates[Math.floor(Math.random() * candidates.length)] || idlePresets[0]
    if (item) runMotion(item, 'idle')
  }, delay)
}

function scheduleRareIdleCarousel() {
  cancelRareIdleCarousel()
  if (!canPlayIdleMotion()) return
  const delay = 34_000 + Math.round(Math.random() * 30_000)
  rareIdleTimer = window.setTimeout(() => {
    if (!canPlayIdleMotion()) return scheduleRareIdleCarousel()
    const candidates = rareIdlePresets.filter(item => item.behavior !== lastIdleBehavior)
    const item = candidates[Math.floor(Math.random() * candidates.length)] || rareIdlePresets[0]
    if (item) runMotion(item, 'idle')
  }, delay)
}

function scheduleHighIdleCarousel() {
  cancelHighIdleCarousel()
  if (!canPlayIdleMotion()) return
  const delay = 100_000 + Math.round(Math.random() * 80_000)
  highIdleTimer = window.setTimeout(() => {
    if (!canPlayIdleMotion()) return scheduleHighIdleCarousel()
    // 高能动作只在长时间闲置后低概率触发，避免干扰页面阅读。 / High-energy motions remain a low-probability long-idle surprise.
    if (Math.random() > 0.58) return scheduleHighIdleCarousel()
    const candidates = highIdlePresets.filter(item => item.behavior !== lastIdleBehavior)
    const item = candidates[Math.floor(Math.random() * candidates.length)] || highIdlePresets[0]
    if (item) runMotion(item, 'idle')
  }, delay)
}


function scheduleEasterIdleCarousel() {
  cancelEasterIdleCarousel()
  if (!canPlayIdleMotion()) return
  const delay = 150_000 + Math.round(Math.random() * 150_000)
  easterIdleTimer = window.setTimeout(() => {
    if (!canPlayIdleMotion()) return scheduleEasterIdleCarousel()
    // 彩蛋使用独立的长冷却与低概率门槛，避免失去惊喜感。 / Easter eggs use a separate long cooldown and low-probability gate to remain surprising.
    if (Math.random() > 0.28) return scheduleEasterIdleCarousel()
    const candidates = easterIdlePresets.filter(item => item.behavior !== lastIdleBehavior)
    const item = candidates[Math.floor(Math.random() * candidates.length)] || easterIdlePresets[0]
    if (item) runMotion(item, 'idle')
  }, delay)
}

function onVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    cancelIdleCarousel()
    cancelRareIdleCarousel()
    cancelHighIdleCarousel()
    cancelEasterIdleCarousel()
  }
  else {
    scheduleIdleCarousel()
    scheduleRareIdleCarousel()
    scheduleHighIdleCarousel()
    scheduleEasterIdleCarousel()
  }
}

watch(() => props.state.busy, (busy, previousBusy) => {
  if (busy) {
    cancelIdleCarousel()
    cancelRareIdleCarousel()
    cancelHighIdleCarousel()
    cancelEasterIdleCarousel()
    clearBehaviorQueue()
    localBehavior.value = null
    localSpeech.value = ''
    stopMotionVoice()
    showNotice(0)
  }
  else {
    scheduleIdleCarousel()
    scheduleRareIdleCarousel()
    scheduleHighIdleCarousel()
    scheduleEasterIdleCarousel()
    if (previousBusy) showNotice(props.state.issueCount > 0 ? 0 : 5200)
  }
})

watch(
  () => [props.state.speech, props.state.behavior, props.state.previewActive, props.state.currentIssueTitle] as const,
  ([speech, stateBehavior, previewActive, issueTitle], previous) => {
    if (!previous) return
    const [previousSpeech, previousBehavior, previousPreviewActive, previousIssueTitle] = previous
    const changed = speech !== previousSpeech
      || stateBehavior !== previousBehavior
      || previewActive !== previousPreviewActive
      || issueTitle !== previousIssueTitle
    if (!changed || props.state.busy) return
    const isDefaultHint = speech === '摸摸我可以打开所有网页审计和工程功能。'
    if (!isDefaultHint) showNotice(props.state.issueCount > 0 ? 0 : stateBehavior === 'confused' ? 8000 : 4800)
  },
)

watch(menuOpen, (open) => {
  if (open) {
    cancelIdleCarousel()
    cancelRareIdleCarousel()
    cancelHighIdleCarousel()
    cancelEasterIdleCarousel()
  }
  else {
    scheduleIdleCarousel()
    scheduleRareIdleCarousel()
    scheduleHighIdleCarousel()
    scheduleEasterIdleCarousel()
  }
})

watch(activeMode, () => {
  currentPage[activeMode.value] = Math.min(currentPage[activeMode.value], pageCount.value - 1)
  hideTooltip()
})

// 生命周期只注册文档级监听和恢复本地菜单状态；卸载时必须成对清理。 / Lifecycle registers document listeners and restores menu state; unmount performs symmetric cleanup.
onMounted(() => {
  document.addEventListener('visibilitychange', onVisibilityChange)
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
  document.addEventListener('keydown', onDocumentKeydown)
  chrome.storage.onChanged.addListener(onPetVoiceStorageChanged)
  restoreMenuMode().catch(() => undefined)
  restorePetVoicePreset().catch(error => console.warn('[NOVA voice preset]', error))
  preloadMotionVoices()
  scheduleIdleCarousel()
  scheduleRareIdleCarousel()
  scheduleHighIdleCarousel()
  scheduleEasterIdleCarousel()
})

onBeforeUnmount(() => {
  if (behaviorTimer) window.clearTimeout(behaviorTimer)
  clearNoticeTimer()
  stopMotionVoice()
  motionVoiceContext?.close().catch(() => undefined)
  motionVoiceContext = null
  motionVoiceData.clear()
  motionVoiceBuffers.clear()
  cancelIdleCarousel()
  cancelRareIdleCarousel()
  cancelHighIdleCarousel()
  cancelEasterIdleCarousel()
  document.removeEventListener('visibilitychange', onVisibilityChange)
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  document.removeEventListener('keydown', onDocumentKeydown)
  chrome.storage.onChanged.removeListener(onPetVoiceStorageChanged)
})
</script>

<template>
  <!-- 网页内固定覆盖层 / Fixed in-page overlay -->
  <section
    ref="shellRef"
    class="nova-pet-shell"
    :style="containerStyle"
    :data-menu-state="menuState"
    :data-notice-open="noticeOpen"
  >
    <div class="nova-pet-nebula" aria-hidden="true">
      <i v-for="star in 14" :key="star" class="nova-pet-star" />
    </div>
    <span v-if="pulseNonce" :key="pulseNonce" class="nova-pet-energy-pulse" aria-hidden="true" />

    <div v-if="noticeOpen" class="nova-pet-status" role="status" aria-live="polite">
      <span class="nova-pet-status__thought-dot nova-pet-status__thought-dot--large" aria-hidden="true" />
      <span class="nova-pet-status__thought-dot nova-pet-status__thought-dot--small" aria-hidden="true" />
      <button class="nova-pet-status__close" type="button" aria-label="关闭 NOVA 提示" @click="closeNotice">×</button>
      <div class="nova-pet-status__topline">
        <span>{{ noticeTitle }}</span>
        <b :class="{ good: state.score >= 90, warning: state.score < 90 && state.score >= 70, danger: state.score < 70 }">
          {{ state.score || '—' }}
        </b>
      </div>
      <p>{{ displaySpeech }}</p>
      <small v-if="state.currentIssueTitle">{{ currentProgress }} · {{ state.currentIssueTitle }}</small>

      <div v-if="showAuditControls" class="nova-pet-status__actions" aria-label="审计结果操作">
        <button type="button" :disabled="state.busy" @click="runAction('previous-issue')">← 上一个</button>
        <button type="button" :disabled="state.busy" @click="runAction('next-issue')">下一个 →</button>
        <button type="button" :disabled="state.busy" @click="runAction(previewAction)">
          {{ state.previewActive ? '↶ 撤销预览' : '◈ 预览修复' }}
        </button>
        <button type="button" @click="openNoticeDetails">▤ 完整报告</button>
      </div>

      <button v-else-if="noticeHasDetails" class="nova-pet-status__details" type="button" @click="openNoticeDetails">
        打开右侧详情
      </button>
    </div>

    <div
      v-if="menuOpen"
      class="nova-pet-mode-control"
      :data-expanded="modePickerOpen"
      aria-label="切换 NOVA 菜单模式"
    >
      <button
        v-if="!modePickerOpen"
        class="nova-mode-current"
        type="button"
        :aria-label="`当前模式：${activeModeDefinition.label}，点击切换模式`"
        @mouseenter="showModeTooltip(activeModeDefinition, $event)"
        @mouseleave="hideTooltip"
        @focus="showModeTooltip(activeModeDefinition, $event)"
        @blur="hideTooltip"
        @click.stop="toggleModePicker"
      >
        <span aria-hidden="true">{{ activeModeDefinition.icon }}</span>
      </button>

      <div v-else class="nova-mode-picker" role="group" aria-label="选择菜单模式">
        <button
          v-for="mode in modeDefinitions"
          :key="mode.id"
          class="nova-mode-option"
          type="button"
          :class="{ active: activeMode === mode.id }"
          :aria-label="`${mode.label}：${mode.description}`"
          @mouseenter="showModeTooltip(mode, $event)"
          @mouseleave="hideTooltip"
          @focus="showModeTooltip(mode, $event)"
          @blur="hideTooltip"
          @click.stop="switchMenuMode(mode.id)"
        >
          <span aria-hidden="true">{{ mode.icon }}</span>
        </button>
      </div>
    </div>

    <div
      v-if="menuOpen"
      class="nova-pet-menu-ring"
      aria-label="NOVA 快捷菜单"
      @wheel="onMenuWheel"
    >
      <button
        v-for="(item, index) in visibleItems"
        :key="item.id"
        class="nova-menu-action"
        type="button"
        :class="{
          active: isItemActive(item),
          danger: item.kind === 'action' && item.danger,
        }"
        :style="orbitStyle(index)"
        :disabled="isItemDisabled(item)"
        :aria-label="`${item.label}：${item.description}`"
        @mouseenter="showTooltip(item, $event)"
        @mouseleave="hideTooltip"
        @focus="showTooltip(item, $event)"
        @blur="hideTooltip"
        @click="activateMenuItem(item)"
      >
        <span aria-hidden="true">{{ item.icon }}</span>
        <i v-if="item.id === 'connect-agent'" class="nova-agent-state" :class="{ online: state.agentConnected }" aria-hidden="true" />
      </button>
    </div>

    <div v-if="menuOpen && pageCount > 1" class="nova-pet-page-dots" aria-label="菜单分页">
      <button
        v-for="page in pageCount"
        :key="page"
        type="button"
        :class="{ active: currentPage[activeMode] === page - 1 }"
        :aria-label="`切换到第 ${page} 页`"
        @click="changePage(page - 1)"
      />
    </div>

    <div
      v-if="tooltip"
      class="nova-pet-tooltip"
      :data-placement="tooltip.placement"
      :style="{ left: `${tooltip.left}px`, top: `${tooltip.top}px` }"
      role="tooltip"
    >
      <strong>{{ tooltip.title }}</strong>
      <span>{{ tooltip.description }}</span>
    </div>

    <button
      class="nova-pet-avatar"
      type="button"
      :aria-expanded="menuOpen"
      aria-label="与 NOVA 互动，单击打开菜单，双击开始审计"
      @click="toggleMenu"
      @dblclick.stop="runQuickAudit"
      @contextmenu.prevent="openAgentMode"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @pointerleave="onPointerLeave"
      @mouseenter="onAvatarEnter"
    >
      <AvatarCanvas
        compact
        transparent
        :behavior="behavior"
        :emotion="behavior === 'confused' ? 'confused' : ['happy', 'greeting', 'jumping', 'flapping', 'stretching', 'eating', 'backflip', 'tail-tornado', 'diving-catch', 'energy-burst', 'shy-peek', 'star-juggle', 'cloud-nap', 'sparkle-sneeze', 'fireworks-show', 'curious-scan', 'antenna-charge', 'tail-glow'].includes(behavior) ? 'happy' : 'curious'"
        :speaking="state.busy"
        :score="state.score || 60"
        :pointer="avatarPointer"
        :motion-key="motionNonce"
      />
      <span v-if="state.issueCount" class="nova-pet-badge">{{ state.issueCount > 99 ? '99+' : state.issueCount }}</span>
      <span v-if="state.busy" class="nova-pet-busy" />
    </button>

  </section>
</template>
