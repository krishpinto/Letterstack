// Hosted subscribe page — the "one link" flavor of a signup form. A customer can
// link straight to /s/<key> (site nav, bio, QR code) and visitors subscribe here
// without any embedding. Same double opt-in as the embed: this only kicks off
// the confirmation email.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSignupFormByPublicKey } from "@/db/signup-forms";
import { widgetConfig } from "@/lib/forms/widget";
import { HostedFormExperience } from "./hosted-form-experience";

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

  // The experience renders per form type: static centered, popup as a modal
  // over a mock page, animated sliding into the corner. Backdrop follows the
  // form's theme so a dark form lands on a dark page.
  return <HostedFormExperience config={widgetConfig(form)} />;
}
