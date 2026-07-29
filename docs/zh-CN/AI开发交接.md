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
- 第一批覆盖行走循环、冲刺急停和起跳落地，并自动生成落地冲击环、落地尘点、速度拖尾和急停摩擦粒子。特效由动作标签、实际 applied 水平速度、authored 制动窗口和落地冲量共同授权，使用有界对象池，不建设通用粒子编辑器。
- 暂停保持累计状态，停止、普通回拖、异常时间跳跃、Clip 切换、runtime 重建和释放会清除旧速度、周期身份、足底锚与瞬时特效。单项失败只关闭对应 Root Motion 或 VFX，保持 FK/IK 安全路径。
- 权威设计文档为 `docs/zh-CN/双足萌宠混合RootMotion与运动特效设计.md`。当前只把设计标记完成；`bipedPetRootMotionComplete`、`bipedPetMotionVfxComplete`、正式四足/机甲 Profile、高细节拓扑和跨浏览器 GPU 验收仍保持 `false`。
- 可执行计划为 `docs/zh-CN/双足萌宠混合RootMotion与运动特效实施计划.md`，共八个 TDD 批次；每个修改 `apps/` 或 `packages/` 的提交都必须同步 AI 状态与交接上下文并立即推送。契约批次、第 39 节纯数值 Root Motion 求解及第 40 节确定性 VFX 信号已完成；Three 运行时消费和 VFX 对象池仍未开始。

## 38. 双足萌宠 Root Motion 契约与编译传播批次

- `@yk-pets/pet-core` 新增版本化 Root Motion 定义，覆盖原地/移动模式、地面/弹道垂直策略、按角色身高归一化的距离与跳高、转向弧度、移动/变形/弹道/制动窗口，以及四种受支持的运动特效标签。旧动作缺少扩展时固定编译为 `in-place`，不会从现有根节点轨道猜测世界位移。
- `normalizeBipedPetRootMotion` 防御未知对象、畸形数组和 Proxy 访问异常，不突变输入且不共享窗口数组或窗口对象。只有 `undefined` 表示兼容旧资产的“缺失”；显式 `null`、无效命名空间或无效 Root Motion 都会产生稳定中文 `warning`。距离、转向和跳高分别限制在 `[-4, 4]`、`[-2π, 2π]` 和 `[0, 1.5]`；窗口限制在动作时长内，拒绝非正/非有限权重与无效区间，并按时间和 Unicode code-point 身份稳定排序；特效标签只保留受支持枚举、去重并稳定排序。
- 动作资产最外层 `extensions` 的 getter、`ownKeys`、属性描述符与属性读取现在都在各自 `Reflect` 边界局部防御，包括已撤销 Proxy；读取失败会保留稳定诊断并降级为空扩展，不使用包围整个编译过程的宽泛 `catch`，因此不会误吞内部编程错误。命名空间内的 `rootMotion`、`contacts`、`events` getter 或数组/条目访问异常沿用同一局部降级原则。
- 动作扩展收集使用 null-prototype 自有属性字典，JSON 中的 `__proto__`、`constructor`、`prototype` 与普通第三方键一样可安全保留并序列化，不会改写原型。正式 `yk-pets/biped-motion/v1` 命名空间仅在 `Object.hasOwn` 成功后通过 `Reflect.get` 读取，has/get 的 Proxy 或撤销异常仍局部降级；继承属性不能伪装正式命名空间，因此规范化前后及 JSON 往返后的编译结果保持一致。
- 资源预算固定为 Root Motion 窗口 64 项、VFX 标签输入 16 项、接触候选 64 项和语义事件 64 项；超限集合只追加一条聚合 warning，并且只读取预算内条目。VFX 的 16 项输入预算允许无效值与重复值经过清洗，同时最终输出仍受四种支持枚举约束；其余 64 项预算与现有时间轴结构规模一致，保证 10,000 长度恶意数组仍为有界工作量和有界诊断。
- Quaternion Clip 携带递归冻结的规范化 `rootMotion`，TypeScript 的定义及窗口字段也全部声明为只读；采样在当前 Clip 上复用同一不可变引用，不做逐帧深拷贝。历史 V1 Clip 缺少或携带畸形 `rootMotion` 时会通过 `WeakMap` 一次性迁移且不提升 schema；缓存身份同时记录 `status`、源 `rootMotion` 引用与规范化时的 `durationMs`，时长以 `Object.is` 比较。所有编译、迁移及 canonical in-place 冻结结果还会在独立 `WeakMap` 中绑定其规范化时长，只有对象与时长同时匹配才能走 canonical 快捷路径；当前 Clip 改时长或跨 Clip 复用不同时长的冻结定义都会重新规范化且不突变原对象。blocked 判断先于任何 ready 缓存读取，因此同一可变历史 Clip 在 `ready→blocked`、`blocked→ready`、替换源定义或修改时长后都不会串用旧结果；有效新时长会重新钳制窗口并冻结新定义，非有限或非正时长稳定回退 canonical 原地定义。blocked Clip 无条件使用零距离、零转向、grounded、空窗口和空标签的标准原地定义，不能残留输入弹道或特效语义。
- 通用扩展字段读取现在使用模块内只读 warning 契约描述 `rootMotion`、`contacts` 与 `events` 的访问失败，不再借用 Root Motion 专属规范化诊断类型；Root Motion 返回类型由规范化函数直接推导，减少跨模块类型耦合。
- Root Motion 的完整语义参与 Clip 哈希；表驱动测试锁定既有 ASCII 基线，并覆盖模式、距离、转向、垂直策略、跳高、窗口 ID/类型/起止/权重与 VFX 标签的逐字段变化。补充平面窗口 ID 按完整 Unicode code point 消费，ASCII 路径保持兼容；无效 Profile 仍在 Root Motion 规范化之后阻塞，因此同时保留 Profile error 与清洗 warning。
- 自动验证已通过 `corepack pnpm --filter @yk-pets/pet-core test`（143 项）、`corepack pnpm --filter @yk-pets/pet-core typecheck`、10,000 长度资源预算探针、编译 Clip 改时长与跨 Clip 复用的两个独立时长探针、`__proto__` JSON 往返探针、`node scripts/check-ai-handoff.mjs`、`node scripts/check-documentation.mjs` 和 `git diff --check`。
- 本批只完成契约、清洗、编译和采样结果传播，不计算单帧或累计世界位移，不修改 Three 运行时容器，也不生成 VFX；框架无关的 Root Motion 数值采样器已在第 39 节后续批次完成。`bipedPetRootMotionComplete` 与 `bipedPetMotionVfxComplete` 继续保持 `false`。

## 39. 双足萌宠确定性 Root Motion 数值采样批次

