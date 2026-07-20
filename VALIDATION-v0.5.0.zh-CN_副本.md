# NOVA Browser Agent v0.5.0 验证报告

## 验证范围

本次验证覆盖：

- 原有宠物、菜单、动作、思考气泡和 Agent 功能回归；
- 分页指示点位置与尺寸修正；
- 网络领域模型、规则匹配与 JSON 转换；
- Fetch/XHR 拦截、Mock、响应修改和延迟逻辑；
- 当前网站一键总开关；
- Chrome Storage 仓储与配置同步；
- PerformanceObserver 资源采集；
- 性能评分、诊断和图表；
- Side Panel 请求详情和规则编辑器；
- WXT Chrome MV3 干净构建与 ZIP 完整性。

## 自动检查

### 既有回归检查

通过：

- 双语文档与代码注释；
- 11 项宠物动作协议；
- 星云层与尾巴设计；
- 动作控制与闲时轮播；
- 提示和动作重启；
- 思考气泡；
- 极简菜单与菜单注册表；
- v0.4.0 生活动作；
- v0.4.2 尾巴、前爪与菜单配色；
- v0.4.3 招手、伸展、视线与餐桌。

### v0.5.0 网络实验室专项检查

19/19 项通过：

1. MAIN world Fetch 拦截；
2. XHR 监控与 Mock；
3. 固定 JSON Mock；
4. 真实 JSON 响应字段修改；
5. 延迟模拟；
6. 当前网站一键总开关；
7. Repository 仓储模式；
8. 规则匹配策略；
9. 隔离桥接与资源采集；
10. MAIN world 就绪握手；
11. 统一网络数据模型；
12. 慢请求自动诊断；
13. 三类性能图表；
14. 易用规则编辑器；
15. 请求一键生成 Mock；
16. 请求详情与复制操作；
17. 工程模式入口；
18. 分页指示点下移放大；
19. 版本统一为 0.5.0。

### 网络领域测试

15 个断言通过，覆盖：

- Glob 匹配成功与失败；
- 规则优先级；
- HTTP 方法限制；
- 嵌套字段设置；
- 数组路径设置；
- 字段删除；
- 请求数量、慢请求数和错误数；
- P95；
- 最慢请求排序；
- 高严重度诊断。

## 类型检查

通过：

- WXT 类型生成；
- Vue `vue-tsc --noEmit`；
- `@nova/shared` TypeScript `tsc --noEmit`。

## 干净构建

执行步骤：

```text
删除 apps/extension/.output
删除 apps/extension/.wxt
wxt prepare
vue-tsc --noEmit
wxt build -b chrome
wxt zip -b chrome
```

构建结果：

- Chrome Manifest V3；
- 版本 `0.5.0`；
- MAIN world 网络脚本独立输出；
- 隔离世界 Bridge 独立输出；
- Side Panel 网络实验室已编译；
- 所有生产 JavaScript 通过 `node --check`；
- Manifest 通过 JSON 解析；
- ZIP 通过 `unzip -t` 完整性检查。

生产包关键文件：

```text
manifest.json
background.js
sidepanel.html
chunks/sidepanel-*.js
assets/sidepanel-*.css
content-scripts/content.js
content-scripts/network-bridge.js
content-scripts/network-main.js
```

## Manifest 检查

确认：

- `network-bridge.js` 在隔离世界、`document_start` 运行；
- `network-main.js` 在 `MAIN` world、`document_start` 运行；
- 匹配 `http://*/*` 和 `https://*/*`；
- 权限包含 `activeTab`、`scripting`、`storage` 和 `sidePanel`。

## 生产代码标记检查

编译结果中确认包含：

- `__NOVA_NETWORK_LAB__`；
- `READY`；
- `网络拦截与性能分析`；
- `修改真实响应`；
- `REQUEST DETAIL`；
- `最近请求瀑布`。

## 浏览器自动运行测试边界

尝试使用容器内 Chromium 加载解压扩展并导航到本地测试页，浏览器管理策略返回：

```text
net::ERR_BLOCKED_BY_ADMINISTRATOR
```

该策略同时阻止本地和外部 HTTP/HTTPS 导航，因此无法在当前容器完成真实网页的端到端 Fetch/XHR 自动运行测试。此次交付没有将该项标记为通过。

替代验证已完成：

- MAIN/Bridge 生产脚本实际生成；
- Manifest 执行世界配置检查；
- TypeScript/Vue 类型检查；
- 领域规则和分析服务可执行断言；
- 生产 JavaScript 语法检查；
- ZIP 完整性检查。

安装到本地 Chrome 后，建议使用测试接口依次验证：

1. 总开关关闭时请求保持真实响应；
2. 总开关开启后固定 JSON Mock 生效；
3. `set/remove` 修改真实 JSON 响应；
4. Fetch 和 XHR 均命中规则；
5. 关闭总开关后立即恢复；
6. 请求详情、图表和诊断随刷新更新。
