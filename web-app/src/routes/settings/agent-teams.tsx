import { createFileRoute, Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { route } from '@/constants/routes'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = createFileRoute(route.settings.agent_teams as any)({
  component: AgentTeamsRedirect,
})

function AgentTeamsRedirect() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (location.pathname === route.settings.agent_teams) {
      navigate({
        to: route.settings.agent_team_agents,
        replace: true,
      })
    }
  }, [location.pathname, navigate])

  return <Outlet />
}