- `@yk-pets/pet-core` 的 `sampleBipedPetRootMotion` 明确区分 target 与 applied：`cumulativeLocal/World`、`cumulativeTurnRadians` 仍由规范化定义、角色高度、动作权重及绝对动作时间直接求值，是帧率无关的期望目标；调用方通过 `previousAppliedWorld/previousAppliedTurnRadians` 提供上一帧已写入状态，并逐帧原样回传采样器签发的只读 `previousLandingAuthorization`，不再维护可与世界状态分叉的局部历史。授权只冻结 touchdown 绝对请求时间与无量纲强度，不含可变引用。求解器在世界空间追赶 `cumulativeWorld`，再以当前朝向的逆旋转派生 `appliedLocal/deltaLocal`，所以朝向变化不会旋转或重解释已经应用的世界位置。
- 水平移动只消费 `travel` 与 `warp` 窗口，并把每个窗口的 `smoothstep(t)=t²(3-2t)` 完成量按权重归一化；`ballistic` 仅贡献垂直弹道，`brake` 仅提供调制实际水平速度的制动意图包络。`loop` 通过 `iteration + progress` 保持完整周期累计与接缝连续，`once` 停在终点，`ping-pong` 明确沿同一路径往返。时间映射统一复用 `resolveMotionTime`，没有复制三种循环算法。
- 弹道高度继续使用 `4 × jumpHeight × characterHeight × p × (1-p)`，阶段仍由实际 applied 世界高度与本帧实际纵向增量判断。内部 `biped-pet-root-motion-timeline.ts` 现为唯一事件权威：请求端点不再进入结构边界，窗口 end/start 也不再枚举候选；每次连续采样在同一个 `512` work-unit 预算内，按 `max(1e-12, 1e-12 / (jumpHeight × actionWeight))` 阈值直接输出 proven airborne 组件与正反向 canonical takeoff/touchdown 转换，复杂度为 `O(W log W + 512W)`。混合上升/下降贡献的 overlap 同时使用复合高度与导数上下界保留有序证明叶，airborne midpoint 不再吞掉居中或偏心 grounded valley。转换时间取复合曲线真正进入 airborne/grounded 的可表示阈值交点，可以早于窗口 end。组件强度取该阈值组件内 action-aware 复合归一化高度的真实峰值，再乘纵向动作意图并限制到 `[0,1]`：单窗、共同峰心和全部同向区间走解析快路；其余 active-set 结构区间把六次弹道多项式的固定 Bernstein 控制点通过 de Casteljau 限制到局部进度段，再按全局动作权重归一化。一个组件的全部待证区间共享真实 sample 最大值和稳定优先队列，控制多边形凸包上界相同时按 start/end/序号打破平局；只有当前上界仍可能超过真值 `max(1, |best|)×1e-13` 的节点才继续细分。每次细分与新 sample 都共享结构证明的同一预算，耗尽时整个分析保持 unknown；控制上界只用于证明，绝不直接成为强度。因此低于信号阈值的窗口即使把自身中点放在真实峰心，也只能按其真实复合贡献微扰结果，不能借 proof witness 改变 `.25/.4/.45` 特效阈值侧别。窗口边界只提示初始切分：两侧 proven airborne 且窗口精确首尾相接时合并零宽接地点；任何正宽 proven grounded gap（含 `.001ms` 和一个 ULP）都会拆分；低于阈值的相邻/重叠尾窗不会改变主组件和转换。`unknown`、预算耗尽或超大不可表示 iteration 不输出转换，不签发新授权也不清除旧授权。once/loop/ping-pong、周期缝和转折点先在 canonical 局部 `(start,end]` 内筛选转换，再映射到最多四段绝对请求时间；绝对 timestamp 舍入为同一个 double 时，以 canonical 序号保留 touchdown/takeoff 顺序。转换 mapper 与区间 evidence 分类共用 iteration 锚、可表示段宽和 modulo 一致性检查，不可表示的超大 iteration 统一返回 incomplete/unknown。授权跨后续 `actionWeight` 淡出与不合格微尾窗保持，applied 高度随后真实越地时只消费一次；后续 canonical takeoff 清除 stale 授权。暂停保留授权但不触发，倒退、reset、同时间重复、大跳和未授权 applied 越地均不触发。
- 局部前进轴固定为 `+X`；世界变换遵循 Three.js 右手坐标的正 Y 旋转，因此 `facingRadians=+π/2` 会把局部 `+X` 映射为世界 `-Z`。`actionWeight` 钳制到 `[0,1]`，角色高度要求正有限值；畸形定义、非有限时间/朝向/权重和非法足底残差返回全有限 `blocked` 结果。
- 连续身份阈值与足锁策略统一为 `max(250ms, duration×0.5)`，100/200ms 动作在 24/30/60FPS 不会永久 reset；阈值内最多跨四个 canonical 周期，touchdown 枚举工作量因此有硬上限。首次采样、缺少 previousApplied、普通倒退/回拖或超过阈值的大跳返回 `reset`：applied 初始化为当前 target，落地授权、delta、速度、角速度和瞬时强度清零。调用方必须在 Clip/loop 身份切换、停止、runtime 重建或 dispose 时同时清除 previousApplied 与 `previousLandingAuthorization`，暂停则保留二者。
- 单帧世界位移长度限制为角色高度的 `0.25`，单帧转向限制为 `π/4`；target 追赶误差和由当前朝向转换到世界空间的 `footResidual` 合成后只进行一次世界向量钳制。`footResidual` 只在本帧整个 canonical 映射区间被合并后的 `travel/warp` 支撑覆盖时消费；窗口端点按闭区间包含，零宽 loop seam 或 ping-pong 折返点不中断整周期支撑，once 钳制平台退化为单点时则必须由支撑分量实际包含该点。跨入、跨出或穿过正宽 gap 仍禁用本帧反馈，loop/ping-pong 扫描若没有验证任何可表示的非空 canonical 段也保守禁用。超过任一预算返回 `clamped`，只限制 applied，不污染 cumulative target。`deltaWorld` 使用 JavaScript 实际可表示的 `appliedWorld - previousAppliedWorld` 重新计算，`deltaLocal` 再由当前朝向逆变换；实际加法在 `Number.MAX_VALUE` 附近未改变位置时，delta 与速度稳定为零。转向增量与角速度采用同样的实际 applied 差值原则。原地、窗口空隙、仅弹道、暂停、reset 与 `actionWeight→0` 不漂移；纯函数不保存低通历史，滤波所有权留给任务 5 控制器。
- `normalizeBipedPetRootMotion`、编译缓存、`resolveMotionTime` 与数值采样统一复用 `normalizeMotionDurationMs`：`1200.4→1200`、小于 100→100、大于 60000→60000，非有限值→1200。规范化结果递归冻结并在 `WeakMap` 绑定 canonical duration；高频运行时必须在资产编译阶段规范化一次并复用 canonical 定义。公开 raw/unknown 路径每次都防御读取、复制、清洗并冻结，明确保留其边界安全成本，不以可变对象身份缓存吞掉后续修改。
- `motionIntensity` 只由实际 applied 世界 X/Z 水平线速度按 `hypot(x,z)/(characterHeight×0.4)` 归一化，参考速度常量为 `0.4` 个角色身高/秒；纵向弹道与原地角速度不参与。`brakeIntensity` 是 authored brake 窗包络与该水平强度的乘积，不再额外重复乘动作权重，也不把时间窗伪装成减速度；零水平位移固定为零。未来若需要物理加速度，必须由调用方显式提供连续前帧速度与 reset 边界，不能在纯函数中引入隐藏历史。时间线仍以 action-aware 复合峰高作为帧率无关的结构强度；求解器签发授权时根据自由落体的归一化关系使用 `landingImpulse=sqrt(normalizedCompositePeakHeight)` 派生冲击速度启发式。因此该信号不依赖窗口时长、帧细分或标签，也不声称是场景物理碰撞速度。
- `pet-core` 自动测试在任务 2 时为 207 项，信号模块完成时增至 219 项，本次落地冲量语义校准后为 220 项；新增时间线直接组件/转换、低重叠与低相邻等价、真实阈值 touchdown、精确相邻合并、`.001/.1/1-ULP` 正 gap 拆分、居中与偏心 overlap 内部 grounded valley 拆分、微窗口峰心前/正中/后及多个微窗口的真峰稳定性、`.25/.4/.45` 强度阈值两侧、2/3/4/5/6 个常规错峰窗口的真峰/单 touchdown/帧细分一致性、Bernstein 局部限制与全局权重归一化、40 组固定种子错峰预算上界、resolver canonical 局部端点包含判定、exact seam 分段侧别与同 timestamp 顺序、不可表示 iteration 锚的保守回退、once/loop/ping-pong 双向锚点、huge iteration、帧细分不变性、峰高平方根冲击边界、纯转向/纯垂直零移动强度及真实水平制动回归。版本化命令 `corepack pnpm run test:studio-biped-root-motion-probe` 继续固定执行 10,000 组有状态输入、42 个正反向 ULP touchdown、canonical 64 弹道窗授权链、4 组峰心前/正中/后/多微窗真峰稳定性和 40 组 2–6 窗固定种子错峰预算统计，并保留 once/loop/ping-pong 共 6 个高低强度精确相邻帧细分案例。错峰固定种子集 `exhausted=0`，最大 `179/512` work unit，并由测试锁定不超过 `192`；64 窗场景的 63 个尾窗峰值最高约 `2.9999986e-12`，严格低于 `4e-12` 世界接地阈值，共享分析仍只含 `129` 个结构边界、`64` 个支撑分量和 `502/512` work unit，`exhausted=false`。固定种子分类仍为 `1707 solved / 8272 clamped / 10 reset / 11 blocked`，另命中 `1169` 次 loop 接缝、`344` 次 applied landing 与 `3722` 次真实水平 brake；42 个 ULP 探针全部通过。每类 100,000 次 1/64 窗 raw/canonical reset 对照仍只观测防御规范化成本；每类 2,000 帧 canonical 连续弹道热路径均观察到 `200` 个授权帧和 `100` 次真实消费。所有耗时只作本机观测，不设置跨机器脆弱阈值。
- 本批之后第 40 节已完成任务 3 的确定性 VFX 信号派生；Three 运行时容器仍未消费这些累计/增量结果，VFX 对象池也尚未实现。`.ai/project-state.json` 的完成项包含 `biped-pet-root-motion-solver`、`biped-pet-root-motion-shared-ballistic-timeline`、`biped-pet-root-motion-action-aware-boundaries`、`biped-pet-root-motion-canonical-ballistic-transitions` 与 `biped-pet-motion-vfx-signals`；`bipedPetRootMotionComplete`、`bipedPetMotionVfxComplete` 与跨浏览器 GPU 验收继续保持 `false`。

