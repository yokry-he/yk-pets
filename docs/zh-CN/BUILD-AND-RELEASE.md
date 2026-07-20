# YK-PETS 构建、打包与发布手册

> 适用基线：`v0.6.10` 平台化分支及后续兼容版本

## 1. 环境要求

- Node.js 22 或更高；
- Corepack；
- pnpm 11.13.1；
- Chrome 或 Edge；
- 推荐在干净工作区执行正式构建。

```bash
node --version
corepack enable
corepack prepare pnpm@11.13.1 --activate
pnpm --version
```

## 2. 安装依赖

```bash
pnpm install --frozen-lockfile
```

如果冻结安装失败，先检查 `package.json` 与 `pnpm-lock.yaml` 是否同步，不要直接删除锁文件生成不可审阅的大范围更新。

## 3. 发布前验证

按以下顺序执行：

```bash
pnpm check:brand
pnpm typecheck
pnpm test
pnpm build
pnpm build:playground
```

其中：

- `check:brand` 校验 YK-PETS、云灵/Zeph、云狐/Cloud Fox、兼容迁移和发布名称；
- `typecheck` 运行文档和专项回归后执行全部 Workspace 类型检查；
- `test` 运行 Workspace 测试；
- `build` 构建 Local Agent 和扩展；
- `build:playground` 构建 Nuxt 演示站。

任一步失败都不应进入发布。

## 4. 扩展开发构建

```bash
pnpm dev:extension
```

开发输出目录通常为：

```text
apps/extension/.output/chrome-mv3
```

在浏览器扩展管理页加载该目录，并至少验证：

1. Manifest 名称为 `YK-PETS Browser Agent`；
2. 工具栏标题显示 YK-PETS；
3. 网页右下角显示云灵而不是 NOVA；
4. Side Panel 标题和界面使用 YK-PETS；
5. 语音、动作、审计、Network Lab 和 Agent 连接正常。

## 5. 生产构建

```bash
pnpm build:extension
pnpm build:agent
pnpm build:playground
```

扩展生产目录：

```text
apps/extension/.output/chrome-mv3
```

Local Agent 构建目录：

```text
packages/local-agent/dist
```

Playground 构建目录由 Nuxt 生成在：

```text
apps/playground/.output
```

## 6. 创建扩展 ZIP

```bash
pnpm zip:extension
```

WXT 配置使用固定模板：

```text
yk-pets-{{version}}-{{browser}}.zip
```

当前版本输出应为：

```text
apps/extension/.output/yk-pets-0.6.10-chrome.zip
```

发布前解压检查，压缩包顶层必须直接包含 `manifest.json`，不能再多包一层目录。

## 7. Local Agent 命令

主命令：

```bash
yk-pets-agent dev --root .
```

兼容别名：

```bash
nova-agent dev --root .
```

发布说明应把 `yk-pets-agent` 作为唯一推荐命令；旧别名只用于迁移。

## 8. 配置和隐私检查

确认以下内容不会进入发布包或源码提交：

```text
.env
.env.*
.yk-pets/
.nova/
node_modules/
coverage/
```

`.yk-pets/agent.json` 和 `.nova/agent.json` 可能包含本地连接口令，不得提交或打包。

## 9. 浏览器人工验收

至少在一个普通 HTTPS 页面和 Playground 审计页完成：

- 云灵加载、拖拽、菜单、动作和语音；
- 宠物身份显示为云灵（Zeph），物种为云狐；
- 页面审计与规则范围；
- 问题定位、预览和撤销；
- Network Lab 采集、筛选和 Mock；
- Local Agent 连接；
- 补丁生成、确认写入、检查和回滚；
- 旧 `nova:*` 设置升级后仍可使用；
- 旧 `.nova/agent.json` 可迁移到 `.yk-pets/agent.json`。

## 10. 版本更新

正式版本至少同步：

- 根 `package.json`；
- `apps/extension/package.json`；
- `apps/extension/wxt.config.ts` Manifest 版本；
- 当前项目状态；
- 版本历史；
- 发布说明和构建产物。

兼容期内私有 `@nova/*` Workspace scope 可以保留，但不得出现在用户可见产品名称或压缩包名称中。

## 11. GitHub Actions

分支包含：

```text
.github/workflows/validate-yk-pets.yml
```

该工作流执行冻结安装、品牌检查、类型检查、测试以及三个主要构建。正式合并前应确认工作流通过。

## 12. 回滚

发布失败时：

1. 停止上传或撤回待发布版本；
2. 保留失败日志和构建产物；
3. 回退到最近一次全部门禁通过的提交；
4. 不删除用户的 `.nova` 兼容配置；
5. 修复后重新执行完整验证；
6. 重新生成带 YK-PETS 文件名的发布包。
