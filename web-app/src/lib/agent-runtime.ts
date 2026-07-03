import { invoke } from '@tauri-apps/api/core'
import type { AgentProfile, AgentTeam } from '@/hooks/useAgentTeams'

export type AgentMention = {
  agentId: string
  label: string
}

export type AgentRuntimeModelConfig = {
  provider: string
  model: string
  baseUrl: string
  apiKey?: string
  apiType?: 'openai' | 'anthropic'
  customHeaders?: Array<{ header: string; value: string }>
}

export type AgentRuntimeProfile = AgentProfile & {
  runtimeModel?: AgentRuntimeModelConfig
}

export type AgentRuntimeEvent =
  | { type: 'agent_message'; agentId: string; content: string; done?: boolean }
  | { type: 'summary'; agentId: string; content: string; done?: boolean }
  | { type: 'error'; message: string }

export type AgentRuntimeRequest = {
  threadId: string
  prompt: string
  team: AgentTeam
  agents: AgentRuntimeProfile[]
  mention?: AgentMention
  history: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
    agentId?: string
  }>
  runtimeModel?: AgentRuntimeModelConfig
}

const AG2_RUNTIME_URL_KEY = 'ag2-runtime-url'
const DEFAULT_AG2_RUNTIME_URL = 'http://127.0.0.1:8765/v1/agent-team/runs'

export function getAg2RuntimeUrl() {
  return localStorage.getItem(AG2_RUNTIME_URL_KEY) || DEFAULT_AG2_RUNTIME_URL
}

export function setAg2RuntimeUrl(url: string) {
  localStorage.setItem(AG2_RUNTIME_URL_KEY, url)
}

export function parseAgentMention(
  text: string,
  agents: AgentProfile[]
): AgentMention | undefined {
  const trimmed = text.trimStart()
  for (const agent of agents) {
    const handles = [`@${agent.name}`, `@${agent.id}`]
    if (handles.some((handle) => trimmed.toLowerCase().startsWith(handle.toLowerCase()))) {
      return { agentId: agent.id, label: agent.name }
    }
  }
  return undefined
}

export function stripAgentMention(text: string, mention?: AgentMention) {
  if (!mention) return text
  return text
    .replace(
      new RegExp(
        `^\\s*@(${escapeRegExp(mention.label)}|${escapeRegExp(mention.agentId)})(?=\\s|$)`,
        'i'
      ),
      ''
    )
    .trimStart()
}

export async function runAgentTeam(
  request: AgentRuntimeRequest,
  onEvent: (event: AgentRuntimeEvent) => void,
  signal?: AbortSignal
) {
  const runtimeUrl = getAg2RuntimeUrl()
  await ensureLocalAgentRuntime(runtimeUrl)

  const response = await fetch(runtimeUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'text/event-stream, application/x-ndjson, application/json',
    },
    body: JSON.stringify(request),
    signal,
  })

  if (!response.ok) {
    throw new Error(`Agent runtime 返回 HTTP ${response.status}`)
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!response.body || contentType.includes('application/json')) {
    const payload = await response.json()
    for (const event of normalizeRuntimePayload(payload)) onEvent(event)
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed === 'data: [DONE]') continue
      const data = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed
      try {
        onEvent(normalizeRuntimeEvent(JSON.parse(data)))
      } catch (error) {
        console.warn('Failed to parse AG2 runtime event', error)
      }
    }
  }
}

async function ensureLocalAgentRuntime(runtimeUrl: string) {
  if (!isTauriRuntime() || !isLocalRuntimeUrl(runtimeUrl)) return
  try {
    await invoke('ensure_agent_runtime')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Agent runtime 未启动或启动失败，请检查 API 配置、网络或应用日志。${message}`)
  }
}

function isTauriRuntime() {
  return (
    typeof window !== 'undefined' &&
    typeof (window as Window & { __TAURI_INTERNALS__?: unknown })
      .__TAURI_INTERNALS__ !== 'undefined'
  )
}

function isLocalRuntimeUrl(value: string) {
  try {
    const url = new URL(value)
    return url.hostname === '127.0.0.1' || url.hostname === 'localhost'
  } catch {
    return false
  }
}

function normalizeRuntimePayload(payload: unknown): AgentRuntimeEvent[] {
  if (Array.isArray(payload)) return payload.map(normalizeRuntimeEvent)
  if (payload && typeof payload === 'object' && 'events' in payload) {
    const events = (payload as { events?: unknown }).events
    if (Array.isArray(events)) return events.map(normalizeRuntimeEvent)
  }
  return [normalizeRuntimeEvent(payload)]
}

function normalizeRuntimeEvent(payload: unknown): AgentRuntimeEvent {
  if (!payload || typeof payload !== 'object') {
    return { type: 'error', message: 'Invalid AG2 runtime event' }
  }
  const event = payload as Record<string, unknown>
  const type = event.type === 'summary' ? 'summary' : event.type === 'error' ? 'error' : 'agent_message'
  if (type === 'error') {
    return { type, message: String(event.message ?? 'AG2 runtime error') }
  }
  return {
    type,
    agentId: String(event.agentId ?? event.agent_id ?? ''),
    content: String(event.content ?? event.text ?? ''),
    done: Boolean(event.done),
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
