# 双足与多骨骼链混合 IK 设计

## 1. 目标

在不要求用户理解骨骼、绑定或蒙皮的前提下，提高站内生成角色的足底稳定性和动作可信度，并为人类、四足动物、机甲及其他多关节体型保留统一扩展路径。

本设计采用混合求解架构：标准双足腿链优先使用解析式 Two Bone IK；非标准、多段或未来体型使用受约束 FABRIK。用户不选择算法，运行时依据 Rig Profile 和已编译骨骼结构自动选择安全求解器。

## 2. 当前问题与根因

当前复杂模型已经可以把语义动作编译为 Quaternion Clip 并写入真实 Three Bone，但仍属于纯 FK 播放：

- 足部接触元数据只随采样结果输出，没有约束真实足底；
- 根节点上下或水平运动会使支撑脚滑动；
- 双腿长度、角色比例和动作幅度变化后，原关键帧不能自动恢复足底位置；
- 当前编辑器中的“前爪 IK 辅助”只在写关键帧时计算二维角度，不是复杂模型运行时约束；
- `biped-pet/v1` 的腿链包含大腿、膝、腿肚、脚踝和脚部，未来四足与机甲的链长还会不同。

因此只增加更多动作关键帧不能解决根因。需要在 FK 之后增加由 Profile、接触状态和真实骨骼尺寸驱动的运行时约束层。

## 3. 方案比较与结论

### 3.1 解析式 Two Bone IK

将标准腿抽象为 Root、Mid、Tip 和弯曲 Hint，直接求解两个有效段。它计算固定、无迭代收敛问题，适合双足腿和手臂。Unity 官方 Animation Rigging 也采用 Root/Mid/Tip、Target、Hint 和独立权重的约束模型。

不足是不能自然覆盖任意长度链，需要 Profile 明确声明如何把实际多骨骼结构折叠为两个有效段。

### 3.2 受约束 FABRIK

FABRIK 通过前向、后向迭代调整关节点位置，适合四足、多段机械臂、尾巴和不规则链。它比为每种链手写解析解更容易扩展。

不足是必须明确迭代上限、收敛阈值、弯曲平面、关节限制和不可达目标策略，否则可能抖动、翻膝或产生不稳定结果。

### 3.3 编译阶段烘焙

只在动作编译阶段修正关键帧，运行成本最低，但无法适应运行时比例变化、预览 Root Motion、动作混合和动态地面，因此不采用。

### 3.4 决策

采用“统一约束契约 + 双足解析求解 + 通用 FABRIK 后备”的混合方案：

- `biped-pet/v1` 标准左右腿默认走解析式 Two Bone IK；
- Profile 无法形成合法两段链时，允许走受约束 FABRIK；
- 后续 `humanoid/v1` 可复用双足解析求解；
- `quadruped/v1`、多段 `mech/v1` 及非标准附属链优先使用 FABRIK；
- 求解失败只回退当前肢体的 FK，不阻塞整个角色。

