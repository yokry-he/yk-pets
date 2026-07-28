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
- 复杂模型的五个语义动作到 Quaternion 的动作编译器、运行时 IK、足底锁定、Root Motion、复杂舞蹈/功夫/运动动作和动作特效。
- 人类、四足、机甲 Profile 的运行时生成与编辑；当前仅 `biped-pet/v1` 正式可用。
- 本站参数化角色的 DCC/GLB 导出；当前配方和编译数据只服务本站 runtime，且无需 GLB、Blender 或手工绑骨蒙皮。

## 5. 动作消费链路

`StudioMotionAssetV2 -> normalizeMotionAsset -> resolveMotionTime -> evaluateNormalizedMotionAsset -> EvaluatedCloudFoxPose -> CloudFoxStudioCanvas -> ProceduralPet -> ExtensionAlignedCloudFox -> 语义部件适配器`

每帧只求值一次。姿态保存为相对于基础外观挂点与比例的偏移，不得修改外观配方。

## 6. 下一阶段

下一阶段是 `biped-pet-motion-and-browser-acceptance`：

1. 实现五个语义动作到 Quaternion 的编译器，并让复杂双足运行时消费结果；
2. 实现运行时 IK、足底锁定、Root Motion、复杂动作与确定性动作特效；
3. 在真实浏览器验证三工坊共享配方、持久化、简单回退、键盘、1440×900/760×900 响应式布局及控制台；
4. 验证 Chrome Side Panel、GPU/WebGL、深度排序、音频用户手势和跨浏览器最终像素；
5. 建立浏览器截图基线和多分辨率回归，修复真实验收问题并更新发布文档；
6. 未经用户明确要求仍不得合并 PR。

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
- 支持在预览画布拖动进行俯仰/水平自由旋转，并可通过控制栏缩放、输入三轴角度或一键复位；画布滚轮缩放当前暂停；
- 预览变换独立于动作资产，不会隐式创建关键帧；整只宠物的动作缩放与旋转仍由语义 Rig 控制；
- 右侧属性栏、动作层、曲线编辑器和道具事件表单禁止横向溢出并使用可收缩网格；
- 动作工坊主要可见标题、视角、插值、动作层和道具事件改为中文优先；
- 真实浏览器中的最终尺寸、拖动手感和系统滚动条仍需人工复验。

## 11. 文档体系

- 中文专题文档和 ADR 已统一使用中文文件名，英文文档继续使用英文文件名；
- `技术栈.md` / `TECH-STACK.md` 说明运行时、前端、3D、领域包、Local Agent、OpenAI 与验证工具的职责边界；
- 技术架构、项目状态、开发指南和维护指南已按当前代码与机器状态更新；
- `scripts/check-documentation.mjs` 使用显式中英文文件映射，并校验中文文件名、技术栈必需章节和仓库内 Markdown 相对链接；
- 后续新增或重命名文档必须同步中英文配对、文档索引、专项脚本和 `.ai` 交接路径。

## 12. 工坊预览方向统一批次

- 新增 `useStudioPreviewOrientation`，统一管理外观、动作、道具三个工坊的自由旋转偏移与指针拖动生命周期；
- 正面、左侧、背面、右侧现在是绝对固定视角：选择视角时先清零自由旋转偏移，再更新共享 Studio 视角；
- 即使按钮已经处于激活状态，再次点击也会复位拖动偏移，避免固定视角与旧偏移叠加；
- 外观工坊保留身体部件热点，道具工坊保留挂载提示的前景层级，拖动层只覆盖 3D 预览交互区域；
- `scripts/check-studio-preview-orientation.mjs` 覆盖共享控制器、三工坊接线、固定视角复位及交互层避让契约；真实 GPU/WebGL 下的拖动手感仍按人工验收清单复验。

## 13. 共享预览控制栏批次

- 新增 `StudioPreviewToolbar.vue`，外观、动作、道具三个工坊不再分别维护视角与预览变换表单；
- 控制栏采用上下两层：第一层集中固定视角、背景、扩展操作和复位，第二层集中缩放、X/Y/Z 自由旋转及可选预览时间；
- 动作工坊的控制栏从画布悬浮层移到独立布局行，不再遮挡宠物；动作直接操控板仍位于画布内部；
- 外观工坊通过操作插槽保留“部位定位”和“对比经典”，道具工坊的英文视角按钮已由共享中文标签替代；
- `useStudioPreviewOrientation` 统一 40%–120% 缩放边界和工作区默认缩放复位；滚轮处理器暂时保留，但三个工坊均不绑定滚轮事件；
- `scripts/check-studio-preview-toolbar.mjs` 覆盖组件分组、三工坊复用、缩放接线、可选时间和扩展操作契约。

