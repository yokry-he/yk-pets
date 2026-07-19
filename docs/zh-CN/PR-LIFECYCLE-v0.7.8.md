# PR 生命周期同步 v0.7.8

`PullRequestSynchronizer` 先读取 PR，再并行读取 Checks、Review Threads 和 Reviews，最后重新读取 PR。两次 PR 的 Head、Base、状态、Draft、Mergeability 或更新时间不一致时，本次同步失败。

快照使用 `yk-pets.pr-lifecycle/v1`，包含稳定摘要、统计信息和与上一快照的差异事件。存储支持摘要 CAS，防止并发同步覆盖。
