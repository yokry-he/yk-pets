# YK-PETS Browser Agent

住在网页右下角的 3D AI 前端工程伙伴平台。当前默认宠物的**物种是云狐**，名字是**云灵**，英文名是 **Zeph**。云灵可以审计任意 HTTP/HTTPS 页面、定位问题、临时预览优化，并通过本地 WebSocket Agent 生成受约束的源码 Diff；只有在用户明确确认后才会写入、验证或回滚。

## 品牌与宠物身份

```text
产品品牌：YK-PETS
宠物物种：云狐（Cloud Fox）
宠物名字：云灵（Zeph）
```

产品品牌、宠物物种和宠物名字是三个独立概念。后续增加新的宠物物种或名字时，不需要再次修改 YK-PETS 品牌。

## 项目组成

```text
apps/extension       Chrome/Edge Manifest V3 扩展
apps/playground      Nuxt 3D 宠物演示与审计实验页
packages/shared      品牌、宠物身份、审计模型与通信协议
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

## Local Agent

新的主命令为：

```bash
yk-pets-agent dev --root .
```

为了兼容 `v0.6.10`，`nova-agent` 暂时仍作为命令别名保留。配置会写入 `.yk-pets/agent.json`；如果只存在旧的 `.nova/agent.json`，YK-PETS 会自动迁移原有 Token 与端口。

## 核心能力

- Vue 3 + WXT Manifest V3 扩展与 Side Panel；
- 由云狐云灵（Zeph）承载的 TresJS 程序化 3D 宠物、动作、拖拽、菜单和可切换音色；
- 页面审计、问题定位、性能指标和可撤销 DOM 预览；
- Fetch/XHR 采集、Mock、延迟、完整 JSON 响应修改和规则工作台；
- Token 认证的本地 WebSocket Agent；
- SHA-256 并发修改保护、显式写入确认、验证和回滚；
- `nova:*` 到 `yk-pets:*` 的本地设置兼容迁移。

## 兼容策略

`v0.6.10` 迁移阶段仍保留部分 `Nova*`、`NOVA_*`、`@nova/*` 和 `nova:*` 技术标识，作为现有扩展消息、Workspace 依赖和用户数据的兼容边界。用户可见品牌、新领域模型、主 CLI 和新配置目录均已使用 YK-PETS。

## 文档

- [完整文档索引](docs/README.md)
- [当前项目状态](docs/zh-CN/PROJECT-STATUS.md)
- [版本与验证历史](docs/zh-CN/RELEASE-HISTORY.md)
- [使用操作手册](docs/zh-CN/USER-GUIDE.md)
- [网络实验室与 Mock 工作台](docs/zh-CN/NETWORK-LAB-OPERATIONS.md)
- [构建、打包与发布](docs/zh-CN/BUILD-AND-RELEASE.md)
- [故障排查](docs/zh-CN/TROUBLESHOOTING.md)
- [开发者维护与代码注释指南](docs/zh-CN/DEVELOPER-MAINTENANCE.md)
- [English README](README.en.md)
