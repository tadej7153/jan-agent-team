import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { AvatarEmoji } from '@/containers/AvatarEmoji'
import { useAgentTeams } from '@/hooks/useAgentTeams'
import {
  ChatActorSelection,
  isSameChatActor,
  noneChatActor,
} from '@/lib/chat-actors'
import { IconRobot, IconUser, IconUsersGroup } from '@tabler/icons-react'

type AssistantMenuProps = {
  selectedActor: ChatActorSelection
  onSelectActor: (actor: ChatActorSelection) => void
  assistants: Assistant[]
}

export function AssistantsMenu({
  selectedActor,
  onSelectActor,
  assistants,
}: AssistantMenuProps) {
  const agents = useAgentTeams((state) => state.agents)
  const teams = useAgentTeams((state) => state.teams)
  const noSelectedActor = selectedActor.type === 'none'

  return (
    <>
      <DropdownMenuItem
        className={noSelectedActor ? 'bg-accent' : ''}
        onClick={() => onSelectActor(noneChatActor)}
      >
        <div className="flex items-center gap-2 w-full">
          <span className="text-muted-foreground">—</span>
          <span>无</span>
          {noSelectedActor && <SelectedMark />}
        </div>
      </DropdownMenuItem>

      <DropdownMenuSeparator />
      <MenuLabel label="助手" />
      {assistants.length > 0 ? (
        assistants.map((assistant) => {
          const actor: ChatActorSelection = {
            type: 'assistant',
            id: assistant.id,
          }
          const isSelected = isSameChatActor(selectedActor, actor)
          return (
            <DropdownMenuItem
              key={assistant.id}
              className={isSelected ? 'bg-accent' : ''}
              onClick={() => onSelectActor(actor)}
            >
              <div className="flex items-center gap-2 w-full min-w-0">
                {assistant.avatar ? (
                  <AvatarEmoji
                    avatar={assistant.avatar}
                    imageClassName="w-4 h-4 object-contain"
                    textClassName="text-sm"
                  />
                ) : (
                  <IconUser size={16} className="text-muted-foreground" />
                )}
                <span className="truncate">
                  {assistant.name || 'Unnamed Assistant'}
                </span>
                {isSelected && <SelectedMark />}
              </div>
            </DropdownMenuItem>
          )
        })
      ) : (
        <DropdownMenuItem disabled>
          <span className="text-muted-foreground">暂无助手</span>
        </DropdownMenuItem>
      )}

      <DropdownMenuSeparator />
      <MenuLabel label="Agents" />
      {agents.length > 0 ? (
        agents.map((agent) => {
          const actor: ChatActorSelection = { type: 'agent', id: agent.id }
          const isSelected = isSameChatActor(selectedActor, actor)
          return (
            <DropdownMenuItem
              key={agent.id}
              className={isSelected ? 'bg-accent' : ''}
              onClick={() => onSelectActor(actor)}
            >
              <div className="flex items-center gap-2 w-full min-w-0">
                <span className="w-4 h-4 flex items-center justify-center text-sm">
                  {agent.avatar || <IconRobot size={16} />}
                </span>
                <span className="truncate">{agent.name}</span>
                {isSelected && <SelectedMark />}
              </div>
            </DropdownMenuItem>
          )
        })
      ) : (
        <DropdownMenuItem disabled>
          <span className="text-muted-foreground">暂无 Agent</span>
        </DropdownMenuItem>
      )}

      <DropdownMenuSeparator />
      <MenuLabel label="Agent Teams" />
      {teams.length > 0 ? (
        teams.map((team) => {
          const actor: ChatActorSelection = { type: 'team', id: team.id }
          const isSelected = isSameChatActor(selectedActor, actor)
          return (
            <DropdownMenuItem
              key={team.id}
              className={isSelected ? 'bg-accent' : ''}
              onClick={() => onSelectActor(actor)}
            >
              <div className="flex items-center gap-2 w-full min-w-0">
                <IconUsersGroup size={16} className="text-muted-foreground" />
                <span className="truncate">{team.name}</span>
                {isSelected && <SelectedMark />}
              </div>
            </DropdownMenuItem>
          )
        })
      ) : (
        <DropdownMenuItem disabled>
          <span className="text-muted-foreground">暂无团队</span>
        </DropdownMenuItem>
      )}
    </>
  )
}

function MenuLabel({ label }: { label: string }) {
  return (
    <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
      {label}
    </div>
  )
}

function SelectedMark() {
  return <span className="ml-auto text-xs text-muted-foreground">✓</span>
}
