# 结构化变更报告

`ChangeReportBuilder` 输出 `yk-pets.change-report/v1`：

- 问题严重度、分类、Selector 与源码候选；
- 重复问题合并与忽略原因；
- 文件改动、行数、Revision Hash 和回滚说明；
- Lighthouse / Playwright 验证结果；
- 权限、分析、修改和验证时间线；
- 稳定 FNV-1a 报告指纹。

JSON 适合机器处理，Markdown 适合 Side Panel、PR 描述或人工审查。令牌、Cookie、Authorization 等敏感字段会被脱敏。
