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
- 五个基础动作模板已完成并进入统一内置资产库：待机 3.6 秒、行走 1.2 秒、起跳落地 2.4 秒、招手 3.2 秒、直拳 4 秒；生成器钳制速度、力度、幅度、情绪和循环参数，版本化扩展保存足部接触及起跳、落地、挥手和命中事件。领域语义动作编译器、复杂 Three 骨骼播放、动作工坊一键模板入口，以及后续混合 IK 与足底锁定链路现均已完成。
- Three 动作控制器已完成：创建时快照真实 Bone 绑定 Quaternion 和 root position，每帧先恢复绑定姿态再以 `bind × offset` 写入；播放权重通过 identity 到 offset 的 slerp 混合，停止可完整恢复。runtime 和控制器均暴露释放边界，释放后不能继续写入旧骨骼。当前尚未把动作资产和时间从唯一 Canvas 接到该控制器。
- 复杂动作预览接线已完成：动作工坊把当前草稿、播放指针和混合权重交给唯一 `CloudFoxStudioCanvas`；复杂 renderer 只在动作资产或真实骨骼集合变化时编译 Clip，时间变化只采样并调用唯一 Three 控制器。无动作、blocked Clip、模型重建和卸载均恢复或释放绑定姿态；简单模型继续消费原 `customPose`。当前尚未增加动作工坊的一键基础模板入口，也未完成浏览器逐动作验收。
- 新手基础动作入口已完成：动作资产栏直接展示待机、行走、起跳落地、招手和直拳五个模板；点击会自动保存上一草稿、复制只读模板为本地可编辑动作、停止旧播放并打开新资产，无需先建空动作或理解骨骼。按钮提供中文可访问名称和稳定键盘焦点，窄侧栏保持可滚动且无固定宽度扩张。当前剩余阶段工作是完整自动验证与真实浏览器逐动作验收。

## 27. 双足萌宠语义动作第一阶段交付

- 第一阶段已完成：框架无关 Quaternion 契约、语义姿态适配、关节限制、确定性 Clip 编译和采样、五个基础动作、绑定姿态相对的 Three 控制器、唯一 Canvas 接线与新手模板入口均已落地。
- `compileBipedPetMotion` 以实际 runtime `boneIds` 为目标编译；复杂 renderer 只在动作资产或骨骼集合变化时重编译，播放时间变化只采样。停止、blocked Clip、模型重建和释放都会恢复或放弃旧绑定姿态。
- Chrome 1440×900 功能验收逐个创建了五个模板，确认复杂模型保持 ready 且时长分别为 3600、1200、2400、3200、4000 ms；行走循环验证播放指针前进、暂停保持、停止归零，简单/复杂切换后 Canvas 模式正确，页面无横向溢出。
- Chrome 760×900 确认五个模板按钮全部可见，`clientWidth === scrollWidth === 760`，复杂模型 ready，控制台没有 error。该检查不替代 Safari/Firefox、不同 GPU/WebGL 和最终像素验收。
- 当前复杂模型仍使用第一阶段低细节程序化拓扑与自动权重。本批只证明动作编译和播放链路，不把运行时 IK、足底锁定、完整 Root Motion、复杂动作库、动作特效、真实关节体积保持或其他体型 Profile 标记为完成。

## 28. 双足与多骨骼链混合 IK 设计

- 已确认采用混合求解架构：`biped-pet/v1` 与未来标准人类腿链优先使用解析式 Two Bone IK；四足、机甲和其他非标准多骨骼链通过同一约束契约使用受约束 FABRIK，用户不需要选择算法。
- 运行顺序固定为绑定姿态恢复、Quaternion FK、世界矩阵更新、接触状态机、IK/足底锁定、脚部朝向补偿和最终世界矩阵更新；不得创建第二 Canvas、Skeleton 或隐藏动画循环。
- 每只脚独立维护 free/acquiring/locked/releasing/disabled 状态。时间倒退、跨越过大、切换动作、停止、模型重建和释放都会清空锁定，单肢求解失败只回退该肢体 FK。
- 本批计划覆盖统一约束契约、解析式求解、FABRIK 基础、足底锁定、五个基础动作接触与重心优化及浏览器验收；不把完整 Root Motion、地形检测、正式四足/机甲 Profile、高细节拓扑或动作特效标记完成。
- 权威设计文档为 `docs/zh-CN/双足与多骨骼链混合IK设计.md`。
- 可执行计划为 `docs/zh-CN/双足与多骨骼链混合IK实施计划.md`，分为 Profile 契约、编译传播、解析式 IK、受约束 FABRIK、接触采样、Three 足锁控制器、renderer 生命周期和阶段验收八个任务；必须逐任务测试驱动、提交并推送。

