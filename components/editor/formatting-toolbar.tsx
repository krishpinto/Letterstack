"use client";

import * as React from "react";
import type { Editor } from "@tiptap/react";
import { cn } from "@/lib/utils";

const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px"];

/**
 * Canva-style text formatting toolbar, pinned permanently to the top of the
 * editor. It acts on whichever text block is currently selected (`editor`).
 * When nothing editable is selected it shows a muted hint instead.
 */
export function FormattingToolbar({ editor }: { editor: Editor | null }) {
  // The editor lives in a different React tree, so subscribe to its updates to
  // keep active states (bold, alignment, colour, …) live in this toolbar.
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    if (!editor) return;
    const update = () => force();
    editor.on("transaction", update);
    editor.on("selectionUpdate", update);
    return () => {
      editor.off("transaction", update);
      editor.off("selectionUpdate", update);
    };
  }, [editor]);

  if (!editor) {
    return (
      <span className="select-none text-xs text-muted-foreground">
        Select a text block to format it
      </span>
    );
  }

  const currentNodeType = editor.isActive("heading", { level: 2 })
    ? "h2"
    : editor.isActive("heading", { level: 3 })
    ? "h3"
    : editor.isActive("blockquote")
    ? "quote"
    : "p";

  const applyNodeType = (type: string) => {
    switch (type) {
      case "p":     editor.chain().focus().setParagraph().run(); break;
      case "h2":    editor.chain().focus().setHeading({ level: 2 }).run(); break;
      case "h3":    editor.chain().focus().setHeading({ level: 3 }).run(); break;
      case "quote": editor.chain().focus().toggleBlockquote().run(); break;
    }
  };

  const toggleLink = () => {
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
    } else {
      const url = window.prompt("Enter URL:");
      if (url) editor.chain().focus().setLink({ href: url }).run();
    }
  };

  return (
    <div className="flex items-center gap-0.5">
      {/* Node type */}
      <select
        className="h-6 cursor-pointer rounded border border-border/50 bg-card px-1 text-[11px] font-medium outline-none"
        value={currentNodeType}
        onChange={(e) => applyNodeType(e.target.value)}
      >
        <option value="p">Text</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
        <option value="quote">Quote</option>
      </select>

      <Divider />

      {/* Link */}
      <ToolbarButton
        active={editor.isActive("link")}
        onMouseDown={(e) => { e.preventDefault(); toggleLink(); }}
        title="Link"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4.5 7.5 7.5 4.5"/>
          <path d="M5.5 3.5 6.5 2.5a2.828 2.828 0 1 1 4 4L9.5 7.5"/>
          <path d="M6.5 8.5 5.5 9.5a2.828 2.828 0 1 1-4-4L2.5 4.5"/>
        </svg>
      </ToolbarButton>

      <Divider />

      <ToolbarButton active={editor.isActive("bold")} onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }} className="font-bold" title="Bold">B</ToolbarButton>
      <ToolbarButton active={editor.isActive("italic")} onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }} className="italic" title="Italic">I</ToolbarButton>
      <ToolbarButton active={editor.isActive("underline")} onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }} className="underline" title="Underline">U</ToolbarButton>
      <ToolbarButton active={editor.isActive("strike")} onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleStrike().run(); }} className="line-through" title="Strikethrough">S</ToolbarButton>
      <ToolbarButton active={editor.isActive("code")} onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleCode().run(); }} className="font-mono text-[10px]" title="Code">&lt;/&gt;</ToolbarButton>

      <Divider />

      {/* Font size */}
      <select
        className="h-6 cursor-pointer rounded border border-border/50 bg-card px-1 text-[11px] outline-none"
        value={editor.getAttributes("textStyle").fontSize || ""}
        onChange={(e) => {
          if (e.target.value) {
            editor.chain().focus().setMark("textStyle", { fontSize: e.target.value }).run();
          } else {
            editor.chain().focus().setMark("textStyle", { fontSize: null }).run();
          }
        }}
      >
        <option value="">size</option>
        {FONT_SIZES.map((s) => (
          <option key={s} value={s}>{s.replace("px", "")}</option>
        ))}
      </select>

      <Divider />

      {/* Text color */}
      <label className="flex h-6 w-6 cursor-pointer items-center justify-center rounded hover:bg-muted" title="Text color">
        <span
          className="select-none text-[11px] font-extrabold"
          style={{
            color: editor.getAttributes("textStyle").color || "currentColor",
            textDecoration: "underline",
            textDecorationThickness: "2.5px",
          }}
        >A</span>
        <input
          type="color"
          className="sr-only"
          value={editor.getAttributes("textStyle").color || "#000000"}
          onInput={(e) => editor.chain().focus().setColor(e.currentTarget.value).run()}
        />
      </label>

      {/* Highlight */}
      <label className="flex h-6 w-6 cursor-pointer items-center justify-center rounded hover:bg-muted" title="Highlight">
        <span
          className="select-none rounded-sm px-0.5 text-[11px] font-extrabold leading-tight"
          style={{
            backgroundColor: editor.isActive("highlight")
              ? (editor.getAttributes("highlight").color ?? "#fef08a")
              : "#fef08a",
            color: "#1a1a1a",
          }}
        >H</span>
        <input
          type="color"
          className="sr-only"
          value={editor.isActive("highlight") ? (editor.getAttributes("highlight").color ?? "#fef08a") : "#fef08a"}
          onInput={(e) => editor.chain().focus().setHighlight({ color: e.currentTarget.value }).run()}
        />
      </label>

      <Divider />

      {/* Alignment */}
      <ToolbarButton active={editor.isActive({ textAlign: "left" })}   onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setTextAlign("left").run(); }} title="Align left"><AlignLeftIcon /></ToolbarButton>
      <ToolbarButton active={editor.isActive({ textAlign: "center" })} onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setTextAlign("center").run(); }} title="Align center"><AlignCenterIcon /></ToolbarButton>
      <ToolbarButton active={editor.isActive({ textAlign: "right" })}  onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setTextAlign("right").run(); }} title="Align right"><AlignRightIcon /></ToolbarButton>

      <Divider />

      {/* Clear formatting */}
      <ToolbarButton
        active={false}
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().clearNodes().unsetAllMarks().run(); }}
        className="text-muted-foreground"
        title="Clear formatting"
      >✕</ToolbarButton>
    </div>
  );
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function ToolbarButton({
  active,
  onMouseDown,
  className,
  title,
  children,
}: {
  active: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={onMouseDown}
      title={title}
      className={cn(
        "flex h-6 min-w-[24px] items-center justify-center rounded px-1 text-[11px] transition-colors",
        active ? "bg-primary text-primary-foreground" : "hover:bg-muted",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="mx-0.5 h-4 w-px shrink-0 bg-border" />;
}

// ─── Alignment icons ──────────────────────────────────────────────────────────

function AlignLeftIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <rect x="0" y="1.5" width="12" height="1.5" rx="0.5" />
      <rect x="0" y="5"   width="7"  height="1.5" rx="0.5" />
      <rect x="0" y="8.5" width="10" height="1.5" rx="0.5" />
    </svg>
  );
}

function AlignCenterIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <rect x="0"   y="1.5" width="12" height="1.5" rx="0.5" />
      <rect x="2.5" y="5"   width="7"  height="1.5" rx="0.5" />
      <rect x="1"   y="8.5" width="10" height="1.5" rx="0.5" />
    </svg>
  );
}

function AlignRightIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <rect x="0" y="1.5" width="12" height="1.5" rx="0.5" />
      <rect x="5" y="5"   width="7"  height="1.5" rx="0.5" />
      <rect x="2" y="8.5" width="10" height="1.5" rx="0.5" />
    </svg>
  );
}
