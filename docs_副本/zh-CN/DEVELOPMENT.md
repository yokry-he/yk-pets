# 开发与运行指南

## 环境

- Node.js 22+
- pnpm 11+
- Chrome 或 Edge（支持 Manifest V3 Side Panel）

## 安装

```bash
corepack enable
pnpm install
```

## 运行三部分

终端 1，启动 Nuxt Playground：

```bash
pnpm dev:playground
```

打开：

```text
http://localhost:3000/audit-lab
```

终端 2，启动本地 Agent：

```bash
pnpm dev:agent
```

终端会显示：

```text
地址：ws://127.0.0.1:4736
连接口令：<token>
```

终端 3，启动扩展开发构建：

```bash
pnpm dev:extension
```

## 加载扩展

1. 打开 `chrome://extensions`。
2. 开启“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择：

```text
apps/extension/.output/chrome-mv3
```

5. 安装或重载扩展后刷新目标网页。
6. 刷新页面后，3D NOVA 会出现在网页右下角。浏览器工具栏图标仍可打开 Side Panel。

## 验证完整流程

### 仅通过动物交互

1. 打开 `/audit-lab` 并等待右下角 3D NOVA 出现。
2. 双击云狐，确认开始页面审计。
3. 单击云狐展开快捷功能，使用“下一个”切换问题。
4. 确认页面滚动到目标元素，且定位标签不覆盖目标内容。
5. 点击“预览修复”，确认 DOM 临时变化；再次点击确认可以撤销。
6. 右键云狐打开工程工具箱。
7. 点击“连接本地 Agent”，在 Side Panel 中填写 CLI 地址与口令。
8. 再次从云狐工程工具箱点击“为当前问题生成源码补丁”。
9. 在 Side Panel 查看 `app/pages/audit-lab.vue` 的 Diff。
10. 从云狐点击“确认写入当前补丁”。
11. 从云狐点击“运行 Typecheck / Test / Build”。
12. 必要时从云狐点击“回滚最近补丁”。

### 交互回归检查

- 单击：菜单展开/收起。
- 双击：触发审计。
- 右键：工程工具箱展开。
- 悬停：云狐打招呼并跟随指针。
- 拖拽：云狐改变位置但不会离开视口。
- 键盘：所有菜单按钮均可通过 Tab 和 Enter 操作。
- 窄屏：菜单不会产生页面级横向滚动。

## 质量检查

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm build:playground
```

## 生产打包

```bash
pnpm zip:extension
pnpm build:agent
```

扩展 ZIP 会生成在 WXT 的 `.output` 目录。Local Agent 构建输出位于：

```text
packages/local-agent/dist
```

## 常见问题

### 网页右下角没有显示 3D NOVA

确认目标是普通 `http://` 或 `https://` 页面，并在扩展安装或重载后刷新标签页。Chrome 内部页面和扩展商店页面不允许注入。

### Side Panel 提示无法连接页面

扩展安装或重载后，旧标签页没有自动获得最新 Content Script。刷新目标网页。

### 无法连接 Local Agent

确认：

- CLI 进程仍在运行。
- 地址使用 `ws://127.0.0.1:<port>`。
- Token 与终端输出一致。
- 没有在 `chrome://`、扩展商店等受限页面测试。

### 只显示候选文件，没有自动补丁

说明源码映射或修改规则不够可靠。给元素增加稳定的 `id`/`data-testid`，保留资源文件名，或手动查看候选文件。

## 代码注释规范

项目中的说明性代码注释统一使用“中文 / English”双语格式。注释应解释设计意图、边界条件或不明显的原因，不重复代码本身。

单行注释：

```ts
// 校验文件哈希，避免覆盖并发修改。 / Verify the file hash to avoid overwriting concurrent edits.
```

模板注释：

```vue
<!-- 浮空底座 / Floating platform -->
```

多行注释：

```ts
/**
 * 仅允许执行预定义的项目脚本。
 * Only predefined project scripts may be executed.
 */
```

新增或修改注释时必须同时更新两种语言，并保持含义一致。
## 动物功能协议检查

```bash
pnpm check:pet-actions
```

该命令确保 `NovaPetAction` 中的每项功能都同时出现在共享协议、网页内动物入口以及 Content Script 或 Side Panel 处理器中。`pnpm typecheck` 已自动包含此检查。

