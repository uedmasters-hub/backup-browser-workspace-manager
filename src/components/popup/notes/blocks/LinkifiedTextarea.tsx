import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent, RefObject } from "react";
import { ExternalLink } from "lucide-react";

import { linkify } from "../linkify";
import { openLinkInNewTab } from "../../../../browser/services/navigationService";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onBlur?: () => void;
  placeholder?: string;
  /** Typography + padding. Applied to both the textarea and the link preview so they line up. */
  className?: string;
  autoFocus?: boolean;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
};

const BASE =
  "block w-full resize-none bg-transparent outline-none placeholder:text-neutral-300";

const LINK =
  "group/link -mx-0.5 rounded px-0.5 text-indigo-600 underline decoration-indigo-300 decoration-[1.5px] underline-offset-[3px] [overflow-wrap:anywhere] box-decoration-clone transition-colors duration-150 hover:bg-indigo-500/10 hover:text-indigo-700 hover:decoration-indigo-500 focus-visible:bg-indigo-500/10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-500";

/**
 * The hover arrow hangs off a zero-width inline anchor placed right after the
 * URL's last character, so showing it never reflows the text and no space is
 * reserved while it's hidden.
 */
const ARROW_ANCHOR = "relative inline-block h-[1em] w-0 align-[-0.15em]";

const ARROW =
  "pointer-events-none absolute left-1 top-1/2 -mt-[calc(0.4em+3px)] flex items-center justify-center rounded-[5px] bg-white p-[2px] text-indigo-600 opacity-0 shadow-sm ring-1 ring-indigo-200 transition duration-150 ease-out -translate-x-1 translate-y-0.5 group-hover/link:translate-x-0 group-hover/link:translate-y-0 group-hover/link:opacity-100 group-focus-visible/link:translate-x-0 group-focus-visible/link:translate-y-0 group-focus-visible/link:opacity-100 motion-reduce:transition-none";

/** Map a click inside the preview to a character offset in the source text. */
function caretOffsetAt(root: HTMLElement, x: number, y: number): number | null {
  let node: Node | null = null;
  let offset = 0;

  if (typeof document.caretPositionFromPoint === "function") {
    const pos = document.caretPositionFromPoint(x, y);
    node = pos?.offsetNode ?? null;
    offset = pos?.offset ?? 0;
  } else if (typeof document.caretRangeFromPoint === "function") {
    const range = document.caretRangeFromPoint(x, y);
    node = range?.startContainer ?? null;
    offset = range?.startOffset ?? 0;
  }

  if (!node || node.nodeType !== Node.TEXT_NODE || !root.contains(node)) {
    return null;
  }
  const host = node.parentElement?.closest<HTMLElement>("[data-start]");
  return host ? Number(host.dataset.start) + offset : null;
}

/**
 * Auto-growing textarea that shows URLs as real links while it isn't being
 * edited. Clicking a link opens it in a new tab; clicking anywhere else drops
 * you into the textarea with the caret where you clicked.
 */
export default function LinkifiedTextarea({
  value,
  onChange,
  onKeyDown,
  onBlur,
  placeholder,
  className = "",
  autoFocus = false,
  textareaRef,
}: Props) {
  const innerRef = useRef<HTMLTextAreaElement>(null);
  const ref = textareaRef ?? innerRef;
  const [editing, setEditing] = useState(false);

  const segments = useMemo(() => linkify(value), [value]);
  const preview = !editing && segments.some((s) => s.kind === "link");

  // grow to fit — no inner scrollbar
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [ref, value, preview]);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [ref, autoFocus]);

  function editAt(e: MouseEvent<HTMLDivElement>) {
    if (e.button !== 0 || (e.target as HTMLElement).closest("a")) return;
    e.preventDefault();
    const el = ref.current;
    if (!el) return;
    const offset = caretOffsetAt(e.currentTarget, e.clientX, e.clientY) ?? value.length;
    el.focus();
    el.setSelectionRange(offset, offset);
  }

  return (
    <div className="relative w-full min-w-0">
      {preview && (
        <div
          onMouseDown={editAt}
          className={`${className} relative w-full cursor-text whitespace-pre-wrap break-words`}
        >
          {segments.map((seg) =>
            seg.kind === "text" ? (
              <span key={seg.start} data-start={seg.start}>
                {seg.text}
              </span>
            ) : (
              <a
                key={seg.start}
                href={seg.href}
                target="_blank"
                rel="noopener noreferrer"
                title="Open in new tab (Ctrl/⌘-click to open in background)"
                onMouseDown={(e) => {
                  // keep the block out of edit mode; stop middle-click autoscroll
                  e.stopPropagation();
                  if (e.button === 1) e.preventDefault();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  void openLinkInNewTab(seg.href, {
                    background: e.metaKey || e.ctrlKey,
                  });
                }}
                onAuxClick={(e) => {
                  if (e.button !== 1) return;
                  e.preventDefault();
                  void openLinkInNewTab(seg.href, { background: true });
                }}
                className={LINK}
              >
                <span data-start={seg.start}>{seg.text}</span>
                <span aria-hidden="true" className={ARROW_ANCHOR}>
                  <span className={ARROW}>
                    <ExternalLink size="0.8em" strokeWidth={2.5} />
                  </span>
                </span>
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            )
          )}
        </div>
      )}

      <textarea
        ref={ref}
        rows={1}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => setEditing(true)}
        onBlur={() => {
          setEditing(false);
          onBlur?.();
        }}
        className={[
          BASE,
          className,
          // While previewing, the textarea stays mounted and keyboard-focusable
          // (Tab still reaches it) but is invisible and click-through.
          preview ? "pointer-events-none absolute inset-x-0 top-0 opacity-0" : "",
        ].join(" ")}
      />
    </div>
  );
}
