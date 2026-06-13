import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import type { Editor } from "@tiptap/core";

export type SlashItem = {
  title: string;
  subtitle: string;
  run: (editor: Editor) => void;
};

export const SLASH_ITEMS: SlashItem[] = [
  { title: "Paragraph",     subtitle: "Default text block",    run: (e) => e.chain().focus().setParagraph().run() },
  { title: "Heading 2",     subtitle: "Large section heading", run: (e) => e.chain().focus().setHeading({ level: 2 }).run() },
  { title: "Heading 3",     subtitle: "Medium heading",        run: (e) => e.chain().focus().setHeading({ level: 3 }).run() },
  { title: "Bullet list",   subtitle: "Unordered list",        run: (e) => e.chain().focus().toggleBulletList().run() },
  { title: "Numbered list", subtitle: "Ordered list",          run: (e) => e.chain().focus().toggleOrderedList().run() },
  { title: "Quote",         subtitle: "Block quotation",       run: (e) => e.chain().focus().toggleBlockquote().run() },
];

export type SlashCallbacks = {
  onStart:  (items: SlashItem[], getRect: () => DOMRect | null, exec: (i: number) => void) => void;
  onUpdate: (items: SlashItem[], getRect: () => DOMRect | null, exec: (i: number) => void) => void;
  onClose:  () => void;
  onKeyDown:(event: KeyboardEvent) => boolean;
};

export function createSlashExtension(callbacksRef: { current: SlashCallbacks }) {
  return Extension.create({
    name: "slashCommand",
    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          char: "/",
          allowSpaces: false,
          startOfLine: false,
          items: ({ query }: { query: string }) =>
            SLASH_ITEMS.filter((item) =>
              item.title.toLowerCase().includes(query.toLowerCase()),
            ).slice(0, 8),
          render: () => ({
            onStart: (props) => {
              const items = props.items as SlashItem[];
              const getRect = (props.clientRect ?? (() => null)) as () => DOMRect | null;
              callbacksRef.current.onStart(items, getRect, (i) => props.command(items[i]));
            },
            onUpdate: (props) => {
              const items = props.items as SlashItem[];
              const getRect = (props.clientRect ?? (() => null)) as () => DOMRect | null;
              callbacksRef.current.onUpdate(items, getRect, (i) => props.command(items[i]));
            },
            onExit:   () => callbacksRef.current.onClose(),
            onKeyDown: ({ event }) => callbacksRef.current.onKeyDown(event),
          }),
          command: ({ editor, range, props }) => {
            editor.commands.deleteRange(range);
            (props as SlashItem).run(editor);
          },
        }),
      ];
    },
  });
}
