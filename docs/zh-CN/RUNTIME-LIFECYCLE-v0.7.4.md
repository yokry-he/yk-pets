# v0.7.4 运行时生命周期

## 自动暂停条件

默认情况下，以下任一条件成立都会停止渲染循环：

- 站点模式为 `paused`；
- 用户手动暂停；
- `document.visibilityState === 'hidden'`；
- 页面收到 `freeze`；
- 页面进入 `pagehide` / BFCache 路径；
- 宠物容器不在视口中。

站点模式为 `hidden` 时，控制器还会隐藏 Canvas。首次进入已隐藏站点时，`ExtensionPetRuntime` 不会挂载任何 Renderer。

## Renderer 生命周期契约

```ts
interface PetRenderer {
  start?(): void | Promise<void>
  stop?(): void | Promise<void>
  setVisible?(visible: boolean): void | Promise<void>
  dispose(): void
}
```

`stop()` 是可恢复暂停，不能释放场景；`dispose()` 才是最终清理。

## 浏览器事件接入

```ts
const monitor = runtime.attachBrowserLifecycle()

// Content Script 卸载时
monitor.stop()
await runtime.dispose()
```

`BrowserLifecycleMonitor` 监听 `visibilitychange`、`freeze`、`resume`、`pagehide`、`pageshow` 和 `IntersectionObserver`。

## 空闲预热

3D 模块可在页面稳定后的空闲阶段预取。预取失败不会破坏当前 2D Renderer，也不会自动循环重试。用户明确切换到 3D 时才执行一次显式重试。
