import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AssistantsMenu } from '../AssistantsMenu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { useAgentTeams } from '@/hooks/useAgentTeams'

function AssitantMenuContainer({ children }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>Open</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>{children}</DropdownMenuContent>
    </DropdownMenu>
  )
}

describe('AssistantsMenu', () => {
  const mockSelectActor = vi.fn()
  const assistants = [
    { id: 'a1', name: 'Alice', avatar: '😀' },
    { id: 'a2', name: 'Bob', avatar: '😎' },
  ]

  beforeEach(() => {
    mockSelectActor.mockReset()
    useAgentTeams.setState({
      agents: [
        {
          id: 'agent-a',
          name: 'Agent A',
          avatar: '🤖',
          description: '',
          systemPrompt: '',
          toolPermission: 'none',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      teams: [
        {
          id: 'team-a',
          name: 'Team A',
          description: '',
          memberIds: ['agent-a'],
          speakerOrder: 'round_robin',
          maxRounds: 1,
          allowMentions: true,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      threadBindings: {},
    })
  })

  it('renders None, assistants, agents and teams', async () => {
    render(
      <AssitantMenuContainer>
        <AssistantsMenu
          selectedActor={{ type: 'none' }}
          onSelectActor={mockSelectActor}
          assistants={assistants}
        />
      </AssitantMenuContainer>
    )
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    await waitFor(() => {
      expect(screen.getByText('无')).toBeInTheDocument()
    })
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Agent A')).toBeInTheDocument()
    expect(screen.getByText('Team A')).toBeInTheDocument()
  })

  it('selects none', async () => {
    render(
      <AssitantMenuContainer>
        <AssistantsMenu
          selectedActor={{ type: 'assistant', id: 'a1' }}
          onSelectActor={mockSelectActor}
          assistants={assistants}
        />
      </AssitantMenuContainer>
    )
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    const noneMenuItem = screen.getByText('无').closest('[role="menuitem"]')
    expect(noneMenuItem).not.toBeNull()
    await userEvent.click(noneMenuItem!)
    expect(mockSelectActor).toHaveBeenCalledWith({ type: 'none' })
  })

  it('selects an assistant', async () => {
    render(
      <AssitantMenuContainer>
        <AssistantsMenu
          selectedActor={{ type: 'none' }}
          onSelectActor={mockSelectActor}
          assistants={assistants}
        />
      </AssitantMenuContainer>
    )
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    const aliceMenuItem = screen.getByText('Alice').closest('[role="menuitem"]')
    expect(aliceMenuItem).not.toBeNull()
    await userEvent.click(aliceMenuItem!)
    expect(mockSelectActor).toHaveBeenCalledWith({ type: 'assistant', id: 'a1' })
  })

  it('shows disabled when no assistants', async () => {
    render(
      <AssitantMenuContainer>
        <AssistantsMenu
          selectedActor={{ type: 'none' }}
          onSelectActor={mockSelectActor}
          assistants={[]}
        />
      </AssitantMenuContainer>
    )
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    await waitFor(() => {
      expect(screen.getByText('暂无助手')).toBeInTheDocument()
    })
  })
})
