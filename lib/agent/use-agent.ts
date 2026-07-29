"use client";

// Our agent loop.
//
// The AI SDK is used strictly as transport — it streams one model turn and
// hands us tool calls. Every decision that makes this an agent is ours and
// lives in this file: which tools exist, how they're applied, what context each
// turn carries, when the loop continues or stops, and how a turn is undone.
// There is no ToolLoopAgent and no HarnessAgent here on purpose.
//
// The loop:
//   send  → server makes ONE model call → tool calls stream back
//         → we apply each to the EmailDocument synchronously
//         → we decide whether to continue
//         → repeat, or stop
//
// Tools run here rather than on the server so edits land in React state
// immediately and the user watches the email change. The trade is that the
// server can't see the document, which is why context.ts rebuilds a summary
// each turn.

import * as React from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";

import type { EmailDocument } from "@/lib/email/document";
import { applyAgentTool, isAgentToolName } from "./tools";
import { buildAgentContext } from "./context";
import { DEFAULT_AGENT_MODEL, MAX_AGENT_STEPS } from "./models";

export type AgentTurn = {
  /** Document as it was before this turn — restored by revert(). */
  snapshot: EmailDocument;
  /** Assistant message id this turn produced, once known. */
  messageId?: string;
};

export type UseAgentOptions = {
  /** Live document. Read at call time so tools never see a stale copy. */
  document: EmailDocument;
  /** Same updater the inspector and canvas use — one write path for everything. */
  onUpdateDocument: (updater: (current: EmailDocument) => EmailDocument) => void;
  campaignId?: string;
};

export function useAgent({ document, onUpdateDocument, campaignId }: UseAgentOptions) {
  const [model, setModel] = React.useState(DEFAULT_AGENT_MODEL);

  // Mirrors the document synchronously. Several tool calls can arrive in one
  // tick, and React state wouldn't have flushed between them — reading from a
  // ref keeps each call operating on the result of the previous one.
  const documentRef = React.useRef(document);
  React.useEffect(() => {
    documentRef.current = document;
  }, [document]);

  // Block ids the user @-referenced, staged by the composer for the next send.
  const pendingReferences = React.useRef<string[]>([]);

  // Snapshot for the turn in flight, so the whole turn reverts as one action
  // rather than one undo step per tool call.
  const [lastTurn, setLastTurn] = React.useState<AgentTurn | null>(null);
  const turnSnapshot = React.useRef<EmailDocument | null>(null);

  const transport = React.useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/agent/chat",
        // Rebuilt per request, not per mount: by step 3 of a turn the document
        // has already changed, and the model must see the current state.
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            messages,
            model,
            campaignId,
            context: buildAgentContext({
              document: documentRef.current,
              references: pendingReferences.current,
            }),
          },
        }),
      }),
    [model, campaignId],
  );

  const chat = useChat({
    transport,

    // Continue automatically once every tool call in the turn has a result.
    // This is the loop's edge: the server does one call per request, so
    // resubmitting is what makes it multi-step.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,

    onToolCall({ toolCall }) {
      // Dynamic tools have no compile-time name; we don't register any.
      if (toolCall.dynamic) return;

      const name = toolCall.toolName;
      if (!isAgentToolName(name)) {
        chat.addToolOutput({
          tool: name,
          toolCallId: toolCall.toolCallId,
          state: "output-error",
          errorText: `Unknown tool "${name}".`,
        });
        return;
      }

      try {
        const before = documentRef.current;
        const { document: next, output, failed } = applyAgentTool(before, name, toolCall.input);

        if (!failed && next !== before) {
          documentRef.current = next;
          onUpdateDocument(() => next);
        }

        // Not awaited — awaiting inside onToolCall can deadlock the stream.
        chat.addToolOutput({
          tool: name,
          toolCallId: toolCall.toolCallId,
          ...(failed
            ? { state: "output-error" as const, errorText: output }
            : { output }),
        });
      } catch (err) {
        chat.addToolOutput({
          tool: name,
          toolCallId: toolCall.toolCallId,
          state: "output-error",
          errorText: err instanceof Error ? err.message : "Tool failed.",
        });
      }
    },
  });

  // Close the turn when the stream settles, recording which message owns the
  // snapshot so the revert button can be attached to it.
  React.useEffect(() => {
    if (chat.status !== "ready" || !turnSnapshot.current) return;
    const snapshot = turnSnapshot.current;
    turnSnapshot.current = null;
    pendingReferences.current = [];
    const lastAssistant = [...chat.messages].reverse().find((m) => m.role === "assistant");
    setLastTurn({ snapshot, messageId: lastAssistant?.id });
  }, [chat.status, chat.messages]);

  const send = React.useCallback(
    (text: string, references: string[] = []) => {
      const trimmed = text.trim();
      if (!trimmed || chat.status === "streaming" || chat.status === "submitted") return;

      pendingReferences.current = references;
      // Capture before any tool runs so revert() restores the pre-turn state.
      turnSnapshot.current = documentRef.current;
      setLastTurn(null);
      chat.sendMessage({ text: trimmed });
    },
    [chat],
  );

  // Undo everything the last turn did, in one action. Left unmemoized — the
  // React Compiler handles this, and a manual useCallback here conflicts with
  // the dependencies it infers.
  function revert() {
    if (!lastTurn) return;
    const snapshot = lastTurn.snapshot;
    documentRef.current = snapshot;
    onUpdateDocument(() => snapshot);
    setLastTurn(null);
  }

  const busy = chat.status === "streaming" || chat.status === "submitted";

  return {
    messages: chat.messages,
    status: chat.status,
    error: chat.error,
    busy,
    send,
    stop: chat.stop,
    revert,
    canRevert: lastTurn !== null,
    revertMessageId: lastTurn?.messageId,
    model,
    setModel,
    maxSteps: MAX_AGENT_STEPS,
  };
}
