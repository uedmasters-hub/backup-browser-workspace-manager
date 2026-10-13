import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

import AppIcon from "./AppIcon";
import AppMenu from "./AppMenu";
import { APP_DOCK } from "../../../constants/appDock";
import { useAppDockStore } from "../../../stores/appDockStore";
import { useWindowStore } from "../../../stores/windowStore";
import {
  iconFromTabs,
  windowsForApp,
  type DockApp,
} from "../../../browser/services/appDockRanking";
import {
  openAppInNewTab,
  openAppInNewWindow,
  switchToTab,
} from "../../../browser/services/appDockService";

type MenuState = { app: DockApp; anchor: DOMRect; mode: "choose" | "options" } | null;

const TILE = 52;
const MIN_GAP = 10;
/** Pointer travel before a mouse press becomes a drag-scroll (not a click). */
const DRAG_THRESHOLD = 6;

/**
 * Horizontally scrolling row of your most-visited apps (icons only).
 * Click: not open → new window; open in one window → go there; open in
 * several → pick a window. Right-click or ⋯: new tab / new window / hide.
 *
 * Layout: the row is inset to the cards' width and the gap is computed so a
 * whole number of tiles fits exactly — nothing is half-cut at rest.
 * Scrolling: trackpad swipe, mouse wheel (vertical wheel scrolls sideways
 * while over the row) and click-and-drag.
 */
