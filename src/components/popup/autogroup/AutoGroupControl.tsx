import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Check, ChevronDown, Globe, Layers, Loader2, X } from "lucide-react";

import Portal from "../menus/Portal";
import { TAB_GROUP_COLOR_HEX } from "../tab-groups/tabGroupColors";
import { useAutoGroupStore } from "../../../stores/autoGroupStore";

import type { PreviewGroup } from "../../../browser/services/autoGroupService";

const PANEL_WIDTH = 340;

/**
 * Header icon for Auto Group Tabs. Spins while tabs are being indexed or
 * grouped (also when the background groups a new tab); opens a small panel
 * for the first-time scan, the review, and on/off + Undo afterwards.
 */
export default function AutoGroupControl({ onOpen }: { onOpen?: () => void }) {
  const supported = useAutoGroupStore((s) => s.supported);
  const mode = useAutoGroupStore((s) => s.mode);
  const loaded = useAutoGroupStore((s) => s.loaded);
  const panelOpen = useAutoGroupStore((s) => s.panelOpen);
  const busy = useAutoGroupStore((s) => s.working || s.progress !== null);
  const openPanel = useAutoGroupStore((s) => s.openPanel);
  const closePanel = useAutoGroupStore((s) => s.closePanel);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<{ rect: DOMRect; el: HTMLElement } | null>(null);

  if (!supported) return null;

  const stateLabel = busy ? "working" : mode === "on" ? "on" : mode === "off" ? "off" : "not set up";

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Auto-group tabs (${stateLabel})`}
        title={`Auto-group tabs · ${stateLabel.charAt(0).toUpperCase()}${stateLabel.slice(1)}`}
        aria-haspopup="dialog"
        aria-expanded={panelOpen}
        onClick={() => {
          if (panelOpen) {
            closePanel();
            return;
          }
          const el = buttonRef.current;
          setAnchor(el ? { rect: el.getBoundingClientRect(), el } : null);
          onOpen?.();
          openPanel();
        }}
        className={[
          "relative flex h-12 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors",
          panelOpen
            ? "border-neutral-300 bg-neutral-100"
            : "border-transparent hover:bg-gray-100",
          mode === "on" ? "text-indigo-600" : "text-neutral-700",
        ].join(" ")}
      >
        <Layers size={19} className={busy ? "bwm-spin" : undefined} />
        {/* Never set up: a quiet hint that there's something here. */}
        {loaded && mode === undefined && !busy && (
          <span aria-hidden className="absolute right-1.5 top-3 h-1.5 w-1.5 rounded-full bg-indigo-500" />
        )}
      </button>

      {panelOpen && anchor && (
        <Panel anchor={anchor.rect} trigger={anchor.el} onClose={closePanel} />
      )}
    </>
  );
}

/** Slim bar directly under the header while indexing or grouping. */
export function AutoGroupProgressBar() {
  const progress = useAutoGroupStore((s) => s.progress);
  const working = useAutoGroupStore((s) => s.working);
  const visible = progress !== null || working;
  const determinate = progress !== null && progress.total > 0;
  const percent = determinate ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0;
  const label = progress
    ? `${progress.phase === "indexing" ? "Indexing tabs" : "Grouping tabs"}${determinate ? ` — ${progress.done} of ${progress.total}` : ""}`
    : "Working";

  return (
    <div
      aria-hidden={!visible}
      className={[
        "pointer-events-none absolute inset-x-0 bottom-0 h-[2px] overflow-hidden transition-opacity duration-300",
        visible ? "opacity-100" : "opacity-0",
      ].join(" ")}
    >
      {visible && (
        <div
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={determinate ? percent : undefined}
          className="h-full w-full bg-indigo-100/70"
        >
          {determinate ? (
            <div
              className="h-full rounded-r-full bg-indigo-500 transition-[width] duration-300 ease-out"
              style={{ width: `${Math.max(4, percent)}%` }}
            />
          ) : (
            <div className="bwm-progress-indeterminate h-full w-1/3 rounded-full bg-indigo-500" />
          )}
        </div>
      )}
    </div>
  );
}

function Panel({ anchor, trigger, onClose }: { anchor: DOMRect; trigger: HTMLElement | null; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || trigger?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
      trigger?.focus();
    };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [onClose, trigger]);

  const right = Math.max(8, window.innerWidth - anchor.right);
  const top = anchor.bottom + 8;

  return (
    <Portal>
      <div
        ref={ref}
        role="dialog"
        aria-label="Auto-group tabs"
        style={{ position: "fixed", top, right, width: Math.min(PANEL_WIDTH, window.innerWidth - 16), zIndex: 9999 }}
        className="flex max-h-[calc(100vh-96px)] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl"
      >
        <PanelBody />
      </div>
    </Portal>
  );
}

function PanelBody() {
  const view = useAutoGroupStore((s) => s.view);
  switch (view) {
    case "scanning":
      return <Scanning />;
    case "review":
      return <Review />;
    case "applying":
      return <Applying />;
    case "result":
      return <Result />;
    case "error":
      return <ErrorView />;
    default:
      return <Status />;
  }
}

// --- pieces ---------------------------------------------------------------------

function Title({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 pb-1 pt-3.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
        <Layers size={16} />
      </span>
      <p className="min-w-0 flex-1 text-sm font-semibold text-neutral-900">{children}</p>
      {aside}
    </div>
  );
}

function Switch({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Auto-group tabs"
      disabled={disabled}
      onClick={onChange}
      className={[
        "relative h-[18px] w-8 shrink-0 rounded-full transition-colors disabled:opacity-60",
        on ? "bg-indigo-600" : "bg-neutral-200",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-all",
          on ? "left-[15px]" : "left-0.5",
        ].join(" ")}
      />
    </button>
  );
}

function Footer({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end gap-2 border-t border-neutral-100 px-4 py-3">{children}</div>;
}

const primary =
  "inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40";
const secondary =
  "rounded-full px-3 py-1.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700";
const outline =
  "inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50";

function ProgressText() {
  const progress = useAutoGroupStore((s) => s.progress);
  if (!progress || progress.total === 0) return null;
  return (
    <span className="tabular-nums text-neutral-400">
      {progress.done} of {progress.total}
    </span>
  );
}

// --- views ----------------------------------------------------------------------

function Status() {
  const mode = useAutoGroupStore((s) => s.mode);
  const working = useAutoGroupStore((s) => s.working);
  const canUndo = useAutoGroupStore((s) => s.canUndo);
  const result = useAutoGroupStore((s) => s.result);
  const scan = useAutoGroupStore((s) => s.scan);
  const turnOff = useAutoGroupStore((s) => s.turnOff);
  const undo = useAutoGroupStore((s) => s.undo);
  const on = mode === "on";

  return (
    <>
      <Title aside={<Switch on={on} disabled={working} onChange={() => void (on ? turnOff() : scan())} />}>
        Auto-group tabs
      </Title>
      <p className="px-4 pb-3 pl-[60px] text-xs leading-relaxed text-neutral-500">
        {on
          ? "New tabs join the right group as you open them. Move a tab yourself and it stays put."
          : "Sort open tabs into groups by topic — Work, Design, Travel and more — then keep new tabs grouped as you open them."}
      </p>
      {on && canUndo && result && result.tabCount > 0 && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
          <span className="min-w-0 flex-1">
            Last grouping: {result.tabCount} tab{result.tabCount === 1 ? "" : "s"}
          </span>
          <button type="button" onClick={() => void undo()} className="font-medium text-indigo-600 hover:text-indigo-700">
            Undo
          </button>
        </div>
      )}
      <Footer>
        <button type="button" onClick={() => void scan()} className={on ? outline : primary}>
          {on ? "Scan open tabs" : "Scan tabs"}
        </button>
      </Footer>
    </>
  );
}

function Scanning() {
  return (
    <>
      <Title>Indexing your tabs</Title>
      <p className="flex gap-1.5 px-4 pb-3 pl-[60px] text-xs text-neutral-500">
        Reading titles and sites to suggest groups… <ProgressText />
      </p>
      <div className="space-y-2 px-4 pb-4" aria-hidden>
        {[0.8, 0.6, 0.7].map((w, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <span className="bwm-skeleton h-4 w-4 rounded" />
            <span className="bwm-skeleton h-3 rounded-full" style={{ width: `${w * 100}%` }} />
          </div>
        ))}
      </div>
    </>
  );
}

function Applying() {
  return (
    <>
      <Title>Working…</Title>
      <p className="flex gap-1.5 px-4 pb-4 pl-[60px] text-xs text-neutral-500">
        <Loader2 size={13} className="animate-spin text-neutral-400" />
        Arranging your tabs <ProgressText />
      </p>
    </>
  );
}

function Review() {
  const preview = useAutoGroupStore((s) => s.preview);
  const selected = useAutoGroupStore((s) => s.selected);
  const mode = useAutoGroupStore((s) => s.mode);
  const toggleGroup = useAutoGroupStore((s) => s.toggleGroup);
  const apply = useAutoGroupStore((s) => s.apply);
  const notNow = useAutoGroupStore((s) => s.notNow);
  const turnOn = useAutoGroupStore((s) => s.turnOn);
  const closePanel = useAutoGroupStore((s) => s.closePanel);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!preview) return null;
  const groups = preview.groups;

  if (groups.length === 0) {
    return (
      <>
        <Title>Nothing to group yet</Title>
        <p className="px-4 pb-3 pl-[60px] text-xs leading-relaxed text-neutral-500">
          Indexed {preview.indexed} tab{preview.indexed === 1 ? "" : "s"} — no two loose tabs share a topic right now.
          {mode !== "on" && " Turn on auto-grouping and new tabs will be grouped as you open them."}
        </p>
        <Footer>
          {mode === "on" ? (
            <button type="button" onClick={closePanel} className={primary}>
              Done
            </button>
          ) : (
            <>
              <button type="button" onClick={() => void notNow()} className={secondary}>
                Not now
              </button>
              <button type="button" onClick={() => void turnOn()} className={primary}>
                Turn on
              </button>
            </>
          )}
        </Footer>
      </>
    );
  }

  const chosen = groups.filter((g) => selected.includes(g.key));
  const tabCount = chosen.reduce((n, g) => n + g.count, 0);

  return (
    <>
      <Title>Review suggested groups</Title>
      <p className="px-4 pb-2.5 pl-[60px] text-xs leading-relaxed text-neutral-500">
        {tabCount} tab{tabCount === 1 ? "" : "s"} into {chosen.length} group{chosen.length === 1 ? "" : "s"}. Uncheck any you
        don&apos;t want — they&apos;ll be left out from now on.
      </p>

      <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-neutral-100 px-2 py-1.5" aria-label="Suggested groups">
        {groups.map((g) => (
          <ReviewRow
            key={g.key}
            group={g}
            checked={selected.includes(g.key)}
            expanded={expanded === g.key}
            onToggle={() => toggleGroup(g.key)}
            onExpand={() => setExpanded((k) => (k === g.key ? null : g.key))}
          />
        ))}
      </ul>

      <p className="border-t border-neutral-100 px-4 pt-2.5 text-[11px] leading-relaxed text-neutral-400">
        Pinned tabs{preview.keptInGroups > 0 ? " and tabs already in your groups" : ""} stay where they are. You can undo this.
      </p>
      <div className="flex items-center justify-end gap-2 px-4 pb-3 pt-2">
        <button type="button" onClick={() => void notNow()} className={secondary}>
          Not now
        </button>
        <button type="button" onClick={() => void apply()} disabled={chosen.length === 0} className={primary}>
          Group {tabCount} tab{tabCount === 1 ? "" : "s"}
        </button>
      </div>
    </>
  );
}

function ReviewRow({
  group,
  checked,
  expanded,
  onToggle,
  onExpand,
}: {
  group: PreviewGroup;
  checked: boolean;
  expanded: boolean;
  onToggle: () => void;
  onExpand: () => void;
}) {
  return (
    <li>
      <div className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-neutral-50">
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          aria-label={`${group.name}, ${group.count} tabs`}
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <span
            className={[
              "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
              checked ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white",
            ].join(" ")}
          >
            {checked && <Check size={11} strokeWidth={3} />}
          </span>
          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: TAB_GROUP_COLOR_HEX[group.color] }} />
          <span className={["min-w-0 flex-1 truncate text-sm", checked ? "text-neutral-800" : "text-neutral-400"].join(" ")}>
            {group.emoji ? `${group.emoji} ` : ""}
            {group.name}
            {group.joinsExisting && <span className="ml-1.5 text-[11px] text-neutral-400">· joins your group</span>}
          </span>
          <span className="shrink-0 text-xs tabular-nums text-neutral-400">{group.count}</span>
        </button>
        <button
          type="button"
          onClick={onExpand}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Hide" : "Show"} tabs in ${group.name}`}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
        >
          <ChevronDown size={14} className={["transition-transform", expanded ? "rotate-180" : ""].join(" ")} />
        </button>
      </div>
      {expanded && (
        <ul className="mb-1 ml-[34px] mr-2 space-y-0.5 border-l border-neutral-100 pl-3">
          {group.tabs.map((t) => (
            <li key={t.id} className="flex items-center gap-2 py-0.5 text-xs text-neutral-500">
              {t.favicon ? (
                <img src={t.favicon} alt="" className="h-3.5 w-3.5 shrink-0 rounded-sm" loading="lazy" />
              ) : (
                <Globe size={13} className="shrink-0 text-neutral-300" />
              )}
              <span className="truncate">{t.title}</span>
            </li>
          ))}
          {group.count > group.tabs.length && (
            <li className="py-0.5 text-[11px] text-neutral-400">+{group.count - group.tabs.length} more</li>
          )}
        </ul>
      )}
    </li>
  );
}

