import {
  Check,
  Pin,
  Star,
} from "lucide-react";
import type { DragEvent } from "react";

import { useTabStore } from "../../stores/tabStore";

type Props = {
  id: number;
  title: string;
  favicon?: string;
  favorite?: boolean;
  pinned?: boolean;
  lastAccessed?: number;
  nested?: boolean;
  dragging?: boolean;
  onTabDragStart?: (tabId: number) => void;
  onTabDrop?: (targetTabId: number) => void;
};

function formatTabAge(lastAccessed?: number): string {
  if (!lastAccessed) {
    return "—";
  }

  const elapsed = Math.max(
    0,
    Date.now() - lastAccessed
  );
  const minutes = Math.floor(elapsed / 60_000);

  if (minutes < 1) {
    return "Now";
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h`;
  }

  const days = Math.floor(hours / 24);

  if (days < 30) {
    return `${days}d`;
  }

  const months = Math.floor(days / 30);

  if (months < 12) {
    return `${months}mo`;
  }

  return `${Math.floor(months / 12)}y`;
}

export default function TabItem({
  id,
  title,
  favicon,
  favorite = false,
  pinned = false,
  lastAccessed,
  nested = false,
  dragging = false,
  onTabDragStart,
  onTabDrop,
}: Props) {
  const selectionMode = useTabStore(
    (state) => state.selectionMode
  );

  const selectedTabs = useTabStore(
    (state) => state.selectedTabs
  );

  const toggleTabSelection = useTabStore(
    (state) => state.toggleTabSelection
  );

  const activateTab = useTabStore(
    (state) => state.activateTab
  );

  const toggleFavorite = useTabStore(
    (state) => state.toggleFavorite
  );

  const isSelected =
    selectedTabs.includes(id);

  const age = formatTabAge(lastAccessed);

  return (
    <div
      draggable={!selectionMode && Boolean(onTabDragStart)}
      onDragStart={(event: DragEvent<HTMLDivElement>) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(
          "application/x-workspace-tab",
          String(id)
        );
        onTabDragStart?.(id);
      }}
      onDragOver={(event) => {
        if (onTabDrop) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }
      }}
      onDrop={(event) => {
        if (!onTabDrop) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        onTabDrop(id);
      }}
      onClick={() => {
        if (selectionMode) {
          toggleTabSelection(id);
        } else {
          activateTab(id);
        }
      }}
      className={[
        "group flex cursor-pointer items-center rounded-2xl bg-white px-4 py-4 transition-all hover:bg-neutral-50 active:scale-[0.99]",
        nested
          ? "mx-2 mb-2 border border-neutral-100 shadow-none"
          : "mx-5 mb-3 shadow-sm",
        dragging ? "opacity-50" : "",
      ].join(" ")}
    >
      {selectionMode ? (
        <div
          className={[
            "mr-4 flex h-5 w-5 items-center justify-center rounded-md border",
            isSelected
              ? "border-black bg-black text-white"
              : "border-neutral-300",
          ].join(" ")}
        >
          {isSelected && (
            <Check size={14} />
          )}
        </div>
      ) : (
        <div className="mr-3 flex h-6 w-6 items-center justify-center">
          {favicon ? (
            <img
              src={favicon}
              alt=""
              className="h-5 w-5 rounded"
            />
          ) : (
            <div className="h-3 w-3 rounded-full bg-violet-500" />
          )}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-neutral-900">
            {title}
          </p>

          {pinned && (
            <Pin
              size={12}
              fill="currentColor"
              className="shrink-0 text-neutral-500"
            />
          )}
        </div>
      </div>

      <div className="relative ml-3 h-8 w-[76px] shrink-0 overflow-hidden">
        <span
          title={
            age === "Now"
              ? "Last accessed just now"
              : age === "—"
                ? "Last accessed time unavailable"
                : `Last accessed ${age} ago`
          }
          className={[
            "absolute right-0 top-0 flex h-8 w-10 items-center justify-end pr-1 text-xs font-medium text-neutral-400 transition-all duration-200 ease-out",
            selectionMode || favorite
              ? ""
              : "group-hover:-translate-x-2 group-hover:opacity-0 group-focus-within:-translate-x-2 group-focus-within:opacity-0",
          ].join(" ")}
        >
          {age}
        </span>

        {!selectionMode && (
          <button
            type="button"
            aria-label={
              favorite
                ? `Remove ${title} from favorites`
                : `Add ${title} to favorites`
            }
            title={
              favorite
                ? "Remove from favorites"
                : "Add to favorites"
            }
            onClick={(event) => {
              event.stopPropagation();
              void toggleFavorite(id);
            }}
            className={[
              "absolute top-0 flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 ease-out",
              favorite
                ? "pointer-events-auto right-10 scale-100 text-amber-400 opacity-80 hover:bg-neutral-100 hover:text-amber-500 hover:opacity-100"
                : "pointer-events-none right-0 translate-x-4 scale-90 text-neutral-300 opacity-0 hover:bg-neutral-100 hover:text-neutral-600 group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:scale-100 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-x-0 group-focus-within:scale-100 group-focus-within:opacity-100",
            ].join(" ")}
          >
            <Star
              size={15}
              fill={favorite ? "currentColor" : "none"}
            />
          </button>
        )}
      </div>
    </div>
  );
}
