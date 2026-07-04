import { Link, useNavigate } from '@tanstack/react-router'
import { ReactNode, useEffect, useMemo, useState } from 'react'
import {
  IconCirclePlus,
  IconRobot,
  IconTrash,
  IconUsersGroup,
} from '@tabler/icons-react'
import { route } from '@/constants/routes'
import HeaderPage from '@/containers/HeaderPage'
import SettingsMenu from '@/containers/SettingsMenu'
import { Card, CardItem } from '@/containers/Card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useModelProvider } from '@/hooks/useModelProvider'
import { cn, getProviderTitle } from '@/lib/utils'
import {
  AgentProfile,
  AgentSpeakerOrder,
  AgentTeam,
  AgentToolPermission,
  useAgentTeams,
} from '@/hooks/useAgentTeams'

type AgentTeamsSection = 'agents' | 'teams'

type AgentTeamsLayoutProps = {
  activeSection: AgentTeamsSection
  children: ReactNode
}

type AgentSettingsPageProps = {
  selectedAgentIdFromSearch?: string
}

type TeamSettingsPageProps = {
  selectedTeamIdFromSearch?: string
}

const speakerOrderLabels: Record<AgentSpeakerOrder, string> = {
  round_robin: '固定轮流',
  manual: '手动选择',
  auto: '自动判断',
  random: '随机',
  sequential: '顺序流水线',
}

const toolPermissionLabels: Record<AgentToolPermission, string> = {
  all: '全部工具',
  selected: '指定工具',
  none: '不允许使用工具',
}

