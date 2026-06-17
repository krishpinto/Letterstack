"use client";

import * as React from "react";
import type { Editor } from "@tiptap/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AiEraserIcon,
  Link01Icon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  FORMATTING_FONT_SIZES,
  FORMATTING_TEXT_TYPES,
  getCurrentFontSize,
  getCurrentTextType,
  setFormattingTextTypeOverride,
  type FormattingTextType,
} from "./formatting-options";

/**
 * Canva-style text formatting toolbar, pinned permanently to the top of the
 * editor. It acts on whichever text block is currently selected (`editor`).
 * When nothing editable is selected it shows a muted hint instead.
 */
export function FormattingToolbar({ editor }: { editor: Editor | null }) {
  const [, force] = React.useReducer((x) => x + 1, 0);

  React.useEffect(() => {
    if (!editor) return;

    const update = () => force();
    editor.on("transaction", update);
    editor.on("selectionUpdate", update);
    editor.on("update", update);
    editor.on("focus", update);

    return () => {
      editor.off("transaction", update);
      editor.off("selectionUpdate", update);
      editor.off("update", update);
      editor.off("focus", update);
    };
  }, [editor]);

  if (!editor) {
    return (
      <span className="select-none text-xs text-muted-foreground">
        Select a text block to format it
      </span>
    );
  }

  const currentNodeType = getCurrentTextType(editor);
  const currentFontSize = getCurrentFontSize(editor, currentNodeType);

  const applyNodeType = (type: FormattingTextType) => {
    const chain = editor.chain().focus();
    setFormattingTextTypeOverride(editor, type);

    if (editor.isActive("blockquote") && type !== "quote") {
      chain.toggleBlockquote();
    }

    switch (type) {
      case "p":
        chain.setParagraph().run();
        break;
      case "h1":
        chain.setHeading({ level: 1 }).run();
        break;
      case "h2":
        chain.setHeading({ level: 2 }).run();
        break;
      case "h3":
        chain.setHeading({ level: 3 }).run();
        break;
      case "quote":
        if (!editor.isActive("blockquote")) chain.toggleBlockquote();
        chain.run();
        break;
    }
  };

  const toggleLink = () => {
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }

    const url = window.prompt("Enter URL:");
    if (url) editor.chain().focus().setLink({ href: url }).run();
  };

  return (
    <div className="flex items-center gap-1">
      <Select
        value={currentNodeType}
        onValueChange={(value) => applyNodeType(value as FormattingTextType)}
      >
        <SelectTrigger
          size="sm"
          className="h-7 w-[116px] border-white/10 bg-zinc-900 text-xs text-zinc-100 hover:bg-zinc-800"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="min-w-[140px]">
          <SelectGroup>
            {FORMATTING_TEXT_TYPES.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <ToolbarSeparator />

      <ToolbarButton
        active={editor.isActive("link")}
        onMouseDown={(event) => {
          event.preventDefault();
          toggleLink();
        }}
        title="Link"
      >
        <HugeiconsIcon icon={Link01Icon} strokeWidth={2} data-icon="icon" />
      </ToolbarButton>

      <ToolbarSeparator />

      <ToolbarButton
        active={editor.isActive("bold")}
        onMouseDown={(event) => {
          event.preventDefault();
          editor.chain().focus().toggleBold().run();
        }}
        className="font-bold"
        title="Bold"
      >
        B
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("italic")}
        onMouseDown={(event) => {
          event.preventDefault();
          editor.chain().focus().toggleItalic().run();
        }}
        className="italic"
        title="Italic"
      >
        I
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("underline")}
        onMouseDown={(event) => {
          event.preventDefault();
          editor.chain().focus().toggleUnderline().run();
        }}
        className="underline"
        title="Underline"
      >
        U
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("strike")}
        onMouseDown={(event) => {
          event.preventDefault();
          editor.chain().focus().toggleStrike().run();
        }}
        className="line-through"
        title="Strikethrough"
      >
        S
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("code")}
        onMouseDown={(event) => {
          event.preventDefault();
          editor.chain().focus().toggleCode().run();
        }}
        className="font-mono text-[10px]"
        title="Code"
      >
        &lt;/&gt;
      </ToolbarButton>

      <ToolbarSeparator />

      <Select
        value={FORMATTING_FONT_SIZES.includes(currentFontSize) ? currentFontSize : "custom"}
        onValueChange={(value) => {
          if (value === "custom") return;
          editor.chain().focus().setMark("textStyle", { fontSize: value }).run();
        }}
      >
        <SelectTrigger
          size="sm"
          className="h-7 w-[76px] border-white/10 bg-zinc-900 text-xs text-zinc-100 hover:bg-zinc-800"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <SelectValue>
            {currentFontSize === "custom" ? "size" : currentFontSize.replace("px", "")}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="min-w-[88px]">
          <SelectGroup>
            {!FORMATTING_FONT_SIZES.includes(currentFontSize) && (
              <SelectItem value="custom">{currentFontSize.replace("px", "")}</SelectItem>
            )}
            {FORMATTING_FONT_SIZES.map((size) => (
              <SelectItem key={size} value={size}>
                {size.replace("px", "")}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <ToolbarSeparator />

      <ColorButton
        title="Text color"
        value={editor.getAttributes("textStyle").color || "#000000"}
        onChange={(value) => editor.chain().focus().setColor(value).run()}
      >
        <span
          className="select-none text-[11px] font-extrabold underline decoration-[2.5px] underline-offset-2"
          style={{ color: editor.getAttributes("textStyle").color || "currentColor" }}
        >
          A
        </span>
      </ColorButton>

      <ColorButton
        title="Highlight"
        value={
          editor.isActive("highlight")
            ? editor.getAttributes("highlight").color ?? "#fef08a"
            : "#fef08a"
        }
        onChange={(value) => editor.chain().focus().setHighlight({ color: value }).run()}
      >
        <span
          className="select-none rounded-sm px-0.5 text-[11px] font-extrabold leading-tight"
          style={{
            backgroundColor: editor.isActive("highlight")
              ? editor.getAttributes("highlight").color ?? "#fef08a"
              : "#fef08a",
            color: "#1a1a1a",
          }}
        >
          H
        </span>
      </ColorButton>

      <ToolbarSeparator />

      <ToolbarButton
        active={editor.isActive({ textAlign: "left" })}
        onMouseDown={(event) => {
          event.preventDefault();
          editor.chain().focus().setTextAlign("left").run();
        }}
        title="Align left"
      >
        <HugeiconsIcon icon={TextAlignLeftIcon} strokeWidth={2} data-icon="icon" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive({ textAlign: "center" })}
        onMouseDown={(event) => {
          event.preventDefault();
          editor.chain().focus().setTextAlign("center").run();
        }}
        title="Align center"
      >
        <HugeiconsIcon icon={TextAlignCenterIcon} strokeWidth={2} data-icon="icon" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive({ textAlign: "right" })}
        onMouseDown={(event) => {
          event.preventDefault();
          editor.chain().focus().setTextAlign("right").run();
        }}
        title="Align right"
      >
        <HugeiconsIcon icon={TextAlignRightIcon} strokeWidth={2} data-icon="icon" />
      </ToolbarButton>

      <ToolbarSeparator />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
        title="Clear formatting"
        onMouseDown={(event) => {
          event.preventDefault();
          setFormattingTextTypeOverride(editor, "p");
          editor.chain().focus().clearNodes().unsetAllMarks().run();
        }}
      >
        <HugeiconsIcon icon={AiEraserIcon} strokeWidth={2} data-icon="inline-start" />
        Clear
      </Button>
    </div>
  );
}

function ToolbarButton({
  active,
  onMouseDown,
  className,
  title,
  children,
}: {
  active: boolean;
  onMouseDown: (event: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "ghost"}
      size="icon-xs"
      onMouseDown={onMouseDown}
      title={title}
      className={cn(
        "text-[11px]",
        !active && "text-zinc-100 hover:bg-white/10 hover:text-zinc-100",
        className,
      )}
    >
      {children}
    </Button>
  );
}

function ToolbarSeparator() {
  return <Separator orientation="vertical" className="mx-0.5 data-vertical:h-5" />;
}

function ColorButton({
  title,
  value,
  onChange,
  children,
}: {
  title: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      asChild
      variant="ghost"
      size="icon-xs"
      className="relative text-zinc-100 hover:bg-white/10 hover:text-zinc-100"
    >
      <label title={title}>
        {children}
        <input
          type="color"
          className="sr-only"
          value={value}
          onInput={(event) => onChange(event.currentTarget.value)}
        />
      </label>
    </Button>
  );
}
