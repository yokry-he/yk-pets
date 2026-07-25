# AI 开发路线图

每个阶段的功能提交必须同步更新 AI 交接包、运行完整 CI、全绿后更新 PR，未经明确要求不得合并。

## 阶段 A：语义 Rig 与关键帧领域

- 状态：Complete
- 已完成稳定语义通道、毫秒/FPS、schema v2、规范化、`step`/`linear`、循环时间、无 UI 求值器和 v1→v2 迁移。
- 仍需真实浏览器迁移人工验收。

## 阶段 B：时间轴编辑与正式预览

- 状态：Complete; manual browser/WebGL acceptance required
- 已完成独立草稿与撤销重做、播放指针和控制、关键帧增删复制粘贴移动多选、规范化冲突处理、每帧一次求值、完整语义适配器、程序化通道保留、保存和无道具自定义动作播放。
- 只使用 `step` 与 `linear`；高级曲线留到阶段 E。

## 阶段 C：道具事件轨道

- 状态：Complete; manual WebGL acceptance required
- 已完成稳定道具/实例 ID、完整事件生命周期、挂点/世界空间、样式与粒子、缺失依赖诊断、同场景实例渲染，以及持物/抛出/接住/销毁测试。

## 阶段 D：道具工坊实体编辑

- 状态：Complete; manual browser/WebGL acceptance required
- 已完成 schema v2、旧数据迁移、九类参数化组件、层级和局部变换、材质、四个内部锚点、同场景预览、复制、JSON 导入导出和资源预算。

## 阶段 E：高级动画工具

- 状态：Complete; manual browser/audio/WebGL acceptance required
- 已完成平滑/贝塞尔、曲线编辑器、轻量洋葱皮和轨迹、镜像/预设、动作层/中断、两段 IK、本地音效，以及安全本地 GLB 校验与解析。

## 阶段 F：浏览器验收与发布加固

- 状态：Next
- 真实 Chrome/Side Panel/GPU/WebGL/音频/GLB 验收、截图基线、多分辨率回归和发布文档。

## 强制流程

1. 实时核对 AI 包、PR、HEAD 和 CI；
2. 功能代码与 AI 包同提交；
3. 更新测试和架构门禁；
4. 运行完整 CI；
5. 全绿后更新 PR；
6. 保留真实浏览器和 WebGL 人工验收边界。
