# 双足萌宠混合 Root Motion 与运动特效实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为复杂双足萌宠建立由动作意图、角色体型、接触约束和确定性运动信号共同驱动的 Root Motion、重心转移与轻量 VFX 链路，使行走、冲刺急停和起跳落地在站内编辑与渲染时获得连续、可复现的真实位移。

**Architecture:** `pet-core` 负责版本兼容的移动描述、纯数值 Root Motion 采样和 VFX 信号；Playground Three 层只负责把绝对累计变换应用到现有角色对象、在 FK 后叠加有界重心补偿、继续执行现有 IK，并在同一场景维护有界 VFX 对象池。Studio 通过中文语义设置自动生成扩展数据，旧动作缺少扩展时保持原地播放。

**Tech Stack:** TypeScript 5.9、Node.js test runner、Vue 3、Pinia、Nuxt 4、Three.js、TresJS、pnpm 11。

---

## 文件职责映射

- `packages/pet-core/src/motion/biped-pet-root-motion.ts`：Root Motion 契约、规范化、累计采样、时间连续性和安全预算。
- `packages/pet-core/src/motion/biped-pet-motion-vfx.ts`：由速度、减速度、接触和语义标签生成确定性 VFX 信号。
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
- 修改：`packages/pet-core/test/biped-pet-root-motion.test.ts`
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
  previousRequestedTimeMs: 300,
  durationMs: 1200,
  loopMode: 'loop' as const,
  characterHeight: 4,
  facingRadians: 0,
  actionWeight: 1,
  footResidual: [0, 0, 0] as const,
}
const half = sampleBipedPetRootMotion(input)
assert.equal(half.status, 'solved')
assert.ok(Math.abs(half.cumulativeLocal[0] - .84) < 1e-9)

const thirty = sampleBipedPetRootMotion({ ...input, previousRequestedTimeMs: 0, requestedTimeMs: 600 })
const sixty = sampleBipedPetRootMotion({ ...input, previousRequestedTimeMs: 300, requestedTimeMs: 600 })
assert.deepEqual(thirty.cumulativeLocal, sixty.cumulativeLocal)

const nextCycle = sampleBipedPetRootMotion({ ...input, previousRequestedTimeMs: 1190, requestedTimeMs: 1210 })
assert.ok(nextCycle.deltaLocal[0] > 0)
assert.equal(nextCycle.iteration, 1)

const rewind = sampleBipedPetRootMotion({ ...input, previousRequestedTimeMs: 800, requestedTimeMs: 200 })
assert.equal(rewind.status, 'reset')
assert.deepEqual(rewind.deltaLocal, [0, 0, 0])
```

再覆盖 `ballistic` 在 takeoff/peak/landing 的连续高度与有限速度、角色高度等比例缩放、单帧移动/转向钳制、非有限输入 `blocked`、输入不突变和普通回拖不生成反向速度。

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
  deltaLocal: readonly [number, number, number]
  deltaWorld: readonly [number, number, number]
  cumulativeTurnRadians: number
  deltaTurnRadians: number
  linearVelocity: readonly [number, number, number]
  angularVelocity: number
  phase: 'grounded' | 'takeoff' | 'airborne' | 'landing'
  motionIntensity: number
  landingImpulse: number
  brakeIntensity: number
}
```

累计值必须由动作定义、`requestedTimeMs` 和 `iteration` 直接计算，不能依赖逐帧积分；增量才使用前一时间求差。窗口使用 `smoothstep(t)=t²(3-2t)`，多个有效窗口按权重归一化。弹道高度使用 `4h·p·(1-p)`，只在 `ballistic` 窗口生效。连续 loop 允许迭代递增，倒退、Clip 身份变化由调用方以 `previousRequestedTimeMs=undefined` 或较大负差触发 reset。

安全预算固定为每帧不超过 `0.25 × characterHeight` 位移和 `π/4` 转向；超过时按方向等比钳制并返回 `clamped`，不改变累计目标。

- [ ] **步骤 4：运行数值测试与随机边界探针**

运行：

