# LetterStack Homepage Context And Section Plan

## Product Context

LetterStack is a mass email sending platform for teams that want to design, schedule, send, and analyze bulk campaigns without expensive Mailchimp-style pricing or weak template workflows.

The product direction:

- Mass email sending for campaigns, newsletters, and promotional emails.
- Custom sender domain support.
- Bounce handling and campaign delivery state tracking.
- A state-of-the-art email editor intended to feel stronger than basic editors in Resend, Mailchimp, Zoho, and similar tools.
- Reusable templates for newsletters, launches, promotions, lifecycle campaigns, announcements, and branded updates.
- Campaign analytics for sent, delivered, bounced, opened, clicked, unsubscribed, and failed states.
- Email scheduling.
- Newsletter system where users can embed a script or React component on their own website.
- Newsletter APIs automatically add subscribers into the correct LetterStack contact list.
- Contact lists can then be reused for newsletters, promotion campaigns, announcements, and future automation.

Design note: keep the existing custom homepage section system. The project already uses custom `Section`, `SectionHeading`, and supporting heading/layout components. New homepage sections should be built using that design grammar instead of replacing the page with a generic SaaS template.

## Recommended Homepage Narrative

The homepage should sell LetterStack as:

> The campaign platform for teams that need beautiful email design, own-domain sending, newsletter capture, scheduling, bounce handling, and analytics in one place.

The key promise should not be only "send bulk email." It should be:

- Better campaign creation.
- More control over sender identity.
- Cleaner subscriber growth.
- More predictable sending operations.
- Better value than bloated email marketing suites.

## Suggested Sections

### 1. Hero

Purpose: explain the product in one sentence and make the buyer understand the wedge immediately.

Suggested headline:

> Design, schedule, and send bulk email from your own domain.

Alternative stronger version:

> The email campaign platform built for your own domain.

Suggested subheading:

> LetterStack gives teams a visual email editor, reusable templates, newsletter capture, bounce handling, scheduling, and campaign analytics without locking you into expensive marketing suites.

Primary CTA:

- Start building

Secondary CTA:

- Explore templates
- See how sending works

Visual direction:

- Keep the current strong hero visual style.
- Show a real LetterStack product surface if possible: editor on one side, live email preview and send status on the other.
- Avoid abstract SaaS dashboard filler.

### 2. Problem / Cost And Workflow Pain

Purpose: make the buyer feel seen before pitching features.

Core message:

> Email tools are either too expensive, too limited, or too manual.

Three pain cards:

- Expensive suites: Mailchimp-style pricing grows fast even for modest sending volume.
- Manual builders: Zoho/manual workflows make templates hard to reuse and often flatten designs into poor-quality images.
- Fragmented tools: editor, contacts, domain setup, scheduling, and analytics live in different places.

Design:

- Use three compact cards or a comparison strip.
- Keep it factual and grounded, not too aggressive.

### 3. Product Workflow

Purpose: show LetterStack is a complete campaign system, not just an editor.

Flow:

1. Create campaign.
2. Pick a template.
3. Edit visually.
4. Preview desktop/mobile.
5. Select audience.
6. Schedule or send.
7. Track results and bounces.

Design:

- Horizontal stepper on desktop.
- Stacked timeline on mobile.
- Each step can have a tiny UI preview.

### 4. State-Of-The-Art Email Editor

Purpose: this should be the star section.

Core message:

> Build emails visually without turning your campaign into one blurry image.

Feature points:

- Canvas/block editor.
- Rich text editing.
- Email-safe sections, columns, images, buttons, spacers, dividers.
- Desktop/mobile preview.
- Reusable brand styles.
- HTML output/export.
- Template-ready structure.

Design:

- Use a large editor mockup.
- Left side: editing controls and canvas.
- Right side: live inbox/email preview.
- Show button styling, image URL usage, and responsive preview controls.

### 5. Template Library

Purpose: prove users do not start from zero.

Template categories:

- Newsletter.
- Product launch.
- Promo offer.
- Event invite.
- School or institute update.
- Healthcare announcement.
- Real estate update.
- Ecommerce campaign.
- Customer lifecycle email.

Design:

- Gallery grid with realistic template thumbnails.
- Include tags like "Newsletter", "Promo", "Announcement", "Launch".
- CTA: Browse templates.

### 6. Custom Domain Sending

Purpose: build trust around sender identity and domain ownership.

Core message:

> Send from your brand, not a generic sender.

Feature points:

- Add sender domain.
- Verify SPF, DKIM, and DMARC.
- Send as `news@yourcompany.com`.
- Track domain status.
- Support multiple organizations/accounts later.

Design:

- DNS checklist UI.
- Domain status card: SPF verified, DKIM verified, DMARC detected.
- Sender identity preview.

### 7. Bounce Handling And Deliverability Controls

