# v0.7.7 → v0.7.8 迁移指南

## 兼容性

v0.7.8 新增 5 个 SDK，并对 `@yk-pets/pet-extension-runtime` 增加可选泛型和可选配置。未配置远程协作功能的 v0.7.7 调用方式保持兼容。

## 迁移步骤

1. 将所有 `@yk-pets/*` 依赖统一升级到 `0.7.8`。
2. 在受信任宿主中创建 `GitHubProvider`，配置明确的 `allowedRepositories`。
3. 将 GitHub SDK 或连接器映射到 `GitHubProviderInvoker` 的固定命令，禁止透传任意 URL、GraphQL 或 Token。
4. 使用 `PullRequestSynchronizer` 代替分别读取 PR、Checks 和 Reviews。
5. 对失败 Check 重试、Review 操作、Merge 和清理分别签发 `yk-pets.remote-approval/v1` 一次性令牌。
6. Merge 前调用 `evaluateMergeGate`，并把门禁摘要作为审批的 `resourceDigest`。
7. 扩展接入时配置 `loadCollaborationFeature` 与 `authorizeCollaborationAction`，页面只发送 `collaboration:run`。

## 注意

- PR 在同步过程中变化会使本次同步失败，需要重新读取和重新审批。
- Review 计划变更、最新评论变化或 Head 变化后必须重新生成计划。
- 同名必需 Check 被视为歧义并阻止 Merge。
- v0.7.8 的审批 Token 解码拒绝非规范 base64url；旧系统自行生成的非规范 Token 需要重新签发。
