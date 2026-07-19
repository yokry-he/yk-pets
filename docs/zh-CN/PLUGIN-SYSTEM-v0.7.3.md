# v0.7.3 插件清单与兼容机制

插件使用 `yk-pets.plugin/v1`：

- `id/name/version`；
- YK Pets、pet-core、Plugin API 版本范围；
- browser/worker/server/style 入口；
- 提供与依赖的能力；
- 工具、Scope、Origin 权限；
- 必选/可选插件依赖；
- 可选 SHA-256 完整性信息。

注册阶段检查格式、引擎版本和权限白名单；激活阶段进行依赖拓扑排序、循环检测、版本检查、能力冲突和能力依赖检查。停用顺序与激活顺序相反。
