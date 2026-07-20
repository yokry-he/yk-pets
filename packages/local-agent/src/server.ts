/**
 * 文件职责 / File responsibility
 * 实现带 Token 认证的本机 WebSocket Agent 协议服务。
 * Implements the token-authenticated local WebSocket Agent protocol server.
 */
import { timingSafeEqual } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import { WebSocketServer, type WebSocket } from 'ws'
import { ClientEnvelopeSchema, type AgentServerEnvelope } from '@nova/shared/protocol'
import { readProjectInfo } from './project'
import { PatchManager } from './patcher'
import { runChecks } from './checks'

export interface AgentServerOptions {
  root: string
  port: number
  token: string
  allowedOrigins?: string[]
}

export function startAgentServer(options: AgentServerOptions): WebSocketServer {
  const patchManager = new PatchManager(options.root)
  const server = new WebSocketServer({ host: '127.0.0.1', port: options.port })

  server.on('connection', (socket, request) => {
    if (!isAllowedOrigin(request, options.allowedOrigins || [])) {
      socket.close(1008, 'Origin not allowed')
      return
    }

    let authenticated = false

    socket.on('message', async (raw) => {
      let requestId = 'unknown'
      try {
        const parsedJson: unknown = JSON.parse(raw.toString())
        const envelope = ClientEnvelopeSchema.parse(parsedJson)
        requestId = envelope.requestId

        if (envelope.type === 'hello') {
          if (!safeTokenEqual(envelope.token, options.token)) {
            sendError(socket, requestId, 'UNAUTHORIZED', '连接口令不正确')
            socket.close(1008, 'Unauthorized')
            return
          }
          authenticated = true
          sendResult(socket, requestId, await readProjectInfo(options.root))
          return
        }

        if (!authenticated) {
          sendError(socket, requestId, 'UNAUTHORIZED', '请先完成 hello 认证')
          return
        }

        switch (envelope.type) {
          case 'project.info':
            sendResult(socket, requestId, await readProjectInfo(options.root))
            break
          case 'patch.generate':
            sendResult(socket, requestId, await patchManager.generate(envelope.issue))
            break
          case 'patch.apply': {
            const proposal = await patchManager.apply(envelope.patchId)
            sendResult(socket, requestId, proposal)
            sendEvent(socket, 'patch.applied', proposal)
            break
          }
          case 'patch.rollback': {
            const proposal = await patchManager.rollback(envelope.patchId)
            sendResult(socket, requestId, proposal)
            sendEvent(socket, 'patch.rolled-back', proposal)
            break
          }
          case 'checks.run': {
            const results = await runChecks(options.root, envelope.scripts)
            sendResult(socket, requestId, results)
            sendEvent(socket, 'checks.finished', results)
            break
          }
        }
      }
      catch (error) {
        sendError(socket, requestId, 'REQUEST_FAILED', error instanceof Error ? error.message : '未知错误')
      }
    })
  })

  return server
}

function isAllowedOrigin(request: IncomingMessage, extraOrigins: string[]): boolean {
  const origin = request.headers.origin || ''
  if (!origin) return true
  return origin.startsWith('chrome-extension://')
    || origin.startsWith('moz-extension://')
    || origin.startsWith('http://localhost:')
    || origin.startsWith('http://127.0.0.1:')
    || extraOrigins.includes(origin)
}

function safeTokenEqual(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided)
  const expectedBuffer = Buffer.from(expected)
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer)
}

function sendResult(socket: WebSocket, requestId: string, payload: unknown) {
  send(socket, { type: 'result', requestId, payload })
}

function sendError(socket: WebSocket, requestId: string, code: string, message: string) {
  send(socket, { type: 'error', requestId, error: { code, message } })
}

function sendEvent(socket: WebSocket, event: Extract<AgentServerEnvelope, { type: 'event' }>['event'], payload: unknown) {
  send(socket, { type: 'event', event, payload })
}

function send(socket: WebSocket, envelope: AgentServerEnvelope) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(envelope))
}
