# Chrome Side Panel 任务工作台

## 信息架构

Side Panel 现在以当前页面任务为中心，提供五个一级工作区：

- **首页**：当前页面摘要与常用动作；
- **记忆**：Pet Memory 收件箱、待办和当前页面记忆；
- **审计**：Page Audit、问题定位和 Local Agent 补丁入口；
- **网络**：Network Lab、规则与 Mock；
- **云灵**：宠物工坊、导入外观、音色、3D 开关和闲时动作。

原来的宠物说明、音色、运行设置和 Studio 工具不再占据所有工作区顶部，而是集中在“云灵”。这些节点保留原事件处理器和存储逻辑，没有复制或重写 Local Agent、Network Lab 和外观导入调用链。

## 首页

首页只读取当前标签页和扩展本地存储，显示当前页面标题、规范化 URL、当前页面记忆数量、全部待办/进行中记忆数量、最近一次页面审计分数与问题数量，以及 Local Agent 当前连接状态。

首页提供开始审计、打开记忆、进入 Network Lab、配置云灵和打开 Agent 设置。按钮会触发现有 Side Panel 控件，而不是建立新的通信协议。

## 生命周期和隐私

- 状态更新来自标签页事件、`chrome.storage.onChanged`、运行时消息和现有 DOM 状态；
- 不使用 `setInterval` 或后台轮询；
- 不上传页面内容、记忆或配方；
- 不增加浏览器权限；
- 页面关闭时清理 MutationObserver、标签页、运行时消息和存储监听器；
- Network Lab、Local Agent 令牌与补丁安全边界保持不变。