export default function AppDock() {
  const enabled = useAppDockStore((s) => s.enabled);
  const loaded = useAppDockStore((s) => s.loaded);
  const apps = useAppDockStore((s) => s.apps);
  const openTabs = useAppDockStore((s) => s.openTabs);
  const icons = useAppDockStore((s) => s.icons);
  const hiResIcons = useAppDockStore((s) => s.hiResIcons);
  const load = useAppDockStore((s) => s.load);
  const refreshOpen = useAppDockStore((s) => s.refreshOpen);
  const hide = useAppDockStore((s) => s.hide);
  const windows = useWindowStore((s) => s.windows);

  const scroller = useRef<HTMLDivElement>(null);
  const [gap, setGap] = useState(MIN_GAP);
  const [menu, setMenu] = useState<MenuState>(null);

  useEffect(() => {
    void load();
  }, [load]);

  // Window/tab changes refresh the window list — keep open-state dots live too.
  useEffect(() => {
    const t = window.setTimeout(() => void refreshOpen(), 150);
    return () => window.clearTimeout(t);
  }, [windows, refreshOpen]);

  const count = loaded ? apps.length : 6;

  // Fit a whole number of tiles in the visible width with equal gaps.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const fit = () => {
      const width = el.clientWidth;
      const perRow = Math.max(1, Math.floor((width + MIN_GAP) / (TILE + MIN_GAP)));
      setGap(
        count > perRow && perRow > 1
          ? (width - perRow * TILE) / (perRow - 1)
          : MIN_GAP
      );
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [count, enabled]);

  // Always start at the first app, fully visible.
  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = 0;
  }, [loaded]);

  // Mouse wheel: vertical wheel scrolls the row sideways while over it —
  // unless the page itself is mid-scroll, or the row is already at that end.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let pageScrolledAt = 0;
    const onPageScroll = (e: Event) => {
      if (e.target !== el) pageScrolledAt = Date.now();
    };
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // trackpad swipe: native
      if (Date.now() - pageScrolledAt < 250) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      if ((e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max - 1)) return;
      e.preventDefault();
      el.scrollLeft = Math.max(0, Math.min(max, el.scrollLeft + e.deltaY));
    };
    window.addEventListener("scroll", onPageScroll, true);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("scroll", onPageScroll, true);
      el.removeEventListener("wheel", onWheel);
    };
  }, [loaded, enabled]);

  // Click-and-drag with a mouse; a drag never triggers the icon's click.
  const drag = useRef<{ x: number; left: number; id: number; active: boolean } | null>(null);
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || !scroller.current) return;
    drag.current = { x: e.clientX, left: scroller.current.scrollLeft, id: e.pointerId, active: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = scroller.current;
    if (!d || !el) return;
    const dx = e.clientX - d.x;
    if (!d.active && Math.abs(dx) > DRAG_THRESHOLD) {
      d.active = true;
      el.setPointerCapture(d.id); // the release then lands on the row, not the icon
    }
    if (d.active) el.scrollLeft = d.left - dx;
  };
  const endDrag = () => {
    drag.current = null;
  };

  const closeMenu = useCallback(() => setMenu(null), []);

  if (!enabled) return null;
  if (loaded && apps.length === 0) return null;

  function primary(app: DockApp, el: HTMLElement) {
    const matches = windowsForApp(app.key, openTabs);
    if (matches.length === 0) {
      void openAppInNewWindow(app.url);
    } else if (matches.length < APP_DOCK.chooserMinWindows) {
      void switchToTab(matches[0].tabId, matches[0].windowId);
    } else {
      setMenu({ app, anchor: el.getBoundingClientRect(), mode: "choose" });
    }
  }

  const iconOf = (key: string) => iconFromTabs(key, openTabs) ?? icons[key];

  return (
    <div className="mt-3" role="toolbar" aria-label="Most-visited apps">
      <div
        ref={scroller}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ gap }}
        className="mx-5 flex overflow-x-auto overscroll-x-contain py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {!loaded
          ? Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="bwm-skeleton h-[52px] w-[52px] shrink-0 rounded-2xl" />
            ))
          : apps.map((app) => {
              const matches = windowsForApp(app.key, openTabs);
              const open = matches.length > 0;
              const label = open
                ? `${app.name} — open in ${matches.length} window${matches.length > 1 ? "s" : ""}`
                : app.name;
              const openOptions = (target: HTMLElement) =>
                setMenu({ app, anchor: target.getBoundingClientRect(), mode: "options" });

              return (
                <div key={app.key} className="group/app relative h-[52px] w-[52px] shrink-0">
                  <button
                    type="button"
                    aria-label={label}
                    title={`${label}\nRight-click for more options`}
                    aria-haspopup={matches.length >= APP_DOCK.chooserMinWindows ? "menu" : undefined}
                    onClick={(e) => primary(app, e.currentTarget)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      openOptions(e.currentTarget);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
                        e.preventDefault();
                        openOptions(e.currentTarget);
                      }
                    }}
                    className="flex h-full w-full items-center justify-center rounded-2xl bg-[#E3EFED] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-900"
                  >
                    {/* Hover: the icon grows a touch; press: it settles back. */}
                    <span className="flex items-center justify-center transition-transform duration-150 ease-out group-hover/app:scale-[1.14] group-active/app:scale-95 motion-reduce:transition-none">
                      <AppIcon
                        name={app.name}
                        url={app.url}
                        icon={iconOf(app.key)}
                        hiRes={hiResIcons[app.key]}
                      />
                    </span>
                  </button>

                  {open && (
                    <span aria-hidden="true" className="pointer-events-none absolute bottom-[5px] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-neutral-800" />
                  )}

                  {matches.length > 1 && (
                    <span aria-hidden="true" className="pointer-events-none absolute right-1 top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-neutral-900 px-1 text-[9.5px] font-semibold leading-none text-white">
                      {matches.length}
                    </span>
                  )}

                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={`${app.name} options`}
                    onClick={(e) => openOptions(e.currentTarget.parentElement!)}
                    className="absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white/95 text-neutral-600 opacity-0 transition-opacity hover:text-neutral-900 group-hover/app:opacity-100"
                  >
                    <MoreHorizontal size={11} />
                  </button>
                </div>
              );
            })}
      </div>

      {menu && (
        <AppMenu
          app={menu.app}
          icon={iconOf(menu.app.key)}
          hiRes={hiResIcons[menu.app.key]}
          anchor={menu.anchor}
          mode={menu.mode}
          windows={windowsForApp(menu.app.key, openTabs)}
          onClose={closeMenu}
          onSwitch={(m) => {
            closeMenu();
            void switchToTab(m.tabId, m.windowId);
          }}
          onNewTab={() => {
            closeMenu();
            void openAppInNewTab(menu.app.url);
          }}
          onNewWindow={() => {
            closeMenu();
            void openAppInNewWindow(menu.app.url);
          }}
          onHide={() => {
            closeMenu();
            void hide(menu.app.key);
          }}
        />
      )}
    </div>
  );
}