参考依据：[Unity Two Bone IK](https://docs.unity3d.com/Packages/com.unity.animation.rigging@1.2/manual/constraints/TwoBoneIKConstraint.html)、[FABRIK 原论文](https://andreasaristidou.com/publications/papers/FABRIK.pdf)、[Three.js SkinnedMesh](https://threejs.org/docs/pages/SkinnedMesh.html)。

## 4. 架构边界

### 4.1 框架无关领域层

`packages/pet-core` 增加版本化 IK 约束与纯数值求解：

- `CharacterLimbIkDefinition`：稳定声明肢体 ID、算法偏好、关节链、接触点、弯曲轴、最大拉伸和修正权重；Profile 以 `limbIk?: readonly CharacterLimbIkDefinition[]` 增量承载，旧对象不提供该字段时保持纯 FK；
- `solveAnalyticTwoBoneIk`：输入世界空间关节点、目标、Hint 和限制，输出有限、确定性的目标关节点；
- `solveConstrainedFabrik`：输入任意长度链、目标、弯曲平面和迭代预算，输出收敛状态、误差与目标关节点；
- 求解器只处理数值数组，不依赖 Vue、Pinia、TresJS 或 Three.js。

`CharacterLimbIkDefinition` 固定包含 `id`、`solver: 'analytic-two-bone' | 'fabrik' | 'auto'`、`boneIds`、`contactId`、`poleAxis`、`maxStretchRatio`、`maxCorrectionRadians` 和 `weight`。解析式链要求至少三个按父子路径排列的语义关节点；FABRIK 要求至少三个实际链节点；`auto` 先验证解析映射，失败时才使用完整链 FABRIK。Profile 校验必须拒绝重复肢体 ID、未知骨骼/接触引用、断裂路径、短于要求的链、非有限限制和非法权重。`biped-pet/v1` 新增左右腿约束定义，但现有 Profile ID 不变，以可选字段保持已有持久化数据兼容。

### 4.2 Three 运行时约束层

`apps/playground/app/three` 增加混合 IK 控制器，挂在现有复杂动作控制器之后：

1. 先恢复绑定姿态并应用 Quaternion FK；
2. 更新骨骼世界矩阵；
3. 读取当前样本的活动接触和置信度；
4. 为进入接触的足底建立世界空间锁定目标；
5. 按 Profile 自动选择解析式 IK 或 FABRIK；
6. 把求解结果转换为父空间 Quaternion 修正并按权重混合；
7. 修正脚踝/脚部朝向，再更新世界矩阵和 Socket。

不得创建第二个 Canvas、第二套 Skeleton 或隐藏动画循环。所有求解都由现有动作采样调用驱动。

## 5. 双足有效链映射

`biped-pet/v1` 的标准腿按以下语义折叠：

- Root：`thigh.left/right`；
- Mid：`knee.left/right`；
- Tip：`ankle.left/right`；
- End Effector：Profile 中的 `foot.left/right` 接触点；
- Hint：优先使用膝关节 `bendAxis` 转换到世界空间；退化时使用角色前向轴；
- 第二有效段允许跨越 `calf`，长度以真实运行时 Mid 到 Tip 的世界距离计算，不假设固定配方尺寸。

解析结果只旋转 Root 和 Mid；脚踝与脚部使用受限补偿保持接触朝向。不得缩放骨骼伪造可达性。

## 6. 足底锁定状态机

每只脚独立维护以下状态：

- `free`：未接触，只使用 FK；
- `acquiring`：接触进入，在短窗口内从 FK 平滑混合到锁定目标；
- `locked`：维持接触目标，权重由动作权重与接触置信度共同决定；
- `releasing`：接触离开，在短窗口内退回 FK；
- `disabled`：链或数据无效，本次 runtime 只使用 FK。

锁定目标包含足底世界位置和朝向。接触开始时从当前真实接触点捕获；播放时间倒退、单次跨越超过 `max(250 ms, durationMs × 0.2)`、循环从尾部回到起点、动作切换、停止、模型重建或控制器释放时清空状态，避免时间轴拖动继承旧锚点。

双脚同时支撑时，第一阶段不移动全局角色根节点；只根据两个足底垂直残差的平均值修正 `pelvis` 局部 Y，绝对值最多 `0.08` 个模型单位，再分别求解左右腿，避免两个目标互相争抢。单帧最大修正距离和最大旋转角必须钳制，目标不可达时收缩到合法范围并返回诊断，不允许产生 `NaN`。

## 7. 接触元数据和基础动作

现有 `activeContacts: string[]` 为兼容调用方保留；`SampledBipedPetMotion` 新增 `contactStates`，每项包含 `contactId`、`phase`、`weight` 和 `confidence`。阶段和权重由 Clip 的开始/结束时间及固定 `80 ms` 淡入淡出窗口确定，循环边界使用已解析时间；因此同一 Clip 和时间始终得到相同接触权重。旧 Clip 缺失扩展数据时返回空 `contactStates` 并保持纯 FK。

五个基础动作按以下规则补齐：

- 待机呼吸：左右脚全程支撑；
- 行走循环：左右脚交替支撑，交界处保留短双支撑窗口；
- 起跳与落地：蓄力阶段双脚支撑，腾空无接触，落地后双脚重新支撑；
- 招手：左右脚全程支撑；
- 直拳组合：左右脚主要阶段支撑，收势阶段平滑释放到中性。

动作模板同时调整根节点、骨盆和腿部关键帧，使 IK 只负责接触修正，不承担整段动作编排。

## 8. 失败处理与性能预算

- 单腿链缺失、长度退化或变换非有限：禁用该腿 IK，保留 FK，并产生一次稳定诊断；
- 目标不可达：钳制到最大合法长度，不拉伸骨骼；
- FABRIK 达到迭代上限仍未收敛：使用误差最小的有限结果；结果无效时回退 FK；
- 解析式求解每腿固定时间；FABRIK 默认最多 8 次迭代、位置误差阈值 `1e-4`，不得分配无界临时对象；
- `dispose()` 必须幂等，清空锁定目标和缓存，不保留旧 Bone 引用；
- IK 或足锁失败不得改变复杂配方、动作资产、模型模式或简单模型数据。

## 9. 测试与验收

### 9.1 领域单元测试

- 可达、过近、过远、共线、非有限输入的解析式 IK；
- FABRIK 可达/不可达链、迭代上限、确定性和长度保持；
- Profile 肢体定义校验与旧 Profile 兼容；
- 接触阶段权重、循环边界和时间倒退行为。

### 9.2 Three 运行时测试

- FK 后求解能降低足底到目标的误差；
- 锁定期间根节点起伏不会造成支撑脚明显滑动；
- 左右脚状态互不污染；
- 权重为 0 时与纯 FK 完全一致；
- 动作切换、停止、倒放、runtime 替换和释放会清空锁定；
- 缺骨骼或退化链只禁用对应肢体。

### 9.3 浏览器验收

在 1440×900 和 760×900 下分别播放五个基础动作，检查足底滑动、膝盖翻转、脚踝扭曲、重心、落地穿插、播放/暂停/停止、时间轴拖动、简单/复杂切换、横向溢出和控制台错误。Chrome 功能验收不能替代 Safari、Firefox、不同 GPU/WebGL 和最终像素验收。

## 10. 本批范围与后续边界

本批实现：统一约束契约、`biped-pet/v1` 双腿解析式 IK、受约束 FABRIK 基础求解器、足底锁定状态机、五个基础动作接触与重心优化、复杂预览接线和功能验收。

本批不实现：完整世界空间 Root Motion、地形射线检测、台阶适配、手部抓取 IK、四足/机甲正式 Profile、高细节拓扑重建、肌肉或软组织模拟、动作驱动特效。上述能力必须作为后续独立批次验证，不得因混合 IK 基础存在而标记完成。
