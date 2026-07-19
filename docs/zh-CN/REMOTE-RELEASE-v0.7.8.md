# 远程发布生命周期 v0.7.8

`RemoteReleaseCoordinator` 支持：

- 仅重试已完成且失败、取消、超时、需要操作或过期的 Check。
- 执行摘要绑定的 Review 计划。
- 在 Merge Gate 通过后，以精确 Head 和批准方法合并。
- PR 已合并后删除精确远端分支并关闭指定本地 Worktree。

每项写操作需要 `yk-pets.remote-approval/v1` 一次性令牌。清理失败返回 `partial`，不会掩盖已经完成的 Merge。
