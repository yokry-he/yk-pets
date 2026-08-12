# 双足与多骨骼链混合 IK 实施计划

> **供代理开发者使用：** 必须使用 `executing-plans` 按任务执行；每项功能遵循测试驱动开发，先观察预期失败，再写最小实现。每个任务独立提交并立即推送当前分支。

**目标：** 为复杂双足萌宠增加解析式腿部 IK、足底锁定和受约束 FABRIK 后备求解，使五个基础动作在不要求用户手工绑骨的情况下获得稳定接触，并保留未来人类、四足与机甲扩展接口。

**架构：** `pet-core` 负责 Profile 约束、纯数值解析式 IK、FABRIK 与确定性接触采样；Playground Three 层负责把求解结果应用到真实 Bone，并在现有 Quaternion FK 后执行足锁。解析失败仅回退单肢 FK，所有求解继续使用唯一 Canvas、Skeleton 和动作采样循环。

**技术栈：** TypeScript 5.9、Node Test Runner、Three.js、Vue 3、TresJS、Nuxt 4、Pinia、pnpm Workspace。

---

## 文件职责映射

- `packages/pet-core/src/character/rig-profile.ts`：混合 IK Profile 契约和结构校验。
- `packages/pet-core/src/character/biped-pet-profile.ts`：左右腿 IK 声明。
- `packages/pet-core/src/character/character-compiler.ts`：把已验证 IK 定义复制进编译结果。
- `packages/pet-core/src/motion/analytic-two-bone-ik.ts`：框架无关解析式两段链求解。
- `packages/pet-core/src/motion/constrained-fabrik.ts`：框架无关受约束多段链求解。
- `packages/pet-core/src/motion/biped-pet-motion-adapter.ts`：确定性接触阶段采样和动作身份。
- `apps/playground/app/domain/studio-basic-biped-motions.ts`：五个基础动作的接触区间与重心关键帧。
- `apps/playground/app/three/apply-complex-biped-ik.ts`：Three Bone 映射、足底锁定状态和混合求解。
- `apps/playground/app/three/apply-complex-biped-motion.ts`：固定执行顺序：FK 后调用 IK。
- `apps/playground/app/components/studio/ComplexBipedPetRenderer.vue`：Clip 变化时重置约束状态，并传入编译定义。
- `packages/pet-core/test/character-model.test.ts`：Profile 与编译结果回归。
- `packages/pet-core/test/hybrid-ik.test.ts`：解析式与 FABRIK 数值测试。
- `packages/pet-core/test/biped-pet-motion-adapter.test.ts`：接触阶段与时间边界测试。
- `scripts/test-studio-complex-biped-motion-runtime.ts`：Three FK、IK、足锁、回退和释放测试。
- `scripts/check-studio-complex-biped-motion.mjs`：运行时接线静态门禁。

### 任务 1：混合 IK Profile 契约

**文件：**

- 修改：`packages/pet-core/src/character/rig-profile.ts`
- 修改：`packages/pet-core/src/character/biped-pet-profile.ts`
- 测试：`packages/pet-core/test/character-model.test.ts`
- 修改：`.ai/project-state.json`
- 修改：`docs/zh-CN/AI开发交接.md`

- [ ] **步骤 1：先写失败测试**

在 `character-model.test.ts` 增加：

```ts
test('biped-pet/v1 为左右腿声明可验证的自动混合 IK', () => {
  const limbs = BIPED_PET_RIG_PROFILE.limbIk ?? []
  assert.deepEqual(limbs.map(item => item.id), ['leg.left', 'leg.right'])
  assert.ok(limbs.every(item => item.solver === 'auto'))
  assert.ok(limbs.every(item => item.boneIds.length >= 3))
  assert.deepEqual(validateRigProfile(BIPED_PET_RIG_PROFILE), [])
})

test('Rig Profile 会拒绝断裂链、未知接触点和非法 IK 限制', () => {
  const profile = { ...structuredClone(BIPED_PET_RIG_PROFILE), limbIk: [{
    id: 'broken', solver: 'auto' as const, boneIds: ['thigh.left', 'ankle.right'],
    contactId: 'missing', poleAxis: [0, 0, 0] as const, maxStretchRatio: 2,
    maxCorrectionRadians: Number.NaN, weight: -1,
  }] }
  const diagnostics = validateRigProfile(profile)
  assert.ok(diagnostics.some(item => item.includes('broken parent path')))
  assert.ok(diagnostics.some(item => item.includes('unknown contact')))
  assert.ok(diagnostics.some(item => item.includes('poleAxis')))
  assert.ok(diagnostics.some(item => item.includes('maxStretchRatio')))
  assert.ok(diagnostics.some(item => item.includes('weight')))
})
```

