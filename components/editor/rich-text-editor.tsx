"use client";

import * as React from "react";
import * as ReactDOM from "react-dom";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import { cn } from "@/lib/utils";
import {
  type FormattingTextType,
  toFontSizeValue,
} from "./formatting-options";
import { useEditorToolbar } from "./editor-toolbar-context";
import {
  createSlashExtension,
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
  defaultTextType = "p",
  defaultFontSize,
}: {
  value: string;
  onChange?: (html: string) => void;
  editable?: boolean;
  className?: string;
  style?: React.CSSProperties;
  defaultTextType?: FormattingTextType;
  defaultFontSize?: string;
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
        heading:         { levels: [1, 2, 3] },
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

  // Register as the active editor for the pinned formatting toolbar. A single
  // block can mount several editable editors at once (a Text block has a
  // heading + body; an Article Card has a headline + body). Registering on
  // mount would let whichever mounts last hijack the toolbar, so formatting
  // always hit the wrong field. Instead the first editor claims the toolbar so
  // it appears immediately, and *focus* re-targets it to whichever field the
  // cursor is actually in. Cleanup only clears if we're still the active one.
  const { setActiveEditor } = useEditorToolbar();
  React.useEffect(() => {
    if (!editable || !editor) return;
    setActiveEditor((cur) => cur ?? editor);
    const claim = () => setActiveEditor(editor);
    editor.on("focus", claim);
    return () => {
      editor.off("focus", claim);
      setActiveEditor((cur) => (cur === editor ? null : cur));
    };
  }, [editable, editor, setActiveEditor]);

  const resolvedDefaultFontSize =
    defaultFontSize ?? toFontSizeValue(style?.fontSize);

  return (
    <div
      data-letterstack-rich-text
      data-default-text-type={defaultTextType}
      data-default-font-size={resolvedDefaultFontSize}
      className={cn("relative", className)}
      style={style}
    >
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