## 40. 双足萌宠确定性运动特效信号批次

- `@yk-pets/pet-core` 新增框架无关的 `deriveBipedPetMotionVfxSignals`。它只组合同一请求时间的已求解 Root Motion `motionIntensity`、`landingImpulse`、`brakeIntensity` 与动作显式 `vfxTags`，不会从渲染状态、墙钟时间或隐藏历史猜测特效。内层样本 `requestedTimeMs` 必须严格等于外层 `requestedTimeMs`；旧 touchdown 样本不能配合后续外层时间生成新 burst ID。没有授权标签、状态为 `reset/blocked`、时间身份错配、请求时间倒退或同一时间重复采样时固定返回独立冻结的空数组。
- 四种首批信号使用严格“大于”阈值：`landing-ring=.25`、`landing-dust=.4`、`speed-trail=.55`、`brake-sparks=.45`；等于阈值时不触发。前两者在 `sqrt(peakHeight)` 映射下对应 `.0625/.16` 峰高边界，这使 `.28` 内置跳跃产生约 `.529` 的冲量并授权两种落地特效，而不高于 `.16` 的弱落地仍不授权尘效。`landingImpulse>0` 是实际 touchdown 的一次性权威；当前求解器在穿入接地阈值的同一帧先把 phase 归类为 `grounded`，所以落地环和尘点接受 `grounded|landing` 并拒绝 `takeoff|airborne`。速度拖尾只读取实际 applied 水平速度；急停火花还要求 `grounded`，并由 authored brake 包络调制同一水平速度。纯转向、纯垂直弹道和零位移制动窗均不触发。落地环、尘点与急停火花是 `burst`，ID 为 ``${clipHash}:${kind}:${Math.round(requestedTimeMs)}``；速度拖尾是 `sustain`，ID 为 ``${clipHash}:${kind}:active``。信号按完整 Unicode code point 排序，重复标签只输出一次。
- 公共入口防御负数/非有限或内外不一致的请求时间、空白、全部 Unicode `Cc` 控制字符、双向格式控制、超 256 code-point 或非字符串 Clip 哈希，同时允许合法 ZWJ emoji。畸形数组、非法状态/相位、非有限强度和 Proxy getter 异常都不会抛出或突变输入。每次结果及其信号对象都独立冻结，不借对象身份保存运行时状态。当前寿命预算为落地环/尘点 `480ms`、速度拖尾 `160ms`、急停火花 `320ms`，全部低于后续 Three 对象池的 `1200ms` 硬上限。
- 本批按 TDD 先确认 9 项新测试因缺少公共 API 失败，再以独立 RED 锁定负时间、真实 ballistic touchdown、旧样本重放、非水平移动、C1 与双向格式控制边界；该批结束时 `pet-core` 为 219 项，落地冲量语义校准后当前全量为 220 项。覆盖标签授权、严格阈值两侧、burst 去重、sustain active 身份、同时间/倒退/reset/blocked、真实求解器 grounded touchdown、请求时间一致性、纯转向/纯垂直/真实水平制动、相位约束、非法 Clip 哈希、ZWJ Unicode 身份、非有限信号、畸形/Proxy 输入、不突变、深冻结与不共享输出。
- `.ai/project-state.json` 只新增 `bipedPetMotionVfxSignalsComplete=true` 与 `biped-pet-motion-vfx-signals` 完成项。Three 容器尚未消费 Root Motion，特效对象池和正式 renderer 生命周期尚未实现，因此 `bipedPetRootMotionComplete`、`bipedPetMotionVfxComplete`、正式四足/机甲 Profile、高细节拓扑与跨浏览器 GPU 验收继续保持 `false`。

## 41. 内置动作 Root Motion 与自然运动特效语义批次

- 五个基础动作都显式携带版本化 Root Motion。待机、招手和直拳保持安全 `in-place`；行走为 `travel`、按角色身高归一化距离 `.42`、全周期 travel 窗和 `speed-trail`；跳跃为零水平距离的 `travel+ballistic`、跳高 `.28`、归一化 `.3→.76` 弹道窗，并授权稳定排序后的 `landing-dust/landing-ring`。
- `speed` 只等比缩放基础动作的真实时长、关键帧、接触、事件和 Root Motion 窗口，不改变 `.42` 行走距离。每次创建都会生成独立扩展、Root Motion、窗口和标签数组；编译继续深拷贝冻结且不突变源扩展，同一资产重复编译保持确定哈希。
- `builtin-sprint-stop` 保持 `9200ms`、原 16 条轨道/222 个关键帧与道具依赖不变，新增距离 `2.4` 的 travel 语义。travel 窗为 `0→8300ms`，brake 窗为 `6300→8300ms`，两窗重叠使平滑减速期间仍存在真实 applied 水平速度；标签规范化为 `brake-sparks/speed-trail`。其余五个长动作继续按旧资产兼容为 `in-place`。
- 移动强度参考速度由过高的 `4` 修正为公开常量 `0.4` 个角色身高/秒，仍只消费实际 applied 水平速度。测试先证明旧实现的自然行走完全无法触发拖尾，再以全程 `actionWeight=1`、逐帧回传 applied/turn/authorization 的真实链路验收：20ms 行走探针产生 46 个拖尾帧；10ms 冲刺探针产生 582 个拖尾帧和 36 个急停火花帧，`7300ms` 明确命中火花；40ms 跳跃探针产生一次 `sqrt(.28)≈.529` 真实 applied touchdown，并在同一帧各命中一次落地环与尘效。测试禁止通过权重突变、人为欠量或标签特判制造追赶速度与冲量。
- 11 个内置动作的数量、ID、时长、轨道数、关键帧数和道具依赖均由精确快照锁定。Root Motion 可复现探针原有稳定分类仍为 `1707 solved / 8272 clamped / 10 reset / 11 blocked`、`1169` 次接缝、`344` 次落地、`3722` 个真实水平 brake 强度帧；42 个 ULP touchdown、64 窗 `502/512` 预算和 40 组错峰 `179/512` 峰值均不变。
- 本批只完成动作资产语义与框架无关强度标尺，不修改 Three renderer 或视觉案例。Three 容器消费、VFX 对象池、正式四足/机甲 Profile、高细节拓扑和跨浏览器 GPU 验收仍未完成，因此 `bipedPetRootMotionComplete`、`bipedPetMotionVfxComplete` 及对应后续边界继续保持 `false`。

