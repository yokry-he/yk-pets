# Nuxt AI Pet

一个基于 Nuxt 4、Vue 3、TresJS、Pinia、XState 和 GSAP 的 3D AI 数字宠物 MVP。

## 已实现

- 程序化 3D「云狐」宠物，无需外部模型即可运行
- 鼠标视线追踪、眨眼、呼吸、跳跃、思考、睡眠与彩蛋动画
- XState 宠物行为状态机
- Pinia 本地存档：主题、亲密度、互动次数和彩蛋状态
- VueUse 环境感知：空闲、页面可见性、鼠标与窗口尺寸
- GSAP 首屏和滚动动画
- Nuxt Server API
- 可选 OpenAI Responses API + Structured Outputs
- 未配置 API Key 时自动使用本地 Mock AI

## 环境要求

- Node.js 22 或更高版本
- 推荐使用 pnpm（项目已包含锁文件）

## 启动

```bash
corepack enable
pnpm install
pnpm dev
```

也可以使用 npm：

```bash
npm install
npm run dev
```

打开终端显示的本地地址。

## 已验证

```bash
pnpm typecheck
pnpm build
```

生产构建可使用：

```bash
node .output/server/index.mjs
```

## 启用真实 AI

```bash
cp .env.example .env
```

在 `.env` 中填写：

```env
OPENAI_API_KEY=你的密钥
OPENAI_MODEL=gpt-5.6-luna
```

API Key 只在 Nuxt 服务端读取，不会暴露到浏览器。

## 关键目录

```text
app/
├── components/pet/       # 3D 场景与云狐
├── components/ui/        # 聊天面板
├── machines/             # XState 状态机
├── stores/               # Pinia 存档
├── types/                # 共享前端类型
└── pages/index.vue       # 主体验编排
server/api/               # AI 指令接口
```

## 替换为正式 GLB 宠物

当前 `app/components/pet/CloudFox.vue` 使用 Three.js 几何体拼装。正式模型接入时：

1. 将 `pet.glb` 放入 `public/models/`。
2. 新建 GLB 组件并使用 TresJS 的模型加载能力。
3. 保留组件的 `behavior`、`emotion`、`pointer`、`secret-mode` 输入。
4. 把状态映射到 AnimationMixer 动画片段和 Blend Shape。
5. 保留页面层、Pinia、XState 与 AI 指令协议，无需重写业务架构。

## 可直接尝试的指令

- `你会什么？`
- `切换一下主题`
- `展示你的真正能力`
- `睡觉吧`
- `醒醒`


## v1.2.0 动作增强

当前版本新增说话嘴型、开心表情、跳跃、前爪扑腾和趴下动作，并在 3D 面板中加入动作控制条。完整说明见 [`MOTION_UPGRADE.md`](./MOTION_UPGRADE.md)。
