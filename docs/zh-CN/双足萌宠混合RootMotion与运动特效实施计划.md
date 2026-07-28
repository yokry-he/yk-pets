# 双足萌宠混合 Root Motion 与运动特效实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为复杂双足萌宠建立由动作意图、角色体型、接触约束和确定性运动信号共同驱动的 Root Motion、重心转移与轻量 VFX 链路，使行走、冲刺急停和起跳落地在站内编辑与渲染时获得连续、可复现的真实位移。

**Architecture:** `pet-core` 负责版本兼容的移动描述、纯数值 Root Motion 采样和 VFX 信号；它同时输出绝对时间确定的 target、经过单帧预算的 applied 状态与最小只读落地授权。Playground Three 层拥有 `previousAppliedWorld/previousAppliedTurnRadians` 和采样器签发的 `previousLandingAuthorization`，求解器在世界空间追赶 target，并按当前朝向逆变换派生局部结果；运行时只把安全 applied 绝对状态写入现有角色对象，在 FK 后叠加有界重心补偿、继续执行现有 IK，并在同一场景维护有界 VFX 对象池。Studio 通过中文语义设置自动生成扩展数据，旧动作缺少扩展时保持原地播放。

**Tech Stack:** TypeScript 5.9、Node.js test runner、Vue 3、Pinia、Nuxt 4、Three.js、TresJS、pnpm 11。

---

## 文件职责映射

- `packages/pet-core/src/motion/biped-pet-root-motion.ts`：Root Motion 契约、规范化、累计采样、时间连续性和安全预算。
- `packages/pet-core/src/motion/biped-pet-root-motion-timeline.ts`：内部复合弹道时间线、唯一边界/支撑分量与单帧共享工作预算；不从包入口公开导出。
- `packages/pet-core/src/motion/biped-pet-motion-vfx.ts`：由实际 applied 水平速度、制动窗口调制、接触和语义标签生成确定性 VFX 信号。
- `packages/pet-core/src/motion/biped-pet-motion-adapter.ts`：从现有动作扩展读取 Root Motion，编译进 Quaternion Clip，并把原始时间身份带入采样结果。
- `apps/playground/app/domain/studio-basic-biped-motions.ts`：待机、行走、跳跃、招手和直拳的默认移动语义。
- `apps/playground/app/domain/studio-built-in-motions.ts`：冲刺急停的移动窗、制动窗和 VFX 标签。
- `apps/playground/app/three/apply-complex-biped-root-motion.ts`：现有 `SkinnedMesh` 容器的绝对累计位移、转向、重置和释放。
- `apps/playground/app/three/apply-complex-biped-balance.ts`：只拥有骨盆 X/Z 和有限躯干倾斜的重心补偿。
- `apps/playground/app/three/complex-biped-motion-vfx.ts`：同一 Tres 场景中的 VFX `Group`、对象池和 GPU 资源生命周期。
- `apps/playground/app/three/apply-complex-biped-motion.ts`：固定 FK → Root Motion → Balance → IK → VFX 调用顺序。
- `apps/playground/app/components/studio/ComplexBipedPetRenderer.vue`：创建、挂载、切换和释放动作、Root Motion 与 VFX 控制器。
- `apps/playground/app/components/studio/StudioRootMotionSettings.vue`：面向新手的中文移动模式与自动特效设置。
- `scripts/test-studio-complex-biped-root-motion-runtime.ts`：Three 运行时、重心、IK 协同和 VFX 资源测试。
- `scripts/test-studio-biped-root-motion-probe.ts`：10,000 组有状态输入、42 个 ULP touchdown、64 弹道窗共享预算授权链、100,000 次 raw/canonical 规范化成本观测与每类 2,000 帧的 1/64 窗连续弹道热路径门禁。
- `scripts/check-studio-complex-biped-root-motion.mjs`：唯一场景、调用顺序、简单/复杂互斥和生命周期静态门禁。

### 任务 1：版本兼容的 Root Motion 契约与编译传播

**文件：**

- 创建：`packages/pet-core/src/motion/biped-pet-root-motion.ts`
- 修改：`packages/pet-core/src/motion/biped-pet-motion-adapter.ts`
- 修改：`packages/pet-core/src/index.ts`
- 创建：`packages/pet-core/test/biped-pet-root-motion.test.ts`
- 修改：`.ai/project-state.json`
- 修改：`docs/zh-CN/AI开发交接.md`

- [ ] **步骤 1：先写失败的契约与编译测试**

在 `packages/pet-core/test/biped-pet-root-motion.test.ts` 增加测试，要求合法扩展被规范化并编译，旧动作保持原地，非法窗口只产生稳定 warning：

```ts
import assert from 'node:assert/strict'
import { compileBipedPetMotion, createStudioMotionAsset, normalizeBipedPetRootMotion } from '../src/index.ts'

const fixtureMotion = createStudioMotionAsset({
  id: 'root-motion-fixture', nameZh: '位移测试', nameEn: 'Root Motion Fixture',
  durationMs: 1200, displayFps: 30, loopMode: 'loop', tracks: [],
  propIds: [], propEventTracks: [], createdAt: 1, updatedAt: 1,
})

const normalized = normalizeBipedPetRootMotion({
  mode: 'travel',
  distance: .42,
  turnRadians: .2,
  verticalMode: 'grounded',
  windows: [{ id: 'walk', kind: 'travel', startMs: 0, endMs: 1200, weight: 1 }],
  vfxTags: ['speed-trail'],
}, 1200)
assert.equal(normalized.value.mode, 'travel')
assert.equal(normalized.value.distance, .42)
assert.deepEqual(normalized.value.vfxTags, ['speed-trail'])

const legacyClip = compileBipedPetMotion({ ...fixtureMotion, extensions: undefined })
assert.equal(legacyClip.rootMotion.mode, 'in-place')
assert.deepEqual(legacyClip.rootMotion.windows, [])

const invalid = normalizeBipedPetRootMotion({
  mode: 'travel',
  distance: Number.POSITIVE_INFINITY,
  windows: [{ id: '', kind: 'travel', startMs: 400, endMs: 100, weight: 5 }],
}, 1200)
assert.equal(invalid.value.mode, 'in-place')
assert.ok(invalid.diagnostics.every(item => item.severity === 'warning'))
```

- [ ] **步骤 2：运行测试并确认红灯来自缺失 API**

