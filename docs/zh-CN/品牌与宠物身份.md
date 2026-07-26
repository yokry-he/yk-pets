# YK-PETS 品牌与宠物身份

## 1. 三个独立概念

YK-PETS 从 `v0.6.10` 平台化分支开始明确区分：

| 概念 | 当前值 | 稳定标识 |
|---|---|---|
| 产品品牌 | YK-PETS | `yk-pets` |
| 宠物物种 | 云狐 | `cloud-fox` |
| 宠物名字 | 云灵（Zeph） | `zeph` |

产品品牌不会随宠物变化。未来可以增加新的物种、同物种的不同名字，或者让用户切换宠物，而无需再次重命名产品。

## 2. 共享领域模型

`packages/shared/src/brand.ts` 是品牌和宠物身份的单一事实来源：

```ts
interface PetIdentity {
  id: string
  speciesId: string
  species: { 'zh-CN': string; en: string }
  name: { 'zh-CN': string; en: string }
}
```

当前默认身份为 `ZEPH_CLOUD_FOX_IDENTITY`。

## 3. 命名规则

- 产品界面、扩展清单、文档和主 CLI 使用 `YK-PETS`。
- 介绍宠物时使用“云灵（Zeph）”，介绍物种时使用“云狐（Cloud Fox）”。
- 不再把产品品牌当成宠物名字。
- 新动作可以是物种专属能力，但核心状态和产品协议不应依赖某个宠物名字。

## 4. v0.6.10 兼容边界

为了避免升级破坏，以下旧技术标识暂时保留一个兼容周期：

- `Nova*` TypeScript 类型通过弃用别名继续可用；
- `NOVA_*` 扩展 Wire Message 继续作为旧协议值；
- `@nova/*` 私有 Workspace scope 暂时不做破坏式迁移；
- `nova:*` Storage Key 与 `yk-pets:*` 双向镜像；
- `.nova/agent.json` 会迁移到 `.yk-pets/agent.json`；
- `nova-agent` 暂时作为 `yk-pets-agent` 的命令别名。

这些兼容项不属于用户可见品牌，也不应在新功能中继续扩散。

## 5. 新宠物接入要求

新增宠物至少需要声明：

1. 稳定的宠物 ID 和物种 ID；
2. 中英文物种名与宠物名；
3. 支持的通用状态和动作能力；
4. 不支持动作的降级策略；
5. 资源、音色和渲染器的按需加载入口。
