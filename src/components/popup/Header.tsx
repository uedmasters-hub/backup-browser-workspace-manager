import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  Check,
  Download,
  Menu,
  RefreshCw,
  PictureInPicture2,
  Search,
  StickyNote,
  Upload,
  X,
} from "lucide-react";

import { useUIStore } from "../../stores/uiStore";
import { useWindowStore } from "../../stores/windowStore";
import { useTabStore } from "../../stores/tabStore";
import { STORAGE_KEYS } from "../../constants/storageKeys";

import { useSearchStore } from "../../stores/searchStore";
import {
  exportBackup,
  importBackup,
} from "../../browser/backup/backupService";
import {
  FOCUS_SEARCH_REQUEST_KEY,
  isFocusSearchMessage,
  OPEN_NOTES_REQUEST_KEY,
  isOpenNotesMessage,
} from "../../browser/commands";

const IS_MAC =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.userAgent);

function syncAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

async function injectFloaterIntoOpenTabs(): Promise<void> {
  try {
    const file = chrome.runtime.getManifest().content_scripts?.[0]?.js?.[0];
    if (!file || !chrome.scripting?.executeScript) {
      return;
    }
    const tabs = await chrome.tabs.query({});
    await Promise.all(
      tabs.map(async (tab) => {
        if (tab.id == null) {
          return;
        }
        const url = tab.url ?? "";
        if (!/^https?:|^file:/.test(url)) {
          return;
        }
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: [file],
          });
        } catch {
          // Restricted/blocked page — skip.
        }
      })
    );
  } catch {
    // Best effort.
  }
}

