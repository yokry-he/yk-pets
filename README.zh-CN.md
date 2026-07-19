# YK Pets v0.7.8

面向 3D 云狐浏览器宠物、页面 Agent 与受控开发工作流的模块化 SDK。v0.7.8 在隔离 Git 发布能力之上，新增远程 Pull Request 生命周期同步、检查结果治理、Review 线程计划、合并资格门禁、一次性远程操作审批与发布后清理。

## v0.7.8 新增能力

- `@yk-pets/pet-github-provider`：仓库允许列表内的固定 GitHub 命令 Provider；不提供任意 REST、GraphQL、URL、脚本或 Token 访问。
- `@yk-pets/pet-pr-lifecycle`：PR 前后双读，稳定采集 PR、Checks、Review Threads 与 Reviews；检测采集过程中的 Head 或状态漂移。
- `@yk-pets/pet-review-governance`：绑定 Head、快照摘要和最新评论 ID 的回复/Resolve 计划；默认禁止无回复 Resolve，不支持自动 Dismiss。
- `@yk-pets/pet-merge-gate`：检查 Draft、状态、冲突、快照时效、精确 Head、必需 Checks、审批和未解决线程。
- `@yk-pets/pet-remote-release`：为失败检查重试、Review 计划、Merge 和合并后清理签发短时一次性 HMAC 审批。
- `@yk-pets/pet-extension-runtime`：新增延迟加载的 `remote-collaboration` 能力和固定消息 `collaboration:run`。

## 安全模型

所有远程写操作都必须绑定仓库、PR 编号、精确 Head SHA、生命周期快照摘要、具体动作和资源摘要。Merge 还绑定 Merge Method；清理绑定远端分支、Head、Worktree 会话和强制清理标志。审批只能消费一次。

PR 同步会在采集 Checks 与 Reviews 前后各读取一次 PR。若 Head、Base、Draft、状态、Mergeability 或更新时间发生变化，本轮结果作废，避免把不同时间点的数据拼成一个错误快照。

Review 执行不删除或修改审阅者内容。回复成功而 Resolve 失败时返回明确的 `partial` 结果。合并仅在门禁状态为 `eligible` 且方法在允许列表内时调用 Provider。发布后清理只接受已合并 PR，并单独报告远端分支或本地 Worktree 清理失败。

## 工作区

- 平台版本：`0.7.8`
- SDK 包：28 个
- 自动测试：目标基线 337 项
- 浏览器扩展稳定基线：`0.6.10`（Manifest 未升级）
- Node.js：根工作区和本地 Git Host 要求 Node.js 22+

```bash
npm install
npm run release:verify
```

## 推荐接入顺序

1. 在受信任的 Background、本地 Agent Host 或 CI Host 中实现 `GitHubProviderInvoker` 的固定命令映射。
2. 使用 `PullRequestSynchronizer` 获取稳定生命周期快照。
3. 通过 `createReviewActionPlan` 展示精确 Review 操作范围，再签发远程审批。
4. 使用 `evaluateMergeGate` 展示所有等待项和阻塞项。
5. 通过 `RemoteReleaseCoordinator` 执行受控重试、Review、Merge 和清理。
6. 扩展页面只发送 `collaboration:run`，GitHub 凭据始终保留在受信任宿主。

参见 `examples/github-collaboration-host.ts`、`examples/controlled-pr-lifecycle.ts` 和 `examples/extension-collaboration.ts`。
