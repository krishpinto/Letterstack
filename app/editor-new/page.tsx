import Link from "next/link"
import { EditorNewShell } from "@/components/editor-new/editor-new-shell"

export default function EditorNewPage() {
  return (
    <>
      {/* Back to dashboard — overlaid here at the page level so we don't touch
          the editor component itself. Top-right keeps it clear of the editor's
          left sidebar and centered toolbar. */}
      <Link
        href="/dashboard"
        className="fixed right-3 top-3 z-50 flex items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-900/90 px-3 py-1.5 text-xs font-medium text-zinc-100 shadow-lg backdrop-blur transition-colors hover:bg-zinc-800"
      >
        ← Dashboard
      </Link>
      <EditorNewShell />
    </>
  )
}
