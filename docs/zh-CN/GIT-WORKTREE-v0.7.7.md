# 隔离 Git Worktree v0.7.7

`GitWorktreeCoordinator` 管理不暴露本地路径的会话。`open()` 会确认仓库非 bare、支持 worktree、`baseRef` 当前解析结果仍等于审批 SHA、新分支不存在，并验证新 worktree 干净且处于正确分支与基线。

会话具有 TTL 和状态机：`open → committed → pushed → closed`。过期或失败会清理 worktree。提交必须以会话基线作为第一父提交；推送必须对应刚创建的提交和会话分支。

工作树中的文件修改应继续通过 v0.7.6 的 `FileTransactionExecutor` 完成，而不是绕过事务直接写盘。