## 14. 表情、安全形变与内置资产批次

- 外观选项新增 6 种情绪眼型和 3 种鼻型，统一眼睛尺寸表扩展到 12 种，并继续使用正式头部表面挂载；
- 语义 Rig 新增 15 个动作安全通道，覆盖头部比例、眼睛比例/间距/瞳孔/倾斜、鼻部三轴比例/偏移/嗅闻/发光、嘴部曲线、尾巴长度/蓬松和触角发光；
- 新通道默认值均为中性零值，旧动作无需迁移；动作工坊通过现有部件树和当前帧命令直接写入，不保存整份外观；
- 新增 6 个只读程序化道具和 6 个只读动作模板；用户复制后生成独立本地 ID，原模板不写入 Pinia 持久存储；
- 星云棍花和星光摆胯舞携带内置道具事件，动作预览合并内置与用户道具注册表；
- `check-studio-expression-motion-assets.mjs`、`test-studio-built-in-assets.ts` 和 pet-core 领域测试覆盖注册、范围、依赖与接线。

## 15. 双模型工坊基础批次

- 同一宠物新增独立持久化的简单/复杂模型容器；现有程序化简单模型保持默认就绪和唯一正式渲染路径；
- Studio 顶部新增全局模型模式，首次切换复杂模式时自动创建非破坏性草稿，不增加确认步骤，也不覆盖简单模型；
- 外观、动作、道具三个工坊共享模型模式，资产库显示复杂模型未创建、草稿、就绪或需修复的真实状态；
- `CloudFoxStudioCanvas` 已建立复杂模型预览适配边界，但骨骼渲染器完成前明确使用简单模型兼容预览；
- 下一阶段调整为 `in-site-parametric-biped-rig`：不导入宠物 GLB，由站内模型配方自动生成 `biped-pet/v1` 骨架、网格、蒙皮权重、Socket 和语义映射；
- 长期通过版本化 Rig Profile 支持人形、四足和机甲，但第一版只正式实现双足萌宠；
- `browser-acceptance-and-release-hardening` 仍是复杂运行时完成后的必要阶段，不得把本轮静态检查描述为真实 GPU/WebGL 验收。

## 16. 双足萌宠 Rig Profile 契约批次

- `@yk-pets/pet-core` 已新增框架无关的 `CharacterRigProfile` 契约与稳定诊断校验，覆盖骨骼唯一性、单根拓扑、父级与循环引用、语义引用、关节限制、接触点、Socket 及有限 Vector3/Quaternion；
- `biped-pet/v1` 已定义基础双足骨架：根节点、骨盆、三段脊柱、胸腔、颈部、头部、完整左右手臂与腿部，并声明耳朵、尾巴、触角三个可选生成链；
- 双脚接触点及左右手、左右脚、头部、背部和尾根 Socket 已进入领域契约；
- 渲染器、程序化网格、自动蒙皮、Quaternion 动作、运行时 IK、足底锁定和 Root Motion 仍未完成，不能将本批静态领域契约描述为复杂模型运行时或真实 GPU/WebGL 验收完成。

## 17. 双足萌宠参数化模型配方批次

- `@yk-pets/pet-core` 已新增 `CharacterModelRecipeV1`：稳定声明 `biped-pet/v1`、`biped-pet-generator/v1`、体型比例、耳朵/尾巴/触角、材质和更新时间；它是站内生成器输入，不是 GLB 等交换格式；
- `normalizeBipedPetModelRecipe` 可在不抛异常的情况下修复本地草稿或将来持久化数据中的未知枚举、`NaN`、错误颜色和越界字段，并且对相同输入与注入时间给出确定结果；
- `applyBipedPetBodyStyle` 只替换比例预设，保留用户已经配置的附属物、材质、身份和时间，降低新手尝试体型时的手动恢复成本；
- 程序化网格、骨架实例、自动蒙皮、Socket 实体、Three runtime、工坊参数面板和语义动作求解仍未完成；当前配方尚不能在复杂模型模式中生成或展示实际角色。

