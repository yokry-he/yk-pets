# YK Pets v0.7.4 → v0.7.5 迁移指南

v0.7.5 是增量升级，不要求修改浏览器扩展 Manifest 版本；稳定基线仍为 `0.6.10`。

## 推荐接入顺序

1. 合并四个新包和工作区配置：
   - `@yk-pets/pet-devtools-bridge`
   - `@yk-pets/pet-source-mapper`
   - `@yk-pets/pet-verification-runner`
   - `@yk-pets/pet-change-report`
2. 在 Background / Service Worker 中封装 `chrome.debugger`，只把 `ChromeDebuggerTransport` 与显式授权的 Tab、Origin 交给分析模块。
3. Content Script 只采集稳定 Selector、Vue ownership 与 Inspector 元数据；不要向页面注入任意脚本。
4. 从构建产物或受信任的开发服务器读取 Source Map，并通过 `SourceMapRegistry.register()` 显式注册。
5. 为 Lighthouse 与 Playwright 实现宿主 Adapter；Playwright Adapter 只执行 `SafePlaywrightScenario` 中声明的步骤。
6. 使用 `VerificationRunner` 保存修复前、修复后快照，并用项目阈值生成比较结果。
7. 使用 `ChangeReportBuilder` 汇总审计问题、源码定位、改动、验证与回滚说明。
8. 在 `ExtensionPetRuntime` 中配置 `loadAnalysisFeature`，让深度分析保持独立 Chunk：

```ts
const runtime = new ExtensionPetRuntime({
  // 原有 renderer / policy 配置省略
  loadAnalysisFeature: async () => import('./features/deep-analysis.js'),
})
```

Side Panel 或受控消息通道可以发送：

```ts
{ type: 'analysis:run', context: { selector: '#save-button' } }
```

## 权限建议

- `chrome.debugger` 必须由明确的用户动作触发；
- 每次会话绑定单一 Tab 与 Origin；
- 默认使用 `DEFAULT_ALLOWED_CDP_METHODS`；
- 不把 `Runtime.evaluate`、`Input.*`、`Page.navigate` 或 Cookie/响应体接口加入扩展权限模型；
- 深度分析继续服从站点的 `auditEnabled` 策略。

## 回滚

删除 `loadAnalysisFeature` 和 `analysis:run` 调用即可恢复 v0.7.4 的运行路径。四个新包均为增量模块，不会改变原有渲染与站点策略 API。