## 42. Three Root Motion、重心与 IK 协同批次

- 新增独立 `ComplexBipedRootMotionController`。它在创建时快照角色容器绑定 position/Quaternion，只保存当前 Clip 的 `previousAppliedWorld`、`previousAppliedTurnRadians` 与采样器签发的只读 `previousLandingAuthorization`；每帧只把 `bindPosition + appliedWorld` 与“世界 Y 轴转向 × bindQuaternion”绝对写回容器，不累计 `delta*`、不写 `cumulative*`，含 pitch/roll 的绑定姿态也不会把整体转向误解为局部轴。角色身高只读取已经计算的 `geometry.boundingBox`；无有效高度时 Root Motion 独立 blocked，FK/IK 继续执行。热路径复用临时 Three 向量和四元数。
- 首帧、停止、回拖、Clip 切换、求解 reset、runtime 重建和 dispose 会清除旧 applied、欠量与落地授权。相同 Clip、请求时间和归一化权重的重复帧是完整显示姿态暂停：只调用 Root 保持时间令牌与授权，VFX 为空，FK/Balance/IK、IK 报告和待用 residual 均冻结；暂停帧声明 `consumedFootResidual=[0,0,0]`，恢复推进后才真实消费。粗帧跨越 canonical touchdown 与在边界细分帧都只消费一次同强度冲量；Three 层不重建授权、不吸附窗口端点、不改写 `sqrt(normalizedCompositePeakHeight)` 强度。动作控制器每帧返回当前 Root Motion、确定性 VFX 信号、深冻结 IK 数值报告，以及本帧消费/下一帧待用的有限局部水平 residual，Y 固定为零；`residualByLimb` 是每肢 `anchor-current` 的世界 X/Z `hypot` 标量 strain 启发式，不是方向向量。外层直接循环记录取最大值，使用 `×8` 增益、`characterHeight×0.025` 上限并沿局部移动反方向反馈；全部零早退复用冻结常量。Root 先以零 residual 预采样，只有有限 `solved/clamped + grounded` 才从同一 previous state 二采样，而且二采样也必须保持有限 grounded 才能提交；否则回退零反馈结果，防止共享 XYZ 位移预算把真实 touchdown、token、冲量和 VFX 延迟成 landing。原地、travel 空隙和非支撑阶段会清掉 residual 所有权而不漂移。
- 新增独立 `ComplexBipedBalanceController`，固定只拥有 pelvis X/Z 和自己叠加的 chest tilt；水平向量长度不超过 `characterHeight×0.025`，胸部倾斜不超过 `0.12rad`。它在热路径复用 Quaternion/Euler，并用单次循环读取有效接触，不再按帧 `clone/filter/new Euler`。standalone 连续调用能识别并移除自己的上一帧 tilt，同时不会反向修改外层刚写入的 FK；双支撑取中心、单支撑按实际运动强度偏向支撑侧，`takeoff/airborne/landing` 清除 Balance 补偿但保留当前动作 FK，reset 和 dispose 恢复自身绑定所有权。
- IK `apply()` 现在返回深冻结且不含 Bone 的 `supportingContacts/residualByLimb/clampedLimbs`，并接受完整链可选传入的只读 `rootMotionPhase` 上下文。有效支撑在捕获、骨盆补偿、求解和报告各处统一要求 `weight/confidence` 均为正有限数。实际 applied 相位为 `takeoff/airborne/landing` 时，相位优先于资产中可能滞后的非零 contact weight：IK 先恢复 pelvis 绑定 Y、释放旧锚并返回空支撑报告，只有真实 grounded touchdown 才重捕获；standalone 不传上下文时保持历史接触语义。直接创建 IK 控制器的历史行为不变：单支撑仍不写 pelvis Y、仍用三轮交替，`100→320ms` 的约 `0.014` 不可达残差继续报告 clamped。真实可达域扫描证明，在容器已经写入行走 Root Motion、腿段不可伸长且 balance X/Z 受 `0.025×height` 限制时，允许圆盘内的最佳世界残差仍约 `0.00825`，无法满足集成链 `<1e-3`。因此只有完整动作控制器显式开启尺寸化单支撑 pelvis Y 策略，预算为 `min(0.08, characterHeight×0.025)`；集成链在相同每骨骼累计角预算内使用五轮交替收敛，固定 `100→320ms` 探针的世界残差由 `0.000999317248683272` 降至约 `0.00031089757658926703`，门禁为 `≤0.00075`。pelvis Y 仍由 IK 独占，达到预算会在报告和诊断中明确 clamped，非支撑、无有效接触、weight 0、reset 与 dispose 恢复绑定 Y，不拉伸腿段或改写 foot/ankle 局部 position。
- 同一 runtime 通过 WeakMap token 只允许一个 Root Motion 写入者；owner 释放后可重建，已释放 runtime 拒绝创建。外层构造失败保留初始化错误，并对 IK、Balance、Root 全部尽力回滚；错误详情以安全字符串转换覆盖 `Symbol` message 与抛错 getter，诊断本身绝不阻断清理。Root dispose 在 finally 删除 token、封存自身，并用独立失败哨兵保证包括 `throw undefined` 在内的原值继续抛出；外层 dispose 即使子控制器或 runtime 状态检查失败，也按 IK→Balance→Root→状态检查→bind→matrix 全部尽力，状态未知时仍尝试 bind/matrix，清引用、封存后统一抛中文聚合错误，二次调用幂等。正常帧顺序固定为 `restoreBindPose → FK → Root Motion → Balance → updateMatrixWorld → IK`，重复暂停帧使用上述冻结路径。自动测试覆盖不同帧率同目标 applied、巨大 target 追债、完整姿态暂停、停止/回拖/Clip 切换、世界轴转向与非零绑定姿态、角色尺寸步幅、粗/细与临界 residual touchdown、双/单支撑、滞后 contact 的真实 takeoff/airborne/landing 释放与 grounded 重捕获、无效支撑、纯 Y residual 隔离、默认关闭/集成开启的尺寸化 pelvis Y、三轮/五轮且总角预算不变、`≤7.5e-4` 集成残差裕量、真实编译资产的长 loop/ping-pong 无 strain 振荡/过冲、单写入者及异常构造/释放生命周期、blocked Root Motion 下 FK/IK 继续、冻结报告/诊断、residual 跨帧及 gap 清理、脚局部 position/段长、重复释放和释放后拒绝写入。该批当时只完成 Three 控制器层；第 43 节现已补齐独立 VFX 对象池，但正式 renderer 仍未接入，所以 `bipedPetRootMotionComplete`、`bipedPetMotionVfxComplete` 与跨浏览器 GPU 验收继续为 `false`。

## 43. 同一场景的有界运动 VFX 对象池批次

