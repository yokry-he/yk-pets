# YK Pets 版本历史

[简体中文](./CHANGELOG.md) · [English](./CHANGELOG.en.md) · [项目主页](./README.md)

本文档合并了此前分散在仓库根目录中的 Release Notes、Migration、Validation 和 Merge Instructions。后续版本只维护本文件及其英文版，不再为每个小版本创建多组重复文档。

## 当前发布基线

| 项目 | 当前值 |
|---|---|
| 平台版本 | `0.7.8` |
| SDK 数量 | 28 |
| 自动测试 | 337 / 337 |
| 统一入口导出 | 28 / 28 |
| Node.js | `>= 22.0.0` |
| 浏览器扩展稳定基线 | `0.6.10` |
| 离线安装审计 | 0 vulnerabilities |

## 版本演进概览

| 版本 | 主题 | SDK | 测试 |
|---|---|---:|---:|
| `0.7.3` | 平台治理：2D 降级、Agent 权限、插件治理 | 5 | 44 |
| `0.7.4` | 扩展运行时：站点策略、生命周期和延迟加载 | 9 | 88 |
| `0.7.5` | DOM/Vue 源码映射、CDP 与修复验证 | 13 | 144 |
| `0.7.6` | 安全源码修改、文件事务与自动回滚 | 18 | 206 |
| `0.7.7` | 隔离 Worktree、受控提交、推送和 Draft PR | 23 | 270 |
| `0.7.8` | PR 生命周期、Review 治理与合并门禁 | 28 | 337 |

> 平台 SDK 版本与浏览器扩展 Manifest 版本独立演进。`0.7.3` 至 `0.7.8` 期间，扩展稳定基线始终保持 `0.6.10`。

---

## v0.7.8 — 远程协作与发布生命周期

### 核心能力

新增五个远程协作 SDK：

- `@yk-pets/pet-github-provider`：仅允许固定 GitHub 命令，并限制可访问仓库；
- `@yk-pets/pet-pr-lifecycle`：对 PR、Checks、Reviews 和 Review Threads 进行前后双读，避免混合快照；
- `@yk-pets/pet-review-governance`：生成绑定当前 Head、快照和最新评论的回复/Resolve 计划；
- `@yk-pets/pet-merge-gate`：输出确定性的 `eligible / waiting / blocked` 合并判断；
- `@yk-pets/pet-remote-release`：编排 Check 重试、Review、Merge 与合并后清理。

扩展运行时新增延迟功能 `remote-collaboration` 和固定消息 `collaboration:run`。未授权时不会加载协作 Bundle，站点禁止审计时会在授权回调前拦截。

### 安全加固

- 远程写操作绑定仓库、PR、精确 Head SHA、生命周期摘要、动作和资源摘要；
- Merge 审批额外绑定 Merge Method；
- 清理审批绑定远端分支、本地 Worktree 会话和强制清理范围；
- 同名必需 Check 存在多个当前记录时视为歧义并阻止合并；
- Review 计划绑定最新评论 ID，不提供自动 Dismiss Review；
- Scope、Publish 和 Remote 三类审批统一拒绝非规范 base64url；
- 只有确认 PR 已合并后，才允许删除远端分支或清理本地 Worktree。

### 从 v0.7.7 迁移

1. 将所有 `@yk-pets/*` 依赖统一升级到 `0.7.8`；
2. 在受信任宿主中创建 `GitHubProvider`，并配置明确的 `allowedRepositories`；
3. 将 GitHub SDK 或连接器映射到固定 `GitHubProviderInvoker`，禁止透传任意 URL、GraphQL 或 Token；
4. 使用 `PullRequestSynchronizer` 统一读取 PR、Checks、Reviews 和 Review Threads；
5. 对 Check 重试、Review、Merge 和 Cleanup 分别签发一次性审批；
6. Merge 前执行 `evaluateMergeGate`，并把门禁摘要绑定到审批；
7. 扩展接入 `loadCollaborationFeature` 与 `authorizeCollaborationAction`。

Head、PR 快照、最新评论、Merge Method 或清理范围变化后，必须重新审批。

