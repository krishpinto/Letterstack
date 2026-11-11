import { notFound } from "next/navigation";

import { isLabEnabled } from "@/lib/lab/dev-only";

// The lab page is a client component, so it can't refuse to render by
// itself. This server layout does it for every route under /lab, in
// addition to proxy.ts, so the page only exists under `next dev`.
export default function LabLayout({ children }: { children: React.ReactNode }) {
  if (!isLabEnabled()) notFound();
  return children;
}
