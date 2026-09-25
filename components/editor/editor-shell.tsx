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
  LayoutTwoColumnIcon,
  PaintBrush01Icon,
} from "@hugeicons/core-free-icons"
import { useRouter } from "next/navigation"

import { alertDialog } from "@/components/app-dialogs"
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
  BASE_BLOCKS,
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
import { Spinner } from "@/components/ui/spinner"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/coss-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import {
  MoreHorizontalIcon,
  Redo2Icon,
  Undo2Icon,
  ChevronLeftIcon,
  PencilIcon,
  CodeIcon,
  EyeIcon,
  CheckIcon,
  AlertTriangleIcon,
  MonitorIcon,
  SmartphoneIcon,
  SearchIcon
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
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
import { compileEmailDocument } from "@/lib/email/compiler"
import { getEmailContainerShadow } from "@/lib/email/shadow"
import { cn } from "@/lib/utils"

type EditorView = "editor" | "html" | "preview"

type PreviewViewport = "desktop" | "mobile"

// Clipboard write with an execCommand fallback for non-secure contexts.
async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const textarea = globalThis.document.createElement("textarea")
  textarea.value = text
  textarea.setAttribute("readonly", "")
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  globalThis.document.body.appendChild(textarea)
  textarea.select()
  globalThis.document.execCommand("copy")
  textarea.remove()
}

