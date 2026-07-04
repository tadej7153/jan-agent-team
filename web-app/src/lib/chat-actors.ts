import { localStorageKey } from '@/constants/localStorage'
import type { AgentProfile, AgentTeam } from '@/hooks/useAgentTeams'

export type ChatActorSelection =
  | { type: 'none'; id?: undefined }
  | { type: 'assistant'; id: string }
  | { type: 'agent'; id: string }
  | { type: 'team'; id: string }

export const noneChatActor: ChatActorSelection = { type: 'none' }

export function assistantActor(id?: string): ChatActorSelection {
  return id ? { type: 'assistant', id } : noneChatActor
}

export function normalizeChatActor(
  actor?: ChatActorSelection,
  legacyAssistantId?: string
): ChatActorSelection {
  if (actor?.type === 'assistant' && actor.id) return actor
  if (actor?.type === 'agent' && actor.id) return actor
  if (actor?.type === 'team' && actor.id) return actor
  if (legacyAssistantId) return { type: 'assistant', id: legacyAssistantId }
  return noneChatActor
}

export function isSameChatActor(
  left: ChatActorSelection,
  right: ChatActorSelection
) {
  return left.type === right.type && left.id === right.id
}

export function getDefaultChatActor(): ChatActorSelection | undefined {
  try {
    const raw = localStorage.getItem(localStorageKey.defaultChatActor)
    if (!raw) return undefined
    return normalizeChatActor(JSON.parse(raw) as ChatActorSelection)
  } catch (error) {
    console.debug('Failed to read default chat actor:', error)
    return undefined
  }
}

export function setDefaultChatActor(actor?: ChatActorSelection) {
  try {
    const normalized = normalizeChatActor(actor)
    if (normalized.type === 'none') {
      localStorage.removeItem(localStorageKey.defaultChatActor)
      return
    }
    localStorage.setItem(
      localStorageKey.defaultChatActor,
      JSON.stringify(normalized)
    )
  } catch (error) {
    console.debug('Failed to persist default chat actor:', error)
  }
}

export function getChatActorLabel(
  actor: ChatActorSelection,
  assistants: Assistant[],
  agents: AgentProfile[],
  teams: AgentTeam[],
  fallback = 'None'
) {
  if (actor.type === 'assistant') {
    return assistants.find((assistant) => assistant.id === actor.id)?.name ?? fallback
  }
  if (actor.type === 'agent') {
    return agents.find((agent) => agent.id === actor.id)?.name ?? fallback
  }
  if (actor.type === 'team') {
    return teams.find((team) => team.id === actor.id)?.name ?? fallback
  }
  return fallback
}
