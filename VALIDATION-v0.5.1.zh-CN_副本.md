# NOVA Browser Agent v0.5.1 验证报告

验证日期：2026-07-18

## 验证范围

- Side Panel 全页 Mock 规则工作台。
- 手动创建尚不存在的接口。
- 从请求生成、编辑、复制、删除、启停和测试规则。
- Query 匹配、JSON 专注编辑、草稿恢复与冲突检测。
- Fetch/XHR 完整 Mock 的前置短路逻辑。
- 空翻落地、甩尾旋风、飞扑接球和能量爆发。
- 高能动作低概率闲置调度与减少动态效果降级。
- 动作菜单分页指示点位置。
- Chrome MV3 干净源码构建。

## 自动检查结果

### TypeScript 与 Vue

执行：

```bash
corepack pnpm typecheck
```

结果：通过。

覆盖：

- `@nova/shared` TypeScript
- Local Agent TypeScript
- Nuxt Playground TypeScript
- WXT 类型生成
- Vue `vue-tsc --noEmit`
- 既有宠物、菜单、思考气泡和网络实验室回归检查
- v0.5.1 Mock 工作台与高能动作专项检查

### 网络领域测试

```bash
corepack pnpm test:network-domain
corepack pnpm test:network-workbench
```

结果：

- v0.5.0 网络领域测试：15 个断言通过。
- v0.5.1 工作台测试：18 个断言通过。

测试包括：

- 手动规则工厂。
- 从捕获请求生成规则。
- 复制后生成新 ID、默认停用。
- Origin、方法、Glob 和 Query 匹配。
- 精确规则优先于宽泛规则。
- 同级规则冲突识别。

### 专项静态检查

结果：19/19 通过。

覆盖：

- Side Panel 全页编辑器。
- 新增不存在接口。
- 从请求预填。
- 编辑、复制、删除和启停。
- JSON 专注编辑和草稿恢复。
- 测试与冲突检测。
- 不存在接口命中 Mock 时在 `originalFetch` 前返回。
- 四个高能动作及减少动态效果降级。
- 分页点固定在阴影下方。
- 项目版本统一为 `0.5.1`。

## 构建结果

执行：

```bash
rm -rf apps/extension/.output apps/extension/.wxt
corepack pnpm build:extension
corepack pnpm zip:extension
```

结果：通过。

WXT：`0.20.27`  
目标：Chrome Manifest V3  
产物：`apps/extension/.output/novaextension-0.5.1-chrome.zip`

构建产物包含：

- Background Service Worker
- Side Panel
- 页面 Content Script
- Network Bridge（隔离世界）
- Network Main（页面 MAIN world）

Manifest 版本：`0.5.1`

## 产物检查

- 所有生产 JavaScript：`node --check` 通过。
- Chrome ZIP：`unzip -t` 通过。
- Manifest 权限与 Content Script 入口检查通过。
- 生产包中确认存在规则新增、复制、专注编辑及四个高能动作标记。

Chrome ZIP SHA-256：

```text
fab8156dc1f832d713b5cfb0b047461ec2faec46bfcad7550329eb855c085085
```

## 浏览器端验证边界

容器内无头 Chromium 在访问本地测试页面时未能正常完成加载并超时，因此没有把真实浏览器端到端测试标记为通过。Mock 核心领域逻辑、源码顺序约束、Vue 类型、生产构建、JavaScript 语法和 ZIP 完整性均已验证。

安装后建议人工验收：

1. 手动新增 `/api/nonexistent` 的 GET Mock。
2. 开启当前网站总开关，并从页面调用该地址。
3. 确认返回 Mock 数据且 Network 中没有真实服务成功响应。
4. 从已捕获请求生成规则并修改 JSON。
5. 复制规则，确认副本默认停用。
6. 分别播放四个高能动作并检查分页点位置。
