# Agentic Editor — Plan

Status: **proposed, not implemented**. Written 2026-07-29.

Goal: an AI panel in the editor that can build and edit the email itself —
composer with `@block` references, model dropdown, custom HTML generation,
per-user token budgets, running entirely on free model tiers.

---

## 1. What you already have (four things change the scope)

**Which editor is live is settled.** All three routes —
[app/editor/page.tsx](app/editor/page.tsx),
[app/editor/[id]/page.tsx](app/editor/[id]/page.tsx), and
[app/editor/template/[id]/page.tsx](app/editor/template/[id]/page.tsx) — mount
`EditorShell`. `components/editor/letterstack-editor.tsx` was the old editor,
referenced by nothing; it has since been deleted, and git history is the
"for reference" copy. The agent panel goes in `editor-shell.tsx`.

**A custom HTML block already exists.** `RawHtmlBlock` is in
[lib/email/document.ts:154](lib/email/document.ts#L154) with `label`, `html`,
and `text` fields, a `createBlock` case, a compiler renderer
([compiler.ts:401](lib/email/compiler.ts#L401)), and a `blockToText` case.
Nothing new to build — the agent just needs a tool that writes to it. Note it
carries **both** `html` and `text`, so the agent must produce a plain-text
equivalent too or the text part of the email silently degrades.

**Undo/redo already exists**, in [editor-shell.tsx:163-223](components/editor/editor-shell.tsx#L163-L223)
— `past`/`future` stacks with a 500 ms coalescing window. This matters a lot
for an agent: it means "undo what the AI just did" is nearly free. See §7 for
the one adjustment needed.

**TipTap 3 is already installed, including `@tiptap/suggestion`**, and you have
already built a `/` command menu on it in
[slash-command-extension.ts](components/editor/slash-command-extension.ts).
An `@` mention is the *same* Suggestion plugin with `char: "@"`. See §5 — this
is the one place I'd push back on the brief.

---

## 2. Two research findings that change the design

Both verified against primary sources on 2026-07-29.

### OpenRouter free models are 50 requests/day — for your whole platform

OpenRouter's own docs: free variants (`:free`) get **20 requests/minute and 50
requests/day**, rising to 1,000/day only once you've bought $10 in credits at
any point. Critically, the limit is **per account, not per key**: *"making
additional accounts or API keys will not affect your rate limits, as we govern
capacity globally."*

An agent turn is not one request — a tool loop is typically 3–6 model calls. So
50/day is roughly **8–15 user messages per day across every user you have**.
That is not a product, it's a demo that breaks by lunchtime.

### Gemini's free tier trains on your users' content

Google's free tier may use prompts and responses to improve their models, and
human reviewers may annotate them. The paid tier does not. For a product where
users paste unreleased newsletters and client copy, that's a disclosure
obligation, not a footnote — and it's a reason a customer's real content should not go
through a free-tier model without telling them.

**The SDK does not change this.** The AI SDK, the Google SDK, and raw `fetch`
all hit the same endpoint; training policy is a property of the *billing tier on
the key*, decided server-side by Google. The only switch is enabling billing on
the Cloud project — at which point the same key stops being trained on and
starts costing money. Routing through OpenRouter doesn't change it either: a
free Gemini variant there is still Google's free tier underneath, with an extra
intermediary added.

### What follows from these

**Default to Gemini Flash directly via a Google AI Studio key, not OpenRouter.**
Free tier is ~1,500 requests/day on Flash / Flash-Lite (vs 50), it has genuinely
good function calling, and it has vision for free — which §9 needs. OpenRouter
stays in the build as the **model dropdown** for variety and fallback, clearly
labelled as limited, because that's where the free open-weight models live and
it's one integration for dozens of models.

So: two providers, Gemini as default, OpenRouter for the dropdown. The AI SDK
provider-registry pattern handles both behind one interface.

---

## 3. Where the agent sits (constitution check)

CLAUDE.md says: *"Canvas is the only editing surface. Never build a second
parallel editor."* An agent panel does **not** violate this, and it's worth
being explicit about why so this doesn't get re-litigated later:

```
agent → tool calls → the exact helpers in lib/email/document.ts
                     that the inspector and canvas already call
                   → one EmailDocument in React state
                   → compileEmailDocument() → preview + send
```

The agent is another *writer* into the single canonical state, exactly like the
inspector panel. It never produces HTML that reaches the email directly (except
via `rawHtml`, which is a document field like any other), and it never holds its
own copy of the content. If a tool is ever tempted to build markup outside
`compileEmailDocument()`, that's the line — don't cross it.

The Lexical/TipTap composer is the **chat input**, not an email editor. It
produces a prompt string plus block references, never email content.

---

## 4. The harness

**Run the tool loop on the client; make the server a metered proxy.**

The document lives in React state. If the loop runs server-side, every tool call
has to round-trip the document up and the mutation back, and you have to
reconcile against edits the user made meanwhile. If the loop runs client-side,
tools execute synchronously against `updateDocument` and the user *watches the
email assemble itself*, which is the entire appeal of the feature.

```
useChat (client)
  └─ POST /api/agent/chat   ← server: holds keys, enforces budget, records usage
       └─ streamText({ model, tools })   tools declared WITHOUT execute()
  ← assistant turn streams back, possibly with tool calls
  └─ client executes each tool against updateDocument()
  └─ appends tool results, resubmits automatically
  └─ repeat until no tool calls or MAX_STEPS
```

The AI SDK supports exactly this shape — tools defined without an `execute`
function are forwarded to the client for handling, and the chat hook resubmits
once results are attached.

**Do not hand-roll the loop, and do not write any of this from memory.** Vercel's
own `ai-sdk` skill (installed at `.agents/skills/ai-sdk`) is explicit on both
points: use the SDK's built-in agent abstraction (`ToolLoopAgent` or whatever it
is called in the installed version) rather than writing your own tool-calling
loop, and verify every API against the **bundled, version-matched docs** the
package ships at `node_modules/ai/docs/` and `node_modules/ai/src/`. The UI
hooks (`useChat` especially) are among the most frequently changed APIs in the
SDK, so anything either of us remembers about them is probably wrong.

Concretely, at implementation time: install `ai`, read `node_modules/ai/docs/`
for the current agent + client-side-tool pattern, and only then write step 3 of
the build order. The pseudo-flow above describes the *shape* of the solution;
treat the names in it as illustrative, not as API.

One open item to check against those docs: whether the built-in agent
abstraction cleanly supports **client-executed** tools, or whether it assumes
server-side `execute`. If it's server-only, the choice is between server-side
tools with document round-trips, or a hand-rolled client loop after all — decide
that from the docs, not from this plan.

`MAX_STEPS = 8` is the single most important quota guard in the whole system —
it's the cap on how many model calls one user message can cost. Enforce it
server-side too (count assistant turns in the submitted message array), not just
in the client loop, or it's advisory.

---

## 5. The composer: use TipTap, not Lexical

You asked for Lexical, on the grounds that it's better with stronger community
support. On the community half, the numbers say otherwise — weekly npm
downloads, checked 2026-07-29:

| package | downloads/week |
|---|---|
| `@tiptap/starter-kit` | ~13.5M |
| `@tiptap/react` | ~12.6M |
| `lexical` | ~4.6M |
| `@lexical/react` | ~4.3M |
| `prosemirror-state` (TipTap's foundation) | ~16.3M |

TipTap is roughly **2.7× more used** than Lexical, and ProseMirror underneath it
has a decade of production hardening. So "better community support" doesn't
hold up as a reason to switch.

Where Lexical genuinely *is* better: raw performance on very large documents,
a smaller core, no ProseMirror abstraction layer, and a stronger foundation for
real-time collaborative editing. Meta built it for Facebook/Instagram-scale
input surfaces and it shows.

**None of those advantages apply to a chat composer.** This is a small,
single-paragraph input with mention chips. It will never be large enough for
Lexical's performance edge to be measurable, and there's no collaboration on it.
Both libraries are overkill; the deciding factor is what's already in the repo:

- TipTap 3 is already a dependency, and `@tiptap/suggestion` — the exact plugin
  that powers `@` mentions — is already installed and already wired up by you
  for `/` commands. The `@` menu is `createSlashExtension` with `char: "@"` and
  a different item source. You have written this code once already.
- Adding Lexical means two rich-text engines in one bundle, two plugin models,
  and rebuilding the suggestion popup you already have.
- "Use it like plugins" is equally true of TipTap — it's plugin-architected to
  the same degree.

If you were greenfielding a novel editor, Lexical would be a defensible pick.
For a mention box in a repo that already runs TipTap, it's a second engine for
no benefit this feature can use.

If you still want Lexical, the plan below is unaffected apart from swapping the
composer file — everything downstream consumes `{ text, referencedBlockIds[] }`.

**Composer contract:**

```ts
type ComposerValue = {
  text: string;                 // "make @block-2 shorter and punchier"
  references: string[];         // ["block-2"] — resolved at submit
  attachments: { url: string; kind: "image" }[];
};
```

The `@` menu lists blocks as `{ id, type, snippet }` — snippet being the first
~50 chars of stripped text so the user picks by content, not by uuid. Selecting
one inserts a styled non-editable chip.

---

## 5b. Composer command surface: `@` and `/` (planned, not built)

Two triggers with deliberately different semantics. Getting this distinction
right is what keeps the feature usable on a free tier.

### `@` — reference something in the email

`@` **never acts**. It attaches context to the message you're about to send, so
the model knows what "it" means without you pasting content or the client
shipping the whole document.

- **Trigger:** `@` at a word boundary (start of line, or after whitespace).
  Never mid-word, so an email address typed in the composer doesn't open a menu.
- **Menu items** come from the live document — for each block: a type icon, the
  content snippet from `summarizeBlock()`, and the block type as a dim suffix.
  The user picks by content, never by uuid.
- **Filtering** matches snippet text *and* type name, so `@but` finds the button
  block and `@welcome` finds the block whose heading says Welcome.
- **Special targets** beyond blocks: `@subject`, `@preview`, `@styles`,
  `@everything`. These expand to document-level context rather than a block id.
- **Insertion** is an atomic chip, not text. In Lexical that's a `DecoratorNode`
  so backspace deletes the whole chip and the caret can't land inside it.
- **On submit**, chips resolve to `references: string[]`, which
  `buildAgentContext()` expands to full block JSON while everything else stays a
  one-line summary. That expansion already exists in
  [lib/agent/context.ts](lib/agent/context.ts).

### `/` — do something, without calling a model

`/` **acts immediately and locally.** This is the important one: applying a
colour theme is a deterministic mutation of `document.settings`. It needs no
model, so it costs **zero tokens and zero requests against the daily quota**.
On a free tier, every command that avoids a model call is capacity returned to
the requests that genuinely need one.

So `/` is not a way to write prompts faster — it's a parallel, free command
palette. It only falls back to the agent when a command genuinely needs
judgement.

**Local commands (no model call):**

| Command | Effect |
|---|---|
| `/theme` | Submenu of the 5 presets in [theme-presets.json](lib/email/theme-presets.json) — applies `preset.settings` over `document.settings` |
| `/width` | 480 / 600 / 700 px |
| `/font` | The `FONT_FAMILIES` list already in [editor-types.ts](components/editor/editor-types.ts) |
| `/accent` | Colour picker writing `accentColor` + `linkColor` |
| `/add` | Insert a block — same list as `CONTENT_BLOCKS` |
| `/clear` | Clear the conversation (not the email) |
| `/undo` | Revert the last agent turn — same action as the message's revert button |

**Model-backed commands** (these submit a prompt, and say so with a subtle
"uses AI" marker plus the step cost, so the difference is visible):

| Command | Becomes |
|---|---|
| `/rewrite` | "Rewrite @<selection> to be tighter" |
| `/shorten` | "Cut @<selection> by about a third, keep the meaning" |
| `/proofread` | "Fix spelling and grammar across every block. Change nothing else." |
| `/subject` | "Suggest three subject lines, then set the best one" |

Every local command routes through the same `applyAgentTool` path the agent
uses, so there is exactly one write path into `EmailDocument` regardless of
whether a human or a model triggered it — and `/theme` lands in the undo stack
as one step, like any other edit.

### Implementation notes

- Both menus are one Lexical plugin parameterised by trigger character, not two
  plugins. They share the popover, keyboard handling (↑/↓/Enter/Esc/Tab), and
  positioning; only the item source and the commit behaviour differ.
- `/` only triggers when the composer is **empty**. A slash inside a sentence is
  a slash. `@` has no such restriction.
- Because `/theme` mutates the document without a chat message, it should still
  append a small system line to the transcript ("Applied Midnight Dispatch") so
  the conversation stays an accurate record of what changed.

---

## 6. Tools

Every tool maps onto a helper that already exists in `lib/email/document.ts`.
This is why the feature is smaller than it looks.

| Tool | Backed by |
|---|---|
| `addBlock(type, index?)` | `createBlock` + `insertBlockAtIndex` |
| `updateBlock(id, patch)` | `updateBlock` |
| `removeBlock(id)` | `removeBlock` |
| `moveBlock(id, toIndex)` | `reorderBlocks` |
| `duplicateBlock(id)` | `duplicateBlock` |
| `setDocumentSettings(patch)` | settings merge |
| `setCustomHtml(id, html, text)` | `rawHtml` block fields (§10) |
| `readBlock(id)` | `findBlock` — for blocks not `@`-referenced |

Deliberately **not** tools: sending, saving, changing the From address, touching
recipients. The agent edits the document and nothing else. Keep that boundary
hard — it's the difference between "an editor assistant" and "a thing that can
mail 3,000 people".

Define the schemas in one file, `lib/agent/tools.ts`, and derive both the model
tool definitions and the client executor from it so they cannot drift.

---

## 7. Context strategy (this is what makes free tiers viable)

Never send the whole `EmailDocument` — it's large, mostly styling, and you'd
burn the token budget on padding values.

**Always send:** a compact outline, one line per block:
```
block-1  text        "Welcome to LetterStack — A beautiful way to send…"
block-2  articleCard "Your first article headline"
block-3  button      "Read the full newsletter"
```

**Send in full:** only blocks the user `@`-referenced, as JSON.

**Send on demand:** everything else via the `readBlock` tool.

Also send global settings (small, and the agent needs colours/fonts to write
on-brand HTML) and a trimmed conversation history — last ~6 turns, with old tool
results dropped since they're stale the moment the document changes.

### One undo step per agent turn

The existing history coalesces edits within 500 ms. An agent applying six tool
calls will land unpredictably — sometimes one undo entry, sometimes six. Wrap
the turn instead: snapshot the document when the turn starts, push exactly one
history entry when it ends, and put a **"Revert this change"** button on the
assistant message. Apply edits live (don't build a diff-review UI for v1) —
live application plus one-click revert is both simpler and better UX than an
accept/reject gate.

---

## 8. Quota, budgets, and not getting rate-limited

The user framing was "give users tokens so they don't exhaust quota" — worth
sharpening, because the quota that actually breaks is **global**, not per-user.
Free tiers are limited by *requests per day* and *requests per minute* on **your
one API key**, shared by everyone. So three separate gates are needed, checked
cheapest-first on every model call:

1. **Global daily request budget.** Count today's rows in `ai_usage` against the
   provider ceiling minus a safety margin (e.g. 1,200 of Gemini's ~1,500). On
   breach: refuse with a real message ("AI is at capacity for today"), never a
   silent failure. *This is the gate that protects the shared quota.*
2. **Per-user token budget.** Monthly `total_tokens` per user against their
   allowance. This is fairness between users, not quota protection.
3. **Requests-per-minute limiter.** ~20 RPM on OpenRouter, 10–30 on Gemini
   depending on model. **In-memory counters do not work on Vercel** — instances
   are ephemeral and parallel, so this needs shared storage.

**Use Neon Postgres for all three gates. Do not add Redis.** The `ai_usage`
ledger below already lives in Postgres, so every gate is a `COUNT` over it:

```sql
-- gate 1: global daily
SELECT count(*) FROM ai_usage WHERE created_at >= date_trunc('day', now());
-- gate 2: per-user monthly tokens
SELECT coalesce(sum(total_tokens),0) FROM ai_usage
  WHERE user_id = $1 AND created_at >= date_trunc('month', now());
-- gate 3: rolling RPM
SELECT count(*) FROM ai_usage WHERE created_at > now() - interval '1 minute';
```

Index on `(created_at)` and `(user_id, created_at)` and these are sub-millisecond
at any volume this product will see. Redis is the right tool at thousands of
requests per second; at 20 requests per *minute* it's a second piece of
infrastructure, a second free tier to babysit, and a second thing that can be
down — for no measurable gain. Postgres is also the only store here that's
already load-bearing, so it adds **no new failure mode**: if Neon is down the
whole app is down anyway, agent or no agent.

(Neon's free tier does scale to zero, but it wakes on connection and you already
depend on it for every other request, so this changes nothing.)

Plus `MAX_STEPS` from §4, which caps the blast radius of a single message.

```ts
export const aiUsage = pgTable("ai_usage", {
  id: uuid().defaultRandom().primaryKey(),
  organizationId: uuid().notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId:  uuid().notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text().notNull(),          // "google" | "openrouter"
  model:    text().notNull(),
  promptTokens:     integer().notNull().default(0),
  completionTokens: integer().notNull().default(0),
  totalTokens:      integer().notNull().default(0),
  campaignId: uuid(),
  ok:      boolean().notNull().default(true),
  error:   text(),
  createdAt: timestamp().defaultNow().notNull(),
});

export const aiBudgets = pgTable("ai_budgets", {
  id: uuid().defaultRandom().primaryKey(),
  userId: uuid().notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  monthlyTokenLimit: integer().notNull().default(200_000),
  updatedAt: timestamp().defaultNow().notNull(),
});
```

Record usage **after every call**, including failed ones (a failed call still
consumed a request against the daily ceiling). The AI SDK returns token usage on
the result object; when a provider omits it, fall back to an estimate rather
than recording zero.

Surface remaining budget in the UI — a small meter in the agent panel. Users who
can see the limit don't file bugs about hitting it.

---

## 9. Images and video

- **The agent cannot upload.** It sets URLs. Uploads stay with the user through
  the existing UploadThing flow in
  [image-upload-input.tsx](components/editor/image-upload-input.tsx).
- **Give it an asset library to choose from.** Add an `assets` table recording
  every UploadThing URL with its org, filename, and dimensions, then a
  `listAssets()` tool. Without this the agent can only ever reference images the
  user pasted into the current conversation.
- **Vision:** let users attach an image to the chat ("rebuild this layout"). The
  attachment goes to the model as an image part. Gemini Flash does vision on the
  free tier, which is a second reason it's the default.
- **Video:** `VideoBlock` exists and takes a `url` + `caption`. Email clients
  can't play embedded video — the compiler renders a thumbnail-and-link. The
  agent should set the URL and be told in its system prompt that video is a
  link, not a player, so it doesn't promise autoplay in the copy it writes.

---

## 10. The code block: fix it before the agent touches it

The block exists end-to-end (type, `createBlock`, compiler renderer,
`blockToText`) and it *is* in the palette — `CONTENT_BLOCKS` lists it as
"Code" at [editor-types.ts:59](components/editor/editor-types.ts#L59). What's
missing is a usable editing surface, and there are three concrete defects:

**1. The input is a bare `<Textarea rows={7}>.`**
[block-inspector.tsx:782-797](components/editor/block-inspector.tsx#L782-L797)
gives you a label field and an unstyled textarea — no highlighting, no
indentation, no bracket matching, no line numbers. Use **CodeMirror 6** with
`@codemirror/lang-html`. It's the standard choice, it's ~100 KB, and it fits a
320 px inspector panel. Monaco is the VS Code engine and is far too heavy for a
side panel.

**2. `block.text` is never written, so the plain-text email is wrong.**
`RawHtmlBlockFields` only sets `label` and `html`. `text` keeps whatever
`createBlock` seeded — literally the string `"Custom HTML content."` — and
[compiler.ts:443](lib/email/compiler.ts#L443) uses it for the text/plain part of
every send. Any email with a code block currently ships a text alternative that
says "Custom HTML content." **Derive `text` from `html` automatically** (there's
already a `stripHtml` helper in the compiler) rather than asking the user for
it twice.

**3. A full HTML document breaks the email.** The compiler drops `block.html`
straight into a `<td>` inside the email's table
([compiler.ts:401-408](lib/email/compiler.ts#L401-L408)). Paste anything with
`<!DOCTYPE html><html><head>…` — which is exactly what a user exporting from
anywhere else will paste — and you get a document nested inside a table cell.
Some clients tolerate it, most mangle it.

So: **one normalizer, used by both the inspector and the agent tool.**
`lib/email/normalize-raw-html.ts`:

- If the input contains `<!DOCTYPE>`, `<html>`, `<head>` or `<body>`, keep only
  the **inner content of `<body>`** and discard the rest.
- Strip `<script>`, `<style>`, `<link>`, `<meta>`, `<title>`, and `on*` handlers.
- Reject/flag email-unsafe CSS per CLAUDE.md — flexbox, grid, absolute
  positioning, CSS variables — with a visible warning in the inspector rather
  than a silent rewrite, so the user learns why.
- Return `{ html, text, warnings[] }` so the inspector can show the warnings and
  the agent tool can feed them back to the model to self-correct.

Run it on paste and on blur, not on every keystroke, or it'll fight the user
mid-type.

### Security

Everything above is also the security boundary, because `rawHtml` currently
reaches the compiled email **completely unsanitized**. That's been tolerable
while only a human typed it. Once a model writes it — and models can be
prompt-injected by content the user pastes in — it must be treated as untrusted:

- **Sanitize on write**, in the tool executor, not at render. Strip `<script>`,
  `on*` handlers, `javascript:` URLs, `<style>`/`<link>`, and anything with an
  external fetch. There's already a regex sanitizer in
  [preview-html.ts](components/editor/preview-html.ts) — it's a reasonable
  starting point but regex HTML sanitizing is leaky, so use a real sanitizer
  library for agent-authored content.
- **Canvas is currently safe by accident**: `canvas-block-preview` renders
  `rawHtml` as a placeholder chip, not as HTML. If you ever make it render for
  real, it must be a sandboxed iframe.
- **Confirm the preview iframe carries a `sandbox` attribute** —
  [preview-dialog.tsx:125](components/editor/preview-dialog.tsx#L125) uses
  `srcDoc`, which is same-origin without it.
- **Constrain the output.** The system prompt must state the email-safe rules
  from CLAUDE.md (tables + inline styles; no flexbox, grid, absolute
  positioning, CSS variables) and the tool should reject output containing
  those. A model left unconstrained writes beautiful modern CSS that renders as
  a wall of nothing in Outlook.
- **Watch total size.** Pre-send validation already targets <100 KB for Gmail
  clipping; agent-authored HTML is the most likely thing to blow it.

---

## 11. File layout

```
lib/agent/
  tools.ts            tool schemas + client executors (single source of truth)
  context.ts          document outline, @-reference expansion, history trimming
  models.ts           model registry: id, label, provider, free/paid, vision
  providers.ts        AI SDK provider registry (google + openrouter)
  budget.ts           the three gates from §8
  sanitize-html.ts    agent HTML sanitizing + email-safety validation

app/api/agent/chat/route.ts     metered proxy, streams the turn

components/editor/agent/
  agent-panel.tsx     panel shell, mounts into the existing rail
  agent-composer.tsx  TipTap composer + @ mentions
  mention-extension.ts
  agent-message.tsx   message + tool-call chips + "Revert this change"
  model-picker.tsx
  budget-meter.tsx

db/ai-usage.ts        ledger reads/writes
```

Note the editor already has two files well over the 300-line rule in CLAUDE.md
([editor-shell.tsx](components/editor/editor-shell.tsx) at 1156,
[block-inspector.tsx](components/editor/block-inspector.tsx) at 940). Don't add
the agent panel *into* `editor-shell.tsx` — mount it as one component and keep
its internals in the folder above.

---

## 12. Build order

0. **Fix the code block** (§10). CodeMirror input, `normalize-raw-html.ts`,
   auto-derived `text`. This is a prerequisite, not part of the agent — the
   plain-text bug affects every send with a code block *today*, and the agent
   would inherit all three defects. It's also the only step here that ships
   user-visible value on its own.
1. **Provider + metered route, no UI.** Install `ai` first and read
   `node_modules/ai/docs/` before writing anything (§4). Then
   `lib/agent/providers.ts`, `models.ts`, `/api/agent/chat`, `ai_usage` +
   `ai_budgets` tables, the three gates. Prove it with a scratch page that sends
   one message and records usage. *Nothing here touches the editor.*
2. **Tools + context.** `tools.ts`, `context.ts`, client executors against
   `updateDocument`. Testable without any chat UI by calling the executor
   directly.
3. **Panel + composer.** Agent panel, TipTap composer, `@` mentions, streaming
   messages, tool-call chips. First point the feature is visible.
4. **Turn transaction + revert.** Snapshot/restore wrapper from §7.
5. **Model picker + budget meter.** Dropdown with free models labelled and
   remaining budget shown.
6. **HTML + assets.** `setCustomHtml` with sanitizing and email-safety
   validation; `assets` table and `listAssets`; chat image attachments.

Steps 1–2 are invisible and independently testable; the risky, fiddly UI work
is concentrated in step 3.

---

## 13. Open questions

- **Budget denomination.** Tokens are precise but meaningless to users;
  "messages" or "credits" are legible but lossy. I'd show credits and store
  tokens.
- **What happens at zero budget?** Hard stop, or degrade to a smaller free
  model? Degrading is friendlier but makes the product feel broken in a way
  users can't diagnose.
- **Does the agent get write access to `subject` and `previewText`?** They're on
  the document, not blocks, and they're high-value for an email tool — but
  they're also the two fields most visible in a send. I'd say yes, with the
  same one-turn revert.

---

## Sources (§2 research, 2026-07-29)

- [OpenRouter API rate limits](https://openrouter.ai/docs/api-reference/limits)
  — 20 RPM / 50 RPD free, 1,000 RPD after $10 lifetime credit, governed
  per-account not per-key
- [Gemini API free tier limits](https://tokenmix.ai/blog/gemini-api-free-tier-limits)
  and [free tier guide](https://www.aifreeapi.com/en/posts/google-gemini-api-free-tier)
  — ~1,500 RPD on Flash/Flash-Lite, 50 RPD on 2.5 Pro, no card required
- [Gemini free-tier data usage](https://docs.bswen.com/blog/2026-03-23-gemini-free-tier-data-privacy/)
  — free tier content may be used for product improvement and human review;
  paid tier is not
- Google revises free-tier limits without notice and by region — re-check the
  live quota view in AI Studio before relying on the exact numbers above.
- Editor library download counts: npm registry downloads API
  (`api.npmjs.org/downloads/point/last-week/<pkg>`), queried 2026-07-29.
