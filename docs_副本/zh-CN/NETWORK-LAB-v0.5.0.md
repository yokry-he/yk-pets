# NOVA 网络实验室 v0.5.0

## 1. 目标

v0.5.0 将 NOVA 从页面审计与宠物交互工具扩展为浏览器内的网络调试工作台，首个版本聚焦四项能力：

1. 对当前网站的 Fetch、XMLHttpRequest 和静态资源进行采集；
2. 对 Fetch/XHR 进行固定 JSON Mock、真实 JSON 响应修改与延迟模拟；
3. 为当前网站提供一个明确的一键总开关；
4. 对慢接口和慢资源进行评分、诊断与图表展示。

复杂配置全部位于 Side Panel，网页中的宠物仅负责入口、状态反馈和问题提醒。

## 2. 使用流程

1. 在宠物的“工程”模式中点击“网络实验室”；
2. Side Panel 顶部确认当前网站域名；
3. 使用总开关一键开启或关闭当前网站的拦截与 Mock；
4. 在“请求”页刷新并观察 Fetch、XHR 和资源请求；
5. 点击任意请求查看状态、耗时、体积、Timing 与响应预览；
6. 点击“生成 Mock”，或在“规则”页新建规则；
7. 保存规则后立即同步到当前页面；
8. 在“概览”页查看慢请求排行、资源体积分布、请求瀑布与自动诊断。

总开关按网站 Origin 保存。关闭后，Mock、响应修改和人为延迟立即停止，性能采集仍可用于分析真实请求。

## 3. 工程目录

```text
apps/extension/features/network-lab/
├── domain/
│   └── network-rule-matcher.ts
├── application/
│   └── network-analysis-service.ts
├── infrastructure/
│   ├── chrome-network-repository.ts
│   └── network-page-channel.ts
└── presentation/
    ├── composables/
    │   └── useNetworkLab.ts
    └── components/
        ├── NetworkLab.vue
        ├── NetworkRuleEditor.vue
        └── NetworkPerformanceCharts.vue

apps/extension/entrypoints/
├── network-main.content.ts
└── network-bridge.content.ts

packages/shared/src/
└── network.ts
```

## 4. 分层与设计模式

### 4.1 Domain

`network-rule-matcher.ts` 是纯领域层，负责：

- Glob/Regex URL 匹配；
- HTTP 方法匹配；
- 规则优先级排序；
- JSON 路径解析；
- `set` 和 `remove` 转换策略。

该层不依赖 Chrome API、Vue 或 DOM，便于独立测试。

### 4.2 Application Service

`NetworkAnalysisService` 负责：

- 请求数量、错误数、慢请求数与传输体积汇总；
- 平均耗时与 P95；
- 综合性能评分；
- 最慢请求排序；
- 资源类型聚合；
- TTFB、下载体积和错误请求诊断。

### 4.3 Repository Pattern

`NetworkRuleRepository` 定义规则与站点配置仓储接口，`ChromeNetworkRepository` 是 Chrome Storage 实现。

- 规则统一存储；
- 总开关和阈值按 Origin 保存；
- UI 不直接操作 `chrome.storage`；
- 后续可替换为 IndexedDB 或 Local Agent 仓储。

### 4.4 Strategy Pattern

规则动作使用统一模型并按策略执行：

```text
mock             → 固定响应策略
modify-response  → 真实响应转换策略
delay            → 请求延迟策略
```

JSON 修改进一步拆分为：

```text
set     → 设置或替换字段
remove  → 删除字段
```

### 4.5 Adapter Pattern

- `network-main.content.ts`：MAIN world 页面网络适配器；
- `network-bridge.content.ts`：隔离世界与 Chrome Runtime 适配器；
- `network-page-channel.ts`：两个执行世界之间的消息适配器；
- `ChromeNetworkRepository`：浏览器存储适配器。

### 4.6 Presentation + Composable

`useNetworkLab` 作为表现层协调器，组件只负责交互和展示：

