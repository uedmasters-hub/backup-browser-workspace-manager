import { useEffect, useState } from "react";
import { ArrowUpCircle, Sparkles, X } from "lucide-react";

import {
  applyUpdate,
  checkForUpdate,
  clearUpdateBadge,
  dismissUpdatedNotice,
  getUpdateState,
} from "../../browser/services/updateService";
import type { UpdateState } from "../../browser/services/updateService";
import { CHANGELOG_URL, notesBetween } from "../../constants/releaseNotes";
import { openLinkInNewTab } from "../../browser/services/navigationService";

/**
 * Top-of-popup card for updates:
 *  - "Update ready": a newer version is waiting → one click installs it.
 *  - "Updated to vX": shown once after an update with what's new.
 */
export default function UpdateNotice() {
  const [state, setState] = useState<UpdateState>({});

  useEffect(() => {
    let alive = true;
    void getUpdateState().then((s) => {
      if (!alive) return;
      setState(s);
      if (s.updated && !s.ready) void clearUpdateBadge(); // seen
    });
    void checkForUpdate().then((ready) => {
      if (alive && ready) setState((s) => ({ ...s, ready }));
    });
    return () => {
      alive = false;
    };
  }, []);

  if (state.ready) {
    return (
      <div className="mx-5 mt-3 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-3.5 py-3">
        <ArrowUpCircle size={20} className="shrink-0 text-emerald-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-800">
            Version {state.ready} is ready
          </p>
          <p className="text-xs text-neutral-500">
            Restart to update now — your tabs, notes and settings stay as they are.
          </p>
        </div>
        <button
          type="button"
          onClick={applyUpdate}
          className="shrink-0 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
        >
          Restart
        </button>
      </div>
    );
  }

  if (!state.updated) return null;

  const sections = notesBetween(state.updated.from, state.updated.to);
  const items = sections.flatMap((s) => s.items).slice(0, 5);

  return (
    <div className="mx-5 mt-3 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white px-3.5 py-3">
      <div className="flex items-start gap-3">
        <Sparkles size={18} className="mt-0.5 shrink-0 text-indigo-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-800">
            Updated to v{state.updated.to}
          </p>
          {items.length > 0 ? (
            <ul className="mt-1.5 space-y-1">
              {items.map((item) => (
                <li
                  key={item}
                  className="relative pl-3 text-xs leading-relaxed text-neutral-600 before:absolute before:left-0 before:top-[0.55em] before:h-1 before:w-1 before:rounded-full before:bg-indigo-300"
                >
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-0.5 text-xs text-neutral-500">
              Fixes and improvements.
            </p>
          )}
          <button
            type="button"
            onClick={() => void openLinkInNewTab(CHANGELOG_URL)}
            className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-700"
          >
            See all changes →
          </button>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          title="Dismiss"
          onClick={() => {
            setState((s) => ({ ...s, updated: undefined }));
            void dismissUpdatedNotice();
          }}
          className="shrink-0 rounded-lg p-1 text-neutral-400 transition-colors hover:bg-white hover:text-neutral-600"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
