# NOVA Browser Agent v0.6.5

## 中文

- 修复相对 Fetch URL 丢失当前网页端口、导致从请求复制的规则命中 0 次的问题。
- 规则网站范围现在按发起请求的网页来源判断，支持拦截该网页访问的跨域 API。
- Fetch 和 XHR 使用一致的页面来源匹配语义。
- 完整 Mock 命中后在真实网络调用前直接返回模拟响应。
- 新增拦截器配置回执和 Network Lab 同步状态提示，可区分“总开关已开”和“页面拦截器已应用规则”。

## English

- Fixed relative Fetch URLs losing the current page port, which left request-derived rules at zero hits.
- Rule site scope is now evaluated against the requesting page, allowing that page's cross-origin API calls to be intercepted.
- Fetch and XHR now share the same page-origin matching semantics.
- Full Mock responses return before the native network call.
- Added interceptor configuration acknowledgements and Network Lab synchronization status so an enabled switch is distinguishable from rules actually applied in the page.
