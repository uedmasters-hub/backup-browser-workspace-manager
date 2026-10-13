import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

import AppIcon from "./AppIcon";
import AppMenu from "./AppMenu";
import { APP_DOCK } from "../../../constants/appDock";
import { useAppDockStore } from "../../../stores/appDockStore";
import { useWindowStore } from "../../../stores/windowStore";
import {
  iconFromTabs,
  windowsForApp,
  type DockApp,
  type AppWindowMatch,
} from "../../../browser/services/appDockRanking";
import {
  openAppInNewTab,
  openAppInNewWindow,
  switchToTab,
} from "../../../browser/services/appDockService";

type MenuState = { app: DockApp; anchor: DOMRect; mode: "choose" | "options" } | null;

/**
 * Horizontally scrolling row of your most-visited apps (icons only).
 * Click: not open → new window; open in one window → go there; open in
 * several → pick a window. Right-click or ⋯: new tab / new window / hide.
 */
export default function AppDock() {
  const enabled = useAppDockStore((s) => s.enabled);
  const loaded = useAppDockStore((s) => s.loaded);
  const apps = useAppDockStore((s) => s.apps);
  const openTabs = useAppDockStore((s) => s.openTabs);
  const icons = useAppDockStore((s) => s.icons);
  const load = useAppDockStore((s) => s.load);
  const refreshOpen = useAppDockStore((s) => s.refreshOpen);
  const hide = useAppDockStore((s) => s.hide);
  const windows = useWindowStore((s) => s.windows);

  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const [menu, setMenu] = useState<MenuState>(null);

  useEffect(() => {
    void load();
  }, [load]);

  // Window/tab changes refresh the window list — keep open-state dots live too.
  useEffect(() => {
    const t = window.setTimeout(() => void refreshOpen(), 150);
    return () => window.clearTimeout(t);
  }, [windows, refreshOpen]);

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdges({
      left: el.scrollLeft > 2,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
    });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, apps.length, loaded]);

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

  function scrollBy(dir: 1 | -1) {
    const el = scroller.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  }

  const arrow =
    "absolute top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 opacity-0 shadow-sm transition-opacity group-hover/dock:opacity-100 focus-visible:opacity-100 hover:text-neutral-900";

  return (
    <div className="group/dock relative mt-3" role="toolbar" aria-label="Most-visited apps">
      {edges.left && (
        <>
          <div className="pointer-events-none absolute inset-y-0 left-0 z-[5] w-8 bg-gradient-to-r from-[#F6F7FB] to-transparent" />
          <button type="button" aria-label="Scroll apps left" onClick={() => scrollBy(-1)} className={`${arrow} left-2`}>
            <ChevronLeft size={16} />
          </button>
        </>
      )}
      {edges.right && (
        <>
          <div className="pointer-events-none absolute inset-y-0 right-0 z-[5] w-8 bg-gradient-to-l from-[#F6F7FB] to-transparent" />
          <button type="button" aria-label="Scroll apps right" onClick={() => scrollBy(1)} className={`${arrow} right-2`}>
            <ChevronRight size={16} />
          </button>
        </>
      )}

      <div
        ref={scroller}
        onScroll={measure}
        className="flex snap-x gap-2.5 overflow-x-auto scroll-smooth px-5 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {!loaded
          ? Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="bwm-skeleton h-[52px] w-[52px] shrink-0 rounded-2xl" />
            ))
          : apps.map((app) => {
              const matches: AppWindowMatch[] = windowsForApp(app.key, openTabs);
              const open = matches.length > 0;
              const icon = iconFromTabs(app.key, openTabs) ?? icons[app.key];
              const label = open
                ? `${app.name} — open in ${matches.length} window${matches.length > 1 ? "s" : ""}`
                : app.name;
              return (
                <div key={app.key} className="group/app relative shrink-0 snap-start">
                  <button
                    type="button"
                    aria-label={label}
                    title={`${label}\nRight-click for more options`}
                    aria-haspopup={matches.length >= APP_DOCK.chooserMinWindows ? "menu" : undefined}
                    onClick={(e) => primary(app, e.currentTarget)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setMenu({ app, anchor: e.currentTarget.getBoundingClientRect(), mode: "options" });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
                        e.preventDefault();
                        setMenu({ app, anchor: e.currentTarget.getBoundingClientRect(), mode: "options" });
                      }
                    }}
                    className="relative flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-[#E3EFED] outline-none transition duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-neutral-900 active:translate-y-0 active:scale-95"
                  >
                    <AppIcon name={app.name} url={app.url} icon={icon} />
                    {open && (
                      <span aria-hidden="true" className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-neutral-800" />
                    )}
                  </button>

                  {matches.length > 1 && (
                    <span aria-hidden="true" className="pointer-events-none absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-neutral-900 px-1 text-[10px] font-semibold text-white ring-2 ring-[#F6F7FB]">
                      {matches.length}
                    </span>
                  )}

                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={`${app.name} options`}
                    onClick={(e) =>
                      setMenu({
                        app,
                        anchor: e.currentTarget.parentElement!.getBoundingClientRect(),
                        mode: "options",
                      })
                    }
                    className="absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 opacity-0 shadow-sm transition-opacity group-hover/app:opacity-100 hover:text-neutral-900"
                  >
                    <MoreHorizontal size={12} />
                  </button>
                </div>
              );
            })}
      </div>

      {menu && (
        <AppMenu
          app={menu.app}
          icon={iconFromTabs(menu.app.key, openTabs) ?? icons[menu.app.key]}
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