### 验证结果

- 28 个 SDK 构建通过；
- 337 / 337 自动测试通过；
- 28 / 28 统一入口导出可用；
- 最终 SDK ZIP 解压后离线安装通过；
- npm 安装审计为 0 个漏洞；
- v0.7.7 → v0.7.8 共 84 个变更文件：43 新增、41 修改、0 删除；
- `git diff --check`、`git apply --check`、实际应用和源码树等价检查通过。

远程协作使用内存 GitHub Host 和严格命令模拟器验证，没有使用生产 GitHub Token 或线上 PR。

---

## v0.7.7 — 真实仓库与受控提交

### 核心能力

新增：

- `@yk-pets/pet-repository-policy`；
- `@yk-pets/pet-git-worktree`；
- `@yk-pets/pet-commit-ledger`；
- `@yk-pets/pet-local-agent-host`；
- `@yk-pets/pet-repository-publisher`。

实现精确基线 SHA 的隔离 Worktree、提交前门禁、一次性发布审批、受控 Commit/Push、强制 Draft PR Adapter 和防篡改提交账本。扩展新增延迟功能 `repository-publish` 与固定消息 `repository:publish`。

### 安全加固

- Git 使用可执行文件与参数数组，`shell: false`；
- 子进程环境移除不受控 Git / SSH 环境变量；
- 拒绝 Hook、Filter、Credential Helper、SSH Command 和 URL Rewrite 等危险配置；
- Commit 使用 `--no-verify`，验证通过显式 `ValidationEvidence` 提供；
- Push 同时校验远端名称和规范化 URL；
- 实际变更路径必须与审批范围完全一致；
- 页面环境不接触工作区路径、HMAC 密钥或 GitHub 凭据。

### 从 v0.7.6 迁移

1. 增加仓库策略、Worktree、账本、本地 Host 和 Publisher 包；
2. 将 v0.7.6 文件事务放入隔离 Worktree，而不是直接修改主工作树；
3. 配置保护分支、保护路径、允许路径、文件数量和字节预算；
4. 提交前提供测试、构建和密钥扫描等显式验证证据；
5. 同时配置远端名称和规范化远端 URL 允许列表；
6. 为完整发布范围签发一次性 Publish Approval；
7. PR 创建器必须强制 `draft: true`。

### 验证结果

- 23 个 SDK 构建通过；
- 270 / 270 自动测试通过；
- 使用真实临时 Git 仓库完成 Worktree、精确暂存、Commit 和推送到临时 Bare Remote；
- 23 / 23 统一入口导出和离线安装通过；
- v0.7.6 → v0.7.7 共 77 个变更文件：43 新增、34 修改、0 删除；
- Patch 检查、实际应用和源码树等价检查通过。

Draft PR 通过注入式 Adapter 契约测试，没有创建真实线上 PR。

---

## v0.7.6 — 安全修改与自动回滚

### 核心能力

新增：

- `@yk-pets/pet-patch-plan`；
- `@yk-pets/pet-scope-approval`；
- `@yk-pets/pet-file-transaction`；
- `@yk-pets/pet-project-host`；
- `@yk-pets/pet-remediation-runner`。

实现确定性、哈希绑定的补丁计划；一次性 HMAC 精确审批；Compare-And-Swap 文件事务；验证失败自动回滚；严格 Background / CI Workspace RPC。扩展新增延迟功能 `safe-modification` 和固定消息 `modification:run`。

### 安全加固

- 拒绝绝对路径、目录穿越、反斜杠和受保护目录；
- 更新、删除、移动和回滚均依赖精确 SHA-256；
- 不跟随符号链接，也不把目录替换为普通文件；
- 审批绑定计划摘要、用户、项目、Origin、文件集合、操作类型和写入预算；
- 审批只能使用一次；
- 事务中途失败时逆序回滚；
- 回滚遇到外部并发修改时报告冲突，不覆盖用户的新内容；
- 缺少验证 Adapter、验证失败、异常、超时或取消均触发回滚；
- Workspace RPC 不暴露 Shell、动态方法、`Runtime.evaluate` 或任意脚本。

