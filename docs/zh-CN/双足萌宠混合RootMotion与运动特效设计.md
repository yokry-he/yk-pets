# 双足萌宠混合 Root Motion 与运动特效设计

## 1. 目标

在不要求用户理解根骨骼、位移曲线、IK 或粒子系统的前提下，让站内生成的复杂双足萌宠获得更可信的行走、冲刺、急停、起跳和落地表现，并自动生成与运动强度一致的轻量特效。

本设计采用混合 Root Motion：动作模板描述移动意图和风格，运行时结合角色尺寸、接触阶段、足底约束与时间连续性求出安全的实际位移。用户只选择“原地”“向前移动”“自动转向”等语义选项，不直接编辑底层骨骼轨迹。

## 2. 当前问题与根因

混合 IK 与足底锁定已经能够稳定支撑脚，但当前角色整体仍主要依赖动作中的局部 `root.position`：

- 行走单支撑阶段存在约 `0.014` 模型单位的物理不可达残差，纯旋转 IK 无法消除；
- 循环动作只能在原地重复，身体位移与脚步速度缺少统一所有者；
- 冲刺、急停和跳跃的身体推进、重心变化与足底接触没有形成闭环；
- 动作切换、倒退拖动和循环接缝没有统一的速度、累计位移和特效生命周期；
- 现有简单模型特效按动作名称表现，尚未由实际速度、落地冲量或动作事件驱动。

根因不是关键帧数量不足，而是缺少“移动意图 → 世界位移 → 姿态补偿 → 足底约束 → 特效事件”的确定性运行链路。

## 3. 方案比较与决策

### 3.1 纯动作根轨道

直接累计动作中的根节点位移，成本最低，也能保留创作者意图；但它把角色比例和接触误差固化在模板中，换体型后容易滑步或产生循环跳变，因此不采用为完整方案。

### 3.2 纯运行时运动学推导

完全根据支撑脚、目标速度和腿长计算角色移动，适配性最强；但会削弱动作编排中的节奏、蓄力和夸张风格，并让每个动作趋向同一种机械步态，因此不采用。

### 3.3 混合 Root Motion

动作资产提供归一化移动意图和可变形窗口，运行时按角色尺寸缩放、按接触状态修正、按安全预算钳制，并把剩余误差交给既有足底锁定与 IK。该方案同时保留动作风格、体型适配和新手自动化，确定为本阶段方案。

成熟引擎同样把动画根位移与运行时目标对齐分开处理：Unreal Engine 的 Root Motion 从根骨骼提取位移，Motion Warping 在指定时间窗内把它调整到目标；Pose Warping 再根据实际移动方向和速度补偿姿态。本项目采用相同职责分离，但实现为浏览器内的框架无关数据求解器，不引入 Unreal/Unity 依赖。

参考资料：