运行：

```bash
corepack pnpm --filter @yk-pets/pet-core test
```

预期：FAIL，错误指向 `normalizeBipedPetRootMotion` 或 `BipedPetQuaternionClip.rootMotion` 尚不存在，而不是测试加载失败。

- [ ] **步骤 3：实现最小契约与规范化**

在新文件中定义并导出以下稳定接口：

```ts
export type BipedPetRootMotionMode = 'in-place' | 'travel'
export type BipedPetRootVerticalMode = 'grounded' | 'ballistic'
export type BipedPetRootMotionWindowKind = 'travel' | 'warp' | 'ballistic' | 'brake'
export type BipedPetMotionVfxTag = 'landing-ring' | 'landing-dust' | 'speed-trail' | 'brake-sparks'

export interface BipedPetRootMotionWindow {
  id: string
  kind: BipedPetRootMotionWindowKind
  startMs: number
  endMs: number
  weight: number
}

export interface BipedPetRootMotionDefinition {
  mode: BipedPetRootMotionMode
  distance: number
  turnRadians: number
  verticalMode: BipedPetRootVerticalMode
  jumpHeight: number
  windows: readonly BipedPetRootMotionWindow[]
  vfxTags: readonly BipedPetMotionVfxTag[]
}

export interface BipedPetRootMotionNormalizationResult {
  value: BipedPetRootMotionDefinition
  diagnostics: readonly { id: string, severity: 'warning', message: string }[]
}
```

`normalizeBipedPetRootMotion(input, durationMs)` 必须复制输入，距离钳制到 `[-4, 4]` 个身高、转向钳制到 `[-2π, 2π]`、跳高钳制到 `[0, 1.5]` 个身高，窗口限制在动作区间且按 `startMs/endMs/id` 稳定排序，标签去重并按代码点排序。`in-place` 强制距离、转向和跳高为 0。

在 `BipedPetQuaternionClip` 增加 `rootMotion`，在 `SampledBipedPetMotion` 增加 `requestedTimeMs`、`iteration`、`direction` 和 `rootMotion`。`compileBipedPetMotion` 从 `asset.extensions['yk-pets/biped-motion/v1'].rootMotion` 读取并把诊断并入 Clip；blocked Clip 也必须返回安全的原地定义。

- [ ] **步骤 4：验证绿灯和兼容性**

运行：

```bash
corepack pnpm --filter @yk-pets/pet-core test
corepack pnpm --filter @yk-pets/pet-core typecheck
```

预期：全部通过；既有接触阶段与 Quaternion Clip 测试不需要伪造 Root Motion 字段。

- [ ] **步骤 5：同步 AI 包并提交推送**

状态只标记 `bipedPetRootMotionContractComplete=true`，完整 Root Motion/VFX 仍为 `false`。

```bash
git add packages/pet-core/src/motion/biped-pet-root-motion.ts packages/pet-core/src/motion/biped-pet-motion-adapter.ts packages/pet-core/src/index.ts packages/pet-core/test/biped-pet-root-motion.test.ts .ai/project-state.json docs/zh-CN/AI开发交接.md
git commit -m "定义混合RootMotion动作契约"
git push origin agent/cloud-fox-studio-v0610
```

### 任务 2：帧率无关的累计位移、转向与弹道求解

**文件：**

- 修改：`packages/pet-core/src/motion/biped-pet-root-motion.ts`
- 创建：`packages/pet-core/src/motion/biped-pet-root-motion-timeline.ts`
- 修改：`packages/pet-core/test/biped-pet-root-motion.test.ts`
- 创建：`packages/pet-core/test/biped-pet-root-motion-timeline.test.ts`
- 修改：`.ai/project-state.json`
- 修改：`docs/zh-CN/AI开发交接.md`

- [ ] **步骤 1：写累计采样与边界失败测试**

测试公开 API：

```ts
const travelDefinition = {
  mode: 'travel' as const,
  distance: .42,
  turnRadians: .2,
  verticalMode: 'grounded' as const,
  jumpHeight: 0,
  windows: [{ id: 'walk', kind: 'travel' as const, startMs: 0, endMs: 1200, weight: 1 }],
  vfxTags: [] as const,
}
const input = {
  definition: travelDefinition,
  requestedTimeMs: 600,
  durationMs: 1200,
  loopMode: 'loop' as const,
  characterHeight: 4,
  facingRadians: 0,
  actionWeight: 1,
  footResidual: [0, 0, 0] as const,
}
const half = sampleBipedPetRootMotion(input)
assert.equal(half.status, 'reset')
assert.ok(Math.abs(half.cumulativeLocal[0] - .84) < 1e-9)
assert.deepEqual(half.appliedLocal, half.cumulativeLocal)

const beforeSeam = sampleBipedPetRootMotion({ ...input, requestedTimeMs: 1190 })
const nextCycle = sampleBipedPetRootMotion({
  ...input,
  previousRequestedTimeMs: 1190,
  previousAppliedWorld: beforeSeam.appliedWorld,
  previousAppliedTurnRadians: beforeSeam.appliedTurnRadians,
  requestedTimeMs: 1210,
})
assert.ok(nextCycle.deltaLocal[0] > 0)
assert.equal(nextCycle.iteration, 1)

const rewind = sampleBipedPetRootMotion({
  ...input,
  previousRequestedTimeMs: 800,
  previousAppliedWorld: half.appliedWorld,
  previousAppliedTurnRadians: half.appliedTurnRadians,
  requestedTimeMs: 200,
})
assert.equal(rewind.status, 'reset')
assert.deepEqual(rewind.deltaLocal, [0, 0, 0])
```

再覆盖 100/200ms 动作在 24/30/60FPS 的真实有状态序列、世界空间 target/applied 欠量追赶、朝向变化的世界位置不变量、由实际 applied 高度驱动的阶段与延迟 touchdown、角色高度等比例缩放、单帧移动/转向钳制、`Number.MAX_VALUE` 可表示增量、canonical duration、非有限输入 `blocked`、输入不突变和普通回拖不生成反向速度。

- [ ] **步骤 2：运行定向测试确认红灯**

运行：

```bash
corepack pnpm --filter @yk-pets/pet-core test
```

预期：FAIL，`sampleBipedPetRootMotion` 尚未导出。

- [ ] **步骤 3：实现纯数值采样器**

新增以下结果类型：

