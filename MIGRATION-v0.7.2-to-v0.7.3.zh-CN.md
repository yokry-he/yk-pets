# 从 v0.7.2 迁移到 v0.7.3

1. 保留现有 11 个 SDK 包和扩展 `0.6.10`；
2. 添加本增量包中的 5 个 package；
3. 用 `createCanvas2DRendererFactory()` 创建 2D Factory；
4. 将 v0.7.2 的 Three renderer 适配为 `{ kind: '3d', create() }`；
5. 在 Web Component、Vue/React Adapter 或扩展宿主中实例化 `AdaptiveRendererController`；
6. 使用 `BrowserRuntimeMonitor` 输入运行时 Probe；
7. 将五个 Local Agent 工具注册到 `ToolCatalog`，所有执行改为经过 `GovernedToolExecutor`；
8. 第三方扩展必须附带 `yk-pets.plugin/v1`，通过 `PluginRegistry` 激活。

本增量源码只新增目录，不修改 v0.7.2 的现有文件，因此可以先独立验证再合并。
