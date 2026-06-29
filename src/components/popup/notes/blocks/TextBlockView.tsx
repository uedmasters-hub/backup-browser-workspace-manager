import { useEffect, useRef, useState } from "react";

import BlockShell from "./BlockShell";
import SlashMenu from "../SlashMenu";
import { useCopy } from "../useCopy";
import { filterBlockTypes } from "../blockTypes";
import { useNotesStore } from "../../../../stores/notesStore";

import type {
  NoteBlockType,
  TextBlock,
} from "../../../../types/notes";

export default function TextBlockView({ block }: { block: TextBlock }) {
  const updateBlock = useNotesStore((s) => s.updateBlock);
  const transformBlock = useNotesStore((s) => s.transformBlock);
  const addLineAfter = useNotesStore((s) => s.addLineAfter);
  const deleteBlockFocusPrev = useNotesStore((s) => s.deleteBlockFocusPrev);
  const focusBlockId = useNotesStore((s) => s.focusBlockId);
  const consumeFocus = useNotesStore((s) => s.consumeFocus);
  const blockCount = useNotesStore(
    (s) =>
      s.notes.find((n) => n.id === s.activeNoteId)?.blocks.length ?? 0
  );

  const [copied, copy] = useCopy();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  // grow to fit
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [block.text]);

  // close the slash menu if the list scrolls (keeps it anchored correctly)
  useEffect(() => {
    if (slashQuery === null) return;
    function close() {
      setSlashQuery(null);
    }
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [slashQuery]);

  // autofocus when this block was just created
  useEffect(() => {
    if (focusBlockId === block.id && ref.current) {
      ref.current.focus();
      const end = ref.current.value.length;
      ref.current.setSelectionRange(end, end);
      consumeFocus();
    }
  }, [focusBlockId, block.id, consumeFocus]);

  function onChange(value: string) {
    updateBlock(block.id, { text: value });
    const match = value.match(/^\/(\w*)$/);
    if (match) {
      setAnchorRect(ref.current?.getBoundingClientRect() ?? null);
      setSlashQuery(match[1]);
      setActiveIndex(0);
    } else {
      setSlashQuery(null);
    }
  }

  function pick(type: NoteBlockType) {
    setSlashQuery(null);
    if (type === "text") {
      updateBlock(block.id, { text: "" });
    } else {
      transformBlock(block.id, type);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (slashQuery !== null) {
      const items = filterBlockTypes(slashQuery);
      if (items.length) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setActiveIndex((i) => (i + 1) % items.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setActiveIndex((i) => (i - 1 + items.length) % items.length);
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          pick(items[activeIndex].type);
          return;
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSlashQuery(null);
        updateBlock(block.id, { text: "" });
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Never stack blank lines: Enter on an empty block does nothing.
      if (block.text.trim() !== "") {
        addLineAfter(block.id);
      }
      return;
    }

    if (e.key === "Backspace" && block.text === "" && blockCount > 1) {
      e.preventDefault();
      deleteBlockFocusPrev(block.id);
    }
  }

  return (
    <BlockShell id={block.id} onCopy={() => copy(block.text)} copied={copied}>
      <div className="relative">
        <textarea
          ref={ref}
          rows={1}
          value={block.text}
          placeholder="Write something, or press “/” for blocks…"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => setTimeout(() => setSlashQuery(null), 120)}
          className="w-full resize-none bg-transparent px-2 py-1.5 text-[15px] leading-relaxed text-neutral-800 outline-none placeholder:text-neutral-300"
        />
        {slashQuery !== null && (
          <SlashMenu
            query={slashQuery}
            activeIndex={activeIndex}
            anchor={anchorRect}
            onPick={pick}
            onHover={setActiveIndex}
          />
        )}
      </div>
    </BlockShell>
  );
}