```ts
export interface SampledBipedPetRootMotion {
  status: 'solved' | 'clamped' | 'reset' | 'blocked'
  requestedTimeMs: number
  resolvedTimeMs: number
  iteration: number
  cumulativeLocal: readonly [number, number, number]
  cumulativeWorld: readonly [number, number, number]
  appliedLocal: readonly [number, number, number]
  appliedWorld: readonly [number, number, number]
  deltaLocal: readonly [number, number, number]
  deltaWorld: readonly [number, number, number]
  cumulativeTurnRadians: number
  appliedTurnRadians: number
  deltaTurnRadians: number
  linearVelocity: readonly [number, number, number]
  angularVelocity: number
  phase: 'grounded' | 'takeoff' | 'airborne' | 'landing'
  motionIntensity: number
  landingImpulse: number
  landingAuthorization?: Readonly<{
    touchdownRequestedTimeMs: number
    impulse: number
  }>
  brakeIntensity: number
}
```

`cumulative*` 必须由动作定义、`requestedTimeMs` 和 `iteration` 直接计算，作为帧率无关 target；调用方通过 `previousAppliedWorld/previousAppliedTurnRadians` 提供上一帧已应用状态，并把上一帧返回的 `landingAuthorization` 作为 `previousLandingAuthorization` 原样回传。求解器在世界空间从 applied 指向 target 计算误差和预算，使用实际可表示的 `appliedWorld - previousAppliedWorld` 输出 `deltaWorld` 与速度，再以当前朝向的逆旋转派生 `appliedLocal/deltaLocal`；朝向改变不得重解释既有世界位置。缺 applied、倒退、Clip 身份变化或超过 `max(250ms, duration×0.5)` 时 reset 并把 applied 初始化为 target，同时清除授权且不发速度或瞬时事件。窗口使用 `smoothstep(t)=t²(3-2t)`，多个有效窗口按权重归一化；弹道高度使用 `4h·p·(1-p)`，但阶段由实际 applied 高度与纵向增量判定。共享 action-aware 时间线必须成为唯一事件权威：请求端点不进入结构边界，窗口首尾只提示初始切分；时间线在一个 `512` work-unit 预算内直接输出 proven airborne 组件、双向 takeoff/touchdown 的 canonical resolved 时间与归一化复合峰高，复杂度为 `O(W log W + 512W)`。混合增减贡献区间必须以复合高度和导数上下界生成有序证明叶，不得用单个 airborne midpoint 代表整段；组件强度必须取阈值组件内 action-aware 复合归一化高度的真实峰值乘纵向动作意图并钳制到 `[0,1]`，不能取决于 proof 切分、witness 或成员窗中点。求解器使用 `landingImpulse = sqrt(normalizedCompositePeakHeight)` 把该峰高转为无量纲落地速度启发式，依据是自由落体 `v²=2gh` 的归一化关系。单窗、共同峰心与同向区间使用解析快路；其余 active-set 结构区间必须用 de Casteljau 限制固定六次 Bernstein 控制多边形并按全局动作权重归一化，一个组件内共享真实 sample 最大值与稳定的凸包上界优先队列。上界相同按 start/end/序号稳定排序，只有上界仍可能高于 `max(1, |best|)×1e-13` 有证误差的节点才继续细分；细分与新 sample 均计入结构证明的共享预算，耗尽时整个分析 unknown，控制上界不能作为强度。两侧 proven airborne 且窗口精确相邻时合并零宽接地点；任意正宽 proven grounded gap（包括 `.001ms` 和一个 ULP）拆分；低于阈值的相邻/重叠窗口不得改变主组件，实际 touchdown 可早于窗口 end。`unknown` 不输出转换、不签发也不清除授权。loop/ping-pong、周期缝与转折点先在 canonical 局部区间筛选并保持同 timestamp 的转换顺序，再映射到最多四段绝对请求区间，不能重新枚举窗口端点候选；转换与区间分类必须共用 iteration 锚、段宽和 modulo 一致性检查，不可表示时统一回退 incomplete/unknown。授权跨后续 `actionWeight` 淡出与不合格微尾窗保持，只有 applied 随后真实越过接地阈值才消费一次并输出无量纲 `landingImpulse`；后续 canonical takeoff 清除旧授权。暂停保留授权但不触发，倒退、reset、大跳和未授权 applied 落地均不触发。

安全预算固定为每帧不超过 `0.25 × characterHeight` 位移和 `π/4` 转向；超过时按方向等比钳制并返回 `clamped`，不改变累计 target，后续帧继续从 applied 追赶欠量。`footResidual` 只读取有限 X/Z，正值推动根节点沿对应局部轴正向修正，完全忽略 Y；仅在整个帧间时间映射都被连续 `travel/warp` 支撑组件覆盖时作为局部水平反馈，跨入、跨出或穿越 gap 的帧不消费残差。预算随真实时间差、动作权重和水平追赶误差缩放；纯函数不持有低通状态。

`motionIntensity` 只读取实际 applied 世界 X/Z 水平速度，并使用公开常量 `BIPED_PET_ROOT_MOTION_REFERENCE_SPEED_BODY_HEIGHTS_PER_SECOND=.4`：`hypot(vx,vz)/(characterHeight×0.4)` 后钳制到 `[0,1]`。纯转向、纯垂直弹道和零水平位移必须保持为零。

- [ ] **步骤 4：运行数值测试与随机边界探针**

运行：

```bash
corepack pnpm --filter @yk-pets/pet-core test
corepack pnpm run test:studio-biped-root-motion-probe
```

预期：单元测试通过；可复现探针保存每帧 applied 与授权，10,000 组固定种子输入达到 solved/clamped/reset/blocked、loop 接缝、landing 与 brake 最小命中数，42 个正反向 ULP applied touchdown 全部通过；canonical 64 弹道窗场景验证主窗授权跨 63 个低于世界接地阈值的 ULP 尾窗保持并最终消费，后续高窗仍清除 stale 授权，且共享分析统计始终不超过 `512` work unit。另以 once/loop/ping-pong 的高低强度精确相邻窗锁定跨 `10ms` 请求边界前后的帧细分不变性：低强度路径始终只消费一次完整主冲量，高强度路径始终没有内部授权。100,000 次 1/64 窗口 canonical/raw reset 对照只观测防御规范化成本，不代表时间线热路径；每类 2,000 帧的 1/64 窗 canonical 连续弹道序列逐帧回传 previous applied、turn 与 authorization，要求真实签发并消费 token。所有耗时只作本机观测，不设置脆弱阈值。

