# NOVA Browser Agent v0.3.0 验证报告

## 本次范围

- 大矩形提示卡改为宠物头部附近的思考气泡。
- 思考气泡位于悬浮 UI 的最高层，可以覆盖环形按钮。
- 上一个、下一个、预览修复 / 撤销预览、完整报告移动到审计结果气泡。
- 功能环只保留页面审计和工程工具。
- 修复“打开右侧栏”无响应：Side Panel 打开操作先于异步存储执行。
- 右侧栏打开失败时，在宠物气泡中显示明确错误。

## 已通过检查

### 项目规则

- 宠物功能动作协议：11 项通过。
- 星云与透明层规则：8 项通过。
- 柔性尾巴规则：5 项通过。
- 动作控制与闲时轮播：13 项通过。
- 按需提示与动作重启：11 项通过。
- 思考气泡专项检查：8 项通过。
- 既有双语代码注释检查通过。

### 语法检查

使用 TypeScript `transpileModule` 检查：

- `NovaPetOverlay.vue` 的 `script setup`
- `background.ts`
- `content.ts`

均未发现语法错误。

Chrome 生产包：

- `background.js` 通过 `node --check`。
- `v030-thought-bubble.js` 通过 `node --check`。
- Manifest 版本与脚本引用断言通过。

### Side Panel 调用顺序

使用模拟 Chrome API 验证调用顺序：

```text
sidePanel.open → storage.local.set
```

确认打开面板的调用发生在异步存储之前，以保留用户点击手势。

## 构建边界

当前执行环境无法从 npm registry 恢复完整依赖，无法从空依赖目录重新运行 WXT 全量构建。

因此：

- 源码包包含完整 Vue / WXT 实现。
- 可加载 Chrome 包基于已验证的 v0.2.9 生产构建，替换为 v0.3.0 思考气泡运行时，并确定性修改后台 Side Panel 调用顺序。
- 已对修改后的生产 JavaScript、Manifest 和 ZIP 完整性进行检查。

本地安装后需要重新加载扩展并刷新目标网页，旧 Content Script 不会自动替换。
