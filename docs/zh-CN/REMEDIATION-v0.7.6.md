# 安全修改编排 v0.7.6

`RemediationRunner` 的执行顺序：

1. 验证并摘要计划；
2. 事务预览；
3. 校验并消费一次性审批；
4. 执行文件事务；
5. 运行修改后验证；
6. 失败时自动回滚。

当计划声明 `verification.required: true` 但未提供验证 Adapter 时，提交后的修改会立即回滚。验证异常、返回失败、超时或用户取消同样回滚。恢复过程故意不继承已经取消的用户信号，避免留下半完成写入。

状态含义：`previewed`、`applied`、`failed`、`rolled-back`、`rollback-failed`。
