# 外观、标志、道具与特效 / Appearance, Symbols, Props, and Effects

## 1. 数据分层

外观、物种定义和运行时状态必须分开。

```ts
interface PetSpeciesDefinition<TAppearance> {
  id: string
  label: string
  labelEn: string
  rendererIds: readonly string[]
  capabilities: readonly string[]
  safeRanges: Record<string, readonly [number, number]>
  createDefaultAppearance(): TAppearance
  normalizeAppearance(input: unknown): TAppearance
}

interface PetRuntimeState {
  activeAction: string
  emotion: string
  busy: boolean
  idleEnabled: boolean
  gazeTarget?: Vector3
}
```

外观导入不得覆盖当前动作、亲密度、记忆、审计状态、网络状态或 Agent 连接。

## 2. 推荐外观配方

```ts
interface ProceduralPetAppearance {
  identity: {
    petId: string
    nameZh: string
    nameEn: string
    monogram: string
  }
  palette: {
    coat: string
    coatShadow: string
    coatWarm: string
    belly: string
    eye: string
    primaryGlow: string
    secondaryGlow: string
    tailGlow: string
    symbolGlow: string
  }
  proportions: {
    bodyWidth: number
    bodyHeight: number
    bodyDepth: number
    headScale: number
    eyeScale: number
    eyeSpacing: number
    limbLength: number
    limbThickness: number
    limbSpacing: number
    pawScale: number
    tailLength: number
    tailWidth: number
  }
  parts: Record<string, string>
  tailDesign: Record<string, unknown>
  frontPawDesign: Record<string, unknown>
  bellyPatchDesign: BellyPatchDesign
  chestDisplay: ChestDisplay
  symbols: {
    chest: SymbolChannel
    back: SymbolChannel
  }
  effects: PetEffectRecipe
}
```

## 3. 规范化

- 输入必须先判断是否是普通对象；
- 字符串去空格并限制长度；
- 颜色使用固定格式验证；
- 数字必须有限并 Clamp；
- 枚举只接受注册项；
- 未知字段可以保留在 `extensions`，但不能直接驱动代码执行；
- 缺失字段回退到物种默认值；
- 旧版本通过显式迁移补齐字段。

不要声称支持未知协议版本，除非已经实现真正的迁移或拒绝策略。

## 4. 白色肚皮或身体贴片

```ts
interface BellyPatchDesign {
  visible: boolean
  style: 'oval' | 'shield' | 'bean' | 'teardrop' | 'heart'
  width: number
  height: number
  offsetX: number
  offsetY: number
  surfaceOffset: number
}
```

规则：

- 使用贴合身体曲率的薄壳、贴面或曲面贴花；
- 不把完整厚球体直接贴在身体前方；
- 侧视角只露出薄边；
- 不同身体形状需要单独表面兼容；
- 宽高独立调整；
- 极端参数仍受安全范围限制；
- 动作中不得与前爪、胸口核心和轨道长期重叠。

## 5. 标志通道

```ts
interface SymbolChannel {
  enabled: boolean
  text: string
  color: string
  scale: number
  rotation: number
  glowIntensity: number
  offsetX: number
  offsetY: number
  offsetZ: number
}

interface ChestDisplay {
  mode: 'none' | 'energy-core' | 'symbol' | 'hybrid'
}
```

建议限制文字为 1–3 个字符。Canvas 动态纹理适合短字母和简单徽记。

### 胸口模式

- `none`：不显示；
- `energy-core`：只显示核心；
- `symbol`：隐藏核心，只显示文字；
- `hybrid`：核心缩小，文字显示在前层。

### 后背标志

- 默认位于背部上半区；
- 避开尾根与主要尾巴摆动包围盒；
- 从背面看方向正确；
- `offsetZ` 足以避免 Z-fighting，但不能明显悬浮。

## 6. 眼睛外观

眼睛材质建议包含：

- 深色主眼球；
- 可移动瞳孔或发光点；
- 左右镜像高光；
- 情绪形变或闭眼层；
- 可选眼缘和发光外圈。

高光和瞳孔不是同一层。闭眼动作应控制眼睛可见高度或专用眼睑，而不是把整个眼睛移动到头内部。

## 7. 颜色角色

不要按场景遍历时只比较“当前颜色”来决定角色，而应尽量在创建材质时登记角色：

```ts
type MaterialRole =
  | 'coat'
  | 'coatShadow'
  | 'coatWarm'
  | 'belly'
  | 'eye'
  | 'primaryGlow'
  | 'secondaryGlow'
  | 'tailGlow'
  | 'symbolGlow'
```

若需要兼容旧模型，可以使用一次性旧颜色映射，但后续更新应保存材质角色，避免颜色改变后无法再次识别。

## 8. 道具系统

```ts
interface PetPropPose {
  id: string
  visible: boolean
  position: Vector3
  rotation: Euler
  scale: Vector3
  opacity: number
}
```

### 吃饭

```text
mealGroup
├── table
├── bowl
├── food
├── optionalSteam
└── optionalDecoration
```

- 桌子、饭盆和食物作为一个道具组；
- 饭盆必须位于桌面；
- 嘴、头、眼睛和前爪读取同一进食目标；
- 道具淡入淡出，不从身体内部突然缩回。

### 玩球和接球

- 球的位置、速度和主动侧来自共享 `BallMotionPose`；
- 眼睛全程看球；
- 主动侧前爪追球，另一侧辅助；
- 后爪交替参与；
- 身体重心跟随球移动；
- 无法稳定的斜向构图优先回退到正面清晰构图。

### 云朵或承托物

- 宠物身体中心位于承托物上方；
- 承托物轮廓完整可见；
- 四肢不穿过底部；
- 退出动作时平滑恢复。

## 9. 能量球

统一组件应支持：

- 内部亮核；
- 外部光晕；
- 充能吸入粒子；
- 爆发冲击波；
- 外散粒子；
- 消散生命周期。

挂点规则：

- 触角充能：两触角尖端中点上方；
- 双爪爆发：两前爪 Anchor 中点；
- 不固定在世界坐标；
- 不误用胸口核心作为所有能量动作的球体。

## 10. 身体轨道

轨道配置示例：

```ts
interface OrbitDesign {
  enabled: boolean
  ringCount: 1 | 2 | 3
  radius: number
  verticalScale: number
  tilt: number
  speed: number
  intensity: number
  particleCount: number
  primaryColor: string
  secondaryColor: string
}
```

规则：

- 轨道围绕身体常驻，不从身体内部开始；
- 保持 Depth Test，让后半轨道被身体遮挡；
- 粒子优先使用圆点；
- 条状粒子沿轨道切线旋转；
- 关闭开关后轨道和轨道粒子全部隐藏；
- 爆炸冲击波使用独立 Mesh。

## 11. 特效层级

```text
宠物局部特效：跟随头、爪、尾巴或身体挂点
道具特效：跟随 propRoot
场景特效：位于 sceneEffectsRoot，不跟随全身旋转
```

扫描线、能量环和粒子不得放在封闭头部几何内部。没有明确视觉用途的旧占位 Mesh 应删除，不通过降低透明度掩盖。

## 12. 外观验收

- 主色和发光色在深浅背景均清晰；
- 肚皮侧面没有厚板感；
- 胸口模式互斥和混合层级正确；
- 后背标志不被尾根长期遮挡；
- 眼睛追视不会破坏镜像高光；
- 道具在四视角都能被理解；
- 轨道不穿头、不产生错误矩形碎片；
- 旧配方导入后外观稳定。
