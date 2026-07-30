"use client";

// Composer for the agent panel.
//
// Visual design adapted from @kokonutui/ai-prompt; the textarea underneath it
// is replaced with Lexical. That swap is the whole reason for the file: `@`
// block references and `/` commands need atomic chips and a keyboard-driven
// menu, which a textarea cannot express and Lexical's node model can.
//
// Two menus, one plugin shape:
//   @  attaches context — picks a block, never acts
//   /  runs a command — most of which are local and cost no model call at all

import * as React from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  KEY_ENTER_COMMAND,
  type TextNode,
} from "lexical";
import { ArrowUp, ChevronDown, Sparkles, Square, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AGENT_COMMANDS,
  COMMAND_GROUP_ORDER,
  type AgentCommand,
} from "@/lib/agent/commands";
import { AGENT_MODELS } from "@/lib/agent/models";
import { summarizeBlock } from "@/lib/agent/tools";
import { findBlock, type EmailBlock, type EmailDocument } from "@/lib/email/document";
import { cn } from "@/lib/utils";

import { $createMentionNode, $isMentionNode, MentionNode } from "./mention-node";

export type ComposerSubmit = { text: string; references: string[] };

// ─── Menu options ─────────────────────────────────────────────────────────────

class BlockOption extends MenuOption {
  constructor(
    readonly blockId: string,
    readonly label: string,
    readonly blockType: string,
  ) {
    super(blockId);
  }
}

class CommandOption extends MenuOption {
  constructor(readonly command: AgentCommand) {
    super(command.id);
  }
}

/**
 * Shared popover shell so both menus look and behave identically.
 *
 * Positioned against the composer rather than the caret, and rendered inline
 * instead of through the plugin's anchor element. The plugin's anchor is
 * appended to document.body and sized from the caret rect — about 0px wide —
 * so portalling a fixed-width menu into it overflowed the body and shifted the
 * page, and the anchor carries no z-index so the menu sat under the editor
 * chrome. Anchoring to the composer also just reads better in a narrow
 * sidebar: the menu spans the input and opens upward into the conversation.
 */
function MenuShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-lg">
      <div className="max-h-64 overflow-y-auto overscroll-contain">{children}</div>
    </div>
  );
}

function MenuRow({
  active,
  title,
  subtitle,
  badge,
  onClick,
  onMouseEnter,
}: {
  active: boolean;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  onClick: () => void;
  onMouseEnter: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
        active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium">{title}</span>
        {subtitle && (
          <span className="block truncate text-[11px] text-muted-foreground">{subtitle}</span>
        )}
      </span>
      {badge}
    </button>
  );
}

// ─── @ blocks ─────────────────────────────────────────────────────────────────

function MentionsPlugin({ document }: { document: EmailDocument }) {
  const [editor] = useLexicalComposerContext();
  const [query, setQuery] = React.useState<string | null>(null);

  const triggerFn = useBasicTypeaheadTriggerMatch("@", { minLength: 0 });

  const options = React.useMemo(() => {
    const flat: Array<{ block: EmailBlock; label: string }> = document.blocks.map((block) => ({
      block,
      label: summarizeBlock(block, 46) || block.type,
    }));

    const needle = (query ?? "").toLowerCase();
    return flat
      // Match content or type, so "@but" finds the button and "@welcome"
      // finds the block whose heading says Welcome.
      .filter(
        ({ block, label }) =>
          !needle ||
          label.toLowerCase().includes(needle) ||
          block.type.toLowerCase().includes(needle),
      )
      .slice(0, 8)
      .map(({ block, label }) => new BlockOption(block.id, label, block.type));
  }, [document.blocks, query]);

  const onSelect = React.useCallback(
    (option: BlockOption, nodeToReplace: TextNode | null, closeMenu: () => void) => {
      editor.update(() => {
        const chip = $createMentionNode(option.blockId, option.label);
        if (nodeToReplace) nodeToReplace.replace(chip);
        else {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) selection.insertNodes([chip]);
        }
        // Trailing space so the next word isn't swallowed into the chip.
        const space = $createTextNode(" ");
        chip.insertAfter(space);
        space.select();
        closeMenu();
      });
    },
    [editor],
  );

  return (
    <LexicalTypeaheadMenuPlugin<BlockOption>
      options={options}
      onQueryChange={setQuery}
      onSelectOption={onSelect}
      triggerFn={triggerFn}
      menuRenderFn={(_anchorRef, { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }) =>
        options.length ? (
          <MenuShell>
            {options.map((option, i) => (
              <MenuRow
                key={option.blockId}
                active={selectedIndex === i}
                title={option.label}
                subtitle={`${option.blockType} · reference only`}
                onClick={() => {
                  setHighlightedIndex(i);
                  selectOptionAndCleanUp(option);
                }}
                onMouseEnter={() => setHighlightedIndex(i)}
              />
            ))}
          </MenuShell>
        ) : null
      }
    />
  );
}