- 新增 `createComplexBipedMotionVfxController`，返回普通 Three `Group`，供任务 7 作为复杂角色 primitive 的同级对象挂入现有场景；本批没有创建 Canvas、Skeleton、独立场景或动画循环，也未改正式 renderer。`apply()` 只接受外层动作采样的 `requestedTimeMs`、角色容器在共同父级中的最终位置和朝向，不读取 `Date.now()`，不注册 `requestAnimationFrame()`。burst 在触发帧捕获父级位置后保持不跟随，sustain 通过同一 ID 更新既有槽位和当前角色位置。
- 四类效果各自只创建一份固定 Geometry/Material。落地环、落地尘点、速度拖尾、急停火花的物理池容量分别为 `8/24/8/24`，总数恰为 `64`；尘点和火花使用真实 `InstancedMesh`。单个 burst 最多创建 `16` 个粒子，速度拖尾最多 `8` 个活动实例，信号寿命最多 `1200ms`。64 个 slot 状态对象在构造期预分配并复用；同到期实例用单调激活序公平轮转，不会反复覆盖 slot 0。burst 近期账本是固定 `256` 项环形队列而非 `shift()` 数组，账本淘汰前另扫描最多 64 个活动 slot，保证仍存活的 burst ID 不会重放。
- 输入边界拒绝非有限/非正强度、非有限时间与位置、错误 kind/mode、空或过长 ID，以及非正寿命；超长寿命安全钳制，不可表示的结束时间直接忽略。frame 的时间、朝向和三维位置均只安全读取一次并复制到普通值，Proxy 不能在校验后注入 `NaN`。重复 burst ID 不重复分配，重复 sustain ID 只更新；过期、动作回拖和 `reset()` 清空活动状态，显式 reset 同时清理去重账本但保留全部池与 GPU 资源。视觉朝向沿 Root Motion 局部 `+Z`：世界前向固定为 `(sin(yaw), 0, cos(yaw))`，yaw `0/π÷2` 分别对应 `+Z/+X`。
- 每个效果类独立创建；默认资源回调惰性缓存，每个 kind/资源类即使被调用多次也只产生一个 provisional，回调随后抛错仍可回收。某一类失败只把该类标为不可用；若它返回的是前一成功池正在使用的共享资源，则不能提前释放。成功池用对象身份集合统一拥有 Geometry/Material，最终每个共享 GPU 对象只释放一次。控制器同时记录所有已创建子节点；即使 `attachObject` 把对象挂到外部父级，dispose 也逐一解绑，不留下封存后无法回收的对象。
- `dispose()` 在入口先用 `disposing` 封存同步重入，因此 Geometry/Material 派发 `dispose` 事件时，监听器再次调用 `dispose/apply/reset` 只会早退或被拒绝，不会重复释放或写入正在清理的资源。活动槽清理、唯一 Geometry/Material、每个自有子节点、控制器父级和子节点清理全部纳入独立尽力步骤；任一步抛出 `undefined`、直接 `Symbol`、Symbol message 或 message getter 异常都安全转为中文聚合上下文，不阻断后续释放。最后总是清引用并封存，后续调用幂等且不会再次释放 GPU 资源。
- TDD 先确认定向 Root Motion 运行时测试因缺少 `complex-biped-motion-vfx.ts` 得到 `ERR_MODULE_NOT_FOUND`，随后覆盖真实 Group/InstancedMesh、重复 ID、sustain 跟随更新、burst 位置捕获、过期与回拖、200 次尘效压力、64/16/8/1200 硬预算、单类与中途挂载失败、非有限/Proxy 输入、无墙钟/RAF、reset 保池、唯一资源释放与任意父级解绑。质量审查复现并修复了 `+X/+Z` 90° 偏转、同到期 slot 0 重复覆盖、活动 ID 被近期账本挤出后重放、frame TOCTOU `NaN`、共享资源四次释放、外部父级残留 18 个对象，以及同步 dispose 事件重入导致资源释放两次；对应 RED 证据已写入 machine state，并补充真实过期 ID、资源回调 provisional、共享资源后续 kind 失败、任意抛出值与真实 dispose 事件回归。`.ai/project-state.json` 标记 `bipedPetMotionVfxPoolComplete=true` 与 `biped-pet-motion-vfx-pool` 完成；正式 renderer 挂载、完整 Root Motion/VFX 交付和跨浏览器 GPU 验收仍未完成，所以 `bipedPetRootMotionComplete`、`bipedPetMotionVfxComplete` 保持 `false`。

## 44. Root Motion/VFX renderer 与新手设置批次

- `ComplexBipedPetRenderer` 现在为每个角色 runtime 只创建一个 `ComplexBipedMotionController` 和一个 `ComplexBipedMotionVfxController`。VFX `Group` 与角色对象作为同一现有 `TresCanvas` 中的 sibling primitive；renderer 在动作控制器应用后，直接复制 `runtime.object.position` 的共同父级局部坐标，并把复用的局部 `+Z` 向量通过最终 Quaternion 旋转，以 `atan2(x,z)` 得到朝向。没有调用 `getWorldPosition`，也没有新增 Canvas、RAF、Skeleton 或逐帧坐标对象分配。
- Store 新增单调 `playbackRequestedTimeMs`，只供复杂动作运行时使用；编辑器、道具事件和时间轴继续使用解析后的 `playheadTimeMs`。loop/ping-pong 的接缝与反向半程不再触发 rewind；暂停冻结 requested 并从原值继续，只有打开/替换、用户回拖和停止重新对齐。Clip 切换、无动作、blocked、停止权重和真实回拖均显式 reset 动作与 VFX。动作/时间 watcher 经统一防重入同步边界调用控制器，每个 operation 显式返回完成状态；无 clip/runtime 的空路径不能清旧诊断，只有同 failure domain 与动作身份的真实成功或成功重编译才恢复 ready。旧 clip 在可失败 reset/compile 前解除；异常先尽力 reset，reset 失败则清浅引用与 runtime key、逆序 dispose，使同配方下次同步可重建，统一发出有界中文 blocked 诊断，不再抛入 Vue 更新链。runtime 替换、卸载和创建中途失败仍按 VFX→动作控制器→角色 runtime 尽力释放。`CloudFoxStudioCanvas` 继续使用复杂 `v-if` 与 `ProceduralPet v-else`，简单模式不会创建复杂控制器。
- 新增 `StudioRootMotionSettings` 并接入动作属性“基础”页。界面只显示原地/实际移动、自动特效、预计距离/转向/跳高与恢复推荐值；复杂模式说明系统会结合体型、脚步接触和速度自动修正，简单模式说明元数据仍会保存。移动按钮使用 `aria-pressed`，特效按钮使用 `role=switch/aria-checked`，明确焦点样式。面板保留自身 inline-size 容器在 `360px` 下切换单列，并在动作工作区 `780px` 窄视口下强制移动方式与预计结果单列；这是因为移动端属性面板会扩为接近全宽，仅依赖容器阈值无法覆盖真实 760×900 布局。正文/控制为 `11–12px`，辅助信息不低于 `10px`。
- Store 新增 `updateRootMotionSettings` 与 `restoreRootMotionRecommendations`。单次操作只替换当前草稿版本化命名空间中的 `rootMotion`，保留 contacts、events、`sourceMotionId`、命名空间未知字段和其他扩展，并只加入一个撤销项。模式切换与 autoVfx 状态互不覆盖；关闭只清 `vfxTags`。恢复值优先使用打开时 baseline 已保存定义，并按 `当前时长/baseline 时长` 等比缩放窗口；baseline 没有 Root Motion 时只信显式 `sourceMotionId`，模板窗口也按当前时长缩放，不再按中英文名称猜测；无可用 travel 推荐时使用 `.42` 身高的整段安全移动。`copyBuiltInMotion` 会在版本命名空间写入 provenance。
- 静态门禁现用 Vue SFC parser 的模板元素/指令 AST 与 TypeScript `CallExpression/PropertyAccess` AST 检查真实结构；注释、字符串中的 VFX apply 或伪造 primitive 都不能通过。TDD 第一轮报告缺少生命周期/Store API；后续 RED 依次锁定模式切换错误恢复 `speed-trail`、半时长跳跃未缩放、renderer 缺少显式 rewind、请求 `2500ms` 时只有 resolved `100ms`、watcher 缺少安全边界、双语同名自定义动作被错误恢复为内置 travel、注释/字符串伪实现仍能过门禁、最小 `7px` 字号、空 frame sync 错误清除失败诊断、真实内置 jump 副本从 `2400→1200ms` 后恢复为未缩放 `[720,1824]`，以及 760px 视口下 `708px` 设置容器未命中 `360px` 单列条件。最后一项门禁先以缺少可在 760px 生效的 viewport 规则失败，再由与工作区一致的 `780px` 媒体查询修复；真实浏览器复测仍属于任务 8。任务 7 收口时尚未执行任务 8 的阶段交付门禁，所以当时两个完整状态仍为 `false`；后续状态以第 45 节和机器状态为准。