- [ ] **步骤 5：提交推送**

```bash
git add packages/pet-core/src/motion/biped-pet-root-motion.ts packages/pet-core/test/biped-pet-root-motion.test.ts .ai/project-state.json docs/zh-CN/AI开发交接.md
git commit -m "实现确定性RootMotion求解"
git push origin agent/cloud-fox-studio-v0610
```

### 任务 3：确定性运动 VFX 信号

**文件：**

- 创建：`packages/pet-core/src/motion/biped-pet-motion-vfx.ts`
- 创建：`packages/pet-core/test/biped-pet-motion-vfx.test.ts`
- 修改：`packages/pet-core/src/index.ts`
- 修改：`.ai/project-state.json`
- 修改：`docs/zh-CN/AI开发交接.md`

- [ ] **步骤 1：写标签授权、阈值和去重失败测试**

```ts
const rootSample = sampleBipedPetRootMotion({
  definition: { mode: 'in-place', distance: 0, turnRadians: 0, verticalMode: 'grounded', jumpHeight: 0, windows: [], vfxTags: [] },
  requestedTimeMs: 1820, previousRequestedTimeMs: 1700, durationMs: 2400,
  loopMode: 'once', characterHeight: 4, facingRadians: 0, actionWeight: 1, footResidual: [0, 0, 0],
})
const landingInput = {
  clipHash: 'clip-a',
  previousRequestedTimeMs: 1700,
  requestedTimeMs: 1820,
  tags: ['landing-ring', 'landing-dust'] as const,
  rootMotion: { ...rootSample, phase: 'landing', landingImpulse: .8 },
}
const landing = deriveBipedPetMotionVfxSignals(landingInput)
assert.deepEqual(landing.map(item => item.kind), ['landing-dust', 'landing-ring'])
assert.equal(new Set(landing.map(item => item.id)).size, landing.length)

const replay = deriveBipedPetMotionVfxSignals({
  clipHash: 'clip-a',
  previousRequestedTimeMs: 1820,
  requestedTimeMs: 900,
  tags: ['landing-ring'],
  rootMotion: { ...rootSample, status: 'reset', phase: 'grounded', landingImpulse: 0 },
})
assert.deepEqual(replay, [])

assert.deepEqual(deriveBipedPetMotionVfxSignals({ ...landingInput, tags: [] }), [])
```

补充速度拖尾持续信号、急停摩擦信号、阈值边界、非法输入、相同时间不重复触发和稳定代码点排序。

- [ ] **步骤 2：运行测试确认 API 缺失**

运行：`corepack pnpm --filter @yk-pets/pet-core test`

预期：FAIL，指向 `deriveBipedPetMotionVfxSignals` 未实现。

- [ ] **步骤 3：实现信号领域模块**

定义：

```ts
export interface BipedPetMotionVfxSignal {
  id: string
  kind: BipedPetMotionVfxTag
  mode: 'burst' | 'sustain'
  strength: number
  timeMs: number
  lifetimeMs: number
}
```

`landing-ring` 阈值为落地冲量 `.25`，`landing-dust` 为 `.4`，两者都使用严格 `>`，不能为适配单个动作而改阈值。`landingImpulse=sqrt(normalizedCompositePeakHeight)`，所以两个阈值分别对应 `.0625` 与 `.16` 的峰高边界；等于边界仍静默，内置 `.28` 跳跃产生 `sqrt(.28)≈.529` 并同时授权环与尘效。`speed-trail` 为实际 applied 水平速度按 `0.4` 个角色身高/秒参考速度归一化后的强度 `.55`，`brake-sparks` 为“authored brake 窗包络 × 实际水平速度强度”的急停强度 `.45`。纯垂直弹道、原地转向和零水平位移 brake 窗不得触发移动特效；若未来需要物理减速度，必须由调用方显式携带连续速度状态，不能在纯函数中加入隐藏历史。burst ID 使用 `${clipHash}:${kind}:${Math.round(requestedTimeMs)}`，sustain ID 使用 `${clipHash}:${kind}:active`。Root Motion 样本的 `requestedTimeMs` 必须严格等于外层请求时间；`reset/blocked`、时间身份错配、时间倒退或未授权标签返回空数组。

- [ ] **步骤 4：验证绿灯并提交推送**

```bash
corepack pnpm --filter @yk-pets/pet-core test
corepack pnpm --filter @yk-pets/pet-core typecheck
git add packages/pet-core/src/motion/biped-pet-motion-vfx.ts packages/pet-core/test/biped-pet-motion-vfx.test.ts packages/pet-core/src/index.ts .ai/project-state.json docs/zh-CN/AI开发交接.md
git commit -m "生成确定性运动特效信号"
git push origin agent/cloud-fox-studio-v0610
```

### 任务 4：为行走、冲刺和跳跃补齐移动语义

**文件：**

- 修改：`apps/playground/app/domain/studio-basic-biped-motions.ts`
- 修改：`apps/playground/app/domain/studio-built-in-motions.ts`
- 修改：`scripts/test-studio-built-in-assets.ts`
- 修改：`.ai/project-state.json`
- 修改：`docs/zh-CN/AI开发交接.md`

- [ ] **步骤 1：写内置动作语义失败测试**

要求：

```ts
assert.equal(walkClip.rootMotion.mode, 'travel')
assert.equal(walkClip.rootMotion.distance, .42)
assert.deepEqual(walkClip.rootMotion.vfxTags, ['speed-trail'])

assert.equal(jumpClip.rootMotion.verticalMode, 'ballistic')
assert.equal(jumpClip.rootMotion.jumpHeight, .28)
assert.deepEqual(jumpClip.rootMotion.vfxTags, ['landing-dust', 'landing-ring'])

const sprintClip = compileBipedPetMotion(BUILT_IN_STUDIO_MOTIONS.find(item => item.id === 'builtin-sprint-stop'))
assert.equal(sprintClip.rootMotion.mode, 'travel')
assert.ok(sprintClip.rootMotion.windows.some(item => item.kind === 'brake'))
assert.deepEqual(sprintClip.rootMotion.vfxTags, ['brake-sparks', 'speed-trail'])

for (const clip of [idleClip, waveClip, punchClip]) assert.equal(clip.rootMotion.mode, 'in-place')
```