- [ ] **步骤 2：运行测试并确认红灯**

```bash
corepack pnpm --filter @yk-pets/pet-core test
```

预期：TypeScript/测试因 `limbIk` 和 `CharacterLimbIkDefinition` 尚不存在而失败。

- [ ] **步骤 3：实现最小契约和校验**

在 `rig-profile.ts` 增加：

```ts
export type CharacterIkSolver = 'analytic-two-bone' | 'fabrik' | 'auto'

export interface CharacterLimbIkDefinition {
  id: string
  solver: CharacterIkSolver
  boneIds: readonly string[]
  contactId: string
  poleAxis: RigVector3
  maxStretchRatio: number
  maxCorrectionRadians: number
  weight: number
}

limbIk?: readonly CharacterLimbIkDefinition[]
```

把上面的 `limbIk` 属性追加到现有 `CharacterRigProfile` 接口末尾，不改动已有字段。

校验要求：ID 唯一；`boneIds.length >= 3`；所有骨骼存在且按 Profile 父级形成连续路径；接触点存在；`poleAxis` 为非零有限向量；`maxStretchRatio` 在 `[0.8, 1]`；`maxCorrectionRadians` 在 `(0, π]`；`weight` 在 `[0, 1]`。

在 `biped-pet-profile.ts` 声明：

```ts
limbIk: [
  { id: 'leg.left', solver: 'auto', boneIds: ['thigh.left', 'knee.left', 'calf.left', 'ankle.left'], contactId: 'foot.left', poleAxis: [0, 0, 1], maxStretchRatio: 1, maxCorrectionRadians: .85, weight: 1 },
  { id: 'leg.right', solver: 'auto', boneIds: ['thigh.right', 'knee.right', 'calf.right', 'ankle.right'], contactId: 'foot.right', poleAxis: [0, 0, 1], maxStretchRatio: 1, maxCorrectionRadians: .85, weight: 1 },
],
```

- [ ] **步骤 4：运行测试并确认绿灯**

```bash
corepack pnpm --filter @yk-pets/pet-core test
corepack pnpm --filter @yk-pets/pet-core typecheck
```

- [ ] **步骤 5：同步 AI 状态、提交并推送**

```bash
git add packages/pet-core/src/character packages/pet-core/test/character-model.test.ts .ai/project-state.json docs/zh-CN/AI开发交接.md
git commit -m "定义混合IK肢体约束"
git push origin agent/cloud-fox-studio-v0610
```

### 任务 2：把 IK 定义编译进角色结果

**文件：**

- 修改：`packages/pet-core/src/character/character-compiler.ts`
- 测试：`packages/pet-core/test/character-model.test.ts`
- 修改：`.ai/project-state.json`
- 修改：`docs/zh-CN/AI开发交接.md`

- [ ] **步骤 1：先写失败测试**

```ts
test('角色编译结果携带独立克隆的混合 IK 定义', () => {
  const first = compileBipedPetCharacter(createBipedPetModelRecipe(200))
  const second = compileBipedPetCharacter(createBipedPetModelRecipe(200))
  assert.equal(first.status, 'ready')
  assert.deepEqual(first.limbIk.map(item => item.id), ['leg.left', 'leg.right'])
  assert.notEqual(first.limbIk, second.limbIk)
  assert.notEqual(first.limbIk[0]?.boneIds, second.limbIk[0]?.boneIds)
})
```

- [ ] **步骤 2：确认测试因 `CompiledCharacterModel.limbIk` 缺失而失败**

```bash
corepack pnpm --filter @yk-pets/pet-core test
```

- [ ] **步骤 3：实现编译复制**

增加 `CompiledCharacterLimbIk`，字段与 Profile 定义相同，但向量和数组均为可序列化独立副本。`ready` 结果从 `BIPED_PET_RIG_PROFILE.limbIk` 克隆；`blocked` 结果返回空数组；角色哈希包含 `limbIk`，避免约束变化复用旧编译摘要。

```ts
limbIk: CompiledCharacterLimbIk[]
```