```bash
corepack pnpm --filter @yk-pets/pet-core test
node --import ./packages/pet-core/test/register-ts-loader.mjs --experimental-strip-types --input-type=module -e "import('./packages/pet-core/src/index.ts').then(({sampleBipedPetRootMotion})=>{for(let i=0;i<10000;i++){const t=i%2400;const r=sampleBipedPetRootMotion({definition:{mode:'travel',distance:.42,turnRadians:.2,verticalMode:'grounded',jumpHeight:0,windows:[{id:'w',kind:'travel',startMs:0,endMs:1200,weight:1}],vfxTags:[]},requestedTimeMs:t,previousRequestedTimeMs:Math.max(0,t-16),durationMs:1200,loopMode:'loop',characterHeight:4,facingRadians:0,actionWeight:1,footResidual:[0,0,0]});if(![...r.cumulativeWorld,...r.deltaWorld,r.angularVelocity].every(Number.isFinite))throw Error('non-finite')}console.log('root-motion probe: PASS')})"
```

预期：单元测试通过，探针输出 `root-motion probe: PASS`。

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

`landing-ring` 阈值为落地冲量 `.25`，`landing-dust` 为 `.4`，`speed-trail` 为运动强度 `.55`，`brake-sparks` 为急停强度 `.45`。burst ID 使用 `${clipHash}:${kind}:${Math.round(requestedTimeMs)}`，sustain ID 使用 `${clipHash}:${kind}:active`。`reset/blocked`、时间倒退或未授权标签返回空数组。

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
        { id: 'sprint', kind: 'travel', startMs: 0, endMs: 6300, weight: 1 },
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

预期：通过；11 个内置动作数量、时长、轨道和道具依赖不变。

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

- [ ] **步骤 1：写所有权、顺序和生命周期失败测试**

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

再覆盖不同帧率到同一时间得到相同容器变换、暂停重复 apply 不继续移动、停止/回拖/Clip 切换清速度、角色尺寸改变步幅、双/单支撑重心、跳跃腾空不锁脚、Root Motion blocked 时保留 FK/IK、重复 dispose 和释放后拒绝写入。

- [ ] **步骤 2：运行新脚本确认红灯**

先在 `package.json` 增加：

```json
"test:studio-complex-biped-root-motion-runtime": "node --import ./packages/local-agent/node_modules/tsx/dist/loader.mjs scripts/test-studio-complex-biped-root-motion-runtime.ts"
```

运行：`corepack pnpm run test:studio-complex-biped-root-motion-runtime`

预期：FAIL，两个 Three 控制器尚不存在。

- [ ] **步骤 3：实现 Root Motion 控制器**

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

控制器保存 `runtime.object` 的绑定 position/quaternion，每帧根据纯函数的绝对累计值设置容器，而不是把 delta 反复相加。角色高度从已计算的 `runtime.object.geometry.boundingBox` 读取；无有效包围盒时阻塞 Root Motion 但不阻塞 FK。时间不连续时清除前一时间，只设置确定性累计姿态且不生成速度/VFX。

- [ ] **步骤 4：实现独立重心控制器和 IK 帧报告**

`ComplexBipedBalanceController` 只写 pelvis X/Z 和 chest 有界 Quaternion，范围分别不超过角色高度的 `.025` 和 `0.12rad`；reset/dispose 恢复绑定值。IK 控制器的 `apply()` 返回只读报告：

```ts
export interface ComplexBipedIkFrameReport {
  supportingContacts: number
  residualByLimb: Readonly<Record<string, number>>
  clampedLimbs: readonly string[]
}
```

报告不暴露 Bone 引用，也不改变现有有界诊断。动作控制器调用顺序必须是 `restoreBindPose → FK → rootMotion.apply → balance.apply → updateMatrixWorld → ik.apply`，并把上一帧有限残差作为下一帧 Root Motion 的有界修正输入。

- [ ] **步骤 5：验证当前 0.014 残差和所有权**

运行：

```bash
corepack pnpm run test:studio-complex-biped-motion-runtime
corepack pnpm run test:studio-complex-biped-root-motion-runtime
corepack pnpm --filter @nova/playground typecheck
```

预期：既有 IK 测试保持通过；行走 `100→320ms` 在 Root Motion 链路中的支撑脚残差低于 `1e-3`，纯 FK 对照更大；腿骨局部 position 与段长不变。

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