- [ ] **步骤 2：运行资产测试确认红灯**

运行：`corepack pnpm run test:studio-built-in-assets`

预期：FAIL，现有模板尚未声明 Root Motion。

- [ ] **步骤 3：扩展模板元数据**

在基础模板定义中增加 `rootMotion` 描述，并随 `speed` 调整窗口时间但不改变按身高归一化的整段距离。行走使用全周期 travel 窗，跳跃使用 `.3→.76` ballistic 窗。待机、招手和直拳显式设为 in-place。

扩展长动作 `motion()` helper 接受 `extensions`，为冲刺急停加入：

```ts
extensions: {
  'yk-pets/biped-motion/v1': {
    rootMotion: {
      mode: 'travel', distance: 2.4, turnRadians: 0,
      verticalMode: 'grounded', jumpHeight: 0,
      windows: [
        { id: 'sprint', kind: 'travel', startMs: 0, endMs: 8300, weight: 1 },
        { id: 'brake', kind: 'brake', startMs: 6300, endMs: 8300, weight: 1 },
      ],
      vfxTags: ['speed-trail', 'brake-sparks'],
    },
  },
}
```

- [ ] **步骤 4：验证模板编译、采样和旧动作兼容**

```bash
corepack pnpm run test:studio-built-in-assets
corepack pnpm --filter @yk-pets/pet-core test
```

预期：通过；11 个内置动作数量、时长、轨道和道具依赖不变。测试必须以 `actionWeight=1` 从头逐帧携带 previous applied/turn/authorization，验证自然行走中段触发速度拖尾、自然冲刺移动段触发拖尾、约 `7300ms` 的重叠制动段触发急停火花，以及 `.28` 跳跃的真实落地在同一帧各触发一次落地环与落地尘效；不得用权重突变、人为欠量或标签特判伪造强度。

- [ ] **步骤 5：提交推送**

```bash
git add apps/playground/app/domain/studio-basic-biped-motions.ts apps/playground/app/domain/studio-built-in-motions.ts scripts/test-studio-built-in-assets.ts .ai/project-state.json docs/zh-CN/AI开发交接.md
git commit -m "补齐基础动作RootMotion语义"
git push origin agent/cloud-fox-studio-v0610
```

### 任务 5：Three Root Motion、重心与 IK 协同

**文件：**

- 创建：`apps/playground/app/three/apply-complex-biped-root-motion.ts`
- 创建：`apps/playground/app/three/apply-complex-biped-balance.ts`
- 修改：`apps/playground/app/three/apply-complex-biped-ik.ts`
- 修改：`apps/playground/app/three/apply-complex-biped-motion.ts`
- 创建：`scripts/test-studio-complex-biped-root-motion-runtime.ts`
- 修改：`package.json`
- 修改：`.ai/project-state.json`
- 修改：`docs/zh-CN/AI开发交接.md`

- [x] **步骤 1：写所有权、顺序和生命周期失败测试**

测试分别快照 `runtime.object.position/quaternion`、root/pelvis/foot 局部 position 和骨骼 Quaternion：

```ts
const controller = createComplexBipedMotionController(runtime, compilation)
controller.apply(sampleBipedPetMotion(walkClip, 100), 1)
const first = runtime.object.position.clone()
controller.apply(sampleBipedPetMotion(walkClip, 320), 1)
assert.ok(runtime.object.position.x > first.x)
assert.deepEqual(foot.position.toArray(), footBindPosition)
assert.ok(readContactWorld(runtime, compilation, 'foot.left').distanceTo(anchor) < 1e-3)

controller.reset()
assert.deepEqual(runtime.object.position.toArray(), objectBindPosition)
assert.deepEqual(runtime.object.quaternion.toArray(), objectBindQuaternion)
```

再覆盖不同帧率的正常连续序列到同一时间得到相同容器 applied 变换、同一 canonical touchdown 在跨边界帧与边界处细分帧下得到相同授权/冲量、巨大 target 跳变不绕过单帧预算且后续帧追赶欠量、同 Clip/时间/归一化权重的重复 apply 冻结完整显示姿态与残差并保留待消费授权、停止/回拖/Clip 切换清除 `previousApplied`、`previousLandingAuthorization` 与旧欠量、角色尺寸改变步幅、双/单支撑重心、`takeoff/airborne/landing` 均不锁脚、无效 weight/confidence 不形成支撑、同 runtime 单 Root 写入者、外层构造失败释放所有权、Root Motion blocked 时保留 FK/IK、长序列无 feedback 振荡/过冲、重复 dispose 和释放后拒绝写入。

- [x] **步骤 2：运行新脚本确认红灯**

先在 `package.json` 增加：

```json
"test:studio-complex-biped-root-motion-runtime": "node --import ./packages/local-agent/node_modules/tsx/dist/loader.mjs scripts/test-studio-complex-biped-root-motion-runtime.ts"
```

运行：`corepack pnpm run test:studio-complex-biped-root-motion-runtime`

预期：FAIL，两个 Three 控制器尚不存在。

- [x] **步骤 3：实现 Root Motion 控制器**

接口固定为：

```ts
export interface ComplexBipedRootMotionFrame {
  rootMotion: SampledBipedPetRootMotion
  vfxSignals: readonly BipedPetMotionVfxSignal[]
}

export interface ComplexBipedRootMotionController {
  apply(sample: SampledBipedPetMotion, weight: number, footResidual?: readonly [number, number, number]): ComplexBipedRootMotionFrame
  reset(): void
  diagnostics(): readonly string[]
  dispose(): void
}
```

控制器保存 `runtime.object` 的绑定 position/quaternion，以及当前 Clip 身份下最后一次成功写入的 `previousAppliedWorld/previousAppliedTurnRadians` 与只读 `previousLandingAuthorization`。每帧把三者传给纯函数，把返回的 `landingAuthorization` 原样保存到下一连续帧，并只将 `appliedWorld` 与 `appliedTurnRadians` 绝对写入容器；`appliedLocal` 仅供诊断与领域消费，不得另存为连续历史。授权不允许重建、改写强度、把 touchdown 时间吸附回窗口 end，或附加可变引用，只在求解器输出 `landingImpulse` 后视为已消费；Three 层不得重新枚举窗口首尾或根据当前帧端点补签事件。禁止直接写 `cumulative*` target，也禁止在 Three 层再次累计 `delta*`。这样朝向切换不会旋转既有世界位置，target 仍由绝对时间确定，单帧预算不会被绕过，钳制后的欠量由后续求解帧继续追赶，速度与容器真实 applied 轨迹一致。

