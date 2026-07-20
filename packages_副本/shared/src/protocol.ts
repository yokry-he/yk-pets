/**
 * 文件职责 / File responsibility
 * 定义 Side Panel 与 Local Agent 的 WebSocket 协议。
 * Defines the WebSocket protocol between the Side Panel and Local Agent.
 */
import { z } from 'zod'
import type { AuditIssue } from './audit'

export const AGENT_PROTOCOL_VERSION = 1

export interface ProjectInfo {
  root: string
  name: string
  packageManager: 'pnpm' | 'npm' | 'yarn' | 'bun' | 'unknown'
  framework: string
  scripts: string[]
  protocolVersion: number
}

export interface SourceCandidate {
  filePath: string
  score: number
  matchedTerms: string[]
}

export interface PatchProposal {
  id: string
  issueId: string
  issueCode: string
  filePath: string | null
  confidence: number
  reason: string
  canApply: boolean
  applied: boolean
  before: string | null
  after: string | null
  diff: string | null
  candidates: SourceCandidate[]
  createdAt: string
}

export interface CheckResult {
  script: string
  success: boolean
  exitCode: number | null
  durationMs: number
  output: string
}

export const ClientEnvelopeSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('hello'),
    requestId: z.string().min(1),
    token: z.string().min(1),
  }),
  z.object({
    type: z.literal('project.info'),
    requestId: z.string().min(1),
  }),
  z.object({
    type: z.literal('patch.generate'),
    requestId: z.string().min(1),
    issue: z.custom<AuditIssue>(),
    pageUrl: z.string().url(),
  }),
  z.object({
    type: z.literal('patch.apply'),
    requestId: z.string().min(1),
    patchId: z.string().min(1),
  }),
  z.object({
    type: z.literal('patch.rollback'),
    requestId: z.string().min(1),
    patchId: z.string().min(1),
  }),
  z.object({
    type: z.literal('checks.run'),
    requestId: z.string().min(1),
    scripts: z.array(z.enum(['typecheck', 'test', 'build'])).min(1).max(3),
  }),
])

export type AgentClientEnvelope = z.infer<typeof ClientEnvelopeSchema>

export type AgentServerEnvelope =
  | {
      type: 'result'
      requestId: string
      payload: unknown
    }
  | {
      type: 'error'
      requestId: string
      error: {
        code: string
        message: string
      }
    }
  | {
      type: 'event'
      event: 'agent.ready' | 'patch.applied' | 'patch.rolled-back' | 'checks.finished'
      payload: unknown
    }
