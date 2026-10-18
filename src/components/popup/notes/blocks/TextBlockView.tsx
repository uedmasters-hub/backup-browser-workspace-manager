import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import { getHTMLFromFragment } from "@tiptap/core";
import { Fragment } from "@tiptap/pm/model";
import type { Node as PMNode } from "@tiptap/pm/model";

import BlockShell from "./BlockShell";
import SlashMenu from "../SlashMenu";
import FormatToolbar from "../rich/FormatToolbar";
import TableControls from "../rich/TableControls";
import { useRichEditor } from "../rich/useRichEditor";
import { useCopy } from "../useCopy";
import { filterBlockTypes, isBlockEmpty, type SlashType } from "../blockTypes";
import { blockHtml, docToPlainText, type RichJSON, type RichPart } from "../richText";
import { handleRichNavKey, registerEditor, trimTrailingEmptyLines } from "../blockNav";
import { filesToImages, insertImages } from "../images";
import { useNotesStore } from "../../../../stores/notesStore";

import type { TextBlock } from "../../../../types/notes";

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
  const focusAt = useNotesStore((s) => s.focusAt);
  const consumeFocus = useNotesStore((s) => s.consumeFocus);
  const blockCount = useNotesStore(
    (s) => s.notes.find((n) => n.id === s.activeNoteId)?.blocks.length ?? 0
  );
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  /** A picture is being chosen — keep the empty line it will go on. */
  const choosingImage = useRef(false);

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
    (type: SlashType, editor: Editor) => {
      const current = slashRef.current ?? readSlash(editor);
      setSlash(null);
      if (!current) return;
      const range = { from: current.from, to: current.to };
      if (type === "text") {
        editor.chain().focus().deleteRange(range).run();
        return;
      }
      // Pictures and tables go right here, inside the text.
      if (type === "image") {
        editor.chain().focus().deleteRange(range).run();
        choosingImage.current = true;
        fileRef.current?.click();
        return;
      }
      if (type === "table") {
        editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
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
    focusAt,
    onAutoFocused: consumeFocus,
    onChange: (part) => updateBlock(block.id, part),
    onSelectionChange: syncSlash,
    onBlur: (ed) => {
      if (!choosingImage.current) trimTrailingEmptyLines(ed);
    },
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
      // Tab / Shift+Tab, and ↑ ↓ at the first / last line: neighbouring blocks.
      if (handleRichNavKey(event, ed, block.id)) return true;
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

  // Closing the picker without a choice: back to writing.
  useEffect(() => {
    const input = fileRef.current;
    if (!input || !editor) return;
    const onCancel = () => {
      choosingImage.current = false;
      editor.commands.focus();
    };
    input.addEventListener("cancel", onCancel);
    return () => input.removeEventListener("cancel", onCancel);
  }, [editor]);

  // Tab / arrows from other blocks find this editor here.
  useEffect(() => (editor ? registerEditor(block.id, editor) : undefined), [editor, block.id]);

  if (!editor) return null;

  return (
    <BlockShell
      id={block.id}
      onCopy={() => copy(block.text, block.html)}
      copied={copied}
      empty={isBlockEmpty(block)}
    >
      <div className="relative" ref={wrapperRef}>
        <EditorContent editor={editor} />
        <FormatToolbar editor={editor} variant="full" suppress={() => slashRef.current !== null} />
        <TableControls editor={editor} wrapper={wrapperRef} />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.currentTarget.files ?? []);
            e.currentTarget.value = "";
            void filesToImages(files).then((imgs) => {
              choosingImage.current = false;
              insertImages(editor, imgs);
            });
          }}
        />
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