// The dock's save indicator. "saving" and "error" exist because autosave
// happens without anyone asking for it — a silent background write that can
// fail needs somewhere to say so.
type DockStatus = "idle" | "saving" | "saved" | "copied" | "error"

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
   * Optional assistant, rendered as a tab in the left sidebar beside the block
   * library. A render prop rather than a built-in so /studio can host the agent
   * without this file growing again, and so /editor stays unchanged.
   *
   * It receives the canvas selection so the assistant can target whatever block
   * the user is actually looking at.
   */
  renderAssistant?: (api: {
    document: EmailDocument
    updateDocument: (updater: (current: EmailDocument) => EmailDocument) => void
    selectedBlockId: string
  }) => React.ReactNode
} = {}) {
  const router = useRouter()
  const [document, setDocument] =
    React.useState<EmailDocument>(() => initialDocument ?? initialEmailDocument)
  const [selectedBlockId, setSelectedBlockId] = React.useState<string>("")
  const [rightPanel, setRightPanel] = React.useState<"block" | "theme" | "settings" | null>(null)
  const [activeDrag, setActiveDrag] = React.useState<ActiveDrag | null>(null)
  const [insertTarget, setInsertTarget] = React.useState<InsertTarget | null>(null)
  const [dockStatus, setDockStatus] = React.useState<DockStatus>("idle")
  const [view, setView] = React.useState<EditorView>("editor")
  const [previewViewport, setPreviewViewport] = React.useState<PreviewViewport>("desktop")
  const [sidebarOpen, setSidebarOpen] = React.useState(true)
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

  const showDockStatus = React.useCallback(
    (status: Exclude<DockStatus, "idle" | "saving">) => {
      setDockStatus(status)

      if (saveStatusTimeoutRef.current) {
        clearTimeout(saveStatusTimeoutRef.current)
      }
      saveStatusTimeoutRef.current = setTimeout(
        () => {
          setDockStatus("idle")
          saveStatusTimeoutRef.current = null
        },
        // A failure stays up long enough to be read; a success is just
        // reassurance and can blink past.
        status === "error" ? 4000 : 1400
      )
    },
    []
  )

  // ── Autosave ──────────────────────────────────────────────────────────────
  // The editor used to write only when someone clicked Save, and nothing
  // guarded the tab, so closing mid-edit lost the work outright. Edits are now
  // written back shortly after typing stops.
  //
  // Everything here reads through refs rather than through `document`, so the
  // scheduling effect depends only on the document identity and is not torn
  // down and rebuilt on each keystroke.

  const AUTOSAVE_DELAY_MS = 1500

  const onSaveRef = React.useRef(onSave)
  React.useEffect(() => {
    onSaveRef.current = onSave
  }, [onSave])

  // The document last written successfully. Compared by reference, which is
  // sound because updateDocument always produces a new object — so an equal
  // reference really does mean nothing has changed since.
  const lastSavedRef = React.useRef<EmailDocument>(
    initialDocument ?? initialEmailDocument
  )
  const savingRef = React.useRef(false)
  const autosaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  /** Writes the current document. Returns false if the remote save failed. */
  const persistDocument = React.useCallback(async () => {
    const snapshot = documentRef.current
    savingRef.current = true
    try {
      // localStorage first and unconditionally: it is the offline copy that
      // makes a failed remote save recoverable rather than lost.
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
      await onSaveRef.current?.(snapshot)
      lastSavedRef.current = snapshot
      return true
    } catch (err) {
      console.error("[editor] save failed", err)
      return false
    } finally {
      savingRef.current = false
    }
  }, [])

  const saveDocument = React.useCallback(async () => {
    setDockStatus("saving")
    const ok = await persistDocument()
    showDockStatus(ok ? "saved" : "error")
  }, [persistDocument, showDockStatus])

  React.useEffect(() => {
    if (document === lastSavedRef.current) return

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null
      // A manual save may already be in flight; its own effect run will
      // reschedule this one if anything is still unsaved afterwards.
      if (savingRef.current) return
      void saveDocument()
    }, AUTOSAVE_DELAY_MS)

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    }
  }, [document, saveDocument])

  // Last line of defence: if edits are still unwritten — because autosave has
  // not fired yet, or because the remote save failed — make the browser ask
  // before the tab goes.
  React.useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (documentRef.current === lastSavedRef.current) return
      event.preventDefault()
      // Legacy browsers need returnValue set; modern ones ignore the string
      // and show their own wording.
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [])

  const copyTemplateJson = React.useCallback(async () => {
    await copyToClipboard(JSON.stringify(document, null, 2))
    showDockStatus("copied")
  }, [document, showDockStatus])

  // What the HTML and Preview views show — the exact compiler output that a
  // send would use, recompiled whenever the document changes.
  const compiled = React.useMemo(
    () => (view === "editor" ? null : compileEmailDocument(document)),
    [view, document]
  )

  const copyCompiledHtml = React.useCallback(async () => {
    await copyToClipboard(compileEmailDocument(documentRef.current).html)
    showDockStatus("copied")
  }, [showDockStatus])

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
        void alertDialog({
          title: "Invalid template JSON",
          description: "The pasted JSON is not a valid email template structure.",
        })
      }
    } catch {
      void alertDialog({
        title: "Invalid JSON",
        description: "The pasted text could not be parsed as JSON.",
      })
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

  const renameDocument = React.useCallback(
    (name: string) =>
      updateDocument((current) => touchDocument({ ...current, name })),
    [updateDocument]
  )

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
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
        <EditorHeader
          documentName={document.name}
          onRename={renameDocument}
          onExit={onExit ?? (() => router.push("/"))}
          onSave={() => void saveDocument()}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          status={dockStatus}
          mode={mode}
          onSaveAndExit={() => void saveAndExit()}
          onSaveAsTemplate={() => {
            setTemplateName(document.name || "")
            setSaveTemplateDialogOpen(true)
          }}
          onCopyJson={() => void copyTemplateJson()}
          onPasteJson={() => setPasteOpen(true)}
          view={view}
          onViewChange={setView}
          viewport={previewViewport}
          onViewportChange={(viewport) => {
            setPreviewViewport(viewport)
            // The device toggle only means anything in the rendered preview,
            // so picking one from another view jumps there.
            setView("preview")
          }}
        />
        
        <div className="flex-1 min-h-0 flex relative">
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
              className="min-h-0 h-full w-full !bg-background border-none"
              // Fold the block library away in HTML/preview — those views are
              // about the output, not editing. The inset keeps a small left
              // margin so its rounded edge never touches the screen.
              open={view === "editor" && sidebarOpen}
              onOpenChange={setSidebarOpen}
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
                assistant={renderAssistant?.({
                  document,
                  updateDocument,
                  selectedBlockId,
                })}
              />
              <SidebarInset className="min-h-0 overflow-hidden flex flex-col bg-background">
                <div className="relative flex min-h-0 flex-1 overflow-hidden">
              {view === "preview" && compiled ? (
                <EmailPreviewPane
                  html={compiled.html}
                  viewport={previewViewport}
                />
              ) : view === "html" && compiled ? (
                <EmailHtmlPane
                  html={compiled.html}
                  onCopy={() => void copyCompiledHtml()}
                />
              ) : (
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
              )}

              {view === "editor" && inspectorOpen && (
                <aside className="absolute right-4 top-4 bottom-4 z-20 flex w-[328px] flex-col overflow-hidden rounded-xl border bg-card shadow-2xl">
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

            </div>

      {/* Save as Template Dialog */}
      <Dialog open={saveTemplateDialogOpen} onOpenChange={setSaveTemplateDialogOpen}>
        <DialogPopup className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save as template</DialogTitle>
            <DialogDescription>
              Enter a name for this template to save it to your library.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
          <FieldGroup>
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
          </DialogPanel>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveTemplateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAsTemplateSubmit} disabled={savingTemplate || !templateName.trim()}>
              {savingTemplate ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {/* Paste JSON Dialog */}
      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogPopup className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Paste template JSON</DialogTitle>
            <DialogDescription>
              Paste the JSON code of a template below to load it into the editor canvas.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
          <FieldGroup>
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
          </DialogPanel>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePasteJson} disabled={!pasteJsonText.trim()}>
              Import JSON
            </Button>
          </DialogFooter>
        </DialogPopup>
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
        </div>
      </div>
    </EditorToolbarProvider>
  )
}

