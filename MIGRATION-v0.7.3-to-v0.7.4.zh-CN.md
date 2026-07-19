# 从 v0.7.3 迁移到 v0.7.4

## 迁移目标

将 v0.7.3 已完成的 2D 自动降级、Agent 权限和插件治理，真正接入浏览器扩展运行时，同时保持扩展版本 `0.6.10` 不变。

## 推荐接入顺序

1. 将以下四个新 package 加入原 monorepo：
   - `pet-site-policy`
   - `pet-runtime-lifecycle`
   - `pet-feature-loader`
   - `pet-extension-runtime`
2. 用 `createChromeStorageAdapter(chrome.storage.local)` 创建站点策略存储。
3. 保留 v0.7.3 的 `createCanvas2DRendererFactory()` 作为立即可用的轻量渲染器。
4. 将 Three.js/TresJS 3D Factory 从 Content Script 主 bundle 中移出，改为 `loadRenderer3d()` 动态加载。
5. 将页面审计采集器移出主 bundle，改为 `loadAuditFeature()`，只有执行审计时才加载。
6. 在 Content Script 中创建 `ExtensionPetRuntime`，调用 `start()` 后再调用 `attachBrowserLifecycle()`。
7. 将 Side Panel 的站点开关映射为：
   - `enabled`：正常显示并运行；
   - `paused`：显示静止 2D，不运行 WebGL；
   - `hidden`：不显示，首次进入该站点时也不初始化渲染器。
8. 将现有 Runtime Message 转为 `createExtensionRuntimeMessageHandler()` 支持的受控命令，禁止任意方法名透传。
9. 运行完整门禁：

```bash
npm run release:verify
```

## 现有 3D Renderer 需要补充的可选接口

v0.7.4 的 `PetRenderer` 增加了以下可选生命周期接口：

```ts
start?(): void | Promise<void>
stop?(): void | Promise<void>
setVisible?(visible: boolean): void | Promise<void>
```

Three.js Renderer 建议在：

- `stop()` 中取消 `requestAnimationFrame`，不要销毁场景；
- `start()` 中恢复渲染循环；
- `setVisible(false)` 中隐藏 Canvas，但保留状态；
- `dispose()` 中才释放 Geometry、Material、Texture、Renderer 和事件监听器。

## Manifest 与发布约束

- 扩展版本保持 `0.6.10`；
- ZIP 顶层仍必须直接包含 `manifest.json`；
- 动态 chunk 必须包含在最终扩展 ZIP 中；
- 不要打包 `node_modules`、源码缓存、测试产物和本地日志；
- 本阶段不引入任意 Shell 执行能力。
