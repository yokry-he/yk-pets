# NOVA Browser Agent v0.6.4

## 中文

- 彻底修复打开规则编辑器时的 `#<Object> could not be cloned` 错误。
- 网络规则、草稿和导航状态改用可递归解除 Vue Proxy 的 JSON 克隆。
- Network Lab 业务源码不再直接调用 `structuredClone`。
- 新回归测试使用与 Side Panel 一致的多层响应式 Proxy，同时覆盖手动新增和基于请求生成。
- Side Panel 底部现在显示真实版本 `0.6.4`，不再固定显示 `0.5.0`。

## English

- Fully fixed `#<Object> could not be cloned` while opening the rule editor.
- Network rules, drafts, and navigation state now use JSON cloning that recursively unwraps Vue proxies.
- Network Lab business source no longer calls `structuredClone` directly.
- The regression now uses nested reactive proxies matching the real Side Panel path and covers both creation entry points.
- The Side Panel footer now reports the actual `0.6.4` version instead of the stale `0.5.0` label.