角色高度从已计算的 `runtime.object.geometry.boundingBox` 六个标量直接读取；无有效包围盒时阻塞 Root Motion 但不阻塞 FK。首帧、停止、回拖、Clip 切换、runtime 重建、dispose 或求解 reset 时同时清除旧 applied 与落地授权所有权，让求解器把 applied 初始化为当前 target，且该帧不生成速度/VFX。Root 控制器先用零 residual 预采样实际相位，仅在预览为 `solved/clamped + grounded` 时从同一 previous state 带入 residual 做第二次纯采样；二采样也保持有限 grounded 才提交，否则回退预览，禁止水平 strain 通过共享 XYZ 预算延迟 touchdown、token、冲量或 VFX。暂停只保留授权而不消费；实际 applied 落地消费后使用求解器返回的空授权覆盖控制器状态。每个 runtime 由 WeakMap token 保证只有一个 Root 写入者，释放与外层构造失败必须交还 token，已释放 runtime 拒绝创建控制器。Root dispose 恢复绑定失败也要在 finally 中删除 token 并封存，使用独立失败哨兵保证 `throw undefined` 仍被原样重抛；构造失败需保留初始化错误并对 IK、Balance、Root 全部尽力回滚。错误详情转换必须覆盖 `Error.message` 本身，`Symbol` 或访问器抛错统一安全降级，诊断格式化不得成为新的清理失败源。外层 dispose 对 IK、Balance、Root、runtime 状态检查、bind 和 matrix 全部尽力，状态检查异常时仍尝试 bind/matrix，清状态后统一抛中文聚合错误。纯数值求解器内部不得保存隐式滤波历史。

- [x] **步骤 4：实现独立重心控制器和 IK 帧报告**

`ComplexBipedBalanceController` 只写 pelvis X/Z 和 chest 有界 Quaternion，范围分别不超过角色高度的 `.025` 和 `0.12rad`；reset/dispose 恢复绑定值。IK 控制器的 `apply()` 返回只读报告：

```ts
export interface ComplexBipedIkFrameReport {
  supportingContacts: number
  /** 每肢锚点到当前接触点在世界 X/Z 水平面的真实残差幅值；不含 Y，也不编码方向。 */
  residualByLimb: Readonly<Record<string, number>>
  clampedLimbs: readonly string[]
}
```

报告不暴露 Bone 引用，也不改变现有有界诊断。`residualByLimb` 只能由 `anchor-current` 的世界 X/Z 分量计算 `hypot`，禁止使用三维 `distanceTo` 把 Y 误差转成水平 feedback。该值是无方向的水平 strain 启发式：动作控制器直接循环只读记录取得最大有限幅值，不得用 `Object.values/filter` 创建临时数组；随后应用 `×8` 增益并钳制到 `characterHeight×0.025`，再沿本帧局部水平移动反方向构造下一帧 Root Motion 的 X/Z 输入，Y 永远为零。全部早退复用共享冻结零 residual，Root blocked 向量与空 VFX、无 IK 报告也复用安全常量。正常帧顺序必须是 `restoreBindPose → FK → rootMotion.apply → balance.apply → updateMatrixWorld → ik.apply`；相同 Clip/请求时间/归一化权重的重复帧则只调用 Root 保持时间令牌，完整冻结已显示 FK/Balance/IK、IK 报告和 residual。原地、窗口空隙与非支撑阶段不得因旧 residual 漂移。

实现阶段的真实可达域扫描证明，仅靠 `0.025×height` 骨盆 X/Z、骨骼 Quaternion 且不改段长时，写入行走 Root Motion 后的单支撑世界残差无法降到 `1e-3`。因此 `createComplexBipedIkController` 增加默认关闭的集成选项；只有完整动作控制器开启尺寸化单支撑 pelvis Y 补偿，预算为 `min(0.08, characterHeight×0.025)`。完整链还必须把实际 applied `rootMotionPhase` 作为可选只读上下文传给 IK；`takeoff/airborne/landing` 即使仍带非零 contact weight，也要先恢复 pelvis Y、释放锚点并返回空支撑报告，只有真实 grounded touchdown 才重捕获，standalone 未传上下文时保持旧语义。有效支撑统一要求 weight/confidence 都是正有限数。直接 IK 保持历史单支撑 clamped 和三轮交替语义；集成链可以在不扩大每骨骼累计角预算、不改局部 position 与段长的前提下使用五轮交替收敛。集成补偿达到预算时必须在报告和诊断中明确 `clamped`，非支撑、无有效接触、weight 0、reset 与 dispose 恢复绑定 Y。

- [x] **步骤 5：验证当前 0.014 残差和所有权**

运行：

```bash
corepack pnpm run test:studio-complex-biped-motion-runtime
corepack pnpm run test:studio-complex-biped-root-motion-runtime
corepack pnpm --filter @nova/playground typecheck
```

预期：既有 IK 测试保持通过；行走 `100→320ms` 在 Root Motion 链路中的世界支撑脚残差不高于 `7.5e-4`（当前固定探针约 `0.000311`），纯 FK 对照更大；纯 Y 误差的水平报告为零；`takeoff/airborne/landing` 的滞后 contact weight 不锁脚；临界 touchdown 的 residual 二采样不延迟落地；重复帧姿态/残差冻结；第二个 Root 写入者被拒绝，`Error` 与 `undefined` 释放异常后 token 均可重取；IK 构造失败叠加 Balance 清理失败也能释放 Root token；runtime 状态检查失败仍执行 matrix；自然 loop 与由真实 `loopMode:'ping-pong'` 资产编译、采样的长序列均无反向振荡或过冲；每骨骼累计角预算、腿骨局部 position 与段长不变。

- [ ] **步骤 6：提交推送**

```bash
git add apps/playground/app/three/apply-complex-biped-root-motion.ts apps/playground/app/three/apply-complex-biped-balance.ts apps/playground/app/three/apply-complex-biped-ik.ts apps/playground/app/three/apply-complex-biped-motion.ts scripts/test-studio-complex-biped-root-motion-runtime.ts package.json .ai/project-state.json docs/zh-CN/AI开发交接.md
git commit -m "接入复杂模型RootMotion与重心约束"
git push origin agent/cloud-fox-studio-v0610
```