- [Unreal Engine Root Motion](https://dev.epicgames.com/documentation/en-us/unreal-engine/root-motion-in-unreal-engine)
- [Unreal Engine Motion Warping](https://dev.epicgames.com/documentation/en-us/unreal-engine/motion-warping-in-unreal-engine)
- [Unreal Engine Pose Warping](https://dev.epicgames.com/documentation/en-us/unreal-engine/pose-warping-in-unreal-engine)
- [Three.js InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html)

## 4. 架构与职责边界

### 4.1 动作资产层

`BipedPetMotionAssetV2` 增加可选、版本兼容的 `rootMotion` 描述：

- `mode: 'in-place' | 'travel'`：原地动作或实际移动动作；
- `distance`：以角色身高比例表示的整段前进距离；
- `turnRadians`：整段相对转向；
- `verticalMode: 'grounded' | 'ballistic'`：贴地或弹道纵向策略；
- `windows`：移动可变形时间窗，声明开始、结束、权重和用途；
- `vfxTags`：动作允许触发的效果语义，不保存逐粒子数据。

旧资产缺少该字段时保持原地播放，不从现有 `root.position` 猜测世界位移。动作模板生成器负责提供默认描述，新手界面只显示中文语义选项和自动结果预览。

### 4.2 框架无关领域层

`packages/pet-core` 新增纯数值 Root Motion 求解器，输入当前与上一采样时间、动作时长与循环身份、归一化移动描述、角色身高和朝向、动作权重、调用方上一帧已经应用的世界位移与转向、尚未消费的 `previousLandingAuthorization`，以及可选的局部水平接触残差。调用方只拥有 `previousAppliedWorld`、`previousAppliedTurnRadians` 和采样器签发的只读落地授权这一组连续状态；局部 applied 状态不得作为第二份权威历史。落地授权只冻结 touchdown 的绝对请求时间与无量纲强度，不包含可变引用。

输出把状态明确分为两层：`cumulativeLocal/World` 与 `cumulativeTurnRadians` 是由绝对动作时间直接求出的帧率无关期望目标；`appliedLocal/World` 与 `appliedTurnRadians` 是从调用方上一帧世界 applied 状态出发、经过单帧安全预算后本帧可以实际写入的绝对状态。求解器在世界空间追赶 `cumulativeWorld`，再用当前朝向的逆旋转派生 `appliedLocal` 与 `deltaLocal`。`deltaWorld` 必须等于 JavaScript 实际可表示的 `appliedWorld - previousAppliedWorld`，线速度、转向增量与角速度也只由实际写入值派生；因此极值加法没有改变位置时会返回零增量，而不会报告未实际发生的移动。另外输出移动阶段、归一化运动强度、待下一连续帧原样回传的 `landingAuthorization`、只在真实 applied 落地时消费的无量纲启发式强度、急停强度，以及 `solved | clamped | reset | blocked` 状态。

领域层不依赖 Vue、Pinia、TresJS、Three.js 或浏览器时钟。相同输入必须返回相同结果，调用方输入不得被修改。高频运行时必须在资产编译阶段规范化一次并复用与 canonical duration 绑定的冻结定义；公开 raw/unknown 输入路径每次都执行防御读取、复制、校验与冻结，供边界 API 使用，不应成为逐帧热路径，也不得用可变对象身份缓存掩盖调用方后续修改。

### 4.3 Three 运行时层

复杂模型固定采用以下单帧顺序：

1. 恢复绑定姿态并应用 Quaternion FK；
2. 根据动作时间、上一帧 applied 状态与当前 target 求出 Root Motion 安全应用状态；
3. 把输出的 applied 绝对状态写入角色运行时容器，而不是直接写 target 或拉长腿骨；
4. 应用骨盆与全身重心补偿；
5. 更新世界矩阵并执行现有足底锁定与混合 IK；
6. 读取最终速度、接触和冲量，生成或更新 VFX；
7. 更新 Socket 和最终世界矩阵。

Root Motion、IK 与 VFX 共用现有动作采样循环、Canvas、Skeleton 和角色 runtime。不得创建第二个 Canvas、隐藏 `requestAnimationFrame` 或长期并行 Three 场景。

角色容器的绑定 position/Quaternion 在控制器创建时快照；`appliedWorld` 只作为相对绑定 position 的绝对偏移写入，`appliedTurnRadians` 以固定世界 Y 轴左乘绑定 Quaternion。这样包含 pitch/roll 的绑定姿态不会把整体转向误解为局部轴旋转。控制器在热路径复用临时 Vector3/Quaternion，不按帧创建第二份容器状态。

## 5. Root Motion 求解规则

### 5.1 水平位移与步幅适配

动作距离使用角色身高比例存储，运行时按当前编译模型尺寸换算。每个时间窗使用单调平滑进度曲线求期望累计距离；连续帧从控制器保存的 `previousAppliedWorld` 指向当前 `cumulativeWorld` 计算世界空间追赶误差与足锁修正的世界向量和，再对这一条向量应用单帧位移预算，输出 `appliedWorld = previousAppliedWorld + deltaWorld`。局部 applied 与 delta 统一由当前朝向逆变换得到。这样朝向改变不会旋转或重解释已经写入的世界历史，target 不受预算污染，容器不会绕过预算，发生钳制后也能在后续帧继续追赶欠量。

行走循环的单周期位移必须可累加：跨越连续循环接缝时使用上一周期终点到下一周期起点的连续差值，不归零世界位置。普通时间倒退、异常大跳、Clip 切换或停止则清除累计身份和速度，不把预览拖动解释为反向移动。

支撑脚残差的契约固定为“调用方提供的局部水平接触残差反馈”。IK 报告中的 `residualByLimb` 是每肢世界水平面 `hypot(anchor.x-current.x, anchor.z-current.z)` 的真实幅值，不包含 Y，也不编码方向；外层只消费这个水平幅值，并沿本帧局部水平移动的反方向构造有限 X/Z feedback，Y 永远为零。它只在上一请求到当前请求的整段时间映射都被连续 `travel/warp` 支撑组件覆盖时修正 applied 增量，跨入、跨出或穿越 gap 的帧不消费旧残差；预算同时随真实时间差、`actionWeight` 和当前水平 target 追赶误差缩放；原地、窗口空隙、仅弹道、暂停、reset 或 `actionWeight→0` 时不得漂移。纯函数内部不保存也不伪造低通历史，任务 5 控制器显式拥有跨帧 feedback 状态。

### 5.2 转向与姿态扭曲

转向同样按累计角度求增量，单帧角度受上限保护。角色运行时容器承担整体朝向，骨盆、脊柱和腿部只承担有限姿态补偿，避免把整段转向全部压到膝关节。

第一阶段仅支持动作自身的相对转向和可选终点朝向，不实现导航寻路或自动避障。

### 5.3 跳跃弹道

`ballistic` 动作把纵向位移分为蓄力、离地、空中和落地四段：

- 蓄力阶段保持双脚接触，降低骨盆并积累起跳强度；
- 离地时释放接触锚，按模板高度与角色尺寸生成连续抛物线；
- 空中阶段不启用足底锁定；完整动作链把实际 applied `rootMotionPhase` 作为只读帧上下文传给 IK，`takeoff/airborne` 必须优先于动作资产中可能滞后的 contact weight，先恢复 pelvis 绑定 Y、释放锚点并返回空支撑报告；standalone 未传上下文时保持原接触权重语义；
- 移动阶段由实际 applied 轨迹决定：高度在角色身高的 `1e-12` 阈值内为 `grounded`，正的实际纵向增量为 `takeoff`，负增量为 `landing`，正高度且纵向静止为 `airborne`。target 复合弹道使用 `max(1e-12, 1e-12 / (jumpHeight × actionWeight))` 归一化阈值；内部 action-aware 时间线是唯一事件权威，先在与请求帧无关的 canonical 轴上证明 airborne 组件及其正反向 takeoff/touchdown 转换，再由请求区间只做绝对时间筛选和映射。混合增减贡献区间使用复合高度与导数上下界生成有序证明叶，不能用单个 airborne midpoint 代替整段证明。窗口首尾只可作为结构切分提示，不能直接成为候选事件；低于阈值的窗口边界不得改变已证明组件与转换，touchdown 时间取复合曲线真正进入 grounded 的可表示阈值交点，因此允许早于原始窗口 end。两侧均有 proven airborne 且窗口精确首尾相接时，中间零宽接地点合并为连续组件；任何正宽 proven grounded gap（含 `.001ms` 与一个可表示 ULP）都拆分组件。`unknown`、预算耗尽或不可表示的超大 iteration 不输出转换，不签发新授权，也不清除旧授权。每次连续采样仅有一个 `512` work-unit 预算，复杂度上界为 `O(W log W + 512W)`，没有按窗口重置或跨调用续算。loop、ping-pong、周期缝与转折点先在 canonical 局部区间判定包含关系，再映射 canonical 双向转换及 resolved 锚点到绝对请求时间，最大四段且不会从请求端点反向制造结构；同 timestamp 事件保留 canonical 顺序，转换查询和区间 evidence 共用不可表示 iteration 检查并统一回退 incomplete/unknown。时间线组件强度取阈值组件内 action-aware 复合归一化高度的真实峰值，再乘纵向动作意图并钳制到 `[0,1]`；Root Motion 签发授权时再以 `landingImpulse = sqrt(normalizedCompositePeakHeight)` 派生无量纲冲击速度启发式。该公式来自自由落体 `v²=2gh` 的归一化关系，对角色尺寸、窗口时长和请求帧细分无关。单窗、共同峰心和同向区间使用解析快路，其余 active-set 结构区间用 de Casteljau 限制六次 Bernstein 控制多边形并按全局动作权重合成。组件内所有区间共享真实 sample 最大值与稳定上界优先队列，只有控制凸包仍可能高于 `max(1, |best|)×1e-13` 有证误差的节点才细分；每次细分和 sample 都纳入同一固定预算，耗尽时保持 unknown，控制上界与 proof witness 均不能作为强度。调用方逐帧原样回传授权；只有 applied 世界高度随后真实越地才消费一次并输出 `landingImpulse`，后续 canonical takeoff 清除旧授权。暂停保留授权但不触发，reset、倒退、异常大跳、Clip/runtime 切换会清除授权；`landingImpulse` 是与物理关系一致的无量纲速度启发式，不声称是场景碰撞求解器给出的真实速度。

第一阶段地面固定为角色预览平面，不做射线地形、坡度、台阶或碰撞体响应。

### 5.4 暂停、停止与切换

- 暂停：保持累计位姿、尚未消费的落地授权和 VFX 当前状态，不继续积分；
- 停止：恢复动作起点，清空速度、累计周期、落地授权、足底锚和瞬时 VFX；
- 普通倒退拖动：重建目标时间的确定性姿态，但不生成反向速度或重复冲击；
- Clip 切换：先释放旧 VFX 和运动身份，再编译并应用新 Clip；
- runtime 重建与释放：幂等清理，不保留旧 Object3D、Bone、材质或几何引用。

## 6. 重心与足底约束协同

Root Motion 是角色整体水平位移和转向的唯一所有者；IK 控制器继续只拥有骨骼 Quaternion 与骨盆 Y。直接创建 IK 控制器时保持历史契约，只在双支撑阶段补偿骨盆 Y；完整 Root Motion 动作控制器会显式开启单支撑可达补偿，其范围按角色高度限制为 `min(0.08, characterHeight×0.025)`，并且只在有效接地支撑时工作。脚、踝和腿骨局部 position 不得被 Root Motion 或 IK 重写。

重心补偿由接触状态决定：双支撑时骨盆位于两脚支撑中心附近；单支撑时平滑偏向支撑脚；腾空时不应用接地补偿；落地时双脚接触权重与骨盆压缩共同吸收冲量。所有水平偏移和单帧变化都按角色尺寸钳制。

执行完 Root Motion 后再捕获或维持足底锚，解决当前“身体没有前进但腿已经达到旋转极限”的残差；IK 仍负责最终小误差，不承担整段位移。

该集成策略是对真实可达域的必要细化：行走 `100→320ms` 在写入容器位移后，若同时禁止单支撑骨盆 Y、限制骨盆 X/Z 为 `0.025×height` 且禁止拉伸腿段，则遍历整个允许的 X/Z 圆盘仍无法把世界残差降到 `1e-3`。因此只在完整链路内允许尺寸化单支撑 Y 补偿；达到预算时报告 `clamped` 并保留真实残差，不伪装完整锁定。腾空、无支撑、权重为零、reset 和 dispose 都恢复绑定 Y；standalone IK 的既有约 `0.014` clamped 回归保持不变。

## 7. 确定性运动特效

第一批 VFX 只覆盖运动反馈，不建设通用节点式特效编辑器：

- `landing-ring`：首次有效落地时生成扩散环；
- `landing-dust`：无量纲落地速度启发式严格超过 `.4` 时生成少量尘点；落地环保持 `.25` 阈值，等于阈值均静默。在平方根映射下，两者分别对应 `.0625` 与 `.16` 的峰高边界；因此内置 `.28` 跳跃触发两者，峰高不高于 `.16` 的弱落地不会误触发尘效；
- `speed-trail`：实际 applied 水平速度超过阈值时沿角色后方显示短拖尾；`motionIntensity` 以明确的 `0.4` 个角色身高/秒为参考速度，即 `hypot(vx,vz)/(characterHeight×0.4)` 并钳制到 `[0,1]`；纯垂直弹道与原地转向不触发；
- `brake-sparks`：接地时由 authored `brake` 窗包络调制实际 applied 水平速度，组合强度超过阈值时生成急停摩擦粒子；零水平位移时窗口本身不能构造火花。

效果由求解器输出信号和动作 `vfxTags` 共同授权；没有标签时即使速度满足也不生成。相同 Clip、时间与运动状态必须得到相同事件 ID，避免回拖或重渲染重复触发。

当前 `brakeIntensity` 是“制动意图 × 实际水平速度”的确定性启发式，不伪装成物理减速度。未来若需要真实加速度或速度差，必须由调用方显式提供连续的前帧状态与重置边界，不能在纯函数中引入隐藏历史。

Three 层复用小型对象池；同类几何优先使用 `InstancedMesh` 降低 draw call。所有粒子有数量、寿命和透明度上限，释放时必须回收 Geometry、Material 与实例引用。第一阶段不实现体积烟雾、后处理 Bloom、屏幕震动或音画时间轴编辑。

## 8. 失败处理与安全预算

- 非有限时间、尺寸、距离、速度或角度：Root Motion 返回 `blocked`，该帧保持 FK/IK 原地路径；
- 单帧水平位移、纵向位移和转向超过预算：返回 `clamped` 并使用安全上限；
- 时间身份不连续：超过 `max(250ms, duration×0.5)`、倒退或缺少调用方 applied 状态时返回 `reset`，把 applied 初始化为当前 target，但不继承旧速度、落地授权、支撑误差或 VFX；
- 单个 VFX 创建失败：只禁用对应效果，不阻塞角色动作和其他效果；
- 诊断按 Clip、原因和阶段去重并保持有界，不记录堆栈或用户本地敏感路径；
- 简单模型继续走现有程序化动作和特效链路，不创建复杂 Root Motion 控制器。

## 9. 第一批动作范围

- 行走循环：周期位移连续、步幅随体型缩放、支撑脚不明显滑动；
- 冲刺急停：加速、前倾、稳定高速段、制动和重心回正；首批模板的 travel 窗覆盖 `0→8300ms`，brake 窗覆盖并重叠 `6300→8300ms`，确保减速段仍有真实 applied 水平速度可供制动包络调制；
- 起跳与落地：蓄力、连续离地弹道、落地压缩和冲击信号；
- 待机、招手和直拳：默认保持原地，但复用新生命周期，确保切换时不继承旧速度。

复杂舞蹈、功夫连段的目标点对齐和武器挥击轨迹放到后续批次；本阶段只建立它们可复用的移动窗和 VFX 信号接口。

## 10. 测试与验收

### 10.1 领域单元测试

- 不同帧率采样产生相同累计位移与转向；
- 行走循环接缝连续，普通倒退与异常跳时返回 reset；
- 角色尺寸缩放能等比例改变步幅和跳高；
- 移动窗修正有界，非法输入安全 blocked；
- 跳跃合成弹道位置与 applied 速度有限，重叠子窗只在真实接地转换产生一次有界落地启发式强度；
- VFX 事件 ID、授权标签、阈值与回拖去重确定性。

### 10.2 Three 运行时测试

- 角色容器位移与骨骼局部 position 所有权分离；
- Root Motion 后 IK 足底残差低于纯 FK，行走不再命中当前约 `0.014` 的不可达边界；
- 暂停、停止、回拖、Clip 切换、循环和释放清理正确；
- 简单模式不创建复杂 Root Motion 或 VFX 控制器；
- VFX 对象池有界、重复释放安全、创建失败不阻塞动作。

### 10.3 浏览器验收

在 Chromium 1440×900 与 760×900 播放行走、冲刺急停和起跳落地，检查累计位移、步幅、足滑、重心、落地穿插、特效时机、暂停/停止/回拖/切换，以及页面横向溢出、控制台错误和 hydration mismatch。

Safari、Firefox、不同 GPU/WebGL 与最终像素继续单独验收，不得由 Chromium 功能检查代替。

## 11. 本阶段边界

本阶段实现混合 Root Motion 基础、行走/冲刺/跳跃运行链路、自动重心协同和四种确定性运动 VFX。

本阶段不实现地形射线与坡度适配、碰撞导航、台阶攀爬、通用 Motion Matching、复杂动作目标点编辑器、通用 VFX 编辑器、屏幕后处理、高细节拓扑、正式四足/机甲 Profile，以及跨浏览器 GPU 最终验收。上述状态必须继续保持未完成，直到对应独立批次通过验证。

可执行计划为 `docs/zh-CN/双足萌宠混合RootMotion与运动特效实施计划.md`，分为契约、纯数值求解、VFX 信号、内置动作语义、Three 运行时协同、VFX 对象池、renderer/新手设置和阶段验收八个测试驱动任务。
