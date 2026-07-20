# NOVA Browser Agent v0.6.5 验证报告

## 专项场景

- 当前网页：`http://localhost:5188`。
- 规则：`GET /api/auth/profile`，范围为当前网页。
- 相对 Fetch URL 可解析为 `http://localhost:5188/api/auth/profile` 并命中 Mock。
- 同一网页访问跨域 API 时仍按网页范围命中。
- 其他网页来源不能错误命中该规则。

## 检查项目

- 网络领域回归新增相对 URL、端口、页面范围和跨域目标断言。
- Fetch 完整 Mock 分支位于原生 Fetch 调用之前。
- Fetch 与 XHR 都传递当前页面来源。
- 页面配置回执能进入桥接快照，并由 Network Lab 显示。
- v0.6.5 Fetch Mock 专项检查：10/10。
- Network Domain：19 个断言通过；Network Workbench：18 个断言通过。
- Extension、Shared、Local Agent 与 Playground 类型检查通过。
- Local Agent：2 个测试通过。
- Extension 与 Local Agent 生产构建通过。

## 产物确认

- Chrome Manifest 版本：`0.6.5`。
- Side Panel 底部版本：`NOVA 0.6.5`。
- Extension 总体积约 1.27 MB，ZIP 约 370 KB。
- 构建后的主世界脚本包含相对 URL 解析、页面来源匹配、Mock 短路和 `CONFIGURED` 回执。

## 安装后确认

在 `chrome://extensions` 重新加载 v0.6.5，刷新目标网页并重新打开 Side Panel。确认底部显示 `NOVA 0.6.5`，Network Lab 显示“拦截器已同步 1 条规则”，再重新触发接口。