把上面的 `limbIk` 属性追加到现有 `CompiledCharacterModel` 接口；所有 ready/blocked 构造路径都必须显式赋值。

- [ ] **步骤 4：验证编译、确定性和类型**

```bash
corepack pnpm --filter @yk-pets/pet-core test
corepack pnpm --filter @yk-pets/pet-core typecheck
```

- [ ] **步骤 5：提交并推送**

```bash
git add packages/pet-core/src/character/character-compiler.ts packages/pet-core/test/character-model.test.ts .ai/project-state.json docs/zh-CN/AI开发交接.md
git commit -m "编译角色混合IK定义"
git push origin agent/cloud-fox-studio-v0610
```

### 任务 3：解析式 Two Bone IK

**文件：**

- 新建：`packages/pet-core/src/motion/analytic-two-bone-ik.ts`
- 新建：`packages/pet-core/test/hybrid-ik.test.ts`
- 修改：`packages/pet-core/src/index.ts`
- 修改：`.ai/project-state.json`
- 修改：`docs/zh-CN/AI开发交接.md`

- [ ] **步骤 1：先写可达、不可达和退化输入测试**

```ts
const distance = (left: readonly number[], right: readonly number[]) => Math.hypot(
  left[0]! - right[0]!, left[1]! - right[1]!, left[2]! - right[2]!,
)

test('解析式两段 IK 到达目标并保持段长', () => {
  const result = solveAnalyticTwoBoneIk({
    root: [0, 0, 0], mid: [0, -1, 0], tip: [0, -2, 0],
    target: [.7, -1.4, .2], pole: [0, 0, 1], maxStretchRatio: 1,
  })
  assert.equal(result.status, 'solved')
  assert.ok(distance(result.tip, [.7, -1.4, .2]) < 1e-6)
  assert.ok(Math.abs(distance(result.root, result.mid) - 1) < 1e-8)
  assert.ok(Math.abs(distance(result.mid, result.tip) - 1) < 1e-8)
})

test('解析式两段 IK 钳制不可达目标且不产生非有限值', () => {
  const result = solveAnalyticTwoBoneIk({
    root: [0, 0, 0], mid: [0, -1, 0], tip: [0, -2, 0],
    target: [50, 0, 0], pole: [0, 0, 1], maxStretchRatio: 1,
  })
  assert.equal(result.status, 'clamped')
  assert.ok(result.positions.flat().every(Number.isFinite))
  assert.ok(distance(result.root, result.tip) <= 2 + 1e-8)
})

test('解析式两段 IK 对零长度或非有限输入安全阻塞', () => {
  assert.equal(solveAnalyticTwoBoneIk({ root: [0, 0, 0], mid: [0, 0, 0], tip: [0, 0, 0], target: [1, 0, 0], pole: [0, 0, 1], maxStretchRatio: 1 }).status, 'blocked')
  assert.equal(solveAnalyticTwoBoneIk({ root: [0, 0, 0], mid: [0, -1, 0], tip: [0, -2, 0], target: [NaN, 0, 0], pole: [0, 0, 1], maxStretchRatio: 1 }).status, 'blocked')
})
```

- [ ] **步骤 2：确认缺少求解器时红灯**

```bash
corepack pnpm --filter @yk-pets/pet-core test
```

- [ ] **步骤 3：实现纯数值解析解**

公开接口固定为：

```ts
export interface AnalyticTwoBoneIkInput {
  root: RigVector3
  mid: RigVector3
  tip: RigVector3
  target: RigVector3
  pole: RigVector3
  maxStretchRatio: number
}

export interface AnalyticTwoBoneIkResult {
  status: 'solved' | 'clamped' | 'blocked'
  root: RigVector3
  mid: RigVector3
  tip: RigVector3
  positions: readonly RigVector3[]
  error: number
}
```

实现使用余弦定理求根关节夹角，以 Root→Target 为主轴、正交化 Pole 为弯曲方向。目标距离钳制在 `abs(upperLength-lowerLength)+1e-6` 到 `(upperLength+lowerLength)*maxStretchRatio`；共线 Pole 使用稳定的最小分量正交轴；任何非有限结果返回 `blocked`。

- [ ] **步骤 4：验证数值测试和全部 pet-core 回归**

```bash
corepack pnpm --filter @yk-pets/pet-core test
corepack pnpm --filter @yk-pets/pet-core typecheck
```

