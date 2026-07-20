# 开发者维护与代码注释指南

## 1. 目标

项目代码应让新成员能够快速判断：

- 当前文件属于哪一层；
- 一段代码解决什么问题；
- 为什么存在某个边界条件；
- 哪些行为具有安全或兼容性约束；
- 修改后需要运行哪些验证。

注释不要求逐行重复代码，但每个主要模块和非直观逻辑段都应有说明。

## 2. 分层约定

```text
Domain          纯规则、实体和值对象
Application     用例编排，不依赖具体 UI
Infrastructure  Chrome、DOM、WebSocket、文件系统适配
Presentation    Vue 页面、组件、Composables
Shared          跨包协议和数据结构
```

依赖方向应由外向内。Domain 不允许依赖 Vue、Chrome API 或 DOM。

## 3. 文件头注释

每个手写源文件应包含双语文件职责说明：

```ts
/**
 * 当前网站网络规则的应用服务，负责 CRUD 与测试编排。
 * Application service for site network-rule CRUD and test orchestration.
 */
```

Vue 文件在 `<script setup>` 后说明状态和职责；模板中的主要区域用双语 HTML 注释标识。

## 4. 段落注释

应在这些位置增加注释：

- 状态定义；
- 生命周期与监听器；
- 规则匹配或排序；
- 跨执行世界通信；
- 安全过滤和脱敏；
- 动画阶段；
- 错误恢复；
- 文件写入和哈希保护；
- 复杂模板区域；
- 大段 CSS 功能区域。

示例：

```ts
// 页面目标优先于鼠标目标，避免玩球过程中视线被指针抢占。
// Page targets outrank pointer tracking so the pet keeps watching the ball.
```

## 5. 不应添加的注释

避免：

```ts
// 设置 enabled 为 true
settings.enabled = true
```

应解释原因：

```ts
// 新建规则默认启用，复制规则默认关闭，避免复制后与原规则立即冲突。
// New rules start enabled; duplicates start disabled to avoid immediate conflicts.
```

## 6. Vue 模板注释

```vue
<!-- 当前网站与总开关 / Current site and master switch -->
<section>...</section>

<!-- 规则冲突与测试结果 / Rule conflicts and test results -->
<section>...</section>
```

不要在同一个元素内部放置会改变空白渲染的多余注释。

## 7. CSS 分区

```css
/* 网络实验室顶部状态区 / Network Lab top status area */

/* 请求瀑布图 / Request waterfall */

/* 窄 Side Panel 响应式布局 / Narrow Side Panel responsive layout */
```

## 8. 修改流程

1. 明确受影响层；
2. 先修改领域模型和应用服务；
3. 再更新适配器和 UI；
4. 更新中英文文档；
5. 更新对应段落注释；
6. 增加或修改验证脚本；
7. 运行完整检查。

## 9. 必跑命令

```bash
pnpm check:bilingual
pnpm typecheck
pnpm test
pnpm test:network-domain
pnpm test:network-workbench
pnpm build:extension
```

## 10. 评审清单

- [ ] 文件职责是否清楚；
- [ ] 每个主要段落是否有双语说明；
- [ ] 注释解释“为什么”，而不是复述“做什么”；
- [ ] 中英文含义一致；
- [ ] 注释未过期；
- [ ] 领域层没有基础设施依赖；
- [ ] 网络总开关和敏感数据边界未被破坏；
- [ ] 用户操作文档同步更新。
