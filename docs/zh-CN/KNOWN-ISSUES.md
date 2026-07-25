# 已知问题与未完成边界

## MOTION-001：时间轴基础编辑已完成，浏览器交互仍需人工验收

- 状态：Implemented; manual acceptance required
- 已完成：独立草稿、撤销重做、播放指针、关键帧写入/删除/复制/粘贴/移动/多选、FPS 吸附与保存。
- 未人工确认：真实浏览器中的拖动、键盘快捷键、窄屏布局和刷新恢复。

## MOTION-002：自定义动作正式预览已接入

- 状态：Implemented; manual WebGL acceptance required
- 已完成：每帧一次求值，姿态通过唯一正式 Cloud Fox 渲染器消费，未写入通道保留程序化行为。
- 未人工确认：真实 GPU/WebGL 深度排序、不同外观组合和最终像素。

## MOTION-003：高级动画工具已实现，真实浏览器/音频/WebGL 验收待完成

- 状态：Implemented; manual acceptance required
- 已完成：平滑/贝塞尔、曲线编辑器、轻量洋葱皮/轨迹、镜像/预设、分层/中断、IK、本地音效和安全 GLB 策略。
- 未人工确认：浏览器音频用户手势、复杂曲线拖动、真实 GPU 辅助标记和复杂 GLB。

## MOTION-004：旧动作存储迁移需要浏览器人工验证

- 状态：Manual acceptance required
- 自动覆盖：v1 数据迁移到 `yk-pets:studio:assets:v2`，保留 ID、名称、时长、循环、道具依赖和时间戳。
- 约束：v1 存储不会自动删除，真实浏览器迁移、刷新和回滚尚未人工确认。

## PROP-001：道具实体编辑已实现，浏览器/WebGL 验收待完成

- 状态：Implemented; manual acceptance required
- 已完成：schema v2、九类参数化组件、层级/局部变换、材质、四个内部锚点、复制、JSON 导入导出和资源预算。
- 未人工确认：真实 GPU 深度排序、复杂层级、不同设备性能和文字牌最终像素。

## PROP-002：道具事件轨道已实现，真实 WebGL 验收待完成

- 状态：Implemented; manual acceptance required
- 已完成完整事件生命周期、挂点/世界空间、样式/粒子、缺失依赖诊断和同场景实例预览。
- 未人工确认真实 GPU 深度排序、复杂抛物线和大量粒子性能。

## VISUAL-001：真实浏览器像素验收未完成

- 状态：Manual acceptance required
- 自动覆盖：数值几何、语义姿态链路和唯一渲染器门禁。
- 未覆盖：真实 Chrome Side Panel、GPU/WebGL、网页背景和最终像素。

## TEST-001：仓库尚无浏览器截图基线

- 状态：Open
- 不得把静态门禁和数值测试描述为真实截图已经通过。

## HANDOFF-001：功能提交必须同步 AI 包

- 状态：Enforced
- 修改 `apps/` 或 `packages/` 的功能提交必须同步更新 `.ai/project-state.json` 和至少一项交接上下文。
- 门禁：`scripts/check-ai-handoff.mjs`。
