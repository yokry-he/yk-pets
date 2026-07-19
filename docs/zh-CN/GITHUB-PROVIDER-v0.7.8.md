# GitHub Provider v0.7.8

`GitHubProvider` 只接受 `yk-pets.github-provider/v1` 固定命令：读取 PR、Checks、Review Threads、Reviews，以及重试失败 Checks、回复/Resolve 线程、Merge、关闭 PR 和删除精确分支。

宿主必须配置 `allowedRepositories`。所有返回值会重新校验仓库、PR 编号、Head SHA、分支、资源 ID、HTTPS URL 和时间戳。Provider 不接收任意 API 路径、GraphQL 文本、Shell 命令或页面提供的凭据。

实际网络调用由受信任宿主注入 `GitHubProviderInvoker`。页面和 Content Script 只能发送业务级固定消息。
