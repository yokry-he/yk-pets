<!--
  文件职责 / File responsibility
  Playground 首页与功能入口。
  Playground home page and feature entry.
-->
<script setup lang="ts">
import { useMachine } from '@xstate/vue'
import ChatDock from '~/components/ui/ChatDock.vue'
import gsap from 'gsap'
import { useDocumentVisibility, useEventListener, useIdle, useMouse, usePreferredReducedMotion, useWindowSize } from '@vueuse/core'
import { petMachine } from '~/machines/pet.machine'
import { usePetStore } from '~/stores/pet'
import type { ChatMessage, PetAnimation, PetCommand } from '~/types/pet'

const PetCanvas = defineAsyncComponent(() => import('~/components/pet/PetCanvas.vue'))

const pet = usePetStore()
const { snapshot, send } = useMachine(petMachine)
const { x, y } = useMouse({ type: 'client' })
const { width, height } = useWindowSize()
const { idle } = useIdle(45_000)
const visibility = useDocumentVisibility()
const reducedMotion = usePreferredReducedMotion()
let scrollTriggerPlugin: typeof import('gsap/ScrollTrigger')['ScrollTrigger'] | undefined

const thinking = ref(false)
const speaking = ref(false)
const secretMode = ref(false)
let speakingTimer: number | undefined
const speech = ref('我刚刚从浏览器的梦里醒来。摸摸我，或者问我会什么。')
const messages = ref<ChatMessage[]>([
  {
    id: cryptoId(),
    role: 'pet',
    content: speech.value,
  },
])

const behavior = computed(() => String(snapshot.value.value))
const pointer = computed(() => ({
  x: width.value ? Math.min(1, Math.max(-1, (x.value / width.value) * 2 - 1)) : 0,
  y: height.value ? Math.min(1, Math.max(-1, (y.value / height.value) * 2 - 1)) : 0,
}))

const behaviorLabel = computed(() => {
  const labels: Record<string, string> = {
    loading: '正在连接',
    waking: '苏醒中',
    idle: '观察你',
    thinking: '思考中',
    talking: '回应中',
    happy: '很开心',
    excited: '能量爆发',
    confused: '有点疑惑',
    sleeping: '睡着了',
    greeting: '向你打招呼',
    playing: '玩耍模式',
    spinning: '高速转圈',
    listening: '认真听你说',
    jumping: '开心跳跃',
    flapping: '扑腾前爪',
    resting: '趴下休息',
  }
  return labels[behavior.value] || behavior.value
})

const abilityCards = [
  {
    number: '01',
    title: '具身 AI Agent',
    copy: 'AI 不只返回文字，而是输出受约束的动作指令，驱动宠物、主题和页面。',
    tag: 'Structured Commands',
  },
  {
    number: '02',
    title: '实时 3D 情绪',
    copy: '视线、耳朵、尾巴、呼吸、眨眼和能量环都由 Vue 状态实时控制。',
    tag: 'TresJS + Three.js',
  },
  {
    number: '03',
    title: '可预测行为系统',
    copy: 'XState 负责解决动画冲突，让思考、睡眠、兴奋和对话状态可靠切换。',
    tag: 'XState v5',
  },
  {
    number: '04',
    title: '环境感知',
    copy: '宠物能感知鼠标、页面可见性和用户空闲状态，并在本地记住互动。',
    tag: 'VueUse + Pinia',
  },
]

useHead({
  title: 'YK-PETS — 云灵 Zeph，住在浏览器里的 AI 云狐',
  meta: [
    {
      name: 'description',
      content: '使用 Nuxt、Vue、TresJS 与 XState 打造的 YK-PETS 3D 云狐云灵（Zeph）体验。',
    },
  ],
})

onMounted(async () => {
  pet.hydrate()

  if (reducedMotion.value !== 'reduce') {
    const { ScrollTrigger } = await import('gsap/ScrollTrigger')
    scrollTriggerPlugin = ScrollTrigger
    gsap.registerPlugin(ScrollTrigger)
    const intro = gsap.timeline({ defaults: { ease: 'power3.out' } })
    intro
      .from('.topbar', { y: -24, opacity: 0, duration: 0.7 })
      .from('.hero-copy > *', { y: 34, opacity: 0, stagger: 0.08, duration: 0.8 }, '-=0.35')
      .from('.experience-panel', { scale: 0.96, opacity: 0, duration: 1 }, '-=0.7')

    gsap.from('.ability-card', {
      scrollTrigger: {
        trigger: '.abilities-grid',
        start: 'top 82%',
      },
      y: 52,
      opacity: 0,
      stagger: 0.12,
      duration: 0.85,
      ease: 'power3.out',
    })
  }
})

onBeforeUnmount(() => {
  scrollTriggerPlugin?.getAll().forEach(trigger => trigger.kill())
  if (speakingTimer) window.clearTimeout(speakingTimer)
})

watch(idle, (isIdle) => {
  send({ type: isIdle ? 'SLEEP' : 'WAKE' })
  if (isIdle) speech.value = '嘘……我先在这里充一会儿电。'
})

