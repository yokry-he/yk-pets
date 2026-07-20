# YK-PETS 当前项目状态

## 当前基线

- 稳定参照：`v0.6.10`；
- 本次开发分支：`agent/yk-pets-rebrand-v0610`；
- 产品品牌：`YK-PETS`；
- 当前默认宠物：云灵（Zeph）；
- 当前宠物物种：云狐（Cloud Fox）；
- 主要交付：Chrome/Edge Manifest V3 浏览器扩展与本地 WebSocket Agent；
- 当前阶段：品牌迁移、宠物身份建模和后续多宠物平台化准备。

## 已完成的品牌迁移

- 扩展清单、浏览器按钮、Side Panel 标题和主文档使用 YK-PETS；
- 根项目包名改为 `yk-pets`；
- Local Agent 主命令改为 `yk-pets-agent`；
- 新配置目录为 `.yk-pets/`；
- 新增 `PetIdentity`，独立保存宠物 ID、物种 ID、中英文物种名和中英文宠物名；
- 默认身份为 `ZEPH_CLOUD_FOX_IDENTITY`；
- 新领域类型使用 `YkPet*` / `YkPets*`；
- 增加品牌与身份自动回归检查。

## v0.6.10 兼容策略

为避免升级破坏，下列旧技术标识暂时保留：

- `Nova*` 类型作为弃用别名；
- `NOVA_*` Wire Message 作为现有扩展通信值；
- `@nova/*` 私有 Workspace scope；
- `nova:*` Storage Key，与 `yk-pets:*` 双向镜像；
- `.nova/agent.json`，会自动迁移到 `.yk-pets/agent.json`；
- `nova-agent` 命令别名。

这些标识只承担兼容职责，用户可见界面和新功能不得继续使用 NOVA 作为品牌或宠物名字。

## 当前工作原则

- 产品品牌、宠物物种和宠物名字必须独立建模；
- Domain 层不依赖 Vue、Chrome API、DOM 或具体 Agent Provider；
- 修复必须覆盖真实运行链路，不能只调整界面表现；
- 保持现有规则、消息和本地数据向后兼容；
- 页面刷新、扩展重载和 Side Panel 重开后的状态必须可预测；
- 新宠物必须通过注册定义接入，不能把物种专属动作继续写进通用核心。

## 现有稳定能力

- 3D 云狐云灵的动作、拖拽、菜单和可切换音色；
- 页面审计、规则独立选择、问题定位和可撤销预览；
- Fetch/XHR 采集、Mock、延迟和完整 JSON 响应修改；
- Token 认证的本地 WebSocket Agent；
- SHA-256 并发修改保护、显式确认、验证和回滚；
- 类型检查、专项回归脚本和生产构建门禁。

## 下一阶段方向

1. 将宠物状态机、动作调度和闲时策略提取为框架无关的 `pet-core`；
2. 将云灵实现为第一个 `PetDefinition`，而不是固定写死的唯一角色；
3. 增加第二个宠物验证注册和能力降级设计；
4. 提供普通 JavaScript API 与 `<yk-pet>` Web Component；
5. 再增加 React、Vue、Svelte 等薄适配层。
