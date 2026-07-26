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

### 道具事件轨道

- 稳定道具 ID 与实例 ID；
- 创建、显示、挂载、分离、移动、隐藏、样式和销毁事件；
- 挂点与世界空间实例求值；
- 颜色、透明度、发光和粒子速率；
- 缺失依赖诊断与删除清理基础；
- 道具实例复用唯一正式 TresCanvas；
- 持物、抛出、接住和效果动作可确定性编排。

### 道具工坊实体编辑

- schema v2 参数化道具实体与旧元数据迁移；
- 球体、方块、圆柱、圆锥、圆环、胶囊、晶体、文字牌和粒子组件；
- 组件层级、局部变换、复制和递归删除；
- 颜色、透明度、金属度、粗糙度、发光色和发光强度；
- `origin`、`grip`、`display`、`emitter` 内部锚点；
- 48 组件、240 粒子和文字长度预算；
- 本地 JSON 导入导出和同一正式场景模型预览。

### 高级动画工具

- `smooth` 与数值切线 `bezier` 插值和曲线编辑器；
- 轻量语义洋葱皮与根节点运动轨迹；
- 左右镜像和姿态预设；
- `override`/`additive` 动作层、权重、启用状态和中断策略；
- 两段前爪 IK 辅助；
- 本地音调和限额本地音频轨道；
- ≤2 MB、GLB v2、无外部 URI 的安全本地 GLB 校验与同场景解析。

## 4. 明确尚未完成

- 道具事件的高级曲线插值；
- 浏览器截图基线；
- 真实 Chrome Side Panel、GPU 与 WebGL 人工验收。

## 5. 动作消费链路

`StudioMotionAssetV2 -> normalizeMotionAsset -> resolveMotionTime -> evaluateNormalizedMotionAsset -> EvaluatedCloudFoxPose -> CloudFoxStudioCanvas -> ProceduralPet -> ExtensionAlignedCloudFox -> 语义部件适配器`

每帧只求值一次。姿态保存为相对于基础外观挂点与比例的偏移，不得修改外观配方。

## 6. 下一阶段

下一阶段是 `browser-acceptance-and-release-hardening`：

1. 在真实浏览器验证时间轴、道具事件、道具实体和高级工具；
2. 验证 Chrome Side Panel、GPU/WebGL、深度排序、音频用户手势和复杂 GLB；
3. 建立浏览器截图基线和多分辨率回归；
4. 修复真实验收发现的问题并更新发布文档；
5. 未经用户明确要求仍不得合并 PR。

## 7. 仍需人工验收

- 真实浏览器中的 v1→v2 迁移、刷新恢复和回滚；
- 时间轴拖动、键盘操作和自定义动作保存恢复；
- 真实 Chrome Side Panel、GPU/WebGL、深度排序和最终像素。

## 8. 强制规则

每个修改 `apps/` 或 `packages/` 的功能提交必须在同一个提交更新 `.ai/project-state.json` 和至少一项交接上下文；`scripts/check-ai-handoff.mjs` 按提交强制检查。

可信度顺序：实际代码与运行结果 > 最新完整 CI > 机器状态 > ADR/交接 > PR > 旧聊天。

## 9. 动作直接操控批次

- 新增身体部件树和唯一控制注册表；
- 支持当前帧、已选关键帧、整段动作三种作用范围；
- 支持整只宠物和身体的移动、旋转、等比缩放及高级分轴缩放；
- 支持头、前后爪、耳朵、尾巴、触角、眼睛和嘴部的安全语义控制；
- 支持左右对称编辑、归零、数值步进、W/E/R/S/Q/K 快捷键和预览拖拽操控板；
- 整段动作使用独立 additive `clip-adjustment` 层，不修改原关键帧；
- 真正的模型射线拾取和三轴 3D Gizmo 仍需后续真实浏览器批次。
## 10. 动作工坊预览与中文化可用性批次

- 动作预览默认使用 72% 视图缩放，用户可在 40%–120% 范围连续调整；
- 支持在预览画布拖动进行俯仰/水平自由旋转，滚轮缩放，并可输入三轴角度或一键复位；
- 预览变换独立于动作资产，不会隐式创建关键帧；整只宠物的动作缩放与旋转仍由语义 Rig 控制；
- 右侧属性栏、动作层、曲线编辑器和道具事件表单禁止横向溢出并使用可收缩网格；
- 动作工坊主要可见标题、视角、插值、动作层和道具事件改为中文优先；
- 真实浏览器中的最终尺寸、拖动手感和系统滚动条仍需人工复验。
