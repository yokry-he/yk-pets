# 安全设计与威胁模型

## 1. 信任边界

```text
不可信网页
   │ Content Script 隔离世界
浏览器扩展
   │ 口令认证 WebSocket
本地 Agent
   │ 根目录路径限制
本地项目源码
```

网页内容、DOM 属性和审计证据都视为不可信输入。

## 2. 浏览器侧

- Manifest V3，不执行远程 JavaScript。
- Side Panel CSP 只允许自身脚本与本机 WebSocket。
- 网页入口使用 Shadow DOM，减少 CSS 污染。
- 高亮层不接收鼠标事件。
- 临时预览只支持受约束的属性或样式字典。
- 不调用 `eval`、`new Function`，不执行网页提供的代码。

当前 MVP 使用 `http://*/*` 与 `https://*/*` Host Permission，目的是让解压加载版本无需逐站配置即可审计。正式商店版本应改为：

1. 默认 `activeTab`。
2. 用户点击后使用 `chrome.scripting` 按需注入。
3. 仅对用户选择的站点申请持久权限。

## 3. WebSocket

- 默认只绑定 `127.0.0.1`，不监听局域网地址。
- 首条消息必须是 `hello`。
- 连接口令由加密随机数生成，保存在 `.nova/agent.json`，文件模式为 `0600`。
- Token 使用恒定时间比较。
- 默认允许 Chrome/Firefox 扩展 Origin 与 localhost 开发 Origin。
- 浏览器端 CSP 仅允许连接 localhost/127.0.0.1。

## 4. 文件安全

- 项目根目录启动时使用 `realpath` 固化。
- 所有文件路径由 Agent 内部候选搜索生成。
- 写入前再次 `resolve` 并检查不能逃逸项目根目录。
- 排除依赖、构建产物、Git 和缓存目录。
- 生成补丁后保存原文件 SHA-256。
- 应用前哈希不一致则拒绝覆盖。
- 回滚前补丁后哈希不一致则拒绝覆盖。

## 5. 命令安全

只允许：

```text
typecheck
test
build
```

- 命令名不由网页或大模型生成。
- 使用 `spawn(command, args, { shell: false })`。
- 限时 120 秒。
- 限制输出体积。
- 不支持自定义参数、管道、重定向、环境变量覆盖。

## 6. 自动补丁限制

- 自动补丁采用确定性规则，不将网页 HTML 直接作为代码执行。
- 可访问名称和 alt 文本只是建议，应用后仍需人工确认语义。
- 低置信度映射不提供“确认写入”按钮。
- 每次写入必须在 Side Panel 中展示 Diff 并由用户点击确认。

## 7. 后续加强

- 将 Token 改为一次性配对码和短期会话密钥。
- 增加扩展 ID 白名单。
- 对 WebSocket 消息增加大小、频率限制。
- 将补丁生成移入 Git Worktree。
- 增加签名审计日志。
- 正式版使用 Native Messaging 取代本机端口。
## 8. 动物交互权限边界

- 网页中的 3D 云狐只能发出 `NovaPetAction` 白名单内的有限动作。
- 审计、问题导航和临时预览在 Content Script 中使用确定性处理。
- 源码相关动作必须经 Background 打开 Side Panel，再由经过认证的 Local Agent 执行。
- “写入补丁”仍要求存在可应用 Diff、文件哈希一致并保留备份；动物交互不会绕过这些检查。
- 动物不能传入 Shell 字符串、任意文件路径、远程脚本或未经 Schema 定义的参数。
- `pnpm check:pet-actions` 验证所有公开动作同时存在于协议、动物入口和对应处理器中。

