# Review 治理 v0.7.8

Review 计划绑定仓库、PR、Head、生命周期摘要、线程 ID 和计划创建时的最新评论 ID。只能执行 `reply`、`resolve` 或 `reply-and-resolve`。

默认禁止无回复直接 Resolve；已解决、过时或未知线程不能进入计划；不支持 Dismiss Review、编辑审阅者评论或批量隐藏意见。若回复已成功而 Resolve 失败，结果为 `partial` 并保留已完成操作和错误。