export default function Header() {
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchShortcut = IS_MAC ? "⇧⌘K" : "Ctrl ⇧ K";
  const notesShortcut = IS_MAC ? "⌘J" : "Ctrl J";

  const query = useSearchStore((state) => state.query);
  const setQuery = useSearchStore((state) => state.setQuery);
  const search = useSearchStore((state) => state.search);
  const discover = useSearchStore((state) => state.discover);
  const clear = useSearchStore((state) => state.clear);
  const deepMode = useSearchStore((state) => state.deepMode);
  const focused = useSearchStore((state) => state.focused);
  const setFocused = useSearchStore((state) => state.setFocused);
  const moveActive = useSearchStore((state) => state.moveActive);
  const runActive = useSearchStore((state) => state.runActive);

  const notesOpen = useUIStore((state) => state.notesOpen);
  const toggleNotes = useUIStore((state) => state.toggleNotes);
  const openNotes = useUIStore((state) => state.openNotes);

  const refreshWindows = useWindowStore((state) => state.refreshWindows);
  const reloadTabs = useTabStore((state) => state.reloadTabs);

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [syncing, setSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  const [lastSynced, setLastSynced] = useState<number>();
  const [exporting, setExporting] = useState(false);
  const [busy, setBusy] = useState<null | "exported" | "importing">(null);
  const [floaterOn, setFloaterOn] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const showSearch = query.trim().length > 0 || focused;

  function openMenu() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuPos({
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    }
    setImportError(null);
    setMenuOpen(true);
  }

  useEffect(() => {
    void chrome.storage?.local
      ?.get(STORAGE_KEYS.LAST_SYNCED)
      .then((result) => {
        const value = result[STORAGE_KEYS.LAST_SYNCED];
        if (typeof value === "number") {
          setLastSynced(value);
        }
      });
  }, []);

  async function syncNow() {
    if (syncing) {
      return;
    }
    setSyncing(true);
    try {
      await refreshWindows();
      await reloadTabs();
      const now = Date.now();
      setLastSynced(now);
      void chrome.storage?.local?.set({
        [STORAGE_KEYS.LAST_SYNCED]: now,
      });
      setJustSynced(true);
      setTimeout(() => setJustSynced(false), 1300);
    } finally {
      setSyncing(false);
    }
  }

  async function handleExport() {
    if (exporting) {
      return;
    }
    setExporting(true);
    setImportError(null);
    try {
      await exportBackup();
      setBusy("exported");
      setTimeout(() => setBusy(null), 1500);
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "Export failed."
      );
    } finally {
      setExporting(false);
    }
  }

  async function handleImportFile(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setImportError(null);
    setBusy("importing");
    try {
      await importBackup(file);
      window.location.reload();
    } catch (error) {
      setBusy(null);
      setImportError(
        error instanceof Error ? error.message : "Import failed."
      );
    }
  }

  const syncLabel = syncing
    ? "Syncing…"
    : lastSynced
      ? `Last synced ${syncAgo(lastSynced)}`
      : "Never synced";

  // Close the menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    function onDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        menuPanelRef.current?.contains(target)
      ) {
        return;
      }
      setMenuOpen(false);
    }
    function onEsc(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [menuOpen]);

  // Floating-note toggle: reflect + persist the enabled flag.
  useEffect(() => {
    let active = true;
    void chrome.storage?.local
      .get(STORAGE_KEYS.FLOATER_ENABLED)
      .then((r) => {
        if (active) {
          setFloaterOn(Boolean(r[STORAGE_KEYS.FLOATER_ENABLED]));
        }
      });
    const onChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area === "local" && STORAGE_KEYS.FLOATER_ENABLED in changes) {
        setFloaterOn(Boolean(changes[STORAGE_KEYS.FLOATER_ENABLED].newValue));
      }
    };
    chrome.storage?.onChanged.addListener(onChange);
    return () => {
      active = false;
      chrome.storage?.onChanged.removeListener(onChange);
    };
  }, []);

  async function toggleFloater() {
    const next = !floaterOn;
    setFloaterOn(next);
    if (!next) {
      await chrome.storage.local.set({
        [STORAGE_KEYS.FLOATER_ENABLED]: false,
      });
      return;
    }
    // Ensure at least one note exists (seeded here so multiple open tabs don't
    // each create their own). Position 1e6 clamps to the page's bottom-right.
    const existing = await chrome.storage.local.get(STORAGE_KEYS.FLOATER_NOTES);
    const list = Array.isArray(existing[STORAGE_KEYS.FLOATER_NOTES])
      ? (existing[STORAGE_KEYS.FLOATER_NOTES] as unknown[])
      : [];
    const seeded =
      list.length > 0
        ? list
        : [{ id: crypto.randomUUID(), text: "", left: 1e6, top: 1e6 }];
    await chrome.storage.local.set({
      [STORAGE_KEYS.FLOATER_NOTES]: seeded,
      [STORAGE_KEYS.FLOATER_ENABLED]: true,
    });
    // Tabs open before this toggle have no content script yet — inject now.
    await injectFloaterIntoOpenTabs();
  }

  // Chrome-level "open-notes" command: opens the popup straight into Notes.
  useEffect(() => {
    function onMessage(message: unknown) {
      if (isOpenNotesMessage(message)) {
        openNotes();
      }
    }
    chrome.runtime.onMessage.addListener(onMessage);

    void chrome.storage.session
      .get(OPEN_NOTES_REQUEST_KEY)
      .then((result) => {
        if (result[OPEN_NOTES_REQUEST_KEY]) {
          void chrome.storage.session.remove(OPEN_NOTES_REQUEST_KEY);
          openNotes();
        }
      });

    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, [openNotes]);

  // In-popup Notes hotkey: Cmd/Ctrl + J.
  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      if (
        event.key.toLowerCase() === "j" &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        toggleNotes();
        setMenuOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleNotes]);

  useEffect(() => {
    function focusSearchInput() {
      inputRef.current?.focus({ preventScroll: true });
      inputRef.current?.select();
    }

    function focusSearch(event: globalThis.KeyboardEvent) {
      const target = event.target;
      const isTyping =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      const commandK =
        event.key.toLowerCase() === "k" &&
        (event.metaKey || event.ctrlKey);
      const slash = event.key === "/" && !isTyping;

      if (!commandK && !slash) {
        return;
      }

      event.preventDefault();
      focusSearchInput();
    }

    function handleCommand(message: unknown) {
      if (isFocusSearchMessage(message)) {
        focusSearchInput();
      }
    }

    async function focusPendingSearch() {
      const result = await chrome.storage.session.get(
        FOCUS_SEARCH_REQUEST_KEY
      );
      if (!result[FOCUS_SEARCH_REQUEST_KEY]) {
        return;
      }
      await chrome.storage.session.remove(FOCUS_SEARCH_REQUEST_KEY);
      focusSearchInput();
    }

    window.addEventListener("keydown", focusSearch);
    chrome.runtime.onMessage.addListener(handleCommand);
    void focusPendingSearch();

    return () => {
      window.removeEventListener("keydown", focusSearch);
      chrome.runtime.onMessage.removeListener(handleCommand);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        search(query);
      } else if (focused) {
        discover();
      }
    }, 160);
    return () => clearTimeout(timer);
  }, [query, focused, search, discover]);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveActive(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveActive(-1);
        break;
      case "Enter":
        event.preventDefault();
        runActive();
        break;
      case "Escape":
        event.preventDefault();
        clear();
        event.currentTarget.blur();
        break;
    }
  }

  const menu = (
    <div
      ref={menuPanelRef}
      role="menu"
      style={{
        position: "fixed",
        top: menuPos.top,
        right: menuPos.right,
        zIndex: 9999,
      }}
      className="w-60 rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-2xl"
    >
      <button
        type="button"
        onClick={() => void syncNow()}
        disabled={syncing}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-neutral-100 disabled:cursor-default"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100">
          {justSynced ? (
            <Check size={17} className="text-emerald-500" />
          ) : (
            <RefreshCw
              size={16}
              className={syncing ? "animate-spin text-neutral-400" : ""}
            />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-neutral-800">
            Sync now
          </span>
          <span className="block truncate text-[11px] text-neutral-400">
            {syncLabel}
          </span>
        </span>
      </button>

      <button
        type="button"
        onClick={() => {
          toggleNotes();
          setMenuOpen(false);
        }}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-neutral-100"
      >
        <span
          className={[
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            notesOpen
              ? "bg-blue-50 text-blue-600"
              : "bg-neutral-100 text-neutral-700",
          ].join(" ")}
        >
          <StickyNote size={17} />
        </span>
        <span className="flex-1 text-sm font-medium text-neutral-800">
          Notes
        </span>
        <kbd className="rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-sans text-[10px] font-medium text-neutral-400">
          {notesShortcut}
        </kbd>
      </button>

      <button
        type="button"
        onClick={() => void toggleFloater()}
        role="menuitemcheckbox"
        aria-checked={floaterOn}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-neutral-100"
      >
        <span
          className={[
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            floaterOn
              ? "bg-amber-50 text-amber-600"
              : "bg-neutral-100 text-neutral-700",
          ].join(" ")}
        >
          <PictureInPicture2 size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-neutral-800">
            Floating note
          </span>
          <span className="block truncate text-[11px] text-neutral-400">
            A draggable quick note on the page
          </span>
        </span>
        <span
          aria-hidden
          className={[
            "relative h-[18px] w-8 shrink-0 rounded-full transition-colors",
            floaterOn ? "bg-amber-500" : "bg-neutral-200",
          ].join(" ")}
        >
          <span
            className={[
              "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-all",
              floaterOn ? "left-[15px]" : "left-0.5",
            ].join(" ")}
          />
        </span>
      </button>

      <div className="my-1.5 border-t border-neutral-100" />

      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={exporting || busy === "importing"}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-neutral-100 disabled:opacity-60"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
          {busy === "exported" ? (
            <Check size={17} className="text-emerald-500" />
          ) : (
            <Download size={17} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-neutral-800">
            {exporting ? "Exporting…" : "Export backup"}
          </span>
          <span className="block truncate text-[11px] text-neutral-400">
            ZIP with tabs, notes &amp; settings + tabs.html
          </span>
        </span>
      </button>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={busy === "importing"}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-neutral-100 disabled:opacity-60"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
          <Upload size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-neutral-800">
            {busy === "importing" ? "Importing…" : "Import backup"}
          </span>
          <span className="block truncate text-[11px] text-neutral-400">
            Restore from a .zip or backup.json
          </span>
        </span>
      </button>

      {importError && (
        <p className="px-3 pb-1 pt-1.5 text-[11px] text-red-500">
          {importError}
        </p>
      )}
    </div>
  );

  return (
    <header className="z-10 shrink-0 bg-white">
      {!notesOpen && (
        <div className="flex items-center gap-3 p-5">
        <div
          className={[
            "flex h-12 flex-1 items-center rounded-2xl border bg-white px-4 shadow-sm transition-colors",
            deepMode
              ? "border-violet-400 ring-1 ring-violet-200"
              : focused
                ? "border-neutral-400"
                : "border-gray-200",
          ].join(" ")}
        >
          <Search size={18} className="mr-3 shrink-0 text-gray-400" />

          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              setFocused(true);
              setMenuOpen(false);
            }}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="Search tabs and workspaces..."
            aria-keyshortcuts="Meta+Shift+K Control+Shift+K Meta+K Control+K /"
            className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
          />

          {query ? (
            <button
              type="button"
              onClick={clear}
              aria-label="Clear search"
              className="ml-2 shrink-0 text-gray-400 transition-colors hover:text-gray-700"
            >
              <X size={16} />
            </button>
          ) : !focused ? (
            <kbd className="ml-2 shrink-0 rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-sans text-[10px] font-medium text-neutral-400">
              {searchShortcut}
            </kbd>
          ) : null}
        </div>

        {!showSearch && (
          <button
            ref={buttonRef}
            type="button"
            aria-label="Menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}
            className={[
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-colors",
              menuOpen || notesOpen
                ? "border-neutral-300 bg-neutral-100 text-neutral-900"
                : "border-transparent text-neutral-700 hover:bg-gray-100",
            ].join(" ")}
          >
            <Menu size={20} />
          </button>
        )}
      </div>
      )}

      {menuOpen && !showSearch && !notesOpen && createPortal(menu, document.body)}

      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,.json,application/zip,application/json"
        className="hidden"
        onChange={(event) => void handleImportFile(event)}
      />
    </header>
  );
}
