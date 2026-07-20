# NOVA Motion Upgrade v1.2.0

## 新增表现

- 说话期间嘴巴会根据回复时长持续张合。
- 开心、招手、跳跃和扑腾时会眯眼并出现脸颊红晕。
- 疑惑状态增加大小眼、歪头和嘴角倾斜。
- 新增一次性跳跃动作，包含起跳、空中拉伸和落地压缩。
- 新增前爪扑腾动作，身体、耳朵、尾巴和能量核心同步响应。
- 新增趴下动作，身体压低、头部前倾、前爪向前伸展。
- 修正前爪动画基准坐标，避免动作结束后前爪漂移到身体中央。
- 新增画布内动作控制条：招手、跳跃、扑腾、趴下。
- 对话 Agent 新增 `jumping`、`flapping`、`resting` 三种结构化动画指令。

## 可直接输入的测试指令

```text
给我打个招呼
跳一下
扑腾一下前爪
趴下休息
认真听我说
转个圈看看
```

## 主要修改文件

- `app/components/pet/CloudFox.vue`
- `app/components/pet/PetCanvas.vue`
- `app/pages/index.vue`
- `app/machines/pet.machine.ts`
- `app/types/pet.ts`
- `app/components/ui/ChatDock.vue`
- `app/assets/css/main.css`
- `server/api/pet-command.post.ts`

## 验证说明

最初的动作升级环境只完成了语法解析检查；当前 Monorepo 已重新执行并通过 `pnpm typecheck` 与 `pnpm build:playground`。项目锁文件和依赖版本未因动作升级而改变。
