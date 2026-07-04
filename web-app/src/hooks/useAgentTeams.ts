import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { ulid } from 'ulidx'
import { localStorageKey } from '@/constants/localStorage'

export type AgentToolPermission = 'all' | 'selected' | 'none'

export type AgentSpeakerOrder =
  | 'round_robin'
  | 'manual'
  | 'auto'
  | 'random'
  | 'sequential'

export type AgentProfile = {
  id: string
  name: string
  avatar: string
  modelId?: string
  provider?: string
  systemPrompt: string
  toolPermission: AgentToolPermission
  description: string
  createdAt: number
  updatedAt: number
}

export type AgentTeam = {
  id: string
  name: string
  description: string
  memberIds: string[]
  speakerOrder: AgentSpeakerOrder
  maxRounds: number
  summarizerAgentId?: string
  allowMentions: boolean
  createdAt: number
  updatedAt: number
}

export type ThreadAgentTeamBinding = {
  enabled: boolean
  teamId?: string
  agentId?: string
}

export const disabledThreadAgentTeamBinding: ThreadAgentTeamBinding = {
  enabled: false,
}

type AgentTeamsState = {
  agents: AgentProfile[]
  teams: AgentTeam[]
  threadBindings: Record<string, ThreadAgentTeamBinding>
  createAgent: (agent: Omit<AgentProfile, 'id' | 'createdAt' | 'updatedAt'>) => AgentProfile
  updateAgent: (id: string, updates: Partial<Omit<AgentProfile, 'id'>>) => void
  deleteAgent: (id: string) => void
  createTeam: (team: Omit<AgentTeam, 'id' | 'createdAt' | 'updatedAt'>) => AgentTeam
  updateTeam: (id: string, updates: Partial<Omit<AgentTeam, 'id'>>) => void
  deleteTeam: (id: string) => void
  getAgentById: (id?: string) => AgentProfile | undefined
  getTeamById: (id?: string) => AgentTeam | undefined
  getTeamMembers: (teamId?: string) => AgentProfile[]
  getThreadBinding: (threadId: string) => ThreadAgentTeamBinding
  setThreadBinding: (threadId: string, binding: ThreadAgentTeamBinding) => void
  removeThreadBinding: (threadId: string) => void
}

const now = () => Date.now()

const defaultAgents: AgentProfile[] = [
  {
    id: 'agent-planner',
    name: '规划员',
    avatar: '🧭',
    systemPrompt:
      '你是规划员。你的职责是澄清目标、拆解任务，并让团队始终聚焦在下一步最有价值的行动上。',
    toolPermission: 'selected',
    description: '拆解目标、安排步骤、控制范围。',
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'agent-builder',
    name: '执行员',
    avatar: '🛠️',
    systemPrompt:
      '你是执行员。你的职责是把计划转成具体实现方案，并说明关键取舍。',
    toolPermission: 'selected',
    description: '把计划转成实现方案和具体行动。',
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'agent-reviewer',
    name: '评审员',
    avatar: '🔎',
    systemPrompt:
      '你是评审员。你的职责是发现风险、缺失测试、潜在回归、不清晰假设和边界情况。',
    toolPermission: 'none',
    description: '检查质量、风险、边界情况和验证缺口。',
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'agent-summarizer',
    name: '总结员',
    avatar: '✍️',
    systemPrompt:
      '你是总结员。你的职责是在讨论结束后输出最终结论、各 Agent 观点、执行过程和下一步建议。',
    toolPermission: 'none',
    description: '在团队讨论后输出最终结论。',
    createdAt: now(),
    updatedAt: now(),
  },
]

const defaultTeams: AgentTeam[] = [
  {
    id: 'team-product-dev',
    name: '产品开发团队',
    description: '规划员、执行员、评审员依次讨论，最后由总结员给出结论。',
    memberIds: ['agent-planner', 'agent-builder', 'agent-reviewer', 'agent-summarizer'],
    speakerOrder: 'round_robin',
    maxRounds: 1,
    summarizerAgentId: 'agent-summarizer',
    allowMentions: true,
    createdAt: now(),
    updatedAt: now(),
  },
]

export const useAgentTeams = create<AgentTeamsState>()(
  persist(
    (set, get) => ({
      agents: defaultAgents,
      teams: defaultTeams,
      threadBindings: {},
      createAgent: (agent) => {
        const created: AgentProfile = {
          ...agent,
          id: ulid(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        set((state) => ({ agents: [...state.agents, created] }))
        return created
      },
      updateAgent: (id, updates) => {
        set((state) => ({
          agents: state.agents.map((agent) =>
            agent.id === id
              ? { ...agent, ...updates, updatedAt: Date.now() }
              : agent
          ),
        }))
      },
      deleteAgent: (id) => {
        set((state) => ({
          agents: state.agents.filter((agent) => agent.id !== id),
          teams: state.teams.map((team) => ({
            ...team,
            memberIds: team.memberIds.filter((memberId) => memberId !== id),
            summarizerAgentId:
              team.summarizerAgentId === id ? undefined : team.summarizerAgentId,
            updatedAt: Date.now(),
          })),
          threadBindings: Object.fromEntries(
            Object.entries(state.threadBindings).map(([threadId, binding]) => [
              threadId,
              binding.agentId === id ? { enabled: false } : binding,
            ])
          ),
        }))
      },
      createTeam: (team) => {
        const created: AgentTeam = {
          ...team,
          id: ulid(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        set((state) => ({ teams: [...state.teams, created] }))
        return created
      },
      updateTeam: (id, updates) => {
        set((state) => ({
          teams: state.teams.map((team) =>
            team.id === id
              ? { ...team, ...updates, updatedAt: Date.now() }
              : team
          ),
        }))
      },
      deleteTeam: (id) => {
        set((state) => {
          const threadBindings = { ...state.threadBindings }
          for (const [threadId, binding] of Object.entries(threadBindings)) {
            if (binding.teamId === id) {
              threadBindings[threadId] = { enabled: false }
            }
          }
          return {
            teams: state.teams.filter((team) => team.id !== id),
            threadBindings,
          }
        })
      },
      getAgentById: (id) => get().agents.find((agent) => agent.id === id),
      getTeamById: (id) => get().teams.find((team) => team.id === id),
      getTeamMembers: (teamId) => {
        const team = get().getTeamById(teamId)
        if (!team) return []
        return team.memberIds
          .map((id) => get().getAgentById(id))
          .filter((agent): agent is AgentProfile => Boolean(agent))
      },
      getThreadBinding: (threadId) =>
        get().threadBindings[threadId] ?? disabledThreadAgentTeamBinding,
      setThreadBinding: (threadId, binding) => {
        set((state) => ({
          threadBindings: {
            ...state.threadBindings,
            [threadId]: binding,
          },
        }))
      },
      removeThreadBinding: (threadId) => {
        set((state) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [threadId]: _removed, ...threadBindings } = state.threadBindings
          return { threadBindings }
        })
      },
    }),
    {
      name: localStorageKey.agentTeams,
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
)
