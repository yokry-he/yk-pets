# YK Pets v0.7.5 → v0.7.6 迁移指南

v0.7.6 是增量升级，浏览器扩展 Manifest 稳定基线仍为 `0.6.10`。

## 推荐接入顺序

1. 先升级全部现有 `@yk-pets/*` 包到 `0.7.6`。
2. 引入 `@yk-pets/pet-patch-plan`，把模型生成结果转换成 `yk-pets.patch-plan/v1`，不要直接接收任意 diff 或脚本。
3. 使用 `FileTransactionExecutor.preview()` 在审批前获得实际触及文件和完整写入字节数。
4. 在扩展 Side Panel 或本地 Agent 的明确确认界面中，用预览结果签发 `ScopeApprovalAuthority.issue()`；生产环境 HMAC 密钥只保存在 Background 或可信宿主中。
5. 通过 `WorkspaceRpcAdapter` 连接 Background 或 CI Host；Host 的 `authorize` 回调必须结合扩展发送者、用户会话和项目绑定进行判断。
6. 用 `RemediationRunner` 执行计划，并将 v0.7.5 `VerificationRunner` 结果适配为 `{ passed, summary, details }`。
7. 在 `ExtensionPetRuntime` 中配置 `loadModificationFeature` 和独立的 `authorizeModification`；不要仅以 `auditEnabled` 作为写权限。

## 关键行为变化

- 修改计划通过预检不等于允许写入；必须提供一次性审批令牌。
- 审批令牌在进入事务前消费，失败后需要重新审批。
- 事务成功但验证失败时，返回 `rolled-back`，而不是 `applied`。
- `rollback-failed` 表示检测到并发修改或宿主恢复失败，需要使用事务回滚日志人工处理；SDK 不会强制覆盖。
- `FileTransactionResult.journal` 含恢复所需源码内容，属于敏感数据；日志、遥测和 UI 应使用 `toPublicTransactionSummary()` 或 `toPublicRemediationResult()`。

## 不应采用的接入方式

- 不要把 HMAC 密钥交给 Content Script、网页或模型。
- 不要允许模型构造任意 Background 方法名。
- 不要把 `Runtime.evaluate`、Shell 或任意脚本作为验证/修改 Adapter。
- 不要绕过文件哈希前置条件，也不要在回滚冲突时强制覆盖。
