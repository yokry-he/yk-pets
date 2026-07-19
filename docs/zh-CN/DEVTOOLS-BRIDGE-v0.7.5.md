# DevTools / CDP 只读桥接

`RestrictedCdpClient` 将 CDP 会话绑定到单一 `tabId + origin`，并在命令发送前执行三层检查：永久禁用列表、显式允许列表和方法级参数校验。

默认开放 DOM、CSS、Accessibility、Performance、Log、Runtime/Network 诊断事件。默认不开放：

- `Runtime.evaluate`、`callFunctionOn` 与脚本编译/执行；
- DOM 写入、文件输入与焦点控制；
- `Input.*`、导航、刷新、下载；
- Cookie、响应体、额外请求头和网络模拟；
- 页面初始化脚本注入。

每个会话还具备命令预算、单次超时、允许 Origin、事件容量和敏感数据脱敏。用户停止分析后必须调用 `detach()`。
