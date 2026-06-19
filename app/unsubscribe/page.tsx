// Public confirm page reached from the "Unsubscribe" link in an email body.
// Verifies the signed token server-side to show whose address it is, then hands
// off to a small client component for the actual confirm (a POST, so prefetch
// scanners that only GET this page never unsubscribe anyone).

import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";
import { UnsubscribeConfirm } from "./unsubscribe-confirm";

export const runtime = "nodejs";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const claim = verifyUnsubscribeToken(t ?? "");

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        {claim ? (
          <UnsubscribeConfirm token={t ?? ""} email={claim.email} />
        ) : (
          <>
            <h1 className="text-lg font-semibold text-zinc-900">Link not valid</h1>
            <p className="mt-2 text-sm text-zinc-500">
              This unsubscribe link is invalid or has expired. If you keep getting emails you
              didn&apos;t ask for, reply to one and we&apos;ll remove you.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
