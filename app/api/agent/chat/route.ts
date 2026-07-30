// The agent's only server surface: authenticate, meter, make exactly one model
// call, stream it back.
//
// It deliberately does NOT run a tool loop. Tools are declared without an
// `execute` function, so the SDK forwards every tool call to the browser, where
// our own loop applies it to the EmailDocument in React state and decides
// whether to continue. That keeps edits instant and avoids shipping the whole
// document up and back on every step.
//
// The server still owns the things a client cannot be trusted with: the API
// key, the quota gates, the usage ledger, and the step ceiling.

import { NextResponse } from "next/server";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { google } from "@ai-sdk/google";

import { currentOrganizationId, currentUserId } from "@/lib/auth-helpers";
import { agentTools } from "@/lib/agent/tools";
import { AGENT_SYSTEM_PROMPT } from "@/lib/agent/context";
import { MAX_AGENT_STEPS, resolveModelId } from "@/lib/agent/models";
import { checkAgentBudget, recordAgentUsage } from "@/lib/agent/budget";

export const runtime = "nodejs";
export const maxDuration = 60;

// agentTools is already `{ description, inputSchema }` per tool, which is the
// shape streamText expects. Having no `execute` is what marks them client-side:
// the SDK forwards the call to the browser instead of running it here.
// Passed as-is rather than mapped through tool(), because mapping collapses the
// per-tool schema types into a union that tool() cannot infer from.
const clientTools = agentTools;

/**
 * Model calls already spent on the user's current message. One turn is one user
 * message followed by N assistant/tool round trips, so counting assistant
 * messages after the last user message gives the step number. Enforced here
 * rather than only in the client loop, otherwise the cap is advisory.
 */
function stepsInCurrentTurn(messages: UIMessage[]): number {
  const lastUser = messages.map((m) => m.role).lastIndexOf("user");
  if (lastUser < 0) return 0;
  return messages.slice(lastUser + 1).filter((m) => m.role === "assistant").length;
}

function bad(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

/**
 * Turn a refusal into a normal assistant message rather than an HTTP error.
 *
 * The client is reading a UI message stream; a JSON error body just surfaces as
 * "an error occurred" with no explanation, which is exactly how a quota stop
 * ends up looking like the assistant silently died. Streaming the reason back
 * as assistant text means the user reads *why* it stopped, in the conversation,
 * where they're already looking.
 *
 * Deliberately not written to ai_usage: no provider call happened, and that
 * table is the source of truth for the rate-limit gates — recording refusals
 * there would make refusals compound into more refusals.
 */
function refusal(message: string) {
  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute({ writer }) {
        const id = "refusal";
        writer.write({ type: "text-start", id });
        writer.write({ type: "text-delta", id, delta: message });
        writer.write({ type: "text-end", id });
      },
    }),
  });
}

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return bad(401, "Unauthorized");

  const organizationId = await currentOrganizationId();
  if (!organizationId) return bad(428, "Create an organization first");

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return bad(503, "The assistant isn't configured yet — GOOGLE_GENERATIVE_AI_API_KEY is missing.");
  }

  const body = await request.json().catch(() => null);
  const messages = (body?.messages ?? []) as UIMessage[];
  if (!Array.isArray(messages) || messages.length === 0) {
    return bad(400, "No messages provided.");
  }

  if (stepsInCurrentTurn(messages) >= MAX_AGENT_STEPS) {
    return refusal(
      `I used all ${MAX_AGENT_STEPS} of my steps on that request without finishing. Try asking for a smaller change, or tell me which part to do first.`,
    );
  }

  const verdict = await checkAgentBudget(userId);
  if (!verdict.ok) return refusal(verdict.reason);

  const modelId = resolveModelId(typeof body?.model === "string" ? body.model : undefined);
  // Rebuilt by the client each turn from the live document, so it reflects
  // edits made moments ago rather than whatever was true when the chat started.
  const documentContext = typeof body?.context === "string" ? body.context : "";
  const campaignId = typeof body?.campaignId === "string" ? body.campaignId : null;

  try {
    const result = streamText({
      model: google(modelId),
      instructions: documentContext
        ? `${AGENT_SYSTEM_PROMPT}\n\n---\nCurrent email:\n${documentContext}`
        : AGENT_SYSTEM_PROMPT,
      messages: await convertToModelMessages(messages),
      tools: clientTools,

      onEnd({ usage, finishReason }) {
        void recordAgentUsage({
          organizationId,
          userId,
          provider: "google",
          model: modelId,
          promptTokens: usage?.inputTokens,
          completionTokens: usage?.outputTokens,
          totalTokens: usage?.totalTokens,
          campaignId,
          ok: finishReason !== "error",
        });
      },
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.stream,
        onError: (error) => (error instanceof Error ? error.message : "The assistant failed."),
      }),
    });
  } catch (err) {
    // A call that never streamed still consumed a request against the daily
    // ceiling, so it belongs in the ledger.
    void recordAgentUsage({
      organizationId,
      userId,
      provider: "google",
      model: modelId,
      campaignId,
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    });
    console.error("POST /api/agent/chat failed", err);
    return bad(502, "The assistant is unavailable right now. Please try again.");
  }
}