## 29. 混合 IK Profile 契约批次

- `CharacterRigProfile` 新增可选的 `limbIk` 契约，统一声明肢体链、自动/解析式/FABRIK 求解偏好、接触点、极向量、伸展上限、单帧最大修正角和混合权重；旧 Profile 不声明该字段时保持兼容。
- Profile 校验现已覆盖肢体 ID 唯一性、至少三骨骼、骨骼存在且父级路径连续、接触点存在、非零有限极向量，以及伸展、修正角和权重的安全范围，并继续按声明顺序返回稳定诊断。
- `biped-pet/v1` 已为左右腿声明 `auto` 混合 IK 链，后续运行时可优先选择解析式 Two Bone IK，并在不满足标准链条件时回退受约束 FABRIK。
- 该批只完成框架无关的 Profile 契约；角色编译传播已在第 30 节完成。解析式求解器、受约束 FABRIK、动作接触采样、Three 足底锁定和浏览器验收仍未完成；`bipedPetRuntimeIkComplete` 与 `bipedPetFootLockComplete` 必须继续保持 `false`。

## 30. 混合 IK 角色编译传播批次

- `compileBipedPetCharacter` 现已将 Profile 的左右腿混合 IK 定义编译进 `CompiledCharacterModel.limbIk`，并将该约束纳入确定性角色哈希，后续约束变更不会误复用旧编译摘要。
- 每次 ready 编译都会独立克隆肢体定义、`boneIds` 和 `poleAxis`，不与 Profile 或其他编译结果共享可变引用；Profile 校验或编译异常导致的 blocked 结果则返回全新空 `limbIk` 集合。
- 本批仅完成角色编译传播。解析式 Two Bone IK、受约束 FABRIK、动作接触采样、Three 运行时 IK 与足底锁定仍未完成；`bipedPetRuntimeIkComplete` 和 `bipedPetFootLockComplete` 保持 `false`。

## 31. 解析式两段链 IK 求解器批次

- `@yk-pets/pet-core` 新增框架无关的 `solveAnalyticTwoBoneIk`：使用余弦定理保持上下两段原始长度，以根节点到目标的方向作为主轴，并把 Pole 正交化为稳定弯曲方向。
- 目标距离会钳制在两段长度差加安全余量与配置伸展上限之间；原目标超出或低于物理可达区时返回 `clamped`，可达时返回 `solved`。Pole 为零或与主轴共线时，求解器会按主轴绝对值最小分量选择确定性正交轴，不依赖随机扰动。
- 零长度段、非法伸展比例、非有限输入和有限大数导致的中间溢出会返回 `blocked`。有限非零链也不代表必有可行区间：固定下界高于 `maxStretchRatio` 配置上限时同样阻塞，绝不通过抬高上限伪造解；阻塞结果本身仍保证位置与误差有限，且求解过程不突变调用方输入。
- 可达域按闭区间判断：除输入坐标重建段长产生的少量 ULP 边界漂移外，目标严格越界时即使只相差 `5e-13` 也返回 `clamped`，恰好位于上下边界则返回 `solved`。自动测试同时覆盖段长保持、零/共线 Pole、非法比例、数值溢出、确定性和输入不突变。
- 数值实现会先安全归一化 Pole，再用尺度无关阈值判定共线并验证最终弯曲方向为有限、单位且正交；三角形高度使用公共尺度上的 Kahan-Heron 重排，避免 `1e8:1` 长短段因平方差消去而坍缩。归一化 Heron 因子只吸收 `Number.EPSILON` 小倍数内的负舍入，明显违反三角不等式仍会阻塞；非整数不等长链的闭区间边界保持可解。
- 返回 `solved` 或 `clamped` 前会复核两段长度，直接采用每段 `1e-8` 相对误差上限，不再用坐标 ULP 估算把普通近等长下边界过度收紧。大平移导致坐标量化、无法满足该严格相对误差时返回 `blocked`，也不会因坐标量级放宽成功标准。
- 运行时向量必须是恰含三个有限数字的数组；`null`、空数组、错误长度和错误元素不会抛异常。`blocked.error` 对有效目标记录有限的绑定姿态末端残差，目标本身无效或残差不可表示时使用 `Number.MAX_VALUE` 哨兵，不再以零伪装已到达。
- 本批只完成纯数值解析式求解器。受约束 FABRIK、动作接触采样、Three 运行时 IK 和足底锁定仍未完成；`bipedPetRuntimeIkComplete` 与 `bipedPetFootLockComplete` 继续保持 `false`。

