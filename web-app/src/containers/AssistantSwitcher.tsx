import { useEffect, useMemo, useRef } from 'react'
import {
  IconChevronDown,
  IconRobot,
  IconUser,
  IconUsersGroup,
} from '@tabler/icons-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { AvatarEmoji } from '@/containers/AvatarEmoji'
import { AssistantsMenu } from '@/components/AssistantsMenu'
import { useAssistantSwitcher } from '@/hooks/useAssistantSwitcher'
import { useTranslation } from '@/i18n/react-i18next-compat'
import { useAgentTeams } from '@/hooks/useAgentTeams'
import {
  ChatActorSelection,
  getChatActorLabel,
  isSameChatActor,
} from '@/lib/chat-actors'

export interface AssistantSwitcherProps {
  assistants: Assistant[]
  selectedActor: ChatActorSelection
  onSelectActor: (actor: ChatActorSelection) => void
}

const isMac =
  typeof navigator !== 'undefined' &&
  navigator.userAgent.toUpperCase().indexOf('MAC') >= 0
const shortcutHint = `${isMac ? '⌘' : 'Ctrl'}+J`

export function AssistantSwitcher({
  assistants,
  selectedActor,
  onSelectActor,
}: AssistantSwitcherProps) {
  const { t } = useTranslation()
  const open = useAssistantSwitcher((s) => s.open)
  const setOpen = useAssistantSwitcher((s) => s.setOpen)
  const setCycleHandler = useAssistantSwitcher((s) => s.setCycleHandler)
  const agents = useAgentTeams((state) => state.agents)
  const teams = useAgentTeams((state) => state.teams)

  const actors = useMemo<ChatActorSelection[]>(
    () => [
      ...assistants.map((assistant) => ({
        type: 'assistant' as const,
        id: assistant.id,
      })),
      ...agents.map((agent) => ({ type: 'agent' as const, id: agent.id })),
      ...teams.map((team) => ({ type: 'team' as const, id: team.id })),
    ],
    [agents, assistants, teams]
  )

  const label = getChatActorLabel(
    selectedActor,
    assistants,
    agents,
    teams,
    t('common:noAssistant')
  )

  const cycleRef = useRef<() => void>(() => {})
  cycleRef.current = () => {
    if (actors.length <= 1) return
    const idx = actors.findIndex((actor) => isSameChatActor(actor, selectedActor))
    onSelectActor(actors[(idx + 1) % actors.length])
  }

  useEffect(() => {
    const handler = () => cycleRef.current()
    setCycleHandler(handler)
    return () => {
      setCycleHandler(null)
      setOpen(false)
    }
  }, [setCycleHandler, setOpen])

  if (actors.length <= 1) return null

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 gap-1 min-w-0"
              aria-label="Switch assistant"
            >
              <ActorIcon
                actor={selectedActor}
                assistants={assistants}
                agents={agents}
              />
              <span className="text-sm font-medium truncate max-w-32">
                {label}
              </span>
              <IconChevronDown size={14} className="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>Switch assistant ({shortcutHint})</p>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
        <AssistantsMenu
          selectedActor={selectedActor}
          onSelectActor={onSelectActor}
          assistants={assistants}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ActorIcon({
  actor,
  assistants,
  agents,
}: {
  actor: ChatActorSelection
  assistants: Assistant[]
  agents: ReturnType<typeof useAgentTeams.getState>['agents']
}) {
  if (actor.type === 'assistant') {
    const assistant = assistants.find((item) => item.id === actor.id)
    return assistant?.avatar ? (
      <AvatarEmoji
        avatar={assistant.avatar}
        imageClassName="size-4 object-contain"
        textClassName="text-sm"
      />
    ) : (
      <IconUser size={14} className="text-muted-foreground" />
    )
  }
  if (actor.type === 'agent') {
    const agent = agents.find((item) => item.id === actor.id)
    return (
      <span className="size-4 flex items-center justify-center text-sm">
        {agent?.avatar || <IconRobot size={14} className="text-muted-foreground" />}
      </span>
    )
  }
  if (actor.type === 'team') {
    return <IconUsersGroup size={14} className="text-muted-foreground" />
  }
  return <IconUser size={14} className="text-muted-foreground" />
}
