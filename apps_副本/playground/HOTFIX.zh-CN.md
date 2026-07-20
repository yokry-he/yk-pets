# 3D 画布空白修复

## 原因

`CloudFox.vue` 位于 `app/components/pet/` 下，但 `PetCanvas.vue` 使用了 `<CloudFox />`，没有显式导入。

在 Nuxt 的嵌套组件自动导入规则下，组件名称可能带目录前缀；同时 TresJS 会接管未解析的标签。因此浏览器把 `CloudFox` 当成 Three.js 构造器，产生：

- `CloudFox is not defined in THREE namespace`
- `Failed to resolve component: CloudFox`
- `TypeError: target is not a constructor`

## 修复

在 `app/components/pet/PetCanvas.vue` 中显式导入：

```ts
import CloudFox from './CloudFox.vue'
```

同时在 `app/pages/index.vue` 中显式导入聊天组件，避免相同的嵌套组件命名问题：

```ts
import ChatDock from '~/components/ui/ChatDock.vue'
```

修改后请停止旧的开发服务器，删除 Nuxt 缓存，再重新启动：

```bash
rm -rf .nuxt
pnpm dev
```