## 18. 双足萌宠自动骨架与蒙皮编译批次

- `compileBipedPetCharacter` 已将站内配方按固定顺序编译为 `biped-pet/v1` 骨骼、可选耳朵/尾巴/触角链、基础索引网格与每顶点四槽权重；它是框架无关的数据编译器，不创建 Three.js 对象。
- 管段统一使用八径向、四轴向拓扑；每个顶点在起止骨骼之间用平滑权重过渡。头部、手和脚末端是完全绑定各自语义骨骼的刚性区，供后续运行时稳定消费。
- 编译结果克隆 Profile 的关节限制、接触点与 Socket，验证骨骼父子顺序、数值有限性和非负权重；异常内部状态会返回 `blocked` 加错误诊断，普通损坏配方仍由归一化层修复为可编译数据。
- 稳定哈希包含归一化配方（刻意忽略 `updatedAt`）、版本身份和生成数组；不使用随机数、对象地址、系统时间或 Node 专属加密 API。
- Three runtime、复杂模型持久化、工坊参数面板、语义动作映射、IK、足底锁定、Root Motion、确定性特效及真实 GPU/WebGL 验收仍未完成；当前编译结果尚未接入正式预览链路。

## 19. 双足萌宠模型配方与编译持久化批次

- `studio-model-variants` 的复杂模型容器现在持久化站内 `CharacterModelRecipeV1` 与轻量编译摘要；首次进入复杂模式会自动建立默认双足萌宠配方，不会覆盖已经编辑的配方，也不会改动简单模型。
- 配方更新只接受可编辑字段并进行安全深合并，比例、耳朵/尾巴/触角和材质的局部修改不会丢失同级字段；更新后自动清除旧编译摘要并回到待编译草稿。
- 提交编译结果时 Store 会重新编译当前配方；只有提交哈希、提交状态和当前编译状态三者一致且均为 `ready` 才标记完成。陈旧哈希会记录诊断并保持非就绪状态，损坏持久化配方或编译摘要会在归一化时安全修复或降级为草稿。
- Three runtime、复杂模型正式预览、工坊参数面板、语义动作映射、IK、足底锁定、Root Motion、确定性特效与真实 GPU/WebGL 验收仍未完成；本批只建立可恢复的 Store 数据边界，不宣称已展示复杂模型。

## 20. 双足萌宠 Three 运行时与独立适配器批次

- `createComplexBipedPetObject` 只接收 `ready` 的框架无关编译结果，并创建 `BufferGeometry`、`SkinnedMesh`、按编译顺序组装的 `Bone`/`Skeleton` 与可按 `boneId` 解析的运行时 Socket；阻塞编译结果、错误父级、多个根、越界索引和坏 Socket 都会以中文领域错误安全拒绝。
- 几何显式包含 `position`、`skinIndex`、`skinWeight` 与索引缓冲，计算法线和包围体；索引根据顶点范围在 `Uint16`/`Uint32` 间选择。材质的基础色来自配方，次级色只作为极弱自发光，不伪造顶点色。
- 运行时 `dispose()` 可重复调用，并释放 geometry、material 与 skeleton；创建中途失败也会清理已经取得的资源。
- `ComplexBipedPetRenderer.vue` 是不创建 Canvas 的独立 Vue/Tres 适配器：每次先归一化配方，并让编译和材质创建消费同一份归一化结果；深度观察后仅在编译 hash/status/diagnostics 处理键变化时才释放旧运行时、创建对象或 emit，因此 `updatedAt` 变化和父层同摘要回写不会触发重复创建。它以 `primitive dispose=false` 交给上层既有场景，并将运行时异常转为诊断，防止 Store 回写触发渲染循环。
- 本批尚未接入 `CloudFoxStudioCanvas` 或外观、动作、道具三个工坊，尚未新增参数 UI、动作、IK、足底锁定、Root Motion、确定性特效或真实 GPU/WebGL 验收；不得把独立适配器或静态/Node 验证描述为正式复杂模型预览完成。

## 21. 复杂模型统一工坊预览接线批次

