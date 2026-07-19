# v0.7.8 合并说明

## Overlay 合并

将 Merge Kit 的 `overlay/` 覆盖到 v0.7.7 源码根目录，然后执行：

```bash
npm install --ignore-scripts
npm run release:verify
```

## Git Patch 合并

```bash
git apply --check yk-pets-merge.patch
git apply yk-pets-merge.patch
npm install --ignore-scripts
npm run release:verify
```

Patch 不包含 `node_modules`、`artifacts`、包级 `dist`、生成的 tarball、TypeScript build info 和临时日志；包级 `dist` 由 `npm run build` 重建。合并前应确认工作树洁净，并备份本地未提交修改。
