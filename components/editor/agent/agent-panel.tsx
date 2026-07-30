"use client";

// The agent panel: conversation, tool activity, composer.
//
// Structure follows the AI Elements vocabulary (Conversation → Message → Tool →
// Prompt Input) but is built from this project's own shadcn components. The
// Elements CLI wanted to overwrite components/ui/textarea.tsx, and this repo
// treats components/ui as read-only.
//
// The design bet: tool calls are the interesting content, not chat. A user
// watching the email rebuild itself cares which blocks changed, so tool
// activity renders as compact labelled rows rather than being hidden behind a
// disclosure. Prose from the model is deliberately secondary.

import * as React from "react";
import {
  AlertCircleIcon,
  CheckIcon,
  Loader2Icon,
  SparklesIcon,
  UndoIcon,
} from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { resolveCommandPrompt, type AgentCommand } from "@/lib/agent/commands";
import { summarizeBlock } from "@/lib/agent/tools";
import { useAgent } from "@/lib/agent/use-agent";
import { createId, findBlock, type EmailDocument } from "@/lib/email/document";
import { cn } from "@/lib/utils";

import { AgentComposer } from "./agent-composer";

/** Human labels for tool names — "updateBlock" is our jargon, not the user's. */
const TOOL_LABELS: Record<string, string> = {
  readBlock: "Reading",
  addBlock: "Adding a block",
  updateBlock: "Editing",
  setBlockStyle: "Restyling",
  removeBlock: "Removing a block",
  moveBlock: "Reordering",
  duplicateBlock: "Duplicating",
  setCustomHtml: "Writing HTML",
  setDocumentSettings: "Updating the theme",
  setSubject: "Setting the subject",
};

type ToolState = string;

function ToolRow({ name, state }: { name: string; state: ToolState }) {
  const done = state === "output-available";
  const failed = state === "output-error" || state === "output-denied";

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs",
        failed
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-border bg-muted/40 text-muted-foreground",
      )}
    >
      {failed ? (
        <AlertCircleIcon className="size-3 shrink-0" />
      ) : done ? (
        <CheckIcon className="size-3 shrink-0 text-emerald-600" />
      ) : (
        <Loader2Icon className="size-3 shrink-0 animate-spin" />
      )}
      <span className="truncate">{TOOL_LABELS[name] ?? name}</span>
    </div>
  );
}

type MessageLike = {
  id: string;
  role: string;
  parts?: Array<Record<string, unknown>>;
};

function Message({ message }: { message: MessageLike }) {
  const isUser = message.role === "user";
  const parts = message.parts ?? [];

  const text = parts
    .filter((p) => p.type === "text")
    .map((p) => String(p.text ?? ""))
    .join("")
    .trim();

  const tools = parts.filter((p) => String(p.type ?? "").startsWith("tool-"));

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
          {text}
        </div>
      </div>
    );
  }

  if (!text && tools.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {tools.length > 0 && (
        <div className="flex flex-col gap-1">
          {tools.map((part, i) => (
            <ToolRow
              key={String(part.toolCallId ?? i)}
              name={String(part.type).replace(/^tool-/, "")}
              state={String(part.state ?? "")}
            />
          ))}
        </div>
      )}
      {text && <p className="text-sm leading-relaxed text-foreground">{text}</p>}
    </div>
  );
}

const STARTERS = [
  "Tighten the opening paragraph",
  "Add a call-to-action button at the end",
  "Proofread everything",
];

export function AgentPanel({
  document,
  updateDocument,
  selectedBlockId,
  campaignId,
}: {
  document: EmailDocument;
  updateDocument: (updater: (current: EmailDocument) => EmailDocument) => void;
  /** Canvas selection, auto-attached as context for the next message. */
  selectedBlockId?: string;
  campaignId?: string;
}) {
  const agent = useAgent({ document, onUpdateDocument: updateDocument, campaignId });
  const bottomRef = React.useRef<HTMLDivElement>(null);

  // Local `/` commands mutate the document without producing a chat message, so
  // they'd otherwise be invisible. A short note keeps the transcript an honest
  // record of everything that changed the email.
  const [notes, setNotes] = React.useState<Array<{ id: string; text: string }>>([]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [agent.messages, notes]);

  function handleCommand(command: AgentCommand) {
    if (command.usesAi && command.prompt) {
      // Writing commands target the selected block when there is one, so
      // /rephrase doesn't quietly rewrite the entire email.
      const block = selectedBlockId
        ? findBlock(document.blocks, selectedBlockId)
        : undefined;
      const reference = block
        ? `@${summarizeBlock(block, 34) || block.type}`
        : null;
      agent.send(
        resolveCommandPrompt(command, reference),
        block ? [block.id] : [],
      );
      return;
    }
    if (!command.apply) return;
    // Goes through the same updater as every other edit, so it lands in the
    // editor's undo stack like a manual change — and costs no model call.
    updateDocument(command.apply);
    setNotes((current) => [...current, { id: createId(), text: `Applied ${command.label}` }]);
  }

  const empty = agent.messages.length === 0 && notes.length === 0;

  return (
    // Fills whatever container it's given — it lives in the left sidebar, so
    // width and borders belong to the sidebar, not to this component.
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <header className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <div className="flex items-center gap-2">
          <SparklesIcon className="size-3.5 text-primary" />
          <span className="text-sm font-semibold">Assistant</span>
        </div>
        {agent.messages.length > 0 && (
          <button
            type="button"
            onClick={() => setNotes([])}
            className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Clear
          </button>
        )}
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-3">
          {empty ? (
            <div className="flex flex-col gap-3 pt-6">
              <p className="text-sm text-muted-foreground">
                Describe a change and I&apos;ll make it in the email. I keep your
                theme exactly as it is unless you ask me to change it.
              </p>
              <div className="flex flex-col gap-1.5">
                {STARTERS.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => agent.send(starter)}
                    className="rounded-lg border border-border px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            agent.messages.map((message) => (
              <div key={message.id} className="flex flex-col gap-1.5">
                <Message message={message as unknown as MessageLike} />
                {/* Revert sits on the message that caused the change, so undo is
                    where the user is already looking. */}
                {agent.canRevert && agent.revertMessageId === message.id && (
                  <button
                    type="button"
                    onClick={agent.revert}
                    className="flex w-fit items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <UndoIcon className="size-3" />
                    Revert this change
                  </button>
                )}
              </div>
            ))
          )}

          {notes.map((note) => (
            <p key={note.id} className="text-xs text-muted-foreground">
              {note.text}
            </p>
          ))}

          {agent.error && (
            <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
              <AlertCircleIcon className="mt-px size-3.5 shrink-0" />
              <span>{agent.error.message}</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t border-border p-2.5">
        <AgentComposer
          document={document}
          busy={agent.busy}
          model={agent.model}
          selectedBlockId={selectedBlockId}
          onModelChange={agent.setModel}
          onStop={agent.stop}
          onRunCommand={handleCommand}
          onSubmit={({ text, references }) => agent.send(text, references)}
        />
      </div>
    </div>
  );
}
