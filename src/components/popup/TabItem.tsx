import { Check, Pin, Star, X } from "lucide-react";

import { useTabStore } from "../../stores/tabStore";

type Props = {
  id: number;
  title: string;
  favicon?: string;
  favorite?: boolean;
  pinned?: boolean;
  lastAccessed?: number;
  nested?: boolean;
};

function formatTabAge(lastAccessed?: number): string {
  if (!lastAccessed) {
    return "—";
  }

  const elapsed = Math.max(0, Date.now() - lastAccessed);
  const minutes = Math.floor(elapsed / 60_000);

  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;

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
}: Props) {
  const selectionMode = useTabStore((state) => state.selectionMode);
  const selectedTabs = useTabStore((state) => state.selectedTabs);
  const toggleTabSelection = useTabStore(
    (state) => state.toggleTabSelection
  );
  const activateTab = useTabStore((state) => state.activateTab);
  const toggleFavorite = useTabStore((state) => state.toggleFavorite);
  const closeTab = useTabStore((state) => state.closeTab);

  const isSelected = selectedTabs.includes(id);
  const age = formatTabAge(lastAccessed);

  return (
    <div
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
          {isSelected && <Check size={14} />}
        </div>
      ) : (
        <div className="mr-3 flex h-6 w-6 items-center justify-center">
          {favicon ? (
            <img src={favicon} alt="" className="h-5 w-5 rounded" />
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

      <div className="ml-2 flex h-8 shrink-0 items-center justify-end gap-0.5">
        {!selectionMode && (
          <>
            <span
              title={
                age === "Now"
                  ? "Last accessed just now"
                  : age === "—"
                    ? "Last accessed time unavailable"
                    : `Last accessed ${age} ago`
              }
              className="w-9 text-right text-xs font-medium text-neutral-400 group-hover:hidden"
            >
              {age}
            </span>

            <button
              type="button"
              aria-label={
                favorite
                  ? `Remove ${title} from favorites`
                  : `Add ${title} to favorites`
              }
              title={favorite ? "Remove from favorites" : "Add to favorites"}
              onClick={(event) => {
                event.stopPropagation();
                void toggleFavorite(id);
              }}
              className={[
                "h-8 w-8 items-center justify-center rounded-lg transition-colors",
                favorite
                  ? "flex text-amber-400 hover:bg-neutral-100 hover:text-amber-500"
                  : "hidden text-neutral-300 hover:bg-neutral-100 hover:text-neutral-600 group-hover:flex",
              ].join(" ")}
            >
              <Star size={15} fill={favorite ? "currentColor" : "none"} />
            </button>

            <button
              type="button"
              aria-label={`Close ${title}`}
              title="Close tab"
              onClick={(event) => {
                event.stopPropagation();
                void closeTab(id);
              }}
              className="hidden h-8 w-8 items-center justify-center rounded-lg text-neutral-300 transition-colors hover:bg-red-50 hover:text-red-500 group-hover:flex"
            >
              <X size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
