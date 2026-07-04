import { createFileRoute, useSearch } from '@tanstack/react-router'
import { route } from '@/constants/routes'
import { TeamSettingsPage } from '@/containers/AgentTeamsSettings'

type AgentTeamTeamsSearch = {
  teamId?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = createFileRoute(route.settings.agent_team_teams as any)({
  component: AgentTeamTeamsRoute,
  validateSearch: (search: Record<string, unknown>): AgentTeamTeamsSearch => ({
    teamId: typeof search.teamId === 'string' ? search.teamId : undefined,
  }),
})

function AgentTeamTeamsRoute() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const search = useSearch({ from: Route.id as any })

  return <TeamSettingsPage selectedTeamIdFromSearch={search.teamId} />
}
