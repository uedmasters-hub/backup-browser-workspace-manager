import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

/**
 * Title by default with a search icon on the right. Clicking the icon (or
 * pressing "/") grows it leftwards into a search field over the title.
 * × clears the query and folds it back; Escape clears first, then folds;
 * leaving an empty field folds it too.
 */
export default function NotesSearch({
  title,
  query,
  onQuery,
  placeholder,
  openRef,
}: {
  title: string;
  query: string;
  onQuery: (q: string) => void;
  placeholder: string;
  /** Lets the parent fold the search (e.g. before creating a project). */
  openRef?: React.MutableRefObject<((open: boolean) => void) | null>;
}) {
  const [open, setOpen] = useState(() => query !== "");
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const expand = () => {
    setOpen(true);
    requestAnimationFrame(() => input.current?.focus({ preventScroll: true }));
  };
  const collapse = () => {
    onQuery("");
    setOpen(false);
  };

  useEffect(() => {
    if (!openRef) return;
    openRef.current = (next) => (next ? expand() : collapse());
    return () => {
      openRef.current = null;
    };
  });

  // "/" anywhere in the list opens search (not while typing somewhere).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => input.current?.focus({ preventScroll: true }));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative h-10 min-w-0 flex-1">
      <h2
        aria-hidden={open}
        className={[
          "pointer-events-none absolute inset-y-0 left-0 flex items-center truncate px-1.5 text-base font-semibold text-neutral-900 transition-opacity duration-150 motion-reduce:transition-none",
          open ? "opacity-0" : "opacity-100",
        ].join(" ")}
      >
        {title}
      </h2>

      <div
        ref={box}
        role="search"
        className={[
          "absolute inset-y-0 right-0 flex items-center overflow-hidden rounded-xl border transition-[width,background-color,border-color,box-shadow] duration-200 ease-out motion-reduce:transition-none",
          open
            ? "w-full border-neutral-200 bg-white shadow-sm"
            : "w-10 border-transparent text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800",
        ].join(" ")}
      >
        <button
          type="button"
          tabIndex={open ? -1 : 0}
          onClick={open ? () => input.current?.focus() : expand}
          aria-label="Search notes and projects"
          title={open ? undefined : "Search  /"}
          aria-expanded={open}
          className={[
            "flex h-full w-[38px] shrink-0 items-center justify-center",
            open ? "cursor-text text-neutral-400" : "",
          ].join(" ")}
        >
          <Search size={17} />
        </button>
        <input
          ref={input}
          value={query}
          tabIndex={open ? 0 : -1}
          aria-hidden={!open}
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Escape") return;
            e.preventDefault();
            e.stopPropagation();
            if (query) onQuery("");
            else {
              setOpen(false);
              e.currentTarget.blur();
            }
          }}
          onBlur={(e) => {
            if (box.current?.contains(e.relatedTarget as Node | null)) return;
            if (!query.trim()) collapse();
          }}
          placeholder={placeholder}
          aria-label="Search notes and projects"
          className={[
            "h-full min-w-0 flex-1 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300 transition-opacity duration-150",
            open ? "opacity-100" : "pointer-events-none opacity-0",
          ].join(" ")}
        />
        {open && (
          <button
            type="button"
            onClick={collapse}
            aria-label="Clear and close search"
            title="Clear and close  Esc"
            className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
          >
            <X size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
