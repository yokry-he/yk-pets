# 本地 Agent Git Host v0.7.7

`LocalGitRepositoryAdapter` 是 Node.js 22+ 的真实 Git/文件宿主。它只实现固定接口，不接收任意命令文本。

安全边界：

- `spawn(gitPath, args, { shell: false })`，不拼接 Shell。
- 净化子进程环境，移除可劫持 Git/SSH 行为的变量。
- 拒绝 hooksPath、filter、fsmonitor、sshCommand、credential helper、include、URL rewrite 等危险配置。
- worktree 必须位于独立受控根目录中，并经 realpath 包含性校验。
- 文件 Adapter 拒绝符号链接、目录替换和路径逃逸，并执行 SHA-256 CAS。
- commit 使用 `--no-verify`，避免执行不受信任 Hook。
- push 必须同时通过远端名称与规范化 URL 允许列表；外部 remote helper 被拒绝。

`createRepositoryHostMessageHandler()` 可把相同能力包装为 `yk-pets.repository-host/v1` 固定 RPC。授权函数应按用户、项目、传输类型与命令逐次判断。
