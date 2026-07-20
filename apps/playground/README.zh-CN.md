# NOVA Playground

`apps/playground` 是基于 Nuxt 4、Vue 3、TresJS、Pinia、XState 和 GSAP 的 3D 云狐演示与页面审计实验环境。它用于验证宠物表现、状态机和交互方案，不单独维护与浏览器扩展不同的产品版本号。

## 已实现

- 无需外部模型的程序化 3D 云狐；
- 鼠标视线跟踪、眨眼、呼吸、招手、跳跃、扑腾、趴下、睡眠和随机动作；
- 说话嘴型、开心表情、疑惑表情和动作恢复；
- XState 宠物行为状态机；
- Pinia 本地存档：主题、亲密度、互动次数和彩蛋状态；
- VueUse 环境感知：空闲、页面可见性、鼠标和窗口尺寸；
- Nuxt Server API；
- 可选 OpenAI Responses API；未配置密钥时使用本地 Mock Agent；
- `/audit-lab` 页面用于浏览器扩展审计和网络能力回归。

## 环境要求

- Node.js 22 或更高；
- Corepack 和仓库锁定的 pnpm。

## 启动

从仓库根目录执行：

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev:playground
```

默认测试页面：

```text
http://localhost:3000
http://localhost:3000/audit-lab
```

## 验证

```bash
pnpm --filter @nova/playground typecheck
pnpm build:playground
```

当前基线已通过类型检查和生产构建。Three.js/TresJS 3D Chunk 可能超过 500 KB 并产生构建警告，但它通过异步组件加载，不进入页面审计 Content Script。

## 启用真实 AI

在 `apps/playground` 中准备环境文件：

```bash
cp .env.example .env
```

```env
OPENAI_API_KEY=你的密钥
OPENAI_MODEL=gpt-5.6-luna
```

API Key 只在 Nuxt 服务端读取，不会暴露给浏览器。

## 关键目录

```text
app/
├── components/pet/       # 3D 场景与云狐
├── components/ui/        # 聊天面板
├── machines/             # XState 状态机
├── stores/               # Pinia 存档
├── types/                # 共享前端类型
└── pages/                # 演示页与审计实验页
server/api/               # AI 指令接口
public/models/            # 可选 GLB 模型
```

## 动作与状态协议

Playground 的 `PetAnimation`、XState 事件和服务端 Schema 必须保持一致。当前支持的主要状态包括：

```text
idle
speaking
happy
thinking
sleeping
greeting
jumping
flapping
resting
```

`app/pages/index.vue` 将状态传给 `PetCanvas.vue`，再传给 `CloudFox.vue`。动作完成后必须回到稳定状态，不能让爪子、视线或身体姿态残留在动作中间值。

## 常见问题：3D 画布空白

Nuxt 嵌套组件的自动导入名称可能带目录前缀；TresJS 又会尝试把未解析标签当作 Three.js 对象。`PetCanvas.vue` 和页面组件应对嵌套组件使用显式导入，例如：

```ts
import CloudFox from './CloudFox.vue'
import ChatDock from '~/components/ui/ChatDock.vue'
```

出现 `CloudFox is not defined in THREE namespace`、`Failed to resolve component` 或 `target is not a constructor` 时：

```bash
rm -rf apps/playground/.nuxt
pnpm dev:playground
```

同时检查相关组件是否显式导入。

## 替换为正式 GLB 宠物

1. 将 `pet.glb` 放入 `public/models/`；
2. 新建使用 TresJS 模型加载能力的组件；
3. 保留现有 `behavior`、`emotion`、`pointer` 和 `secret-mode` 输入；
4. 将状态映射到 AnimationMixer 动画片段和 Blend Shape；
5. 保留页面层、Pinia、XState 和 AI 指令协议。

## 可直接尝试的指令

- `你会什么？`
- `切换一下主题`
- `给我打个招呼`
- `跳一下`
- `扑腾一下前爪`
- `趴下休息`
- `睡觉吧`
- `醒醒`
