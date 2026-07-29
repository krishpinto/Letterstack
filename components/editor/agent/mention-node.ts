import {
  $applyNodeReplacement,
  TextNode,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedTextNode,
  type Spread,
} from "lexical";

/**
 * An `@block` chip in the composer.
 *
 * Extends TextNode rather than DecoratorNode so the chip still participates in
 * normal text flow and selection, then switches to `token` mode — which is what
 * makes it atomic: one backspace removes the whole reference instead of eating
 * it a character at a time, and the caret can never land inside it.
 *
 * The chip's visible text is the block's summary; `blockId` is what actually
 * gets sent to the model. That separation is the point of the feature — users
 * pick by content, the agent receives an id.
 */

export type SerializedMentionNode = Spread<
  { blockId: string },
  SerializedTextNode
>;

const CHIP_CLASS =
  "rounded bg-primary/12 px-1 py-px text-primary font-medium";

export class MentionNode extends TextNode {
  __blockId: string;

  static getType(): string {
    return "mention";
  }

  static clone(node: MentionNode): MentionNode {
    return new MentionNode(node.__blockId, node.__text, node.__key);
  }

  constructor(blockId: string, text: string, key?: NodeKey) {
    super(text, key);
    this.__blockId = blockId;
  }

  getBlockId(): string {
    return this.getLatest().__blockId;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);
    dom.className = CHIP_CLASS;
    dom.setAttribute("data-block-id", this.__blockId);
    return dom;
  }

  static importJSON(serialized: SerializedMentionNode): MentionNode {
    return $createMentionNode(serialized.blockId, serialized.text);
  }

  exportJSON(): SerializedMentionNode {
    return {
      ...super.exportJSON(),
      blockId: this.__blockId,
      type: "mention",
      version: 1,
    };
  }

  isTextEntity(): boolean {
    return true;
  }
}

export function $createMentionNode(blockId: string, label: string): MentionNode {
  const node = new MentionNode(blockId, `@${label}`);
  // Atomic: selection treats the chip as one unit.
  node.setMode("token");
  return $applyNodeReplacement(node);
}

export function $isMentionNode(node: LexicalNode | null | undefined): node is MentionNode {
  return node instanceof MentionNode;
}