- `CloudFoxStudioCanvas` 仍只创建一个既有 `TresCanvas`：复杂模式且当前宠物存在配方时，`ComplexBipedPetRenderer` 在该场景内替换简单渲染器；简单模式与无配方场景继续使用既有 `ProceduralPet`，不会叠加两套宠物。
- 复杂 renderer 的真实 `compilation` 事件由 Canvas 统一转发为 `complex-compiled`。外观工坊仅在复杂模式、当前宠物配方存在且事件哈希与当前配方重新编译结果一致时，才调用 `commitComplexCompilation`；Store 继续负责最终的持久化复核。
- 编译期间显示“正在生成复杂模型”，成功后显示“复杂模型已就绪”。编译或 Three 运行时被阻塞时，Canvas 显示“生成失败，已回退简单模型”并在当前会话内实际回退简单渲染，不改变用户持久化的复杂模式选择。
- 外观、动作、道具三个工坊按相同 `petId` 读取同一持久化复杂配方；只有外观工坊提交编译摘要。动作与道具工坊没有新增配方表单、编译提交或独立配方。
- 资产库在配方存在时展示 `biped-pet/v1`、`biped-pet-generator/v1`、最后编译状态、诊断数量与完成度；不存在配方时明确显示“未创建”，不会伪装为就绪。
- `scripts/check-studio-complex-biped-model.mjs` 已扩展为结构化 Vue 脚本/模板门禁，检查单 Canvas 的互斥 renderer、事件转发、三个工坊共享配方及资产摘要；`check-studio-model-mode.mjs` 同步删除过期兼容预览断言并保留模式与简单路径契约。
- 本批仅完成 Task6 预览接线。复杂模型语义动作、IK、足底锁定、Root Motion、确定性特效和真实 GPU/WebGL 人工验收仍未完成。

## 22. 新手复杂模型编辑器批次

- 外观工坊在复杂模式且当前宠物已有配方时显示 `StudioComplexModelEditor`；普通区域仅提供柔软、运动、圆润、纤细四个体型模板，九项安全比例与耳朵、尾巴、触角开关。
- 编辑器由父层受控：模板先调用 `applyBipedPetBodyStyle`，再通过 `studio-model-variants.updateComplexRecipe` 原子提交；比例只提交局部 patch，附属物只写入 `enabled`，因此会保留长度与分段。任何配方变更都会清除旧编译摘要，并由既有复杂模型运行时重新编译后提交结果。
- 比例滑块在 `input` 阶段仅更新本地草稿，在 `change` 阶段只提交一次；数值框使用 `valueAsNumber`，空值或非法值会恢复当前配方而不提交。外部配方更新不会覆盖正在拖动的本地值。当前复杂模型容器没有撤销历史，禁止伪造拖动合并能力；静态门禁只检查该事件契约，单次拖动写入仍由 `.ai/visual-cases.json` 的人工验收确认。
- 高级信息折叠区只读显示 Profile、generator、骨骼数、顶点数、诊断与安全范围；不向新手暴露手工骨骼、绑定或权重编辑。760px 以下改为单列，模板使用 `aria-pressed`，开关具有稳定标签与键盘焦点。
- 本批只完成 Task7 编辑器接入；复杂模型语义动作、IK、足底锁定、Root Motion、确定性特效、导出与真实 GPU/WebGL 人工验收仍未完成。

## 23. 双足萌宠第一阶段交付状态

- 第一阶段已完成且仅包括：`biped-pet/v1`、站内 `CharacterModelRecipeV1`、程序化骨架/网格、每顶点四权重自动蒙皮、Three 复杂运行时、配方持久化、三个工坊统一预览，以及新手体型/比例/附属编辑。
- 复杂渲染失败、陈旧哈希或损坏本地数据时，当前会话会显示“生成失败，已回退简单模型”；简单云狐仍沿唯一正式渲染链路运行，复杂模式选择和配方不被回退逻辑删除。
- 这不是 GLB 导入/导出、Blender 工作流或手工骨骼/蒙皮功能；站内格式只承诺本站 runtime 消费。
- 真实浏览器发现的两项阻塞已作最小修复并加静态回归：复杂 `TresGroup.rotation` 以 `Euler`（而非 `Vector3`）接收固定视角与自由旋转组合；Studio 布局的四个 Store 只在 `onMounted` 后 hydration，工作区 watch 仅在 `session.hydrated` 后写入，恢复完成后才显式持久化当前路由工作区，避免默认 `simple` 覆盖已保存的复杂模式或抢先改变子页面 hydration 输入。
- 主代理已完成本批真实浏览器复测：新标签页无 error 或 hydration mismatch；复杂模式刷新后保持；运动模板与附属特征持久化；简单模型回退正常；`motion`、`props`、`library` 共享同一复杂配方且 Canvas 为 ready；资产库显示 `biped-pet/v1`、`biped-pet-generator/v1` 与 0 条诊断；在 760×900 下 `clientWidth === scrollWidth === 760`，四模板、九比例和三附属控件均存在。此证据完成本批 Studio 功能性浏览器验收，但不替代仍未完成的跨浏览器 GPU/WebGL 最终验收。
- `.ai/visual-cases.json` 将 1440×900、760×900、四模板、持久化、三个工坊、简单回退、键盘、无横向溢出、控制台和 GPU 检查列为人工验收。本批 Studio 功能性浏览器复测已经完成；`cross-browser-gpu-manual-acceptance` 及跨浏览器 GPU/WebGL、最终像素相关项目仍须保持未完成，直至后续完成对应图形验收。

