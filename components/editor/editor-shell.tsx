"use client"

import * as React from "react"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useSensor,
  useSensors,
  type Active,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type Over,
} from "@dnd-kit/core"
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Cancel01Icon,
  Copy01Icon,
  DoorOpenIcon,
  FloppyDiskIcon,
  LayoutTwoColumnIcon,
  PaintBrush01Icon,
  Settings02Icon,
} from "@hugeicons/core-free-icons"
import { useRouter } from "next/navigation"

import { BlockInspector } from "@/components/editor/block-inspector"
import { CanvasBlockPreview } from "@/components/editor/canvas-block-preview"
import {
  CANVAS_ROOT_CONTAINER,
  CanvasProvider,
  type CanvasContextValue,
  type InsertTarget,
} from "@/components/editor/canvas-context"
import {
  EditorToolbarProvider,
  useEditorToolbar,
} from "@/components/editor/editor-toolbar-context"
import {
  BLOCK_LABELS,
  CONTENT_BLOCKS,
} from "@/components/editor/editor-types"
import { FormattingToolbar } from "@/components/editor/formatting-toolbar"
import { SortableBlockList } from "@/components/editor/sortable-block-list"
import { StylesPanel } from "@/components/editor/styles-panel"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { MoreHorizontalIcon, Redo2Icon, Undo2Icon } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import {
  createBlock,
  duplicateBlock,
  findBlock,
  initialEmailDocument,
  insertBlockAtIndex,
  isEmailDocument,
  locateBlock,
  reorderBlocks,
  removeBlock,
  STORAGE_KEY,
  touchDocument,
  updateBlock,
  type EmailBlock,
  type EmailDocument,
} from "@/lib/email/document"
import { getEmailContainerShadow } from "@/lib/email/shadow"
import { cn } from "@/lib/utils"

type ActiveDrag =
  | { kind: "palette"; blockType: EmailBlock["type"] }
  | { kind: "block"; block: EmailBlock; width: number }

type DragData = {
  kind?: "palette" | "block" | "cell"
  blockType?: EmailBlock["type"]
  columnId?: string
  containerId?: string
}