// ─── / commands ───────────────────────────────────────────────────────────────

function CommandsPlugin({ onRun }: { onRun: (command: AgentCommand) => void }) {
  const [editor] = useLexicalComposerContext();
  const [query, setQuery] = React.useState<string | null>(null);

  const triggerFn = useBasicTypeaheadTriggerMatch("/", { minLength: 0 });

  const options = React.useMemo(() => {
    const needle = (query ?? "").toLowerCase();
    return AGENT_COMMANDS.filter(
      (command) =>
        !needle ||
        command.label.toLowerCase().includes(needle) ||
        command.group.toLowerCase().includes(needle),
    )
      // Group order is the menu's information architecture: parts you insert,
      // then look, then layout, then the ones that spend a model call.
      .sort(
        (a, b) =>
          COMMAND_GROUP_ORDER.indexOf(a.group) - COMMAND_GROUP_ORDER.indexOf(b.group),
      )
      .slice(0, 10)
      .map((command) => new CommandOption(command));
  }, [query]);

  const onSelect = React.useCallback(
    (option: CommandOption, nodeToReplace: TextNode | null, closeMenu: () => void) => {
      editor.update(() => {
        // The command text itself is never part of the message.
        nodeToReplace?.remove();
        closeMenu();
      });
      onRun(option.command);
    },
    [editor, onRun],
  );

  return (
    <LexicalTypeaheadMenuPlugin<CommandOption>
      options={options}
      onQueryChange={setQuery}
      onSelectOption={onSelect}
      triggerFn={triggerFn}
      menuRenderFn={(_anchorRef, { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }) =>
        options.length ? (
          <MenuShell>
            {options.map((option, i) => (
              <React.Fragment key={option.command.id}>
                {(i === 0 || options[i - 1].command.group !== option.command.group) && (
                  <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    {option.command.group}
                  </div>
                )}
                <MenuRow
                  active={selectedIndex === i}
                  title={option.command.label}
                  subtitle={option.command.hint}
                  badge={
                    option.command.usesAi ? (
                      // Makes the cost visible: everything without this badge
                      // is free and instant.
                      <span className="flex shrink-0 items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        <Sparkles className="size-2.5" />
                        AI
                      </span>
                    ) : null
                  }
                  onClick={() => {
                    setHighlightedIndex(i);
                    selectOptionAndCleanUp(option);
                  }}
                  onMouseEnter={() => setHighlightedIndex(i)}
                />
              </React.Fragment>
            ))}
          </MenuShell>
        ) : null
      }
    />
  );
}

// ─── Submit ───────────────────────────────────────────────────────────────────

/** Read the composer, pulling block ids out of the chips. */
function readComposer(): ComposerSubmit {
  const root = $getRoot();
  const references = root
    .getAllTextNodes()
    .filter($isMentionNode)
    .map((node) => node.getBlockId());
  return {
    text: root.getTextContent(),
    references: [...new Set(references)],
  };
}

function $clearComposer() {
  const root = $getRoot();
  root.clear();
  root.append($createParagraphNode());
}

function SubmitPlugin({
  onSubmit,
  onEmptyChange,
}: {
  onSubmit: (value: ComposerSubmit) => void;
  onEmptyChange: (empty: boolean) => void;
}) {
  const [editor] = useLexicalComposerContext();

  React.useEffect(
    () =>
      editor.registerUpdateListener(({ editorState }) => {
        onEmptyChange(!editorState.read(() => $getRoot().getTextContent()).trim());
      }),
    [editor, onEmptyChange],
  );

  React.useEffect(
    () =>
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event) => {
          // Shift+Enter is a newline. Plain Enter sends — chat convention.
          if (event?.shiftKey) return false;
          event?.preventDefault();
          const value = editor.getEditorState().read(readComposer);
          if (!value.text.trim()) return true;
          onSubmit(value);
          editor.update($clearComposer);
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
    [editor, onSubmit],
  );

  return null;
}

