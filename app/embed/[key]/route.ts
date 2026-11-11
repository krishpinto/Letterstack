// The one-line embed. A customer drops
//   <script src="https://letterstack.site/embed/<key>" async></script>
// onto their site and this returns a self-contained script that renders the
// form (inline, popup or slide-in, per its type) and POSTs to
// /api/public/subscribe. The script and why it is safe on someone else's page
// live in lib/forms/embed-script.ts.

import { NextResponse } from "next/server";
import { getSignupFormByPublicKey } from "@/db/signup-forms";
import { buildEmbedScript } from "@/lib/forms/embed-script";
import { widgetConfig } from "@/lib/forms/widget";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const form = await getSignupFormByPublicKey(key);

  if (!form) {
    // Valid JS that logs rather than throwing, so a stale embed fails quietly.
    return new NextResponse(
      `console.error("[LetterStack] signup form not found: ${key.replace(/[^a-zA-Z0-9_-]/g, "")}");`,
      { status: 404, headers: { "Content-Type": "application/javascript; charset=utf-8" } },
    );
  }

  const script = buildEmbedScript(widgetConfig(form));

  return new NextResponse(script, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
