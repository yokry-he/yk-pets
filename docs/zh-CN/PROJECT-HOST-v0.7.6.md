# Background / CI Workspace Host v0.7.6

`yk-pets.workspace-host/v1` 只有四种命令：

- `workspace:get-revision`
- `workspace:read`
- `workspace:write`
- `workspace:delete`

不存在 Shell、动态方法、任意脚本执行、目录遍历、重命名宿主命令或通用文件系统 API。移动操作由事务层使用“目标 CAS 写入 + 源 CAS 删除”组成。

Background Host 必须根据扩展发送者、项目绑定和当前会话执行 `authorize`；CI Host 必须把项目 ID 固定到当前 Checkout。两端都应设置内容上限和请求超时。
