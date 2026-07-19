# Local Agent Git Host v0.7.7

`LocalGitRepositoryAdapter` is a real Node.js 22+ Git and workspace host with a fixed API. It invokes Git with `shell: false`, sanitizes the environment, rejects execution-capable repository configuration, confines worktrees, rejects symlinks, uses content-hash CAS, commits with `--no-verify`, and requires both an allowed remote name and exact normalized remote URL before push. The strict RPC channel is `yk-pets.repository-host/v1`.
