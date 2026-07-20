<div align="center">

# YK Pets

**面向浏览器 2D/3D 宠物、页面智能 Agent 与受控开发工作流的模块化 TypeScript 平台**

[简体中文](./README.md) · [English](./README.en.md) · [版本历史](./CHANGELOG.md) · [Changelog](./CHANGELOG.en.md)

**平台版本 `0.7.8` · 28 个 SDK · 337 项自动测试 · 扩展稳定基线 `0.6.10`**

</div>

> [!IMPORTANT]
> YK Pets 当前仓库主要提供可组合 SDK、扩展运行时、受信任宿主协议和集成示例。它不是一个已经打包完成、可以直接安装的 `.crx` 成品，也不包含生产使用的 3D 模型、贴图、音频资源、完整 Manifest 或商店发布配置。最终产品需要由宿主项目补充 Renderer、资源、UI、权限声明和构建流程。

## 目录

- [项目定位](#项目定位)
- [设计原则](#设计原则)
- [核心能力](#核心能力)
- [整体架构](#整体架构)
- [当前状态](#当前状态)
- [快速开始](#快速开始)
- [基础接入](#基础接入)
- [SDK 包说明](#sdk-包说明)
- [项目结构](#项目结构)
- [安全模型](#安全模型)
- [开发与验证](#开发与验证)
- [版本演进](#版本演进)
- [技术文档](#技术文档)
- [已知边界](#已知边界)
- [路线图](#路线图)
- [参与开发](#参与开发)
- [许可证](#许可证)

## 项目定位

YK Pets 的长期目标，是构建一个既有情感陪伴感、又能真正参与日常工作的浏览器宠物平台。

宠物可以在网页中展示 2D/3D 形象、动作、表情、声音与思考气泡，也可以作为受控 Agent 的交互入口，协助完成：

- 页面内容理解、摘要和翻译；
- 文档与结构化内容处理；
- 前端页面审计、问题定位和变更报告；
- DOM 到 Vue 2 / Vue 3 源码映射；
- Lighthouse 与声明式 Playwright 修复前后验证；
- 经用户明确审批的源码补丁执行；
- 隔离 Git Worktree 中的提交与允许列表推送；
- Pull Request、Checks、Review、Merge 与发布后清理治理。

项目采用模块化 SDK 设计。网页、Content Script、Extension Background、本地 Agent Host、CI Host 和 GitHub Provider 通过固定协议协作，避免把 Shell、GitHub Token、任意脚本执行能力或文件系统权限暴露给低信任页面环境。

## 设计原则

### 1. 宠物体验与工作能力解耦

渲染、动作、声音、页面分析、源码修改、Git 发布和远程协作是相互独立的能力层。宿主可以只使用轻量 2D 宠物，也可以逐步接入 3D、Agent、审计和开发工作流。

### 2. 默认安全失败

当权限、审批、文件哈希、Git Head、PR 快照或验证结果不满足要求时，操作默认终止，而不是尝试“尽可能继续”。

### 3. 高成本能力延迟加载

3D Renderer、页面审计、深度分析、安全修改、仓库发布和远程协作按需加载，普通网页不会因为未使用的开发能力承担额外启动成本。

### 4. 页面环境不持有高权限凭据

Content Script 和页面 UI 只提交声明式请求。GitHub Token、HMAC 密钥、文件写入、Git 命令和 CI 凭据必须保留在受信任的 Background、本地 Agent Host 或 CI Host 中。

### 5. 修改可解释、可验证、可回滚

补丁计划必须描述准确的文件范围与哈希前置条件；执行前展示预览并签发一次性审批；执行后运行验证；失败时自动逆序回滚，并保护用户在执行期间产生的外部修改。

## 核心能力

### 自适应宠物渲染

- 统一的 `PetRenderer` / `PetRendererFactory` 协议；
- WebGL 不可用、上下文丢失、低 FPS、长任务、低内存、低电量、Save-Data 与减少动画偏好检测；
- 3D 与 2D Renderer 状态迁移；
- 无贴图依赖的 Canvas 2D 云狐兜底 Renderer；
- 3D 初始化或恢复失败时安全回到 2D；
- 页面隐藏、离屏、冻结或 `pagehide` 时暂停渲染。

### 浏览器扩展运行时

- 按站点启用、暂停或隐藏宠物；
- 按站点设置 `auto / 2d / 3d`；
- 分别控制声音、交互和页面审计；
- 支持 Origin、子域通配符、路径、端口、优先级和会话临时覆盖；
- 支持 SPA 导航后重新解析站点策略；
- 3D、审计、分析、修改、仓库发布和远程协作独立延迟加载。

### Agent 工具与插件治理

- 工具能力声明和精确权限范围；
- 拒绝优先的权限合并；
- 一次性确认令牌、强制超时、Abort 与审计记录；
- 插件 Manifest 校验、语义版本兼容、依赖拓扑和循环检测；
- 禁止插件通过通配符扩大宿主权限；
- 能力提供者先于消费者激活。

### 页面深度分析

- Origin 绑定的只读 Chrome DevTools Protocol 桥接；
- DOM 稳定选择器生成；
- Vue 2 `__vue__` 和 Vue 3 `__vueParentComponent` 归属识别；
- Inspector 元数据与 Source Map v3 定位；
- 多证据源码候选排序与置信度；
- Adapter 驱动的 Lighthouse 和声明式 Playwright 前后对比；
- JSON / Markdown 结构化变更报告。

### 安全源码修改

- `yk-pets.patch-plan/v1` 声明式补丁计划；
- 创建、更新、删除和移动文件；
- SHA-256 前置条件、路径约束与字节预算；
- 文件级 Compare-And-Swap 事务；
- 中途失败自动逆序回滚；
- 外部并发修改冲突保护；
- 验证失败、异常、超时或取消后自动恢复。

### 受控 Git 发布

- 隔离 Git Worktree 会话；
- 固定 Git 子命令、参数数组和 `shell: false`；
- 精确暂存、提交和允许列表内推送；
- 分支、路径、Diff、密钥扫描、验证和 Commit Message 门禁；
- 一次性发布审批；
- 追加式 SHA-256 哈希链提交账本；
- 强制 Draft Pull Request Adapter。

### Pull Request 生命周期治理

- 仓库允许列表内的固定 GitHub Provider；
- PR、Checks、Reviews 与 Review Threads 前后双读；
- 采集期间 Head、状态和更新时间漂移检测；
- Review 回复与 Resolve 精确计划；
- 合并资格 `eligible / waiting / blocked` 判定；
- 失败 Check 精确重试；
- Merge Method 绑定的一次性审批；
- 仅在 PR 已合并后执行分支与 Worktree 清理。

## 整体架构

```mermaid
flowchart LR
  Page[网页 / Content Script\n低信任环境]
  Runtime[ExtensionPetRuntime\n站点策略与延迟加载]
  Render[2D / 3D Renderer\n生命周期与自适应降级]
  Analyze[只读分析层\nCDP / Vue / Source Map / 验证]
  Background[Extension Background\n固定消息路由]
  Host[Local Agent / CI Host\n文件系统、Git、审批密钥]
  Repo[隔离 Worktree\n事务、验证、提交、账本]
  GitHub[GitHub Provider\nPR / Checks / Review / Merge]

  Page --> Runtime
  Runtime --> Render
  Runtime --> Analyze
  Runtime --> Background
  Background --> Host
  Host --> Repo
  Host --> GitHub
  Analyze -. 只读结果 .-> Host
```

### 信任边界

| 区域 | 可以做什么 | 不应持有什么 |
|---|---|---|
| 网页 / Content Script | 展示宠物、收集用户操作、发送声明式请求 | GitHub Token、HMAC 密钥、任意文件权限、Shell |
| Extension Runtime | 站点策略、Renderer 生命周期、功能延迟加载 | 任意远程 API 与动态代码执行能力 |
| Extension Background | 固定消息路由、浏览器 API 适配 | 无限制 Shell、任意 GitHub URL |
| Local Agent / CI Host | 文件事务、验证、Git、审批和 Provider 调用 | 不应把高权限对象返回页面 |
| GitHub Provider | 允许列表仓库中的固定 PR 生命周期命令 | 任意 REST、GraphQL、URL 或 Token 导出 |

## 当前状态

| 项目 | 状态 |
|---|---|
| 平台版本 | `0.7.8` |
| TypeScript SDK | 28 个 |
| 自动测试基线 | 337 项 |
| 统一入口导出 | 28 / 28 |
| Node.js | `>= 22.0.0` |
| 模块格式 | ESM |
| 浏览器扩展稳定基线 | `0.6.10` |
| Canvas 2D Renderer | 已提供 |
| 生产 3D Renderer 与模型资源 | 由宿主项目提供 |
| 完整可安装扩展 Manifest / 商店配置 | 当前仓库未提供 |
| 公共 npm 发布 | 当前文档不假设 SDK 已发布到公共 Registry |

## 快速开始

### 环境要求

- Node.js 22 或更高版本；
- npm，建议使用仓库中的 `package-lock.json` 复现验证环境；
- Git；
- 真实浏览器集成需要 Chromium / Chrome 扩展开发环境；
- 真实 Lighthouse、Playwright、文件系统、Git 或 GitHub 流程需要对应的受信任 Adapter。

### 安装与验证

```bash
git clone https://github.com/yokry-he/yk-pets.git
cd yk-pets

npm ci
npm run validate
```

执行完整发布门禁：

```bash
npm run release:verify
```

该命令依次完成清理、构建、测试、发布检查、28 个 SDK 打包，以及在全新临时项目中的离线安装验证。

> [!NOTE]
> `package.json` 记录了 `pnpm@11.13.1`，仓库同时包含 `package-lock.json`，当前发布验证脚本使用 npm。为了获得与验证基线一致的结果，建议使用 `npm ci`，不要在同一工作树中混用包管理器重写锁文件。

## 基础接入

### Canvas 2D 宠物

```ts
import { createCanvas2DRendererFactory } from '@yk-pets/pet-renderer-canvas2d'

const host = document.querySelector('#yk-pets-host')!
const factory = createCanvas2DRendererFactory({ width: 240, height: 260 })
const renderer = await factory.create()

await renderer.mount(host)
renderer.update({
  behavior: 'idle',
  emotion: 'happy',
  speaking: false,
})
```

### 站点策略

```ts
import {
  MemoryKeyValueStore,
  SitePolicyManager,
} from '@yk-pets/pet-site-policy'

const policies = new SitePolicyManager(new MemoryKeyValueStore())

await policies.addRule({
  id: 'work-sites',
  pattern: 'https://*.example.com/*',
  priority: 100,
  policy: {
    mode: 'enabled',
    renderer: 'auto',
    audioEnabled: false,
    interactionsEnabled: true,
    auditEnabled: true,
  },
})

const resolved = await policies.resolve('https://docs.example.com/project')
```

### 扩展运行时

```ts
import { createCanvas2DRendererFactory } from '@yk-pets/pet-renderer-canvas2d'
import { ExtensionPetRuntime } from '@yk-pets/pet-extension-runtime'
import { SitePolicyManager } from '@yk-pets/pet-site-policy'

const runtime = new ExtensionPetRuntime({
  sitePolicies: new SitePolicyManager(),
  renderer2d: createCanvas2DRendererFactory(),
  loadRenderer3d: async () => {
    const module = await import('./renderer-three.js')
    return module.rendererFactory
  },
})

await runtime.start(shadowRoot, location.href, {
  now: Date.now(),
  webglSupported: true,
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
})
```

### 统一入口

```ts
import {
  AdaptiveRendererController,
  PullRequestSynchronizer,
  RemediationRunner,
  RepositoryPublisher,
  SitePolicyManager,
} from '@yk-pets/pet-platform-adaptive'
```

这些包当前首先作为 Monorepo Workspace 使用。若尚未发布到 npm Registry，请通过工作区依赖、本地 tarball 或内部 Registry 接入。

## SDK 包说明

### 渲染与运行时

| 包 | 作用 |
|---|---|
| `@yk-pets/pet-runtime-adaptive` | 3D/2D 自适应选择、健康评估、状态迁移与浏览器运行采样 |
| `@yk-pets/pet-renderer-canvas2d` | 无贴图依赖的 Canvas 2D 云狐兜底 Renderer |
| `@yk-pets/pet-agent-policy` | Agent 工具能力、权限、确认、超时与审计治理 |
| `@yk-pets/pet-plugin-registry` | 插件 Manifest、版本兼容、依赖拓扑与生命周期 |
| `@yk-pets/pet-site-policy` | 站点启停、Renderer、声音、交互与审计策略 |
| `@yk-pets/pet-runtime-lifecycle` | 页面可见性、离屏、冻结与站点模式生命周期控制 |
| `@yk-pets/pet-feature-loader` | 支持依赖、取消、超时和去重的功能 Bundle 延迟加载 |
| `@yk-pets/pet-extension-runtime` | 统一扩展宿主、固定消息协议与独立授权入口 |

### 深度分析与验证

| 包 | 作用 |
|---|---|
| `@yk-pets/pet-devtools-bridge` | Origin 绑定、命令允许列表、预算与脱敏的只读 CDP 桥接 |
| `@yk-pets/pet-source-mapper` | DOM、Vue 2/3、Inspector 与 Source Map v3 源码定位 |
| `@yk-pets/pet-verification-runner` | Adapter 驱动的 Lighthouse / Playwright 前后验证 |
| `@yk-pets/pet-change-report` | 问题、源码映射、变更、验证、回滚与审计报告 |

### 安全修改与回滚

| 包 | 作用 |
|---|---|
| `@yk-pets/pet-patch-plan` | 路径受限、哈希绑定、可确定序列化的补丁计划 |
| `@yk-pets/pet-scope-approval` | 精确文件范围和写入预算的一次性 HMAC 审批 |
| `@yk-pets/pet-file-transaction` | CAS 文件事务、逆序回滚和冲突保护 |
| `@yk-pets/pet-project-host` | Background / CI 固定 Workspace RPC 协议 |
| `@yk-pets/pet-remediation-runner` | 审批、事务、验证和失败恢复的统一编排 |

### 仓库发布

| 包 | 作用 |
|---|---|
| `@yk-pets/pet-repository-policy` | 分支、路径、Diff、验证、密钥与 Commit Message 门禁 |
| `@yk-pets/pet-git-worktree` | 隔离 Worktree、提交、推送、租约与清理 |
| `@yk-pets/pet-commit-ledger` | Commit、Push、Draft PR 与审批的哈希链记录 |
| `@yk-pets/pet-local-agent-host` | 不开放 Shell 的本地 Git / Workspace Host |
| `@yk-pets/pet-repository-publisher` | 一次性发布审批与受控提交、推送、Draft PR 编排 |

### 远程协作

| 包 | 作用 |
|---|---|
| `@yk-pets/pet-github-provider` | 仓库允许列表内的固定 GitHub Provider 命令 |
| `@yk-pets/pet-pr-lifecycle` | 防竞态 PR、Checks、Reviews 与线程快照 |
| `@yk-pets/pet-review-governance` | 精确 Review 回复、Resolve 计划与阻塞条件 |
| `@yk-pets/pet-merge-gate` | 基于 Head、Checks、审批、线程与时效的合并资格判断 |
| `@yk-pets/pet-remote-release` | 重试、Review、Merge 与合并后清理的审批编排 |

### 聚合入口

| 包 | 作用 |
|---|---|
| `@yk-pets/pet-platform-adaptive` | 统一导出全部基础 SDK 的平台入口 |

## 项目结构

```text
yk-pets/
├── packages/                    # 28 个 TypeScript SDK
├── examples/                    # 浏览器、分析、修改、Git 与 PR 生命周期示例
├── docs/
│   ├── zh-CN/                   # 中文专题技术文档
│   └── en/                      # English technical guides
├── scripts/                     # 构建、测试、发布检查、打包和烟雾验证
├── README.md                    # 中文主文档
├── README.en.md                 # English README
├── CHANGELOG.md                 # 中文合并版本历史与迁移/验证摘要
├── CHANGELOG.en.md              # English consolidated changelog
├── package.json
├── package-lock.json
└── tsconfig.base.json
```

包目录通常包含：

```text
packages/<package>/
├── src/
├── test/
├── dist/
├── README.md
├── package.json
└── tsconfig.json
```

## 安全模型

### 页面分析边界

`pet-devtools-bridge` 默认永久禁止：

- `Runtime.evaluate` 和任意脚本执行；
- DOM 修改和输入模拟；
- 导航与下载；
- Cookie、响应体和跨 Origin 调试；
- 脚本注入。

### 文件修改边界

- 禁止绝对路径、反斜杠和目录穿越；
- 禁止修改 `.git`、`node_modules`、`.yk-pets/approvals` 等保护路径；
- 更新和删除必须绑定原内容 SHA-256；
- 审批绑定补丁摘要、文件集合、字节预算和用户上下文；
- 回滚发现外部修改时报告冲突，不覆盖用户的新内容。

### Git 边界

- Git 使用参数数组和 `shell: false`；
- 不提供任意 Git 子命令或 Shell；
- 拒绝 Hook、Filter、Credential Helper、SSH Command 和 URL Rewrite 等危险配置；
- 实际变更文件必须与审批范围完全一致；
- Push 同时校验远端名称与规范化 URL。

### GitHub 边界

- Provider 只允许固定命令；
- 仓库必须位于允许列表；
- 不开放任意 REST、GraphQL 或 URL；
- Review 计划绑定精确 Head、快照和最新评论 ID；
- Merge 审批绑定具体 Merge Method；
- 只有已合并 PR 才能执行发布后清理。

### 密钥管理

HMAC 密钥、GitHub Token、CI 凭据和本地文件权限必须留在受信任宿主中。示例中的固定字符串仅用于演示；生产环境必须使用安全密钥存储、最小权限和轮换策略。

## 开发与验证

### 常用命令

| 命令 | 作用 |
|---|---|
| `npm run clean` | 清理可重新构建输出 |
| `npm run build` | 构建全部 SDK |
| `npm test` | 运行 TypeScript 测试 |
| `npm run check` | 执行版本、包结构和安全源码门禁 |
| `npm run validate` | 清理、构建、测试和发布检查 |
| `npm run pack:sdk` | 打包全部 npm tarball |
| `npm run smoke:packages` | 全新项目离线安装与导出检查 |
| `npm run release:verify` | 执行完整发布验证流水线 |

### v0.7.8 验证基线

- 28 个 SDK 构建成功；
- 337 / 337 自动测试通过；
- 28 / 28 统一入口导出可用；
- SDK ZIP 解压后离线安装成功；
- npm 安装审计为 0 个漏洞；
- v0.7.7 → v0.7.8 增量 Patch 实际应用并完成源码树等价验证；
- 浏览器扩展稳定版本保持 `0.6.10`。

这些结果验证的是 SDK、严格接口、模拟宿主、临时 Git 仓库和离线安装流程。它们不代表已经在用户生产网站、真实扩展实例、线上 GitHub PR 或生产 CI 凭据上执行过对应操作。

## 版本演进

| 版本 | 主题 | SDK | 测试 |
|---|---|---:|---:|
| `0.7.3` | 平台治理：2D 降级、Agent 权限、插件治理 | 5 | 44 |
| `0.7.4` | 扩展运行时：站点策略、生命周期与延迟加载 | 9 | 88 |
| `0.7.5` | 源码映射与深度分析 | 13 | 144 |
| `0.7.6` | 安全源码修改、事务与自动回滚 | 18 | 206 |
| `0.7.7` | 隔离仓库、受控提交、推送与 Draft PR | 23 | 270 |
| `0.7.8` | 远程协作、Review 治理与合并门禁 | 28 | 337 |

完整的版本能力、迁移步骤、安全加固、验证结果和验证边界已经合并到 [CHANGELOG.md](./CHANGELOG.md)，不再为每个版本分别保留 Release Notes、Migration、Validation 和 Merge Instructions 文件。

## 技术文档

根目录只保留中英文 README 与中英文合并 Changelog。持续维护的专题文档仍保留在：

- 中文：[`docs/zh-CN`](./docs/zh-CN)
- English: [`docs/en`](./docs/en)
- SDK 级文档：各 [`packages/*/README.md`](./packages)
- 接入示例：[`examples`](./examples)

这些文档解释稳定的 API 与安全边界，不属于版本更新过程中的临时文档，因此继续保留。

## 已知边界

1. 当前仓库不是完整可安装扩展；
2. 不包含生产 3D 模型、动作、贴图和音频资源；
3. 真实 Lighthouse、Playwright、Chrome Debugger、Git、GitHub 流程依赖宿主 Adapter；
4. Playwright 只使用声明式场景，CDP 不开放 `Runtime.evaluate`；
5. 高权限能力必须经过独立授权，不能从页面环境直接调用；
6. 当前文档不保证 SDK 已发布到公共 npm Registry；
7. 仓库尚未包含正式 `LICENSE` 文件，许可证确定前不应默认视为 MIT、Apache-2.0 或其他开源许可证。

## 路线图

后续方向包括：

- 多仓库依赖发布策略与发布队列；
- Webhook / 轮询事件标准化与失败恢复；
- 操作指标、Tracing 和完整发布审计视图；
- 真实 Chrome MV3 扩展与商店构建流水线；
- Three.js 云狐 Renderer、GLB 模型、动作状态机与音频资源管理；
- 可视化设置页、Side Panel、权限中心和审计中心；
- 国内外大模型 Provider Adapter；
- 插件隔离执行、第三方插件分发与签名机制；
- Windows、macOS 与 Linux 本地 Agent Host 安装器。

## 参与开发

建议流程：

```bash
git checkout -b yk-pets/your-change
npm ci
npm run validate
```

提交前请确保：

- 变更范围清晰，不混入无关文件；
- 新行为包含自动测试；
- 公共 API 同步更新类型声明和中英文文档；
- 影响 SDK 输出时重新构建对应 `dist`；
- 不提交 Token、密钥、`.env`、个人路径或生成的临时归档；
- 高权限能力继续通过固定命令、允许列表和一次性审批暴露；
- 不在 Content Script 或页面环境引入文件系统、Git 或 GitHub 凭据。

## 许可证

当前仓库尚未包含正式 `LICENSE` 文件。在许可证明确之前，请勿默认将项目视为 MIT、Apache-2.0 或其他开源许可证，也不要在未获授权的情况下复制、修改、再分发或商用仓库内容。

---

<div align="center">

**YK Pets — 让浏览器宠物不仅可爱，也能在明确边界内真正帮助你工作。**

</div>
