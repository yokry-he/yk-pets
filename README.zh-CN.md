# NOVA Browser Agent

住在网页右下角的 3D AI 前端工程师。NOVA 可以通过动物互动审计任意 HTTP/HTTPS 页面、切换和定位问题、临时预览优化，并通过本地 WebSocket Agent 生成安全源码 Diff，在用户确认后写入、验证和回滚。

## 项目组成

```text
apps/extension       Chrome/Edge Manifest V3 扩展
apps/playground      Nuxt 3D 云狐演示与审计实验页
packages/shared      审计模型与通信协议
packages/local-agent 本地项目 WebSocket Agent
docs/                完整设计、架构、安全与开发文档
```


## 首次使用与发布

- [详细使用操作手册](docs/zh-CN/USER-GUIDE.md)
- [网络实验室与 Mock 工作台操作](docs/zh-CN/NETWORK-LAB-OPERATIONS.md)
- [构建、打包与 Chrome Web Store 发布](docs/zh-CN/BUILD-AND-RELEASE.md)
- [故障排查](docs/zh-CN/TROUBLESHOOTING.md)
- [代码注释与维护规范](docs/zh-CN/DEVELOPER-MAINTENANCE.md)

## 快速启动

```bash
corepack enable
pnpm install
```

分别启动：

```bash
pnpm dev:playground
pnpm dev:agent
pnpm dev:extension
```

在 Chrome 扩展管理页加载：

```text
apps/extension/.output/chrome-mv3
```

推荐测试页面：

```text
http://localhost:3000/audit-lab
```

## 已实现

- Vue 3 + WXT Side Panel
- 网络实验室：当前网站一键开启/关闭 Fetch/XHR 拦截与 Mock
- Side Panel 全页 Mock 规则工作台：新增不存在接口、从请求生成、编辑、复制、测试与冲突检测
- 固定 JSON/文本 Mock、Query 条件、真实 JSON 响应字段设置/删除和延迟模拟
- JSON 专注编辑、规则草稿恢复、规则范围隔离与优先级匹配
- Fetch、XHR 与静态资源性能采集，请求详情和快速生成 Mock
- 最慢请求、资源体积分布、请求瀑布、P95、评分与自动诊断
- Domain / Application / Infrastructure / Presentation 分层，使用 Strategy、Repository 和 Adapter 模式
- 网页右下角的透明星云 TresJS 程序化 3D 云狐
- 完整身体取景、星点、能量波纹和围绕宠物展开的环形功能菜单
- 三段式柔性云尾、尾尖能量脉冲和情绪驱动的延迟摆动
- 功能 / 动作 / 工程三级模式轨道，动作注册表支持分页
- 18 个宠物动作，包含害羞偷看、星星杂耍、云朵午睡、星光喷嚏、高空烟花与四个高能动作
- 按需状态提示：默认隐藏、可随时关闭，详细内容进入右侧 Side Panel
- motionKey 动画切换令牌：新动作经中性过渡打断当前动作，重复点击当前动作不重播
- 四层闲时调度：普通、生活、高能与低概率彩蛋；忙碌、菜单打开和后台标签页时自动暂停
- 单击、双击、右键、悬停与拖拽动物交互
- 通过云狐触发审计、问题导航、预览、补丁、验证和回滚
- Content Script 页面审计
- 图片、表单、交互名称、标题层级、重复 ID、DOM 规模检查
- Navigation、LCP、CLS、Long Task、大型资源指标
- 页面元素高亮与自动避让定位标签
- 无横向滚动的响应式 Side Panel
- 带跨问题兜底恢复的可撤销 DOM 临时预览
- Token 认证的本机 WebSocket Agent
- 源码候选搜索
- 安全的最小补丁
- SHA-256 并发修改保护
- Typecheck/Test/Build 允许列表
- 补丁备份与回滚

## 文档

- [产品与交互设计](docs/DESIGN.md)
- [网页内 3D NOVA 交互设计](docs/PET-INTERACTION.md)
- [星云透明层与环形菜单](docs/zh-CN/NEBULA-RADIAL-MENU.md)
- [云狐尾巴设计方案](docs/zh-CN/TAIL-DESIGN.md)
- [动作控制与闲时轮播](docs/zh-CN/MOTION-CONTROLS.md)
- [按需提示与动作运行时](docs/zh-CN/NOTICES-AND-MOTION-RUNTIME.md)
- [网络实验室 v0.5.0](docs/zh-CN/NETWORK-LAB-v0.5.0.md)
- [Mock 工作台与高能动作 v0.5.1](docs/zh-CN/MOCK-WORKBENCH-HIGH-ENERGY-v0.5.1.md)
- [技术架构](docs/ARCHITECTURE.md)
- [Local Agent 协议](docs/LOCAL-AGENT-PROTOCOL.md)
- [安全设计](docs/SECURITY.md)
- [开发指南](docs/DEVELOPMENT.md)
- [路线图](docs/ROADMAP.md)
- [双语文档与代码可维护性 v0.5.2](docs/zh-CN/DOCUMENTATION-AND-COMMENTS-v0.5.2.md)
- [宠物生命力、烟花与随机彩蛋 v0.6.0](docs/zh-CN/PET-VITALITY-FIREWORKS-v0.6.0.md)

- [动画队列、主动发光与侧躺午睡 v0.6.1](docs/zh-CN/ANIMATION-GLOW-SLEEP-v0.6.1.md)
- [新增规则、动作音效与思考气泡 v0.6.3](docs/zh-CN/MOTION-FEEDBACK-v0.6.3.md)
- [规则编辑器多层 Proxy 修复 v0.6.4](docs/zh-CN/RULE-PROXY-FIX-v0.6.4.md)
- [Fetch Mock 拦截修复 v0.6.5](docs/zh-CN/FETCH-MOCK-INTERCEPTION-v0.6.5.md)
- [真实响应完整 JSON 编辑 v0.6.6](docs/zh-CN/WHOLE-JSON-RESPONSE-v0.6.6.md)
- [审计范围、网络分类与宠物反馈修复 v0.6.7](docs/zh-CN/AUDIT-NETWORK-PET-FEEDBACK-v0.6.7.md)
- [审计子规则、尾尖与动作语音修复 v0.6.8](docs/zh-CN/AUDIT-PET-AUDIO-v0.6.8.md)
- [动作语音静音文件修复 v0.6.9](docs/zh-CN/MOTION-VOICE-AUDIO-v0.6.9.md)
- [多音色切换与系统萌系语音 v0.6.10](docs/zh-CN/PET-VOICE-PRESETS-v0.6.10.md)
