// UploadThing serves files at https://<app>.ufs.sh/f/<key> (or the legacy
// utfs.io / uploadthing.com hosts). Pasted URLs (placeholders, client-provided
// links) never match this shape, so this doubles as an "is this ours?" check.
const UPLOADTHING_HOSTS = /(^|\.)(ufs\.sh|utfs\.io|uploadthing\.com)$/;

export function extractUploadThingKey(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (!UPLOADTHING_HOSTS.test(parsed.hostname)) return null;

  const segments = parsed.pathname.split("/").filter(Boolean);
  const key = segments.at(-1);
  return key || null;
}