export function AgentTeamsLayout({
  activeSection,
  children,
}: AgentTeamsLayoutProps) {
  const navigate = useNavigate()
  const { agents, createAgent, createTeam } = useAgentTeams()

  const handleCreateAgent = () => {
    const agent = createAgent({
      name: 'New Agent',
      avatar: '🤖',
      systemPrompt: 'You are a helpful specialist in the team.',
      toolPermission: 'selected',
      description: '描述这个 Agent 的职责。',
    })
    navigate({
      to: route.settings.agent_team_agents,
      search: { agentId: agent.id } as never,
    })
  }

  const handleCreateTeam = () => {
    const team = createTeam({
      name: '新团队',
      description: '描述这个团队适合处理什么任务。',
      memberIds: agents.slice(0, 2).map((agent) => agent.id),
      speakerOrder: 'round_robin',
      maxRounds: 1,
      summarizerAgentId: undefined,
      allowMentions: true,
    })
    navigate({
      to: route.settings.agent_team_teams,
      search: { teamId: team.id } as never,
    })
  }

  return (
    <div className="flex flex-col h-svh w-full">
      <HeaderPage>
        <div className={cn('flex items-center justify-between w-full mr-2 pr-3', !IS_MACOS && 'pr-30')}>
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-medium text-base font-studio shrink-0">Agent 团队</span>
            <div className="flex items-center rounded-full border bg-background p-0.5">
              <Link
                to={route.settings.agent_team_agents}
                className={cn(
                  'h-7 px-3 rounded-full text-sm flex items-center text-muted-foreground hover:text-foreground',
                  activeSection === 'agents' && 'bg-secondary text-foreground'
                )}
              >
                Agents
              </Link>
              <Link
                to={route.settings.agent_team_teams}
                className={cn(
                  'h-7 px-3 rounded-full text-sm flex items-center text-muted-foreground hover:text-foreground',
                  activeSection === 'teams' && 'bg-secondary text-foreground'
                )}
              >
                团队
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-2 relative z-20">
            <Button size="sm" variant="outline" onClick={handleCreateAgent}>
              <IconCirclePlus size={16} />
              新建 Agent
            </Button>
            <Button size="sm" variant="outline" onClick={handleCreateTeam}>
              <IconCirclePlus size={16} />
              新建团队
            </Button>
          </div>
        </div>
      </HeaderPage>
      <div className="flex h-[calc(100%-60px)]">
        <SettingsMenu />
        <div className="p-4 pt-4 w-full overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}

export function AgentSettingsPage({
  selectedAgentIdFromSearch,
}: AgentSettingsPageProps) {
  const {
    agents,
    updateAgent,
    deleteAgent,
  } = useAgentTeams()
  const { providers } = useModelProvider()
  const [selectedAgentId, setSelectedAgentId] = useState(
    selectedAgentIdFromSearch ?? agents[0]?.id
  )

  useEffect(() => {
    if (selectedAgentIdFromSearch) {
      setSelectedAgentId(selectedAgentIdFromSearch)
    }
  }, [selectedAgentIdFromSearch])

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? agents[0],
    [agents, selectedAgentId]
  )

  const activeProviders = useMemo(
    () => providers.filter((provider) => provider.active && (IS_MACOS || provider.provider !== 'mlx')),
    [providers]
  )
  const selectedProvider = activeProviders.find(
    (provider) => provider.provider === selectedAgent?.provider
  )

  const updateSelectedAgent = (updates: Partial<AgentProfile>) => {
    if (!selectedAgent) return
    updateAgent(selectedAgent.id, updates)
  }

  const handleProviderSelect = (providerName: string) => {
    if (!selectedAgent) return
    const provider = activeProviders.find((item) => item.provider === providerName)
    const keepModel =
      providerName &&
      provider?.models.some((model) => model.id === selectedAgent.modelId)
    updateSelectedAgent({
      provider: providerName || undefined,
      modelId: keepModel ? selectedAgent.modelId : undefined,
    })
  }

  const handleModelSelect = (modelId: string) => {
    updateSelectedAgent({ modelId: modelId || undefined })
  }

  return (
    <AgentTeamsLayout activeSection="agents">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)] gap-4 w-full">
        <Card
          header={
            <SectionHeader
              title="Agents"
              description={`${agents.length} 个 Agent`}
            />
          }
        >
          {agents.length === 0 ? (
            <EmptyState title="暂无 Agent" description="点击右上角新建 Agent。" />
          ) : (
            <div className="flex flex-col gap-1">
              {agents.map((agent) => (
                <AgentListItem
                  key={agent.id}
                  agent={agent}
                  selected={selectedAgent?.id === agent.id}
                  onClick={() => setSelectedAgentId(agent.id)}
                />
              ))}
            </div>
          )}
        </Card>

        {selectedAgent ? (
          <Card
            header={
              <div className="flex items-start justify-between mb-4 gap-4">
                <div className="min-w-0">
                  <h1 className="text-foreground font-studio font-medium text-base">
                    Agent 详情
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    配置角色、模型偏好、提示词和工具权限。
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    deleteAgent(selectedAgent.id)
                    setSelectedAgentId(
                      agents.find((agent) => agent.id !== selectedAgent.id)?.id ?? ''
                    )
                  }}
                >
                  <IconTrash size={16} className="text-destructive" />
                </Button>
              </div>
            }
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Field label="名称">
                <Input
                  value={selectedAgent.name}
                  onChange={(event) => updateSelectedAgent({ name: event.target.value })}
                />
              </Field>
              <Field label="头像">
                <Input
                  value={selectedAgent.avatar}
                  onChange={(event) => updateSelectedAgent({ avatar: event.target.value })}
                />
              </Field>
              <Field label="模型提供方">
                <SelectValue
                  value={
                    selectedAgent.provider
                      ? getProviderTitle(selectedAgent.provider)
                      : '继承当前会话提供方'
                  }
                  options={[
                    { value: '', label: '继承当前会话提供方' },
                    ...activeProviders.map((provider) => ({
                      value: provider.provider,
                      label: getProviderTitle(provider.provider),
                    })),
                  ]}
                  onSelect={handleProviderSelect}
                />
              </Field>
              <Field label="模型">
                <SelectValue
                  value={
                    selectedAgent.modelId
                      ? getModelLabel(selectedProvider, selectedAgent.modelId)
                      : '继承当前会话模型'
                  }
                  options={[
                    { value: '', label: '继承当前会话模型' },
                    ...(selectedProvider?.models ?? []).map((model) => ({
                      value: model.id,
                      label: getModelDisplayName(model),
                    })),
                  ]}
                  onSelect={handleModelSelect}
                  disabled={!selectedProvider}
                />
              </Field>
              <Field label="工具权限">
                <SelectValue
                  value={toolPermissionLabels[selectedAgent.toolPermission]}
                  options={Object.entries(toolPermissionLabels).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                  onSelect={(value) => updateSelectedAgent({ toolPermission: value as AgentToolPermission })}
                />
              </Field>
              <Field label="职责描述" className="lg:col-span-2">
                <Input
                  value={selectedAgent.description}
                  onChange={(event) => updateSelectedAgent({ description: event.target.value })}
                />
              </Field>
              <Field label="System Prompt / 角色提示词" className="lg:col-span-2">
                <Textarea
                  rows={7}
                  value={selectedAgent.systemPrompt}
                  onChange={(event) => updateSelectedAgent({ systemPrompt: event.target.value })}
                />
              </Field>
            </div>
          </Card>
        ) : (
          <Card>
            <EmptyState title="暂无 Agent" description="点击右上角新建 Agent 后再配置详情。" />
          </Card>
        )}
      </div>
    </AgentTeamsLayout>
  )
}