## 45. Root Motion 与运动特效阶段交付

- 前七个任务已经形成完整站内链路：版本化动作扩展声明意图，框架无关采样器按身高、接触和时间窗求解实际位移，Three 动作控制器绝对写入角色容器并按 `restore-bind-pose → fk → root-motion → balance → update-matrix-world → ik` 执行，renderer 再把同一请求时间的确定性信号送入同场景 VFX 池。Root Motion 只拥有角色容器整体 position/Quaternion；FK、Balance 和 IK 各自保持既定局部所有权，不允许第二写入者累计同一世界变换。
- 当前实际移动只对显式动作开放：行走 `.42` 个身高、冲刺急停 `2.4` 个身高且制动窗为 `6300→8300ms`、起跳落地为 `.28` 个身高的弹道；待机、招手、直拳和其余旧资产保持 `in-place`。复杂 runtime 使用单调 `playbackRequestedTimeMs`，时间轴与道具事件继续使用解析播放头，循环接缝和 ping-pong 反向不再被误判为回拖。
- 当前 VFX 只包含 `landing-ring`、`landing-dust`、`speed-trail`、`brake-sparks`。固定池容量为 `8/24/8/24`，总槽位 `64`；单次 burst `≤16`、拖尾 `≤8`、寿命 `≤1200ms`，尘点与火花使用 `InstancedMesh`。控制器不读取墙钟、不注册 RAF，回拖/reset/dispose 会清活动实例但不在热路径重建 GPU 资源。
- `.ai/project-state.json` 现把 Root Motion、运动 VFX、两条正式 runtime 接线和阶段交付五个标记设为 `true`，并把下一阶段更新为 `biped-pet-advanced-choreography-warping-and-cross-browser-acceptance`。正式四足/机甲 Profile、高细节拓扑和跨浏览器 GPU 人工验收仍为 `false`；这些边界不得因为双足低细节 runtime 的自动测试而被提前关闭。
- `.ai/visual-cases.json` 新增 `biped-pet-root-motion-motion-vfx` 并已记录 Chromium 双视口实测。1440×900 下复杂模型 ready、canvas=1、overflow=0；行走跨两个周期，暂停冻结、停止归零、回拖无崩溃；冲刺可见连续位移与制动姿态，运行时探针确认 `speed-trail/brake-sparks` 共 304 个信号，但截图粒子较细微，不记为肉眼明确确认；跳跃可见腾空与落地；简单/复杂互斥，console error 和 hydration mismatch 均为 0。760×900 修复后设置面板宽 708px，移动方式/摘要实际为 674px/684px 单列，overflow=0、canvas=1，跳跃播放控制与模型切换正常，console/hydration 为 0；桌面同步复测无回归。`latestCompletedBatch.browserCoverage` 因此精确记录两个 Chromium 视口；Safari/Firefox、不同 GPU/WebGL、高细节拓扑和最终像素继续显式 `pending`。
- 阶段自动交付门禁固定为根目录 `typecheck`、`test`、Playground 生产构建、文档门禁、AI 交接门禁、`git diff --check`，以及基于 `agent/yk-pets-rebrand-v0610` 与当前 HEAD 的模拟 Pull Request 历史门禁。真实结果必须来自本次 fresh 命令输出；结构态 AI 检查不能冒充 PR 历史检查，浏览器 pending 也不能被自动结果替代。
- 模拟历史门禁在收口时复现出 4 个早期 Root Motion 数值修复提交只更新交接、漏更 `.ai/project-state.json`。本次没有使用通配放行：门禁和机器状态逐项锁定 `ad6ffeb7a5797cfb4df70b7b53e6b21b17d1c77e`、`b1975536849713b131220b3530521cf8b0f423ef`、`2ef7f4055667cd13635343e13570039abeba35d8`、`b9b75560cc592417ce58af38efbe0b43f0c793cb`，缺失类型只能是 `project-state`，且只有同时更新机器状态与双语交接的已推送收口 `a52c2381da4b0ec8b474dcfb32d5eb32b1d16f89` 位于当前历史时才生效。事件 base 也必须精确等于 `agent/yk-pets-rebrand-v0610`。
- 2026-07-29 在窄屏修复和双视口复验之后重新 fresh 执行完整自动验证：根 `typecheck`、根 `test`、Playground build、文档、结构态 AI、diff 和上述真实 PR 事件门禁全部 exit 0；`pet-core` 220/220、Local Agent 2/2。构建保留既有 Nuxt sourcemap、VueUse `PURE` 注释位置和超过 500 kB chunk 警告，没有把警告隐瞒为“纯净输出”，也没有把它们误报成失败。

## 46. 高级编舞动作适配领域契约批次

- 新增版本化命名空间 `yk-pets/biped-motion-adaptation/v1`。框架无关定义明确区分表演阶段、Motion/Pose Warp、主副手约束和武器特效提示；当前阶段只声明数据所有权与安全边界，尚未把这些数据编入 Quaternion Clip，也未接入 Three renderer。
- 四类输入预算分别固定为阶段 `16`、Warp `32`、约束 `16`、特效提示 `32`。阶段时间限制在规范化动作时长内，强度、Warp 距离/转角、约束权重、特效阈值/寿命均钳制到有限安全范围；全部身份按 Unicode code point 排序，重复 ID 保留首个合法项。
- Warp、约束和特效必须引用预算内实际保留的阶段。`weapon-trail` 固定使用两个不同语义点，`impact-sparks` 与 `impact-ring` 固定使用一个语义点；引用缺失、点数量错误或未知枚举只丢弃对应增强，不影响原动作关键帧。
- 顶层对象、四类数组、单项字段与特效点数组均隔离 Proxy/getter 异常。输出定义、嵌套条目、语义点数组和诊断全部递归冻结；单次诊断最多 `128` 项且使用有界中文 warning，不向调用方抛出损坏持久化数据。
- TDD 首轮确认公共入口缺失时新增合法用例单独失败、原有 `220` 项继续通过；第二轮确认重复/排序、引用、Proxy 和预算四组用例先失败。完成实现后 `corepack pnpm --filter @yk-pets/pet-core test` 为 `225/225`，`corepack pnpm --filter @yk-pets/pet-core typecheck` 与 `git diff --check` 均 exit 0。机器状态新增 `bipedPetMotionAdaptationContractComplete=true`；下一批为道具动作 Rig 语义点契约。

## 47. 道具动作 Rig 语义点批次

- 新增版本化命名空间 `yk-pets/prop-rig/v1`，统一声明 `primaryGrip`、`secondaryGrip`、`trailStart`、`trailEnd` 和 `impactPoint`。每个点使用道具局部位置与单位 Quaternion；显式五点完整时状态为 `ready`，输入和输出不共享引用且全部递归冻结。
- 无显式扩展时，只读取本站参数化 `components`、现有 `grip` 锚点和最多 `48` 个组件，不读取 `localModel`、GLB 或任何外部格式。纯数值层级矩阵按固定 XYZ Euler、局部缩放和父子变换计算资产局部 AABB；旋转后的长棍仍能识别真实 X 主轴，子级可继承父级可见性和变换。
- 最长轴必须比次长轴至少大 `1.35` 倍。可证明时按主轴生成副握点、两端轨迹点和命中点并返回 `derived`；球体、粒子、隐藏长轴、空几何、断裂层级或近似等轴道具返回 `primary-only`，不会伪造双手约束。
- 显式扩展优先于自动推导；扩展 getter、字段 Proxy、非有限位置和无效 Quaternion 均局部隔离。零 Quaternion 修复为单位旋转并给出 warning；显式其他点不完整但主握点有效时保留显式主握点，主握点本身损坏时回退资产 `grip`，避免错误覆盖成原点。诊断最多 `32` 项并全部冻结。
- TDD 首轮确认两个公共入口缺失时新增用例失败、原有 `225` 项继续通过；第二轮确认显式优先、旋转圆柱和退化输入先失败；自审回归又确认损坏主握点错误覆盖资产锚点。最终 `corepack pnpm --filter @yk-pets/pet-core test` 为 `232/232`，`pet-core` 类型检查与 `git diff --check` 均 exit 0。机器状态新增 `bipedPetPropRigContractComplete=true`；下一批为尺寸化动作适配计划与动作样本。

