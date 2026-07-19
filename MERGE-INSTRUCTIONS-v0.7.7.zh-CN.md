# v0.7.7 合并说明

## 使用 Git Patch

```bash
git switch -c yk-pets/v0.7.7-repository-publish
git apply --check yk-pets-v0.7.7-merge.patch
git apply yk-pets-v0.7.7-merge.patch
npm install
npm run release:verify
```

Patch 以 v0.7.6 交付源码为基线。若仓库已自行修改相同文件，优先使用 merge-kit 中的覆盖层逐文件审查，不要强制应用。

## 使用合并工具包

1. 备份当前分支并确认工作树干净。
2. 阅读 `MIGRATION-v0.7.6-to-v0.7.7.zh-CN.md`。
3. 将 `overlay/` 覆盖到 v0.7.6 根目录。
4. 重新执行 `npm install`，因为根工作区新增 `@types/node`，真实本地 Host 要求 Node.js 22+。
5. 执行 `npm run release:verify`。
6. 在接入真实仓库前，显式配置 worktree 根目录与远端名称/URL 允许列表。

浏览器扩展 Manifest 稳定版本仍应为 0.6.10。
