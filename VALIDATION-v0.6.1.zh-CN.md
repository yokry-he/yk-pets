# NOVA Browser Agent v0.6.1 验证报告

## 1. 验证范围

本报告覆盖：

- 鼠标悬停不打断主动画；
- 动作优先级、单项队列与稳定过渡；
- 更高频的闲时动作调度；
- 好奇扫描、爪尖点点、触角聚能和尾光流动；
- 触角与头部的结构连接；
- 云朵午睡侧躺姿态；
- 既有宠物菜单、烟花、网络实验室和 Mock 工作台回归；
- Chrome MV3 生产构建与压缩包完整性。

## 2. 自动检查结果

### 完整工作区检查

执行：

```bash
pnpm typecheck
```

结果：通过。

包含：

- 中英双语文档和代码注释门禁；
- v0.6.1 动画、发光与午睡专项检查 15/15；
- v0.6.0 宠物生命力与网络详情检查 15/15；
- 动作控制与闲时调度检查 19 项；
- 菜单、分页、思考气泡和生活动作回归；
- 网络实验室回归 19/19；
- Mock 工作台与高能动作回归 19/19；
- Shared、Extension、Local Agent 和 Playground TypeScript 检查。

### 网络领域测试

```bash
pnpm test:network-domain
pnpm test:network-workbench
```

结果：分别通过 15 个和 18 个断言。

## 3. 干净构建

执行：

```bash
rm -rf apps/extension/.output apps/extension/.wxt
pnpm build:extension
pnpm zip:extension
```

结果：WXT 0.20.27 Chrome MV3 构建和 ZIP 打包通过。

Manifest 版本：`0.6.1`。

Chrome 扩展包 SHA-256：

```text
d18364ab63fb9c40ecc2d922c7fc476bf5dd380dd543b54807cafe1f744fcf2f
```

## 4. 生产产物检查

- 所有生产 JavaScript 通过 `node --check`；
- 生产 Content Script 包含 `curious-scan`、`paw-tap`、`antenna-charge`、`tail-glow` 和 `cloud-nap`；
- Chrome ZIP 通过 `unzip -t`；
- v0.6.0 → v0.6.1 补丁通过 `patch --dry-run -p1`。

## 5. 未自动完成的视觉验收

当前容器没有可靠的扩展真实网页视觉回归环境，因此以下项目需安装后人工确认：

1. 触角根部在不同页面缩放下是否完全贴合头部；
2. 云朵午睡旋转后身体是否自然落在云朵中心；
3. 触角聚能和尾光流动的强光是否在浅色页面上过亮；
4. 连续触发动作时 260ms 稳定阶段是否符合实际观感。
