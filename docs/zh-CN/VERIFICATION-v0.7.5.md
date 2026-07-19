# Lighthouse / Playwright 修复验证

`VerificationRunner` 不直接启动浏览器，而是接收宿主 Adapter：

- Lighthouse Adapter 返回分类分数、核心指标与 Audit；
- Playwright Adapter 执行声明式 `SafePlaywrightScenario`。

场景支持点击、悬停、显式允许的表单输入、按键、等待、可见性/文本/URL 断言和截图。不存在 `evaluate`、文件上传、下载、跨 Origin URL 或任意回调。

比较策略可配置分数下限、最大退化、指标方向、必过 Audit、新增 Console/Page Error 上限，并输出结构化回归与改进结果。