## 24. 复杂模型语义道具挂点修复

- `CloudFoxStudioCanvas` 现在也向复杂 renderer 传递 `propInstances`、`propAssets` 与 `preservePropMaterials`；复杂模式不再静默丢失动作工坊或道具工坊的道具预览。
- 复杂 runtime 为每个已编译 Socket 创建跟随真实骨骼的 `Group`。每个复杂道具实例先在普通 Tres 父树中完整创建 `StudioPropModel` 子树，再于 `onMounted` 的下一次 Vue tick 将整个 Group 重挂到语义节点；不使用会在跨组件子树中丢失 host children 的 Tres custom attach。参数化道具、站内本地模型与材质保留策略继续和简单模式复用同一实现。
- 旧语义严格映射：左右前爪分别使用 `hand.left`/`hand.right`，左右后爪分别使用 `foot.left`/`foot.right`，头顶使用 `head` Socket。第一阶段 Profile 尚无独立口鼻和尾尖 Socket，因此 `muzzle` 明确保守跟随 `head` 骨骼，`tail-tip` 跟随最后一节真实尾骨；无尾骨时才保守回退 `tail.base` Socket。整个链路未使用简单模型的体型几何估算。
- `pet-root` 使用真实 `root` 骨骼；`space: world` 与 `world` 挂点保留在角色根空间，而不是提升到全局 Tres 场景，因此整体预览的平移、旋转和缩放仍会统一作用于道具。
- runtime 释放时会解除 Socket Group 与旧骨骼的父子关系；实例卸载只在自身 Group 仍属于目标节点时移除，避免配方更新、模式切换或卸载后残留父子引用。自动测试覆盖包含真实 Mesh 子节点的 Group 在 reparent 前后保持完整、全部旧挂点映射、幂等资源释放和 Canvas 传参。
- 主代理已完成 1440 宽度下的 Chrome 功能复测：高对比青色方块在 `right-front-paw` 经完整 Tres 子树重挂后仍可见并定位到真实 `hand.right` Socket；控制台无应用错误、父子关系警告或 hydration mismatch，页面无横向溢出。其余挂点随复杂动作、`world` 空间、材质保留策略、760 窄屏与跨浏览器 GPU/WebGL 仍按 `.ai/visual-cases.json` 保持待验收；本阶段仍使用默认姿态，不包含复杂动作求解。

## 25. 复杂模型历史数据懒复核批次

- `studio-model-variants` 的集合水合现在使用明确的 `hydration` 模式，只规范化配方、身份键和简单模型，不再为集合中每个带摘要的历史宠物执行完整角色编译。
- 持久化的 `ready`/`blocked` 仅是轻量摘要，水合时不再被直接信任：摘要会被清除，复杂变体安全降为 `draft` 且完成度回到 5；配方和以集合键为准的 `petId` 保留。
- `ensurePet`、配方更新和编译提交继续使用“已验证内存状态”语义，不会让当前会话中已经复核的 ready/blocked 状态因普通 Store 操作退化。当前宠物真正进入既有复杂 renderer 后才重新编译，并继续由 `commitComplexCompilation` 对哈希和状态做最终复核后回写 ready。
- 100 条历史记录回归使用结构和状态断言，不依赖机器速度或绝对毫秒阈值；损坏输入修复、简单模型与 authoritative key 契约保持覆盖。
- 主代理已完成 1440 宽度下的 Chrome 功能复测：刷新未验证复杂摘要后，当前访问宠物由 renderer 完成真实编译并回写 `ready`、100% 和 compilation hash；控制台无应用错误或 hydration mismatch，页面无横向溢出。`.ai/visual-cases.json` 仍保留 10/50/100 历史集合规模、760 窄屏和跨浏览器 GPU/WebGL 的后续验收，本批不改变复杂动作、IK、足底锁定、Root Motion 或特效边界。

