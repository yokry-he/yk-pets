# NOVA Browser Agent v0.3.1 验证报告

## 版本目标

本版本集中处理宠物菜单交互：

- 点击宠物时，模式切换器、关闭按钮和当前按钮组同步显示或隐藏。
- 菜单重新打开时保留上一次使用的“功能 / 动作”模式。
- 动作按钮默认只显示图标，悬停或键盘聚焦时显示中文说明。
- 删除点击动作后额外出现的动作名称胶囊。
- 将“功能 / 动作”切换器下移并锚定在宠物上方。
- 审计思考气泡保持独立，不受菜单开关影响。

## 已执行检查

### 项目规则检查

以下脚本均通过：

```bash
node scripts/check-bilingual-content.mjs
node scripts/check-pet-actions.mjs
node scripts/check-nebula-overlay.mjs
node scripts/check-tail-design.mjs
node scripts/check-motion-controls.mjs
node scripts/check-notice-motion.mjs
node scripts/check-thought-bubble.mjs
node scripts/check-menu-interaction.mjs
```

其中菜单交互专项共验证 10 项：

1. 菜单统一由 `menuOpen` 控制。
2. 关闭菜单同步关闭工程工具。
3. 重新打开菜单时保留上一次模式。
4. 功能和动作按钮组互斥。
5. 动作按钮只显示图标。
6. 动作按钮具有中文悬停说明。
7. 动作名称胶囊已移除。
8. 切换器使用宠物区域的底部锚点。
9. 菜单关闭时存在防御性隐藏规则。
10. 动作按钮轨道距离已缩短。

### TypeScript 语法检查

使用 TypeScript `transpileModule` 对以下文件执行语法诊断，均通过：

- `NovaPetOverlay.vue`
- `AvatarCanvas.vue`
- `CloudFox.vue`
- `background.ts`
- `content.ts`

### Chrome 生产包检查

- `manifest.json` 可正常解析，版本为 `0.3.1`。
- `v031-menu-interaction.js` 位于 Content Script 列表最后。
- 所有生产 JavaScript 均通过 `node --check`。
- 运行时增强层只进行幂等属性更新和动作提示清理，没有高频自修改循环。
- 动作名称胶囊即使由旧兼容层短暂创建，也会被隐藏并立即移除。

## 构建边界

尝试通过锁文件离线恢复依赖时，npm registry 域名仍返回 `EAI_AGAIN`，因此无法从空依赖目录重新执行完整 WXT 构建。

本次交付包含两部分：

1. **完整 Vue/WXT 源码实现**：作为后续正式构建的源代码。
2. **可加载 Chrome 扩展包**：基于已验证的 v0.3.0 生产包，追加独立且幂等的 v0.3.1 运行时增强层。

由于当前容器无法稳定完成带扩展的 Chromium 图形运行测试，最终像素位置仍建议在本地 Chrome 中做一次人工确认。
