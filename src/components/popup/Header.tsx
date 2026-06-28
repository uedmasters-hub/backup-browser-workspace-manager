import { useEffect, useRef } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Menu, Search, X } from "lucide-react";

import { useSearchStore } from "../../stores/searchStore";
import {
  FOCUS_SEARCH_REQUEST_KEY,
  isFocusSearchMessage,
} from "../../browser/commands";

export default function Header() {
  const inputRef = useRef<HTMLInputElement>(null);
  const searchShortcut =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.userAgent)
      ? "⇧⌘K"
      : "Ctrl ⇧ K";

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

  useEffect(() => {
    function focusSearchInput() {
      inputRef.current?.focus({
        preventScroll: true,
      });
      inputRef.current?.select();
    }

    function focusSearch(event: globalThis.KeyboardEvent) {
      const target = event.target;
      const isTyping =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(
            target.tagName
          ));
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

      await chrome.storage.session.remove(
        FOCUS_SEARCH_REQUEST_KEY
      );

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

  // Debounced engine call. Typing searches; an empty box (while focused)
  // shows discovery.
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

  function handleKeyDown(
    event: ReactKeyboardEvent<HTMLInputElement>
  ) {
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

  return (
    <header className="z-10 shrink-0 bg-white">
      <div className="flex items-center gap-3 p-5">
        <div
          className={[
            "flex flex-1 items-center rounded-2xl border bg-white px-4 py-3 shadow-sm transition-colors",
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
            onFocus={() => setFocused(true)}
            // Delay so a click on a result row still registers before the
            // overlay is torn down.
            onBlur={() =>
              setTimeout(() => setFocused(false), 150)
            }
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

        <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-gray-100">
          <Menu size={20} />
        </button>
      </div>
    </header>
  );
}