## 26. 双足萌宠语义动作编译设计

- 已确认采用 Profile 专属 Quaternion Clip：领域层把现有动作工坊语义姿态与五个基础模板编译为框架无关骨骼轨道，Three runtime 只负责采样和写入现有 Bone。
- 第一批动作固定为待机呼吸、行走循环、起跳与落地、招手、直拳组合；支持速度、力度、幅度、情绪和循环的安全参数化。
- 本批实现 Quaternion Clip、关节限制、五个动作和复杂模型消费链路；接触、Root Motion 和事件只输出后续候选，不把运行时 IK、足底锁定、完整 Root Motion、复杂舞蹈/功夫/运动或特效标记为完成。
- 权威设计见 `docs/zh-CN/双足萌宠语义动作编译设计.md`，后续实施计划必须保持简单模型兼容、唯一 Canvas、无 GLB/网络/新增权限及失败时恢复绑定姿态的边界。
- 可执行计划已写入 `docs/zh-CN/双足萌宠语义动作编译实施计划.md`，按 Quaternion 契约、语义映射、Clip 编译采样、五模板、Three 控制器、预览接线、新手入口和阶段验收八个独立任务推进；每个功能提交必须同步 AI 状态并立即推送当前分支。
- Quaternion 契约批次已完成：`quaternion-motion.ts` 提供零长度/非有限输入恢复、固定 XYZ Euler 转换与同半球最短路径 slerp；`biped-pet-motion-adapter.ts` 提供版本化 Clip、骨骼轨道、根位移、接触候选、语义事件、诊断和真实骨骼集合编译目标契约。当前尚未实现语义映射、Clip 编译采样或 Three 播放，不能把契约完成描述为复杂动作已经可见。
- 语义姿态适配已完成：根、身体、头部、前后肢和实际存在的尾耳触角通道会按集中式动力链映射到当前角色真实骨骼集合；基础关节在生成 Quaternion 前按 `biped-pet/v1` 限制钳制，非有限通道降级为中性 warning，损坏 Profile 阻塞适配。当前仍未完成完整动作资产 Clip 编译、运行时播放和五模板 UI。
- Quaternion Clip 编译与采样已完成：编译器规范化动作、收集稳定关键时间、以 `once` 读取原始端点后保留资产循环语义，并按实际骨骼集合生成去重轨道和 `bpm-*` 确定性哈希；采样器复用统一时间解析，对根位移线性插值、对骨骼执行最短路径 slerp。损坏 Profile 输出 blocked Clip 和空安全姿态。当前尚未接入 Three 骨骼、五模板和动作工坊 UI。
- 五个基础动作模板已完成并进入统一内置资产库：待机 3.6 秒、行走 1.2 秒、起跳落地 2.4 秒、招手 3.2 秒、直拳 4 秒；生成器钳制速度、力度、幅度、情绪和循环参数，版本化扩展保存足部接触及起跳、落地、挥手和命中事件。领域语义动作编译器现已完成，但复杂 Three 骨骼播放和动作工坊一键模板入口尚未完成。
- Three 动作控制器已完成：创建时快照真实 Bone 绑定 Quaternion 和 root position，每帧先恢复绑定姿态再以 `bind × offset` 写入；播放权重通过 identity 到 offset 的 slerp 混合，停止可完整恢复。runtime 和控制器均暴露释放边界，释放后不能继续写入旧骨骼。当前尚未把动作资产和时间从唯一 Canvas 接到该控制器。
- 复杂动作预览接线已完成：动作工坊把当前草稿、播放指针和混合权重交给唯一 `CloudFoxStudioCanvas`；复杂 renderer 只在动作资产或真实骨骼集合变化时编译 Clip，时间变化只采样并调用唯一 Three 控制器。无动作、blocked Clip、模型重建和卸载均恢复或释放绑定姿态；简单模型继续消费原 `customPose`。当前尚未增加动作工坊的一键基础模板入口，也未完成浏览器逐动作验收。
