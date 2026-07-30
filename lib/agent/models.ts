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
  /**
   * Free-tier ceilings, per model.
   *
   * Google meters each model separately, so exhausting one leaves the others
   * usable — which is exactly why the quota gates key on model rather than
   * counting every call against one shared pool.
   *
   * These are researched published figures, not values the API reports back.
   * Google revises them without notice and varies them by region and account
   * age, so treat them as our own conservative ceiling: the provider's 429 is
   * the real authority, and the send path surfaces it when it disagrees.
   */
  dailyRequestLimit: number;
  rpmLimit: number;
  /**
   * Daily token ceiling — the limit that actually bites here.
   *
   * Observed: 3.6 Flash was refused by Google after 19 requests but ~142k
   * tokens in a day, i.e. nowhere near any published request cap. Agent turns
   * carry a document summary and conversation history, so they are token-heavy
   * and cheap in request count, which makes tokens/day the binding constraint
   * and a requests-only view actively misleading.
   *
   * Estimated from that observation, not published — tune via env once you
   * have watched a few more days.
   */
  dailyTokenLimit: number;
};

export const AGENT_MODELS: AgentModel[] = [
  {
    id: "gemini-3.6-flash",
    label: "Gemini 3.6 Flash",
    hint: "Best balance — the default",
    provider: "google",
    vision: true,
    dailyRequestLimit: Number(process.env.NEXT_PUBLIC_AI_RPD_36_FLASH ?? 1500),
    rpmLimit: 10,
    // Google refused this model at ~142k tokens in a day.
    dailyTokenLimit: Number(process.env.NEXT_PUBLIC_AI_TPD_36_FLASH ?? 150_000),
  },
  {
    id: "gemini-3.5-flash",
    label: "Gemini 3.5 Flash",
    hint: "Previous generation, very capable",
    provider: "google",
    vision: true,
    dailyRequestLimit: Number(process.env.NEXT_PUBLIC_AI_RPD_35_FLASH ?? 1500),
    rpmLimit: 10,
    dailyTokenLimit: Number(process.env.NEXT_PUBLIC_AI_TPD_35_FLASH ?? 250_000),
  },
  {
    id: "gemini-3.5-flash-lite",
    label: "Gemini 3.5 Flash Lite",
    hint: "Fastest, use when Flash is exhausted",
    provider: "google",
    vision: true,
    dailyRequestLimit: Number(process.env.NEXT_PUBLIC_AI_RPD_35_LITE ?? 1000),
    rpmLimit: 15,
    dailyTokenLimit: Number(process.env.NEXT_PUBLIC_AI_TPD_35_LITE ?? 250_000),
  },
];

export function findModel(id: string): AgentModel | undefined {
  return AGENT_MODELS.find((model) => model.id === id);
}

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
 *
 * Must stay below GLOBAL_RPM_LIMIT or one turn starves the next. At 8 a real
 * request — add a block, write its HTML, then fix up a few others — could run
 * out of steps before writing its closing summary, which looked from the panel
 * like the assistant had simply stopped.
 */
export const MAX_AGENT_STEPS = Number(process.env.AI_MAX_STEPS ?? 12);