watch(visibility, (state) => {
  send({ type: state === 'hidden' ? 'SLEEP' : 'WAKE' })
})

function cryptoId() {
  if (import.meta.client && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function petZeph() {
  pet.interact(3)
  const cycle = pet.interactions % 7

  if (cycle === 0) {
    triggerMotion('SPIN', '好耶，我给你表演一个转圈。', 'excited')
    return
  }

  if (cycle === 2) {
    triggerMotion('GREET', '摸摸收到！那我摇着尾巴跟你打个招呼。', 'happy')
    return
  }

  if (cycle === 4) {
    triggerMotion('JUMP', '这次的摸摸让我直接开心到跳起来。', 'happy')
    return
  }

  if (cycle === 6) {
    triggerMotion('FLAP', '能量有点多，我先扑腾两下前爪。', 'excited')
    return
  }

  speech.value = pet.interactions % 4 === 0
    ? '再摸一下，我的尾巴就要失控了。'
    : '收到一份来自现实世界的摸摸。'
  pet.setEmotion('happy')
  startSpeaking(speech.value)
  send({ type: 'PET' })
}

function mapAnimation(animation: PetAnimation) {
  const eventMap = {
    idle: 'TALK',
    happy: 'HAPPY',
    curious: 'LISTEN',
    confused: 'CONFUSED',
    sleepy: 'SLEEP',
    excited: 'EXCITED',
    thinking: 'THINK',
    greeting: 'GREET',
    playful: 'PLAY',
    spinning: 'SPIN',
    listening: 'LISTEN',
    jumping: 'JUMP',
    flapping: 'FLAP',
    resting: 'REST',
  } as const
  send({ type: eventMap[animation] })
}

async function submitMessage(content: string) {
  messages.value.push({ id: cryptoId(), role: 'user', content })
  thinking.value = true
  pet.interact(1)
  pet.setEmotion('curious')
  send({ type: 'THINK' })

  try {
    const command = await $fetch<PetCommand>('/api/pet-command', {
      method: 'POST',
      body: {
        message: content,
        context: {
          theme: pet.theme,
          affection: pet.affection,
          secretUnlocked: pet.secretUnlocked,
        },
      },
    })

    speech.value = command.message
    messages.value.push({ id: cryptoId(), role: 'pet', content: command.message })
    startSpeaking(command.message)
    pet.setEmotion(command.emotion)
    mapAnimation(command.animation)
    runAction(command)
  }
  catch {
    const fallback = '连接出现了一个小波纹。不过没关系，我还在这里。'
    speech.value = fallback
    messages.value.push({ id: cryptoId(), role: 'pet', content: fallback })
    startSpeaking(fallback)
    pet.setEmotion('confused')
    send({ type: 'CONFUSED' })
  }
  finally {
    thinking.value = false
  }
}

function startSpeaking(message: string) {
  speaking.value = true
  if (speakingTimer) window.clearTimeout(speakingTimer)
  const duration = Math.min(4_800, Math.max(1_500, message.length * 92))
  speakingTimer = window.setTimeout(() => {
    speaking.value = false
  }, duration)
}

function triggerMotion(
  type: 'GREET' | 'PLAY' | 'SPIN' | 'LISTEN' | 'JUMP' | 'FLAP' | 'REST',
  message: string,
  emotion: 'happy' | 'curious' | 'excited' | 'sleepy' = 'happy',
) {
  speech.value = message
  pet.setEmotion(emotion)
  startSpeaking(message)
  send({ type })
}

function runAction(command: PetCommand) {
  switch (command.action.type) {
    case 'toggle-theme':
      pet.toggleTheme()
      break
    case 'scroll-abilities':
      document.querySelector('#abilities')?.scrollIntoView({ behavior: 'smooth' })
      break
    case 'reveal-secret':
      revealSecret()
      break
    case 'sleep':
      send({ type: 'SLEEP' })
      break
    case 'none':
      break
  }
}

function revealSecret() {
  secretMode.value = true
  pet.unlockSecret()
  pet.setEmotion('excited')
  send({ type: 'EXCITED' })
  window.setTimeout(() => {
    secretMode.value = false
  }, 8_000)
}

function scrollToAbilities() {
  document.querySelector('#abilities')?.scrollIntoView({ behavior: 'smooth' })
}

useEventListener('keydown', (event: KeyboardEvent) => {
  if (event.key.toLowerCase() === 'p' && !(event.target instanceof HTMLInputElement)) {
    petZeph()
  }
})
</script>

<template>
  <main class="site-shell" :data-theme="pet.theme" :class="{ 'secret-mode': secretMode }">
    <div class="ambient ambient--one" />
    <div class="ambient ambient--two" />
    <div class="noise" />

    <header class="topbar">
      <a class="brand" href="#top" aria-label="YK-PETS 首页">
        <span class="brand-mark">YK</span>
        <span>YK-PETS<span class="brand-dot">.</span></span>
      </a>

      <nav aria-label="主导航">
        <a href="#experience">体验</a>
        <a href="#abilities">能力</a>
        <a href="#architecture">架构</a>
      </nav>

      <button class="theme-toggle" type="button" @click="pet.toggleTheme()">
        <span>{{ pet.theme === 'dark' ? 'LIGHT' : 'DARK' }}</span>
        <i :class="{ active: pet.theme === 'light' }" />
      </button>
    </header>

    <section id="top" class="hero-section">
      <div class="hero-copy">
        <div class="eyebrow"><i /> BROWSER-NATIVE INTELLIGENCE</div>
        <h1>
          它不只是聊天，<br>
          <span>它住在你的网页里。</span>
        </h1>
        <p class="hero-description">
          云灵（Zeph）是一只拥有身体、情绪和行为状态的 3D AI 云狐。它会观察你、记住你，并用动作改变整个网站。现在它还会打招呼、转圈、靠近倾听，并用更灵动的耳朵、尾巴和前爪回应你。
        </p>

        <div class="hero-actions">
          <button class="primary-action" type="button" @click="scrollToAbilities">
            探索它的能力 <span>↓</span>
          </button>
          <button class="ghost-action" type="button" @click="revealSecret">
            触发隐藏模式 <span>✦</span>
          </button>
        </div>

        <dl class="hero-stats">
          <div>
            <dt>{{ pet.affection }}%</dt>
            <dd>亲密度</dd>
          </div>
          <div>
            <dt>{{ pet.interactions }}</dt>
            <dd>互动次数</dd>
          </div>
          <div>
            <dt>60 FPS</dt>
            <dd>实时渲染目标</dd>
          </div>
        </dl>
      </div>

      <div id="experience" class="experience-panel">
        <div class="experience-toolbar">
          <div class="window-dots"><i /><i /><i /></div>
          <span>ZEPH_CORE / LIVE</span>
          <span class="fps-badge">WEBGL</span>
        </div>

        <ClientOnly>
          <PetCanvas
            :behavior="behavior"
            :emotion="pet.emotion"
            :speaking="speaking"
            :pointer="pointer"
            :secret-mode="secretMode"
            :theme="pet.theme"
            @pet="petZeph"
          />
          <template #fallback>
            <div class="canvas-fallback">正在唤醒云灵…</div>
          </template>
        </ClientOnly>

        <div class="motion-console" aria-label="云灵动作控制">
          <span>MOTION</span>
          <button type="button" @click="triggerMotion('GREET', '嗨，我在这里。很高兴见到你。', 'happy')">招手</button>
          <button type="button" @click="triggerMotion('JUMP', '准备好了吗？我跳给你看。', 'happy')">跳跃</button>
          <button type="button" @click="triggerMotion('FLAP', '前爪动力系统启动，扑腾两下。', 'excited')">扑腾</button>
          <button type="button" @click="triggerMotion('REST', '我趴一会儿，但耳朵还在听。', 'sleepy')">趴下</button>
        </div>

        <div class="pet-hud">
          <div>
            <span class="hud-label">CURRENT STATE</span>
            <strong><i /> {{ behaviorLabel }}</strong>
          </div>
          <div class="speech-bubble">{{ speech }}</div>
          <div class="energy-meter">
            <span>ENERGY</span>
            <b><i :style="{ width: `${Math.max(24, pet.affection)}%` }" /></b>
          </div>
        </div>
      </div>
    </section>

    <section id="abilities" class="abilities-section">
      <div class="section-heading">
        <span>CAPABILITY MATRIX / 04</span>
        <h2>让 AI 从“回答问题”<br>升级为“操纵体验”。</h2>
        <p>页面、宠物和 Agent 共享同一个事件系统，因此每一次回复都可以成为可见、可感知的动作。</p>
      </div>

      <div class="abilities-grid">
        <article v-for="card in abilityCards" :key="card.number" class="ability-card">
          <span class="ability-number">{{ card.number }}</span>
          <div class="ability-icon">✦</div>
          <h3>{{ card.title }}</h3>
          <p>{{ card.copy }}</p>
          <span class="ability-tag">{{ card.tag }}</span>
        </article>
      </div>
    </section>

    <section id="architecture" class="architecture-section">
      <div class="architecture-copy">
        <span>EVENT-DRIVEN ARCHITECTURE</span>
        <h2>Vue 负责世界，<br>XState 负责大脑。</h2>
        <p>所有 AI 结果先经过结构校验，再转换成有限事件；模型不会直接接触 Three.js 或任意执行前端代码。</p>
      </div>

      <div class="pipeline" aria-label="系统处理流程">
        <div><b>01</b><span>用户输入</span><small>Vue UI</small></div>
        <i>→</i>
        <div><b>02</b><span>结构化指令</span><small>Nuxt API</small></div>
        <i>→</i>
        <div><b>03</b><span>行为仲裁</span><small>XState</small></div>
        <i>→</i>
        <div><b>04</b><span>3D 表现</span><small>TresJS</small></div>
      </div>
    </section>

    <ChatDock :messages="messages" :thinking="thinking" @submit="submitMessage" />

    <footer>
      <span>YK-PETS / ZEPH CLOUD FOX EXPERIMENT</span>
      <span>NUXT · VUE · TRESJS · XSTATE</span>
    </footer>
  </main>
</template>
