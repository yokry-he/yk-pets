# YK-PETS Playground

`apps/playground` 是基于 Nuxt 4、Vue 3、TresJS、Pinia、XState 和 GSAP 的 3D 宠物演示、云狐工坊与页面审计实验环境。

当前演示角色：

```text
产品品牌：YK-PETS
宠物名字：云灵（Zeph）
宠物物种：云狐（Cloud Fox）
```

Playground 用于验证宠物表现、状态机、外观配方、交互方案和未来的多宠物 SDK，不单独维护与浏览器扩展不同的产品版本号。

## 已实现

- 无需外部模型的程序化 3D 云狐；
- 鼠标视线跟踪、眨眼、呼吸、招手、跳跃、扑腾、趴下、睡眠和随机动作；
- 说话嘴型、开心表情、疑惑表情和动作恢复；
- XState 宠物行为状态机；
- Pinia 状态存储；
- GSAP 动作与界面动效；
- 页面审计实验页；
- 云狐工坊：部件选择、受限比例、发光、胸背标志、动作测试和 JSON 配方管理；
- YK-PETS 客户端品牌桥，用于迁移旧演示组件中的 NOVA 文案。

## 运行

在仓库根目录执行：

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev:playground
```

默认首页：

```text
http://localhost:3000
```

云狐工坊：

```text
http://localhost:3000/studio
```

审计实验页：

```text
http://localhost:3000/audit-lab
```

## 云狐工坊

工坊当前支持：

- 耳朵、眼睛、鼻子、嘴、尾巴和触角样式；
- 身体、头部、前肢、爪子、眼睛、耳朵、尾巴和触角安全比例；
- 毛色、眼睛颜色和五个发光通道；
- 固定、动作联动和彩虹发光模式；
- 胸口名字缩写和后背 `YK` 标志；
- 四向视角、三种背景和六项动作测试；
- 本地保存、重置、随机生成、JSON 导入与导出。

完整设计和数据结构见 [`docs/zh-CN/CLOUD-FOX-STUDIO.md`](../../docs/zh-CN/CLOUD-FOX-STUDIO.md)。

## 品牌与身份约束

- YK-PETS 是产品品牌，不是宠物名字；
- 云灵是当前宠物名字，Zeph 是英文名；
- 云狐是物种，Cloud Fox 是英文物种名；
- 新宠物应通过稳定 ID、物种、名字和能力注册；
- 外观配方与个体状态分离，换外观不会复制亲密度或记忆；
- Playground 的长期目标是验证同一运行时可以加载多个宠物，而不是继续把云灵写死在通用核心。

## 后续用途

- 将云狐工坊配方接入扩展正式宠物；
- 验证 `pet-core` 状态和动作调度；
- 验证云灵作为第一个 `PetDefinition`；
- 验证第二个宠物和动作降级；
- 验证 `<yk-pet>` Web Component；
- 提供 Vanilla、React、Vue、Svelte 和 Astro 的接入示例。
