# 防篡改提交账本 v0.7.7

`CommitLedger` 以 `yk-pets.commit-record/v1` 追加记录。每条记录包含上一条摘要、序号、计划与审批 ID、基线、分支、提交身份、门禁摘要、验证摘要、变更路径，以及可选推送和 Draft PR。

记录摘要覆盖整个条目；删除、重排、改写或分叉都会被 `verifyCommitLedger()` 检出。Store 的 `append()` 必须实现 compare-and-swap，生产环境应使用受保护的持久化存储。