- [ ] **步骤 5：提交并推送**

```bash
git add packages/pet-core/src/motion/analytic-two-bone-ik.ts packages/pet-core/test/hybrid-ik.test.ts packages/pet-core/src/index.ts .ai/project-state.json docs/zh-CN/AI开发交接.md
git commit -m "实现解析式两段链IK"
git push origin agent/cloud-fox-studio-v0610
```

### 任务 4：受约束 FABRIK 后备求解器

**文件：**

- 新建：`packages/pet-core/src/motion/constrained-fabrik.ts`
- 修改：`packages/pet-core/test/hybrid-ik.test.ts`
- 修改：`packages/pet-core/src/index.ts`
- 修改：`.ai/project-state.json`
- 修改：`docs/zh-CN/AI开发交接.md`

- [ ] **步骤 1：先写失败测试**

```ts
test('FABRIK 多段链收敛并保持每段长度', () => {
  const input = [[0, 0, 0], [0, -1, 0], [0, -2, 0], [0, -3, 0]] as const
  const result = solveConstrainedFabrik({ positions: input, target: [1.2, -2.2, .3], pole: [0, 0, 1], maxIterations: 8, tolerance: 1e-4, maxStretchRatio: 1 })
  assert.equal(result.status, 'solved')
  assert.ok(result.error <= 1e-4)
  for (let index = 1; index < result.positions.length; index++) {
    assert.ok(Math.abs(distance(result.positions[index - 1]!, result.positions[index]!) - 1) < 1e-6)
  }
})

test('FABRIK 对不可达目标使用有限的最大伸展结果', () => {
  const result = solveConstrainedFabrik({ positions: [[0, 0, 0], [0, -1, 0], [0, -2, 0]], target: [20, 0, 0], pole: [0, 0, 1], maxIterations: 8, tolerance: 1e-4, maxStretchRatio: 1 })
  assert.equal(result.status, 'clamped')
  assert.ok(result.positions.flat().every(Number.isFinite))
})
```

- [ ] **步骤 2：确认测试因函数不存在而失败**

```bash
corepack pnpm --filter @yk-pets/pet-core test
```

- [ ] **步骤 3：实现有界 FABRIK**

```ts
export interface ConstrainedFabrikInput {
  positions: readonly RigVector3[]
  target: RigVector3
  pole: RigVector3
  maxIterations?: number
  tolerance?: number
  maxStretchRatio: number
}

export interface ConstrainedFabrikResult {
  status: 'solved' | 'clamped' | 'blocked'
  positions: readonly RigVector3[]
  iterations: number
  error: number
}
```

实现规则：复制输入；缓存初始段长；不可达时沿目标方向按原段长展开；可达时最多执行 8 次后向/前向迭代；每轮将内部关节点投影向 Pole 定义的弯曲半平面；误差达到 `1e-4` 即停止；不得修改输入数组；无效或零长度链返回 `blocked`。

- [ ] **步骤 4：运行测试和类型检查**

```bash
corepack pnpm --filter @yk-pets/pet-core test
corepack pnpm --filter @yk-pets/pet-core typecheck
```

- [ ] **步骤 5：提交并推送**

```bash
git add packages/pet-core/src/motion/constrained-fabrik.ts packages/pet-core/test/hybrid-ik.test.ts packages/pet-core/src/index.ts .ai/project-state.json docs/zh-CN/AI开发交接.md
git commit -m "实现受约束FABRIK求解"
git push origin agent/cloud-fox-studio-v0610
```

### 任务 5：确定性接触阶段与基础动作接触数据

**文件：**

- 修改：`packages/pet-core/src/motion/biped-pet-motion-adapter.ts`
- 修改：`packages/pet-core/test/biped-pet-motion-adapter.test.ts`
- 修改：`apps/playground/app/domain/studio-basic-biped-motions.ts`
- 修改：`scripts/test-studio-built-in-assets.ts`
- 修改：`.ai/project-state.json`
- 修改：`docs/zh-CN/AI开发交接.md`

- [ ] **步骤 1：先写接触采样和模板失败测试**