export function EditorShell({
  initialDocument,
  onSave,
  onExit,
  onSaveAsTemplate,
  mode = "campaign",
  renderAssistant,
}: {
  initialDocument?: EmailDocument
  onSave?: (doc: EmailDocument) => Promise<void>
  onExit?: () => void
  onSaveAsTemplate?: (doc: EmailDocument, name: string) => Promise<void>
  mode?: "campaign" | "template-creator" | "template-editor"
  /**
   * Optional docked panel on the right, given the live document and the same
   * updater every other surface writes through. A render prop rather than a
   * built-in so /studio can host the agent without this file growing again,
   * and so /editor stays byte-identical in behaviour.
   */
  renderAssistant?: (api: {
    document: EmailDocument
    updateDocument: (updater: (current: EmailDocument) => EmailDocument) => void
  }) => React.ReactNode
} = {}) {
  const router = useRouter()
  const [document, setDocument] =
    React.useState<EmailDocument>(() => initialDocument ?? initialEmailDocument)
  const [selectedBlockId, setSelectedBlockId] = React.useState<string>("")
  const [rightPanel, setRightPanel] = React.useState<"block" | "theme" | "settings" | null>(null)
  const [activeDrag, setActiveDrag] = React.useState<ActiveDrag | null>(null)
  const [insertTarget, setInsertTarget] = React.useState<InsertTarget | null>(null)
  const [dockStatus, setDockStatus] = React.useState<"idle" | "saved" | "copied">("idle")
  const saveStatusTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = React.useState(false)
  const [templateName, setTemplateName] = React.useState("")
  const [savingTemplate, setSavingTemplate] = React.useState(false)
  const [pasteOpen, setPasteOpen] = React.useState(false)
  const [pasteJsonText, setPasteJsonText] = React.useState("")

  const selectedBlock = findBlock(document.blocks, selectedBlockId)
  const selectedLocation = locateBlock(document.blocks, selectedBlockId)
  const selectedIndex = selectedLocation?.index ?? -1
  const inspectorOpen =
    rightPanel === "theme" || rightPanel === "settings" || Boolean(selectedBlock)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // ── Undo/redo history ────────────────────────────────────────────────────
  // Every edit lands through updateDocument, which snapshots the previous
  // document. Rapid bursts (typing) within 500ms collapse into one undo step.
  // documentRef mirrors the latest document synchronously so multiple edits in
  // one tick (and undo/redo themselves) never read a stale value.
  const HISTORY_LIMIT = 100
  const documentRef = React.useRef(document)
  const historyRef = React.useRef<{
    past: EmailDocument[]
    future: EmailDocument[]
    lastPushAt: number
  }>({ past: [], future: [], lastPushAt: 0 })
  const [historyTick, setHistoryTick] = React.useState(0)

  React.useEffect(() => {
    documentRef.current = document
  }, [document])

  const updateDocument = React.useCallback(
    (updater: (current: EmailDocument) => EmailDocument) => {
      const current = documentRef.current
      const next = updater(current)
      if (next === current) return

      const history = historyRef.current
      const now = Date.now()
      if (now - history.lastPushAt > 500) {
        history.past = [...history.past.slice(-(HISTORY_LIMIT - 1)), current]
      }
      history.lastPushAt = now
      history.future = []

      documentRef.current = next
      setDocument(next)
      setHistoryTick((tick) => tick + 1)
    },
    []
  )

  const undo = React.useCallback(() => {
    const history = historyRef.current
    const previous = history.past[history.past.length - 1]
    if (!previous) return
    history.past = history.past.slice(0, -1)
    history.future = [...history.future, documentRef.current]
    history.lastPushAt = 0
    documentRef.current = previous
    setDocument(previous)
    setHistoryTick((tick) => tick + 1)
  }, [])

  const redo = React.useCallback(() => {
    const history = historyRef.current
    const next = history.future[history.future.length - 1]
    if (!next) return
    history.future = history.future.slice(0, -1)
    history.past = [...history.past, documentRef.current]
    history.lastPushAt = 0
    documentRef.current = next
    setDocument(next)
    setHistoryTick((tick) => tick + 1)
  }, [])

  void historyTick // state exists to refresh canUndo/canRedo below
  const canUndo = historyRef.current.past.length > 0
  const canRedo = historyRef.current.future.length > 0

  // Ctrl/Cmd+Z to undo, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y to redo. Text fields
  // and the rich-text editor keep their own native undo, so skip those.
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey)) return
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return
      }
      const key = event.key.toLowerCase()
      if (key === "z" && !event.shiftKey) {
        event.preventDefault()
        undo()
      } else if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault()
        redo()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [undo, redo])

  React.useEffect(() => {
    return () => {
      if (saveStatusTimeoutRef.current) {
        clearTimeout(saveStatusTimeoutRef.current)
      }
    }
  }, [])

  const showDockStatus = React.useCallback((status: "saved" | "copied") => {
    setDockStatus(status)

    if (saveStatusTimeoutRef.current) {
      clearTimeout(saveStatusTimeoutRef.current)
    }
    saveStatusTimeoutRef.current = setTimeout(() => {
      setDockStatus("idle")
      saveStatusTimeoutRef.current = null
    }, 1400)
  }, [])

  const saveDocument = React.useCallback(async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(document))
    if (onSave) {
      await onSave(document)
    }
    showDockStatus("saved")
  }, [document, onSave, showDockStatus])

  const copyTemplateJson = React.useCallback(async () => {
    const json = JSON.stringify(document, null, 2)

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(json)
    } else {
      const textarea = globalThis.document.createElement("textarea")
      textarea.value = json
      textarea.setAttribute("readonly", "")
      textarea.style.position = "fixed"
      textarea.style.opacity = "0"
      globalThis.document.body.appendChild(textarea)
      textarea.select()
      globalThis.document.execCommand("copy")
      textarea.remove()
    }

    showDockStatus("copied")
  }, [document, showDockStatus])

  const handlePasteJson = React.useCallback(() => {
    try {
      const parsed = JSON.parse(pasteJsonText)
      if (isEmailDocument(parsed)) {
        // Through updateDocument so a bad paste is one Ctrl+Z away from undone.
        updateDocument(() => parsed)
        setPasteOpen(false)
        setPasteJsonText("")
        showDockStatus("saved")
      } else {
        alert("Invalid email template JSON structure.")
      }
    } catch {
      alert("Invalid JSON format.")
    }
  }, [pasteJsonText, showDockStatus, updateDocument])

  const handleSaveAsTemplateSubmit = React.useCallback(async () => {
    if (!templateName.trim()) return
    setSavingTemplate(true)
    try {
      if (onSaveAsTemplate) {
        await onSaveAsTemplate(document, templateName)
      }
      setSaveTemplateDialogOpen(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSavingTemplate(false)
    }
  }, [templateName, document, onSaveAsTemplate])

  const saveAndExit = React.useCallback(async () => {
    await saveDocument()
    if (onExit) {
      onExit()
    } else {
      router.push("/")
    }
  }, [saveDocument, onExit, router])

  const addBlock = React.useCallback(
    (type: EmailBlock["type"]) => {
      const block = createBlock(type)
      updateDocument((current) =>
        touchDocument({ ...current, blocks: [...current.blocks, block] })
      )
      setSelectedBlockId(block.id)
      setRightPanel("block")
    },
    [updateDocument]
  )

  const columnBlocks = React.useCallback(
    (containerId: string): EmailBlock[] => {
      if (containerId === CANVAS_ROOT_CONTAINER) return document.blocks
      for (const block of document.blocks) {
        if (block.type === "columns") {
          const column = block.columns.find((item) => item.id === containerId)
          if (column) return column.blocks
        }
      }
      return []
    },
    [document.blocks]
  )

  const collisionDetection = React.useCallback<CollisionDetection>((args) => {
    const pointerHits = pointerWithin(args)
    const hits = pointerHits.length ? pointerHits : rectIntersection(args)
    const specific = hits.find((hit) => hit.id !== CANVAS_ROOT_CONTAINER)
    return specific ? [specific] : hits
  }, [])

  const resolveTarget = React.useCallback(
    (active: Active, over: Over): InsertTarget | null => {
      const overData = (over.data.current ?? {}) as DragData

      if (over.id === CANVAS_ROOT_CONTAINER) {
        return { containerId: CANVAS_ROOT_CONTAINER, index: document.blocks.length }
      }
      if (overData.kind === "block" && overData.containerId) {
        const list = columnBlocks(overData.containerId)
        const index = list.findIndex((block) => block.id === over.id)
        if (index < 0) return null
        const activeRect = active.rect.current.translated
        const activeCenterY = activeRect ? activeRect.top + activeRect.height / 2 : 0
        const overCenterY = over.rect.top + over.rect.height / 2
        const before = activeCenterY < overCenterY
        return {
          containerId: overData.containerId,
          index: before ? index : index + 1,
        }
      }
      return null
    },
    [columnBlocks, document.blocks.length]
  )

  const moveBlockTo = React.useCallback(
    (blockId: string, sourceContainer: string, target: InsertTarget) => {
      const moving = findBlock(document.blocks, blockId)
      if (!moving) return
      if (moving.type === "columns" && target.containerId !== CANVAS_ROOT_CONTAINER) {
        return
      }

      const sourceList = columnBlocks(sourceContainer)
      const sourceIndex = sourceList.findIndex((block) => block.id === blockId)
      let insertIndex = target.index
      if (
        sourceContainer === target.containerId &&
        sourceIndex >= 0 &&
        sourceIndex < insertIndex
      ) {
        insertIndex -= 1
      }
      if (sourceContainer === target.containerId && sourceIndex === insertIndex) {
        return
      }

      updateDocument((current) => {
        const detached = removeBlock(current, blockId)
        return insertBlockAtIndex(detached, insertIndex, moving)
      })
    },
    [columnBlocks, document.blocks, updateDocument]
  )

  const handleDragStart = React.useCallback(
    (event: DragStartEvent) => {
      const data = (event.active.data.current ?? {}) as DragData
      if (data.kind === "palette" && data.blockType) {
        setActiveDrag({ kind: "palette", blockType: data.blockType })
        return
      }
      const block = findBlock(document.blocks, String(event.active.id))
      if (block) {
        setActiveDrag({
          kind: "block",
          block,
          width: event.active.rect.current.initial?.width ?? document.settings.maxWidth,
        })
      }
    },
    [document.blocks, document.settings.maxWidth]
  )

  const handleDragOver = React.useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event
      setInsertTarget(over ? resolveTarget(active, over) : null)
    },
    [resolveTarget]
  )

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      const data = (active.data.current ?? {}) as DragData
      const target = over ? resolveTarget(active, over) : null

      if (data.kind === "palette" && data.blockType && target) {
        if (!(data.blockType === "columns" && target.containerId !== CANVAS_ROOT_CONTAINER)) {
          const block = createBlock(data.blockType)
          updateDocument((current) => insertBlockAtIndex(current, target.index, block))
          setSelectedBlockId(block.id)
          setRightPanel("block")
        }
      } else if (data.kind === "block" && target) {
        moveBlockTo(
          String(active.id),
          data.containerId ?? CANVAS_ROOT_CONTAINER,
          target
        )
      }

      setActiveDrag(null)
      setInsertTarget(null)
    },
    [moveBlockTo, resolveTarget, updateDocument]
  )

  const handleDragCancel = React.useCallback(() => {
    setActiveDrag(null)
    setInsertTarget(null)
  }, [])

  const canvasValue = React.useMemo<CanvasContextValue>(
    () => ({
      document,
      selectedBlockId,
      insertTarget,
      onSelect: (id) => {
        setSelectedBlockId(id)
        setRightPanel("block")
      },
      onUpdateBlock: (id, updater) =>
        updateDocument((current) => updateBlock(current, id, updater)),
      onDuplicate: (id) =>
        updateDocument((current) => duplicateBlock(current, id)),
      onRemove: (id) => {
        updateDocument((current) => removeBlock(current, id))
        if (selectedBlockId === id) {
          setSelectedBlockId("")
          setRightPanel(null)
        }
      },
      onReorderTop: (from, to) =>
        updateDocument((current) => reorderBlocks(current, from, to)),
      onReorderColumn: () => {},
      onAddToColumn: () => {},
    }),
    [document, insertTarget, selectedBlockId, updateDocument]
  )

  return (
    <EditorToolbarProvider>
      <DndContext
        id="editor-dnd"
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SidebarProvider
          style={
            {
              "--sidebar-width": "19rem",
            } as React.CSSProperties
          }
        >
          <EditorLeftSidebar
            onAddBlock={addBlock}
            onOpenTheme={() => {
              setSelectedBlockId("")
              setRightPanel("theme")
            }}
            onOpenSettings={() => {
              setSelectedBlockId("")
              setRightPanel("settings")
            }}
          />
          <SidebarInset className="h-[calc(100svh-1rem)] overflow-hidden">
            {/* <EditorHeader /> */}
            <div className="relative flex min-h-0 flex-1 overflow-hidden">
              <CanvasProvider value={canvasValue}>
                <EmailCanvas
                  document={document}
                  inspectorOpen={inspectorOpen}
                  onCloseInspector={() => {
                    setSelectedBlockId("")
                    setRightPanel(null)
                  }}
                />
              </CanvasProvider>

              {/* Docked, not floating: the assistant is a workspace of its own,
                  and the canvas should reflow rather than be covered. */}
              {renderAssistant?.({ document, updateDocument })}

              {inspectorOpen && (
                <aside className="absolute right-4 top-4 bottom-4 z-20 flex w-[328px] flex-col overflow-hidden rounded-3xl border bg-card shadow-2xl">
                  {rightPanel === "theme" ? (
                    <StylesPanel
                      document={document}
                      onUpdateDocument={updateDocument}
                    />
                  ) : rightPanel === "settings" ? (
                    <CampaignSettingsPanel
                      document={document}
                      onUpdateDocument={updateDocument}
                    />
                  ) : selectedBlock ? (
                    <BlockInspector
                      block={selectedBlock}
                      document={document}
                      onBack={() => {
                        setSelectedBlockId("")
                        setRightPanel(null)
                      }}
                      onMoveUp={() => {
                        if (selectedIndex > 0) {
                          updateDocument((current) =>
                            reorderBlocks(current, selectedIndex, selectedIndex - 1)
                          )
                        }
                      }}
                      onMoveDown={() => {
                        if (selectedIndex >= 0 && selectedIndex < document.blocks.length - 1) {
                          updateDocument((current) =>
                            reorderBlocks(current, selectedIndex, selectedIndex + 1)
                          )
                        }
                      }}
                      onUpdateDocument={updateDocument}
                    />
                  ) : null}
                </aside>
              )}

          <EditorBottomDock
            inspectorOpen={inspectorOpen}
            dockStatus={dockStatus}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            onCopyJson={copyTemplateJson}
            onPasteJson={() => setPasteOpen(true)}
            onSave={saveDocument}
            onSaveAndExit={saveAndExit}
            onSaveAsTemplate={() => {
              setTemplateName(document.name || "")
              setSaveTemplateDialogOpen(true)
            }}
            mode={mode}
          />
            </div>

      {/* Save as Template Dialog */}
      <Dialog open={saveTemplateDialogOpen} onOpenChange={setSaveTemplateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save as template</DialogTitle>
            <DialogDescription>
              Enter a name for this template to save it to your library.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-2">
            <Field>
              <FieldLabel htmlFor="template-name-input">Template name</FieldLabel>
              <Input
                id="template-name-input"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. Monthly Newsletter, Product Promo"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && templateName.trim()) handleSaveAsTemplateSubmit();
                }}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveTemplateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAsTemplateSubmit} disabled={savingTemplate || !templateName.trim()}>
              {savingTemplate ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Paste JSON Dialog */}
      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Paste template JSON</DialogTitle>
            <DialogDescription>
              Paste the JSON code of a template below to load it into the editor canvas.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-2">
            <Field>
              <FieldLabel htmlFor="paste-json-input">JSON Code</FieldLabel>
              <Textarea
                id="paste-json-input"
                value={pasteJsonText}
                onChange={(e) => setPasteJsonText(e.target.value)}
                placeholder='{ "settings": {...}, "blocks": [...] }'
                className="min-h-44 font-mono text-xs p-3 rounded-lg border border-border"
                spellCheck={false}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePasteJson} disabled={!pasteJsonText.trim()}>
              Import JSON
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
          </SidebarInset>
        </SidebarProvider>

        <DragOverlay dropAnimation={null}>
          {activeDrag?.kind === "block" ? (
            <div
              className="cursor-grabbing overflow-hidden rounded-md bg-card shadow-2xl ring-2 ring-primary"
              style={{
                width: activeDrag.width,
                backgroundColor: document.settings.contentColor,
              }}
            >
              <CanvasBlockPreview
                block={activeDrag.block}
                document={document}
              />
            </div>
          ) : activeDrag?.kind === "palette" ? (
            <PaletteDragChip blockType={activeDrag.blockType} />
          ) : null}
        </DragOverlay>
      </DndContext>
    </EditorToolbarProvider>
  )
}

