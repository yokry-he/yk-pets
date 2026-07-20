# NOVA Local Agent WebSocket Protocol

Protocol version: `1`

Default address:

```text
ws://127.0.0.1:4736
```

## 1. Envelope

Each request contains:

```ts
interface ClientEnvelope {
  type: string
  requestId: string
}
```

Successful response:

```json
{
  "type": "result",
  "requestId": "uuid",
  "payload": {}
}
```

Error response:

```json
{
  "type": "error",
  "requestId": "uuid",
  "error": {
    "code": "REQUEST_FAILED",
    "message": "Human-readable error description"
  }
}
```

## 2. Authentication

Immediately after opening the WebSocket, the client must send:

```json
{
  "type": "hello",
  "requestId": "uuid",
  "token": "Connection token printed by the CLI"
}
```

On success, the Agent returns `ProjectInfo`:

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

## 3. Generate a patch

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

The response is a `PatchProposal`. A value of `canApply=false` means that the Agent found only candidates or could not modify the source safely.

## 4. Apply and roll back

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

Patch proposals remain in Agent process memory. After an Agent restart, they must be generated again. Backups for applied patches are stored in `.nova/backups/` inside the project.

## 5. Run checks

```json
{
  "type": "checks.run",
  "requestId": "uuid",
  "scripts": ["typecheck", "test", "build"]
}
```

The browser may choose only from the fixed enumeration. It cannot provide commands or command-line arguments.