```ts
test('接触采样在淡入、锁定、淡出和循环边界保持确定性', () => {
  const walkAsset = createStudioMotionAsset({
    id: 'walk-contact-fixture', nameZh: '行走接触测试', nameEn: 'Walk contact fixture',
    durationMs: 1200, loopMode: 'loop', tracks: [], createdAt: 1, updatedAt: 1,
    extensions: { 'yk-pets/biped-motion/v1': { contacts: [
      { contactId: 'foot.left', startMs: 0, endMs: 576, confidence: .9 },
      { contactId: 'foot.right', startMs: 600, endMs: 1176, confidence: .9 },
    ] } },
  })
  const clip = compileBipedPetMotion(walkAsset)
  const entering = sampleBipedPetMotion(clip, 40).contactStates.find(item => item.contactId === 'foot.left')!
  const locked = sampleBipedPetMotion(clip, 200).contactStates.find(item => item.contactId === 'foot.left')!
  const leaving = sampleBipedPetMotion(clip, 540).contactStates.find(item => item.contactId === 'foot.left')!
  assert.equal(entering.phase, 'acquiring')
  assert.equal(locked.phase, 'locked')
  assert.equal(leaving.phase, 'releasing')
  assert.deepEqual(sampleBipedPetMotion(clip, 1240).contactStates, sampleBipedPetMotion(clip, 40).contactStates)
})
```

在 `test-studio-built-in-assets.ts` 断言待机、招手全程双脚接触；跳跃包含蓄力接触、腾空空窗和落地接触；行走含左右交替及短双支撑。

- [ ] **步骤 2：确认 `contactStates` 缺失导致红灯**

```bash
corepack pnpm --filter @yk-pets/pet-core test
corepack pnpm run test:studio-built-in-assets
```

- [ ] **步骤 3：实现兼容接触状态**

```ts
export interface SampledBipedPetContactState {
  contactId: string
  phase: 'acquiring' | 'locked' | 'releasing'
  weight: number
  confidence: number
}

export interface SampledBipedPetMotion {
  sourceMotionId: string
  clipHash: string
  durationMs: number
  loopMode: StudioMotionLoopMode
  resolvedTimeMs: number
  contactStates: readonly SampledBipedPetContactState[]
}
```

把新增身份字段和 `contactStates` 追加到现有接口；原有 `bones`、`rootPosition` 与 `activeContacts` 字段原样保留。

淡入淡出固定为 80ms，并裁剪到接触区间长度的一半。`activeContacts` 继续返回权重大于 0 的 ID。blocked Clip 返回身份字段、空姿态和空接触，不能抛异常。

补齐五模板接触区间，并只调整与重心直接相关的 `root.position`、`body.rotation` 和腿部轨道；不改动作名称、ID、时长或道具依赖。

- [ ] **步骤 4：验证领域和内置资产**

```bash
corepack pnpm --filter @yk-pets/pet-core test
corepack pnpm run test:studio-built-in-assets
corepack pnpm --filter @nova/playground typecheck
```

- [ ] **步骤 5：提交并推送**

```bash
git add packages/pet-core/src/motion/biped-pet-motion-adapter.ts packages/pet-core/test/biped-pet-motion-adapter.test.ts apps/playground/app/domain/studio-basic-biped-motions.ts scripts/test-studio-built-in-assets.ts .ai/project-state.json docs/zh-CN/AI开发交接.md
git commit -m "完善基础动作足底接触阶段"
git push origin agent/cloud-fox-studio-v0610
```

### 任务 6：Three 混合 IK 与足底锁定控制器

**文件：**

- 新建：`apps/playground/app/three/apply-complex-biped-ik.ts`
- 修改：`apps/playground/app/three/apply-complex-biped-motion.ts`
- 修改：`scripts/test-studio-complex-biped-motion-runtime.ts`
- 修改：`.ai/project-state.json`
- 修改：`docs/zh-CN/AI开发交接.md`

- [ ] **步骤 1：先写失败的真实 Bone 回归**

在现有 runtime 测试中增加：

