// Model registry for the agent panel.
//
// Gemini direct (Google AI Studio) rather than a router, because the free tier
// is the whole constraint here: Google's free tier allows on the order of a
// thousand requests a day, where OpenRouter's free variants allow 50/day
// governed per-account. One agent turn is several model calls, so 50/day is
// not a product. If OpenRouter is added later for model variety, it slots in
// as another `provider` value without touching anything else.
//
// Model ids are taken from the bundled @ai-sdk/google docs for the installed
// provider version, not from memory. Free-tier availability and per-model rate
// limits change without notice and vary by region — confirm in AI Studio
// before relying on any specific number.

export type AgentModel = {
  id: string;
  label: string;
  /** Short line shown under the label in the picker. */
  hint: string;
  provider: "google";
  /** Accepts image attachments in chat. */
  vision: boolean;
};

export const AGENT_MODELS: AgentModel[] = [
  {
    id: "gemini-3.6-flash",
    label: "Gemini 3.6 Flash",
    hint: "Best balance — the default",
    provider: "google",
    vision: true,
  },
  {
    id: "gemini-3.5-flash",
    label: "Gemini 3.5 Flash",
    hint: "Previous generation, very capable",
    provider: "google",
    vision: true,
  },
  {
    id: "gemini-3.5-flash-lite",
    label: "Gemini 3.5 Flash Lite",
    hint: "Fastest, highest daily allowance",
    provider: "google",
    vision: true,
  },
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    hint: "Older, use if newer models misbehave",
    provider: "google",
    vision: true,
  },
];

export const DEFAULT_AGENT_MODEL = AGENT_MODELS[0].id;

export function isKnownModel(id: string): boolean {
  return AGENT_MODELS.some((m) => m.id === id);
}

export function resolveModelId(requested: string | undefined): string {
  return requested && isKnownModel(requested) ? requested : DEFAULT_AGENT_MODEL;
}

/**
 * How many model calls one user message may cost. This is the most important
 * quota guard in the system: without it a confused model can loop and burn a
 * day's free-tier allowance on a single request. Enforced server-side by
 * counting assistant turns in the submitted history, not just in the client
 * loop, so a modified client cannot raise it.
 */
export const MAX_AGENT_STEPS = 8;
