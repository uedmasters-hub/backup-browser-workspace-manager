import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import { getHTMLFromFragment } from "@tiptap/core";
import { Fragment } from "@tiptap/pm/model";
import type { Node as PMNode } from "@tiptap/pm/model";

import BlockShell from "./BlockShell";
import SlashMenu from "../SlashMenu";
import FormatToolbar from "../rich/FormatToolbar";
import { useRichEditor } from "../rich/useRichEditor";
import { useCopy } from "../useCopy";
import { filterBlockTypes, isBlockEmpty } from "../blockTypes";
import { blockHtml, docToPlainText, type RichJSON, type RichPart } from "../richText";
import { useNotesStore } from "../../../../stores/notesStore";

import type { NoteBlockType, TextBlock } from "../../../../types/notes";

type Slash = { query: string; anchor: DOMRect; from: number; to: number; index: number };

/** "/query" typed alone on an empty top-level line, caret at its end. */
function readSlash(editor: Editor): Slash | null {
  const { selection } = editor.state;
  const { $from } = selection;
  if (!selection.empty || $from.depth !== 1 || $from.parent.type.name !== "paragraph") return null;
  if ($from.parentOffset !== $from.parent.content.size) return null;
  const m = $from.parent.textContent.match(/^\/(\w*)$/);
  if (!m) return null;
  const c = editor.view.coordsAtPos($from.pos);
  return {
    query: m[1],
    anchor: DOMRect.fromRect({ x: c.left, y: c.top, width: 1, height: c.bottom - c.top }),
    from: $from.start(),
    to: $from.end(),
    index: $from.index(0),
  };
}

function partOf(editor: Editor, nodes: PMNode[]): RichPart | null {
  if (!nodes.length) return null;
  const text = docToPlainText({ type: "doc", content: nodes.map((n) => n.toJSON() as RichJSON) });
  if (!text.trim()) return null;
  return { html: getHTMLFromFragment(Fragment.fromArray(nodes), editor.schema), text };
}

export default function TextBlockView({ block }: { block: TextBlock }) {
  const updateBlock = useNotesStore((s) => s.updateBlock);
  const splitTextBlock = useNotesStore((s) => s.splitTextBlock);
  const deleteBlockFocusPrev = useNotesStore((s) => s.deleteBlockFocusPrev);
  const focusBlockId = useNotesStore((s) => s.focusBlockId);
  const consumeFocus = useNotesStore((s) => s.consumeFocus);
  const blockCount = useNotesStore(
    (s) => s.notes.find((n) => n.id === s.activeNoteId)?.blocks.length ?? 0
  );

  const [copied, copy] = useCopy();
  const [slash, setSlash] = useState<Slash | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const slashRef = useRef<Slash | null>(null);
  const activeRef = useRef(0);
  useLayoutEffect(() => {
    slashRef.current = slash;
    activeRef.current = activeIndex;
  });

  const syncSlash = useCallback((editor: Editor) => {
    const next = editor.isFocused ? readSlash(editor) : null;
    setSlash((prev) => {
      if (!next) return null;
      if (!prev || prev.query !== next.query) setActiveIndex(0);
      return next;
    });
  }, []);

  const pick = useCallback(
    (type: NoteBlockType, editor: Editor) => {
      const current = slashRef.current ?? readSlash(editor);
      setSlash(null);
      if (!current) return;
      if (type === "text") {
        editor.chain().focus().deleteRange({ from: current.from, to: current.to }).run();
        return;
      }
      const before: PMNode[] = [];
      const after: PMNode[] = [];
      editor.state.doc.forEach((node, _offset, i) => {
        if (i < current.index) before.push(node);
        else if (i > current.index) after.push(node);
      });
      splitTextBlock(block.id, partOf(editor, before), type, partOf(editor, after));
    },
    [block.id, splitTextBlock]
  );

  const editor = useRichEditor({
    variant: "full",
    html: blockHtml(block),
    placeholder: "Write something, or press “/” for blocks…",
    autoFocus: focusBlockId === block.id,
    onAutoFocused: consumeFocus,
    onChange: (part) => updateBlock(block.id, part),
    onSelectionChange: syncSlash,
    onKeyDown: (event, ed) => {
      const current = slashRef.current;
      if (current) {
        const items = filterBlockTypes(current.query);
        if (items.length && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
          const d = event.key === "ArrowDown" ? 1 : -1;
          setActiveIndex((i) => (i + d + items.length) % items.length);
          return true;
        }
        if (items.length && (event.key === "Enter" || event.key === "Tab")) {
          pick(items[Math.min(activeRef.current, items.length - 1)].type, ed);
          return true;
        }
        if (event.key === "Escape") {
          setSlash(null);
          ed.chain().deleteRange({ from: current.from, to: current.to }).run();
          return true;
        }
      }
      // Backspace in an empty block removes it (unless it's the only one).
      if (event.key === "Backspace" && ed.isEmpty && blockCount > 1) {
        deleteBlockFocusPrev(block.id);
        return true;
      }
      return false;
    },
  });

  // Close the slash menu when the note scrolls or the block loses focus.
  useEffect(() => {
    if (!slash) return;
    const close = () => setSlash(null);
    window.addEventListener("scroll", close, true);
    editor?.on("blur", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      editor?.off("blur", close);
    };
  }, [slash, editor]);

  if (!editor) return null;

  return (
    <BlockShell
      id={block.id}
      onCopy={() => copy(block.text, block.html)}
      copied={copied}
      empty={isBlockEmpty(block)}
    >
      <div className="relative">
        <EditorContent editor={editor} />
        <FormatToolbar editor={editor} variant="full" suppress={() => slashRef.current !== null} />
        {slash && (
          <SlashMenu
            query={slash.query}
            activeIndex={activeIndex}
            anchor={slash.anchor}
            onPick={(type) => pick(type, editor)}
            onHover={setActiveIndex}
          />
        )}
      </div>
    </BlockShell>
  );
}
