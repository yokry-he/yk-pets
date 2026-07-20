# YK-PETS 路线图

## 当前身份

```text
产品品牌：YK-PETS
默认宠物：云灵（Zeph）
默认物种：云狐（Cloud Fox）
```

## 0.6.10 品牌与身份迁移

- 扩展、Side Panel、CLI 和主文档改用 YK-PETS；
- 产品品牌、宠物名字和宠物物种独立建模；
- 新增 `PetIdentity` 与 `ZEPH_CLOUD_FOX_IDENTITY`；
- 新领域类型使用 `YkPet*` / `YkPets*`；
- `nova:*` 设置迁移到 `yk-pets:*` 并双向镜像；
- `.nova/agent.json` 迁移到 `.yk-pets/agent.json`；
- `yk-pets-agent` 成为主 CLI，旧命令保留兼容别名；
- 增加品牌与身份回归检查。

## 0.7 宠物核心运行时

- 提取框架无关的宠物状态、事件和生命周期；
- 提取动作优先级、打断、排队和闲时调度；
- 将通用意图与具体动画 ID 分离；
- 定义 `PetDefinition`、能力声明和动作降级；
- 将云灵迁移为第一个正式宠物定义；
- 不再让核心协议依赖云狐专属动作。

## 0.8 多宠物注册系统

- 实现宠物注册表与按需资源加载；
- 增加第二个真实宠物作为架构验收；
- 支持同物种多个名字和不同个性配置；
- 支持用户选择、切换和持久化当前宠物；
- 允许每个宠物提供独立主题、动作、音色和 2D 回退；
- 保持审计、网络和 Agent 状态不随宠物切换而丢失。

## 0.9 跨技术栈 Web SDK

- 提供 `createYkPet()` 普通 JavaScript API；
- 提供 `<yk-pet>` Web Component；
- 支持 ESM、按需加载和无框架使用；
- 提供 React、Vue、Nuxt、Next.js、Svelte 和 Astro 示例；
- 框架适配层只包装生命周期和类型，不复制核心逻辑；
- 提供 WebGL 不可用和低性能设备的 2D 回退。

## 1.0 产品发布

- Chrome Web Store 发布；
- Edge 正式支持和 Firefox 评估；
- Native Messaging 桌面 Agent；
- 稳定的 SDK 生命周期与语义化版本；
- 宠物资源包格式和第三方宠物开发文档；
- 团队策略、审计日志和权限治理；
- 移除已完成迁移的 NOVA 兼容别名。

## 平台化验收条件

YK-PETS 只有同时满足以下条件，才算完成多宠物平台化：

1. 云灵不再直接写死在通用核心中；
2. 至少两个宠物通过同一注册协议运行；
3. Web Component 可以在无 Vue/React 宿主中使用；
4. 切换宠物不影响审计、网络或 Agent 状态；
5. 新宠物无需修改核心动作联合类型即可接入；
6. 旧 `v0.6.10` 用户数据可以平滑升级。