## 32. 受约束 FABRIK 后备求解器批次

- `@yk-pets/pet-core` 新增框架无关的 `solveConstrainedFabrik`，作为未来非标准多骨骼链的后备数值能力；它复制输入并缓存初始段长，最多执行 8 次 backward/forward 迭代，达到容差后提前停止。
- 每轮迭代会把内部关节点投影到 Pole 定义的稳定弯曲半平面。Pole 先以尺度安全方式归一化；零向量、与主轴共线或极大但有限的等比例向量都会使用确定性正交后备，不依赖随机扰动。
- 远端目标会受 `maxStretchRatio` 限制：比例为 `1` 时直接沿根节点到目标的方向按原始段长展开；比例低于 `1` 时把有效目标钳制到配置可达域，并通过弯曲链保持所有原始段长，不会通过缩放骨骼伪造最大伸展。
- 只有末端误差达到容差且每段长度通过后置复核时才返回 `solved`；可达域外的有限最大伸展返回 `clamped`，迭代上限内未收敛、零长度段、畸形运行时结构、非法求解参数或有限大数溢出则安全返回 `blocked`。所有阻塞结果的位置与误差仍保持有限。
- 自动测试覆盖三点、四点和更多段链、段长保持、配置伸展上限、不可达方向、输入不突变与无引用共享、确定性、Pole 缩放与共线回退、迭代上限、非法参数、畸形向量和数值溢出。
- 本批只完成纯数值 FABRIK 后备求解器；动作接触采样、Three 运行时混合 IK 与足底锁定仍未完成，`bipedPetRuntimeIkComplete` 和 `bipedPetFootLockComplete` 继续保持 `false`。

### FABRIK 伸展与 Pole 约束复核

- 配置伸展比例低于 `1` 的不可达目标不再依赖直线奇异姿态附近的渐近迭代；越界目标会进入后续“一般平面构造”命中配置边界，因此 `.95`、`.99` 等接近物理链长的上限也能稳定保持原段长。
- 成功结果新增统一半平面后置条件：以 Root→Target 为主轴，把尺度安全归一化后的 Pole 投影为弯曲方向，所有内部关节点必须位于同一求解平面的 Pole 正半侧。普通 FABRIK 未收敛、出现零方向或末端命中但平面复核失败时，统一进入一般构造，不再依赖连续聚合分割门槛。
- 回归测试覆盖两段链 `.95/.99` 最大伸展、不同段长多段链、五点链全部内部节点的统一 Pole 平面，以及段长与末端后置条件。
- 统一 Pole 约束的成功后置条件同时检查两个维度：内部节点到 Root→Target/Pole 求解平面的绝对距离必须在按总链长缩放的严格容差内，并且节点在平面内沿 Pole 投影方向的坐标不得越过负半平面。Pole 与主轴共线时复用求解器的确定性正交后备来定义平面。
- 末端命中不再单独构成成功条件：非共面链即使 FABRIK 在 3 次迭代后把末端误差降为零，也必须由一般构造恢复统一求解平面；返回时保留实际迭代次数。

### FABRIK 完整可达域与一般平面构造

