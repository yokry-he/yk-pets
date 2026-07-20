# NOVA Browser Agent v0.6.3

## 中文

- 修复规则编辑器对 Vue Proxy 直接执行 `structuredClone` 导致的 `DataCloneError`。
- 修复 TresJS ready 载荷类型不稳定导致的 `setClearColor is not a function`。
- 新增规则不再被旧草稿静默覆盖，草稿改为显式恢复，编辑器异常会显示可返回的错误界面。
- 手动新增和基于请求生成两条规则路径增加真实状态机回归测试。
- 重复点击当前动作不重启；点击不同动作会经过 240ms 中性过渡后打断。
- 鼠标悬停完全不触发动作，进行中动作同时隔离鼠标视线输入和悬停缩放。
- 18 个保留动作的持续时间均延长；云朵午睡改为 18 秒平躺。
- 每个动作新增独立 Web Audio 音效与对应中文思考气泡。

## English

- Fixed `DataCloneError` caused by applying `structuredClone` directly to a Vue rule-editor proxy.
- Fixed `setClearColor is not a function` caused by assuming an unstable TresJS ready payload was a renderer.
- New rules no longer silently load stale drafts. Draft restoration is explicit, and editor failures render a recoverable error view.
- Added real state-machine regressions for manual rule creation and request-derived rule creation.
- Re-selecting the active motion is ignored; selecting another motion interrupts through a 240ms neutral transition.
- Hover never triggers a behavior. Active motions also isolate pointer gaze and hover scaling.
- All 18 retained motions are longer, with Cloud Nap rebuilt as an 18-second flat lying pose.
- Every motion now triggers a distinct local Web Audio pattern and a matching Chinese thought bubble.
