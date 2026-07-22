---
name: yk-pets-3d-pet-authoring
description: Create, extend, and validate procedural 3D pets for YK-PETS, including semantic rigs, four limbs, tails, gaze, idle motions, symbols, explicit actions, recipes, renderer adapters, tests, and documentation.
---

# YK-PETS 3D Pet Authoring Skill

使用本 Skill 创建、修改或验证 YK-PETS 的程序化 3D 宠物。目标不是只生成一个静态外形，而是交付一个可以配置、播放动作、参与闲时调度、挂载标志并通过回归检查的完整宠物实现。

## 适用任务

当请求包含以下任一目标时使用本 Skill：

- 根据文字、草图或参考图创建新的 3D 宠物；
- 为现有宠物增加或修改四肢、尾巴、眼睛、耳朵、触角等部件；
- 增加招手、跳跃、吃饭、玩球、睡觉、能量动作等可指定动作；
- 增加眨眼、呼吸、环顾、轻摇尾等闲时行为；
- 增加胸前或后背文字、徽记和能量核心；
- 将宠物接入 `pet-core`、`<yk-pet>` 或框架适配器；
- 验证动作、挂点、配方兼容、性能和四视角视觉质量。

## 默认实现范围

除非用户明确要求其它方式，第一选择是：

- TypeScript；
- Vue 3 + TresJS + Three.js；
- 程序化几何或已有项目内几何；
- Transform Rig，而不是必须依赖 Blender 骨骼蒙皮；
- 单头、单身体、四肢、双眼、单尾巴；
- 胸前与后背标志；
- `pet-core` 配方和渲染器接口；
- `<yk-pet>` 作为跨框架宿主。

GLB、骨骼蒙皮、多尾、翅膀、非对称身体或自由骨骼映射属于扩展模式。只有用户明确提出，或现有项目已经采用这些结构时才启用。

## Skill 目录

- `references/rig-and-anchors.md`：Rig 层级、语义挂点和坐标规则；
- `references/motion-and-idle.md`：动作生命周期、动作姿态和闲时调度；
- `references/appearance-symbols-and-effects.md`：外观配方、胸背标志、道具和特效；
- `references/acceptance-and-performance.md`：验收矩阵、性能和安全边界；
- `templates/`：宠物定义、Rig、动作和渲染器模板；
- `scripts/scaffold-pet.mjs`：生成新宠物骨架；
- `scripts/validate-pet.mjs`：验证宠物目录；
- `examples/cloud-fox-request.json`：可直接参考的输入请求。

## 开始前必须读取

1. 仓库当前分支和最新提交；
2. `packages/pet-core/src/index.ts`；
3. `packages/pet-web-component/src/index.ts`；
4. 当前物种注册表和已有渲染器；
5. 当前动作注册表；
6. 本 Skill 的四份 `references` 文档；
7. 用户提供的参考图、外观描述和动作要求。

不要在未检查现有实现的情况下复制一套新的核心、动作运行时或渲染管线。

## 输入解析

将用户请求整理为以下结构。缺省项使用安全默认值，不要为了细节中断开发。

```ts
interface BuildPetRequest {
  operation: 'create-pet' | 'add-action' | 'edit-rig' | 'edit-symbol' | 'validate-pet'
  speciesId: string
  petName?: string
  visualStyle?: 'procedural-cute' | 'robot' | 'organic' | 'glb'
  referenceImages?: string[]
  bodyShape?: string
  palette?: Record<string, string>
  requiredParts?: string[]
  requiredActions?: string[]
  idleActions?: string[]
  chestSymbol?: Record<string, unknown>
  backSymbol?: Record<string, unknown>
  constraints?: string[]
}
```

参考图只用于提取：轮廓、头身比、四肢位置、尾巴走向、眼睛比例、颜色、标志和整体气质。不要把截图中的相机透视误当成模型真实比例。

## 非协商规则

### 单一事实来源

- 通用配方、物种和渲染器协议属于 `pet-core`；
- 具体身体结构属于物种实现；
- 动作元数据属于动作注册表；
- 菜单、调度和动作时长必须读取注册表；
- 不复制已有正式宠物的完整动作实现。

### Rig

- 必须使用语义挂点，而不是在每个动作中重新猜位置；
- 前肢至少分为肩部、前臂和爪端；
- 后肢必须可以独立参与动作；
- 尾巴至少分为尾根、中段和尾尖；
- 左右眼必须拥有独立基础挂点；
- 胸口、后背、嘴部和道具必须有明确 Anchor；
- 尾巴局部动作不能驱动整只宠物旋转。

### 动作

- 每个动作必须注册唯一 ID、时长、分类、强度、打断策略和闲时层级；
- 动作至少包含 `enter / active / exit / settle`；
- 可指定动作必须能重复播放同一个动作；
- 道具、视线、身体和四肢必须读取同一份共享运动姿态；
- 旋转动作结束时不能反向回转；
- 爆炸粒子只能外散、减速、下落和淡出，不能倒吸；
- 手动动作优先于闲时动作。

### 眼睛

- 眼球、瞳孔或发光点、高光必须分层；
- 追视目标先从世界坐标转换到头部局部坐标；
- 左右眼保持同向追视，但保留镜像高光；
- 不得把眼睛缓动到脸部中心。

### 配方

- 外观配方与运行时状态分离；
- 导入旧配方时补齐新字段；
- 修改一个部件不得覆盖无关部件；
- 保存、导入、导出、撤销和重做必须保留新增字段；
- 比例和偏移必须限制在物种安全范围内。

