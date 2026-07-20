# 验证报告

环境：Node.js 22.16.0。

## 基线验证

本次升级使用的 v1.0.1 基线此前已通过：

- `pnpm typecheck`
- `pnpm build`
- 生产服务器启动
- `GET /` 返回 HTTP 200
- 本地 Mock Agent 返回结构化指令

## v1.2.0 动作升级验证

已确认：

- 前端 `PetAnimation` 联合类型、XState 事件与服务端 Zod Schema 包含一致的 `jumping`、`flapping`、`resting` 状态。
- `speaking` 属性从 `index.vue` 经 `PetCanvas.vue` 传递到 `CloudFox.vue`。
- 本地 Agent 会把测试短语路由到新增动画指令。
- 说明性 Vue 与模板注释采用中英双语格式。

## 当前 Monorepo 验证

双语文档与注释改造后已重新执行：

```bash
pnpm typecheck
pnpm build:playground
```

结果：全部通过。

生产构建存在 Three.js/TresJS 3D Chunk 超过 500 KB 的警告，但构建成功。该 Chunk 通过异步组件加载，不影响审计 Content Script。
