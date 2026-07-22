# 动作与闲时调度 / Motion and Idle Authoring

## 1. 动作注册表

所有可播放动作必须注册，菜单、时长、调度和文档从注册表读取。

```ts
interface PetActionDefinition {
  id: string
  label: string
  labelEn: string
  durationMs: number
  category: 'state' | 'social' | 'basic' | 'life' | 'prop' | 'energy' | 'scene'
  intensity: 'micro' | 'normal' | 'high'
  interruptible: boolean
  idleTier: 'never' | 'normal' | 'rare' | 'high' | 'easter'
  requiredAnchors: readonly string[]
  evaluate(context: PetActionContext): PetMotionPose
}
```

动作 ID 使用稳定的 kebab-case。不要把中文标签当作运行时 ID。

## 2. 动作姿态

```ts
interface PetMotionPose {
  body?: TransformPose
  head?: TransformPose
  leftFrontPaw?: LimbPose
  rightFrontPaw?: LimbPose
  leftHindLeg?: LimbPose
  rightHindLeg?: LimbPose
  tail?: TailPose
  gazeTarget?: Vector3
  prop?: PetPropPose
  effects?: PetEffectPose[]
}
```

动作计算返回“期望姿态”，Rig 应用层负责阻尼和实际节点更新。不要让每个动作直接遍历整个场景树。

## 3. 生命周期

每个动作至少包含：

```text
enter  → 从待机进入动作
active → 主要动作阶段
exit   → 主动作结束并回收道具
settle → 回到稳定中性姿态
```

推荐工具：

```ts
const smoothStep = (min: number, max: number, value: number) => {
  const x = Math.min(1, Math.max(0, (value - min) / (max - min)))
  return x * x * (3 - 2 * x)
}

const pulse = (value: number, start: number, end: number) => {
  const middle = (start + end) * 0.5
  return value < middle
    ? smoothStep(start, middle, value)
    : 1 - smoothStep(middle, end, value)
}
```

## 4. 动作阶段示例

### 跳跃

```text
0–15%   下蹲蓄力
15–42%  起跳上升
42–55%  最高点停留
55–80%  下落
80–92%  落地压缩
92–100% 恢复站立
```

### 招手

```text
0–20%   抬起前臂
20–75%  爪端围绕手腕摆动
75–90%  停止摆动
90–100% 放下前爪并稳定
```

### 吃饭

```text
0–12%   桌子、饭盆和食物淡入
12–25%  低头并靠近桌沿
25–82%  进食循环
82–94%  抬头和松开前爪
94–100% 道具淡出
```

### 能量爆发

```text
0–24%   双爪靠拢
24–55%  能量球吸入粒子并增亮
55–68%  峰值脉冲
68–82%  冲击波和粒子外散
82–100% 粒子淡出、双爪恢复
```

## 5. 共享运动目标

玩球、飞扑接球、吃饭和能量动作必须定义共享姿态对象。

```ts
interface BallMotionPose {
  position: Vector3
  velocity: Vector3
  activeSide: -1 | 1
  height: number
}

interface CatchMotionPose {
  ballPosition: Vector3
  bodyTarget: Vector3
  pawTarget: Vector3
  facingYaw: number
}
```

球、眼睛、头部、身体和四肢读取同一份结果。禁止分别复制相似公式。

## 6. 动作打断和重复播放

控制器应支持：

```ts
interface PetController {
  play(actionId: string, options?: {
    restart?: boolean
    priority?: number
    repeat?: number
  }): Promise<void>
  stop(options?: { settle?: boolean }): void
}
```

规则：

- 用户直接选择动作时，可以通过短暂中性姿态打断可打断动作；
- 不可打断动作只接受更高优先级系统请求；
- 再次选择相同动作时必须重新开始时间线；
- 队列最多保留一个最有意义的下一动作；
- 悬停和普通闲时动作不能打断高优先级手动动作；
- 动作结束后经过 settle 再进入下一动作。

## 7. 旋转动作

完整转圈或后空翻必须使用单调增加的累计角度：

```ts
rotation = startRotation + turns * Math.PI * 2 * easedProgress
```

结束时归一化到等价整圈角度，再缓动到待机，不能使用从 `2π` 插值回 `0` 的可见反向回转。

尾巴风车只修改 `tailRoot` 的局部旋转。身体最多有小幅反作用倾斜。

## 8. 粒子生命周期

### 充能

粒子可以从外部向能量球中心移动。

### 爆炸

爆炸后的粒子只能：

- 沿初始方向外散；
- 逐渐减速；
- 受重力下落；
- 漂移；
- 淡出。

禁止：

- 倒放位置曲线；
- 在后半段重新吸回中心；
- 用整体缩小假装粒子被回收；
- 把常驻身体轨道当作爆炸冲击波。

## 9. 闲时策略

```ts
interface PetIdlePolicy {
  enabled: boolean
  normalIntervalMs: [number, number]
  rareIntervalMs: [number, number]
  highIntervalMs: [number, number]
  easterIntervalMs: [number, number]
  allowHighEnergy: boolean
  pauseWhenHidden: boolean
  respectReducedMotion: boolean
}
```

建议值：

| 层级 | 示例 | 间隔 |
|---|---|---:|
| normal | 眨眼、环顾、轻摇尾、招手 | 10–20 秒 |
| rare | 伸懒腰、吃饭、玩球、云朵休息 | 30–70 秒 |
| high | 后空翻、尾巴风车、能量爆发 | 90–180 秒 |
| easter | 烟花、特殊喷嚏、彩蛋 | 150–300 秒 |

## 10. 闲时硬规则

- 页面隐藏时停止调度；
- 菜单打开、拖拽、忙碌或播放动作时不触发；
- 减少动态效果开启时禁用高能和 Easter；
- 不连续选择同一个动作；
- 手动交互后重新计算冷却；
- 闲时动作退出时必须恢复稳定待机；
- 闲时调度属于通用运行时，不应复制到每个物种组件。

## 11. 基础动作建议

新宠物第一版至少提供：

- `idle`：呼吸、眨眼和轻微视线；
- `greeting`：招手；
- `jumping`：完整跳跃；
- `stretching`：伸展；
- `resting`：休息；
- `playing-ball` 或其它道具动作；
- `tail-wave` 或物种等价尾部动作。

根据物种能力增加睡眠、吃饭、追视、能量动作和场景动作。

## 12. 动作验收

- 同一动作可以立即重新播放；
- 进入、退出和 settle 没有瞬移；
- 眼睛、道具和爪子共享目标；
- 四肢异相，不像机器人同步；
- 高能动作不会长期改变待机基础姿态；
- 转圈、空翻和尾巴动作不出现反向回转；
- 页面隐藏和减少动态效果行为正确；
- 正面、左侧、背面和右侧都能理解动作意图。
