import { Check, Layers, Loader2, X } from "lucide-react";

import { useAutoGroupStore } from "../../stores/autoGroupStore";
import { TAB_GROUP_COLOR_HEX } from "./tab-groups/tabGroupColors";

/** Worth asking about: a real handful of tabs, or more than one group. */
const MIN_TABS = 4;
const MAX_CHIPS = 6;

/**
 * Under the window cards, with the other notices:
 *  - before the user has chosen: the suggested groups, "Group tabs" / "Skip";
 *  - right after grouping: what happened, with Undo;
 *  - after Undo: a short confirmation.
 */
export default function AutoGroupSuggestion() {
  const supported = useAutoGroupStore((s) => s.supported);
  const mode = useAutoGroupStore((s) => s.mode);
  const preview = useAutoGroupStore((s) => s.preview);
  const busy = useAutoGroupStore((s) => s.busy);
  const result = useAutoGroupStore((s) => s.result);
  const undone = useAutoGroupStore((s) => s.undone);
  const apply = useAutoGroupStore((s) => s.apply);
  const skip = useAutoGroupStore((s) => s.skip);
  const undo = useAutoGroupStore((s) => s.undo);
  const dismiss = useAutoGroupStore((s) => s.dismiss);

  if (!supported) return null;

  if (result) {
    return (
      <div role="status" className="mx-5 mt-3 flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white px-3.5 py-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <Check size={16} strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-800">
            {result.tabCount === 0
              ? "Auto-grouping is on"
              : `Grouped ${result.tabCount} tab${result.tabCount === 1 ? "" : "s"}${
                  result.groupCount > 1 ? ` into ${result.groupCount} groups` : ""
                }`}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">
            New tabs join the right group as you open them. Move a tab yourself and it stays put.
          </p>
          {result.tabCount > 0 && (
            <button
              type="button"
              onClick={() => void undo()}
              disabled={busy !== null}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-60"
            >
              {busy === "undo" && <Loader2 size={12} className="animate-spin" />}
              Undo
            </button>
          )}
        </div>
        <DismissButton onClick={dismiss} />
      </div>
    );
  }

  if (undone) {
    return (
      <div role="status" className="mx-5 mt-3 flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-3.5 py-2.5">
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-neutral-500">
          Tabs are back where they were. Auto-grouping is off — turn it on any time from the ☰ menu.
        </p>
        <DismissButton onClick={dismiss} />
      </div>
    );
  }

  if (mode !== undefined || !preview) return null;
  const { groups, tabCount, keptInGroups } = preview;
  if (tabCount < MIN_TABS && groups.length < 2) return null;

  const shown = groups.slice(0, MAX_CHIPS);
  const more = groups.length - shown.length;

  return (
    <section
      aria-label="Suggested tab groups"
      className="mx-5 mt-3 rounded-2xl border border-neutral-200 bg-white px-3.5 py-3"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
          <Layers size={16} strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-800">
            Group {tabCount} tabs into {groups.length} group{groups.length === 1 ? "" : "s"}?
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">
            Sorted by what each tab is about. New tabs will join the right group as you open them.
          </p>
        </div>
      </div>

      <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Groups">
        {shown.map((g) => (
          <li
            key={g.key}
            title={g.titles.join("\n")}
            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 py-1 pl-2 pr-2.5 text-[11px] font-medium text-neutral-700"
          >
            <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: TAB_GROUP_COLOR_HEX[g.color] }} />
            <span className="truncate">
              {g.emoji ? `${g.emoji} ` : ""}
              {g.name}
            </span>
            <span className="text-neutral-400">{g.count}</span>
          </li>
        ))}
        {more > 0 && (
          <li className="inline-flex items-center rounded-full px-1.5 py-1 text-[11px] font-medium text-neutral-400">
            +{more} more
          </li>
        )}
      </ul>

      {keptInGroups > 0 && (
        <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">
          Tabs already in your groups stay where they are.
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void apply()}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-70"
        >
          {busy === "apply" && <Loader2 size={12} className="animate-spin" />}
          Group tabs
        </button>
        <button
          type="button"
          onClick={() => void skip()}
          disabled={busy !== null}
          className="rounded-full px-3 py-1.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
        >
          Skip
        </button>
      </div>
    </section>
  );
}

function DismissButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Dismiss"
      title="Dismiss"
      onClick={onClick}
      className="shrink-0 rounded-lg p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
    >
      <X size={15} />
    </button>
  );
}
