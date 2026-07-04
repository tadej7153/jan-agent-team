import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  AgentSettingsPage,
  TeamSettingsPage,
} from '../AgentTeamsSettings'
import { useAgentTeams } from '@/hooks/useAgentTeams'

const navigateMock = vi.hoisted(() => vi.fn())
const useModelProviderMock = vi.hoisted(() => vi.fn())

Object.defineProperty(global, 'IS_MACOS', { value: true, writable: true })

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, className }: any) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  useNavigate: () => navigateMock,
}))

vi.mock('@/containers/HeaderPage', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="header-page">{children}</div>
  ),
}))

vi.mock('@/containers/SettingsMenu', () => ({
  default: () => <div data-testid="settings-menu">Settings Menu</div>,
}))

vi.mock('@/containers/Card', () => ({
  Card: ({
    title,
    header,
    children,
  }: {
    title?: string
    header?: React.ReactNode
    children?: React.ReactNode
  }) => (
    <section data-testid="card">
      {title && <h2>{title}</h2>}
      {header}
      {children}
    </section>
  ),
  CardItem: ({
    title,
    description,
    actions,
  }: {
    title?: string
    description?: string
    actions?: React.ReactNode
  }) => (
    <div data-testid="card-item">
      <div>{title}</div>
      <div>{description}</div>
      {actions}
    </div>
  ),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    className?: string
  }) => (
    <button
      type="button"
      className={className}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, ...props }: any) => (
    <input value={value} onChange={onChange} {...props} />
  ),
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({ value, onChange, ...props }: any) => (
    <textarea value={value} onChange={onChange} {...props} />
  ),
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <label className={className}>{children}</label>
  ),
}))

vi.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange }: any) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onCheckedChange(event.target.checked)}
    />
  ),
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({ children, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}))

vi.mock('@/hooks/useModelProvider', () => ({
  useModelProvider: () => useModelProviderMock(),
}))

const baseAgents = [
  {
    id: 'agent-a',
    name: '规划员',
    avatar: 'A',
    systemPrompt: 'Plan',
    toolPermission: 'selected' as const,
    description: '规划任务',
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: 'agent-b',
    name: '执行员',
    avatar: 'B',
    systemPrompt: 'Build',
    toolPermission: 'none' as const,
    description: '执行任务',
    createdAt: 1,
    updatedAt: 1,
  },
]

const baseTeams = [
  {
    id: 'team-a',
    name: '产品团队',
    description: '默认团队',
    memberIds: ['agent-a', 'agent-b'],
    speakerOrder: 'round_robin' as const,
    maxRounds: 1,
    summarizerAgentId: undefined,
    allowMentions: true,
    createdAt: 1,
    updatedAt: 1,
  },
]

describe('AgentTeamsSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAgentTeams.setState({
      agents: baseAgents,
      teams: baseTeams,
      threadBindings: {},
    })
    useModelProviderMock.mockReturnValue({
      providers: [
        {
          provider: 'openai',
          active: true,
          models: [
            { id: 'gpt-4o', displayName: 'GPT 4o' },
            { id: 'gpt-4.1', name: 'GPT 4.1' },
          ],
        },
        {
          provider: 'inactive',
          active: false,
          models: [{ id: 'hidden-model' }],
        },
      ],
    })
  })

  it('shows only agent details on the Agents page', () => {
    render(<AgentSettingsPage selectedAgentIdFromSearch="agent-a" />)

    expect(screen.getByText('Agent 详情')).toBeInTheDocument()
    expect(screen.queryByText('团队详情')).not.toBeInTheDocument()
  })

  it('shows only team details on the Teams page', () => {
    render(<TeamSettingsPage selectedTeamIdFromSearch="team-a" />)

    expect(screen.getByText('团队详情')).toBeInTheDocument()
    expect(screen.queryByText('Agent 详情')).not.toBeInTheDocument()
  })

  it('creates an agent from the header and navigates to the new agent', () => {
    render(<AgentSettingsPage selectedAgentIdFromSearch="agent-a" />)

    fireEvent.click(screen.getByText('新建 Agent'))

    const created = useAgentTeams.getState().agents.at(-1)
    expect(created?.name).toBe('New Agent')
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/settings/agent-teams/agents',
      search: { agentId: created?.id },
    })
  })

  it('creates a team with the first two agents and navigates to it', () => {
    render(<AgentSettingsPage selectedAgentIdFromSearch="agent-a" />)

    fireEvent.click(screen.getByText('新建团队'))

    const created = useAgentTeams.getState().teams.at(-1)
    expect(created?.name).toBe('新团队')
    expect(created?.memberIds).toEqual(['agent-a', 'agent-b'])
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/settings/agent-teams/teams',
      search: { teamId: created?.id },
    })
  })

  it('stores provider and model from dropdown selections', () => {
    render(<AgentSettingsPage selectedAgentIdFromSearch="agent-a" />)

    fireEvent.click(screen.getByText('OpenAI'))
    expect(useAgentTeams.getState().getAgentById('agent-a')?.provider).toBe('openai')

    fireEvent.click(screen.getByText('GPT 4o'))
    expect(useAgentTeams.getState().getAgentById('agent-a')?.modelId).toBe('gpt-4o')
  })

  it('clears provider and model when inheriting from the current session', () => {
    useAgentTeams.setState({
      agents: [
        {
          ...baseAgents[0],
          provider: 'openai',
          modelId: 'gpt-4o',
        },
      ],
      teams: baseTeams,
      threadBindings: {},
    })

    render(<AgentSettingsPage selectedAgentIdFromSearch="agent-a" />)

    fireEvent.click(screen.getByText('继承当前会话提供方'))

    const agent = useAgentTeams.getState().getAgentById('agent-a')
    expect(agent?.provider).toBeUndefined()
    expect(agent?.modelId).toBeUndefined()
  })
})