### 从 v0.7.5 迁移

1. 使用 `yk-pets.patch-plan/v1` 替代非结构化修改指令；
2. 为所有更新、删除和移动加入原内容 SHA-256；
3. 在受信任 Host 保存 HMAC 密钥并签发一次性 Scope Approval；
4. 使用 `FileTransaction` 执行修改，不直接调用文件系统；
5. 使用 `RemediationRunner` 串联预览、审批、事务、验证和回滚；
6. Background 和 CI 仅实现固定 `yk-pets.workspace-host/v1` RPC；
7. 页面审计权限与源码修改权限必须分离。

### 验证结果

- 18 个 SDK 构建通过；
- 206 / 206 自动测试通过；
- 18 / 18 统一入口导出和离线安装通过；
- v0.7.5 → v0.7.6 共 102 个变更文件，0 个删除文件；
- Patch 实际应用和源码树等价检查通过。

验证使用内存文件 Adapter、严格 RPC 回环和模拟验证宿主，没有修改生产文件或真实用户仓库。

---

## v0.7.5 — 源码映射与深度分析

### 核心能力

新增：

- `@yk-pets/pet-devtools-bridge`：Origin 绑定、预算、超时、事件缓冲和脱敏的只读 CDP 桥接；
- `@yk-pets/pet-source-mapper`：稳定 DOM Selector、Vue 2/3 ownership、Inspector 元数据和 Source Map v3；
- `@yk-pets/pet-verification-runner`：Adapter 驱动的 Lighthouse 与声明式 Playwright 验证；
- `@yk-pets/pet-change-report`：确定性的 `yk-pets.change-report/v1` JSON / Markdown 报告。

扩展新增延迟功能 `deep-analysis` 和固定消息 `analysis:run`。

### 安全加固

- 永久拒绝 `Runtime.evaluate`、`Runtime.callFunctionOn` 和任意脚本执行；
- 拒绝 DOM 写入、输入模拟、导航、下载、Cookie、响应体和脚本注入；
- CDP 会话绑定单一 Tab 和 Origin；
- Playwright 仅接受声明式安全步骤，不提供 `evaluate`；
- 表单输入需要显式 `allowFormInput`；
- URL 断言不得离开目标 Origin；
- 深度分析仅在站点允许审计且用户实际发起时加载。

### 从 v0.7.4 迁移

1. 在 Background / Service Worker 封装 `chrome.debugger`；
2. Content Script 仅采集稳定 Selector、Vue ownership 和 Inspector 元数据；
3. Source Map 从可信构建产物或开发服务器读取并显式注册；
4. Lighthouse 和 Playwright 通过受信任 Adapter 实现；
5. Playwright Adapter 只执行声明式 `SafePlaywrightScenario`；
6. 使用变更报告关联问题、源码候选、修改、验证和回滚；
7. 在扩展运行时中按需加载 `deep-analysis`。

### 验证结果

- 13 个 SDK 构建通过；
- 144 / 144 自动测试通过，其中新增 56 项；
- 13 / 13 统一入口导出和离线安装通过；
- v0.7.4 → v0.7.5 Patch 检查、实际应用和源码树等价检查通过。

验证覆盖 Adapter 契约和模拟宿主流程，没有声称对真实网站运行 Lighthouse 或 Playwright。

---

## v0.7.4 — 浏览器扩展运行时整合

### 核心能力

新增：

- `@yk-pets/pet-site-policy`；
- `@yk-pets/pet-runtime-lifecycle`；
- `@yk-pets/pet-feature-loader`；
- `@yk-pets/pet-extension-runtime`。

实现按站点启用、暂停、隐藏和 `auto / 2d / 3d`；后台、离屏、冻结和 `pagehide` 暂停；3D Renderer 与审计采集器延迟加载；固定扩展 Runtime Message 命令。

### 行为保证

- 隐藏站点不初始化 2D 或 3D；
- 暂停站点只挂载停止状态的 2D，不加载 3D；
- 3D Bundle 加载失败后继续使用 2D，不会立即重复循环；
- 并发功能请求只执行一个 Loader；
- 即使 Loader 忽略 Abort，超时仍会拒绝；
- 审计采集器只在首次请求时加载；
- SPA 导航后重新解析站点策略。