```ts
import { Vector3 } from 'three'

function readContactWorld(runtime: ComplexBipedPetObject, compilation: CompiledCharacterModel, contactId: string) {
  const contact = compilation.contacts.find(item => item.id === contactId)!
  const bone = runtime.bonesById.get(contact.boneId)!
  runtime.object.updateMatrixWorld(true)
  return new Vector3(...contact.localPosition).applyMatrix4(bone.matrixWorld)
}

function readBoneQuaternions(runtime: ComplexBipedPetObject) {
  return Object.fromEntries([...runtime.bonesById].map(([id, bone]) => [id, bone.quaternion.toArray()]))
}

const { runtime, compilation } = createRuntime()
const walk = BASIC_BIPED_STUDIO_MOTIONS.find(item => item.id === 'builtin-biped-walk')
assert.ok(walk)
const walkClip = compileBipedPetMotion(walk, { boneIds: compilation.bones.map(item => item.id) })
const bindQuaternions = readBoneQuaternions(runtime)
const controller = createComplexBipedMotionController(runtime, compilation)
const start = sampleBipedPetMotion(walkClip, 100)
const later = sampleBipedPetMotion(walkClip, 320)
controller.apply(start)
const lockedTarget = readContactWorld(runtime, compilation, 'foot.left')
controller.apply(later)
const lockedLater = readContactWorld(runtime, compilation, 'foot.left')
assert.ok(lockedTarget.distanceTo(lockedLater) < 1e-3)

controller.reset()
controller.apply(later, 0)
assert.deepEqual(readBoneQuaternions(runtime), bindQuaternions)
```

再覆盖：左右脚互不污染、时间倒退清锁、动作哈希切换清锁、缺腿链回退 FK、FABRIK 强制路径、重复 `dispose()` 和释放后拒绝写入。

- [ ] **步骤 2：确认足底误差和新构造参数测试失败**

```bash
corepack pnpm run test:studio-complex-biped-motion-runtime
```

- [ ] **步骤 3：实现足底锁定控制器**

公开内部接口：

```ts
export interface ComplexBipedIkController {
  apply(sample: SampledBipedPetMotion, weight: number): void
  reset(): void
  diagnostics(): readonly string[]
  dispose(): void
}

export function createComplexBipedIkController(
  runtime: ComplexBipedPetObject,
  compilation: CompiledCharacterModel,
): ComplexBipedIkController
```

实现要求：

1. 从编译结果解析关节、接触点和左右腿约束，初始化时预分配 Three `Vector3`、`Quaternion` 和 `Matrix4` 临时对象；
2. 每次 `apply` 在 FK 已写入后读取足底世界变换；
3. 接触进入捕获目标；时间倒退、跳变、循环、Clip hash 改变或 `reset` 时清锁；
4. 双支撑先将骨盆局部 Y 修正钳制到 `[-0.08, 0.08]`；
5. `auto` 对合法两段映射使用 `solveAnalyticTwoBoneIk`，否则对完整 `boneIds` 使用 `solveConstrainedFabrik`；
6. 用当前段方向到目标段方向的 `Quaternion.setFromUnitVectors` 生成世界修正，再转换到父空间并以 `maxCorrectionRadians`、Profile weight、动作 weight、接触 weight 和 confidence 混合；
7. 求解后补偿脚踝/脚部朝向，更新 `runtime.object.updateMatrixWorld(true)`；
8. 单肢失败只记录一次诊断并保持该肢 FK；不得修改动作资产或编译结果。

修改动作控制器构造为：

```ts
export function createComplexBipedMotionController(
  runtime: ComplexBipedPetObject,
  compilation?: CompiledCharacterModel,
): ComplexBipedMotionController
```

存在合法 `compilation` 时创建 IK 控制器；`apply` 先执行现有 FK，再调用 IK；`reset` 和 `dispose` 同步清理 IK。无 compilation 时保持旧测试和纯 FK 兼容。

- [ ] **步骤 4：运行 runtime、pet-core 和类型检查**

```bash
corepack pnpm run test:studio-complex-biped-motion-runtime
corepack pnpm --filter @yk-pets/pet-core test
corepack pnpm --filter @nova/playground typecheck
```

- [ ] **步骤 5：提交并推送**

```bash
git add apps/playground/app/three/apply-complex-biped-ik.ts apps/playground/app/three/apply-complex-biped-motion.ts scripts/test-studio-complex-biped-motion-runtime.ts .ai/project-state.json docs/zh-CN/AI开发交接.md
git commit -m "实现复杂模型混合IK与足底锁定"
git push origin agent/cloud-fox-studio-v0610
```

### 任务 7：复杂 renderer 生命周期接线与门禁

**文件：**

- 修改：`apps/playground/app/components/studio/ComplexBipedPetRenderer.vue`
- 修改：`scripts/check-studio-complex-biped-motion.mjs`
- 修改：`.ai/project-state.json`
- 修改：`docs/zh-CN/AI开发交接.md`