/** Send/stop button — inside the provider so it can read editor state. */
function SendButton({
  busy,
  empty,
  onSubmit,
  onStop,
}: {
  busy: boolean;
  empty: boolean;
  onSubmit: (value: ComposerSubmit) => void;
  onStop: () => void;
}) {
  const [editor] = useLexicalComposerContext();

  if (busy) {
    return (
      <button
        type="button"
        aria-label="Stop"
        onClick={onStop}
        className="rounded-lg bg-black/5 p-2 transition-colors hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10"
      >
        <Square className="size-4 fill-current" />
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label="Send message"
      disabled={empty}
      onClick={() => {
        const value = editor.getEditorState().read(readComposer);
        if (!value.text.trim()) return;
        onSubmit(value);
        editor.update($clearComposer);
      }}
      className="rounded-lg bg-black/5 p-2 transition-colors hover:bg-black/10 disabled:cursor-not-allowed dark:bg-white/5 dark:hover:bg-white/10"
    >
      <ArrowUp className={cn("size-4 transition-opacity", empty ? "opacity-30" : "opacity-100")} />
    </button>
  );
}

// ─── Composer ─────────────────────────────────────────────────────────────────

export function AgentComposer({
  document,
  busy,
  model,
  selectedBlockId,
  onModelChange,
  onSubmit,
  onRunCommand,
  onStop,
  placeholder = "Ask for a change, @ a block, / for commands",
}: {
  document: EmailDocument;
  busy: boolean;
  model: string;
  /** Block currently selected on the canvas, auto-attached as context. */
  selectedBlockId?: string;
  onModelChange: (model: string) => void;
  onSubmit: (value: ComposerSubmit) => void;
  onRunCommand: (command: AgentCommand) => void;
  onStop: () => void;
  placeholder?: string;
}) {
  const [empty, setEmpty] = React.useState(true);
  const activeModel = AGENT_MODELS.find((m) => m.id === model) ?? AGENT_MODELS[0];

  // Selecting a block on the canvas attaches it as context automatically, so
  // "make this shorter" resolves to the block you're looking at without
  // anyone typing an @ first.
  //
  // Shown as a pill above the input rather than injected as a chip inside it:
  // a chip that rewrites itself every time the canvas selection changes would
  // fight the user mid-sentence and move their caret. Dismissing is per-block,
  // so re-selecting or picking a different block re-attaches.
  const [dismissedId, setDismissedId] = React.useState<string | null>(null);
  const attachedId =
    selectedBlockId && selectedBlockId !== dismissedId ? selectedBlockId : null;
  const attachedBlock = attachedId ? findBlock(document.blocks, attachedId) : undefined;
  const attachedLabel = attachedBlock
    ? summarizeBlock(attachedBlock, 34) || attachedBlock.type
    : null;

  function handleSubmit(value: ComposerSubmit) {
    // Merge the auto-attached block in, without duplicating an explicit @.
    const references = attachedId
      ? [...new Set([...value.references, attachedId])]
      : value.references;
    onSubmit({ ...value, references });
  }

  return (
    <LexicalComposer
      initialConfig={{
        namespace: "letterstack-agent-composer",
        nodes: [MentionNode],
        theme: { paragraph: "m-0" },
        onError: (error) => console.error("Composer error", error),
      }}
    >
      {/* relative: both typeahead menus position against this box. */}
      <div className="relative rounded-2xl bg-black/5 p-1.5 dark:bg-white/5">
        {attachedLabel && (
          <div className="flex items-center gap-1.5 px-1.5 pb-1 pt-1">
            <span className="flex min-w-0 items-center gap-1 rounded-md bg-primary/12 py-0.5 pl-1.5 pr-1 text-[11px] font-medium text-primary">
              <span className="truncate">@{attachedLabel}</span>
              <button
                type="button"
                aria-label="Detach selected block"
                onClick={() => setDismissedId(attachedId)}
                className="shrink-0 rounded-sm p-0.5 hover:bg-primary/20"
              >
                <X className="size-2.5" />
              </button>
            </span>
            <span className="shrink-0 text-[10px] text-muted-foreground">selected</span>
          </div>
        )}

        <div className="relative px-2.5 py-2">
          <PlainTextPlugin
            contentEditable={
              <ContentEditable
                className="max-h-44 min-h-[3rem] w-full overflow-y-auto text-sm leading-relaxed outline-none"
                aria-label="Message the assistant"
              />
            }
            placeholder={
              <div className="pointer-events-none absolute left-2.5 top-2 select-none text-sm text-muted-foreground">
                {placeholder}
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>

        <div className="flex items-center justify-between gap-2 pl-1 pr-1 pb-0.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex h-8 items-center gap-1 rounded-md px-2 text-xs hover:bg-black/10 dark:hover:bg-white/10"
              >
                {activeModel.label}
                <ChevronDown className="size-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[13rem]">
              {AGENT_MODELS.map((entry) => (
                <DropdownMenuItem key={entry.id} onSelect={() => onModelChange(entry.id)}>
                  <span className="flex flex-col">
                    <span className="text-xs font-medium">{entry.label}</span>
                    <span className="text-[11px] text-muted-foreground">{entry.hint}</span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <SendButton busy={busy} empty={empty} onSubmit={handleSubmit} onStop={onStop} />
        </div>

        <SubmitPlugin onSubmit={handleSubmit} onEmptyChange={setEmpty} />
        <MentionsPlugin document={document} />
        <CommandsPlugin onRun={onRunCommand} />
        <HistoryPlugin />
      </div>
    </LexicalComposer>
  );
}
