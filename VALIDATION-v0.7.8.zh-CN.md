# YK Pets v0.7.8 验证报告

## 范围

本次验证覆盖 28 个 TypeScript SDK、337 项自动测试、统一入口导出、离线 npm 安装、Git Patch 应用与源码树等价检查。

## 远程协作验证

- Provider 仓库允许列表和固定命令范围。
- PR 前后双读及采集期间状态漂移拒绝。
- Check、Review Thread、Review 返回值结构与作用域校验。
- 失败 Check 精确重试，不重试成功或运行中的 Check。
- Review 计划 Head、快照摘要和最新评论 ID 绑定。
- Reply 成功但 Resolve 失败时返回明确 `partial`。
- Merge Gate 的 Draft、状态、冲突、时效、Head、必需 Check、Review、线程和审批规则。
- Merge Method 与一次性审批绑定。
- 合并后远端分支和本地 Worktree 清理，以及部分失败报告。
- 非规范 base64url Token 拒绝。

## 环境边界

验证使用内存 GitHub Host 与严格命令模拟器，没有用户真实 GitHub Token、线上仓库或生产 PR，因此没有声称创建、重试、回复、合并或删除任何真实线上资源。真实网络调用需要由受信任 Background、本地 Agent Host 或 CI Host 实现 `GitHubProviderInvoker`。

## 结果

- 构建：通过。
- 测试：337/337 通过。
- SDK 包：28 个。
- 统一导出：28/28。
- 离线安装：通过。
- npm 安装审计：0 vulnerabilities。
- 浏览器扩展稳定基线：0.6.10。


## 增量交付验证

- v0.7.7 → v0.7.8 变更文件：84。
- 新增文件：43；修改文件：41；删除文件：0。
- `git diff --check`：通过。
- 全新 v0.7.7 基线执行 `git apply --check`：通过。
- 实际应用 Patch 后，过滤源码树逐文件等价：通过。
- Patch 排除 `.git`、`node_modules`、`artifacts`、包级 `dist`、生成的 tarball 与 TypeScript build info；`dist` 可通过 `npm run build` 重建，并包含于完整源码包和 SDK 包。
