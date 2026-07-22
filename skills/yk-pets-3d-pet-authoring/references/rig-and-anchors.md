# Rig 与语义挂点契约 / Rig and Semantic Anchor Contract

## 1. 目标

Rig 是宠物可动画的节点层级。程序化宠物可以使用 `Group/Object3D` 作为 Transform Rig，不要求必须使用 Blender Bone，但必须保持稳定的父子关系和语义挂点。

## 2. 推荐层级

```text
root
├── positionRig
│   └── actionRig
│       └── lookRig
│           ├── tailRoot
│           │   └── tailMid
│           │       └── tailTip
│           ├── body
│           │   ├── chestSymbolAnchor
│           │   ├── backSymbolAnchor
│           │   └── propRoot
│           ├── leftFrontShoulder
│           │   └── leftFrontForearm
│           │       └── leftFrontPawTip
│           │           └── leftFrontPawAnchor
│           ├── rightFrontShoulder
│           │   └── rightFrontForearm
│           │       └── rightFrontPawTip
│           │           └── rightFrontPawAnchor
│           ├── leftHindLeg
│           │   └── leftHindPawAnchor
│           ├── rightHindLeg
│           │   └── rightHindPawAnchor
│           └── head
│               ├── leftEye
│               │   └── leftPupil
│               ├── rightEye
│               │   └── rightPupil
│               ├── mouthAnchor
│               ├── leftEar
│               ├── rightEar
│               ├── leftAntennaTipAnchor
│               └── rightAntennaTipAnchor
└── sceneEffectsRoot
```

## 3. 必需挂点

```ts
interface PetRigAnchors {
  root: Object3D
  body: Object3D
  head: Object3D

  leftEye: Object3D
  rightEye: Object3D
  leftPupil: Object3D
  rightPupil: Object3D

  leftFrontShoulder: Object3D
  leftFrontForearm: Object3D
  leftFrontPawTip: Object3D
  leftFrontPawAnchor: Object3D

  rightFrontShoulder: Object3D
  rightFrontForearm: Object3D
  rightFrontPawTip: Object3D
  rightFrontPawAnchor: Object3D

  leftHindLeg: Object3D
  rightHindLeg: Object3D

  mouthAnchor: Object3D
  chestSymbolAnchor: Object3D
  backSymbolAnchor: Object3D
  propRoot: Object3D

  tailRoot?: Object3D
  tailMid?: Object3D
  tailTip?: Object3D
}
```

## 4. 坐标规则

- 所有静态基础位置集中定义，不要散落在动作分支中；
- 世界目标进入头部、身体或爪子动作前，转换到对应局部坐标；
- 共享道具目标统一定义在哪一层，就让身体、眼睛和四肢都从该层读取；
- `positionRig` 负责页面位置和整体移动；
- `actionRig` 负责跳跃、转圈和飞扑等全身动作；
- `lookRig` 只负责小幅头身朝向，不承担全身大旋转；
- 场景特效放在 `sceneEffectsRoot`，避免跟随身体空翻或尾巴旋转。

## 5. 前肢规则

```text
肩根：连接身体、控制整体抬起和张开
前臂：控制主要挥动和伸展
爪端：控制手腕、触碰和细节动作
爪锚点：道具、能量球和接触目标
```

- 肩部应嵌入身体，不使用贴在表面的截断圆柱；
- 左右前爪必须保留独立相位；
- 动作结束后所有层级回到稳定基础姿态；
- 爪端追目标时保留肩部可达范围限制。

## 6. 后肢规则

后肢不能只是静态装饰。至少支持：

- 跳跃收腿与落地压缩；
- 玩球或扑腾时交替踢蹬；
- 睡眠和休息姿态；
- 身体重心变化时的辅助动作。

## 7. 尾巴规则

```text
tailRoot → tailMid → tailTip
```

- 尾根连接身体并控制整体方向；
- 中段和尾尖使用逐级延迟相位；
- 摇尾和尾巴风车围绕尾根局部轴；
- 尾巴风车不得修改整个 `actionRig.rotation.y`；
- 尾段几何需要重叠或圆润连接，不能暴露圆柱截面；
- 后背标志应避开尾根运动包围盒。

## 8. 眼睛和视线

眼睛至少拆分为：

- 眼球或眼睛外形；
- 瞳孔/内部发光点；
- 高光；
- 眼睛基础挂点。

```ts
const localTarget = head.worldToLocal(targetWorld.clone())
const gazeX = clamp(localTarget.x * factorX, -maxX, maxX)
const gazeY = clamp(localTarget.y * factorY, -maxY, maxY)
```

- 左右瞳孔同向移动；
- 高光维持镜像方向，不跟着瞳孔完全重合；
- 眼睛移动叠加在各自基础挂点上；
- 不以球的单个 X 值猜局部方向；
- 目标在极端角度时进行 Clamp。

## 9. 标志挂点

- `chestSymbolAnchor` 位于身体前表面，略高于肚皮主视觉中心；
- `backSymbolAnchor` 位于背部上半区，避开尾根；
- 标志平面朝外，正反面方向分别明确；
- `offsetZ` 只用于离开身体薄层，不能造成明显悬浮；
- 胸口混合模式下能量核心缩小，文字位于前层。

## 10. 道具挂点

建议提供：

- `mouthAnchor`：饭盆、食物和说话粒子；
- `left/rightFrontPawAnchor`：玩球、能量和抓取；
- `propRoot`：桌子、球、云朵等道具；
- `sceneEffectsRoot`：烟花、冲击波和不跟随身体的粒子。

两前爪中点：

```ts
const center = leftWorld.clone().add(rightWorld).multiplyScalar(0.5)
```

必须基于当前世界矩阵计算，不能使用固定常量模拟。

## 11. Rig 验收

- 四肢在待机、跳跃和休息中都不脱离身体；
- 左右眼独立且不会缓动到脸中心；
- 尾巴动作不旋转整个身体；
- 胸背标志不会被主要部件长期遮挡；
- 道具目标与嘴、爪和视线共用坐标；
- 四视角下层级关系都清晰。
