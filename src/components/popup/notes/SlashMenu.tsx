import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { filterBlockTypes } from "./blockTypes";
import type { SlashType } from "./blockTypes";

type Props = {
  query: string;
  activeIndex: number;
  anchor: DOMRect | null;
  onPick: (type: SlashType) => void;
  onHover: (index: number) => void;
};

const MAX_HEIGHT = 240;
const WIDTH = 236;

export default function SlashMenu({
  query,
  activeIndex,
  anchor,
  onPick,
  onHover,
}: Props) {
  const items = filterBlockTypes(query);
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the highlighted item visible while moving with ↑ ↓.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, query]);

  if (items.length === 0 || !anchor) {
    return null;
  }

  // Flip above the line when there isn't room below (popup is short).
  const openUp = anchor.bottom + MAX_HEIGHT + 8 > window.innerHeight;
  const top = openUp
    ? Math.max(8, anchor.top - MAX_HEIGHT - 6)
    : anchor.bottom + 6;
  const left = Math.max(
    8,
    Math.min(anchor.left, window.innerWidth - WIDTH - 8)
  );

  return createPortal(
    <div
      ref={listRef}
      style={{
        position: "fixed",
        top,
        left,
        width: WIDTH,
        maxHeight: MAX_HEIGHT,
      }}
      className="z-50 overflow-y-auto overscroll-contain rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-xl"
    >
      <div className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
        Blocks
      </div>
      {items.map((item, index) => {
        const Icon = item.Icon;
        const active = index === activeIndex;
        return (
          <button
            key={item.type}
            type="button"
            data-index={index}
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(item.type);
            }}
            onMouseEnter={() => onHover(index)}
            className={[
              "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors",
              active ? "bg-neutral-100" : "hover:bg-neutral-50",
            ].join(" ")}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
              <Icon size={14} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-neutral-800">
                {item.label}
              </span>
              <span className="block text-xs text-neutral-400">
                {item.hint}
              </span>
            </span>
          </button>
        );
      })}
    </div>,
    document.body
  );
}