- 求解器会为每个链后缀预计算完整物理可达区间：最大距离为后缀总长，最小距离为 `max(0, 2 × 最长段 - 后缀总长)`。全链有效域固定为 `[physicalMin, min(physicalMax, totalLength × maxStretchRatio)]`；目标过远或过近都钳制到最近边界并返回 `clamped`，配置域与物理域没有交集时才安全阻塞。
- 确定性后备不再离散采样每层的剩余距离，而是把全部链段和 Root→Target 闭合边视为一个凸圆内接多边形。多边形不等式与固定段长链的物理距离可达域等价；实现只需求解公共外接圆半径这一维连续根，再按段长对应的中心角依次生成关节点，因此不会遗漏宽度小于固定采样步长的连续可行窗。
- 一般构造覆盖同轴直链收缩奇异、无连续聚合分割的异长链、`physicalMin > 0` 的过近目标，以及固定种子的三段、四段和五段链。显式 `null` 的 `maxIterations`/`tolerance` 不再被当作默认值，只有 `undefined` 使用默认；稀疏外层或向量槽会在数值运算前被拒绝，阻塞结果保持全有限。
- 构造本身不伪造 FABRIK 迭代；钳制目标直接构造时记录 `iterations: 0`，先完成迭代再使用后备时保留实际迭代次数，且任何路径都不会超过 8 次。
- 一般构造保留 `16384` 次数值求值硬预算；当前半径括界和二分通常只需几十次。物理最小/最大边界直接解析共线构造，目标等于根节点时使用根处切线和朝圆心方向确定 Pole 正侧。预算耗尽、坐标精度不足或后置复核失败时仍安全返回 `blocked`，不对任意长链和任意浮点尺度作无边界承诺。
- 反例回归现已覆盖：`1/2/1` 内部域、`4/3/2` 无连续聚合分割、非整数异长链物理最小边界、两段单位链回到根节点、固定种子三至五段过近侧内部域，以及 FABRIK 零方向、迭代未收敛和已命中但非共面的统一后备路径。
- 最终连续构造额外覆盖 `1/1/2/2`、固定四段和五段窄可行窗。固定 LCG 各扫描 5000 组三段、四段和五段可达链，误阻塞与无效成功均为 0；本机平均单次约 `0.0099`、`0.0103`、`0.0105` 毫秒，观察到的最大值分别约 `0.522`、`0.451`、`0.165` 毫秒。
- 零距离且唯一最长段恰等于其余段总和的退化多边形不进入无有限半径的圆求解，而是按段顺序让最长段与其余段沿稳定主轴反向，确定性共线闭合。两段等长链仍使用根处切线朝 Pole 正侧折叠。
- 全链总长、最长段和 `physicalMin` 现在来自同一次正序段长统计；是否越界只吸收按链尺度计算的少量累计 ULP，姿态与状态使用同一边界来源。非整数精确最小边界保持 `solved/error: 0`，而相差 `5e-13` 的真实上下界越界仍返回 `clamped`。

## 33. 确定性足底接触阶段与基础动作接触数据批次