function Result() {
  const result = useAutoGroupStore((s) => s.result);
  const undo = useAutoGroupStore((s) => s.undo);
  const closePanel = useAutoGroupStore((s) => s.closePanel);
  if (!result) return null;
  return (
    <>
      <div className="flex items-start gap-3 px-4 pb-3 pt-3.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <Check size={16} strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-900">
            Grouped {result.tabCount} tab{result.tabCount === 1 ? "" : "s"}
            {result.groupCount > 1 ? ` into ${result.groupCount} groups` : ""}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">
            Auto-grouping is on — new tabs will join the right group in the background.
          </p>
          {result.errors.length > 0 && (
            <p className="mt-1.5 text-[11px] leading-relaxed text-amber-600">
              Some tabs were skipped: {result.errors[0]}
            </p>
          )}
        </div>
      </div>
      <Footer>
        {result.tabCount > 0 && (
          <button type="button" onClick={() => void undo()} className={outline}>
            Undo
          </button>
        )}
        <button type="button" onClick={closePanel} className={primary}>
          Done
        </button>
      </Footer>
    </>
  );
}

function ErrorView() {
  const error = useAutoGroupStore((s) => s.error);
  const scan = useAutoGroupStore((s) => s.scan);
  const closePanel = useAutoGroupStore((s) => s.closePanel);
  return (
    <>
      <div className="flex items-start gap-3 px-4 pb-3 pt-3.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500">
          <X size={16} strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-900">Couldn&apos;t group tabs</p>
          <p className="mt-0.5 break-words text-xs leading-relaxed text-neutral-500">{error ?? "Something went wrong."}</p>
        </div>
      </div>
      <Footer>
        <button type="button" onClick={closePanel} className={secondary}>
          Close
        </button>
        <button type="button" onClick={() => void scan()} className={primary}>
          Try again
        </button>
      </Footer>
    </>
  );
}
