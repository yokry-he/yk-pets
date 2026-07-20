# 构建、打包与发布手册

> 适用版本：`v0.6.10` 及后续兼容版本  
> 本文覆盖干净构建、Chrome 扩展打包、本地验收、商店发布和回滚。

## 1. 环境要求

- Node.js 22 或更高；
- pnpm 11.13.1，通过 Corepack 使用；
- Git；
- Chrome 稳定版；
- 可访问依赖源。

```bash
node --version
corepack pnpm --version
git --version
```

## 2. 版本同步

正式发布前同步：

1. 根目录 `package.json`；
2. `apps/extension/package.json`；
3. `apps/extension/wxt.config.ts` 中的 Manifest 版本；
4. `README.zh-CN.md`、`README.en.md` 和商店资料；
5. `docs/zh-CN/RELEASE-HISTORY.md` 与 `docs/en/RELEASE-HISTORY.md`；
6. 与本次功能相关的自动化回归。

Chrome Web Store 更新包的 Manifest 版本必须高于线上版本。

仓库不再为每个版本新增根级 `RELEASE-NOTES-vX.Y.Z.md` 或 `VALIDATION-vX.Y.Z.*.md`。面向用户的发布说明保存在 GitHub Release 或发布系统中，维护结论写入统一版本历史。

## 3. 干净构建

### 3.1 清理生成目录

macOS/Linux：

```bash
rm -rf node_modules
rm -rf apps/extension/.output apps/extension/.wxt
rm -rf apps/playground/.output apps/playground/.nuxt
rm -rf packages/local-agent/dist
```

Windows PowerShell：

```powershell
Remove-Item node_modules -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item apps/extension/.output, apps/extension/.wxt -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item apps/playground/.output, apps/playground/.nuxt -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item packages/local-agent/dist -Recurse -Force -ErrorAction SilentlyContinue
```

### 3.2 安装锁定依赖

```bash
corepack enable
pnpm install --frozen-lockfile
```

除非发布明确包含依赖更新，否则不要重建锁文件。

### 3.3 质量门禁

```bash
pnpm check:documentation
pnpm typecheck
pnpm test
pnpm test:network-domain
pnpm test:network-workbench
pnpm build:agent
pnpm build:playground
pnpm build:extension
pnpm zip:extension
```

任一命令失败都不应继续发布。

## 4. 构建输出

| 产物 | 路径 |
|---|---|
| Chrome 未打包目录 | `apps/extension/.output/chrome-mv3` |
| Chrome ZIP | `apps/extension/.output/novaextension-X.Y.Z-chrome.zip` |
| Local Agent | `packages/local-agent/dist` |
| Playground | `apps/playground/.output` |

Chrome Web Store 上传的是 WXT 生成的 Chrome ZIP，不是源码 ZIP。

## 5. 产物检查

### Manifest

```bash
cat apps/extension/.output/chrome-mv3/manifest.json
```

确认：

- `manifest_version` 为 3；
- 版本、名称和描述正确；
- 权限与本次功能一致；
- Side Panel 路径和图标存在；
- 没有意外增加高风险权限。

### ZIP 结构

```bash
unzip -l apps/extension/.output/*-chrome.zip
```

ZIP 顶层必须直接包含 `manifest.json`，不能多包一层目录。

### JavaScript 语法

```bash
find apps/extension/.output/chrome-mv3 -name '*.js' -print0 \
  | xargs -0 -n1 node --check
```

### 禁止内容

发布包不得包含：

- `node_modules`、`.git`、`.env`、私钥或测试凭据；
- 本地路径泄露的 Source Map；
- 运行时下载并执行的远程 JavaScript；
- 与扩展运行无关的源码归档或测试输出。

## 6. 本地验收

1. 打开 `chrome://extensions`；
2. 启用开发者模式；
3. 加载 `apps/extension/.output/chrome-mv3`；
4. 检查扩展页、Service Worker 和 Side Panel 是否报错；
5. 刷新普通 HTTP/HTTPS 测试页面；
6. 完成以下冒烟测试：
   - 宠物显示、拖拽、菜单、动作和音色；
   - 页面审计、范围选择、问题定位和预览撤销；
   - Network Lab 总开关、请求分类和性能图表；
   - 手动新增、从请求生成、编辑、复制、测试和删除规则；
   - Fetch/XHR Mock、延迟和完整 JSON 响应修改；
   - Local Agent 连接、确认、验证和回滚；
7. 重启浏览器，验证站点设置、规则和音色持久化。

## 7. 发布归档

建议在 GitHub Release 或发布系统中保留：

```text
nova-browser-agent-vX.Y.Z-chrome.zip
nova-browser-agent-vX.Y.Z-source.zip
SHA256SUMS.txt
面向用户的发布说明
```

macOS：

```bash
shasum -a 256 nova-browser-agent-vX.Y.Z-chrome.zip > SHA256SUMS.txt
```

Linux：

```bash
sha256sum nova-browser-agent-vX.Y.Z-chrome.zip > SHA256SUMS.txt
```

源码 ZIP 应排除 `node_modules`、`.output`、`.wxt`、`.nuxt`、`dist`、`.git`、`.env` 和系统临时文件。

## 8. Chrome Web Store 发布

1. 进入 Chrome Developer Dashboard；
2. 新建条目或打开现有条目；
3. 上传 WXT 生成的 Chrome ZIP；
4. 更新名称、说明、图标、截图和版本说明；
5. 核对单一用途、权限理由和数据处理声明；
6. 必要时填写测试说明；
7. 检查警告并提交审核；
8. 高风险版本优先使用延迟发布或小范围测试。

建议的单一用途描述：

> NOVA 是面向前端开发者的页面审计、网络性能分析和本地可控 Mock 调试工具，并通过可视化 3D 宠物提供快捷入口和状态反馈。

Mock 默认关闭，规则和设置保存在本地。

## 9. 回滚策略

Chrome Web Store 不能通过降低版本号回滚。出现严重问题时：

1. 从最近稳定 tag 创建修复分支；
2. 使用更高版本号修复；
3. 重新执行完整质量门禁；
4. 上传新的修复 ZIP；
5. 若问题版本仍在审核，取消该提交后重新上传；
6. 保留稳定 tag、Chrome ZIP、SHA-256、Manifest 和发布说明。

## 10. 常见问题

- **上传提示版本未提高**：同步修改 `wxt.config.ts` 中的 Manifest 版本并重新构建。
- **加载已解压时找不到 Manifest**：选择 `.output/chrome-mv3`，不要选择 `.output`。
- **ZIP 结构无效**：确认 ZIP 顶层直接包含 `manifest.json`。
- **新代码没有进入扩展**：删除 `.output/.wxt` 后重新构建，并重载扩展与目标页面。
- **权限警告增加**：对比新旧 Manifest，删除意外权限或补充准确的权限用途说明。