// function EditorHeader() {
//   return (
//     <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background/95">
//       <div className="flex items-center gap-2 px-4">
//         <SidebarTrigger className="-ml-1" />
//         <Separator
//           orientation="vertical"
//           className="mr-2 data-vertical:h-4 data-vertical:self-auto"
//         />
//         <Breadcrumb>
//           <BreadcrumbList>
//             <BreadcrumbItem className="hidden md:block">
//               <BreadcrumbLink href="#">LetterStack</BreadcrumbLink>
//             </BreadcrumbItem>
//             <BreadcrumbSeparator className="hidden md:block" />
//             <BreadcrumbItem>
//               <BreadcrumbPage>Editor New</BreadcrumbPage>
//             </BreadcrumbItem>
//           </BreadcrumbList>
//         </Breadcrumb>
//       </div>
//     </header>
//   )
// }

function EditorBottomDock({
  inspectorOpen,
  dockStatus,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onCopyJson,
  onPasteJson,
  onSave,
  onSaveAndExit,
  onSaveAsTemplate,
  mode,
}: {
  inspectorOpen: boolean
  dockStatus: "idle" | "saved" | "copied"
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onCopyJson: () => Promise<void>
  onPasteJson: () => void
  onSave: () => void
  onSaveAndExit: () => void
  onSaveAsTemplate: () => void
  mode: "campaign" | "template-creator" | "template-editor"
}) {
  return (
    <div
      className={cn(
        "absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-xl border bg-card/95 p-1 shadow-2xl backdrop-blur transition-[left] duration-200",
        inspectorOpen && "xl:left-[calc(50%-188px)]",
      )}
      onClick={(event) => event.stopPropagation()}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
      >
        <Undo2Icon className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo (Ctrl+Shift+Z)"
        aria-label="Redo"
      >
        <Redo2Icon className="size-4" />
      </Button>

      <Separator orientation="vertical" className="h-4 mx-0.5" />

      {/* 3 dots menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => void onCopyJson()}>
            <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} className="size-4 mr-2" />
            Copy JSON
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onPasteJson}>
            <HugeiconsIcon icon={LayoutTwoColumnIcon} strokeWidth={2} className="size-4 mr-2" />
            Paste JSON
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="h-4 mx-0.5" />

      {mode === "template-creator" ? (
        <Button type="button" size="sm" className="h-8 px-3 text-xs" onClick={onSaveAsTemplate}>
          <HugeiconsIcon icon={FloppyDiskIcon} strokeWidth={2} data-icon="inline-start" />
          Save as template
        </Button>
      ) : (
        <>
          <Button type="button" variant="outline" size="sm" className="h-8 px-2.5 text-xs" onClick={onSave}>
            <HugeiconsIcon icon={FloppyDiskIcon} strokeWidth={2} data-icon="inline-start" />
            Save
          </Button>
          <Button type="button" size="sm" className="h-8 px-2.5 text-xs" onClick={onSaveAndExit}>
            <HugeiconsIcon icon={DoorOpenIcon} strokeWidth={2} data-icon="inline-start" />
            Save and exit
          </Button>
        </>
      )}

      {dockStatus !== "idle" && (
        <span className="px-1.5 text-[11px] font-medium text-muted-foreground">
          {dockStatus === "saved" ? "Saved" : "Copied JSON"}
        </span>
      )}
    </div>
  )
}

function EditorLeftSidebar({
  onAddBlock,
  onOpenTheme,
  onOpenSettings,
}: {
  onAddBlock: (type: EmailBlock["type"]) => void
  onOpenTheme: () => void
  onOpenSettings: () => void
}) {
  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="border-b p-2">
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} />
          </div>
          <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">LetterStack</span>
            <span className="truncate text-xs text-sidebar-foreground/60">
              Campaign editor
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="overflow-hidden">
        <SidebarGroup className="min-h-0 flex-1 p-0">
          <ScrollArea className="min-h-0 flex-1">
            <BlockLibrary onAddBlock={onAddBlock} />
          </ScrollArea>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-2">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            className="h-10 flex-1 justify-start px-2 text-sm font-semibold"
            onClick={onOpenTheme}
          >
            <HugeiconsIcon
              icon={PaintBrush01Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Edit theme
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            title="Campaign settings"
            aria-label="Campaign settings"
            onClick={onOpenSettings}
          >
            <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

function BlockLibrary({
  onAddBlock,
}: {
  onAddBlock: (type: EmailBlock["type"]) => void
}) {
  const editorNewBlocks = React.useMemo(
    () => [
      ...CONTENT_BLOCKS,
      { type: "columns" as const, label: "Columns", icon: LayoutTwoColumnIcon },
    ],
    [],
  )

  return (
    <div className="flex flex-col gap-2 p-2">
      <div>
        <p className="text-sm font-medium">Content blocks</p>
        <p className="text-xs text-sidebar-foreground/60">
          Click to add a section to the email.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {editorNewBlocks.map(({ type, label, icon }) => (
          <DraggableBlockTile
            key={`${type}-${label}`}
            dragId={`editor-palette:${type}:${label}`}
            blockType={type}
            onAddBlock={onAddBlock}
          >
            <HugeiconsIcon icon={icon} strokeWidth={1.5} className="size-4" />
            <span className="w-full truncate leading-tight">{label}</span>
          </DraggableBlockTile>
        ))}
      </div>
    </div>
  )
}

function DraggableBlockTile({
  dragId,
  blockType,
  onAddBlock,
  children,
}: {
  dragId: string
  blockType: EmailBlock["type"]
  onAddBlock: (type: EmailBlock["type"]) => void
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    data: { kind: "palette", blockType },
  })

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      onClick={() => onAddBlock(blockType)}
      className={cn(
        "flex aspect-square touch-none flex-col items-center justify-center gap-1 rounded-lg border bg-background px-1.5 text-center text-[10px] text-foreground/75 transition-colors hover:bg-accent hover:text-foreground active:scale-[0.98]",
        isDragging && "opacity-40"
      )}
    >
      {children}
    </button>
  )
}

function CampaignSettingsPanel({
  document,
  onUpdateDocument,
}: {
  document: EmailDocument
  onUpdateDocument: (updater: (current: EmailDocument) => EmailDocument) => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-b px-4 py-3">
        <p className="text-sm font-semibold">Settings</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Campaign details and sender information
        </p>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <CampaignSettings
          document={document}
          onUpdateDocument={onUpdateDocument}
        />
      </ScrollArea>
    </div>
  )
}

function CampaignSettings({
  document,
  onUpdateDocument,
}: {
  document: EmailDocument
  onUpdateDocument: (updater: (current: EmailDocument) => EmailDocument) => void
}) {
  return (
    <FieldGroup className="p-3">
      <Field>
        <FieldTitle>Campaign settings</FieldTitle>
      </Field>
      <Field>
        <FieldLabel htmlFor="new-doc-name">Campaign name</FieldLabel>
        <Input
          id="new-doc-name"
          value={document.name}
          onChange={(event) =>
            onUpdateDocument((current) =>
              touchDocument({ ...current, name: event.target.value })
            )
          }
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="new-subject">Subject line</FieldLabel>
        <Input
          id="new-subject"
          value={document.subject}
          onChange={(event) =>
            onUpdateDocument((current) =>
              touchDocument({ ...current, subject: event.target.value })
            )
          }
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="new-from-name">From name</FieldLabel>
        <Input
          id="new-from-name"
          value={document.fromName}
          onChange={(event) =>
            onUpdateDocument((current) =>
              touchDocument({ ...current, fromName: event.target.value })
            )
          }
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="new-from-email">From email</FieldLabel>
        <Input
          id="new-from-email"
          type="email"
          value={document.fromEmail}
          onChange={(event) =>
            onUpdateDocument((current) =>
              touchDocument({ ...current, fromEmail: event.target.value })
            )
          }
        />
      </Field>
    </FieldGroup>
  )
}

function EmailCanvas({
  document,
  inspectorOpen,
  onCloseInspector,
}: {
  document: EmailDocument
  inspectorOpen: boolean
  onCloseInspector: () => void
}) {
  return (
    <section
      className="flex min-h-0 flex-1 overflow-hidden [&_.ls-hover-drag-handle]:hidden [&_.ls-selected-block-highlight]:shadow-[inset_0_0_0_2px_var(--primary),0_0_0_3px_color-mix(in_oklch,var(--primary),transparent_78%)]"
      style={{ backgroundColor: document.settings.backgroundColor }}
    >
      <div
        className={cn(
          "flex min-h-full w-full flex-col items-center overflow-auto px-8 py-8 transition-[padding] duration-200 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          inspectorOpen && "xl:pr-[376px]"
        )}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            onCloseInspector()
          }
        }}
      >
        <CanvasFormattingToolbar onClose={onCloseInspector} />
        <div
          className="relative w-full overflow-visible bg-card"
          style={{
            maxWidth: document.settings.maxWidth,
            borderRadius: document.settings.radius,
            backgroundColor: document.settings.contentColor,
            boxShadow: getEmailContainerShadow(document.settings),
          }}
        >
          <SortableBlockList />
        </div>
      </div>
    </section>
  )
}

function PaletteDragChip({ blockType }: { blockType: EmailBlock["type"] }) {
  const entry = CONTENT_BLOCKS.find((block) => block.type === blockType)

  return (
    <div className="flex cursor-grabbing items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs font-medium shadow-xl">
      {entry && (
        <HugeiconsIcon
          icon={entry.icon}
          strokeWidth={1.5}
          className="size-4 text-foreground/60"
        />
      )}
      {BLOCK_LABELS[blockType]}
    </div>
  )
}

function CanvasFormattingToolbar({ onClose }: { onClose: () => void }) {
  const { activeEditor } = useEditorToolbar()

  if (!activeEditor) return null

  return (
    <div
      className="sticky top-4 z-30 mb-8 flex w-full justify-center"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-3xl border border-white/10 bg-zinc-950 px-3 py-2 text-zinc-100 shadow-2xl">
        <FormattingToolbar editor={activeEditor} />
        <Separator orientation="vertical" className="mx-1 data-vertical:h-7" />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onClose}
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} data-icon="icon" />
          <span className="sr-only">Close formatting toolbar</span>
        </Button>
      </div>
    </div>
  )
}

