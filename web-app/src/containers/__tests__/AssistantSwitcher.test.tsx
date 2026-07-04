import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { AssistantSwitcher } from '../AssistantSwitcher'
import { useAssistantSwitcher } from '@/hooks/useAssistantSwitcher'
import { useAgentTeams } from '@/hooks/useAgentTeams'
import type { ChatActorSelection } from '@/lib/chat-actors'

vi.mock('@/i18n/react-i18next-compat', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

const assistant = (id: string, name: string): Assistant =>
  ({ id, name, avatar: '😀' }) as unknown as Assistant

const cycle = () => useAssistantSwitcher.getState().cycleHandler?.()

describe('AssistantSwitcher cycle logic', () => {
  let onSelectActor: ReturnType<typeof vi.fn>

  beforeEach(() => {
    cleanup()
    onSelectActor = vi.fn()
    useAssistantSwitcher.setState({ open: false, cycleHandler: null })
    useAgentTeams.setState({ agents: [], teams: [], threadBindings: {} })
  })

  const renderSwitcher = (overrides: Partial<{
    assistants: Assistant[]
    selectedActor: ChatActorSelection
  }> = {}) =>
    render(
      <AssistantSwitcher
        assistants={overrides.assistants ?? [assistant('a1', 'Alice'), assistant('a2', 'Bob')]}
        selectedActor={overrides.selectedActor ?? { type: 'none' }}
        onSelectActor={onSelectActor}
      />
    )

  it('renders nothing with a single actor and never registers a usable cycle', () => {
    const { container } = renderSwitcher({ assistants: [assistant('a1', 'Alice')] })
    expect(container.firstChild).toBeNull()
    cycle()
    expect(onSelectActor).not.toHaveBeenCalled()
  })

  it('advances to the next assistant', () => {
    renderSwitcher({ selectedActor: { type: 'assistant', id: 'a1' } })
    cycle()
    expect(onSelectActor).toHaveBeenCalledWith({ type: 'assistant', id: 'a2' })
  })

  it('wraps around from the last assistant to the first', () => {
    renderSwitcher({ selectedActor: { type: 'assistant', id: 'a2' } })
    cycle()
    expect(onSelectActor).toHaveBeenCalledWith({ type: 'assistant', id: 'a1' })
  })

  it('treats an unknown selected actor as index -1 and selects the first', () => {
    renderSwitcher({ selectedActor: { type: 'assistant', id: 'missing' } })
    cycle()
    expect(onSelectActor).toHaveBeenCalledWith({ type: 'assistant', id: 'a1' })
  })

  it('cycles from assistant to agent when agents are available', () => {
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
      teams: [],
      threadBindings: {},
    })
    renderSwitcher({
      assistants: [assistant('a1', 'Alice')],
      selectedActor: { type: 'assistant', id: 'a1' },
    })
    cycle()
    expect(onSelectActor).toHaveBeenCalledWith({ type: 'agent', id: 'agent-a' })
  })

  it('unregisters the cycle handler on unmount', () => {
    const { unmount } = renderSwitcher({ selectedActor: { type: 'assistant', id: 'a1' } })
    expect(useAssistantSwitcher.getState().cycleHandler).not.toBeNull()
    unmount()
    expect(useAssistantSwitcher.getState().cycleHandler).toBeNull()
  })

  it('falls back to the i18n key when no actor is active', () => {
    renderSwitcher({ selectedActor: { type: 'none' } })
    expect(screen.getByText('common:noAssistant')).toBeInTheDocument()
  })
})
