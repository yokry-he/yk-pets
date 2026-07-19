# v0.7.4 按站点控制

## 策略字段

每个站点最终会解析为一份完整策略：

```ts
interface SitePolicy {
  mode: 'enabled' | 'paused' | 'hidden'
  renderer: 'auto' | '2d' | '3d'
  audioEnabled: boolean
  interactionsEnabled: boolean
  auditEnabled: boolean
}
```

`mode` 只控制宠物运行状态；`auditEnabled` 独立控制页面审计，因此可以隐藏宠物但仍保留 Side Panel 审计能力。

## 规则优先级

规则按以下顺序合并：

1. 默认策略；
2. 命中的低具体度规则；
3. 命中的高具体度规则；
4. 同具体度下更高 `priority` 的规则；
5. 当前会话临时覆盖。

支持示例：

- `<all_urls>`
- `*.example.com`
- `https://*.example.com/*`
- `https://app.example.com/dashboard/*`
- `http://localhost:4173/*`

## 持久化

```ts
import { SitePolicyManager, createChromeStorageAdapter } from '@yk-pets/pet-site-policy'

const policies = new SitePolicyManager(
  createChromeStorageAdapter(chrome.storage.local),
)
```

存储格式为 `yk-pets.site-policy/v1`，支持导出、导入和校验。

## Side Panel 操作建议

- “在此站点启用”：会话覆盖 `{ mode: 'enabled' }`；
- “暂停动画”：会话覆盖 `{ mode: 'paused' }`；
- “隐藏宠物”：会话覆盖 `{ mode: 'hidden' }`；
- “始终应用到此站点”：使用 Origin 持久规则；
- “使用轻量模式”：设置 `{ renderer: '2d' }`；
- “自动选择”：设置 `{ renderer: 'auto' }`。