function EditorHeader({
  documentName,
  onRename,
  onExit,
  onSave,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  status,
  mode,
  onSaveAndExit,
  onSaveAsTemplate,
  onCopyJson,
  onPasteJson,
  view,
  onViewChange,
  viewport,
  onViewportChange,
}: {
  documentName: string
  onRename: (name: string) => void
  onExit?: () => void
  onSave?: () => void
  canUndo?: boolean
  canRedo?: boolean
  onUndo?: () => void
  onRedo?: () => void
  status: DockStatus
  mode: "campaign" | "template-creator" | "template-editor"
  onSaveAndExit: () => void
  onSaveAsTemplate: () => void
  onCopyJson: () => void
  onPasteJson: () => void
  view: EditorView
  onViewChange: (view: EditorView) => void
  viewport: PreviewViewport
  onViewportChange: (viewport: PreviewViewport) => void
}) {
  const views = [
    { id: "editor", label: "Editor", icon: PencilIcon },
    { id: "html", label: "HTML", icon: CodeIcon },
    { id: "preview", label: "Preview", icon: EyeIcon },
  ] as const
  return (
    <header className="flex h-12 shrink-0 items-center justify-between bg-background px-4">
      {/* Left: Back chevron + Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onExit}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          type="button"
          title="Leave the editor"
          aria-label="Leave the editor"
        >
          <ChevronLeftIcon className="size-4" />
        </button>
        <HeaderTitle name={documentName} onRename={onRename} />
      </div>

      {/* Center: Switcher (Editor / HTML / Preview) */}
      <div className="flex items-center gap-0.5 rounded-lg bg-muted p-1 border border-border/10">
        {views.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onViewChange(id)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3.5 py-1 text-xs transition-colors",
              view === id
                ? "bg-card font-semibold text-foreground shadow-xs border border-border/5"
                : "font-medium text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className={cn("size-3", view === id && "text-primary")} />
            {label}
          </button>
        ))}
      </div>

      {/* Right: Actions, Status & Viewport */}
      <div className="flex items-center gap-3">
        {/* Status Indicator — flashes briefly after a save or copy lands */}
        {status !== "idle" && (
          <span
            className={cn(
              "flex items-center gap-1 text-xs font-medium select-none mr-1.5",
              status === "saved" && "text-emerald-500",
              status === "error" && "text-destructive",
              (status === "copied" || status === "saving") && "text-muted-foreground"
            )}
          >
            {status === "error" ? (
              <AlertTriangleIcon className="size-3.5" />
            ) : status === "saving" ? (
              <Spinner className="size-3.5" />
            ) : (
              <CheckIcon className="size-3.5" />
            )}
            {status === "saving"
              ? "Saving…"
              : status === "saved"
                ? "Saved"
                : status === "error"
                  ? "Not saved"
                  : "Copied"}
          </span>
        )}

        {/* Undo/Redo Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 transition-colors"
            type="button"
            title="Undo"
            aria-label="Undo"
          >
            <Undo2Icon className="size-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 transition-colors"
            type="button"
            title="Redo"
            aria-label="Redo"
          >
            <Redo2Icon className="size-3.5" />
          </button>
        </div>

        {/* Vertical Divider */}
        <div className="h-4 w-px bg-border" />

        {/* Device Viewport Toggle (Desktop/Mobile) — drives the preview frame */}
        <div className="flex items-center gap-0.5 rounded-lg bg-muted p-1 border border-border/10">
          <button
            type="button"
            title="Desktop preview"
            aria-label="Desktop preview"
            onClick={() => onViewportChange("desktop")}
            className={cn(
              "flex size-7 items-center justify-center rounded-md transition-colors",
              viewport === "desktop"
                ? "bg-card text-foreground shadow-xs border border-border/5"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <MonitorIcon className="size-3.5" />
          </button>
          <button
            type="button"
            title="Mobile preview"
            aria-label="Mobile preview"
            onClick={() => onViewportChange("mobile")}
            className={cn(
              "flex size-7 items-center justify-center rounded-md transition-colors",
              viewport === "mobile"
                ? "bg-card text-foreground shadow-xs border border-border/5"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <SmartphoneIcon className="size-3.5" />
          </button>
        </div>

        {/* Vertical Divider */}
        <div className="h-4 w-px bg-border" />

        {/* Action Buttons. In template-creator mode the only real persist
            path is "save as template", so that takes the primary slot. */}
        <div className="flex items-center gap-1">
          {mode === "template-creator" ? (
            <Button
              onClick={onSaveAsTemplate}
              variant="default"
              size="sm"
              className="h-8 px-4 font-semibold shadow-xs"
            >
              Save as template
            </Button>
          ) : (
            <Button
              onClick={onSave}
              variant="default"
              size="sm"
              className="h-8 px-4 font-semibold shadow-xs"
            >
              Save
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                type="button"
                title="More actions"
                aria-label="More actions"
              >
                <MoreHorizontalIcon className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={onCopyJson}>
                <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} className="size-4 mr-2" />
                Copy JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onPasteJson}>
                <HugeiconsIcon icon={LayoutTwoColumnIcon} strokeWidth={2} className="size-4 mr-2" />
                Paste JSON
              </DropdownMenuItem>
              {mode !== "template-creator" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onSaveAndExit}>
                    <HugeiconsIcon icon={DoorOpenIcon} strokeWidth={2} className="size-4 mr-2" />
                    Save and exit
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

// The document name in the header, editable in place: click to swap the label
// for an input, commit on Enter/blur, Escape to cancel. Renames flow through
// updateDocument so they land in undo history like any other edit.
function HeaderTitle({
  name,
  onRename,
}: {
  name: string
  onRename: (name: string) => void
}) {
  const [draft, setDraft] = React.useState<string | null>(null)

  if (draft === null) {
    return (
      <button
        type="button"
        onClick={() => setDraft(name)}
        title="Rename"
        className="rounded-md px-1.5 py-0.5 text-sm font-semibold tracking-tight text-foreground transition-colors hover:bg-muted"
      >
        {name || "Untitled Email"}
      </button>
    )
  }

  const commit = () => {
    const next = draft.trim()
    if (next && next !== name) onRename(next)
    setDraft(null)
  }

  return (
    <Input
      autoFocus
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit()
        if (event.key === "Escape") setDraft(null)
      }}
      className="h-7 w-56 px-2 text-sm font-semibold"
    />
  )
}

// Renders the compiled email exactly as a client would, inside a sandboxed
// iframe so nothing in the output (links, raw-HTML blocks) can act on the app.
function EmailPreviewPane({
  html,
  viewport,
}: {
  html: string
  viewport: PreviewViewport
}) {
  return (
    <div className="flex min-h-0 flex-1 justify-center overflow-hidden bg-muted/30 p-4">
      <iframe
        title="Email preview"
        srcDoc={html}
        sandbox=""
        className={cn(
          "h-full rounded-lg border bg-white shadow-sm transition-[width] duration-200",
          viewport === "mobile" ? "w-[375px]" : "w-full"
        )}
      />
    </div>
  )
}

function EmailHtmlPane({
  html,
  onCopy,
}: {
  html: string
  onCopy: () => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-2">
        <p className="text-xs font-medium text-muted-foreground">
          Compiled email HTML — exactly what gets sent
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-xs"
          onClick={onCopy}
        >
          <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} data-icon="inline-start" />
          Copy HTML
        </Button>
      </div>
      <pre className="min-h-0 flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
        {html}
      </pre>
    </div>
  )
}

function EditorLeftSidebar({
  onAddBlock,
  onOpenTheme,
  assistant,
}: {
  onAddBlock: (type: EmailBlock["type"]) => void
  onOpenTheme: () => void
  // onOpenSettings kept off the params while the Campaign settings button is
  // commented out below; re-add it here (and in the caller) to restore.
  onOpenSettings?: () => void
  /** Rendered as a second tab when the host route provides one (/studio). */
  assistant?: React.ReactNode
}) {
  const [tab, setTab] = React.useState<"blocks" | "assistant">("blocks")
  // Without an assistant this is the plain block library, exactly as /editor
  // has always been — no tab strip, no layout shift.
  const showTabs = Boolean(assistant)
  const activeTab = showTabs ? tab : "blocks"

  return (
    <Sidebar variant="inset" collapsible="offcanvas" className="top-12 h-[calc(100vh-3rem)] bg-background [&>div]:bg-background">
      <SidebarContent className="overflow-hidden">
        {showTabs && (
          <div className="flex shrink-0 gap-1 p-2 pb-0">
            {(["blocks", "assistant"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={cn(
                  "flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold capitalize transition-colors",
                  activeTab === value
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {value}
              </button>
            ))}
          </div>
        )}

        <SidebarGroup className="min-h-0 flex-1 p-0">
          {activeTab === "assistant" ? (
            assistant
          ) : (
            <ScrollArea className="min-h-0 flex-1 [&_[data-slot=scroll-area-scrollbar]]:hidden">
              <BlockLibrary onAddBlock={onAddBlock} />
            </ScrollArea>
          )}
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
          {/* Campaign settings — hidden for now (not useful in the editor sidebar).
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
          */}
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
  const [searchQuery, setSearchQuery] = React.useState("")

  // Base blocks only. Composites (text section, article card) are offered
  // through the assistant's `/` menu instead, so the palette reads as a set of
  // parts rather than a mix of parts and pre-built layouts.
  const editorNewBlocks = React.useMemo(
    () => [
      ...BASE_BLOCKS,
      { type: "columns" as const, label: "Columns", icon: LayoutTwoColumnIcon },
    ],
    [],
  )

  const filteredBlocks = React.useMemo(() => {
    return editorNewBlocks.filter((block) =>
      block.label.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [editorNewBlocks, searchQuery])

  return (
    <div className="flex flex-col gap-4 p-3.5">
      {/* Header */}
      <div>
        <p className="text-sm font-bold text-foreground">Content blocks</p>
        <p className="text-[11px] text-muted-foreground/75 mt-0.5">
          Click to add a section to the email.
        </p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search blocks..."
          className="h-8.5 pl-8 pr-3 text-xs bg-muted/20 border-border/40 focus-visible:bg-background/80"
        />
      </div>

      {/* Grid of Blocks */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-3 px-0.5">
        {filteredBlocks.map(({ type, label, icon }) => (
          <DraggableBlockTile
            key={`${type}-${label}`}
            dragId={`editor-palette:${type}:${label}`}
            blockType={type}
            onAddBlock={onAddBlock}
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/20 text-muted-foreground group-hover:bg-muted/40 group-hover:text-foreground transition-all duration-200">
              <HugeiconsIcon icon={icon} strokeWidth={1.5} className="size-4.5" />
            </div>
            <span className="font-semibold text-xs text-muted-foreground/90 group-hover:text-foreground transition-colors truncate">
              {label === "rawHtml" ? "Code" : label === "articleCard" ? "Article" : label === "paragraph" ? "Text" : label}
            </span>
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
        "flex touch-none items-center gap-2.5 rounded-xl text-left transition-colors duration-200 hover:bg-muted/45 p-1 active:scale-[0.98] group w-full min-w-0",
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
      <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border bg-popover px-2 py-1.5 text-popover-foreground shadow-lg">
        <FormattingToolbar editor={activeEditor} />
        <Separator orientation="vertical" className="mx-1 data-vertical:h-7" />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
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

