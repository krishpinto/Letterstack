import { EditorNewShell } from "@/components/editor-new/editor-new-shell"
import { EditorBackLink } from "@/components/editor-new/editor-back-link"

export default function EditorNewPage() {
  return (
    <>
      {/* Back to where you came from — overlaid at the page level so we don't
          touch the editor component itself. Reads the return URL set when the
          editor was opened (campaign or templates). */}
      <EditorBackLink />
      <EditorNewShell />
    </>
  )
}
