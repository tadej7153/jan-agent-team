import { createFileRoute, useSearch } from '@tanstack/react-router'
import { route } from '@/constants/routes'
import { AgentSettingsPage } from '@/containers/AgentTeamsSettings'

type AgentTeamAgentsSearch = {
  agentId?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = createFileRoute(route.settings.agent_team_agents as any)({
  component: AgentTeamAgentsRoute,
  validateSearch: (search: Record<string, unknown>): AgentTeamAgentsSearch => ({
    agentId: typeof search.agentId === 'string' ? search.agentId : undefined,
  }),
})

function AgentTeamAgentsRoute() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const search = useSearch({ from: Route.id as any })

  return <AgentSettingsPage selectedAgentIdFromSearch={search.agentId} />
}
