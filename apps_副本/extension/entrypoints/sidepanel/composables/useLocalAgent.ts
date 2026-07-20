/**
 * 文件职责 / File responsibility
 * 封装 Local Agent WebSocket 生命周期、协议消息和错误恢复。
 * Encapsulates Local Agent WebSocket lifecycle, protocol messages, and recovery.
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import type { AuditIssue } from '@nova/shared/audit'
import type {
  AgentClientEnvelope,
  AgentServerEnvelope,
  CheckResult,
  PatchProposal,
  ProjectInfo,
} from '@nova/shared/protocol'

type AgentClientInput = AgentClientEnvelope extends infer Envelope
  ? Envelope extends { requestId: string }
    ? Omit<Envelope, 'requestId'>
    : never
  : never

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  timeout: number
}

export function useLocalAgent() {
  const socket = ref<WebSocket | null>(null)
  const status = ref<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected')
  const error = ref('')
  const project = ref<ProjectInfo | null>(null)
  const proposal = ref<PatchProposal | null>(null)
  const checks = ref<CheckResult[]>([])
  const pending = new Map<string, PendingRequest>()

  const connected = computed(() => status.value === 'connected')

  async function connect(url: string, token: string) {
    disconnect()
    status.value = 'connecting'
    error.value = ''

    const ws = new WebSocket(url)
    socket.value = ws

    ws.addEventListener('message', onMessage)
    ws.addEventListener('close', () => {
      if (socket.value === ws) {
        status.value = 'disconnected'
        socket.value = null
      }
      rejectPending(new Error('本地 Agent 连接已关闭'))
    })
    ws.addEventListener('error', () => {
      error.value = '无法连接本地 Agent，请确认 CLI 已启动、地址正确且没有被防火墙阻止。'
      status.value = 'error'
    })

    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('连接超时')), 6000)
      ws.addEventListener('open', () => {
        window.clearTimeout(timeout)
        resolve()
      }, { once: true })
      ws.addEventListener('error', () => {
        window.clearTimeout(timeout)
        reject(new Error('WebSocket 连接失败'))
      }, { once: true })
    })

    try {
      project.value = await request<ProjectInfo>({ type: 'hello', token })
      status.value = 'connected'
    }
    catch (connectionError) {
      status.value = 'error'
      error.value = connectionError instanceof Error ? connectionError.message : String(connectionError)
      ws.close()
      throw connectionError
    }
  }

  function disconnect() {
    socket.value?.close()
    socket.value = null
    status.value = 'disconnected'
    project.value = null
    rejectPending(new Error('连接已断开'))
  }

  async function generatePatch(issue: AuditIssue, pageUrl: string) {
    proposal.value = await request<PatchProposal>({ type: 'patch.generate', issue, pageUrl })
    return proposal.value
  }

  async function applyPatch() {
    if (!proposal.value) throw new Error('请先生成补丁')
    proposal.value = await request<PatchProposal>({ type: 'patch.apply', patchId: proposal.value.id })
    return proposal.value
  }

  async function rollbackPatch() {
    if (!proposal.value) throw new Error('没有可回滚的补丁')
    proposal.value = await request<PatchProposal>({ type: 'patch.rollback', patchId: proposal.value.id })
    return proposal.value
  }

  async function runProjectChecks() {
    checks.value = await request<CheckResult[]>({ type: 'checks.run', scripts: ['typecheck', 'test', 'build'] })
    return checks.value
  }

  async function request<T>(input: AgentClientInput): Promise<T> {
    const ws = socket.value
    if (!ws || ws.readyState !== WebSocket.OPEN) throw new Error('本地 Agent 尚未连接')

    const requestId = crypto.randomUUID()
    const envelope = { ...input, requestId } as AgentClientEnvelope

    return await new Promise<T>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        pending.delete(requestId)
        reject(new Error('本地 Agent 响应超时'))
      }, 130_000)
      pending.set(requestId, {
        resolve: value => resolve(value as T),
        reject,
        timeout,
      })
      ws.send(JSON.stringify(envelope))
    })
  }

  function onMessage(event: MessageEvent<string>) {
    let envelope: AgentServerEnvelope
    try {
      envelope = JSON.parse(event.data) as AgentServerEnvelope
    }
    catch {
      return
    }

    if (envelope.type === 'event') return
    const entry = pending.get(envelope.requestId)
    if (!entry) return
    window.clearTimeout(entry.timeout)
    pending.delete(envelope.requestId)

    if (envelope.type === 'error') entry.reject(new Error(envelope.error.message))
    else entry.resolve(envelope.payload)
  }

  function rejectPending(reason: Error) {
    for (const [, entry] of pending) {
      window.clearTimeout(entry.timeout)
      entry.reject(reason)
    }
    pending.clear()
  }

  onBeforeUnmount(disconnect)

  return {
    status,
    error,
    project,
    proposal,
    checks,
    connected,
    connect,
    disconnect,
    generatePatch,
    applyPatch,
    rollbackPatch,
    runProjectChecks,
  }
}
