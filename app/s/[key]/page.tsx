// Hosted subscribe page — the "one link" flavor of a signup form. A customer can
// link straight to /s/<key> (site nav, bio, QR code) and visitors subscribe here
// without any embedding. Same double opt-in as the embed: this only kicks off
// the confirmation email.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSignupFormByPublicKey } from "@/db/signup-forms";
import { widgetConfig } from "@/lib/forms/widget";
import { SubscribeWidget } from "./subscribe-widget";

export const runtime = "nodejs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ key: string }>;
}): Promise<Metadata> {
  const { key } = await params;
  const form = await getSignupFormByPublicKey(key);
  return { title: form ? form.headline : "Subscribe" };
}

export default async function HostedSubscribePage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const form = await getSignupFormByPublicKey(key);
  if (!form) notFound();

  const config = widgetConfig(form);

  return (
    // Backdrop follows the form's theme so a dark form lands on a dark page.
    <div
      className="flex min-h-dvh flex-col items-center justify-center px-4 py-10"
      style={{ backgroundColor: config.colors.pageBg }}
    >
      <div className="w-full max-w-md">
        <SubscribeWidget config={config} />
        <p
          className="mt-6 text-center text-xs"
          style={{ color: config.colors.muted }}
        >
          Powered by LetterStack
        </p>
      </div>
    </div>
  );
}
