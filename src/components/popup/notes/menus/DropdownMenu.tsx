import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import Portal from "../../menus/Portal";

const EDGE = 8;

/**
 * The Notes dropdown: white card, soft shadow, rounded rows. Anchored under
 * the button that opened it (right edges aligned), flips up when there's no
 * room. Closes on outside click / Escape (focus returns to the trigger);
 * ↑ ↓ move between items.
 */
export default function DropdownMenu({
  anchor,
  onClose,
  label,
  width = 248,
  children,
}: {
  anchor: DOMRect;
  onClose: () => void;
  label: string;
  width?: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Place it now, and again whenever its height changes (e.g. an input appears).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const place = () => {
      const h = el.offsetHeight;
      const left = Math.min(Math.max(EDGE, anchor.right - width), window.innerWidth - width - EDGE);
      const below = anchor.bottom + 6;
      const top = below + h <= window.innerHeight - EDGE ? below : Math.max(EDGE, anchor.top - 6 - h);
      setPos((prev) => (prev && prev.top === top && prev.left === left ? prev : { top, left }));
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  }, [anchor, width]);

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const items = () =>
      Array.from(ref.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([disabled])') ?? []);

    const close = () => {
      onClose();
      trigger?.focus?.({ preventScroll: true });
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      if (!ref.current?.contains(document.activeElement)) return;
      const list = items();
      const i = list.indexOf(document.activeElement as HTMLElement);
      const next = e.key === "ArrowDown" ? (i + 1) % list.length : (i - 1 + list.length) % list.length;
      list[next]?.focus();
      e.preventDefault();
    };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  // Focus the first item once the menu is placed (hidden elements can't take focus).
  const placed = pos !== null;
  useEffect(() => {
    if (!placed) return;
    ref.current
      ?.querySelector<HTMLElement>('[role^="menuitem"]:not([disabled])')
      ?.focus({ preventScroll: true });
  }, [placed]);

  return (
    <Portal>
      <div
        ref={ref}
        role="menu"
        aria-label={label}
        style={{
          position: "fixed",
          top: pos?.top ?? anchor.bottom + 6,
          left: pos?.left ?? anchor.left,
          width,
          zIndex: 9999,
          visibility: pos ? "visible" : "hidden",
        }}
        className="rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-2xl"
      >
        {children}
      </div>
    </Portal>
  );
}

/** Small grey caption at the top of a menu ("Move to"). */
export function MenuCaption({ children }: { children: ReactNode }) {
  return <p className="px-2.5 pb-1 pt-1 text-[11px] font-medium text-neutral-400">{children}</p>;
}

export function MenuDivider() {
  return <div role="separator" className="mx-1 my-1 border-t border-neutral-100" />;
}

/** One row: icon tile · label · optional trailing mark (✓). */
export function MenuRow({
  icon,
  label,
  onSelect,
  trailing,
  tone = "default",
  role = "menuitem",
  checked,
}: {
  icon: ReactNode;
  label: ReactNode;
  onSelect: () => void;
  trailing?: ReactNode;
  tone?: "default" | "danger" | "warning";
  role?: "menuitem" | "menuitemradio";
  checked?: boolean;
}) {
  const tile = {
    default: "bg-neutral-100 text-neutral-500",
    warning: "bg-amber-50 text-amber-500",
    danger: "bg-red-50 text-red-500",
  }[tone];
  return (
    <button
      type="button"
      role={role}
      aria-checked={role === "menuitemradio" ? Boolean(checked) : undefined}
      onClick={onSelect}
      className={[
        "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm outline-none transition-colors",
        tone === "danger"
          ? "text-red-600 hover:bg-red-50 focus-visible:bg-red-50"
          : "text-neutral-800 hover:bg-neutral-100 focus-visible:bg-neutral-100",
      ].join(" ")}
    >
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tile}`}>{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
    </button>
  );
}
