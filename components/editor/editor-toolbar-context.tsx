"use client";

import * as React from "react";
import type { Editor } from "@tiptap/react";

/**
 * Tracks the single TipTap editor that the pinned top formatting toolbar
 * acts on. Only the selected text block mounts an editable RichTextEditor, so
 * at most one editor is ever registered here at a time.
 */
type EditorToolbarContextValue = {
  activeEditor: Editor | null;
  setActiveEditor: React.Dispatch<React.SetStateAction<Editor | null>>;
};

const EditorToolbarContext = React.createContext<EditorToolbarContextValue | null>(null);

export function EditorToolbarProvider({ children }: { children: React.ReactNode }) {
  const [activeEditor, setActiveEditor] = React.useState<Editor | null>(null);
  const value = React.useMemo(() => ({ activeEditor, setActiveEditor }), [activeEditor]);
  return (
    <EditorToolbarContext.Provider value={value}>
      {children}
    </EditorToolbarContext.Provider>
  );
}

export function useEditorToolbar() {
  const ctx = React.useContext(EditorToolbarContext);
  if (!ctx) {
    throw new Error("useEditorToolbar must be used within an EditorToolbarProvider");
  }
  return ctx;
}