## 48. 尺寸化动作适配计划与采样批次

- `compileBipedPetMotionAdaptationPlan` 现在把规范化编舞意图按角色高度、左右臂展和道具 Rig 编译为框架无关只读计划。Warp 的归一化距离会转换为 `maxDistanceWorld`，副手约束携带对应臂展与已复制的目标语义点，武器特效提示携带已复制的轨迹或命中点；缺少语义点只关闭依赖它的约束或特效，不影响基础阶段与 Warp。
- 编译计划使用最多 `64` 项的 LRU 风格有界缓存。完整身份包含 Clip 哈希、Profile ID、角色哈希、角色高度、左右臂展、规范化定义、实际引用的道具身份/五点数据和确定性诊断；相同值输入复用同一冻结计划，Clip、Profile、体型或道具几何变化都会产生不同计划键，避免把某个体型的可达性结果串给另一个体型。
- `sampleBipedPetMotionAdaptation` 是无播放状态的纯数值采样器。阶段边界使用固定上限 `120ms` 的 `smoothstep` 淡入淡出，极短阶段自动缩短到半段时长；输出保留 requested 与 resolved 两种时间，并给出当前阶段、约束权重和活动特效提示，因此暂停重复帧、回拖、24/30/60FPS、loop 与 ping-pong 都由同一解析时间得到确定结果。
- `BipedPetQuaternionClip` 新增递归冻结的 `adaptationDefinition`。编译器从 `yk-pets/biped-motion-adaptation/v1` 安全读取并合并中文 warning；异常 Proxy 或损坏字段只关闭增强。有效适配参与 Clip 哈希；空适配维持旧资产历史哈希，不会因为新增兼容字段使全部旧 Clip 身份失效。
- `sampleBipedPetMotion` 新增可选第三参数 `{ adaptationPlan }`，仅在调用方提供与当前角色/道具匹配的已编译计划时返回 `adaptation`。原有两参数调用不创建计划、不改变返回行为；blocked Clip 继续返回安全空姿态。
- TDD 首轮在原有 `232` 项全部通过的同时稳定得到三个“计划编译入口不存在”失败；Clip 接入轮又稳定得到两个 `adaptationDefinition` 缺失失败。完成实现后 `corepack pnpm --filter @yk-pets/pet-core test` 为 `237/237`，`corepack pnpm --filter @yk-pets/pet-core typecheck` 与 `git diff --check` 均 exit 0。机器状态新增 `bipedPetMotionAdaptationPlanComplete=true`；下一批为复杂双足副手持械约束与动作控制器挂点。

## 49. 复杂双足副手持械约束批次

- 新增 `createComplexBipedWeaponConstraintController`。当前 `biped-pet/v1` 使用固定左臂链 `upper-arm.left → elbow.left → forearm.left → wrist.left → hand.left`：标准连续链走解析 Two Bone IK，异常但可编译的链走受约束 FABRIK，缺骨或编译失败安全返回 `blocked`。同一复杂角色 runtime 通过 `WeakMap` 令牌只允许一个副手写入者，释放后才允许重建。
- 主手 Socket 与道具对象继续拥有道具世界变换，持械控制器只读取道具矩阵、主握点和副握点；它只写左臂骨骼 Quaternion，不写道具、右臂或任何骨骼 position。不可达副握点先沿主握点到副握点的武器轴钳制到臂展球，再按实际距离降低权重并返回 `degraded`，不会拉伸手臂或把主手从道具上扯开。
- 动作控制器新增受控 `beforeLegIk` hook，严格位于 `Balance → 第一次 updateMatrixWorld` 之后、腿部 IK 之前。相同 Clip、requested time 和权重的暂停重复帧继续冻结完整显示姿态，因此不会重复求解副手；hook 的任意抛出值不被吞掉，交给 renderer 的同步故障边界统一 reset/重建。
- 腕部承担少量握持朝向预对齐，手掌承担剩余朝向；位置求解、腕掌朝向共享有界累计角修正。执行失败会尽力回滚本帧左臂 Quaternion，`reset()` 恢复构造时姿态；`dispose()` 即使状态检查或矩阵更新抛出 `Error`、`undefined` 等任意值，也会释放单写入令牌、封存旧实例并聚合中文上下文，二次释放幂等。
- TDD 首轮稳定得到新模块 `ERR_MODULE_NOT_FOUND`。完成后定向运行时测试覆盖柔和、运动、圆润、修长四种真实配方、可达与不可达握点、段长/道具矩阵所有权、重复暂停帧、重复控制器、释放后重建以及故障注入；`corepack pnpm run test:studio-complex-biped-root-motion-runtime`、Playground 类型检查、静态顺序/所有权门禁与 `git diff --check` 均通过。机器状态新增 `bipedPetSecondaryGripRuntimeComplete=true`；下一批为确定性武器轨迹与命中特效。

## 50. 确定性持械轨迹与命中特效批次

- `sampleBipedPetWeaponVfxSignals` 只读取相邻请求帧中已经转换到 renderer/VFX 共同父级坐标系的道具语义点。轨迹按全局请求时间每 `40ms` 取样并线性插值真实 `trailStart/trailEnd`；命中火花和冲击环只在 `impactPoint` 真实向下穿越地面且速度严格超过提示阈值时发出。信号身份包含 Clip、提示、穿越时间和序号，位置与时间做稳定数值规范，因此 24/30/60FPS 得到相同身份、时间和坐标。
- 首帧、暂停同帧、回拖、Clip 切换、blocked、非有限坐标、异常 Proxy 和无法安全离散的巨大时间都返回冻结空信号；单帧最多处理 `32` 个提示并输出 `64` 个信号，巨大帧间隔不会形成无界循环。输出信号和嵌套点数组递归冻结，不与输入共享可变引用。
- 新增 `createComplexBipedWeaponVfxController`，只消费动作请求时间，不读取 `Date.now/performance.now`，不创建 RAF。轨迹段、命中火花、冲击环固定池容量分别为 `24/32/8`，总计 `64`；轨迹与冲击环复用 Mesh/Geometry，火花使用单个 `InstancedMesh`，每次命中最多激活 `16` 粒火花。池满按最老激活序公平复用，近期信号账本固定 `512` 项并额外检查活动槽，暂停重复信号不会再次分配。
- 每帧只根据 `requestedTimeMs` 计算衰减、轨迹姿态、火花抛散和冲击环扩张；回拖和 `reset()` 清空活动槽及去重账本但保留所有 Three/GPU 资源。每种效果独立初始化，单类 Geometry/Material/挂载失败只将该类列为 unavailable；默认资源和工厂 provisional 资源都按对象身份管理，跨类共享时不会重复释放。
- `dispose()` 在释放前先用 `disposing` 封存同步重入，再对活动槽、唯一 Geometry、唯一 Material、自有子节点和父级逐项尽力清理。任意资源抛出 `Error`、`undefined` 等值都会进入中文聚合且不阻断后续资源，旧实例最终封存、父级解绑、二次释放幂等。
- TDD 信号轮先在原有 `237` 项保持通过时得到两个公共入口缺失失败；对象池轮稳定得到 `ERR_MODULE_NOT_FOUND: complex-biped-weapon-vfx.ts`。完成后 pet-core 为 `240/240`，定向 Three 运行时测试、Playground 类型检查、40ms/24-30-60FPS/池容量/故障释放静态门禁与 `git diff --check` 均通过。机器状态新增 `bipedPetWeaponMotionVfxComplete=true`；下一批为道具句柄与 renderer 生命周期接线。

