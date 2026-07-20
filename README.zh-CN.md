# NOVA Browser Agent

住在网页右下角的 3D AI 前端工程师。NOVA 可以审计任意 HTTP/HTTPS 页面、定位问题、临时预览优化，并通过本地 WebSocket Agent 生成受约束的源码 Diff；只有在用户明确确认后才会写入、验证或回滚。

## 项目组成

```text
apps/extension       Chrome/Edge Manifest V3 扩展
apps/playground      Nuxt 3D 云狐演示与审计实验页
packages/shared      审计模型与通信协议
packages/local-agent 本地项目 WebSocket Agent
docs/                使用、架构、安全与开发文档
```

## 快速开始

环境要求：Node.js 22+、Corepack 和 pnpm 11.13.1。

```bash
corepack enable
pnpm install --frozen-lockfile
```

分别启动：

```bash
pnpm dev:playground
pnpm dev:agent
pnpm dev:extension
```

推荐测试页：`http://localhost:3000/audit-lab`。

## Chrome 扩展开发与打包

```bash
pnpm dev:extension
pnpm build:extension
pnpm zip:extension
```

Chrome 开发者模式加载目录：

```text
apps/extension/.output/chrome-mv3
```

Chrome Web Store 上传包：

```text
apps/extension/.output/novaextension-0.6.10-chrome.zip
```

## 核心能力

- Vue 3 + WXT Manifest V3 扩展与 Side Panel；
- 网页右下角的 TresJS 程序化 3D 云狐、动作、拖拽、菜单和可切换音色；
- 页面审计、问题定位、性能指标和可撤销 DOM 预览；
- Fetch/XHR 采集、Mock、延迟、完整 JSON 响应修改和规则工作台；
- Token 认证的本地 WebSocket Agent；
- SHA-256 并发修改保护、显式写入确认、验证和回滚。

## 文档

- [完整文档索引](docs/README.md)
- [当前项目状态](docs/zh-CN/PROJECT-STATUS.md)
- [使用操作手册](docs/zh-CN/USER-GUIDE.md)
- [网络实验室与 Mock 工作台](docs/zh-CN/NETWORK-LAB-OPERATIONS.md)
- [构建、打包与发布](docs/zh-CN/BUILD-AND-RELEASE.md)
- [故障排查](docs/zh-CN/TROUBLESHOOTING.md)
- [开发者维护与代码注释指南](docs/zh-CN/DEVELOPER-MAINTENANCE.md)
- [English README](README.en.md)