- `sampleBipedPetMotion` 现在为 ready 与 blocked Clip 都返回稳定的动作 ID、Clip 哈希、时长、循环模式和解析后时间；blocked Clip 继续返回空骨骼、零根位移以及空接触集合，不会把无效动作传给运行时。
- 接触候选会先按接触 ID、起点和终点稳定排序；同 ID 的重叠或端点相邻区间在编译期合并为连续组件，组件置信度固定取成员最大值。零长度、反向或钳制后为空的候选会在哈希前移除，因此不会制造无采样行为但哈希不同的 Clip。
- 线性组件按统一 80 毫秒窗口采样为 `acquiring`、`locked`、`releasing` 三阶段；不足 160 毫秒的区间会把淡入淡出分别裁剪到区间一半。区间起点和终点会保留权重为 0 的阶段状态，但 `activeContacts` 只包含权重大于 0 的去重 ID。
- `loop` 动作中同 ID 的首组件若从 0 开始、尾组件若在完整时长结束，会视作跨接缝的同一环形组件：首端不再淡入、尾端不再淡出，且两侧使用共同的最大置信度；覆盖完整循环的接触始终保持 `locked/1`。负时间、精确时长与跨周期时间都先经统一循环解析，不再在循环接缝瞬时失锁。
- `ping-pong` 仍按线性区间处理普通终点，精确折返点可为权重 0 的 `releasing`；只有完整覆盖 `0..duration` 的接触在往返折点保持 `locked/1`。接触状态最终按 ID 稳定排序，置信度不与阶段权重相乘。
- Clip schema 继续保持 V1；`fadeIn`、`fadeOut` 是可选的编译提示。历史 V1 Clip 缺少这两个字段时按 `true` 解释，继续执行原有 80 毫秒双侧淡变；只有新编译器显式写入 `false` 才抑制循环接缝侧淡变。接触编译顺序、`contactStates` 与 `activeContacts` 统一使用 code-point 比较，不依赖运行环境 locale。
- 五个基础模板的 ID、名称、时长、循环模式和道具依赖保持不变。待机与招手声明双脚全程支撑；跳跃声明蓄力双支撑、腾空无接触和落地双支撑；行走通过主支撑区间与循环首尾短区间形成左右交替和短双支撑；直拳声明双脚全程站姿支撑。
- 自动测试覆盖 1.2 秒循环夹具的接触阶段、起止边界、重叠与相邻区间并集、无效候选哈希、负时间与精确循环接缝、ping-pong 折返点、极短区间，以及五个内置模板的接触阶段。纯数值 IK 求解器仍保持完成；Three 运行时 IK、足底锚点锁定、Root Motion 和动作特效尚未完成，对应状态继续为 `false`。

## 34. Three 混合 IK 与足底锁定运行时批次

- 复杂双足萌宠动作控制器现可选择性接收 `CompiledCharacterModel`：没有编译结果时继续执行原有绑定姿态相对 FK，传入 ready 编译结果时则在 FK 与世界矩阵更新后执行混合 IK 和足底锁定，不改变既有调用兼容性。
- 每个接触点独立维护世界锚点；`acquiring`、`locked`、`releasing` 的正权重帧会捕获或沿用锚点，完全释放后移除。Clip 哈希变化、普通时间倒退、异常大时间跳、停止、重建和释放会清除旧锚，并允许当前帧重新捕获；同一 loop Clip 在结尾与开头各 `min(250ms, duration×0.25)` 的真实接缝回绕则按肢体检查连续接触，接缝两侧仍 active 的脚保留锚点，已释放的脚单独清除。
- `auto` 只有在运行时父子链连续、三点或受支持的四骨聚合段非零有限、contact 位于 tip 或其后代时才选择解析式 Two Bone IK；更长的连续链或不满足解析映射的 `auto` 链进入完整 FABRIK。显式 `analytic-two-bone` 若映射非法会按单肢回退 FK，显式 `fabrik` 始终使用 FABRIK，不能只凭骨骼数量猜测路由。
- 世界方向修正会先通过父级世界 Quaternion 的共轭变换转换到局部空间，再按 Profile 权重、动作权重、接触阶段权重、置信度和每骨骼累计最大修正角共同限制。接触捕获时同时保存 `tip→contact` 世界偏移和 `boneWorld × contact.localRotation` 世界朝向；求解目标固定为 `anchor - capturedOffset`，腿链位置与 contact 世界朝向以最多三轮纯 Quaternion 修正交替收敛。三轮单次混合固定使用 `1-(1-mix)^(1/3)`，组合后的总权重恰为 `mix`；每骨骼整帧累计角预算同时缩放为 `maxCorrectionRadians×mix`，不会因多轮迭代放大低权重。禁止平移 foot、ankle 或其他蒙皮骨骼，所有局部 position 和链段长度保持绑定值。
- 双支撑阶段会先根据两脚垂直锚点误差修正骨盆局部 Y，严格钳制在绑定值的 `[-0.08, 0.08]` 范围；单支撑不启用该骨盆策略。可达的双支撑 wave 窗口以纯旋转把足底误差保持在 `1e-3` 内；walk 单支撑 `t=100→320ms` 的 tip 目标距离为 `0.9749188396`，而聚合链最大可达距离为 `0.9609095903`，超出 `0.0140092493` 时保留有限残差并报告 `clamped`，不会硬拉骨骼。`clamped` 诊断按肢体、求解器和状态去重，全部诊断采用 64 项 FIFO 硬上限；有限合法解仍会应用，不会被误当成失败回退。该边界需要后续 Root Motion/重心策略解决，当前 `bipedPetRootMotionComplete` 仍为 `false`。
- 缺失骨骼、断链、缺失接触点、blocked 编译或单肢数值异常只让对应肢体回退 FK，诊断按原因去重，另一肢仍可继续。每肢在写入前会快照 `limb.bones + contactBone` 的唯一 Quaternion 集合；任何链段或脚部朝向更新失败都会完整恢复该帧 FK，不留下半肢 IK。IK 对局部位移的所有权仅限双支撑骨盆 Y：外部写入的 foot/ankle position 在 active、weight 0、`reset` 与 `dispose` 中均保持不变。控制器的 `reset` 会恢复自身修改的骨盆局部位置并清空时间身份，`dispose` 幂等；释放后的直接 IK 调用为安全 no-op 并记录一次诊断，外层动作控制器仍维持原有释放后拒绝写入语义。
- 自动测试每帧先经外层动作控制器写入真实 FK，再覆盖左右脚独立锁定、普通倒退/Clip 切换/异常大跳清锁、loop 接缝连续保锚与非连续释放、0.6rad 脚部扭转朝向误差收敛、解析式/FABRIK 实际末端改善、非法映射与损坏单肢完整 FK 回退、双/单支撑骨盆边界、低权重近似缩放、weight 0 与纯 FK 完整一致、40 个 Clip 身份下诊断有界、输入不突变、绑定局部 position、链段长度、有限单位 Quaternion、重置和重复释放。本批不实现完整 Root Motion、地形法线检测、动作特效或正式四足/机甲 Profile；`bipedPetRootMotionComplete` 与 `bipedPetMotionVfxComplete` 继续保持 `false`。

