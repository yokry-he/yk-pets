# NOVA Browser Agent v0.6.6

## 中文

- “修改真实响应”改为完整 JSON 直接编辑，不再使用字段路径操作。
- 请求采集新增最大 512 KB 的完整可编辑 JSON 正文，同时保留轻量脱敏预览。
- 从请求生成规则时优先使用真实完整响应，不再使用可能截断的预览。
- Fetch 与 XHR 在真实请求完成后使用保存的完整 JSON 替换响应正文。
- 保留真实状态码、状态文本和响应头。
- 继续兼容 v0.6.5 及更早版本的字段级规则。

## English

- Modify Real Response now edits the complete JSON document instead of field paths.
- Request capture retains an editable JSON body up to 512 KB while keeping the lightweight sanitized preview.
- Request-derived rules prefer the complete real response rather than a potentially truncated preview.
- Fetch and XHR replace the response body with the saved whole JSON after the real request completes.
- Real status, status text, and response headers are preserved.
- Field-level rules from v0.6.5 and earlier remain compatible.
