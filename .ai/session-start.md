# 新会话启动协议

继续开发 `yokry-he/yk-pets` 前，必须按以下顺序恢复事实，不得仅凭旧聊天记录开始修改。

## 1. 必须阅读

- `.ai/project-state.json`
- `.ai/session-start.md`
- `.ai/visual-cases.json`
- `docs/zh-CN/AI-DEVELOPMENT-HANDOFF.md`
- `docs/zh-CN/KNOWN-ISSUES.md`
- `docs/zh-CN/AI-DEVELOPMENT-ROADMAP.md`
- `docs/zh-CN/adr/` 中与当前任务相关的决策记录
- 对应英文文件，用于检查中英文含义是否一致

## 2. 必须实时核对

从 GitHub 实时确认：

- PR #7 是否仍为 Open、未合并；
- `agent/cloud-fox-studio-v0610` 当前 HEAD；
- 目标分支是否仍为 `agent/yk-pets-rebrand-v0610`；
- 最新一次完整 CI 的状态和覆盖步骤；
- 交接文档之后是否出现新提交；
- 当前代码是否仍符合机器状态和 ADR。

不得把交接文件中的历史 SHA 或 CI 记录当作实时状态。

## 3. 修改前必须向用户复述

在新会话首次修改代码前，先说明：

- 当前已经完成的能力；
- 明确尚未完成的能力；
- 本轮计划修改的文件和数据结构；
- 从编辑 UI 到领域层再到正式渲染器的消费链路；
- 自动验收和人工验收标准；
- 本轮明确不会修改的范围。

得到用户确认后再开始写代码。

## 4. 开发规则

- 只使用 `agent/cloud-fox-studio-v0610`；
- 不创建替代分支；
- 不合并 PR，除非用户明确要求；
- 每个独立批次运行完整 CI；
- 只有 CI 全绿后才更新 PR；
- 不虚构真实 Chrome、Side Panel、GPU 或 WebGL 人工验收；
- 不新增权限、上传、持续轮询、重复 WebSocket、宿主网页持久配置 DOM 或第二套 Cloud Fox 渲染器。

## 5. AI 交接包强制更新

从 `.ai/ENFORCEMENT_START` 所在提交之后：

- 每一个修改 `apps/` 或 `packages/` 功能源码的提交，必须在同一个提交中更新 `.ai/project-state.json`；
- 同一提交还必须更新至少一项交接上下文，例如本文件、视觉案例、交接文档、已知问题、开发路线图或 ADR；
- 不允许先提交功能代码，再通过后续无关提交补写交接包；
- `scripts/check-ai-handoff.mjs` 会在 PR CI 中按提交逐项检查。

## 6. 信息冲突时的可信度顺序

1. 实际代码和运行结果；
2. 最新完整 CI；
3. `.ai/project-state.json`；
4. 已接受 ADR 和交接文档；
5. PR 描述；
6. 旧聊天记录。

发现交接文档过时时，先明确指出，再在同一功能提交中修正。
