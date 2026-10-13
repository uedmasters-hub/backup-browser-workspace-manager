import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AppWindow, EyeOff, Plus, VenetianMask } from "lucide-react";

import Portal from "../menus/Portal";
import AppIcon from "./AppIcon";
import { useWindowStore } from "../../../stores/windowStore";
import type { AppWindowMatch, DockApp } from "../../../browser/services/appDockRanking";

type Props = {
  app: DockApp;
  icon?: string;
  anchor: DOMRect;
  windows: AppWindowMatch[];
  /** "choose": opened by clicking an app that's open in several windows. */
  mode: "choose" | "options";
  onSwitch: (match: AppWindowMatch) => void;
  onNewTab: () => void;
  onNewWindow: () => void;
  onHide: () => void;
  onClose: () => void;
};

const WIDTH = 272;
const EDGE = 8;

/** Options for one dock app: switch to one of its windows, open fresh, or hide. */
export default function AppMenu({
  app,
  icon,
  anchor,
  windows,
  mode,
  onSwitch,
  onNewTab,
  onNewWindow,
  onHide,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const workspaces = useWindowStore((s) => s.windows);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.min(Math.max(EDGE, anchor.left + anchor.width / 2 - WIDTH / 2), vw - WIDTH - EDGE);
    const below = anchor.bottom + 6;
    const top = below + h <= vh - EDGE ? below : Math.max(EDGE, anchor.top - 6 - h);
    setPos({ top, left });
  }, [anchor, windows.length]);

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
      const i = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
      items[next]?.focus();
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

  const item =
    "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm text-neutral-800 outline-none transition-colors hover:bg-neutral-100 focus-visible:bg-neutral-100";

  return (
    <Portal>
      <div
        ref={ref}
        role="menu"
        aria-label={`${app.name} options`}
        style={{
          position: "fixed",
          top: pos?.top ?? anchor.bottom + 6,
          left: pos?.left ?? anchor.left,
          width: WIDTH,
          zIndex: 9999,
          visibility: pos ? "visible" : "hidden",
        }}
        className="rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-2xl"
      >
        <div className="flex items-center gap-2.5 px-2.5 pb-2 pt-1.5">
          <AppIcon name={app.name} url={app.url} icon={icon} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-neutral-900">{app.name}</p>
            <p className="truncate text-[11px] text-neutral-400">
              {mode === "choose"
                ? `Open in ${windows.length} windows — pick one`
                : app.key}
            </p>
          </div>
        </div>

        {windows.length > 0 && (
          <div className="border-t border-neutral-100 pt-1">
            {windows.map((w) => {
              const ws = workspaces.find((x) => x.chromeWindowId === w.windowId);
              return (
                <button
                  key={w.windowId}
                  type="button"
                  role="menuitem"
                  onClick={() => onSwitch(w)}
                  className={item}
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10"
                    style={{ backgroundColor: ws?.color ?? "#E5E7EB" }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 font-medium">
                      {w.incognito && <VenetianMask size={13} className="shrink-0" />}
                      <span className="truncate">{ws?.name ?? "Window"}</span>
                      {w.tabCount > 1 && (
                        <span className="shrink-0 text-[11px] font-normal text-neutral-400">
                          · {w.tabCount} tabs
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-[11px] text-neutral-400">{w.title}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className={windows.length > 0 ? "mt-1 border-t border-neutral-100 pt-1" : "border-t border-neutral-100 pt-1"}>
          <button type="button" role="menuitem" onClick={onNewTab} className={item}>
            <Plus size={16} className="shrink-0 text-neutral-500" /> Open in new tab
          </button>
          <button type="button" role="menuitem" onClick={onNewWindow} className={item}>
            <AppWindow size={16} className="shrink-0 text-neutral-500" /> Open in new window
          </button>
        </div>

        {mode === "options" && (
          <div className="mt-1 border-t border-neutral-100 pt-1">
            <button type="button" role="menuitem" onClick={onHide} className={item}>
              <EyeOff size={16} className="shrink-0 text-neutral-500" /> Hide from dock
            </button>
          </div>
        )}
      </div>
    </Portal>
  );
}
