# NOVA Browser Agent v0.4.1 验证报告

## 构建范围

- 构建基线：v0.4.0 Vue/TresJS 源码。
- 构建方式：删除旧 `.output`、`.wxt` 后执行 WXT Chrome MV3 生产构建。
- 未使用旧生产包运行时叠加脚本。

## 源码检查

通过以下检查：

- 双语文档与代码注释检查。
- 宠物动作协议检查，共 11 项。
- 星云、柔性尾巴、动作控制和闲时轮播检查。
- 思考气泡与菜单交互检查。
- 极简菜单、六槽位注册表和分页检查。
- v0.4.0 生活动作回归检查，共 14 项。
- v0.4.1 前爪与道具对齐专项检查，共 13 项。
- `@nova/shared` TypeScript 检查。
- WXT 类型生成。
- Vue `vue-tsc --noEmit` 检查。

## v0.4.1 专项结果

- 前爪基础位置上移到胸口两侧。
- 左右前爪锚点存在并参与球的位置计算。
- 嘴部锚点存在并参与饭盆居中计算。
- 玩球时长为 8.4 秒。
- 伸懒腰时长为 5.4 秒。
- 伸懒腰联动头胸、四肢、尾巴和动态阴影。
- 根包、扩展包和 Manifest 版本统一为 `0.4.1`。

## WXT 干净构建

执行结果：成功。

```text
WXT 0.20.27
Building chrome-mv3 for production with Vite 8.1.4
Built extension in 2.571 s
Total size: 1.13 MB
```

输出包含：

- `manifest.json`
- `background.js`
- `content-scripts/content.js`
- `content-scripts/content.css`
- Side Panel JavaScript 与 CSS
- 16、32、48、128 像素图标

## 生产包检查

- Manifest 可解析，版本为 `0.4.1`。
- 所有生产 JavaScript 通过 `node --check`。
- 编译后的 Content Script 包含 `玩球`、`吃饭`、`伸懒腰`、`8400`、`5400`、前爪锚点和嘴部锚点标记。
- WXT ZIP 完整性检查通过，无压缩数据错误。
- 生成包 SHA-256：`061f608aa1c7d786d7c8067192716fe8a17c97da0c81d7c80fa1437c178a9638`。

## 验证边界

容器中的无头 Chromium 在加载扩展并截图时未正常退出，因此本报告不把容器截图作为视觉验收依据。前爪高度、饭盆视觉间距和伸懒腰幅度仍建议在实际 Chrome 页面中进行一次人工视觉确认。
