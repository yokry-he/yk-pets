# 构建、打包与发布手册

> 适用版本：v0.5.2 及以上  
> 最近核对：2026-07-18  
> 本文覆盖本地构建、可加载包、Chrome Web Store 手动发布、分阶段发布、回滚和自动化发布。

## 1. 发布产物

一次正式发布应生成：

```text
nova-browser-agent-vX.Y.Z-chrome.zip
nova-browser-agent-vX.Y.Z-source.zip
nova-browser-agent-vX.Y.Z.patch
SHA256SUMS.txt
RELEASE-NOTES-vX.Y.Z.md
```

其中 Chrome Web Store 上传的是 WXT 生成的 Chrome ZIP，而不是源码 ZIP。

## 2. 环境要求

- Node.js 22 或更高；
- pnpm 11.13.1，使用 Corepack；
- Git；
- Chrome 稳定版；
- macOS、Linux 或 Windows；
- 可访问依赖源。

检查版本：

```bash
node --version
corepack pnpm --version
git --version
```

## 3. 发布前版本同步

必须同步以下版本：

1. 根目录 `package.json`；
2. `apps/extension/package.json`；
3. `apps/extension/wxt.config.ts` 中 Manifest 版本；
4. README 和发布说明中的版本；
5. 新增版本验证脚本或验证报告。

Chrome Web Store 更新包的 Manifest 版本必须高于线上版本，否则上传会失败。

建议使用语义化版本：

- Patch：修复和文档；
- Minor：兼容的新功能；
- Major：不兼容变化或重大权限变化。

## 4. 干净构建

### 4.1 清理

```bash
rm -rf node_modules
rm -rf apps/extension/.output apps/extension/.wxt
rm -rf packages/local-agent/dist
```

Windows PowerShell：

```powershell
Remove-Item node_modules -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item apps/extension/.output, apps/extension/.wxt -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item packages/local-agent/dist -Recurse -Force -ErrorAction SilentlyContinue
```

### 4.2 锁定依赖安装

```bash
corepack enable
pnpm install --frozen-lockfile
```

不要在正式发布前删除或重建锁文件，除非本次发布明确包含依赖更新。

### 4.3 质量门禁

```bash
pnpm typecheck
pnpm test
pnpm test:network-domain
pnpm test:network-workbench
pnpm build:agent
pnpm build:extension
pnpm zip:extension
```

任一命令失败都不应继续发布。

## 5. 构建输出

Chrome 未打包目录：

```text
apps/extension/.output/chrome-mv3
```

WXT ZIP：

```text
apps/extension/.output/novaextension-X.Y.Z-chrome.zip
```

Local Agent：

```text
packages/local-agent/dist
```

## 6. 产物检查

### 6.1 Manifest

```bash
cat apps/extension/.output/chrome-mv3/manifest.json
```

确认：

- `manifest_version` 为 3；
- 版本正确；
- 名称和描述正确；
- 权限与本次功能一致；
- Side Panel 路径存在；
- 没有无意增加高风险权限。

### 6.2 ZIP 结构

```bash
unzip -l apps/extension/.output/*-chrome.zip
```

ZIP 顶层必须直接包含 `manifest.json`，不能多包一层目录。

### 6.3 JavaScript 语法

```bash
find apps/extension/.output/chrome-mv3 -name '*.js' -print0 \
  | xargs -0 -n1 node --check
```

### 6.4 禁止内容

发布包中不得包含：

- `node_modules`；
- `.git`；
- 测试凭据；
- `.env`；
- 私钥；
- 源码映射中泄露的本地路径；
- 运行时下载执行的远程 JavaScript。

Chrome Web Store 要求扩展逻辑包含在扩展包中，不应运行时拉取并执行远程代码。

## 7. 本地验收

1. 打开 `chrome://extensions`。
2. 移除或停用旧开发版本。
3. 加载 `apps/extension/.output/chrome-mv3`。
4. 检查扩展页是否显示错误。
5. 刷新普通测试页面。
6. 完成以下冒烟测试：
   - 宠物显示与拖拽；
   - 菜单三模式；
   - 审计和问题定位；
   - Side Panel 打开；
   - 网站总开关；
   - 不存在接口完整 Mock；
   - 从请求生成 Mock；
   - 复制规则默认关闭；
   - 真实响应修改；
   - 性能图表；
   - Local Agent 连接；
   - 四个高能动作。
7. 关闭并重新打开浏览器，验证持久化和默认关闭状态。

## 8. 生成正式文件

示例：

```bash
VERSION=0.5.2
cp apps/extension/.output/novaextension-${VERSION}-chrome.zip \
  nova-browser-agent-v${VERSION}-chrome.zip

sha256sum nova-browser-agent-v${VERSION}-chrome.zip > SHA256SUMS.txt
```

macOS 可使用：

```bash
shasum -a 256 nova-browser-agent-v${VERSION}-chrome.zip > SHA256SUMS.txt
```

源码 ZIP 应排除：

```text
node_modules
.output
.wxt
dist
.git
.DS_Store
.env
```

## 9. Chrome Web Store 首次发布

官方手动流程：

