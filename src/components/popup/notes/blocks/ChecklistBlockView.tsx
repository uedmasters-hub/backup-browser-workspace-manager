import { useEffect, useRef } from "react";
import { Check, Plus } from "lucide-react";

import BlockShell from "./BlockShell";
import { useCopy } from "../useCopy";
import { isBlockEmpty } from "../blockTypes";
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
  const transformBlock = useNotesStore((s) => s.transformBlock);
  const focusBlockId = useNotesStore((s) => s.focusBlockId);
  const consumeFocus = useNotesStore((s) => s.consumeFocus);
  const [copied, copy] = useCopy();

  const firstRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  /** Item to focus once it has rendered (after Enter / Backspace). */
  const focusItem = useRef<{ id: string; at: "start" | "end" } | null>(null);
  useEffect(() => {
    const target = focusItem.current;
    if (!target) return;
    focusItem.current = null;
    const input = listRef.current?.querySelector<HTMLInputElement>(`[data-item="${CSS.escape(target.id)}"]`);
    if (!input) return;
    input.focus();
    const n = target.at === "start" ? 0 : input.value.length;
    input.setSelectionRange(n, n);
  });
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
    <BlockShell
      id={block.id}
      onCopy={() => copy(asText())}
      copied={copied}
      empty={isBlockEmpty(block)}
    >
      <div ref={listRef} className="space-y-0.5 px-2 py-1">
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
              data-item={item.id}
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
                // Enter: a new item right below, ready to type in.
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  const created = newItem();
                  const at = block.items.findIndex((i) => i.id === item.id);
                  const items = [...block.items];
                  items.splice(at + 1, 0, created);
                  focusItem.current = { id: created.id, at: "start" };
                  patch(items);
                }
                // Backspace on an empty item removes it; on the last one,
                // the checklist turns back into a plain line.
                if (e.key === "Backspace" && item.text === "") {
                  e.preventDefault();
                  if (block.items.length > 1) {
                    const at = block.items.findIndex((i) => i.id === item.id);
                    const prev = block.items[at - 1] ?? block.items[at + 1];
                    if (prev) focusItem.current = { id: prev.id, at: "end" };
                    patch(block.items.filter((i) => i.id !== item.id));
                  } else {
                    transformBlock(block.id, "text");
                  }
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
          onClick={() => {
            const created = newItem();
            focusItem.current = { id: created.id, at: "start" };
            patch([...block.items, created]);
          }}
          className="mt-1 flex items-center gap-1.5 pl-[2px] text-xs text-neutral-400 transition-colors hover:text-neutral-600"
        >
          <Plus size={13} /> Add item
        </button>
      </div>
    </BlockShell>
  );
}
