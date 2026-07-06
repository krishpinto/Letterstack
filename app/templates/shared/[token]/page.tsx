// Public page for a shared custom template. Anyone with the link can preview
// it and copy it into their own workspace (login required only at that point).

import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { emailTemplates } from "@/db/schema";
import { compileEmailDocument } from "@/lib/email/compiler";
import { normalizeDocument } from "@/lib/email/document";
import { Badge } from "@/components/ui/badge";
import { UseSharedTemplateButton } from "./use-template-button";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SharedTemplatePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.shareToken, token));

  if (!template || !template.document) notFound();

  // Fill any missing settings with defaults so old/partial documents still
  // compile instead of crashing the public page.
  const { html } = compileEmailDocument(normalizeDocument(template.document));

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <Badge variant="outline" className="w-fit">
          Shared LetterStack template
        </Badge>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="min-w-0 truncate text-2xl font-semibold tracking-normal">
            {template.name}
          </h1>
          <UseSharedTemplateButton
            token={token}
            name={template.name}
            document={template.document}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Someone shared this email template with you. Preview it below, or add
          it to your own LetterStack workspace to edit and send it.
        </p>
      </header>

      <div className="overflow-hidden rounded-xl border border-border shadow-sm">
        <iframe
          title={`Preview of ${template.name}`}
          srcDoc={html}
          sandbox=""
          className="block h-[70vh] min-h-[480px] w-full bg-white"
        />
      </div>
    </main>
  );
}
