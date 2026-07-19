# YK Pets v0.7.5 验证报告

## 结论

v0.7.5 源码映射与深度分析层通过当前工作区的完整发布门禁，可以作为 v0.7.4 的增量版本合并。

## 自动化结果

- TypeScript SDK 包：13 个，全部构建成功；
- 自动测试：144/144 通过；
- v0.7.5 新增测试：56 项；
  - CDP 只读桥接：12 项；
  - DOM / Vue / Source Map：15 项；
  - Lighthouse / Playwright 验证编排：15 项；
  - 结构化变更报告：11 项；
  - 扩展深度分析延迟入口：3 项；
- ESM、类型声明、Source Map、Declaration Map：13/13 生成；
- npm Tarball：13/13 生成；
- 全新临时项目离线安装：通过；
- 统一入口关键导出：13/13；
- 安装审计：0 vulnerabilities；
- 浏览器扩展稳定基线：0.6.10，未升级。

## 安全门禁

- `Runtime.evaluate`、`Runtime.callFunctionOn` 与脚本执行永久禁止；
- DOM 写入、输入模拟、导航、下载、Cookie、响应体和脚本注入永久禁止；
- CDP 会话绑定单一 Tab 与 Origin，并执行命令预算、超时和脱敏；
- Playwright 场景只接受声明式安全步骤，不存在 `evaluate`；
- 表单输入必须显式设置 `allowFormInput`；
- URL 断言不得离开目标 Origin；
- `deep-analysis` 仅在实际调用且站点 `auditEnabled` 时延迟加载。

## 功能覆盖

- Vue 2 / Vue 3 Runtime ownership；
- `data-v-inspector`、`data-vue-source`；
- 标准与 Indexed Source Map v3；
- Lighthouse 分数、指标与必过 Audit 比较；
- Playwright 场景、断言、Console Error 与 Page Error 回归；
- `yk-pets.change-report/v1` JSON / Markdown、问题去重、源码候选、修改、回滚和验证摘要。

## 验证边界

当前源码包是平台 SDK，不包含用户原始浏览器扩展仓库、真实目标站点、Chrome 调试授权、Lighthouse 二进制或 Playwright 浏览器。因此本报告验证的是：

- Adapter 协议、参数验证、超时和比较逻辑；
- 模拟宿主下的端到端数据流；
- npm 构建、打包和离线安装。

未声称已经对真实站点执行 Lighthouse 或 Playwright。实际接入应在原扩展 Background / Service Worker 与 CI 环境中实现相应 Adapter 后运行。

## 增量补丁验证

- v0.7.4 → v0.7.5 Git Patch 已生成；
- `git apply --check`：通过；
- Patch 应用后与过滤后的 v0.7.5 源码目录逐文件等价：通过；
- 本阶段无删除文件。
