# NOVA Browser Agent v0.6.6 验证报告

## 核心场景

- 捕获真实 JSON 时同时生成轻量预览和最大 512 KB 的完整可编辑正文。
- 从请求生成的规则优先使用完整正文。
- 选择“修改真实响应”后显示整份 JSON，不显示字段路径操作。
- 保存后规则包含 `replacementBody`，不包含新的字段变换操作。
- Fetch 与 XHR 都使用完整 JSON 替换正文，同时保留真实响应元数据。

## 检查结果

- v0.6.6 完整 JSON 响应专项：11/11。
- 完整 JSON 编辑运行时回归通过。
- Network Domain：22 个断言通过；Network Workbench：18 个断言通过。
- Extension、Shared、Local Agent 与 Playground 类型检查通过。
- Local Agent：2 个测试通过。
- Extension 与 Local Agent 生产构建通过。

## 安装后确认

重新加载 v0.6.6 并刷新目标网页。需要重新触发请求，才能采集完整真实 JSON。旧的请求记录不会自动补充完整正文。
