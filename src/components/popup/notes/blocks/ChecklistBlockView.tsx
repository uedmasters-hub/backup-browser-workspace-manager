import { useEffect, useRef } from "react";
import { Check, Plus } from "lucide-react";

import BlockShell from "./BlockShell";
import { useCopy } from "../useCopy";
import { useNotesStore } from "../../../../stores/notesStore";
import type {
  ChecklistBlock,
  ChecklistItem,
} from "../../../../types/notes";

function newItem(): ChecklistItem {
  return { id: crypto.randomUUID(), text: "", done: false };
}

export default function ChecklistBlockView({
  block,
}: {
  block: ChecklistBlock;
}) {
  const updateBlock = useNotesStore((s) => s.updateBlock);
  const focusBlockId = useNotesStore((s) => s.focusBlockId);
  const consumeFocus = useNotesStore((s) => s.consumeFocus);
  const [copied, copy] = useCopy();

  const firstRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusBlockId === block.id) {
      firstRef.current?.focus();
      consumeFocus();
    }
  }, [focusBlockId, block.id, consumeFocus]);

  function patch(items: ChecklistItem[]) {
    updateBlock(block.id, { items });
  }

  function asText() {
    return block.items
      .map((i) => `${i.done ? "[x]" : "[ ]"} ${i.text}`)
      .join("\n");
  }

  return (
    <BlockShell id={block.id} onCopy={() => copy(asText())} copied={copied}>
      <div className="space-y-0.5 px-2 py-1">
        {block.items.map((item) => (
          <div key={item.id} className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() =>
                patch(
                  block.items.map((i) =>
                    i.id === item.id ? { ...i, done: !i.done } : i
                  )
                )
              }
              aria-label={item.done ? "Mark undone" : "Mark done"}
              className={[
                "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-colors",
                item.done
                  ? "border-indigo-500 bg-indigo-500 text-white"
                  : "border-neutral-300 bg-white hover:border-neutral-400",
              ].join(" ")}
            >
              {item.done && <Check size={12} strokeWidth={3} />}
            </button>

            <input
              ref={item.id === block.items[0]?.id ? firstRef : undefined}
              value={item.text}
              placeholder="To-do"
              onChange={(e) =>
                patch(
                  block.items.map((i) =>
                    i.id === item.id ? { ...i, text: e.target.value } : i
                  )
                )
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  patch([...block.items, newItem()]);
                }
              }}
              className={[
                "w-full bg-transparent text-[15px] outline-none placeholder:text-neutral-300",
                item.done
                  ? "text-neutral-400 line-through"
                  : "text-neutral-800",
              ].join(" ")}
            />
          </div>
        ))}

        <button
          type="button"
          onClick={() => patch([...block.items, newItem()])}
          className="mt-1 flex items-center gap-1.5 pl-[2px] text-xs text-neutral-400 transition-colors hover:text-neutral-600"
        >
          <Plus size={13} /> Add item
        </button>
      </div>
    </BlockShell>
  );
}
