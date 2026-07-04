import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useThreadManagement } from '@/hooks/useThreadManagement'
import { useAssistant } from '@/hooks/useAssistant'
import { toast } from 'sonner'
import { useTranslation } from '@/i18n/react-i18next-compat'
import { ChevronDown, Plus } from 'lucide-react'
import AddEditAssistant from './AddEditAssistant'
import { AssistantsMenu } from '@/components/AssistantsMenu'
import {
  ChatActorSelection,
  getChatActorLabel,
  normalizeChatActor,
} from '@/lib/chat-actors'
import { useAgentTeams } from '@/hooks/useAgentTeams'

interface AddProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingKey: string | null
  initialData?: {
    id: string
    name: string
    updated_at: number
    assistantId?: string
    chatActor?: ChatActorSelection
  }
  onSave: (name: string, assistantId?: string, chatActor?: ChatActorSelection) => void
}

export default function AddProjectDialog({
  open,
  onOpenChange,
  editingKey,
  initialData,
  onSave,
}: AddProjectDialogProps) {
  const { t } = useTranslation()
  const [name, setName] = useState(initialData?.name || '')
  const [selectedActor, setSelectedActor] = useState<ChatActorSelection>(
    normalizeChatActor(initialData?.chatActor, initialData?.assistantId)
  )
  const { folders } = useThreadManagement()
  const { assistants, addAssistant } = useAssistant()
  const agents = useAgentTeams((state) => state.agents)
  const teams = useAgentTeams((state) => state.teams)
  const [addAssistantDialogOpen, setAddAssistantDialogOpen] = useState(false)

  const selectedActorLabel = getChatActorLabel(
    selectedActor,
    assistants,
    agents,
    teams,
    t('projects.addProjectDialog.selectAssistant')
  )

  useEffect(() => {
    if (open) {
      setName(initialData?.name || '')
      setSelectedActor(normalizeChatActor(initialData?.chatActor, initialData?.assistantId))
    }
  }, [open, initialData])

  const handleSave = () => {
    if (!name.trim()) return

    const trimmedName = name.trim()

    // Check for duplicate names (excluding current project when editing)
    const isDuplicate = folders.some(
      (folder) =>
        folder.name.toLowerCase() === trimmedName.toLowerCase() &&
        folder.id !== editingKey
    )

    if (isDuplicate) {
      toast.warning(t('projects.addProjectDialog.alreadyExists', { projectName: trimmedName }))
      return
    }

    onSave(
      trimmedName,
      selectedActor.type === 'assistant' ? selectedActor.id : undefined,
      selectedActor
    )

    // Show success message
    if (editingKey) {
      toast.success(t('projects.addProjectDialog.updateSuccess', { projectName: trimmedName }))
    } else {
      toast.success(t('projects.addProjectDialog.createSuccess', { projectName: trimmedName }))
    }
    setName('')
    setSelectedActor({ type: 'none' })
  }

  const handleCancel = () => {
    onOpenChange(false)
    setName('')
    setSelectedActor({ type: 'none' })
  }

  // Check if the button should be disabled
  const hasChanged = editingKey
    ? name.trim() !== initialData?.name ||
      JSON.stringify(selectedActor) !==
        JSON.stringify(normalizeChatActor(initialData?.chatActor, initialData?.assistantId))
    : true
  const isButtonDisabled = !name.trim() || (editingKey && !hasChanged)

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editingKey ? t('projects.addProjectDialog.editTitle') : t('projects.addProjectDialog.createTitle')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('projects.addProjectDialog.namePlaceholder')}
              className="mt-1"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isButtonDisabled) {
                  handleSave()
                }
              }}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              {t('projects.addProjectDialog.assistant')}
            </label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between rounded-md"
                >
                  <span className="truncate">{selectedActorLabel}</span>
                  <ChevronDown className="size-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width)">
                <AssistantsMenu
                  selectedActor={selectedActor}
                  onSelectActor={setSelectedActor}
                  assistants={assistants}
                />
                <button
                  type="button"
                  className="relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden hover:bg-accent"
                  onClick={() => setAddAssistantDialogOpen(true)}
                >
                  <div className="flex items-center gap-2">
                    <Plus className="size-4" />
                    <span>{t('projects.addProjectDialog.addAssistant')}</span>
                  </div>
                </button>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <DialogFooter>
          <Button size="sm" variant="ghost" onClick={handleCancel}>
            {t('cancel')}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={Boolean(isButtonDisabled)}>
            {editingKey ? t('projects.addProjectDialog.updateButton') : t('projects.addProjectDialog.createButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AddEditAssistant
      open={addAssistantDialogOpen}
      onOpenChange={setAddAssistantDialogOpen}
      editingKey={null}
      onSave={(assistant) => {
        addAssistant(assistant)
        setSelectedActor({ type: 'assistant', id: assistant.id })
      }}
    />
  </>
  )
}