- [ ] **步骤 1：先扩展静态门禁并观察失败**

要求门禁检查：renderer 使用当前 `compilation` 创建动作控制器；Clip 变化会先重置足锁再应用新样本；模型重建和卸载释放控制器；时间变化只采样，不重建 runtime；Simple 模式仍不创建复杂 IK。

```bash
corepack pnpm run check:studio-complex-biped-motion
```

预期：缺少 compilation 参数或重置接线而失败。

- [ ] **步骤 2：实现生命周期接线**

```ts
motionController.value = createComplexBipedMotionController(runtime.value, compilation)
```

`compileMotion()` 在替换 `motionClip` 前调用控制器 `reset()`；blocked/no-motion 分支恢复绑定姿态并清锁；异常捕获路径先释放已经创建的 runtime/controller，再向 Canvas 发 blocked 诊断，避免复杂对象泄漏。

- [ ] **步骤 3：验证接线、runtime 与构建**

```bash
corepack pnpm run check:studio-complex-biped-motion
corepack pnpm run test:studio-complex-biped-motion-runtime
corepack pnpm --filter @nova/playground typecheck
corepack pnpm build:playground
```

- [ ] **步骤 4：提交并推送**

```bash
git add apps/playground/app/components/studio/ComplexBipedPetRenderer.vue scripts/check-studio-complex-biped-motion.mjs .ai/project-state.json docs/zh-CN/AI开发交接.md
git commit -m "接入复杂模型足底约束生命周期"
git push origin agent/cloud-fox-studio-v0610
```

### 任务 8：阶段验证、文档和浏览器验收

**文件：**

- 修改：`docs/zh-CN/项目状态.md`
- 修改：`docs/zh-CN/工坊工作区.md`
- 修改：`docs/zh-CN/AI开发交接.md`
- 修改：`docs/en/AI-DEVELOPMENT-HANDOFF.md`
- 修改：`.ai/project-state.json`
- 修改：`.ai/visual-cases.json`
- 修改：`scripts/check-ai-handoff.mjs`

- [ ] **步骤 1：同步真实完成边界**

仅在自动和浏览器验证通过后将 `bipedPetRuntimeIkComplete`、`bipedPetFootLockComplete`、`bipedPetConstrainedFabrikFoundationComplete` 标为 true。`bipedPetRootMotionComplete`、`bipedPetMotionVfxComplete`、正式四足/机甲 Profile、高细节拓扑和跨浏览器 GPU 验收继续为 false。

- [ ] **步骤 2：执行完整自动验证**

```bash
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build:playground
node scripts/check-documentation.mjs
node scripts/check-ai-handoff.mjs
git diff --check
```

预期全部退出码为 0；只允许项目已记录的 Nuxt module-preload sourcemap、VueUse PURE 注释和大 chunk 警告。

- [ ] **步骤 3：执行 Chrome 真实功能验收**

在 1440×900 和 760×900：

1. 复杂模式逐个播放待机、行走、起跳落地、招手、直拳；
2. 比较支撑阶段足底世界位置，确认没有明显横向滑动或上下漂移；
3. 检查膝盖方向、脚踝朝向、落地穿插和双支撑骨盆补偿；
4. 验证播放、暂停、停止、时间倒退拖动和动作切换不会继承旧锁点；
5. 切换简单/复杂模式，确认简单模型不消费复杂 IK；
6. 确认无横向溢出、控制台 error 或 hydration mismatch。

把功能性通过项和仍待跨浏览器/GPU/最终像素检查写入 `.ai/visual-cases.json`，不得扩大验收结论。

- [ ] **步骤 4：运行 PR 提交历史门禁**

以当前 HEAD 构造本地 `pull_request` 事件执行 `scripts/check-ai-handoff.mjs`，确认每个功能提交都包含 `.ai/project-state.json` 和交接上下文。

- [ ] **步骤 5：最终审查、提交并推送**

```bash
git add docs .ai scripts/check-ai-handoff.mjs
git commit -m "完成双足萌宠混合IK与足底锁定"
git push origin agent/cloud-fox-studio-v0610
```

最终交付报告必须包含：提交哈希、远程分支、PR、数值误差测试、Three runtime 足锁证据、浏览器视口和控制台证据、构建警告，以及仍未完成的 Root Motion、特效、高细节拓扑、其他正式 Profile 和跨浏览器 GPU 验收。