Purpose: show operational maturity.

Core message:

> Know what happened after you press send.

Feature points:

- Bounce tracking.
- Failed delivery states.
- Suppression list.
- Unsubscribe handling.
- Complaint tracking later.
- Plain-text fallback.
- Test emails before sending.

Design:

- Delivery pipeline visual: queued, sent, delivered, bounced, unsubscribed.
- Small table of recipient statuses.

### 8. Newsletter Capture System

Purpose: differentiate LetterStack from plain campaign senders.

Core message:

> Turn your website into a subscriber source.

Feature points:

- Embed script.
- React component snippet.
- API endpoint for custom forms.
- Automatically add subscribers to selected contact lists.
- Use those lists for newsletters and future promotional campaigns.

Design:

- Split code + contact list visual.
- Left: embed snippet or React component.
- Right: new subscriber appearing inside LetterStack.

Suggested snippet concept:

```tsx
<LetterStackNewsletter list="product-updates" />
```

Or:

```html
<script src="https://letterstack.app/newsletter.js" data-list="product-updates"></script>
```

### 9. Audience And Segmentation

Purpose: make campaigns feel manageable at scale.

Feature points:

- CSV import.
- Contact lists.
- Newsletter subscribers.
- Tags and segments later.
- Suppression list.
- Duplicate detection later.

Design:

- Contacts table with filters.
- Segment pills: Customers, Leads, Newsletter, Event attendees.

### 10. Scheduling And Campaign Calendar

Purpose: show this is built for repeated marketing operations.

Feature points:

- Schedule campaign.
- Draft, scheduled, sending, sent states.
- Send test before scheduling.
- Campaign calendar later.

Design:

- Calendar strip.
- Scheduled campaign card.
- Send state badge.

### 11. Analytics Dashboard

Purpose: show measurable outcomes.

Metrics:

- Sent.
- Delivered.
- Bounced.
- Opens.
- Clicks.
- Unsubscribes.
- Cost estimate.

Design:

- Campaign analytics dashboard.
- Delivery funnel.
- Open/click chart.
- Recipient status table.

### 12. Pricing / Cost Calculator

Purpose: this is strategically important because LetterStack's origin story is cost pain.

Core message:

> Estimate the real cost of sending before you commit.

Inputs:

- Monthly emails.
- Number of contacts.
- Sending provider.
- Custom domain requirement.

Outputs:

- Estimated platform cost.
- Estimated sending cost.
- Comparison with expensive bundled tools.

Design:

- Calculator, not just static pricing cards.
- For early stage, pricing can say "Editor + campaign tools" and "Sending provider billed separately" if architecture requires that.

### 13. Use Cases

Purpose: make the product feel relevant to real teams.

Use case cards:

- Institutes and education teams.
- Clinics and healthcare groups.
- Local retail and offers.
- Real estate updates.
- SaaS product newsletters.
- Communities and events.
- Agencies managing client campaigns.

Each card should say what they send and why LetterStack helps.

### 14. Trust / Ownership

Purpose: reduce fear around contact data and vendor lock-in.

Feature points:

- Export HTML.
- Export contacts.
- Own sender domain.
- Reusable templates.
- No forced design lock-in.
- Your subscribers remain your subscribers.

Design:

- Simple ownership checklist.
- "What you own" vs "What LetterStack manages" split.

### 15. FAQ

Purpose: answer sales objections.

Suggested questions:

- Can I send from my own domain?
- Can I use LetterStack only as an editor?
- Can I import existing contacts?
- Can I collect newsletter subscribers from my website?
- Does LetterStack handle bounces?
- Can I schedule emails?
- Can I export HTML?
- Is this a Mailchimp replacement?
- How much does sending 3,000 emails cost?
- Can multiple companies use their own domains?

### 16. Final CTA

Purpose: close the page with action.

Suggested headline:

> Build your first campaign in LetterStack.

Subheading:

> Start with a template, connect your audience, and send from your own domain when you are ready.

CTAs:

- Start building.
- Talk to us.

## Recommended Section Order For V1

1. Hero.
2. Problem / cost pain.
3. Product workflow.
4. Editor section.
5. Templates.
6. Newsletter capture system.
7. Custom domain sending.
8. Bounce handling and deliverability.
9. Audience and segmentation.
10. Scheduling.
11. Analytics.
12. Pricing / cost calculator.
13. Use cases.
14. FAQ.
15. Final CTA.

## What To Remove Or Replace From The Current Homepage

- Replace the generic About section with "Why LetterStack" or "Built for campaign teams".
- Replace the generic Contact section with a serious final CTA or "Talk to us".
- Replace placeholder Pricing with a cost calculator or pricing explanation.
- Keep the mail handoff visual only if it supports a story section like "From your website to their inbox".
- Keep the custom section component system.

