# 云狐视觉回归规范

## 验证层级

云狐视觉修改必须分别通过三个层级，不能再用“代码分支存在”代替视觉完成：

1. **结构验证**：单一渲染器、独立头身、无重复身体和无额外权限。
2. **数值视觉验证**：表面距离、法线、屏幕投影尺寸和几何深度变化满足阈值。
3. **真实浏览器验收**：固定 URL 截图、三视角贴合、多分辨率和动作检查。

自动 CI 通过只表示前两个层级通过，不表示真实 Chrome/WebGL 人工验收已经完成。

## 真实表面采样

`cloud-fox-surface-model.ts` 是身体和头部挂点的唯一数学来源：

- 六种身体共享 `sampleCloudFoxBodyFrontSurface()`；
- 六种头型共享 `sampleCloudFoxHeadFrontSurfaceAtLocalXY()`；
- 眼睛通过 `resolveCloudFoxEyeSurfaceAnchor()` 沿头部表面法线外移；
- 肚皮通过 `createCloudFoxBellySurfaceMesh()` 逐顶点投影到身体表面；
- 扩展仅使用薄桥接导出同一领域源码。

肚皮不再使用固定 Z、平面缩放或通用弯曲常量。眼睛不再使用固定 `eyeZ`。

## 数值回归测试

`pnpm test:cloud-fox-surface` 检查：

- 六种身体的每个肚皮顶点与采样表面保持固定微小偏移；
- 肚皮法线归一化且朝向身体前方；
- 肚皮在生产相机下具有可见但不过度覆盖身体的投影尺寸；
- 侧面深度必须发生变化，禁止退化为悬浮平板；
- 六种头型的眼睛位于头壳外侧并朝向相机；
- 星芒、水晶和月牙眼拥有最小屏幕尺寸和最小眨眼比例。

## 固定视觉审计页

访问：

```text
/studio-visual-audit?body=ellipsoid&head=classic-round&eyes=spark&belly=ellipse&view=front
```

可用参数：

- `body`：六种身体 ID；
- `head`：六种头型 ID；
- `eyes`：六种眼睛 ID；
- `belly`：十种肚皮 ID；
- `view`：`front`、`left`、`back`、`right`。

该页面固定使用经典配方、Idle、深色背景、生产相机和唯一 Studio 画布。页面上的 `data-case-id` 可作为未来浏览器截图文件名。

## 人工必查组合

每次修改身体、头部、眼睛、肚皮、相机或挂点后，至少检查：

- 星芒眼与水晶菱眼：经典圆头和圆角方头，正面、左侧、右侧；
- 默认椭圆肚皮：六种身体，正面和侧面；
- 最大与最小肚皮尺寸：椭圆体、梨形、豆形、圆角方糖；
- 经典默认外观：正面、四视角、Idle、Talking、Eating；
- Studio 和 Chrome 扩展使用同一配方后的视觉一致性。
