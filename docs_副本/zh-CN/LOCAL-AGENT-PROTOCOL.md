# NOVA Local Agent WebSocket 协议

协议版本：`1`

默认地址：

```text
ws://127.0.0.1:4736
```

## 1. Envelope

每个请求包含：

```ts
interface ClientEnvelope {
  type: string
  requestId: string
}
```

成功响应：

```json
{
  "type": "result",
  "requestId": "uuid",
  "payload": {}
}
```

错误响应：

```json
{
  "type": "error",
  "requestId": "uuid",
  "error": {
    "code": "REQUEST_FAILED",
    "message": "错误说明"
  }
}
```

## 2. 认证

建立 WebSocket 后必须首先发送：

```json
{
  "type": "hello",
  "requestId": "uuid",
  "token": "CLI 显示的连接口令"
}
```

成功后返回 `ProjectInfo`：

```json
{
  "root": "/project/root",
  "name": "my-app",
  "packageManager": "pnpm",
  "framework": "Nuxt",
  "scripts": ["build", "test", "typecheck"],
  "protocolVersion": 1
}
```

## 3. 生成补丁

```json
{
  "type": "patch.generate",
  "requestId": "uuid",
  "pageUrl": "http://localhost:3000",
  "issue": {
    "id": "issue-id",
    "code": "image-dimensions-missing",
    "selector": "img.hero",
    "evidence": {
      "src": "http://localhost:3000/hero.png",
      "naturalWidth": 1200,
      "naturalHeight": 800
    }
  }
}
```

返回 `PatchProposal`，其中 `canApply=false` 表示只找到了候选或无法安全修改。

## 4. 应用与回滚

```json
{
  "type": "patch.apply",
  "requestId": "uuid",
  "patchId": "patch-uuid"
}
```

```json
{
  "type": "patch.rollback",
  "requestId": "uuid",
  "patchId": "patch-uuid"
}
```

补丁保存在 Agent 进程内存中；Agent 重启后需要重新生成。已应用补丁的备份存储在项目的 `.nova/backups/`。

## 5. 运行检查

```json
{
  "type": "checks.run",
  "requestId": "uuid",
  "scripts": ["typecheck", "test", "build"]
}
```

浏览器只能从固定枚举中选择，不得提供命令或参数。
