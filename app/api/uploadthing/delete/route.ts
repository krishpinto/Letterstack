import { NextResponse } from "next/server";
import { UTApi } from "uploadthing/server";

import { auth } from "@/lib/auth";
import { extractUploadThingKey } from "@/lib/upload/key";

export const runtime = "nodejs";

// Called by the editor after a replacement image finishes uploading, to
// remove the file it replaced. Best-effort: a failure here just leaves an
// orphaned file in UploadThing storage, it never blocks the editor.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { url } = await request.json().catch(() => ({ url: null }));
  if (typeof url !== "string") {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  const key = extractUploadThingKey(url);
  if (!key) {
    // Not an UploadThing URL (placeholder, pasted external link) — no-op.
    return NextResponse.json({ deleted: false });
  }

  try {
    const utapi = new UTApi();
    const result = await utapi.deleteFiles(key);
    return NextResponse.json({ deleted: result.success });
  } catch (error) {
    console.error("Failed to delete replaced UploadThing file", error);
    return NextResponse.json({ deleted: false });
  }
}
