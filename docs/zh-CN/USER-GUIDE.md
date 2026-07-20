# YK-PETS Browser Agent 使用操作手册

> 适用基线：`v0.6.10` 平台化分支及后续兼容版本  
> 当前宠物：云灵（Zeph）  
> 当前物种：云狐（Cloud Fox）

## 1. 产品组成

YK-PETS 由三个协作部分组成：

| 部分 | 作用 | 是否必须 |
|---|---|---|
| Chrome/Edge 扩展 | 网页内云灵、页面审计、Network Lab、Side Panel | 必须 |
| YK-PETS Local Agent | 读取本地源码、生成补丁、运行检查、回滚 | 仅源码修改时需要 |
| Playground | 云灵演示、聊天与回归实验页 | 仅开发测试时需要 |

YK-PETS 是产品品牌；云灵是宠物名字；云狐是物种。

## 2. 安装扩展

### 2.1 从源码构建

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build:extension
```

在 Chrome 或 Edge 的扩展管理页开启开发者模式，然后加载：

```text
apps/extension/.output/chrome-mv3
```

### 2.2 创建发布包

```bash
pnpm zip:extension
```

压缩包位于：

```text
apps/extension/.output/yk-pets-0.6.10-chrome.zip
```

实际版本号以 Manifest 为准。

## 3. 第一次使用

1. 安装或重新加载扩展。
2. 刷新一个普通的 `http://` 或 `https://` 页面。
3. 等待网页右下角出现云灵。
4. 单击云灵打开功能菜单。
5. 双击云灵可以快速执行页面审计。
6. 点击浏览器工具栏中的 YK-PETS 图标打开 Side Panel。

扩展不会运行在 Chrome 内部页面、扩展商店或浏览器禁止注入的页面。

## 4. 云灵交互

| 交互 | 行为 |
|---|---|
| 单击 | 展开或收起功能菜单 |
| 双击 | 立即执行页面审计 |
| 右键 | 打开工程工具菜单 |
| 悬停 | 打招呼并跟随指针 |
| 拖拽 | 调整页面内位置 |
| 点击动作 | 播放动作和对应语音 |

云灵的角色身份为：

```text
petId: zeph
speciesId: cloud-fox
名字：云灵 / Zeph
物种：云狐 / Cloud Fox
```

## 5. 页面审计

1. 打开云灵的“功能”菜单或 Side Panel。
2. 选择需要执行的审计分类和子规则。
3. 点击“页面审计”。
4. 查看健康度、指标和问题列表。
5. 使用上一条、下一条或问题卡片定位元素。
6. 对支持的问题使用“预览修复”。
7. 预览只修改当前页面 DOM，不写入项目源码。
8. 使用“撤销预览”恢复原状。

如果未选择任何规则，审计不会开始。

## 6. Network Lab

Network Lab 支持：

- Fetch/XHR 请求采集；
- 资源类型和状态筛选；
- 请求延迟；
- Mock 状态码、响应头和响应体；
- 完整 JSON 响应替换；
- 从请求生成规则；
- 规则编辑、复制、启停和删除；
- 按站点控制网络能力。

Mock 和响应修改只影响当前浏览器页面，不会修改服务器数据。

## 7. 连接 Local Agent

在项目根目录执行：

```bash
pnpm dev:agent
```

或者在构建后的安装环境中执行：

```bash
yk-pets-agent dev --root /path/to/project
```

启动后会显示：

- WebSocket 地址；
- 连接口令；
- 项目名称；
- 检测到的框架和包管理器。

把地址和口令填入 Side Panel。Local Agent 默认只监听本机回环地址。

## 8. 源码补丁流程

```text
页面问题
  → 定位源码候选
  → 生成最小 Diff
  → 用户确认
  → 校验文件哈希
  → 创建备份
  → 写入源码
  → 运行检查
  → 保留或回滚
```

只有明确确认后才会写入。允许执行的项目脚本仅包括：

```text
typecheck
test
build
```

## 9. 数据迁移

### 扩展设置

YK-PETS 会把旧的：

```text
nova:*
```

迁移到：

```text
yk-pets:*
```

兼容周期内新旧键会双向镜像，避免旧组件丢失设置。

### Local Agent

新配置路径为：

```text
.yk-pets/agent.json
```

如果项目中只有：

```text
.nova/agent.json
```

Local Agent 会迁移原有 Token 和端口。两个目录都应被 Git 忽略。

### Playground

旧的 `nuxt-ai-pet-state-v1` 会迁移到：

```text
yk-pets:playground:pet-state:v2
```

迁移后会保留主题、亲密度、互动次数和隐藏模式状态。

## 10. 音色

当前预设包括：

- 星云外星人；
- 萌系少女；
- 萌宠伙伴；
- 静音。

浏览器可能要求用户先点击页面，才允许播放声音。切换音色后设置会持久化。

## 11. 常见检查命令

```bash
pnpm check:brand
pnpm typecheck
pnpm test
pnpm build
pnpm build:playground
```

`pnpm typecheck` 还会执行文档、品牌、宠物动作、审计、Network Lab 和音频相关回归门禁。

## 12. 卸载与清理

- 在浏览器扩展管理页删除 YK-PETS；
- 删除项目中的 `.yk-pets/` 可重置 Local Agent 口令；
- 清除浏览器扩展存储可重置 YK-PETS 设置；
- 清除 Playground 的 Local Storage 可重置亲密度和互动状态。

删除 `.yk-pets/agent.json` 后，下次启动会生成新的连接口令。
