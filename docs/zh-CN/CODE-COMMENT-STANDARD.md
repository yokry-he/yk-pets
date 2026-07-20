# 代码注释规范

本规范要求所有手写核心源文件使用中英双语注释。

## 基本格式

```ts
/**
 * 将页面请求快照转换为可展示的性能摘要。
 * Converts page request snapshots into a presentable performance summary.
 */
```

```ts
// Mock 命中后不得调用原始 fetch。 / Never call the original fetch after a Mock match.
```

```vue
<!-- Mock 响应配置 / Mock response configuration -->
```

```css
/* 规则编辑器操作区 / Rule editor action area */
```

## 必须说明的内容

- 文件职责；
- 分层边界；
- 状态分组；
- 生命周期；
- 规则排序和冲突；
- 安全与脱敏；
- 跨世界消息；
- 动画阶段；
- 错误恢复；
- 复杂模板和样式区。

## 维护要求

代码行为改变时，同步修改注释。禁止保留与当前实现不一致的历史说明。
