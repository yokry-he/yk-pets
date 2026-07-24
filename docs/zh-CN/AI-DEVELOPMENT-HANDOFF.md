# AI 开发交接

## 1. 仓库与协作边界

- 仓库：`yokry-he/yk-pets`
- 唯一开发分支：`agent/cloud-fox-studio-v0610`
- PR：#7
- 目标分支：`agent/yk-pets-rebrand-v0610`
- 未经用户明确要求不得合并。
- 每个独立功能批次必须运行完整 CI，只有全绿后才能更新 PR。

开始新会话时必须从 GitHub 实时确认 HEAD、PR 和 CI。本文件不保存实时 SHA，避免历史信息冒充当前状态。

## 2. 当前产品架构

YK-PETS Studio 使用同一个产品壳和四个独立路由：

- `/studio/appearance`：外观工坊；
- `/studio/motion`：动作工坊；
- `/studio/props`：道具工坊；
- `/studio/library`：共享资产库。

`/studio` 只做兼容跳转。四个工作区共享本地会话中的外观、动作、道具、视角和背景选择，但各编辑器的撤销状态必须独立。

唯一正式云狐组合入口是：

`apps/playground/app/components/studio/ExtensionAlignedCloudFox.vue`

统一预览入口是：

`apps/playground/app/components/studio/CloudFoxStudioCanvas.vue`

动作领域合同位于框架无关包：

`packages/pet-core/src/motion/`

动作和道具工坊不得复制第二套宠物拓扑或长期运行的 WebGL 场景。

## 3. 已完成能力

### 外观工坊

- 独立头型和身体；
- 前爪、后腿与后爪完整配置；
- 真实身体表面肚皮；
- 真实头壳表面眼睛和口鼻挂点；
- 鼻子、五种嘴型、耳朵、尾巴、触角、颜色、发光、轨道和胸背标志；
- 唯一数值控制注册表；
- 撤销重做、自动草稿、本地方案、导入导出和扩展同步；
- 固定视觉审计页和数值几何回归。

### 统一 Studio 基础

- 顶层共享导航和上下文；
- 本地 StudioSession；
- 稳定动作和道具资产 ID；
- 共享资产库和上下文跳转；
- 唯一正式 Cloud Fox 渲染器和预览入口。

### 动作语义 Rig 与关键帧领域

- `cloud-fox-semantic-rig/v1` 稳定语义 Rig；
- 根节点、身体、头部、前后爪、耳朵、眼睛、嘴巴、尾巴和触角通道；
- 毫秒存储与独立 `displayFps` 显示网格；
- schema v2 动作、轨道和关键帧数据结构；
- 相对于基础外观挂点和尺寸的局部姿态偏移；
- 轨道合并、关键帧排序、范围裁剪和重复时间最后写入获胜；
- `step` 与 `linear` 基础插值；
- `once`、`loop` 和 `ping-pong` 时间映射；
- 无 UI、无 Vue、无 Three.js 的完整姿态求值器；
- 程序化关键帧插入 API 和确定性数值测试；
- `yk-pets:studio:assets:v1` 到 `yk-pets:studio:assets:v2` 的本地迁移；
- `appearanceId` 迁移为仅用于追溯的 `authoringAppearanceId`，不参与求值。

### 动作工坊当前界面

动作工坊可创建和选择资产、编辑中英文名称、毫秒总时长、FPS 显示网格、循环方式和道具依赖，并只读展示语义 Rig 分组。预览仍播放现有待机行为，不求值自定义轨道。

### 道具工坊基础

已完成组合/效果道具资产、默认挂载点、`origin`、`grip`、`display`、`emitter` 锚点、层级基础和动作工坊测试跳转。

## 4. 明确尚未完成

以下能力尚未实现，不得在 UI、文档、PR 或回复中宣称已经完成：

- 时间轴中的关键帧写入、移动、复制、删除和多选；
- 自动关键帧与手动定格；
- 播放指针、播放控制和时长缩放；
- 平滑、贝塞尔等高级插值与曲线编辑；
- 语义姿态到正式 Cloud Fox 组件的适配器；
- 自定义动作正式播放运行时；
- 与程序化呼吸、眨眼、视线和表情的最终混合规则；
- 道具事件轨道；
- 道具几何和材质编辑器；
- 抓握点和发射点操纵器；
- 浏览器截图基线；
- 真实 Chrome Side Panel、GPU 与 WebGL 人工验收。

领域层存在程序化关键帧插入函数，不代表用户已经可以在时间轴中写入关键帧。

## 5. 动作资产与消费链路

当前动作资产 schema 为 v2：

- `rigId`：固定为 `cloud-fox-semantic-rig/v1`；
- `durationMs`：唯一持久化时间单位；
- `displayFps`：仅用于界面显示与吸附；
- `authoringAppearanceId`：仅用于创作上下文，不形成外观绑定；
- `tracks`：按稳定语义通道保存；
- `keyframes`：保存整数毫秒、数值和出段插值。

后续正式消费链路必须是：

`StudioMotionAssetV2 -> normalizeMotionAsset -> resolveMotionTime -> evaluateNormalizedMotionAsset -> EvaluatedCloudFoxPose -> CloudFoxStudioCanvas -> ProceduralPet -> ExtensionAlignedCloudFox -> 各语义部件适配器`

每帧只求值一次。适配器读取外观挂点和比例换算实际局部变换，但不得修改外观配方。

## 6. 旧数据兼容

- 首选读取 `yk-pets:studio:assets:v2`；
- 没有 v2 时读取 v1，并在内存中规范化后写入 v2；
- v1 存储不会自动删除，保留回滚能力；
- 旧 ID、名称、时长、循环方式、道具依赖和时间戳保持不变；
- 空轨道动作求值为完整中性姿态；
- 三十个内置动作保持只读且运行时未修改。

## 7. 下一阶段

下一阶段是 `motion-timeline-authoring-and-preview-adapter`：

1. 建立独立的动作编辑草稿和撤销语义；
2. 添加播放指针和基础播放控制；
3. 添加、删除、复制和移动关键帧；
4. 使用现有规范化器处理冲突和越界；
5. 建立一次求值、多组件消费的正式姿态适配器；
6. 定义自定义姿态与待机呼吸、眨眼和视线的混合规则；
7. 完成刷新恢复和无道具自定义动作播放后，再进入道具事件轨道。

不得从复杂曲线编辑器或道具事件开始。

## 8. 安全与性能边界

不得新增：

- Chrome 权限；
- 网络上传；
- 后台持续轮询；
- 重复 WebSocket；
- 宿主网页持久配置 DOM；
- 第二套 Cloud Fox 渲染器；
- 第二个长期运行的 WebGL 场景。

## 9. AI 交接包更新规则

每次功能开发提交必须同时更新：

1. `.ai/project-state.json`；
2. 至少一项上下文文件：会话协议、视觉案例、交接文档、已知问题、路线图或相关 ADR。

该要求由 `scripts/check-ai-handoff.mjs` 按提交检查。功能代码与 AI 包不能拆成两个独立提交。

## 10. 可信度顺序

实际代码与运行结果 > 最新完整 CI > 机器状态文件 > ADR 与交接文档 > PR 描述 > 旧聊天记录。
