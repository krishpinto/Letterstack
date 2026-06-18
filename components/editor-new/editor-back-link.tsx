"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// The editor's "back" affordance. Reads the return URL stashed when entering the
// editor (from a campaign's Edit design, or the templates gallery) and links
// there — falling back to the campaigns list. Lives at the page level so we
// don't touch the editor component itself.
export function EditorBackLink() {
  const [href, setHref] = useState("/dashboard/campaigns");
  const [label, setLabel] = useState("Back");

  useEffect(() => {
    try {
      const ret = localStorage.getItem("letterstack-return-to");
      if (ret) {
        setHref(ret);
        setLabel(ret.includes("/campaigns/") ? "Back to campaign" : "Back");
      }
    } catch {
      // ignore
    }
  }, []);

  return (
    <Link
      href={href}
      className="fixed right-3 top-3 z-50 flex items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-900/90 px-3 py-1.5 text-xs font-medium text-zinc-100 shadow-lg backdrop-blur transition-colors hover:bg-zinc-800"
    >
      ← {label}
    </Link>
  );
}