## 35. 复杂模型混合 IK 正式渲染链路批次

- `ComplexBipedPetRenderer` 现在把创建当前 Three runtime 的同一份 `CompiledCharacterModel` 传给唯一动作控制器；复杂模式因此正式启用第 34 节的混合 IK 与足底锁定，简单模式仍走互斥的 `ProceduralPet` 路径，不创建复杂控制器、第二 Canvas 或隐藏循环。
- 动作资产切换会在编译新 Clip 前先恢复绑定姿态并清空旧足底锚点；无动作、blocked Clip 和动作编译异常都会清除旧 Clip 并再次复位。播放时间与权重变化仍只执行采样和应用，不重建 runtime 或 controller。
- 模型配方或编译摘要变化时，会先清理旧 controller/runtime，再用同一 compilation 创建新对象。中途失败会解除响应式引用并按 controller、runtime 的逆序释放已取得资源，再上报 blocked 诊断；卸载继续执行幂等释放，不让 Tres primitive 保留半成品 Canvas 对象。
- 静态门禁新增生命周期语义检查及注释伪装、错误复位顺序负例，避免只依赖单一源码片段。本批已接通正式生产渲染链路，但性能、真实浏览器逐动作与 GPU/WebGL 验收留给第 8 个任务；完整 Root Motion 和动作特效仍未实现，`bipedPetRootMotionComplete` 与 `bipedPetMotionVfxComplete` 必须保持 `false`。
- 创建失败清理门禁最终改用 Playground 已直接声明的 TypeScript 解析器：只接受 `createRuntime` 顶层真实创建赋值对应的异常 `catch`，并要求其中依次存在 controller 与 runtime 的独立顶层清理 `try/catch`，最后发出 `three-runtime-create-failure` blocked 诊断；前一资源释放抛错不会阻止后一资源释放或诊断上报。字符串、注释、正则、模板、嵌套分支和嵌套伪创建均不能伪造通过。Vue 模板互斥门禁继续在剥离 HTML 注释后要求复杂与简单 renderer 各唯一一次。

