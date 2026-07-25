# AI 开发交接

## 1. 协作边界

- 仓库：`yokry-he/yk-pets`
- 唯一开发分支：`agent/cloud-fox-studio-v0610`
- PR：#7，目标分支 `agent/yk-pets-rebrand-v0610`
- 未经用户明确要求不得合并；每个独立功能批次完整 CI 全绿后才能更新 PR。
- 新会话必须从 GitHub 实时确认 HEAD、PR 和 CI，本文件不保存实时 SHA。

## 2. 唯一架构入口

- 唯一正式云狐组合：`apps/playground/app/components/studio/ExtensionAlignedCloudFox.vue`
- 统一预览：`apps/playground/app/components/studio/CloudFoxStudioCanvas.vue`
- 框架无关动作领域：`packages/pet-core/src/motion/`
- Studio 路由：`/studio/appearance`、`/studio/motion`、`/studio/props`、`/studio/library`

不得复制第二套宠物拓扑或创建第二个长期运行的 WebGL 场景。

## 3. 已完成能力

### 外观和统一 Studio

完整外观工坊、共享导航、本地 StudioSession、稳定动作/道具 ID、共享资产库和唯一正式渲染器均已完成。

### 动作语义 Rig 与关键帧领域

- `cloud-fox-semantic-rig/v1`；
- 毫秒时间与 FPS 显示网格；
- schema v2 动作、轨道、关键帧和 v1→v2 迁移；
- 范围裁剪、轨道合并、重复时间最后写入获胜；
- `step`/`linear`、`once`/`loop`/`ping-pong`；
- 无 UI 的确定性姿态求值器。

### 时间轴编辑与正式预览

- 独立动作草稿、撤销/重做、脏状态和保存；
- 播放指针、播放/暂停/停止和循环模式；
- 时间轴关键帧写入、删除、复制、粘贴、移动和多选；
- FPS 吸附与精确毫秒输入；
- 根节点、身体、头部、前后爪、耳朵、眼睛、嘴部、尾巴和触角的语义姿态编辑；
- 每帧一次 `EvaluatedCloudFoxPose` 求值；
- 姿态沿唯一正式预览链路传递并由薄语义适配器消费；
- 未写入通道保留呼吸、眨眼、视线和既有表情；
- 三十个内置动作运行时未修改。

## 4. 明确尚未完成

- 道具事件轨道和运行时实例；
- 道具几何、材质、层级和锚点实体编辑；
- 平滑/贝塞尔插值、曲线编辑器、洋葱皮和运动轨迹；
- 镜像、姿态预设、动作分层、中断策略、IK 和音效轨道；
- 安全本地 GLB 导入；
- 浏览器截图基线；
- 真实 Chrome Side Panel、GPU 与 WebGL 人工验收。

## 5. 动作消费链路

`StudioMotionAssetV2 -> normalizeMotionAsset -> resolveMotionTime -> evaluateNormalizedMotionAsset -> EvaluatedCloudFoxPose -> CloudFoxStudioCanvas -> ProceduralPet -> ExtensionAlignedCloudFox -> 语义部件适配器`

每帧只求值一次。姿态保存为相对于基础外观挂点与比例的偏移，不得修改外观配方。

## 6. 下一阶段

下一阶段是 `motion-prop-event-tracks`：

1. 定义稳定道具事件轨道；
2. 支持创建、显示、挂载、分离、移动、隐藏和销毁；
3. 在宠物挂点与世界坐标之间转换；
4. 在同一个 TresCanvas 中求值并渲染确定性道具实例；
5. 处理缺失依赖、删除清理和资源预算；
6. 完成持物、抛出、接住和效果道具动作。

## 7. 仍需人工验收

- 真实浏览器中的 v1→v2 迁移、刷新恢复和回滚；
- 时间轴拖动、键盘操作和自定义动作保存恢复；
- 真实 Chrome Side Panel、GPU/WebGL、深度排序和最终像素。

## 8. 强制规则

每个修改 `apps/` 或 `packages/` 的功能提交必须在同一个提交更新 `.ai/project-state.json` 和至少一项交接上下文；`scripts/check-ai-handoff.mjs` 按提交强制检查。

可信度顺序：实际代码与运行结果 > 最新完整 CI > 机器状态 > ADR/交接 > PR > 旧聊天。
