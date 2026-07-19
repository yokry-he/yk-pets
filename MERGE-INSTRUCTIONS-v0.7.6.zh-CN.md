# YK Pets v0.7.6 合并说明

本增量以 v0.7.5 源码为基线。浏览器扩展稳定版本仍为 `0.6.10`。

## 方式一：应用 Git Patch

在干净的 v0.7.5 项目根目录执行：

```bash
git status --short
git apply --check yk-pets-v0.7.6-merge.patch
git apply yk-pets-v0.7.6-merge.patch
npm install --ignore-scripts
npm run release:verify
```

确认通过后，再使用项目自己的分支、提交和代码审查流程。不要在存在未提交修改的工作区直接应用补丁。

## 方式二：使用完整源码包

1. 解压 `yk-pets-v0.7.6-remediation-source.zip`。
2. 在独立目录执行 `npm install --ignore-scripts`。
3. 执行 `npm run release:verify`。
4. 将真实项目所需的包和扩展接入代码通过正常代码审查合并。

## SDK 离线安装

`yk-pets-v0.7.6-remediation-sdk.zip` 中包含 18 个 `.tgz`。应先安装各依赖包，最后安装 `@yk-pets/pet-platform-adaptive` 聚合包；也可以按照包内的依赖关系由 npm 一次安装全部本地 tarball。

## 接入检查清单

- HMAC 审批密钥只存在于可信 Background、本地 Agent 或 CI Secret 中。
- Content Script 和页面脚本不能签发审批令牌。
- `authorizeModification` 必须独立于 `auditEnabled`。
- Background/CI Host 只实现固定 `yk-pets.workspace-host/v1` 命令。
- 文件根目录必须固定，并在 Host 层再次拒绝路径穿越、符号链接和受保护目录。
- 真实写入前保存项目版本，写入后执行 lint、typecheck、test、build 与必要的 E2E。
- 验证失败时检查 `rolled-back` 或 `rollback-failed`；后者需要人工处理冲突，不能强制覆盖。
- UI、日志和遥测使用公开摘要，不直接记录审批令牌、源文件快照或完整回滚日志。

## 兼容性

- Node.js：`>=22.0.0`
- 平台 SDK：18 个包统一为 `0.7.6`
- 浏览器扩展稳定基线：`0.6.10`
- v0.7.5 的分析、源码映射和验证接口继续保留。
