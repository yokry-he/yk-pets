#!/usr/bin/env node
/**
 * 文件职责 / File responsibility
 * 校验 AI 交接包的机器状态、双语文档、ADR、视觉案例，并强制每个功能源码提交同步更新 AI 包。
 * Validates machine state, bilingual handoff docs, ADRs, visual cases, and enforces AI-package updates in every feature-source commit.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const read = relativePath => readFileSync(path.join(root, relativePath), 'utf8')
const requiredFiles = [
  '.ai/ENFORCEMENT_START',
  '.ai/project-state.json',
  '.ai/session-start.md',
  '.ai/visual-cases.json',
  'docs/zh-CN/AI开发交接.md',
  'docs/en/AI-DEVELOPMENT-HANDOFF.md',
  'docs/zh-CN/已知问题.md',
  'docs/en/KNOWN-ISSUES.md',
  'docs/zh-CN/AI开发路线图.md',
  'docs/en/AI-DEVELOPMENT-ROADMAP.md',
  'docs/zh-CN/adr/0001-统一工坊框架.md',
  'docs/en/adr/0001-unified-studio-shell.md',
  'docs/zh-CN/adr/0002-动作资产模型.md',
  'docs/en/adr/0002-motion-asset-model.md',
  'docs/zh-CN/adr/0003-道具资产模型.md',
  'docs/en/adr/0003-prop-asset-model.md',
  'docs/zh-CN/adr/0004-动作关键帧领域.md',
  'docs/en/adr/0004-motion-keyframe-domain.md',
  'docs/zh-CN/adr/0005-时间轴预览适配器.md',
  'docs/en/adr/0005-motion-timeline-preview-adapter.md',
  'docs/zh-CN/adr/0006-动作道具事件轨道.md',
  'docs/en/adr/0006-motion-prop-event-tracks.md',
  'docs/zh-CN/adr/0007-道具实体编辑器.md',
  'docs/en/adr/0007-prop-entity-editor.md',
  'docs/zh-CN/adr/0008-高级动作工具.md',
  'docs/en/adr/0008-advanced-motion-tools.md',
  'docs/zh-CN/adr/0009-动作直接操控.md',
  'docs/en/adr/0009-motion-direct-manipulation.md',
]
const contextPaths = new Set([
  '.ai/session-start.md',
  '.ai/visual-cases.json',
  'docs/zh-CN/AI开发交接.md',
  'docs/en/AI-DEVELOPMENT-HANDOFF.md',
  'docs/zh-CN/已知问题.md',
  'docs/en/KNOWN-ISSUES.md',
  'docs/zh-CN/AI开发路线图.md',
  'docs/en/AI-DEVELOPMENT-ROADMAP.md',
])
const legacyHistoryMigrationClosure = '813281b424e23edd8cb4ec9cff1e16cf9b74a2ce'
const legacyHistoryMigrationExceptions = new Map([
  ['7c07bfdcd70ad2ef5ffdf76be408785b3e623dad', {
    missing: ['project-state', 'handoff-context'],
    reason: '混合 IK Profile 边界修复提交遗漏 AI 包；由阶段收口提交补齐状态和双语交接。',
  }],
  ['59123c5e23004597f59ce2e3c4f819574e643479', {
    missing: ['project-state', 'handoff-context'],
    reason: 'blocked 角色 IK 编译修复提交遗漏 AI 包；由阶段收口提交补齐状态和双语交接。',
  }],
  ['bbf1861dea6d957630010d88a8561cc50c26c956', {
    missing: ['project-state', 'handoff-context'],
    reason: 'IK 编译安全复核提交遗漏 AI 包；由阶段收口提交补齐状态和双语交接。',
  }],
  ['63f479f968482decc3b68f4133f50e77810b0b1a', {
    missing: ['project-state'],
    reason: '循环接触连续性修复已更新交接但遗漏机器状态；由阶段收口提交补齐。',
  }],
  ['41ed499445c8f0e96d476e95dc180d21e2a36e11', {
    missing: ['project-state'],
    reason: '历史接触 Clip 兼容修复已更新交接但遗漏机器状态；由阶段收口提交补齐。',
  }],
])
const failures = []

for (const relativePath of requiredFiles) {
  const absolutePath = path.join(root, relativePath)
  if (!existsSync(absolutePath)) failures.push(`缺少 AI 交接文件 / Missing AI handoff file: ${relativePath}`)
  else if (statSync(absolutePath).size < 40) failures.push(`AI 交接文件内容过短 / AI handoff file is too short: ${relativePath}`)
}

let state
let visualCases
try { state = JSON.parse(read('.ai/project-state.json')) }
catch { failures.push('无法解析 .ai/project-state.json / Cannot parse .ai/project-state.json') }
try { visualCases = JSON.parse(read('.ai/visual-cases.json')) }
catch { failures.push('无法解析 .ai/visual-cases.json / Cannot parse .ai/visual-cases.json') }

if (state) {
  expect(state.schemaVersion === 1, 'project-state schemaVersion 必须为 1 / project-state schemaVersion must be 1')
  expect(state.repository === 'yokry-he/yk-pets', 'project-state 仓库错误 / project-state repository is incorrect')
  expect(state.developmentBranch === 'agent/cloud-fox-studio-v0610', 'project-state 开发分支错误 / project-state development branch is incorrect')
  expect(state.pullRequest === 7, 'project-state PR 必须为 #7 / project-state PR must be #7')
  expect(state.baseBranch === 'agent/yk-pets-rebrand-v0610', 'project-state 目标分支错误 / project-state base branch is incorrect')
  expect(state.mergeAllowed === false, 'project-state 必须禁止自动合并 / project-state must disallow automatic merge')
  expect(state.liveVerificationRequired === true, 'project-state 必须要求实时核对 / project-state must require live verification')
  const routes = state.architecture?.studioRoutes || []
  for (const route of ['/studio/appearance', '/studio/motion', '/studio/props', '/studio/library']) expect(routes.includes(route), `project-state 缺少路由 / Missing route in project-state: ${route}`)
  expect(state.architecture?.canonicalRenderer === 'apps/playground/app/components/studio/ExtensionAlignedCloudFox.vue', '唯一渲染器路径错误 / Canonical renderer path is incorrect')
  expect(state.architecture?.motionRig === 'cloud-fox-semantic-rig/v1', '动作 Rig 版本错误 / Motion Rig version is incorrect')
  expect(state.architecture?.motionAssetSchemaVersion === 2, '动作资产 schema 必须为 2 / Motion asset schema must be 2')
  expect(state.architecture?.customMotionRendererWiringComplete === true, '正式自定义动作渲染接入必须标记完成 / Production custom-motion renderer wiring must be marked complete')
  expect(state.architecture?.motionPropEventTracksComplete === true, '道具事件轨道必须标记完成 / Prop event tracks must be marked complete')
  expect(state.architecture?.propAssetSchemaVersion === 2, '道具资产 schema 必须为 2 / Prop asset schema must be 2')
  expect(state.architecture?.propEntityEditorComplete === true, '道具实体编辑必须标记完成 / Prop entity editor must be marked complete')
  expect(state.architecture?.propAnchorEditorComplete === true, '道具锚点编辑必须标记完成 / Prop anchor editor must be marked complete')
  expect(state.architecture?.advancedMotionToolsComplete === true, '高级动画工具必须标记完成 / Advanced motion tools must be marked complete')
  expect(state.architecture?.motionLayersComplete === true, '动作层必须标记完成 / Motion layers must be marked complete')
  expect(state.architecture?.motionAudioTracksComplete === true, '音效轨道必须标记完成 / Audio tracks must be marked complete')
  expect(state.architecture?.safeLocalGlbImportComplete === true, '安全本地 GLB 必须标记完成 / Safe local GLB import must be marked complete')
  expect(state.architecture?.motionPartControlRegistryComplete === true, '动作部件控制注册表必须标记完成 / Motion part-control registry must be marked complete')
  expect(state.architecture?.motionDirectAuthoringPadComplete === true, '动作直接操控板必须标记完成 / Direct motion authoring pad must be marked complete')
  expect(state.architecture?.motionAuthoringScopesComplete === true, '动作三种作用范围必须标记完成 / Motion authoring scopes must be marked complete')
  expect(state.architecture?.motionWholeClipCorrectionLayerComplete === true, '整段动作修正层必须标记完成 / Whole-clip correction layer must be marked complete')
  expect(state.architecture?.motionPreviewScaleControlComplete === true, '动作预览缩放必须标记完成 / Motion preview scale control must be marked complete')
  expect(state.architecture?.motionPreviewFreeRotationComplete === true, '动作预览自由旋转必须标记完成 / Motion preview free rotation must be marked complete')
  expect(state.architecture?.motionStudioHorizontalOverflowFixed === true, '动作侧栏横向溢出修复必须标记完成 / Motion sidebar horizontal overflow repair must be marked complete')
  expect(state.architecture?.motionStudioChineseUiComplete === true, '动作工坊中文界面必须标记完成 / Motion Studio Chinese-first UI must be marked complete')
  for (const key of ['bipedPetRigProfileContractComplete', 'bipedPetModelRecipeComplete', 'bipedPetCharacterCompilerComplete', 'bipedPetAutomaticSkinFoundationComplete', 'bipedPetModelPersistenceComplete', 'bipedPetThreeRuntimeRendererAdapterComplete', 'bipedPetWorkshopPreviewWiringComplete', 'bipedPetBeginnerParameterEditorComplete', 'bipedPetPhase1DeliveryComplete', 'bipedPetComplexPropSocketPreviewComplete']) expect(state.architecture?.[key] === true, `双足萌宠第一阶段状态缺失 / Missing completed biped-pet Phase 1 state: ${key}`)
  expect(state.architecture?.studioModelVariantLazyHydrationReviewComplete === true, '复杂模型历史数据懒复核状态缺失 / Missing lazy historical model review state')
  expect(state.architecture?.bipedPetSemanticMotionCompilerComplete === true, '双足萌宠语义动作编译器必须标记完成 / Biped-pet semantic motion compiler must be complete')
  expect(state.architecture?.bipedPetSemanticMotionPhase1DeliveryComplete === true, '双足萌宠语义动作第一阶段交付必须标记完成 / Biped-pet semantic-motion Phase 1 delivery must be complete')
  expect(state.architecture?.bipedPetHybridIkDesignComplete === true, '双足与多骨骼链混合 IK 设计必须标记完成 / Hybrid biped and multi-chain IK design must be complete')
  expect(state.architecture?.bipedPetHybridIkPlanComplete === true, '双足与多骨骼链混合 IK 计划必须标记完成 / Hybrid biped and multi-chain IK plan must be complete')
  expect(state.architecture?.bipedPetHybridRootMotionVfxDesignComplete === true, '双足萌宠混合 Root Motion 与运动特效设计必须标记完成 / Hybrid biped Root Motion and motion-VFX design must be complete')
  expect(state.architecture?.bipedPetHybridRootMotionVfxPlanComplete === true, '双足萌宠混合 Root Motion 与运动特效计划必须标记完成 / Hybrid biped Root Motion and motion-VFX plan must be complete')
  const completedHybridIkFlags = [
    'bipedPetHybridIkProfileContractComplete',
    'bipedPetHybridIkCompilationPropagationComplete',
    'bipedPetAnalyticTwoBoneIkComplete',
    'bipedPetConstrainedFabrikSolverComplete',
    'bipedPetDeterministicContactPhasesComplete',
    'bipedPetBasicMotionContactDataComplete',
    'bipedPetRuntimeIkComplete',
    'bipedPetFootLockComplete',
    'bipedPetComplexMotionRendererLifecycleComplete',
    'bipedPetComplexMotionProductionWiringComplete',
    'bipedPetHybridIkPhaseDeliveryComplete',
  ]
  const incompleteHybridIkBoundaries = [
    'bipedPetRootMotionComplete',
    'bipedPetMotionVfxComplete',
    'bipedPetProductionQuadrupedProfileComplete',
    'bipedPetProductionMechProfileComplete',
    'bipedPetHighDetailTopologyComplete',
    'crossBrowserGpuManualAcceptanceComplete',
  ]
  for (const key of completedHybridIkFlags) expect(state.architecture?.[key] === true, `双足萌宠混合 IK 完成状态缺失 / Missing completed hybrid-IK state: ${key}`)
  for (const key of incompleteHybridIkBoundaries) expect(state.architecture?.[key] === false, `双足萌宠未完成边界错误 / Incorrect incomplete biped-pet boundary: ${key}`)
  expect(state.architecture?.hybridIkLegacyHistoryMigrationComplete === true, '混合 IK 历史门禁迁移必须标记完成 / Hybrid-IK history-gate migration must be complete')
  // 内建正反夹具用于防止后续把已交付能力改回 false，或把明确边界误改为 true。
  const positiveHybridIkFixture = Object.fromEntries([
    ...completedHybridIkFlags.map(key => [key, true]),
    ...incompleteHybridIkBoundaries.map(key => [key, false]),
  ])
  const negativeHybridIkFixture = { ...positiveHybridIkFixture, bipedPetRootMotionComplete: true }
  const matchesHybridIkBoundary = fixture => completedHybridIkFlags.every(key => fixture[key] === true)
    && incompleteHybridIkBoundaries.every(key => fixture[key] === false)
  expect(matchesHybridIkBoundary(positiveHybridIkFixture), '混合 IK 正向状态夹具必须通过 / Positive hybrid-IK state fixture must pass')
  expect(!matchesHybridIkBoundary(negativeHybridIkFixture), '混合 IK 负向状态夹具必须失败 / Negative hybrid-IK state fixture must fail')
  expect(state.mandatoryDevelopmentPolicy?.updateAiPackageForEveryFeatureCommit === true, '必须启用每个功能提交更新 AI 包 / Per-feature-commit AI update policy must be enabled')
  const expectedLegacyExceptions = [...legacyHistoryMigrationExceptions].map(([commit, item]) => ({
    commit,
    missing: item.missing,
    reason: item.reason,
    remediatedBy: legacyHistoryMigrationClosure,
  }))
  expect(JSON.stringify(state.mandatoryDevelopmentPolicy?.legacyHistoryMigrationExceptions) === JSON.stringify(expectedLegacyExceptions), '历史迁移例外必须与门禁中的完整 SHA、缺失类型、原因和收口提交完全一致 / Legacy migration exceptions must exactly match the gate SHA, missing types, reasons, and closure commit')
  expect((state.completed || []).includes('motion-semantic-rig'), '必须标记语义 Rig 领域已完成 / Semantic Rig domain must be marked complete')
  expect((state.completed || []).includes('motion-domain-evaluator'), '必须标记无 UI 动作求值器已完成 / UI-free motion evaluator must be marked complete')
  expect((state.completed || []).includes('motion-keyframe-writing'), '必须标记时间轴关键帧写入已完成 / Timeline keyframe writing must be marked complete')
  expect((state.completed || []).includes('custom-motion-playback-runtime'), '必须标记正式自定义动作播放已完成 / Production custom-motion playback must be marked complete')
  expect((state.completed || []).includes('motion-renderer-pose-adapter'), '必须标记正式姿态适配器已完成 / Production pose adapter must be marked complete')
  expect((state.completed || []).includes('motion-prop-event-tracks'), '必须标记道具事件轨道已完成 / Prop event tracks must be marked complete')
  expect((state.completed || []).includes('motion-prop-event-runtime'), '必须标记道具事件运行时已完成 / Prop event runtime must be marked complete')
  expect((state.completed || []).includes('prop-geometry-editor'), '必须标记道具几何编辑已完成 / Prop geometry editing must be marked complete')
  expect((state.completed || []).includes('prop-material-editor'), '必须标记道具材质编辑已完成 / Prop material editing must be marked complete')
  expect((state.completed || []).includes('prop-grip-and-emitter-manipulators'), '必须标记道具内部锚点编辑已完成 / Prop internal-anchor editing must be marked complete')
  expect((state.completed || []).includes('motion-smooth-and-bezier-interpolation'), '必须标记高级插值已完成 / Advanced interpolation must be marked complete')
  expect((state.completed || []).includes('motion-curve-editor'), '必须标记曲线编辑器已完成 / Curve editor must be marked complete')
  expect((state.completed || []).includes('motion-layering-and-interruption'), '必须标记动作层与中断已完成 / Motion layers and interruption must be marked complete')
  expect((state.completed || []).includes('safe-local-glb-import'), '必须标记安全本地 GLB 已完成 / Safe local GLB import must be marked complete')
  expect((state.completed || []).includes('motion-body-part-control-registry'), '必须标记动作部件控制注册表完成 / Motion part-control registry must be marked complete')
  expect((state.completed || []).includes('motion-current-selected-clip-scopes'), '必须标记动作三种作用范围完成 / Motion authoring scopes must be marked complete')
  expect((state.completed || []).includes('motion-root-and-body-uniform-scale'), '必须标记整体与身体缩放完成 / Root and body uniform scale must be marked complete')
  expect((state.completed || []).includes('motion-preview-free-rotation'), '必须标记动作预览自由旋转完成 / Motion preview free rotation must be marked complete')
  expect((state.completed || []).includes('motion-property-panel-horizontal-overflow-repair'), '必须标记动作属性栏横向溢出修复完成 / Motion property-panel horizontal overflow repair must be marked complete')
  expect((state.completed || []).includes('motion-studio-chinese-first-ui'), '必须标记动作工坊中文优先界面完成 / Motion Studio Chinese-first UI must be marked complete')
  expect((state.completed || []).includes('biped-pet-phase1-delivery'), '必须标记双足萌宠第一阶段交付完成 / Biped-pet Phase 1 delivery must be marked complete')
  expect((state.completed || []).includes('biped-pet-complex-prop-socket-preview'), '必须标记复杂模型语义道具挂点预览完成 / Complex-model semantic prop-mount preview must be marked complete')
  expect((state.completed || []).includes('studio-model-variant-lazy-hydration-review'), '必须标记复杂模型历史数据懒复核完成 / Lazy historical model review must be marked complete')
  expect((state.completed || []).includes('biped-pet-semantic-motion-phase1-delivery'), '必须标记双足萌宠语义动作第一阶段交付完成 / Biped-pet semantic-motion Phase 1 delivery must be marked complete')
  expect((state.completed || []).includes('biped-pet-hybrid-ik-design'), '必须标记双足与多骨骼链混合 IK 设计完成 / Hybrid biped and multi-chain IK design must be marked complete')
  expect((state.completed || []).includes('biped-pet-hybrid-ik-plan'), '必须标记双足与多骨骼链混合 IK 计划完成 / Hybrid biped and multi-chain IK plan must be marked complete')
  expect((state.completed || []).includes('biped-pet-hybrid-root-motion-vfx-design'), '必须标记双足萌宠混合 Root Motion 与运动特效设计完成 / Hybrid biped Root Motion and motion-VFX design must be marked complete')
  expect((state.completed || []).includes('biped-pet-hybrid-root-motion-vfx-plan'), '必须标记双足萌宠混合 Root Motion 与运动特效计划完成 / Hybrid biped Root Motion and motion-VFX plan must be marked complete')
  expect((state.completed || []).includes('biped-pet-root-motion-solver'), '必须标记框架无关 Root Motion 求解完成 / Framework-neutral Root Motion solver must be complete')
  expect((state.completed || []).includes('biped-pet-root-motion-shared-ballistic-timeline'), '必须标记 Root Motion 共享弹道时间线完成 / Shared Root Motion ballistic timeline must be complete')
  expect(state.architecture?.bipedPetMotionVfxSignalsComplete === true, '必须标记确定性运动 VFX 信号模块完成 / Deterministic motion-VFX signal module must be complete')
  expect((state.completed || []).includes('biped-pet-motion-vfx-signals'), '必须记录确定性运动 VFX 信号批次 / Deterministic motion-VFX signal batch must be recorded')
  expect(state.architecture?.bipedPetBuiltInRootMotionSemanticsComplete === true, '必须标记内置动作 Root Motion 语义完成 / Built-in Root Motion semantics must be complete')
  expect((state.completed || []).includes('biped-pet-built-in-root-motion-semantics'), '必须记录内置动作 Root Motion 语义批次 / Built-in Root Motion semantics batch must be recorded')
  expect(state.architecture?.bipedPetRootMotionThreeRuntimeComplete === true, '必须标记 Three Root Motion 协同运行时完成 / Three Root Motion coordination runtime must be complete')
  expect((state.completed || []).includes('biped-pet-root-motion-three-runtime'), '必须记录 Three Root Motion 协同批次 / Three Root Motion coordination batch must be recorded')
  expect(state.architecture?.bipedPetMotionVfxPoolComplete === true, '必须标记有界 Three 运动特效对象池完成 / Bounded Three motion-VFX pool must be complete')
  expect((state.completed || []).includes('biped-pet-motion-vfx-pool'), '必须记录 Three 运动特效对象池批次 / Three motion-VFX pool batch must be recorded')
  expect(state.architecture?.bipedPetRootMotionRendererLifecycleComplete === true, '必须标记 Root Motion renderer 生命周期完成 / Root Motion renderer lifecycle must be complete')
  expect(state.architecture?.bipedPetRootMotionBeginnerSettingsComplete === true, '必须标记 Root Motion 新手设置完成 / Root Motion beginner settings must be complete')
  expect((state.completed || []).includes('biped-pet-root-motion-vfx-renderer-settings'), '必须记录 Root Motion/VFX renderer 与设置批次 / Root Motion/VFX renderer and settings batch must be recorded')
  for (const key of ['biped-pet-hybrid-ik-profile-contract', 'biped-pet-analytic-two-bone-ik', 'biped-pet-constrained-fabrik', 'biped-pet-runtime-ik', 'biped-pet-foot-lock', 'biped-pet-hybrid-ik-phase-delivery']) expect((state.completed || []).includes(key), `必须标记混合 IK 交付项完成 / Hybrid-IK delivery item must be complete: ${key}`)
  expect((state.completed || []).includes('hybrid-ik-legacy-history-migration'), '必须标记混合 IK 历史门禁迁移完成 / Hybrid-IK history-gate migration must be complete')
  expect((state.notCompleted || []).includes('true-3d-raycast-gizmo-manipulation'), '必须保留真实 3D Gizmo 未完成边界 / True 3D gizmo boundary must remain incomplete')
  expect((state.notCompleted || []).includes('browser-screenshot-baselines'), '必须保留浏览器截图基线未完成 / Browser screenshot baselines must remain incomplete')
  for (const key of ['biped-pet-root-motion', 'biped-pet-complex-motion-library', 'biped-pet-motion-vfx', 'biped-pet-profile-runtime-expansion', 'cross-browser-gpu-manual-acceptance']) expect((state.notCompleted || []).includes(key), `必须保留双足萌宠后续边界 / Biped-pet future boundary must remain incomplete: ${key}`)
  for (const key of ['biped-pet-runtime-ik', 'biped-pet-foot-lock']) expect(!(state.notCompleted || []).includes(key), `已完成的混合 IK 交付项不得继续列为未完成 / Completed hybrid-IK item must not remain incomplete: ${key}`)
  expect(!(state.notCompleted || []).includes('biped-pet-quaternion-motion-compiler'), 'Quaternion 动作编译器已完成，不得继续列为未完成 / Completed Quaternion motion compiler must not remain incomplete')
  expect(state.nextPhase === 'biped-pet-root-motion-vfx-and-acceptance', '下一阶段必须是 Root Motion、动作特效与验收 / Next phase must be Root Motion, motion VFX, and acceptance')
  const rootMotionRuntimeCoverage = [
    'corepack pnpm run check:studio-complex-biped-root-motion',
    'corepack pnpm run test:studio-model-variants',
    'corepack pnpm run test:studio-complex-biped-root-motion-runtime',
    'corepack pnpm --filter @nova/playground typecheck',
    'corepack pnpm build:playground',
    'node scripts/check-documentation.mjs',
    'node scripts/check-ai-handoff.mjs',
    'git diff --check',
  ]
  expect(state.latestCompletedBatch?.id === 'biped-pet-root-motion-vfx-renderer-settings', '最新批次必须是 Root Motion/VFX renderer 与设置 / Latest batch must be Root Motion/VFX renderer and settings')
  expect(JSON.stringify(state.latestCompletedBatch?.automatedCoverage) === JSON.stringify(rootMotionRuntimeCoverage), 'Root Motion/VFX renderer 批次 automatedCoverage 必须且只能列出真实验证项 / Root Motion/VFX renderer automatedCoverage must contain only actual validation')
  expect(state.latestCompletedBatch?.rendererModified === true && state.latestCompletedBatch?.visualCasesModified === false, '本批必须如实声明 renderer 已修改且视觉案例未修改 / This batch must report renderer modification without visual-case changes')
  expect(state.latestCompletedBatch?.rootMotionContainerConsumerComplete === true && state.latestCompletedBatch?.balanceControllerComplete === true && state.latestCompletedBatch?.ikFrameReportComplete === true, 'Three Root Motion、重心与 IK 报告必须完成 / Three Root Motion, balance, and IK reports must be complete')
  expect(JSON.stringify(state.latestCompletedBatch?.rootMotionOrder) === JSON.stringify(['restore-bind-pose', 'fk', 'root-motion', 'balance', 'update-matrix-world', 'ik']), 'Three 动作运行顺序必须固定 / Three motion runtime order must remain fixed')
  expect(state.latestCompletedBatch?.rootMotionPositionOwnership === 'bind-position-plus-applied-world' && state.latestCompletedBatch?.rootMotionTurnOwnership === 'world-yaw-times-bind-quaternion', 'Root Motion 容器所有权必须保持绝对写入 / Root Motion container ownership must remain absolute')
  expect(state.latestCompletedBatch?.balancePelvisHorizontalLimitBodyHeightRatio === .025 && state.latestCompletedBatch?.balanceChestTiltLimitRadians === .12, '重心控制预算错误 / Balance-controller bounds are incorrect')
  expect(state.latestCompletedBatch?.integratedSingleSupportPelvisYDefault === false && state.latestCompletedBatch?.integratedSingleSupportPelvisYLimit === 'min(0.08, characterHeight*0.025)', '单支撑 pelvis Y 集成策略必须默认关闭且尺寸化 / Integrated single-support pelvis Y must be default-off and scale-bounded')
  expect(state.latestCompletedBatch?.ikResidualByLimbMetric === 'world-horizontal-anchor-current-xz-hypot', 'IK residualByLimb 必须只表示真实世界水平残差幅值 / IK residualByLimb must represent true world-horizontal residual magnitude only')
  expect(JSON.stringify(state.latestCompletedBatch?.ikRootMotionPhaseRelease) === JSON.stringify(['takeoff', 'airborne', 'landing']), 'IK 必须在实际 takeoff/airborne/landing 相位释放滞后接触 / IK must release stale contacts in actual takeoff/airborne/landing phases')
  expect(state.latestCompletedBatch?.effectiveSupportPredicate === 'finite-weight>0-and-finite-confidence>0', 'IK 有效支撑必须同时要求正有限 weight/confidence / Effective IK support requires finite positive weight and confidence')
  expect(state.latestCompletedBatch?.rootResidualPhasePreview === 'zero-residual-preview-then-grounded-resample'
    && state.latestCompletedBatch?.rootResidualFinalPhaseGuard === 'commit-resample-only-when-final-remains-finite-grounded'
    && state.latestCompletedBatch?.rootResidualStrainGain === 8
    && state.latestCompletedBatch?.rootResidualStrainLimitBodyHeightRatio === .025,
  'Root residual 必须先零反馈预采样，并保持明确 strain 增益与尺寸上限 / Root residual must use zero-feedback preview with explicit strain gain and scale bound')
  expect(state.latestCompletedBatch?.duplicateFramePosePolicy === 'same-clip-requested-time-normalized-weight-freezes-full-display-pose'
    && state.latestCompletedBatch?.duplicateFrameConsumedResidual === 'zero',
  '重复帧必须冻结完整显示姿态且不得声明消费 residual / Duplicate frames must freeze the full display pose without claiming residual consumption')
  expect(state.latestCompletedBatch?.rootMotionRuntimeExclusiveOwnership === true
    && state.latestCompletedBatch?.rootMotionRuntimeOwnerRegistry === 'weakmap-token',
  '每个 runtime 必须只有一个 Root Motion 写入者 / Each runtime must have exactly one Root Motion writer')
  expect(state.latestCompletedBatch?.rootMotionExceptionalDisposePolicy === 'finally-release-owner-then-outer-best-effort-aggregate', '异常释放必须交还 Root owner 并由外层全部尽力聚合 / Exceptional disposal must release Root ownership and aggregate best-effort outer cleanup')
  expect(state.latestCompletedBatch?.rootMotionThrownValuePolicy === 'separate-failure-sentinel-preserves-undefined'
    && state.latestCompletedBatch?.motionControllerConstructionCleanupPolicy === 'preserve-construction-error-and-best-effort-ik-balance-root'
    && state.latestCompletedBatch?.runtimeDisposeStateCheckPolicy === 'aggregate-check-failure-and-attempt-bind-matrix'
    && state.latestCompletedBatch?.cleanupDiagnosticFormattingPolicy === 'total-string-conversion-with-unknown-fallback',
  '异常值、构造回滚和运行时状态检查都必须遵守不吞错的全部尽力策略 / Thrown values, construction rollback, and runtime-state checks must preserve best-effort no-swallow semantics')
  expect(state.latestCompletedBatch?.rootMotionHotPathAllocationPolicy === 'direct-bounds-preallocated-balance-single-contact-scan-shared-zero-direct-residual-record-scan', 'Three 热路径分配策略必须保持 / Three hot-path allocation policy must remain explicit')
  expect(state.latestCompletedBatch?.rootMotionNaturalPingPongFixture === 'compiled-and-sampled-ping-pong-asset', 'ping-pong 长序列必须来自真实编译资产 / Long ping-pong coverage must use a genuinely compiled asset')
  expect(state.latestCompletedBatch?.standaloneIkCorrectionPasses === 3 && state.latestCompletedBatch?.integratedIkCorrectionPasses === 5 && state.latestCompletedBatch?.ikPerBoneAngularBudgetExpanded === false, 'IK 集成收敛只能增加 pass，不得扩大每骨骼累计角预算 / Integrated IK may add passes but must not expand per-bone cumulative angular budgets')
  expect(state.latestCompletedBatch?.integratedWorldResidualGate === .00075
    && state.latestCompletedBatch?.integratedWorldResidualProbe <= state.latestCompletedBatch.integratedWorldResidualGate
    && state.latestCompletedBatch?.integratedHorizontalResidualProbe <= state.latestCompletedBatch.integratedWorldResidualGate,
  '集成 IK 固定残差探针必须保留明确裕量 / Integrated IK residual probes must retain explicit margin')
  expect(JSON.stringify(state.latestCompletedBatch?.rootMotionRuntimeReviewRedEvidence) === JSON.stringify({
    staleTakeoffSupportingContacts: 1,
    pureVerticalOffset: .02,
    reportedThreeDimensionalResidual: .020000000000000018,
    previousIntegratedWorldResidual: .000999317248683272,
  }), 'Task 5 规格审查 RED 证据必须保持可追踪 / Task 5 review RED evidence must remain traceable')
  expect(JSON.stringify(state.latestCompletedBatch?.rootMotionRuntimeReviewRedEvidenceV2) === JSON.stringify({
    combinedTravelBallisticTakeoffAppliedXWithResidual: 0.25337596237182625,
    combinedTravelBallisticTakeoffAppliedXWithoutResidual: 0.2535759623718262,
    landingBalancePelvisX: -0.060846538023769596,
    staleLandingSupportingContacts: 1,
    zeroConfidenceSupportingContacts: 1,
    duplicateDisplayPoseChanged: true,
    secondRootControllerRejected: false,
  }), 'Task 5 第二轮质量审查 RED 证据必须保持可追踪 / Task 5 second quality-review RED evidence must remain traceable')
  expect(JSON.stringify(state.latestCompletedBatch?.rootMotionRuntimeReviewRedEvidenceV3) === JSON.stringify({
    zeroPreviewStatus: 'solved',
    zeroPreviewPhase: 'grounded',
    zeroPreviewAppliedY: 0,
    zeroPreviewLandingImpulse: 1,
    residualResampleStatus: 'clamped',
    residualResamplePhase: 'landing',
    residualResampleAppliedYApprox: .0000017957,
    rootDisposeRetainedTokenAfterRestoreFailure: true,
    outerDisposeStoppedAtFirstFailure: true,
  }), 'Task 5 第三轮质量审查 RED 证据必须保持可追踪 / Task 5 third quality-review RED evidence must remain traceable')
  expect(JSON.stringify(state.latestCompletedBatch?.rootMotionRuntimeReviewRedEvidenceV4) === JSON.stringify({
    rootDisposeSwallowedUndefined: true,
    constructorCleanupStoppedBeforeRoot: true,
    disposeRuntimeCheckBypassedAggregate: true,
    symbolErrorMessageStoppedCleanup: true,
    throwingErrorMessageGetterStoppedCleanup: true,
  }), 'Task 5 第四轮异常边界 RED 证据必须保持可追踪 / Task 5 fourth exceptional-boundary RED evidence must remain traceable')
  expect(state.latestCompletedBatch?.motionIntensityReferenceBodyHeightsPerSecond === .4, '移动强度参考速度必须是每秒 0.4 个角色身高 / Motion-intensity reference speed must be 0.4 body-heights per second')
  expect(state.latestCompletedBatch?.landingImpulseFormula === 'sqrt(normalizedCompositePeakHeight)', '落地冲量必须由归一化复合峰高的平方根派生 / Landing impulse must derive from the square root of normalized composite peak height')
  expect(state.latestCompletedBatch?.landingRingThreshold === .25 && state.latestCompletedBatch?.landingDustThreshold === .4, '落地环与尘效必须保持既定严格阈值 / Landing ring and dust must retain their strict thresholds')
  expect(state.latestCompletedBatch?.landingRingPeakHeightBoundary === .0625 && state.latestCompletedBatch?.landingDustPeakHeightBoundary === .16, '落地特效的峰高平方边界必须与速度启发式一致 / Peak-height square boundaries must match the velocity heuristic')
  expect(state.latestCompletedBatch?.walkDistanceBodyHeights === .42, '行走距离必须保持 0.42 个角色身高 / Walk distance must remain 0.42 body-heights')
  expect(state.latestCompletedBatch?.jumpHeightBodyHeights === .28, '跳跃高度必须保持 0.28 个角色身高 / Jump height must remain 0.28 body-heights')
  expect(state.latestCompletedBatch?.sprintDistanceBodyHeights === 2.4, '冲刺距离必须保持 2.4 个角色身高 / Sprint distance must remain 2.4 body-heights')
  expect(state.latestCompletedBatch?.sprintTravelEndMs === 8300 && JSON.stringify(state.latestCompletedBatch?.sprintBrakeWindowMs) === JSON.stringify([6300, 8300]), '冲刺 travel 与 brake 必须在 6300→8300ms 重叠 / Sprint travel and brake must overlap from 6300 to 8300ms')
  expect(state.latestCompletedBatch?.builtInMotionCount === 11, '内置动作数量必须保持 11 / Built-in motion count must remain 11')
  expect(JSON.stringify(state.latestCompletedBatch?.naturalMovementVfxProbe) === JSON.stringify({
    walkSpeedTrailFrames: 46,
    sprintSpeedTrailFrames: 582,
    sprintBrakeSparkFrames: 36,
    sprintBrakeAt7300: true,
    jumpLandingRingBursts: 1,
    jumpLandingDustBursts: 1,
    jumpLandingImpulse: Math.sqrt(.28),
  }), '自然播放 VFX 探针计数必须稳定 / Natural-playback VFX probe counts must remain stable')
  expect(state.latestCompletedBatch?.vfxRuntimeObjectType === 'Group'
    && state.latestCompletedBatch?.vfxRuntimeParentSpace === 'character-container-final-parent-position'
    && state.latestCompletedBatch?.vfxRuntimeClock === 'requestedTimeMs-only',
  'VFX 运行时必须使用同父级普通 Group，并且只由动作请求时间推进 / VFX runtime must use a sibling Group driven only by requested action time')
  expect(state.latestCompletedBatch?.vfxRuntimePoolCapacityTotal === 64
    && JSON.stringify(state.latestCompletedBatch?.vfxRuntimePoolCapacityByKind) === JSON.stringify({
      'landing-ring': 8,
      'landing-dust': 24,
      'speed-trail': 8,
      'brake-sparks': 24,
    })
    && JSON.stringify(state.latestCompletedBatch?.vfxRuntimeInstancedKinds) === JSON.stringify(['landing-dust', 'brake-sparks']),
  'VFX 固定池容量与 InstancedMesh 种类必须保持 / VFX fixed-pool capacities and instanced kinds must remain stable')
  expect(state.latestCompletedBatch?.vfxRuntimeBurstLimit === 16
    && state.latestCompletedBatch?.vfxRuntimeTrailLimit === 8
    && state.latestCompletedBatch?.vfxRuntimeLifetimeLimitMs === 1200
    && state.latestCompletedBatch?.vfxRuntimeRecentBurstIdLimit === 256,
  'VFX burst、拖尾、寿命与去重账本必须保持有界 / VFX burst, trail, lifetime, and dedupe-ledger limits must remain bounded')
  expect(state.latestCompletedBatch?.vfxRuntimeForwardConvention === 'local-plus-z-sin-yaw-x-cos-yaw-z'
    && state.latestCompletedBatch?.vfxRuntimeEqualExpiryEviction === 'oldest-activation-serial-first'
    && state.latestCompletedBatch?.vfxRuntimeActiveBurstDeduplication === 'active-ids-never-evicted-by-recent-ledger'
    && state.latestCompletedBatch?.vfxRuntimeFrameSanitization === 'single-read-finite-value-copy',
  'VFX 朝向、同到期淘汰、活动 ID 去重与帧复制语义必须保持 / VFX facing, equal-expiry eviction, active-ID dedupe, and frame-copy semantics must remain stable')
  expect(state.latestCompletedBatch?.vfxRuntimeBurstPositionPolicy === 'capture-parent-position-on-trigger'
    && state.latestCompletedBatch?.vfxRuntimeSustainPolicy === 'update-existing-id-at-current-parent-position'
    && state.latestCompletedBatch?.vfxRuntimeResetPolicy === 'clear-active-and-dedupe-retain-pools',
  'burst 捕获、sustain 更新与 reset 保池语义必须保持 / Burst capture, sustain update, and reset-retains-pool semantics must remain stable')
  expect(state.latestCompletedBatch?.vfxRuntimeDisposePolicy === 'reentrancy-sealed-idempotent-best-effort-all-gpu-resources-once-and-remove-parent'
    && state.latestCompletedBatch?.vfxRuntimeInitializationPolicy === 'isolate-effect-class-failures'
    && state.latestCompletedBatch?.vfxRuntimeResourceOwnershipPolicy === 'identity-deduplicated-shared-resource-disposal'
    && state.latestCompletedBatch?.vfxRuntimeOwnedObjectPolicy === 'track-and-detach-all-created-children-from-any-parent'
    && state.latestCompletedBatch?.vfxRuntimeDefaultFactoryPolicy === 'lazy-single-provisional-per-kind-and-resource-class'
    && state.latestCompletedBatch?.vfxRuntimeSlotAllocationPolicy === 'preallocated-64-slot-state-objects-reused'
    && state.latestCompletedBatch?.vfxRuntimeDedupeQueuePolicy === 'fixed-256-ring-buffer-no-shift'
    && state.latestCompletedBatch?.vfxRuntimeRendererWired === true
    && state.latestCompletedBatch?.vfxRuntimeTestRedReason === 'ERR_MODULE_NOT_FOUND: complex-biped-motion-vfx.ts',
  'VFX 创建/释放隔离、正式接线与 TDD RED 证据必须可追踪 / VFX creation/disposal isolation, production wiring, and TDD RED evidence must remain traceable')
  expect(JSON.stringify(state.latestCompletedBatch?.vfxRuntimeReviewRedEvidence) === JSON.stringify({
    yawZeroTrailPosition: [-.42, .2, 0],
    equalExpiryEvictionIndices: [0, 0, 0, 0],
    activeRingCountAfterLedgerEvictionReplay: 2,
    proxyInjectedRingPositionX: 'NaN',
    sharedGeometryDisposeCalls: 4,
    sharedMaterialDisposeCalls: 4,
    externalParentChildrenAfterDispose: 18,
    reentrantResourceDisposeCalls: 2,
  }), 'Task 6 质量审查 RED 证据必须保持可追踪 / Task 6 quality-review RED evidence must remain traceable')
  expect(state.latestCompletedBatch?.rendererMotionControllerCount === 1
    && state.latestCompletedBatch?.rendererVfxControllerCount === 1
    && state.latestCompletedBatch?.rendererVfxMountPolicy === 'sibling-primitive-in-existing-tres-canvas'
    && state.latestCompletedBatch?.rendererVfxFramePositionPolicy === 'runtime-object-parent-local-final-position'
    && state.latestCompletedBatch?.rendererVfxFacingPolicy === 'final-quaternion-local-plus-z-atan2-x-z'
    && state.latestCompletedBatch?.rendererVfxFrameAllocationPolicy === 'shared-vector-tuple-and-frame-object',
  'renderer 必须保持单控制器、同级挂载与无逐帧坐标分配语义 / Renderer must preserve single-controller, sibling-mount, and allocation-free frame-coordinate semantics')
  expect(state.latestCompletedBatch?.rendererPlaybackClockPolicy === 'resolved-playhead-for-editor-monotonic-requested-time-for-complex-runtime'
    && JSON.stringify(state.latestCompletedBatch?.rendererPlaybackRealignmentBoundaries) === JSON.stringify(['open', 'replace-saved', 'scrub', 'stop'])
    && state.latestCompletedBatch?.rendererSafeSynchronizationPolicy === 'boolean-outcome-domain-and-asset-scoped-recovery-clear-stale-clip-reset-then-dispose-and-rebuild-on-reset-failure-bounded-blocked-diagnostic'
    && state.latestCompletedBatch?.rendererStaticGateParser === 'vue-sfc-parser-typescript-call-expression-and-template-element-ast',
  'renderer 必须保持单调运行时钟、安全同步边界与注释免疫门禁 / Renderer must preserve monotonic runtime time, safe synchronization, and comment-immune gating')
  expect(JSON.stringify(state.latestCompletedBatch?.rendererResetBoundaries) === JSON.stringify(['clip-switch', 'no-motion', 'blocked', 'stopped-weight', 'rewind'])
    && JSON.stringify(state.latestCompletedBatch?.rendererDisposeOrder) === JSON.stringify(['vfx', 'motion', 'runtime'])
    && state.latestCompletedBatch?.rendererCreationFailurePolicy === 'detach-shallow-refs-then-bounded-chinese-best-effort-reverse-cleanup'
    && state.latestCompletedBatch?.rendererSimpleComplexExclusion === 'complex-v-if-procedural-v-else-single-tres-canvas',
  'renderer reset、逆序清理与简单模式互斥语义必须锁定 / Renderer reset, reverse cleanup, and simple-mode exclusion semantics must remain locked')
  expect(JSON.stringify(state.latestCompletedBatch?.rootMotionSettingsSurface) === JSON.stringify(['mode', 'auto-vfx', 'distance-summary', 'turn-summary', 'jump-summary', 'restore-recommendation'])
    && state.latestCompletedBatch?.rootMotionSettingsMutationScope === 'current-draft-biped-root-motion-only-preserve-namespaces'
    && state.latestCompletedBatch?.rootMotionRecommendationPolicy === 'baseline-authored-root-motion-scaled-to-current-duration-then-explicit-source-motion-id-scaled-to-current-duration-then-safe-generic-travel'
    && state.latestCompletedBatch?.rootMotionBuiltInProvenanceField === 'yk-pets/biped-motion/v1.sourceMotionId'
    && state.latestCompletedBatch?.rootMotionLegacyRecommendationPolicy === 'baseline-only-never-name-inference'
    && state.latestCompletedBatch?.rootMotionModeAutoVfxIsolation === true
    && state.latestCompletedBatch?.rootMotionSettingsSingleUndoEntry === true
    && state.latestCompletedBatch?.rootMotionSettingsResponsivePolicy === 'inline-size-container-query-360px-single-column'
    && state.latestCompletedBatch?.rootMotionSettingsReadableFontFloorPx === 10,
  '新手设置必须保持语义化表面、推荐恢复、模式/特效隔离与单次撤销 / Beginner settings must preserve semantic UI, recommendation restoration, mode/VFX isolation, and single undo')
  expect(JSON.stringify(state.latestCompletedBatch?.rootMotionSettingsTddRedEvidence) === JSON.stringify({
    rendererGateMissingLifecycle: true,
    rendererGateMissingExplicitRewindReset: true,
    rendererGateMissingSafeSynchronization: true,
    emptyFrameSyncIncorrectlyClearedFailure: true,
    rendererGateAcceptedCommentOnlyImplementation: true,
    rendererGateAcceptedStringOnlyImplementation: true,
    missingPlaybackRequestedTimeMsAtRequested2500: true,
    resolvedPlayheadAtRequested2500: 100,
    customBilingualNameCollisionRestoredMode: 'travel',
    realCopiedJumpUnscaledWindow: [720, 1824],
    previousSettingsMinimumFontPx: 7,
    storeApiError: 'updateRootMotionSettings is not a function',
    modeChangeRestoredDisabledVfx: ['speed-trail'],
    unscaledJumpWindow: [720, 1200],
  }), 'Task 7 TDD RED 证据必须保持可追踪 / Task 7 TDD RED evidence must remain traceable')
  expect((state.completed || []).includes('biped-pet-root-motion-action-aware-boundaries'), 'Root Motion action-aware 边界修复必须进入完成状态 / Action-aware Root Motion boundary repair must be recorded as complete')
  expect((state.completed || []).includes('biped-pet-root-motion-canonical-ballistic-transitions'), 'Root Motion canonical 弹道转换必须进入完成状态 / Canonical Root Motion ballistic transitions must be recorded as complete')
}

for (const routeFile of ['appearance.vue', 'motion.vue', 'props.vue', 'library.vue']) expect(existsSync(path.join(root, 'apps/playground/app/pages/studio', routeFile)), `缺少 Studio 路由文件 / Missing Studio route file: ${routeFile}`)
expect(existsSync(path.join(root, 'apps/playground/app/components/studio/ExtensionAlignedCloudFox.vue')), '缺少唯一正式云狐渲染器 / Missing canonical Cloud Fox renderer')
expect(existsSync(path.join(root, 'packages/pet-core/src/motion/motion-evaluator.ts')), '缺少动作领域求值器 / Missing motion-domain evaluator')
expect(existsSync(path.join(root, 'apps/playground/app/three/apply-complex-biped-root-motion.ts')), '缺少 Three Root Motion 控制器 / Missing Three Root Motion controller')
expect(existsSync(path.join(root, 'apps/playground/app/three/apply-complex-biped-balance.ts')), '缺少 Three 重心控制器 / Missing Three balance controller')
expect(existsSync(path.join(root, 'apps/playground/app/three/complex-biped-motion-vfx.ts')), '缺少 Three 运动特效对象池 / Missing Three motion-VFX pool')

if (visualCases) {
  expect(visualCases.schemaVersion === 1, 'visual-cases schemaVersion 必须为 1 / visual-cases schemaVersion must be 1')
  expect(Array.isArray(visualCases.cases) && visualCases.cases.length >= 4, '视觉案例至少需要四项 / At least four visual cases are required')
  const ids = new Set()
  for (const item of visualCases.cases || []) {
    expect(typeof item.id === 'string' && item.id.length > 2, '视觉案例必须拥有稳定 ID / Visual case requires a stable ID')
    if (ids.has(item.id)) failures.push(`视觉案例 ID 重复 / Duplicate visual case ID: ${item.id}`)
    ids.add(item.id)
    expect(typeof item.route === 'string' && item.route.startsWith('/studio'), `视觉案例路由无效 / Invalid visual case route: ${item.id}`)
    expect(Array.isArray(item.automatedChecks) && item.automatedChecks.length > 0, `视觉案例缺少自动检查 / Missing automated checks: ${item.id}`)
    expect(Array.isArray(item.manualChecks) && item.manualChecks.length > 0, `视觉案例缺少人工检查 / Missing manual checks: ${item.id}`)
  }
  const phaseOneCase = visualCases.cases.find(item => item.id === 'biped-pet-phase1-browser-acceptance')
  const propSocketCase = visualCases.cases.find(item => item.id === 'biped-pet-complex-prop-socket-preview')
  const lazyHydrationCase = visualCases.cases.find(item => item.id === 'studio-model-variant-lazy-hydration-review')
  const semanticMotionCase = visualCases.cases.find(item => item.id === 'biped-pet-semantic-motion-phase1')
  const hybridIkCase = visualCases.cases.find(item => item.id === 'biped-pet-hybrid-ik-foot-lock')
  expect(Boolean(phaseOneCase), '缺少双足萌宠第一阶段人工验收案例 / Missing biped-pet Phase 1 manual acceptance case')
  expect(JSON.stringify(phaseOneCase?.setup?.viewports) === JSON.stringify([[1440, 900], [760, 900]]), '第一阶段人工案例必须覆盖 1440×900 与 760×900 / Phase 1 manual case must cover 1440×900 and 760×900')
  expect(['soft', 'athletic', 'round', 'slender'].every(style => phaseOneCase?.setup?.bodyStyles?.includes(style)), '第一阶段人工案例必须覆盖四个体型模板 / Phase 1 manual case must cover four body styles')
  expect((phaseOneCase?.manualChecks || []).length >= 5 && phaseOneCase.manualChecks.every(check => check.startsWith('manual:')), '未自动覆盖的双足萌宠检查必须显式标记 manual / Non-automated biped-pet checks must be explicitly marked manual')
  const propSocketManualChecks = propSocketCase?.manualChecks || []
  const lazyHydrationManualChecks = lazyHydrationCase?.manualChecks || []
  expect(Boolean(propSocketCase) && propSocketManualChecks.some(check => check.startsWith('passed-')) && propSocketManualChecks.some(check => check.startsWith('pending:')), '复杂模型语义道具挂点必须同时记录已完成的功能复测与剩余浏览器案例 / Complex-model semantic prop mounts must record both the completed functional recheck and remaining browser cases')
  expect(Boolean(lazyHydrationCase) && lazyHydrationManualChecks.some(check => check.startsWith('passed-')) && lazyHydrationManualChecks.some(check => check.startsWith('pending:')), '复杂模型历史数据懒复核必须同时记录已完成的功能复测与剩余浏览器案例 / Lazy historical model review must record both the completed functional recheck and remaining browser cases')
  const semanticMotionManualChecks = semanticMotionCase?.manualChecks || []
  expect(Boolean(semanticMotionCase) && semanticMotionManualChecks.some(check => check.startsWith('passed-')) && semanticMotionManualChecks.some(check => check.startsWith('pending:')), '语义动作第一阶段必须同时记录已完成功能验收与动作质量边界 / Semantic-motion Phase 1 must record passed functional checks and pending motion-quality boundaries')
  const hybridIkManualChecks = hybridIkCase?.manualChecks || []
  expect(Boolean(hybridIkCase) && JSON.stringify(hybridIkCase?.setup?.viewports) === JSON.stringify([[1440, 900], [760, 900]]), '混合 IK 人工案例必须覆盖 1440×900 与 760×900 / Hybrid-IK manual case must cover 1440×900 and 760×900')
  expect(hybridIkManualChecks.some(check => check.startsWith('passed-')) && hybridIkManualChecks.some(check => check.startsWith('pending:')), '混合 IK 人工案例必须同时记录 Chromium 功能验收与剩余图形边界 / Hybrid-IK manual case must record both Chromium functional acceptance and remaining graphics boundaries')
}

const sessionStart = safeRead('.ai/session-start.md')
const handoffZh = safeRead('docs/zh-CN/AI开发交接.md')
const handoffEn = safeRead('docs/en/AI-DEVELOPMENT-HANDOFF.md')
const knownZh = safeRead('docs/zh-CN/已知问题.md')
const knownEn = safeRead('docs/en/KNOWN-ISSUES.md')
const roadmapZh = safeRead('docs/zh-CN/AI开发路线图.md')
const roadmapEn = safeRead('docs/en/AI-DEVELOPMENT-ROADMAP.md')
const packageJson = safeRead('package.json')
const rootMotionRuntimeTest = safeRead('scripts/test-studio-complex-biped-root-motion-runtime.ts')
const motionVfxRuntime = safeRead('apps/playground/app/three/complex-biped-motion-vfx.ts')

expect(sessionStart.includes('同一个提交') && sessionStart.includes('scripts/check-ai-handoff.mjs'), '启动协议必须声明同提交更新和强制门禁 / Session protocol must require same-commit updates and name the gate')
expect(sessionStart.includes('实际代码和运行结果') && sessionStart.includes('旧聊天记录'), '启动协议必须包含可信度顺序 / Session protocol must include the trust order')
expect(handoffZh.includes('高级动画工具') && handoffZh.includes('browser-acceptance-and-release-hardening'), '中文交接必须记录阶段 E 完成和浏览器验收下一步 / Chinese handoff must record completed Phase E and browser acceptance next')
expect(handoffEn.includes('Advanced animation tools') && handoffEn.includes('browser-acceptance-and-release-hardening'), 'English handoff must record completed Phase E and browser acceptance next')
expect(handoffZh.includes('动作直接操控批次') && handoffEn.includes('Direct motion manipulation batch'), '中英文交接必须记录动作直接操控批次 / Handoffs must record the direct manipulation batch')
expect(handoffZh.includes('动作工坊预览与中文化可用性批次') && handoffEn.includes('Motion Studio preview and Chinese-first usability batch'), '中英文交接必须记录动作工坊预览与中文化批次 / Handoffs must record the Motion Studio preview and localization batch')
expect(handoffZh.includes('双足萌宠第一阶段交付状态') && handoffEn.includes('Biped-pet Phase 1 delivery status'), '中英文交接必须同步双足萌宠第一阶段状态 / Handoffs must synchronize biped-pet Phase 1 status')
expect(handoffZh.includes('已回退简单模型') && handoffEn.includes('simple-model fallback'), '中英文交接必须说明复杂模型失败回退 / Handoffs must document complex-model fallback')
expect(rootMotionRuntimeTest.includes("{ ...walkAsset, loopMode: 'ping-pong' as const }")
  && rootMotionRuntimeTest.includes('const sample = sampleBipedPetMotion(clip, timeMs)')
  && !rootMotionRuntimeTest.includes('patchSample(sampleBipedPetMotion(clip, timeMs), { loopMode }'),
  'Root Motion 长序列必须编译并采样真实 ping-pong 资产，不得只改写采样结果 / Root Motion long-sequence coverage must compile and sample a real ping-pong asset')
expect(handoffZh.includes('混合 IK 与足底锁定阶段交付') && handoffEn.includes('Hybrid IK and foot-lock phase delivery'), '中英文交接必须同步混合 IK 与足底锁定阶段 / Handoffs must synchronize the hybrid IK and foot-lock phase')
expect(handoffZh.includes('双足萌宠混合 Root Motion 与运动特效设计') && handoffEn.includes('Hybrid biped Root Motion and motion-VFX design'), '中英文交接必须同步混合 Root Motion 与运动特效设计 / Handoffs must synchronize the hybrid Root Motion and motion-VFX design')
expect(handoffZh.includes('双足萌宠混合RootMotion与运动特效实施计划.md') && handoffEn.includes('双足萌宠混合RootMotion与运动特效实施计划.md'), '中英文交接必须同步混合 Root Motion 与运动特效计划 / Handoffs must synchronize the hybrid Root Motion and motion-VFX plan')
expect(handoffZh.includes('Three Root Motion、重心与 IK 协同批次') && handoffEn.includes('Three Root Motion, balance, and IK coordination'), '中英文交接必须同步 Three Root Motion 协同批次 / Handoffs must synchronize the Three Root Motion coordination batch')
expect(handoffZh.includes('同一场景的有界运动 VFX 对象池批次') && handoffEn.includes('Bounded same-scene motion-VFX pool'), '中英文交接必须同步有界 Three 运动特效对象池 / Handoffs must synchronize the bounded Three motion-VFX pool')
expect(motionVfxRuntime.includes('new InstancedMesh')
  && motionVfxRuntime.includes('MAX_BURST_INSTANCES = 16')
  && motionVfxRuntime.includes('MAX_LIFETIME_MS = 1200')
  && motionVfxRuntime.includes('createEffectSlots(capacity)')
  && motionVfxRuntime.includes('Math.sin(active.facingRadians)')
  && motionVfxRuntime.includes('recentBurstStart')
  && motionVfxRuntime.includes('if (disposing || disposed) return')
  && !motionVfxRuntime.includes('.shift()')
  && !motionVfxRuntime.includes('Date.now(')
  && !motionVfxRuntime.includes('requestAnimationFrame('),
'VFX 对象池必须使用实例化粒子和固定预算，且不得读取墙钟或注册 RAF / VFX pool must use instancing and fixed budgets without wall clock or RAF')
expect(knownZh.includes('HANDOFF-001') && knownEn.includes('HANDOFF-001'), '中英文已知问题必须记录强制 AI 更新 / Known issues must record mandatory AI updates')
expect(knownZh.includes('MOTION-004') && knownEn.includes('MOTION-004'), '中英文已知问题必须记录旧数据浏览器验收 / Known issues must record legacy-data browser acceptance')
expect(knownZh.includes('MOTION-006') && knownEn.includes('MOTION-006'), '中英文已知问题必须记录动作预览与窄侧栏复验 / Known issues must record Motion Studio preview and narrow-sidebar recheck')
expect(roadmapZh.includes('阶段 A：语义 Rig 与关键帧领域') && roadmapEn.includes('Phase A: Semantic Rig and keyframe domain'), '中英文路线图必须保留语义 Rig 阶段记录 / Roadmaps must retain the semantic Rig phase record')
expect(roadmapZh.includes('阶段 E：高级动画工具') && roadmapZh.includes('Complete') && roadmapZh.includes('阶段 F：浏览器验收与发布加固') && roadmapZh.includes('状态：Next') && roadmapEn.includes('Phase E: Advanced animation tools') && roadmapEn.includes('Complete') && roadmapEn.includes('Phase F: Browser acceptance and release hardening') && roadmapEn.includes('Status: Next'), '中英文路线图必须记录阶段 E 完成并把浏览器验收标为下一步 / Roadmaps must record Phase E complete and mark browser acceptance next')
expect(roadmapZh.includes('阶段 F.1：动作直接操控可用性') && roadmapEn.includes('Phase F.1: Direct motion-authoring usability'), '中英文路线图必须记录动作直接操控可用性批次 / Roadmaps must record the direct motion-authoring usability batch')
expect(roadmapZh.includes('阶段 F.2：动作工坊预览与中文界面优化') && roadmapEn.includes('Phase F.2: Motion Studio preview and Chinese-first UI polish'), '中英文路线图必须记录动作工坊预览与中文界面优化批次 / Roadmaps must record the Motion Studio preview and Chinese-first UI polish batch')
expect(packageJson.includes('"check:ai-handoff"') && packageJson.includes('node scripts/check-ai-handoff.mjs'), 'package.json 必须运行 AI 交接门禁 / package.json must run the AI handoff gate')
expect(packageJson.includes('"check:motion-semantic-rig"') && packageJson.includes('node scripts/check-motion-semantic-rig.mjs'), 'package.json 必须运行动作领域门禁 / package.json must run the motion-domain gate')
expect(packageJson.includes('"check:motion-timeline-preview"') && packageJson.includes('node scripts/check-motion-timeline-preview.mjs'), 'package.json 必须运行时间轴预览门禁 / package.json must run the timeline-preview gate')
expect(packageJson.includes('"check:motion-prop-events"') && packageJson.includes('node scripts/check-motion-prop-events.mjs'), 'package.json 必须运行道具事件门禁 / package.json must run the prop-event gate')
expect(packageJson.includes('"check:prop-entity-editor"') && packageJson.includes('node scripts/check-prop-entity-editor.mjs'), 'package.json 必须运行道具实体门禁 / package.json must run the prop-entity gate')
expect(packageJson.includes('"check:advanced-motion-tools"') && packageJson.includes('node scripts/check-advanced-motion-tools.mjs'), 'package.json 必须运行高级动画门禁 / package.json must run the advanced-motion gate')
expect(packageJson.includes('"check:motion-direct-controls"') && packageJson.includes('node scripts/check-motion-direct-controls.mjs'), 'package.json 必须运行动作直接操控门禁 / package.json must run the motion direct-controls gate')
expect(packageJson.includes('"check:motion-studio-usability"') && packageJson.includes('node scripts/check-motion-studio-usability.mjs'), 'package.json 必须运行动作工坊可用性门禁 / package.json must run the Motion Studio usability gate')
expect(packageJson.includes('"test:studio-complex-biped-root-motion-runtime"') && packageJson.includes('scripts/test-studio-complex-biped-root-motion-runtime.ts'), 'package.json 必须运行复杂双足 Root Motion 运行时测试 / package.json must run the complex biped Root Motion runtime tests')

for (const adrPath of requiredFiles.filter(item => item.includes('/adr/'))) {
  const content = safeRead(adrPath)
  expect(content.includes('Accepted'), `ADR 必须为 Accepted / ADR must be Accepted: ${adrPath}`)
}

const firstLegacyException = legacyHistoryMigrationExceptions.entries().next().value
expect(Boolean(firstLegacyException) && matchesLegacyHistoryMigrationException(firstLegacyException[0], firstLegacyException[1].missing), '历史迁移例外正向夹具必须精确匹配 / Positive legacy migration fixture must match exactly')
expect(Boolean(firstLegacyException) && !matchesLegacyHistoryMigrationException(`${firstLegacyException[0].slice(0, -1)}0`, firstLegacyException[1].missing), '未知 SHA 不得命中历史迁移例外 / Unknown SHA must not match a legacy migration exception')
expect(Boolean(firstLegacyException) && !matchesLegacyHistoryMigrationException(firstLegacyException[0], [...firstLegacyException[1].missing, 'future-missing-type']), '额外缺失类型不得命中历史迁移例外 / Extra missing types must not match a legacy migration exception')

checkCommitHistoryPolicy()

if (failures.length) {
  console.error('AI 交接包检查失败 / AI handoff package check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log('AI 交接包检查通过，功能提交强制同步策略已启用。 / AI handoff package passed; per-feature-commit synchronization is enforced.')

function expect(condition, message) { if (!condition) failures.push(message) }
function safeRead(relativePath) { try { return read(relativePath) } catch { return '' } }
function git(args) { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() }
function ensureCommitAvailable(sha, headRef) {
  try { git(['cat-file', '-e', `${sha}^{commit}`]); return }
  catch {}
  if (headRef) {
    try { git(['fetch', '--no-tags', '--depth=1000', 'origin', `+refs/heads/${headRef}:refs/remotes/origin/${headRef}`]); return }
    catch {}
  }
  try { git(['fetch', '--no-tags', '--deepen=1000', 'origin']) }
  catch (error) { failures.push(`无法获取提交历史 / Cannot fetch commit history: ${error instanceof Error ? error.message : String(error)}`) }
}
function isFeatureSource(relativePath) {
  return /^(apps|packages)\//.test(relativePath)
    && !/(^|\/)README(?:\.[^/]+)?\.md$/i.test(relativePath)
    && /\.(?:ts|tsx|js|jsx|mjs|vue|css|json)$/i.test(relativePath)
}
function isContextPath(relativePath) {
  return contextPaths.has(relativePath)
    || /^docs\/(?:zh-CN|en)\/adr\//.test(relativePath)
}
function matchesLegacyHistoryMigrationException(commit, missing) {
  const exception = legacyHistoryMigrationExceptions.get(commit)
  return Boolean(exception)
    && JSON.stringify([...missing].sort()) === JSON.stringify([...exception.missing].sort())
}
function isAncestor(ancestor, descendant) {
  try { execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], { cwd: root, stdio: 'ignore' }); return true }
  catch { return false }
}
function migrationClosureCoversAiPackage(headSha) {
  if (!isAncestor(legacyHistoryMigrationClosure, headSha)) return false
  const changedFiles = git(['diff-tree', '--root', '--no-commit-id', '--name-only', '-z', '-r', legacyHistoryMigrationClosure]).split('\0').filter(Boolean)
  return changedFiles.includes('.ai/project-state.json') && changedFiles.some(isContextPath)
}
function checkCommitHistoryPolicy() {
  const eventPath = process.env.GITHUB_EVENT_PATH
  if (!eventPath || !existsSync(eventPath)) {
    console.log('未检测到 PR 事件，仅执行 AI 包结构检查。 / No PR event detected; structural AI-package checks only.')
    return
  }
  let event
  try { event = JSON.parse(readFileSync(eventPath, 'utf8')) }
  catch { failures.push('无法解析 GITHUB_EVENT_PATH / Cannot parse GITHUB_EVENT_PATH'); return }
  const pullRequest = event.pull_request
  if (!pullRequest) {
    console.log('当前不是 pull_request 事件，仅执行结构检查。 / This is not a pull_request event; structural checks only.')
    return
  }
  const headSha = pullRequest.head?.sha
  const headRef = pullRequest.head?.ref
  if (!headSha) { failures.push('PR 事件缺少 head SHA / PR event is missing head SHA'); return }
  ensureCommitAvailable(headSha, headRef)
  let markerCommit = ''
  try { markerCommit = git(['log', '--diff-filter=A', '--format=%H', '-n', '1', headSha, '--', '.ai/ENFORCEMENT_START']) }
  catch { failures.push('无法定位 AI 强制策略启用提交 / Cannot locate AI enforcement start commit'); return }
  if (!markerCommit) { failures.push('未找到 .ai/ENFORCEMENT_START 的添加提交 / Cannot find the commit adding .ai/ENFORCEMENT_START'); return }
  let commits = []
  try { commits = git(['rev-list', '--reverse', `${markerCommit}..${headSha}`]).split(/\s+/).filter(Boolean) }
  catch { failures.push('无法读取强制策略之后的提交 / Cannot read commits after AI enforcement start'); return }
  for (const commit of commits) {
    const parentLine = git(['rev-list', '--parents', '-n', '1', commit]).split(/\s+/)
    if (parentLine.length > 2) continue
    // `-z` 保留中文文件名原样，避免 Git quotePath 转义后误判同提交交接文档缺失。
    const changedFiles = git(['diff-tree', '--root', '--no-commit-id', '--name-only', '-z', '-r', commit]).split('\0').filter(Boolean)
    if (!changedFiles.some(isFeatureSource)) continue
    const shortSha = commit.slice(0, 9)
    const missing = []
    if (!changedFiles.includes('.ai/project-state.json')) missing.push('project-state')
    if (!changedFiles.some(isContextPath)) missing.push('handoff-context')
    if (!missing.length) continue
    if (matchesLegacyHistoryMigrationException(commit, missing) && migrationClosureCoversAiPackage(headSha)) continue
    if (!changedFiles.includes('.ai/project-state.json')) failures.push(`功能提交 ${shortSha} 未更新 .ai/project-state.json / Feature commit ${shortSha} did not update .ai/project-state.json`)
    if (!changedFiles.some(isContextPath)) failures.push(`功能提交 ${shortSha} 未更新交接上下文 / Feature commit ${shortSha} did not update a handoff context file`)
  }
}