### 从 v0.7.3 迁移

1. 使用 `chrome.storage.local` Adapter 持久化站点策略；
2. 保留 Canvas 2D Factory 作为立即可用的轻量 Renderer；
3. 将 Three.js / TresJS Factory 移出 Content Script 主 Bundle 并动态加载；
4. 页面审计移出主 Bundle，首次请求时加载；
5. 在 Content Script 创建 `ExtensionPetRuntime` 并接入浏览器生命周期；
6. Side Panel 控件映射到 `enabled / paused / hidden`；
7. 使用固定消息命令，禁止任意方法名转发。

### 验证结果

- 9 个 SDK 构建通过；
- 88 / 88 自动测试通过；
- 9 / 9 统一入口导出和离线安装通过；
- 首轮测试发现并修复站点通配符、重复加载、禁用后资源保留和 3D 失败后重复加载问题。

---

## v0.7.3 — 平台治理基础

### 核心能力

新增：

- WebGL / 低性能自动 2D 降级和恢复；
- 程序化 Canvas 2D 云狐；
- Agent 工具能力声明、权限、确认和审计；
- 五个 Local Agent 工具的标准能力声明；
- `yk-pets.plugin/v1` 插件清单；
- 语义版本兼容、依赖、能力冲突和生命周期治理；
- 统一平台导出包。

### 安全和稳定性

- 3D 创建失败立即切换到 2D，不产生队列死锁；
- 3D 恢复失败时保留健康 2D Renderer；
- 工具权限使用拒绝优先策略；
- 确认令牌一次性使用并受次数限制；
- 工具执行强制超时并记录审计；
- 插件通配符权限不得扩大宿主允许列表；
- 独占能力冲突会被拒绝，提供者先于消费者激活。

### 从 v0.7.2 迁移

1. 增加五个治理层 Package；
2. 使用 `createCanvas2DRendererFactory()` 创建 2D Factory；
3. 将原有 Three Renderer 适配为 `{ kind: '3d', create() }`；
4. 在宿主中实例化 `AdaptiveRendererController`；
5. 通过 `BrowserRuntimeMonitor` 输入运行时 Probe；
6. 在 `ToolCatalog` 注册 Local Agent 工具，并通过 `GovernedToolExecutor` 执行；
7. 第三方插件提供 `yk-pets.plugin/v1` 并通过 `PluginRegistry` 激活。

### 验证结果

- 5 个新增 SDK 构建通过；
- 44 / 44 自动测试通过；
- 5 / 5 统一入口关键导出通过；
- 全新临时项目离线安装通过；
- npm 安装审计为 0 个漏洞。

该阶段验证的是可独立合并的治理增量。真实浏览器 WebGL、低电量设备和最终视觉切换仍需在目标扩展中验收。

---

## 通用升级原则

跨版本升级时建议遵循：

1. 所有 `@yk-pets/*` 包保持同一平台版本；
2. 执行 `npm ci`，然后运行 `npm run validate`；
3. 包输出发生变化时运行 `npm run release:verify`；
4. 保留 Canvas 2D Renderer 作为 3D 失败的安全兜底；
5. 页面审计、源码修改、仓库发布和远程协作分别授权；
6. HMAC 密钥、GitHub Token、Git 凭据和文件句柄只保存在受信任 Host；
7. Head、生命周期快照、文件哈希、补丁范围或审批范围变化后重新生成计划并重新审批；
8. 对真实浏览器、真实项目和远程服务，在目标环境补充集成验收。

## 历史验证说明

历次验证覆盖构建、类型声明、Source Map、自动测试、npm Tarball、离线安装、统一入口导出、安装审计与增量 Patch 等价检查。涉及浏览器、Lighthouse、Playwright、真实文件系统、Git 或 GitHub 的能力，只有在版本记录明确说明使用真实临时或线上环境时，才视为真实执行；其余验证范围为严格 Adapter 契约与模拟宿主数据流。
