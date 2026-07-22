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
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/coss-dialog";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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

  // Link editing runs through the themed coss-dialog. The TipTap selection is
  // captured on mousedown (before focus can shift into the dialog) and restored
  // when the link is applied, so the dialog never acts on a collapsed cursor.
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [linkUrl, setLinkUrl] = React.useState("");
  const [linkText, setLinkText] = React.useState("");
  const savedSelection = React.useRef<{ from: number; to: number } | null>(null);

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

  // Remember the current selection before the pointer can move focus into the
  // dialog. Runs on mousedown; the dialog opens on the following click.
  const captureLinkSelection = () => {
    const { from, to } = editor.state.selection;
    savedSelection.current = { from, to };
  };

  const openLinkDialog = () => {
    const existing = editor.getAttributes("link").href as string | undefined;
    const sel = savedSelection.current;
    const selectedText = sel ? editor.state.doc.textBetween(sel.from, sel.to) : "";
    setLinkUrl(existing ?? "");
    setLinkText(selectedText);
    setLinkOpen(true);
  };

  const applyLink = () => {
    const href = linkUrl.trim();
    const sel = savedSelection.current;
    if (!href || !sel) {
      setLinkOpen(false);
      return;
    }

    const chain = editor.chain().focus().setTextSelection(sel);
    if (sel.from === sel.to) {
      // No text selected — insert the label (or the URL) as a linked run.
      const label = linkText.trim() || href;
      chain.insertContent({
        type: "text",
        text: label,
        marks: [{ type: "link", attrs: { href } }],
      });
    } else {
      chain.extendMarkRange("link").setLink({ href });
    }
    chain.run();
    setLinkOpen(false);
  };

  const removeLink = () => {
    const sel = savedSelection.current;
    const chain = editor.chain().focus();
    if (sel) chain.setTextSelection(sel);
    chain.extendMarkRange("link").unsetLink().run();
    setLinkOpen(false);
  };

  return (
    <div className="flex items-center gap-1">
      <Select
        value={currentNodeType}
        onValueChange={(value) => applyNodeType(value as FormattingTextType)}
      >
        <SelectTrigger
          size="sm"
          className="h-7 w-[116px] text-xs"
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
          captureLinkSelection();
        }}
        onClick={openLinkDialog}
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
          className="h-7 w-[76px] text-xs"
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
        editor={editor}
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
        editor={editor}
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
        className="h-7 px-2 text-xs text-muted-foreground"
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

      <LinkDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        url={linkUrl}
        text={linkText}
        onUrlChange={setLinkUrl}
        onTextChange={setLinkText}
        collapsed={savedSelection.current?.from === savedSelection.current?.to}
        isEditing={editor.isActive("link")}
        onApply={applyLink}
        onRemove={removeLink}
      />
    </div>
  );
}

function LinkDialog({
  open,
  onOpenChange,
  url,
  text,
  onUrlChange,
  onTextChange,
  collapsed,
  isEditing,
  onApply,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  text: string;
  onUrlChange: (value: string) => void;
  onTextChange: (value: string) => void;
  collapsed: boolean;
  isEditing: boolean;
  onApply: () => void;
  onRemove: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-md" showCloseButton={false}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onApply();
          }}
          className="flex min-h-0 flex-col"
        >
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit link" : "Add link"}</DialogTitle>
          </DialogHeader>
          <DialogPanel>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="link-url">Link URL</FieldLabel>
                <Input
                  id="link-url"
                  autoFocus
                  value={url}
                  placeholder="https://..."
                  onChange={(event) => onUrlChange(event.target.value)}
                />
              </Field>
              {collapsed && (
                <Field>
                  <FieldLabel htmlFor="link-text">Text to display</FieldLabel>
                  <Input
                    id="link-text"
                    value={text}
                    placeholder="Falls back to the URL"
                    onChange={(event) => onTextChange(event.target.value)}
                  />
                </Field>
              )}
            </FieldGroup>
          </DialogPanel>
          <DialogFooter>
            {isEditing && (
              <Button
                type="button"
                variant="outline"
                className="mr-auto"
                onClick={onRemove}
              >
                Remove link
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{isEditing ? "Update" : "Add link"}</Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}

function ToolbarButton({
  active,
  onMouseDown,
  onClick,
  className,
  title,
  children,
}: {
  active: boolean;
  onMouseDown: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
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
      onClick={onClick}
      title={title}
      className={cn("text-[11px]", className)}
    >
      {children}
    </Button>
  );
}

function ToolbarSeparator() {
  return <Separator orientation="vertical" className="mx-0.5 data-vertical:h-5" />;
}

function ColorButton({
  editor,
  title,
  value,
  onChange,
  children,
}: {
  editor: Editor;
  title: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  // The native color input steals focus the moment its picker opens, which can
  // collapse the editor selection. Snapshot the range on mousedown and restore
  // it before applying, so the swatch always colors the intended text.
  const saved = React.useRef<{ from: number; to: number } | null>(null);
  return (
    <Button asChild variant="ghost" size="icon-xs" className="relative">
      <label
        title={title}
        onMouseDown={() => {
          const { from, to } = editor.state.selection;
          saved.current = { from, to };
        }}
      >
        {children}
        <input
          type="color"
          className="sr-only"
          value={value}
          onInput={(event) => {
            if (saved.current) editor.commands.setTextSelection(saved.current);
            onChange(event.currentTarget.value);
          }}
        />
      </label>
    </Button>
  );
}