- 读取页面快照；
- 一键切换站点状态；
- 规则 CRUD 与同步；
- 请求清空与轮询刷新；
- 快速从已捕获请求生成 Mock。

## 5. 网络执行链路

```text
Side Panel
  ↓ Chrome Runtime Message
Isolated Bridge
  ↓ window.postMessage CONFIGURE
MAIN World Interceptor
  ↓ 包装 fetch / XMLHttpRequest
页面真实请求或 Mock 响应
  ↓ ENTRY
Isolated Bridge
  ↓ 内存快照 + PerformanceResourceTiming 合并
Side Panel 图表与诊断
```

MAIN world 安装完成后会发送 `READY`，Bridge 收到后重新发送当前配置；Bridge 初始化完成后也会主动发送配置，从而避免 document_start 阶段的执行顺序竞争。

## 6. 规则模型

```ts
interface NetworkRule {
  id: string
  name: string
  enabled: boolean
  priority: number
  match: {
    urlPattern: string
    patternType: 'glob' | 'regex'
    methods: NetworkHttpMethod[]
  }
  action: {
    type: 'mock' | 'modify-response' | 'delay'
    delayMs: number
    mock?: NetworkMockResponse
    transforms?: JsonTransformOperation[]
  }
}
```

匹配到多条规则时，优先级最高且最近更新的规则先执行；首条命中后停止继续匹配。

## 7. 易用性设计

- 顶部常驻当前网站域名与一键总开关；
- 开启和关闭状态使用明显文字、圆点与边框反馈；
- 概览、请求、规则三页结构，避免信息堆叠；
- 请求支持 URL、方法、状态码搜索和“只看慢请求”；
- 点击请求直接查看详情与响应预览；
- 支持复制 URL、复制响应和一键生成 Mock；
- 规则编辑器使用“Mock / 修改响应 / 延迟”三个语义选项；
- 规则单独启停，保存后立即同步；
- 总开关关闭时仍可预先编辑规则；
- 网络脚本尚未连接页面时给出明确刷新提示。

## 8. 性能分析

当前图表包括：

1. 最慢请求排行；
2. 按资源类型聚合的传输体积分布；
3. 最近 40 条请求瀑布。

自动诊断包括：

- HTTP 错误和运行时错误；
- 超过配置阈值的慢请求；
- TTFB 占比过高；
- 下载阶段占比过高；
- 大体积资源；
- 对应的服务端、缓存、压缩和拆分建议。

## 9. 数据安全

- 默认关闭当前站点的 Mock 与响应修改；
- 响应预览限制深度、字段数量、数组长度和字符串长度；
- `authorization`、`cookie`、`token`、`password`、`secret`、`session`、`credential` 等字段自动脱敏；
- 内存中最多保存站点配置指定数量的请求，默认 300 条；
- 页面请求正文、Cookie 和 Authorization 不进入当前数据模型；
- 配置仅保存在本机 Chrome Storage；
- 当前版本不上传网络数据。

## 10. 当前边界

- Mock 和响应正文修改覆盖页面 JavaScript 发起的 Fetch/XHR；
- 静态资源通过 PerformanceResourceTiming 采集性能，但不修改正文；
- 当前版本不处理 WebSocket、SSE、Service Worker 内部请求和流式响应；
- 跨域资源未提供 `Timing-Allow-Origin` 时，部分 Timing 和大小字段可能为 0；
- 当前响应修改面向 JSON；非 JSON 响应保持原样；
- 当前规则存储为本机规则，不包含团队同步和版本冲突处理。

## 11. 后续扩展

- 多字段可视化转换流水线；
- 请求头、查询参数和请求体修改；
- 场景规则组与环境切换；
- 请求录制与回放；
- OpenAPI/JSON Schema 契约校验；
- HAR 导入导出；
- DNR 规则编译器；
- CDP 增强拦截模式；
- WebSocket/SSE 与 Local Agent 代理；
- 性能历史趋势和基线对比；
- Mock/慢请求状态与高能宠物动作联动。