## 36. 混合 IK 与足底锁定阶段交付

- 已完成 Profile 契约、编译传播、解析式 Two Bone IK、受约束 FABRIK、五个基础动作的确定性接触阶段、Three 运行时混合 IK、逐脚足底锁定，以及正式 renderer 的创建、动作切换、重建与释放生命周期。
- `auto` 对标准双足链优先解析式求解，对更长或不符合解析映射的连续链回退 FABRIK；显式求解偏好保持严格。缺失骨骼、断链、异常数值或单肢求解失败只回退该肢 FK，不阻塞另一肢。
- 足底锁定只通过 Quaternion 和双支撑阶段骨盆 Y 的 `[-0.08, 0.08]` 补偿工作，不平移或拉长蒙皮肢体。动作/Clip 身份变化、普通倒退、异常大跳、停止、重建和释放会清理旧锚；连续 loop 接缝按肢体保留仍有效的锚。
- 行走单支撑 `t=100→320ms` 的目标距离比聚合腿链最大可达距离约多 `0.014`，纯旋转求解会保留有限残差并报告 `clamped`。这是已验证的物理边界，不是故障掩盖；后续 Root Motion/重心策略负责处理，当前不得宣称完整 Root Motion 已完成。
- 本阶段不包含正式四足/机甲 Profile、高细节拓扑、完整 Root Motion、动作特效或跨浏览器 GPU/WebGL 最终验收。自动验证覆盖类型检查、全量测试、Playground 构建、文档门禁、AI 交接门禁和 diff 检查。主代理已在 Chromium 本地开发环境完成 1440×900 与 760×900 功能验收：五个基础动作、播放控制、动作切换清锚、时间回拖、简单/复杂切换和窄屏重排正常，无横向溢出；reload 后控制台无 error 或 hydration mismatch，未见明显足滑、关节突变、落地穿插或骨盆突跳。该证据不替代跨浏览器 GPU/WebGL 与最终像素验收。
- AI 交接结构态与模拟 Pull Request 历史态门禁现均通过。5 个已推送的本阶段修复提交使用一次性迁移例外：门禁和 `.ai/project-state.json` 同时锁定每个完整 SHA、实际缺失的 `project-state`/`handoff-context` 类型、原因和补齐收口提交 `813281b424e23edd8cb4ec9cff1e16cf9b74a2ce`。例外只有在收口提交属于当前 PR 历史且确实同时更新机器状态和交接上下文时生效；未知 SHA、声明外缺失类型和未来提交继续失败，不改写共享历史。

## 37. 双足萌宠混合 Root Motion 与运动特效设计

- 已确认采用混合 Root Motion：动作资产提供按角色身高归一化的移动意图、转向、弹道策略和可变形时间窗；框架无关运行时按真实体型、接触阶段和足底残差求出安全的实际位移。旧动作缺少扩展字段时保持原地播放，不从现有根节点关键帧猜测世界位移。
- 复杂模型单帧顺序固定为 Quaternion FK、Root Motion、骨盆与重心补偿、足底锁定/混合 IK、确定性 VFX；Root Motion 只拥有角色运行时容器的整体位移和转向，IK 继续只拥有骨骼 Quaternion 与双支撑骨盆 Y，不平移或拉长腿骨。
- 第一批覆盖行走循环、冲刺急停和起跳落地，并自动生成落地冲击环、落地尘点、速度拖尾和急停摩擦粒子。特效由动作标签与实际速度、减速度、落地冲量共同授权，使用有界对象池，不建设通用粒子编辑器。
- 暂停保持累计状态，停止、普通回拖、异常时间跳跃、Clip 切换、runtime 重建和释放会清除旧速度、周期身份、足底锚与瞬时特效。单项失败只关闭对应 Root Motion 或 VFX，保持 FK/IK 安全路径。
- 权威设计文档为 `docs/zh-CN/双足萌宠混合RootMotion与运动特效设计.md`。当前只把设计标记完成；`bipedPetRootMotionComplete`、`bipedPetMotionVfxComplete`、正式四足/机甲 Profile、高细节拓扑和跨浏览器 GPU 验收仍保持 `false`。
- 可执行计划为 `docs/zh-CN/双足萌宠混合RootMotion与运动特效实施计划.md`，共八个 TDD 批次；每个修改 `apps/` 或 `packages/` 的提交都必须同步 AI 状态与交接上下文并立即推送。当前已完成第一批版本兼容契约与编译传播；Root Motion 数值采样、运行时消费和 VFX 生产实现仍未开始。

