# NOVA v0.5.1：Mock 工作台与高能动作

## 版本目标

v0.5.1 在 v0.5.0 网络实验室基础上补齐完整的 Mock 规则创建流程，并为云狐增加高强度动作。主要目标是：

1. 用户不依赖已发生的请求，也能为尚不存在的接口创建 Mock。
2. “从请求生成 Mock”直接进入带预填数据的编辑流程，而不是只切换到规则页。
3. 新增、编辑、复制和从请求生成共用同一套 Side Panel 全页编辑器。
4. 规则领域、应用服务、基础设施和表现层继续保持分离。
5. 动作系统增加四个高能动作，同时保留减少动态效果降级。

## Mock 工作台交互

### 页面结构

网络实验室保持单一 Side Panel 应用，内部使用页面状态切换：

```text
性能概览 / 请求列表 / 规则列表
                    ↓
              规则全页编辑器
                    ↓
              JSON 专注编辑
```

规则列表负责快速管理，规则编辑页负责完整配置，不使用抽屉和额外 Chrome 窗口。

### 支持的入口

- **新增规则**：创建任意路径或完整 URL，可用于真实服务中尚不存在的接口。
- **从请求生成**：带入捕获请求的 URL、方法、状态码和响应预览。
- **编辑规则**：修改已有规则并保留规则 ID。
- **复制规则**：生成新 ID，名称增加“副本”，默认停用，避免与原规则立即冲突。

### 编辑内容

- 规则名称、启用状态、优先级和生效网站。
- Glob 或正则 URL 匹配。
- 请求方法与 Query 条件。
- 完整 Mock、真实响应修改或延迟动作。
- JSON 或文本响应、状态码和延迟。
- 测试 URL、规则命中预览和冲突检测。
- JSON 专注编辑、格式校验和草稿恢复。

### 不存在接口的处理

执行顺序为：

```text
Fetch / XHR
→ 检查当前网站总开关
→ 匹配启用规则
→ 命中完整 Mock 时直接构造响应
→ 不调用真实网络
→ 未命中时才放行原始请求
```

因此 `/api/future-feature` 等尚未部署的接口也可以直接被页面使用。

## 工程结构

```text
features/network-lab/
├── domain/
│   ├── network-rule-factory.ts
│   ├── network-rule-matcher.ts
│   └── network-rule-conflict-service.ts
├── application/
│   ├── network-analysis-service.ts
│   └── network-rule-application-service.ts
├── infrastructure/
│   ├── chrome-network-repository.ts
│   ├── chrome-rule-draft-repository.ts
│   └── network-page-channel.ts
└── presentation/
    ├── components/
    ├── composables/
    └── pages/
```

使用的设计方式：

- **Factory**：手动创建、请求生成和复制规则。
- **Strategy**：Glob、正则、方法与 Query 匹配。
- **Repository**：规则、设置和编辑草稿持久化。
- **Application Service**：创建、更新、复制、删除和测试编排。
- **Adapter**：页面 MAIN world 拦截器与扩展隔离世界通信。
- **Presentation / Composable 分离**：页面组件不直接访问 Chrome Storage。

## 高能动作

### 空翻落地

蓄力下沉、跃起、完成后空翻、落地压缩阴影并释放能量波纹。减少动态效果模式下使用不旋转的简化跃起。

### 甩尾旋风

尾巴先蓄力，随后由中段和尾尖横扫，身体连续旋转，拖尾和星点加强，最后逐渐收束。

### 飞扑接球

能量球高速进入，头部和眼睛持续锁定球，宠物蓄力飞扑，用双爪抱住后稳定落地。

### 能量爆发

双爪向胸前聚拢，胸口核心逐步增亮，耳朵和尾巴展开，释放多层能量环和星点，随后回到待机。

### 调度约束

- 用户点击始终优先触发。
- 高能动作闲置触发间隔为 3～5 分钟，且仅以低概率播放。
- 菜单打开、Agent 忙碌、页面后台时暂停。
- `prefers-reduced-motion` 下自动使用简化动作。

## 分页指示点

动作超过六项时显示分页点。分页点固定在宠物动态阴影下方，与身体动作解耦；当前页使用紫色高亮，其他页使用低透明度紫色。

## 安全与范围

- 网络总开关按网站保存，一键关闭后立即停止 Mock、修改和延迟。
- 规则默认限定创建时的网站 Origin，避免跨站误命中。
- 复制规则默认关闭。
- Mock 规则只在页面主动发起匹配的 Fetch/XHR 时生效。
- v0.5.1 不包含 CDP、WebSocket 帧拦截或 Service Worker 深度代理。
