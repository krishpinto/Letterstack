"use client";

import * as React from "react";
import * as ReactDOM from "react-dom";
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import { cn } from "@/lib/utils";
import {
  createSlashExtension,
  SLASH_ITEMS,
  type SlashCallbacks,
  type SlashItem,
} from "./slash-command-extension";

// ─── Extend TextStyle with fontSize ──────────────────────────────────────────

const TextStyleExtended = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (el: HTMLElement) => el.style.fontSize || null,
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
      },
    };
  },
});

const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px"];

// ─── Slash menu state ─────────────────────────────────────────────────────────

type SlashMenuState = {
  items: SlashItem[];
  rect: DOMRect | null;
  selectedIndex: number;
  execCommand: (i: number) => void;
};

// ─── RichTextEditor ───────────────────────────────────────────────────────────

export function RichTextEditor({
  value,
  onChange,
  editable = false,
  className,
  style,
}: {
  value: string;
  onChange?: (html: string) => void;
  editable?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  // Slash menu state
  const [slashMenu, setSlashMenu] = React.useState<SlashMenuState | null>(null);
  const slashMenuRef = React.useRef<SlashMenuState | null>(null);
  slashMenuRef.current = slashMenu;

  // Stable callbacks ref updated each render so TipTap always gets fresh closures
  const callbacksRef = React.useRef<SlashCallbacks>({
    onStart:  () => {},
    onUpdate: () => {},
    onClose:  () => {},
    onKeyDown: () => false,
  });
  callbacksRef.current = {
    onStart: (items, getRect, execCommand) => {
      setSlashMenu({ items, rect: getRect(), selectedIndex: 0, execCommand });
    },
    onUpdate: (items, getRect, execCommand) => {
      setSlashMenu((prev) =>
        prev ? { ...prev, items, rect: getRect(), selectedIndex: 0, execCommand } : null,
      );
    },
    onClose: () => setSlashMenu(null),
    onKeyDown: (event) => {
      const cur = slashMenuRef.current;
      if (!cur) return false;
      if (event.key === "ArrowDown") {
        setSlashMenu((m) =>
          m ? { ...m, selectedIndex: (m.selectedIndex + 1) % m.items.length } : null,
        );
        return true;
      }
      if (event.key === "ArrowUp") {
        setSlashMenu((m) =>
          m ? { ...m, selectedIndex: (m.selectedIndex - 1 + m.items.length) % m.items.length } : null,
        );
        return true;
      }
      if (event.key === "Enter") {
        cur.execCommand(cur.selectedIndex);
        return true;
      }
      if (event.key === "Escape") {
        setSlashMenu(null);
        return true;
      }
      return false;
    },
  };

  // Slash extension created once per editor instance
  const [slashExt] = React.useState(() => createSlashExtension(callbacksRef));

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading:         { levels: [2, 3] },
        codeBlock:       false,
        horizontalRule:  false,
      }),
      Underline,
      TextStyleExtended,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["paragraph", "heading"] }),
      Link.configure({ openOnClick: false, defaultProtocol: "https" }),
      slashExt,
    ],
    content: value || "<p></p>",
    editable,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
    editorProps: {
      attributes: { class: "focus:outline-none" },
    },
    immediatelyRender: false,
  });

  // Sync editable prop
  React.useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  // Sync external value without clobbering an active cursor
  React.useEffect(() => {
    if (!editor || editor.view.hasFocus()) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [editor, value]);

  // Current node type for the dropdown
  const currentNodeType = !editor
    ? "p"
    : editor.isActive("heading", { level: 2 })
    ? "h2"
    : editor.isActive("heading", { level: 3 })
    ? "h3"
    : editor.isActive("blockquote")
    ? "quote"
    : "p";

  const applyNodeType = (type: string) => {
    if (!editor) return;
    switch (type) {
      case "p":     editor.chain().focus().setParagraph().run(); break;
      case "h2":    editor.chain().focus().setHeading({ level: 2 }).run(); break;
      case "h3":    editor.chain().focus().setHeading({ level: 3 }).run(); break;
      case "quote": editor.chain().focus().toggleBlockquote().run(); break;
    }
  };

  const toggleLink = () => {
    if (!editor) return;
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
    } else {
      const url = window.prompt("Enter URL:");
      if (url) editor.chain().focus().setLink({ href: url }).run();
    }
  };

  return (
    <div className={cn("relative", className)} style={style}>
      {/* ── Bubble menu ─────────────────────────────────────────────────── */}
      {editable && editor && (
        <BubbleMenu
          editor={editor}
          options={{ placement: "top-start", offset: { mainAxis: 8 } }}
        >
          <div className="flex items-center gap-0.5 rounded-lg border bg-card px-1.5 py-1 shadow-lg">

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

            {/* Bold */}
            <ToolbarButton active={editor.isActive("bold")} onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }} className="font-bold" title="Bold">B</ToolbarButton>
            {/* Italic */}
            <ToolbarButton active={editor.isActive("italic")} onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }} className="italic" title="Italic">I</ToolbarButton>
            {/* Underline */}
            <ToolbarButton active={editor.isActive("underline")} onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }} className="underline" title="Underline">U</ToolbarButton>
            {/* Strikethrough */}
            <ToolbarButton active={editor.isActive("strike")} onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleStrike().run(); }} className="line-through" title="Strikethrough">S</ToolbarButton>
            {/* Inline code */}
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
        </BubbleMenu>
      )}

      <EditorContent
        editor={editor}
        className={cn(
          "[&_.ProseMirror]:outline-none",
          "[&_.ProseMirror_p]:m-0",
          "[&_.ProseMirror_p+p]:mt-1",
          "[&_.ProseMirror_h2]:m-0 [&_.ProseMirror_h2]:font-extrabold",
          "[&_.ProseMirror_h3]:m-0 [&_.ProseMirror_h3]:font-bold",
          "[&_.ProseMirror_blockquote]:border-l-2 [&_.ProseMirror_blockquote]:border-current/30 [&_.ProseMirror_blockquote]:pl-3 [&_.ProseMirror_blockquote]:opacity-75",
          "[&_.ProseMirror_ul]:pl-4 [&_.ProseMirror_ul]:list-disc",
          "[&_.ProseMirror_ol]:pl-4 [&_.ProseMirror_ol]:list-decimal",
          editable && [
            "[&_.ProseMirror]:border-b [&_.ProseMirror]:border-dashed [&_.ProseMirror]:border-current/20",
            "[&_.ProseMirror:focus-within]:border-current/40",
          ],
        )}
      />

      {/* ── Slash command menu ──────────────────────────────────────────── */}
      {editable && slashMenu && slashMenu.rect && typeof document !== "undefined" &&
        ReactDOM.createPortal(
          <SlashCommandMenu
            items={slashMenu.items}
            selectedIndex={slashMenu.selectedIndex}
            rect={slashMenu.rect}
            onSelect={(i) => slashMenu.execCommand(i)}
          />,
          document.body,
        )}
    </div>
  );
}

// ─── Slash command popup ──────────────────────────────────────────────────────

function SlashCommandMenu({
  items,
  selectedIndex,
  rect,
  onSelect,
}: {
  items: SlashItem[];
  selectedIndex: number;
  rect: DOMRect;
  onSelect: (i: number) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: rect.bottom + 6,
        left: rect.left,
        zIndex: 9999,
      }}
      className="min-w-[180px] overflow-hidden rounded-lg border bg-card shadow-xl"
    >
      {items.map((item, i) => (
        <button
          key={item.title}
          type="button"
          className={cn(
            "flex w-full flex-col px-3 py-2 text-left transition-colors",
            i === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted",
          )}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(i);
          }}
        >
          <span className="text-[13px] font-medium">{item.title}</span>
          <span className="text-[11px] text-muted-foreground">{item.subtitle}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Toolbar primitives ───────────────────────────────────────────────────────

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
