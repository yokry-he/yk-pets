# v0.7.4 浏览器扩展接入

## 推荐 bundle 拆分

```text
content-bootstrap.js       小型启动器、消息桥、站点策略
pet-2d.js                  轻量 Canvas 2D，可立即使用
pet-3d.js                  Three.js/TresJS 与模型，动态加载
audit-collector.js         DOM/可访问性/SEO/性能采集，按需加载
agent-tools.js             Local Agent 工具桥，用户执行任务时加载
```

Content Script 主入口不再静态导入 Three.js 和完整审计采集器。

## 创建运行时

```ts
const runtime = new ExtensionPetRuntime({
  sitePolicies,
  renderer2d: createCanvas2DRendererFactory(),
  loadRenderer3d: async () => {
    const module = await import(chrome.runtime.getURL('chunks/pet-3d.js'))
    return module.rendererFactory
  },
  loadAuditFeature: async () => {
    const module = await import(chrome.runtime.getURL('chunks/audit-collector.js'))
    return module.auditFeature
  },
})

await runtime.start(shadowRoot, location.href, initialProbe)
runtime.attachBrowserLifecycle({ target: hostElement })
```

## 安全消息协议

使用 `createExtensionRuntimeMessageHandler()` 接受以下固定命令：

- `runtime:get-status`
- `runtime:refresh-policy`
- `runtime:set-manual-paused`
- `site:set-policy`
- `renderer:force`
- `audit:run`

消息处理器不会根据外部字符串动态访问对象方法，也不会提供任意代码或 Shell 执行。

## SPA 导航

监听已有路由桥或 URL 变化后调用：

```ts
await runtime.navigate(location.href)
```

新 URL 的规则会立即生效。进入隐藏站点时停止并隐藏当前 Renderer；从隐藏站点返回启用站点时恢复状态。

## 扩展版本

本阶段仍以扩展 `0.6.10` 为稳定参照。先把 v0.7.4 SDK 接入开发分支，通过现有审计、预览、撤销、Agent 与回滚回归后，再单独决定扩展商店版本号。
