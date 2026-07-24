# 宠物可配置系统

## 结构原则

Pet Studio 按配方、渲染和工作台三层组织。

- `parts.bodyShape` 与 `parts.headShape` 独立保存。
- 切换身体不会修改头型。
- 旧配方缺少头型时迁移为 `classic-round`。
- 默认、Studio 和导入 JSON 使用同一个正式 Cloud Fox 组合层。

## 身体与头型

身体可选：球体、椭圆体、胶囊体、梨形、豆形、圆角方糖。

头部可选：经典圆头、宽圆头、椭圆头、胶囊头、豆形头、圆角方头。

`cloud-fox-shape-profile.ts` 分别提供身体 Profile 与头部 Profile，因此两类选项可以自由组合。

## 单一模型表面

- `ExtensionCloudFoxBodyShape.vue` 是唯一躯干表面。
- `ExtensionCloudFoxBody.vue` 组合躯干、四肢、核心和标志。
- `ExtensionCloudFoxHeadShape.vue` 是唯一头部外壳。
- `ExtensionCloudFoxHead.vue` 只有一个动画 Head Rig 和一个 FaceRoot。
- `cloud-fox-limb-motion.ts` 保存完整前后肢动作姿态。

## 眼睛与面部

星芒眼使用交叉光片，水晶菱眼使用八面晶体，月牙眼使用细曲线。圆润眼与椭圆眼继续支持指针、玩球、飞扑和烟花追视。

经典云狐嘴保留原圆润嘴和舌头。猫系、线条、张嘴和嘟嘴使用薄曲线或薄口腔几何。鼻子和嘴巴均位于唯一头部局部坐标中。

## 肚皮

肚皮不再创建身体。十种轮廓绘制在按身体 Profile 弯曲的细分贴片上，并使用轻微深度偏移，避免出现中心被遮挡的空心圆环。

## Studio 工作台

- 使用 `100dvh` 和明确 Grid 轨道。
- 参数检查器独立滚动，方案区默认折叠。
- 部位热点默认关闭，点击“部位定位”后显示。
- `/` 聚焦搜索，`Escape` 关闭搜索、热点和经典对比。
- Studio 页面隐藏网页宠物覆盖层，避免遮挡编辑器。
- 桌面、窄屏和移动端使用独立断点。

## 本地边界

草稿、正式配方和方案库只保存在本机。本阶段没有新增浏览器权限、数据上传或后台轮询；Network Lab、Pet Memory、Page Audit、Local Agent 和现有 3D 性能控制保持。
