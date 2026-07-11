// Public confirm page reached from the "Confirm subscription" link in the
// double opt-in email. Verifies the signed token server-side to show whose
// address it is and which newsletter, then hands off to a small client
// component for the actual confirm (a POST, so prefetch scanners that only GET
// this page never subscribe anyone).

import { verifySubscribeToken } from "@/lib/forms/token";
import { getSignupFormById } from "@/db/signup-forms";
import { SubscribeConfirm } from "./subscribe-confirm";

export const runtime = "nodejs";

export default async function SubscribeConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const claim = verifySubscribeToken(t ?? "");
  const form = claim ? await getSignupFormById(claim.formId) : null;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        {claim && form ? (
          <SubscribeConfirm
            token={t ?? ""}
            email={claim.email}
            headline={form.headline}
          />
        ) : (
          <>
            <h1 className="text-lg font-semibold text-zinc-900">
              Link not valid
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              This confirmation link is invalid or has expired. Head back to the
              site and sign up again to get a fresh one.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
