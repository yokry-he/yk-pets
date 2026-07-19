# 仓库提交门禁 v0.7.7

`@yk-pets/pet-repository-policy` 输出 `yk-pets.repository-gate/v1` 决策。输入由真实仓库快照、审批路径集合、精确基线 SHA、提交标题、验证证据和密钥扫描结果组成。

默认采用 fail-closed：禁止直接提交到 main/master/trunk/production/prod/release，禁止 `.git`、`.yk-pets/approvals`、`.yk-pets/secrets`、`node_modules` 和 `.env*`，要求所有改动已暂存且实际路径不超出审批范围。可额外限制分支前缀、允许路径、文件数、变更字节、必需验证 ID 和阻断密钥级别。

`evaluateCommitGate()` 只生成可审计决定；提交前必须调用 `assertCommitGatePassed()`。使用 `computeCommitGateDigest()` 把完整决定写入提交账本。
