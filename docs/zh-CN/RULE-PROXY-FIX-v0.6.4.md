# NOVA v0.6.4：规则编辑器多层 Proxy 修复

## 根因

Side Panel 把待编辑规则保存在 Vue 响应式导航状态中。规则、`action` 和其他子结构可能分别成为多层 Proxy。v0.6.3 只在编辑器克隆函数中尝试解除顶层代理，仍然可能把嵌套 Proxy 传入 `structuredClone`，导致打开编辑器时报错。

## 修复

- 新增 `cloneNetworkValue`，对规则和草稿执行 JSON 序列化克隆，递归解除任意层级的 Proxy。
- 规则工厂、应用服务、草稿仓储、规则匹配器、Network Lab 导航和编辑器统一使用安全克隆。
- Extension 的 Network Lab 业务源码中已无任何 `structuredClone` 直接调用。
- Side Panel 底部版本由错误的固定 `0.5.0` 改为当前 `0.6.4`，方便确认实际加载版本。

## 回归策略

新测试不再直接传入普通对象，而是构造与 Side Panel 一致的父组件响应式导航状态和嵌套 Proxy。测试先确认原生 `structuredClone` 必然报错，再验证手动新增和基于请求生成都能打开、校验并构建可保存规则。
