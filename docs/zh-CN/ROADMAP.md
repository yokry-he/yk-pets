# 路线图

## 0.1 基础 MVP（已完成）

- Chrome/Edge Side Panel
- DOM、无障碍、SEO 与基础性能审计
- 元素定位与可撤销预览
- 本地 WebSocket Agent
- 确定性源码补丁
- Typecheck、Test、Build 与安全回滚

## 0.2 动物优先交互（当前版本）

- 3D 云狐注入允许扩展运行的网页右下角
- 单击、双击、右键、悬停和拖拽交互
- 由动物触发审计、问题切换、定位、预览和撤销
- 由动物打开详细报告和 Local Agent 工具
- 由动物触发补丁生成、确认写入、项目验证和回滚
- 云狐同步显示健康度、问题数量、当前问题与执行状态
- 动物动作协议自动完整性检查

## 0.3 性能与站点控制

- 将审计采集器与 3D 宠物拆为独立按需 Bundle
- 按站点启用、暂停或隐藏 3D NOVA
- 记住每个站点的宠物位置和展开状态
- 标签页不可见时暂停 WebGL 渲染
- 低性能设备、WebGL 不可用和省电模式下提供 2D 回退
- 进一步压缩程序化模型和 Three.js 依赖

## 0.4 源码映射与深度分析

- Vite/Nuxt 开发插件注入组件文件与行号
- Source Map 与 Vue DevTools Hook 辅助映射
- 多文件补丁与 Git Diff 分组
- DevTools Panel 与 Chrome DevTools Protocol 性能采样
- Network Waterfall、Console 错误和完整 axe-core 规则集
- Lighthouse/Playwright 修复前后验证

## 0.5 Agent 能力

- Git Worktree 隔离修改
- AI 解释与复杂补丁生成
- 项目级规则文件 `nova.config.ts`
- PR 描述、变更报告和前后指标对比
- 语音、手势和可配置宠物动作映射

## 1.0

- Chrome Web Store 发布
- Native Messaging 桌面 Agent
- 团队策略和审计日志
- Firefox/Edge 正式支持