## 38. 双足萌宠 Root Motion 契约与编译传播批次

- `@yk-pets/pet-core` 新增版本化 Root Motion 定义，覆盖原地/移动模式、地面/弹道垂直策略、按角色身高归一化的距离与跳高、转向弧度、移动/变形/弹道/制动窗口，以及四种受支持的运动特效标签。旧动作缺少扩展时固定编译为 `in-place`，不会从现有根节点轨道猜测世界位移。
- `normalizeBipedPetRootMotion` 防御未知对象、畸形数组和 Proxy 访问异常，不突变输入且不共享窗口数组或窗口对象。只有 `undefined` 表示兼容旧资产的“缺失”；显式 `null`、无效命名空间或无效 Root Motion 都会产生稳定中文 `warning`。距离、转向和跳高分别限制在 `[-4, 4]`、`[-2π, 2π]` 和 `[0, 1.5]`；窗口限制在动作时长内，拒绝非正/非有限权重与无效区间，并按时间和 Unicode code-point 身份稳定排序；特效标签只保留受支持枚举、去重并稳定排序。
- 动作资产最外层 `extensions` 的 getter、`ownKeys`、属性描述符与属性读取现在都在各自 `Reflect` 边界局部防御，包括已撤销 Proxy；读取失败会保留稳定诊断并降级为空扩展，不使用包围整个编译过程的宽泛 `catch`，因此不会误吞内部编程错误。命名空间内的 `rootMotion`、`contacts`、`events` getter 或数组/条目访问异常沿用同一局部降级原则。
- 资源预算固定为 Root Motion 窗口 64 项、VFX 标签输入 16 项、接触候选 64 项和语义事件 64 项；超限集合只追加一条聚合 warning，并且只读取预算内条目。VFX 的 16 项输入预算允许无效值与重复值经过清洗，同时最终输出仍受四种支持枚举约束；其余 64 项预算与现有时间轴结构规模一致，保证 10,000 长度恶意数组仍为有界工作量和有界诊断。
- Quaternion Clip 携带递归冻结的规范化 `rootMotion`，窗口、窗口数组和 VFX 标签数组均不可变；采样在当前 Clip 上复用同一不可变引用，不做逐帧深拷贝。历史 V1 Clip 缺少或携带畸形 `rootMotion` 时会通过 `WeakMap` 一次性迁移到冻结的安全原地定义，不提升 schema；blocked Clip 无条件使用零距离、零转向、grounded、空窗口和空标签的标准原地定义，不能残留输入弹道或特效语义。
- Root Motion 的完整语义参与 Clip 哈希；表驱动测试锁定既有 ASCII 基线，并覆盖模式、距离、转向、垂直策略、跳高、窗口 ID/类型/起止/权重与 VFX 标签的逐字段变化。补充平面窗口 ID 按完整 Unicode code point 消费，ASCII 路径保持兼容；无效 Profile 仍在 Root Motion 规范化之后阻塞，因此同时保留 Profile error 与清洗 warning。
- 自动验证已通过 `corepack pnpm --filter @yk-pets/pet-core test`（136 项）、`corepack pnpm --filter @yk-pets/pet-core typecheck`、10,000 长度资源预算探针、`node scripts/check-ai-handoff.mjs`、`node scripts/check-documentation.mjs` 和 `git diff --check`。
- 本批只完成契约、清洗、编译和采样结果传播，不计算单帧或累计世界位移，不修改 Three 运行时容器，也不生成 VFX。下一批应实现框架无关的 Root Motion 数值采样器；`bipedPetRootMotionComplete` 与 `bipedPetMotionVfxComplete` 继续保持 `false`。
