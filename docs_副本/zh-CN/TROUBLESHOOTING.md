# 故障排查手册

## 1. 宠物没有显示

1. 确认页面是普通 `http://` 或 `https://` 页面。
2. 扩展商店、`chrome://`、浏览器新标签页等受限页面不能注入。
3. 在 `chrome://extensions` 检查扩展错误。
4. 重载扩展后刷新目标标签页。
5. 检查是否被页面的全屏层或极高 z-index 覆盖。

## 2. Side Panel 无法连接当前页面

旧标签页不会自动获得重载后的 Content Script。刷新页面。仍失败时：

- 确认当前标签页是 HTTP/HTTPS；
- 关闭并重新打开 Side Panel；
- 查看扩展 Service Worker 日志；
- 确认 host permissions 未被用户限制。

## 3. 网络开关开启但 Mock 不生效

按顺序检查：

1. 顶部 Origin 是否正确；
2. 总开关是否开启；
3. 单条规则是否开启；
4. HTTP 方法是否匹配；
5. Glob/正则是否匹配完整 URL 或路径；
6. Query 条件是否满足；
7. 竞争规则是否优先级更高；
8. 页面是否使用 Fetch/XHR，而不是 Service Worker、WebSocket 或 SSE；
9. 扩展重载后是否刷新页面。

使用规则编辑器的测试区域验证匹配。

## 4. 不存在接口仍然发出真实请求

说明完整 Mock 未命中。检查规则动作是否为“Mock”，而不是“修改响应”或“延迟”。确认规则测试选择的是当前规则。

## 5. XHR 页面行为异常

某些框架依赖 XHR 特定事件顺序。记录最小复现页面、请求方法、响应类型和事件监听方式。临时关闭该规则恢复真实请求，并在修复前避免全站宽泛规则。

## 6. 响应修改没有变化

- 响应是否为 JSON；
- 路径是否存在或允许创建；
- 数组索引是否正确；
- 是否有更高优先级 Mock 覆盖；
- 页面是否对响应做了二次转换。

## 7. 性能 Timing 显示为 0

跨域资源可能未开放详细计时。服务端需要适当的 Timing-Allow-Origin。缓存命中和浏览器隐私策略也可能使部分字段为 0。

## 8. 图表没有数据

1. 确认采集开关开启。
2. 刷新页面产生新资源请求。
3. 清除搜索和“只看慢请求”过滤。
4. 重载扩展后刷新页面。

## 9. Local Agent 连接失败

- Agent 进程是否运行；
- 地址是否为 `ws://127.0.0.1:<port>`；
- Token 是否与本次启动输出一致；
- CSP 是否仍允许 localhost WebSocket；
- 端口是否被占用；
- 企业安全软件是否拦截本机连接。

## 10. 构建失败

### 依赖安装失败

```bash
pnpm store prune
pnpm install --frozen-lockfile
```

检查代理、DNS 和 registry 设置。

### WXT 类型异常

```bash
rm -rf apps/extension/.wxt apps/extension/.output
pnpm --filter @nova/extension prepare
pnpm typecheck
```

### 构建仍使用旧代码

清理 `.output/.wxt`，完整重建，重载扩展并刷新页面。

## 11. Chrome Web Store 上传失败

- Manifest 版本必须提高；
- ZIP 顶层必须有 Manifest；
- 包内不能有非法文件或远程执行代码；
- 权限和隐私声明必须完整；
- 检查 Dashboard 的具体警告。