1. 注册并配置 Chrome Web Store 开发者账户。
2. 进入 Chrome Developer Dashboard。
3. 点击 **Add new item**。
4. 选择 WXT 生成的 Chrome ZIP 并上传。
5. 完成 Store Listing：名称、简短说明、详细说明、图标和截图。
6. 完成 Privacy：单一用途、权限理由、数据处理声明。
7. 完成 Distribution：公开范围、国家/地区和可见性。
8. 必要时填写 Test instructions 和测试账号。
9. 检查所有警告。
10. 提交审核。

官方说明：

- https://developer.chrome.com/docs/webstore/publish/
- https://developer.chrome.com/docs/extensions/how-to/distribute

Chrome Web Store 上传 ZIP 最大支持 2 GB，但本项目发布包应远小于此限制。

## 10. 商店资料建议

### 单一用途

建议明确描述：

> NOVA 是面向前端开发者的页面审计、网络性能分析和本地可控 Mock 调试工具，并通过可视化 3D 宠物提供快捷入口和状态反馈。

避免把产品描述成无限用途的通用代理。

### 权限说明

| 权限 | 用途 |
|---|---|
| `activeTab` | 针对用户当前页面执行操作 |
| `scripting` | 注入必要的页面交互与网络桥接 |
| `storage` | 保存网站设置、规则和草稿 |
| `sidePanel` | 提供持续可见的调试工作台 |
| `http://*/*`, `https://*/*` | 在用户访问的普通网站中运行审计和网络能力 |

发布说明中要强调默认关闭 Mock，且数据只保存在本地。

## 11. 更新版本发布

1. 提高 Manifest 版本。
2. 运行完整干净构建。
3. 在 Developer Dashboard 选择现有条目。
4. 上传新 ZIP。
5. 更新发布说明和必要的商店内容。
6. 重新检查 Privacy/权限声明。
7. 提交审核。

可以使用延迟发布：先完成审核，批准后在准备好的时间手动发布。官方当前说明是已批准的延迟发布版本需要在有效期内发布，否则会回到草稿。

## 12. Beta 与分阶段发布

建议流程：

1. 内部开发者加载未打包版本；
2. 小范围测试者使用私有/非公开测试条目；
3. 提交审核时选择延迟发布；
4. 审核通过后在预定时间发布；
5. 观察错误、用户反馈和网络实验室规则兼容性；
6. 再扩大范围。

官方 MV3 分阶段发布建议：

- https://developer.chrome.com/docs/extensions/develop/migrate/publish-mv3

## 13. 自动化发布 API

Chrome Web Store API v2 支持上传和发布现有条目。基本步骤：

1. 创建 OAuth 或服务账号授权；
2. 保存 Publisher ID 和 Extension ID；
3. 使用访问令牌上传 ZIP；
4. 调用 publish 提交审核/发布；
5. 在 CI 中检查返回状态。

官方 API：

- https://developer.chrome.com/docs/webstore/using-api
- https://developer.chrome.com/docs/webstore/api/reference/rest/v2/publishers.items/publish

CI 中的 Token 和服务账号凭据必须放在加密 Secret 中，不能提交到仓库。

## 14. 回滚策略

Chrome Web Store 不能依赖“降低版本号”完成回滚。推荐：

1. 保留最近稳定版本源码和产物；
2. 基于稳定版本创建更高版本号的修复版本；
3. 立即重新构建和提交；
4. 若新版本仍在审核，可取消当前提交并上传修复包；
5. 对高风险网络功能提供远端不可执行代码的本地功能开关或默认关闭策略。

本项目发布归档至少保留：

- 源码 commit/tag；
- Chrome ZIP；
- SHA-256；
- 发布说明；
- Manifest；
- 验证报告。

## 15. 发布检查清单

### 代码

- [ ] 版本三处一致
- [ ] 锁文件未意外变化
- [ ] 所有检查通过
- [ ] 无调试日志或测试 Token
- [ ] 默认 Mock 总开关关闭
- [ ] 新权限有文档和隐私说明

### 包

- [ ] ZIP 顶层包含 Manifest
- [ ] 所有 JS 语法通过
- [ ] 未包含源码密钥和依赖目录
- [ ] SHA-256 已生成
- [ ] 本地未打包安装通过

### 功能

- [ ] 宠物、菜单和动作通过
- [ ] 页面审计通过
- [ ] 手动新增不存在接口 Mock 通过
- [ ] 请求生成 Mock 通过
- [ ] 复制和冲突检查通过
- [ ] 性能图表通过
- [ ] 总开关关闭后真实请求恢复
- [ ] Local Agent 写入必须二次确认

### 商店

- [ ] Listing 内容更新
- [ ] 截图和图标符合当前 UI
- [ ] Privacy 声明准确
- [ ] Test instructions 可执行
- [ ] 发布策略已确认

## 16. 常见打包问题

### 上传提示版本未提高

同步修改 `wxt.config.ts` 的 Manifest 版本并重新构建。

### 加载已解压时找不到 Manifest

选择 `.output/chrome-mv3`，不要选择 `.output`。

### ZIP 上传后结构无效

检查 ZIP 是否多了一层目录。

### 新代码没有出现在扩展中

删除 `.output/.wxt`，重新构建，并在 `chrome://extensions` 重载扩展与刷新目标页面。

### 商店权限警告增加

对比新旧 Manifest，确认没有由依赖或配置误加入权限。必要时减少 host 权限范围或补充清晰用途说明。
