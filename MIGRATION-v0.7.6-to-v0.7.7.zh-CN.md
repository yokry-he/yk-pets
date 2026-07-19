# v0.7.6 → v0.7.7 迁移指南

## 兼容性

v0.7.7 保留 v0.7.6 的补丁计划、范围审批、文件事务、Workspace RPC 与验证接口。新增能力为可选层；浏览器扩展稳定基线仍为 0.6.10。

## 迁移步骤

1. 将所有 `@yk-pets/*` 内部依赖统一升级到 `0.7.7`。
2. 根工作区升级到 Node.js 22+，以运行真实本地 Git Host。
3. 注册 `LocalRepositoryProject`：必须提供 `repositoryRoot`、独立的 `worktreeRoot`、默认分支，并显式配置 `allowedRemotes` 和 `allowedRemoteUrls`。空 URL 列表意味着禁止推送。
4. 用 `GitWorktreeCoordinator.open()` 绑定 `baseRef` 与已审批的 `expectedBaseRevision`，不要只依赖可移动分支名。
5. 将 v0.7.6 的 `FileTransactionExecutor` 指向 `LocalGitRepositoryAdapter.createWorkspaceAdapter(worktreeId)`，所有源码修改仅发生在隔离 worktree。
6. 验证完成后生成 `ValidationEvidence[]` 和 `SecretFinding[]`，再签发一次性发布审批。
7. 通过 `RepositoryPublisher.publish()` 精确暂存 `expectedPaths`。不要在宿主外部执行 `git add .`。
8. 将 `CommitLedgerStore` 替换为受保护的持久化实现；内存 Store 只适合示例与测试。
9. 扩展侧如需发布能力，配置 `loadRepositoryFeature` 与独立的 `authorizeRepositoryPublish`；页面审计授权不能替代仓库发布授权。

## GitHub Draft PR

`createGitHubDraftPullRequestAdapter()` 接受一个受信任的注入式调用器，并强制 `draft: true`。调用器应由 Background、Local Agent 或 CI 侧实现，且必须自行处理 GitHub 身份、仓库权限和提交可见性。浏览页面不得直接持有 GitHub 凭据。

## 需要关注的行为变化

- 危险 Git 配置会导致仓库初始化失败，而不是继续执行。
- 提交使用 `--no-verify`，不会运行仓库 Hook；所需检查必须作为显式 `ValidationEvidence` 提供。
- 推送要求远端名称和规范化 URL 同时命中允许列表。
- 发布审批一经消费不可重用；提交标题、分支、远端或 PR 范围变化后必须重新审批。
