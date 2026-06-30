import { Check, Pause, Pin, Play, Star, Volume2, VolumeX, X } from "lucide-react";

import { useTabStore } from "../../stores/tabStore";
import { useMediaStore } from "../../stores/mediaStore";
import MediaSeek from "./MediaSeek";
import { formatTabAge } from "./tabFormat";

type Props = {
  id: number;
  title: string;
  favicon?: string;
  favorite?: boolean;
  pinned?: boolean;
  active?: boolean;
  audible?: boolean;
  muted?: boolean;
  lastAccessed?: number;
  nested?: boolean;
};

export default function TabItem({
  id,
  title,
  favicon,
  favorite = false,
  pinned = false,
  active = false,
  audible = false,
  muted = false,
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
  const toggleMuteTab = useTabStore((state) => state.toggleMuteTab);

  const media = useMediaStore((state) => state.byTab[id]);
  const toggleMedia = useMediaStore((state) => state.toggle);

  const isSelected = selectedTabs.includes(id);
  const age = formatTabAge(lastAccessed);
  const isMedia = audible || muted;
  const playing = audible && !muted;
  const hasControls = Boolean(media?.hasMedia);
  const mediaPlaying = media?.playing ?? playing;
  const effectivePlaying = hasControls ? Boolean(media?.playing) : playing;
  const showSeek = hasControls && (media?.duration ?? 0) > 0;

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
        "group relative flex cursor-pointer items-center rounded-2xl bg-white px-4 py-4 transition-all hover:bg-neutral-50 active:scale-[0.99]",
        nested
          ? "mx-2 mb-2 border border-neutral-100 shadow-none"
          : "mx-5 mb-3 shadow-sm",
      ].join(" ")}
    >
      {active && !selectionMode && (
        <span
          aria-hidden
          title="Current page"
          className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-neutral-900"
        />
      )}

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
        <div className="relative mr-3 flex h-6 w-6 items-center justify-center">
          {favicon ? (
            <img
              src={favicon}
              alt=""
              className={[
                "h-5 w-5 rounded",
                hasControls ? "group-hover:opacity-0" : "",
              ].join(" ")}
            />
          ) : (
            <div
              className={[
                "h-3 w-3 rounded-full bg-violet-500",
                hasControls ? "group-hover:opacity-0" : "",
              ].join(" ")}
            />
          )}

          {isMedia && (
            <span
              aria-hidden
              className={[
                "absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-2 ring-white",
                effectivePlaying ? "bg-neutral-900" : "bg-neutral-300",
                hasControls ? "group-hover:hidden" : "",
              ].join(" ")}
            >
              {effectivePlaying ? (
                <span className="flex h-1.5 items-end gap-[1px]">
                  <span
                    className="bwm-eq-bar w-[1.5px] bg-white"
                    style={{ height: "100%", animationDelay: "0ms" }}
                  />
                  <span
                    className="bwm-eq-bar w-[1.5px] bg-white"
                    style={{ height: "100%", animationDelay: "150ms" }}
                  />
                  <span
                    className="bwm-eq-bar w-[1.5px] bg-white"
                    style={{ height: "100%", animationDelay: "300ms" }}
                  />
                </span>
              ) : (
                <VolumeX size={9} className="text-white" />
              )}
            </span>
          )}

          {hasControls && (
            <button
              type="button"
              aria-label={mediaPlaying ? `Pause ${title}` : `Play ${title}`}
              title={mediaPlaying ? "Pause" : "Play"}
              onClick={(event) => {
                event.stopPropagation();
                void toggleMedia(id);
              }}
              className="absolute inset-0 hidden items-center justify-center rounded-md text-red-600 group-hover:flex"
            >
              {mediaPlaying ? (
                <Pause size={15} fill="currentColor" />
              ) : (
                <Play size={15} fill="currentColor" />
              )}
            </button>
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
            {isMedia && (
              <button
                type="button"
                aria-label={muted ? `Unmute ${title}` : `Mute ${title}`}
                title={muted ? "Unmute tab" : "Mute tab"}
                onClick={(event) => {
                  event.stopPropagation();
                  void toggleMuteTab(id);
                }}
                className={[
                  "flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-neutral-100",
                  muted
                    ? "text-neutral-400 hover:text-neutral-700"
                    : "text-neutral-600 hover:text-neutral-900",
                ].join(" ")}
              >
                {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
              </button>
            )}

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

      {showSeek && !selectionMode && (
        <div className="absolute inset-x-4 bottom-1.5">
          <MediaSeek
            tabId={id}
            currentTime={media?.currentTime ?? 0}
            duration={media?.duration ?? 0}
          />
        </div>
      )}
    </div>
  );
}
