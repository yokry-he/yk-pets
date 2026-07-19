# DOM → Vue 源码映射

源码定位按以下证据排序：

1. `data-v-inspector` / `data-vue-source` 显式位置；
2. Vue 2 `__vue__.$options.__file` 或 Vue 3 `__vueParentComponent.type.__file`；
3. 已注册 Source Map 对堆栈帧的解析结果；
4. 宿主提供的组件名注册表；
5. 已经指向 `.vue/.ts/.tsx/.js` 的直接堆栈帧。

`SourceLocator` 会去重候选、合并证据并给出 0–1 置信度。Source Map 不会自动联网下载，必须由宿主从可信构建产物显式注册。