### 标志

- 胸前和后背标志不得写死字符；
- 支持文字、颜色、大小、旋转、发光和 XYZ 偏移；
- 胸口支持 `none / energy-core / symbol / hybrid`；
- 后背标志默认避开尾根和主要尾巴运动范围。

### 性能和安全

- 尊重 `prefers-reduced-motion`；
- 页面隐藏时暂停闲时调度并降低渲染成本；
- 限制 DPR 和粒子数量；
- 卸载时释放纹理、材质、计时器和事件监听器；
- 配方不得包含函数、脚本或任意命令；
- 动作只能从注册白名单调用；
- 不从配方加载远程 JavaScript。

## 创建新宠物流程

### 1. 调研现有架构

确认当前项目的：

- `PetRecipeEnvelope`；
- `PetSpeciesDefinition`；
- `PetRendererAdapter`；
- `<yk-pet>` 注册方式；
- 动作注册表；
- Studio 配方存储与同步；
- 正式扩展渲染入口。

### 2. 提取视觉设计

从描述或参考图记录：

- 头身比；
- 身体主轮廓；
- 耳朵或触角轮廓；
- 眼睛尺寸和间距；
- 四肢长度与嵌入方式；
- 尾根位置、尾巴分段和尾尖；
- 主色、阴影、暖色和发光色；
- 胸前和后背标志；
- 需要的特效和道具。

### 3. 生成基础目录

可以运行：

```bash
node skills/yk-pets-3d-pet-authoring/scripts/scaffold-pet.mjs \
  --species cloud-cat \
  --name "Luma" \
  --output apps/playground/app/components/pets/cloud-cat
```

生成后必须根据具体物种修改模板，不能把模板默认比例直接当作最终设计。

### 4. 建立语义 Rig

按 `references/rig-and-anchors.md` 创建：

- 根、身体和头部；
- 左右眼和瞳孔；
- 四肢三级控制；
- 尾根、中段和尾尖；
- 嘴、胸口、后背和道具 Anchor。

### 5. 先完成生命感基础

在增加复杂动作前实现：

- 待机呼吸；
- 自然眨眼；
- 轻微环顾或指针追视；
- 轻摇尾；
- 耳朵或触角微动；
- 页面隐藏和减少动态效果处理。

### 6. 接入外观配方

建立默认配方和规范化函数，包含：

- 身份；
- 颜色；
- 比例；
- 部件样式；
- 尾巴和前爪设计；
- 胸背标志；
- 发光、轨道和特效；
- 安全范围和迁移规则。

### 7. 注册动作

至少实现：

- `idle`；
- `greeting`；
- `jumping`；
- `stretching`；
- `resting`；
- 一个道具动作；
- 一个尾巴动作。

按用户要求追加其它动作。每个动作遵循 `references/motion-and-idle.md`。

### 8. 注册渲染器

- 实现或复用 Vue/TresJS 画布；
- 创建 `PetRendererAdapter`；
- 注册唯一 `rendererId`；
- 通过 `<yk-pet>` 挂载；
- 保留框架无关核心。

### 9. 接入 Studio

- 注册物种；
- 提供默认外观；
- 提供可编辑安全范围；
- 支持四视角；
- 支持动作下拉和重复播放；
- 支持保存、导入、导出、撤销和重做；
- 需要时同步扩展。

### 10. 验证

运行：

```bash
node skills/yk-pets-3d-pet-authoring/scripts/validate-pet.mjs \
  --root apps/playground/app/components/pets/cloud-cat
```

再运行仓库类型检查、测试和构建。自动检查通过后仍需执行四视角人工视觉矩阵。

## 增加动作流程

1. 查找动作注册表并确认 ID 未重复；
2. 声明所需挂点和共享目标；
3. 定义阶段、原始时长和演示时长；
4. 创建共享 `MotionPose`，不要在眼睛、道具和四肢中复制公式；
5. 实现手动打断、重复播放和 settle；
6. 设置闲时层级；
7. 更新菜单、文档和回归检查；
8. 从正面、左侧、背面和右侧播放完整动作。

## 修改现有宠物流程

- 先读取最新实现和 Git 差异；
- 只修改用户要求的局部领域；
- 不重置现有配方和动作；
- 保留旧 JSON 迁移；
- 检查依赖该挂点的全部动作；
- 若复杂构图无法稳定修复，优先回退到最后一个位置正确的局部动作实现，而不是回退整个阶段。

## 交付要求

每次使用本 Skill 完成开发后，输出必须包含：

- 新增或修改的物种、Rig 和渲染器；
- 默认外观和迁移策略；
- 可指定动作清单；
- 闲时动作和优先级；
- 胸背标志能力；
- 新增回归检查；
- 类型检查、测试和构建结果；
- 未执行的人工视觉检查，不得冒充已经完成；
- 使用示例和已知限制。

## 完成定义

只有同时满足以下条件才算完成：

- 四肢、眼睛和尾巴具有稳定 Rig；
- 待机时有自然生命感；
- 用户可以按 ID 指定并重复播放动作；
- 闲时动作不会干扰手动操作；
- 胸前和后背标志可配置；
- 配方可保存、迁移、导入和导出；
- `<yk-pet>` 可以找到并挂载渲染器；
- 四视角主要动作没有明显穿模和反向追视；
- 自动测试、类型检查和生产构建通过。
