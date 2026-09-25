import { NextResponse } from "next/server";
import { recordEvent } from "@/db/events";
import { suppressEmailForOrganization } from "@/db/suppression";
import { suppressionTargetsForEmail } from "@/db/campaign-recipients";
import { maybeAlertDeliverability } from "@/lib/notifications/campaign-notifications";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  if (!raw) {
    return NextResponse.json({ ok: false, error: "Bad payload" }, { status: 400 });
  }

  if (raw.Type === "SubscriptionConfirmation") {
    if (raw.SubscribeURL) await fetch(raw.SubscribeURL).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  const event = typeof raw.Message === "string" ? JSON.parse(raw.Message) : raw;
  const type: string = event.eventType ?? event.notificationType ?? "Unknown";
  const email: string | null =
    event.bounce?.bouncedRecipients?.[0]?.emailAddress ??
    event.complaint?.complainedRecipients?.[0]?.emailAddress ??
    event.mail?.destination?.[0] ??
    null;
  const campaignId: string | null = event.mail?.tags?.campaignId?.[0] ?? null;

  if (email) {
    await recordEvent(email, type, campaignId);

    if (type === "Bounce" || type === "Complaint") {
      const targets = await suppressionTargetsForEmail(email);
      await Promise.all(
        targets.map((target) =>
          suppressEmailForOrganization(
            target.organizationId,
            target.userId,
            email,
            type.toLowerCase(),
          ),
        ),
      );

      // Only on bounces and complaints, so the overwhelmingly common event
      // types (Delivery, Open, Click) never pay for the rate query. Suppression
      // happens first and unconditionally: keeping a bad address out of the
      // next send is the part that protects the account, and it must not
      // depend on a notification succeeding.
      if (campaignId) await maybeAlertDeliverability(campaignId);
    }
  }

  return NextResponse.json({ ok: true });
}