### 任务 6：同一场景的有界运动 VFX 运行时

**文件：**

- 创建：`apps/playground/app/three/complex-biped-motion-vfx.ts`
- 修改：`scripts/test-studio-complex-biped-root-motion-runtime.ts`
- 修改：`.ai/project-state.json`
- 修改：`docs/zh-CN/AI开发交接.md`

- [ ] **步骤 1：写对象池、触发与释放失败测试**

```ts
const frame = { requestedTimeMs: 1800, position: [0, 0, 0] as const, facingRadians: 0 }
const vfx = createComplexBipedMotionVfxController()
assert.equal(vfx.object.type, 'Group')
vfx.apply([{ id: 'a', kind: 'landing-ring', mode: 'burst', strength: .8, timeMs: 1800, lifetimeMs: 480 }], frame)
assert.equal(vfx.snapshot().activeByKind['landing-ring'], 1)
vfx.apply([{ id: 'a', kind: 'landing-ring', mode: 'burst', strength: .8, timeMs: 1800, lifetimeMs: 480 }], frame)
assert.equal(vfx.snapshot().activeByKind['landing-ring'], 1)
for (let index = 0; index < 200; index++) vfx.apply([{
  id: `dust-${index}`, kind: 'landing-dust', mode: 'burst', strength: .8,
  timeMs: 1800 + index, lifetimeMs: 480,
}], { ...frame, requestedTimeMs: 1800 + index })
assert.ok(vfx.snapshot().activeTotal <= 64)
vfx.dispose()
vfx.dispose()
assert.equal(vfx.snapshot().disposed, true)
```

补充 sustain 拖尾更新、急停粒子、过期回收、Geometry/Material 各释放一次、单类创建失败不阻塞其他效果、非有限强度忽略和无额外 RAF。

- [ ] **步骤 2：运行定向脚本确认红灯**

运行：`corepack pnpm run test:studio-complex-biped-root-motion-runtime`

预期：FAIL，VFX controller 未实现。

- [ ] **步骤 3：实现有界对象池**

控制器返回一个普通 Three `Group`，由现有 renderer 作为角色 primitive 的同级对象挂入同一父场景。四类效果分别复用固定 Geometry/Material；尘点和火花使用 `InstancedMesh`。硬预算：总活动实例 64、单次 burst 16、拖尾 8、最大寿命 1200ms。`apply(signals, frame)` 使用动作时间更新，不调用 `Date.now()` 或 `requestAnimationFrame()`。

帧输入固定为：

```ts
export interface ComplexBipedMotionVfxFrame {
  requestedTimeMs: number
  position: readonly [number, number, number]
  facingRadians: number
}
```

实例位置使用角色容器在父级坐标系中的最终位置；burst 捕获后保持在父级世界位置，不继续跟随角色。reset 清除活动实例但保留池，dispose 释放全部 GPU 资源并从父级移除 `Group`。

- [ ] **步骤 4：验证资源和性能边界后提交**

```bash
corepack pnpm run test:studio-complex-biped-root-motion-runtime
corepack pnpm --filter @nova/playground typecheck
git add apps/playground/app/three/complex-biped-motion-vfx.ts scripts/test-studio-complex-biped-root-motion-runtime.ts .ai/project-state.json docs/zh-CN/AI开发交接.md
git commit -m "实现复杂模型确定性运动特效"
git push origin agent/cloud-fox-studio-v0610
```

### 任务 7：渲染生命周期、简单模式互斥与新手设置

**文件：**

- 修改：`apps/playground/app/components/studio/ComplexBipedPetRenderer.vue`
- 创建：`apps/playground/app/components/studio/StudioRootMotionSettings.vue`
- 修改：`apps/playground/app/pages/studio/motion.vue`
- 修改：`apps/playground/app/stores/studio-motion-editor.ts`
- 创建：`scripts/check-studio-complex-biped-root-motion.mjs`
- 修改：`package.json`
- 修改：`.ai/project-state.json`
- 修改：`docs/zh-CN/AI开发交接.md`

- [ ] **步骤 1：写静态门禁和 Store 失败测试**

门禁必须验证：复杂 renderer 创建一个 Root Motion/VFX 链路并把 VFX `Group` 作为同级 primitive；创建失败按 VFX、动作控制器、角色 runtime 逆序尽力清理；Clip 切换、无动作、blocked、停止和卸载均 reset/dispose；Simple renderer、`ProceduralPet` 和 `CloudFoxStudioCanvas` 的简单分支不得创建复杂控制器、第二 Canvas 或 RAF。

Store 测试要求 `updateRootMotionSettings({ mode: 'travel', autoVfx: true })` 只更新当前草稿的 `yk-pets/biped-motion/v1.rootMotion`，保留 contacts、events 和未知扩展字段，且进入撤销栈。

- [ ] **步骤 2：运行门禁确认红灯**

在 `package.json` 增加：

```json
"check:studio-complex-biped-root-motion": "node scripts/check-studio-complex-biped-root-motion.mjs"
```

运行：

```bash
corepack pnpm run check:studio-complex-biped-root-motion
corepack pnpm run test:studio-model-variants
```

预期：FAIL，renderer 生命周期和 Store API 尚未接线。

- [ ] **步骤 3：接入 renderer 生命周期**

创建角色 runtime 后创建动作控制器与 VFX controller；模板增加：

```vue
<primitive v-if="runtime" :key="runtime.object.uuid" :object="runtime.object" :dispose="false" />
<primitive v-if="motionVfxObject" :key="motionVfxObject.uuid" :object="motionVfxObject" :dispose="false" />
```

动作控制器每帧返回 VFX 信号，renderer 立即交给 VFX controller。任何创建阶段异常都解除 shallowRef，再独立尝试释放已取得资源并产生有限中文诊断。时间变化只采样/apply，不重建任何控制器。

- [ ] **步骤 4：实现中文新手设置**

`StudioRootMotionSettings` 只显示：

- 移动方式：`原地播放` / `实际移动`；
- 自动特效开关；
- 只读摘要：预计移动距离、转向和跳跃高度；
- `恢复动作推荐值` 按钮。

