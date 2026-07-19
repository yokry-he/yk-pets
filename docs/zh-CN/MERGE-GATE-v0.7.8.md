# Merge Gate v0.7.8

`evaluateMergeGate` 返回 `eligible`、`waiting` 或 `blocked`。运行中的必需 Check 和未知 Mergeability 属于等待；Head 漂移、过期快照、Draft、关闭状态、冲突、失败/缺失/同名歧义 Check、Changes Requested、未解决线程和审批不足属于阻塞。

Merge Method 必须同时在门禁允许列表和一次性远程审批中出现。