## 51. 复杂模型持械动作 renderer 接线批次

- `ComplexBipedPropInstance` 在道具 Group 完成真实 reparent 后发布只读 runtime 句柄，并在卸载前按 `instanceId + Group` 身份发布释放事件；集合组件只转发事件，不保存第二份 Three 所有权。同一 `instanceId` 只接受一个 Group，陈旧对象不能释放替换后的句柄；Group 被外部移除或 reparent 后会在下一次读取时失效并触发适配计划重编译。
- `ComplexBipedPetRenderer` 现在维护唯一浅句柄 Map 和道具 Rig 派生表，并按实际编译骨骼局部段长计算左右臂展。道具晚挂载、资产更新或卸载时，renderer 经既有安全同步边界重新编译尺寸化适配计划；无道具和缺少语义点时只关闭依赖它的增强，不阻断基础动作。
- 每个角色 runtime 只创建一个副手持械约束控制器和一个持械 VFX 控制器。帧顺序固定为 `动作/FK → Root Motion → Balance → 世界矩阵 → 副手约束 → 腿 IK → 最终矩阵 → 原运动 VFX → 武器 VFX`；副手约束由动作控制器的 `beforeLegIk` hook 注入，武器语义点在最终姿态后转换到角色与 VFX 的共同父级坐标系。
- 武器帧使用两组预分配容器交替保存当前帧与前帧，逐帧不创建 Map、Canvas、RAF 或 Skeleton。暂停、回拖、Clip 切换、无动作、blocked 和停止权重会同时清动作、两类 VFX、持械约束及轨迹历史；运行时释放顺序固定为持械 VFX → 原运动 VFX → 持械约束 → 动作控制器 → 角色 runtime，单项失败不阻断后续清理。
- TDD 首轮确认句柄导出和 renderer 生命周期门禁缺失；完成后定向运行时测试覆盖真实挂点、重复 Group、未挂载 Group、陈旧释放与外部移除，静态 AST 门禁覆盖真实 Vue emit/listener、唯一控制器、适配编译/采样、sibling primitive、逆序释放和单 Canvas 边界。`corepack pnpm run test:studio-complex-biped-root-motion-runtime`、Playground 类型检查、Root Motion/VFX 静态门禁与 `git diff --check` 均通过。机器状态新增 `bipedPetWeaponRuntimeWiringComplete=true`；下一批为星云长棍与十二秒棍术的内置资产和新手自动优化界面。

## 52. 星云长棍与十二秒自动适配棍术批次

- 内置“星云长棍”新增显式 `yk-pets/prop-rig/v1` 五点：主握点 `[0.32,0,0]`、副握点 `[-0.58,0,0]`、轨迹两端 `[-1.65,0,0]/[1.65,0,0]` 与命中点 `[1.65,0,0]`，全部使用单位 Quaternion。运行时不再依赖长轴猜测，Rig 状态固定为 `ready`。
- “星云棍术组合”保持 `12000ms`，现为 `17` 条语义轨道、`239` 个关键帧，包含准备、棍花、换手、横扫、腾空、下劈、收势七个按时间序号稳定排序的表演阶段，时间边界依次为 `0/900/3200/4300/7600/9300/10100/12000ms`。动作适配包含五个尺寸化 Warp、换手/横扫/下劈三段左手副握约束，以及棍花、横扫、腾空轨迹和下劈火花/冲击环；新增右臂纵向轨道使下劈端点具备真实向下速度。
- 容器级 Root Motion 现在拥有 `1.15×身高` 位移、整周转向、`0.38×身高` 弹道腾空、五个 warp 窗、命中制动与收势移动；原 `root.position.x/y` 和 `root.rotation.y` 关键帧缩为重心/姿态微调，分别限制在 `0.22/0.24/0.35` 内，不再与容器争夺舞台位移、腾空和转向所有权。
- Store 新增 `restoreMotionAdaptationRecommendations()`。它优先按打开时 baseline 的时长比例恢复阶段时间；baseline 没有适配时，只读取 `yk-pets/biped-motion/v1.sourceMotionId` 指向的内置来源，不按中英文名称猜测。写回只替换动作适配命名空间，保留关键帧、Root Motion、接触/事件、道具事件、未知扩展和明确来源，并只加入一个撤销项。
- 基础属性页新增 `StudioMotionAdaptationSummary`：默认只展示自动适配状态、预计移动/转向、双手阶段和动作特效；阶段、空间修正窗、约束与提示数量收进原生 `details/summary`。复杂模式会实际解析道具实例及其 Rig 点后才显示就绪；简单模式明确说明设置已保存。重新优化按钮具备禁用原因、`aria-describedby`、键盘焦点和 `780px` 单列布局。
- TDD 先稳定得到长棍 `derived !== ready`、动作适配缺失和摘要组件缺失 RED；完成后内置资产、模型/Store、静态 Root Motion/VFX 门禁与 Playground 类型检查均通过。机器状态新增 `bipedPetNebulaStaffAdaptationComplete=true` 和 `bipedPetMotionAdaptationBeginnerUiComplete=true`；下一批为 Chromium 双视口真实动作、持械与特效验收，以及阶段交付状态收口。

## 53. 星云棍术高级动作适配阶段交付

- “星云棍术组合”现在形成一条可复用的站内自动化链路：新手复制内置动作后，系统自动解析星云长棍五个 Rig 语义点，按当前双足体型编译七阶段动作适配、五个 Warp、三段副手握持和五个武器特效提示；用户无需导入 GLB、手工绑骨、蒙皮或配置粒子。
- 命中特效仍以真实轨迹为前提。采样器优先使用命中点向下穿越地面的真实时间；对于低细节程序化模型无法保证端点恰好穿过地面的情况，提示可声明阶段内 `triggerProgress`。计划编译为绝对 `triggerTimeMs`，只有相邻帧跨过该时刻且真实命中点速度仍严格向下并超过阈值时才发出信号。首帧、暂停重复帧、回拖和向上运动不会触发，因而不是无条件定时播放特效。
- 当前内置下劈在 impact 阶段 `45%`，即 `9660ms`，进入确定命中判定。真实 `40ms` 运行时探针从 `9000→10100ms` 使用正式动作、正式长棍 Rig 与正式武器控制器采样，确认同时产生 `impact-sparks` 和 `impact-ring`；对应核心回归锁定端点未触地但真实向下时的一次确定信号，`pet-core` 当前为 `241/241`。
- 2026-07-29 Chromium 1440×900 实测覆盖 `450/2100/3800/6100/8500/9700/11200ms`。七阶段姿态、主手握持、三段副手加入、支撑/腾空/恢复、棍花与横扫轨迹均可观察，`9700ms` 明确可见青白冲击环与黄色火花；播放、暂停、停止、`9700→2100ms` 回拖、简单/复杂互斥均正常，Canvas 始终为 1。干净标签页 console error 和 hydration mismatch 均为 0。
- Chromium 760×900 实测无横向溢出，工具栏正常换行，自动适配摘要与技术信息单列；播放、暂停、停止、模型模式切换和主要操作未被浮动按钮遮挡，Canvas 为 1。两项证据已写入 `.ai/visual-cases.json` 的 `biped-pet-nebula-staff-adaptation`。
- 本阶段只关闭“星云棍术纵向样板”和可复用双足持械动作适配运行时，不关闭舞蹈、组合拳、体操、冲刺等完整高级动作库，也不关闭人类、四足、机甲、高细节拓扑、Safari/Firefox、不同 GPU/WebGL、最终像素与性能边界。下一阶段为 `biped-pet-motion-library-and-cross-browser-acceptance`。