export function TeamSettingsPage({
  selectedTeamIdFromSearch,
}: TeamSettingsPageProps) {
  const {
    agents,
    teams,
    updateTeam,
    deleteTeam,
  } = useAgentTeams()
  const [selectedTeamId, setSelectedTeamId] = useState(
    selectedTeamIdFromSearch ?? teams[0]?.id
  )

  useEffect(() => {
    if (selectedTeamIdFromSearch) {
      setSelectedTeamId(selectedTeamIdFromSearch)
    }
  }, [selectedTeamIdFromSearch])

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) ?? teams[0],
    [teams, selectedTeamId]
  )

  const toggleTeamMember = (agentId: string) => {
    if (!selectedTeam) return
    const hasMember = selectedTeam.memberIds.includes(agentId)
    const memberIds = hasMember
      ? selectedTeam.memberIds.filter((id) => id !== agentId)
      : [...selectedTeam.memberIds, agentId]
    updateTeam(selectedTeam.id, {
      memberIds,
      summarizerAgentId: memberIds.includes(selectedTeam.summarizerAgentId ?? '')
        ? selectedTeam.summarizerAgentId
        : undefined,
    })
  }

  return (
    <AgentTeamsLayout activeSection="teams">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)] gap-4 w-full">
        <Card
          header={
            <SectionHeader
              title="团队"
              description={`${teams.length} 个团队`}
            />
          }
        >
          {teams.length === 0 ? (
            <EmptyState title="暂无团队" description="点击右上角新建团队。" />
          ) : (
            <div className="flex flex-col gap-1">
              {teams.map((team) => (
                <TeamListItem
                  key={team.id}
                  team={team}
                  selected={selectedTeam?.id === team.id}
                  onClick={() => setSelectedTeamId(team.id)}
                />
              ))}
            </div>
          )}
        </Card>

        {selectedTeam ? (
          <Card
            header={
              <div className="flex items-start justify-between mb-4 gap-4">
                <div className="min-w-0">
                  <h1 className="text-foreground font-studio font-medium text-base">
                    团队详情
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    配置成员、发言顺序、最大轮数、点名和总结员。
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    deleteTeam(selectedTeam.id)
                    setSelectedTeamId(
                      teams.find((team) => team.id !== selectedTeam.id)?.id ?? ''
                    )
                  }}
                >
                  <IconTrash size={16} className="text-destructive" />
                </Button>
              </div>
            }
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Field label="团队名称">
                <Input
                  value={selectedTeam.name}
                  onChange={(event) => updateTeam(selectedTeam.id, { name: event.target.value })}
                />
              </Field>
              <Field label="发言顺序">
                <SelectValue
                  value={speakerOrderLabels[selectedTeam.speakerOrder]}
                  options={Object.entries(speakerOrderLabels).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                  onSelect={(value) => updateTeam(selectedTeam.id, { speakerOrder: value as AgentSpeakerOrder })}
                />
              </Field>
              <Field label="最大讨论轮数">
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={selectedTeam.maxRounds}
                  onChange={(event) =>
                    updateTeam(selectedTeam.id, {
                      maxRounds: Math.max(1, Number(event.target.value) || 1),
                    })
                  }
                />
              </Field>
              <Field label="总结员">
                <SelectValue
                  value={
                    agents.find((agent) => agent.id === selectedTeam.summarizerAgentId)?.name ??
                    '不使用总结员'
                  }
                  options={[
                    { value: '', label: '不使用总结员' },
                    ...selectedTeam.memberIds.map((agentId) => {
                      const agent = agents.find((item) => item.id === agentId)
                      return { value: agentId, label: agent?.name ?? agentId }
                    }),
                  ]}
                  onSelect={(value) => updateTeam(selectedTeam.id, { summarizerAgentId: value || undefined })}
                />
              </Field>
              <Field label="团队说明" className="lg:col-span-2">
                <Input
                  value={selectedTeam.description}
                  onChange={(event) => updateTeam(selectedTeam.id, { description: event.target.value })}
                />
              </Field>
            </div>
            <div className="mt-4">
              <CardItem
                title="允许 @ 点名"
                description="允许用户在聊天输入框里直接点名某个团队成员。"
                actions={
                  <Switch
                    checked={selectedTeam.allowMentions}
                    onCheckedChange={(checked) => updateTeam(selectedTeam.id, { allowMentions: checked })}
                  />
                }
              />
              <div className="mt-4">
                <Label className="mb-2">团队成员</Label>
                {agents.length === 0 ? (
                  <EmptyState title="还没有可加入的 Agent" description="先新建 Agent，再回到这里选择团队成员。" />
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                    {agents.map((agent) => {
                      const checked = selectedTeam.memberIds.includes(agent.id)
                      return (
                        <button
                          type="button"
                          key={agent.id}
                          className={cn(
                            'flex items-center gap-2 rounded-md border px-3 py-2 text-left hover:bg-secondary min-w-0',
                            checked && 'border-primary bg-primary/5'
                          )}
                          onClick={() => toggleTeamMember(agent.id)}
                        >
                          <span className="size-7 shrink-0 flex items-center justify-center rounded-md bg-secondary">
                            {agent.avatar || <IconRobot size={16} />}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-foreground truncate">
                              {agent.name}
                            </span>
                            <span className="block text-xs text-muted-foreground truncate">
                              {agent.description}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ) : (
          <Card>
            <EmptyState title="暂无团队" description="点击右上角新建团队后再配置详情。" />
          </Card>
        )}
      </div>
    </AgentTeamsLayout>
  )
}

function SectionHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h1 className="text-foreground font-studio font-medium text-base">
        {title}
      </h1>
      <span className="text-xs text-muted-foreground">{description}</span>
    </div>
  )
}

function AgentListItem({
  agent,
  selected,
  onClick,
}: {
  agent: AgentProfile
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={cn(
        'group flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-secondary transition-colors w-full',
        selected && 'bg-secondary'
      )}
      onClick={onClick}
    >
      <div className="size-9 shrink-0 flex items-center justify-center bg-background rounded-lg text-lg">
        {agent.avatar || <IconRobot size={18} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground truncate">
          {agent.name}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {agent.description}
        </div>
      </div>
    </button>
  )
}

function TeamListItem({
  team,
  selected,
  onClick,
}: {
  team: AgentTeam
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={cn(
        'group flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-secondary transition-colors w-full',
        selected && 'bg-secondary'
      )}
      onClick={onClick}
    >
      <div className="size-9 shrink-0 flex items-center justify-center bg-background rounded-lg">
        <IconUsersGroup size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground truncate">
          {team.name}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {team.memberIds.length} 个 Agent
        </div>
      </div>
    </button>
  )
}

function EmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-md border border-dashed px-4 py-6 text-center">
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{description}</div>
    </div>
  )
}

function Field({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function SelectValue({
  value,
  options,
  onSelect,
  disabled,
}: {
  value: string
  options: Array<{ value: string; label: string }>
  onSelect: (value: string) => void
  disabled?: boolean
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between"
          disabled={disabled}
        >
          <span className="truncate">{value}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 max-h-80 overflow-y-auto">
        {options.map((option) => (
          <DropdownMenuItem key={option.value} onClick={() => onSelect(option.value)}>
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function getModelDisplayName(model: Model) {
  return model.displayName || model.name || model.id
}

function getModelLabel(provider: ModelProvider | undefined, modelId: string) {
  const model = provider?.models.find((item) => item.id === modelId)
  return model ? getModelDisplayName(model) : modelId
}
