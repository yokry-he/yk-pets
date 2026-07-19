# YK Pets v0.7.5 增量合并说明

此增量以 v0.7.4 源码目录为基线，浏览器扩展 Manifest 稳定版本仍为 `0.6.10`。

## 方式一：覆盖增量文件

将 Merge Kit 中 `overlay/` 目录的内容覆盖到 v0.7.4 项目根目录。本次没有需要删除的源码文件。

然后执行：

```bash
npm install
npm run release:verify
```

## 方式二：应用 Git Patch

在干净的 v0.7.4 项目根目录执行：

```bash
git apply --check yk-pets-v0.7.5-merge.patch
git apply yk-pets-v0.7.5-merge.patch
npm install
npm run release:verify
```

## 合并后关键检查

- 根版本和 13 个包版本均为 `0.7.5`；
- `packages/pet-devtools-bridge`、`pet-source-mapper`、`pet-verification-runner`、`pet-change-report` 存在；
- `ExtensionPetRuntime` 包含 `loadAnalysisFeature`、`runAnalysis()` 和 `analysis:run`；
- `npm test` 显示 144/144 通过；
- `npm run smoke:packages` 显示 13/13 统一导出与 0 vulnerabilities；
- 原浏览器扩展 Manifest 版本仍为 `0.6.10`。

## 回滚

若尚未提交，使用版本控制恢复合并前状态。若已提交，整体 revert 本次增量提交。四个新增包和 `deep-analysis` 入口均为增量能力，不需要迁移已有站点策略数据。