组件不得暴露窗口数组、速度阈值、粒子数量或骨骼术语。复杂模式显示“系统将根据体型、脚步接触和动作速度自动修正”；简单模式显示兼容提示但仍可保存动作元数据。

- [ ] **步骤 5：运行门禁、Store 和构建验证**

```bash
corepack pnpm run check:studio-complex-biped-root-motion
corepack pnpm run test:studio-model-variants
corepack pnpm run test:studio-complex-biped-root-motion-runtime
corepack pnpm --filter @nova/playground typecheck
corepack pnpm build:playground
```

预期：全部通过；构建只允许记录已经存在的 sourcemap/PURE/大 chunk 警告。

- [ ] **步骤 6：提交推送**

```bash
git add apps/playground/app/components/studio/ComplexBipedPetRenderer.vue apps/playground/app/components/studio/StudioRootMotionSettings.vue apps/playground/app/pages/studio/motion.vue apps/playground/app/stores/studio-motion-editor.ts scripts/check-studio-complex-biped-root-motion.mjs package.json .ai/project-state.json docs/zh-CN/AI开发交接.md
git commit -m "接入RootMotion特效与新手设置"
git push origin agent/cloud-fox-studio-v0610
```

### 任务 8：全量验证、浏览器验收与阶段交付

**文件：**

- 修改：`.ai/project-state.json`
- 修改：`.ai/visual-cases.json`
- 修改：`docs/zh-CN/项目状态.md`
- 修改：`docs/zh-CN/工坊工作区.md`
- 修改：`docs/zh-CN/工坊工作区验收.md`
- 修改：`docs/zh-CN/AI开发交接.md`
- 修改：`docs/en/AI-DEVELOPMENT-HANDOFF.md`
- 修改：`scripts/check-ai-handoff.mjs`

- [ ] **步骤 1：先更新硬门禁的预期交付状态**

只有前七个任务全部通过后，才把以下状态改为 `true`：

```json
{
  "bipedPetRootMotionComplete": true,
  "bipedPetMotionVfxComplete": true,
  "bipedPetRootMotionRuntimeWiringComplete": true,
  "bipedPetMotionVfxRuntimeComplete": true,
  "bipedPetRootMotionVfxPhaseDeliveryComplete": true
}
```

`bipedPetProductionQuadrupedProfileComplete`、`bipedPetProductionMechProfileComplete`、`bipedPetHighDetailTopologyComplete` 和 `crossBrowserGpuManualAcceptanceComplete` 必须保持 `false`。`nextPhase` 更新为 `biped-pet-advanced-choreography-warping-and-cross-browser-acceptance`。

- [ ] **步骤 2：运行完整自动验证**

```bash
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build:playground
node scripts/check-documentation.mjs
node scripts/check-ai-handoff.mjs
git diff --check
```

预期：全部通过；记录每条命令的真实结果和构建警告，不得把结构态 AI 门禁表述为真实 PR 历史门禁。

- [ ] **步骤 3：执行模拟 Pull Request 历史门禁**

创建临时 `pull_request` 事件 JSON，base 使用 `agent/yk-pets-rebrand-v0610`，head 使用当前 HEAD，通过 `GITHUB_EVENT_NAME=pull_request GITHUB_EVENT_PATH=<临时文件> node scripts/check-ai-handoff.mjs` 运行。临时文件位于 `mktemp -d` 目录，结束后删除该具体临时目录。

预期：当前批次每个修改 `apps/` 或 `packages/` 的提交都同时包含 `.ai/project-state.json` 与至少一个交接上下文，历史门禁通过；不得新增宽泛例外。

- [ ] **步骤 4：桌面浏览器验收**

在 Chromium 1440×900：

1. 复杂模式播放行走至少两个周期，确认位移连续、步幅随体型工作、支撑脚无明显滑动；
2. 播放冲刺急停，确认加速、拖尾、制动、火花与重心回正；
3. 播放起跳落地，确认双脚释放、连续弹道、落地压缩、冲击环与尘点只触发一次；
4. 验证暂停保持、停止归零、从后向前回拖不生成反向速度/重复特效、动作切换无旧速度或旧粒子；
5. 切换简单/复杂模式，确认简单模式不创建复杂 Root Motion/VFX；
6. 检查 `scrollWidth === clientWidth`、控制台无 error、无 hydration mismatch。

- [ ] **步骤 5：窄屏浏览器验收**

在 Chromium 760×900 重复行走、冲刺、跳跃、暂停/停止和模式切换，确认新手设置单列重排、无横向溢出、Canvas 与浮动按钮不遮挡关键控制。该结果不能替代 Safari、Firefox 或不同 GPU/WebGL。

- [ ] **步骤 6：同步文档与视觉案例**

视觉案例 `biped-pet-root-motion-motion-vfx` 必须同时记录 `passed-*` Chromium 结果和 `pending:` 跨浏览器/GPU/高细节拓扑边界。项目状态和中英文交接必须说明 Root Motion 的所有权、VFX 预算、实际动作范围、测试结果与已知限制。

- [ ] **步骤 7：最终提交推送并更新 PR**

```bash
git add .ai/project-state.json .ai/visual-cases.json docs/zh-CN/项目状态.md docs/zh-CN/工坊工作区.md docs/zh-CN/工坊工作区验收.md docs/zh-CN/AI开发交接.md docs/en/AI-DEVELOPMENT-HANDOFF.md scripts/check-ai-handoff.mjs
git commit -m "完成双足萌宠RootMotion与运动特效"
git push origin agent/cloud-fox-studio-v0610
```

更新 PR #7 的标题、HEAD、验证结果、浏览器证据、剩余边界和下一阶段；保持 Open，不执行合并。

## 最终交付清单

- Root Motion 契约与旧动作原地兼容；
- 帧率无关的累计位移、转向和跳跃弹道；
- 行走、冲刺急停、起跳落地的语义数据；
- FK、Root Motion、重心、IK、VFX 的唯一顺序和明确所有权；
- 有界对象池、无第二 Canvas/Skeleton/RAF；
- 中文新手设置，不暴露骨骼与粒子底层参数；
- 全量类型检查、测试、构建、文档与真实 PR 历史门禁；
- Chromium 双视口功能证据；
- 跨浏览器 GPU、高细节拓扑、四足/机甲和复杂动作目标对齐继续保持未完成。
