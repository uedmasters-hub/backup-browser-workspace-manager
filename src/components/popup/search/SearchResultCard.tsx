import { useEffect, useRef, useState } from "react";
import {
  Archive,
  Bookmark,
  Check,
  Clipboard,
  Clock,
  CornerDownLeft,
  Download,
  Pause,
  Play,
  Volume2,
  VolumeX,
  X,
  FileText,
  Globe,
  RotateCcw,
} from "lucide-react";

import type { SearchResult, SearchSource } from "../../../search/models";
import type { SearchableTab } from "../../../search/entities";
import { useMediaStore } from "../../../stores/mediaStore";
import { useTabStore } from "../../../stores/tabStore";
import { formatTabAge } from "../tabFormat";

type Props = {
  result: SearchResult;
  active?: boolean;
  onHover?: () => void;
  selectable?: boolean;
  selected?: boolean;
  selectionActive?: boolean;
  onToggleSelect?: () => void;
  onClose?: () => void;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlight(text: string, tokens: string[]): React.ReactNode {
  const usable = tokens.filter((t) => t.length > 0);
  if (usable.length === 0) {
    return text;
  }
  const pattern = new RegExp(`(${usable.map(escapeRegExp).join("|")})`, "ig");
  return text.split(pattern).map((part, index) =>
    usable.some((t) => t.toLowerCase() === part.toLowerCase()) ? (
      <mark
        key={index}
        className="bg-transparent font-semibold text-neutral-900"
      >
        {part}
      </mark>
    ) : (
      <span key={index}>{part}</span>
    )
  );
}

const SOURCE_ICON: Record<
  SearchSource,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  workspace: Globe,
  tab: Globe,
  bookmark: Bookmark,
  history: Clock,
  download: Download,
  session: RotateCcw,
  archive: Archive,
  page: FileText,
  clipboard: Clipboard,
};

function ResultIcon({ result }: { result: SearchResult }) {
  const [errored, setErrored] = useState(false);

  if (result.source === "tab" && result.icon && !errored) {
    return (
      <img
        src={result.icon}
        alt=""
        onError={() => setErrored(true)}
        className="h-5 w-5 rounded"
      />
    );
  }

  if (
    (result.source === "workspace" || result.source === "archive") &&
    result.icon
  ) {
    return <span className="text-lg leading-none">{result.icon}</span>;
  }

  const Icon = SOURCE_ICON[result.source as SearchSource] ?? Globe;
  return <Icon size={18} className="text-neutral-400" />;
}

export default function SearchResultCard({
  result,
  active = false,
  onHover,
  selectable = false,
  selected = false,
  selectionActive = false,
  onToggleSelect,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const primary =
    result.actions.find((a) => a.primary) ?? result.actions[0];

  const tab = result.source === "tab" ? (result.payload as SearchableTab) : null;
  const tabId = tab?.tabId;
  const audible = Boolean(tab?.metadata?.audible);
  const muted = Boolean(tab?.metadata?.muted);
  const isMedia = audible || muted;
  const playingHint = audible && !muted;

  const media = useMediaStore((s) =>
    tabId != null ? s.byTab[tabId] : undefined
  );
  const toggleMedia = useMediaStore((s) => s.toggle);
  const toggleMuteTab = useTabStore((s) => s.toggleMuteTab);

  const hasControls = Boolean(media?.hasMedia);
  const mediaPlaying = media?.playing ?? playingHint;
  const effectivePlaying = hasControls ? Boolean(media?.playing) : playingHint;
  const isActive = Boolean(tab?.active);

  useEffect(() => {
    if (active && ref.current) {
      ref.current.scrollIntoView({ block: "nearest" });
    }
  }, [active]);

  function handleClick() {
    if (selectable && selectionActive) {
      onToggleSelect?.();
    } else {
      void primary?.run();
    }
  }

  const age = tab ? formatTabAge(tab.lastAccessedAt) : "";

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onMouseEnter={onHover}
      onMouseDown={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      className={[
        "group/row relative mb-2 flex w-full cursor-pointer items-center gap-3 rounded-2xl bg-white px-4 py-4 text-left shadow-sm transition-all hover:bg-neutral-50 active:scale-[0.99]",
        selected
          ? "ring-2 ring-indigo-400"
          : active
            ? "ring-2 ring-neutral-200"
            : "",
      ].join(" ")}
    >
      {isActive && (
        <span
          aria-hidden
          title="Current page"
          className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-neutral-900"
        />
      )}

      {selectable && selectionActive && (
        <span
          role="checkbox"
          aria-checked={selected}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.();
          }}
          className={[
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
            selected
              ? "border-indigo-500 bg-indigo-500 text-white"
              : "border-neutral-300 bg-white",
          ].join(" ")}
        >
          {selected && <Check size={13} strokeWidth={3} />}
        </span>
      )}

      <div className="relative flex h-6 w-6 shrink-0 items-center justify-center">
        <ResultIcon result={result} />

        {isMedia && (
          <span
            aria-hidden
            className={[
              "absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-2 ring-white",
              effectivePlaying ? "bg-neutral-900" : "bg-neutral-300",
              hasControls ? "group-hover/row:hidden" : "",
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

        {hasControls && tabId != null && (
          <span
            role="button"
            aria-label={mediaPlaying ? "Pause" : "Play"}
            title={mediaPlaying ? "Pause" : "Play"}
            onClick={(e) => {
              e.stopPropagation();
              void toggleMedia(tabId);
            }}
            className="absolute inset-0 hidden items-center justify-center rounded-md bg-white text-red-600 group-hover/row:flex"
          >
            {mediaPlaying ? (
              <Pause size={15} fill="currentColor" />
            ) : (
              <Play size={15} fill="currentColor" />
            )}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-medium text-neutral-900">
          {highlight(result.title, result.highlights ?? [])}
        </h3>
        {result.subtitle && (
          <p className="truncate text-xs text-neutral-400">
            {result.subtitle}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {isMedia && tabId != null && !selectionActive && (
          <span
            role="button"
            aria-label={muted ? "Unmute tab" : "Mute tab"}
            title={muted ? "Unmute tab" : "Mute tab"}
            onClick={(e) => {
              e.stopPropagation();
              void toggleMuteTab(tabId);
            }}
            className={[
              "flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-neutral-100",
              muted
                ? "text-neutral-400 hover:text-neutral-700"
                : "text-neutral-600 hover:text-neutral-900",
            ].join(" ")}
          >
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </span>
        )}

        {tab && !active && !selectionActive && (
          <span className="w-9 text-right text-xs font-medium text-neutral-400 group-hover/row:hidden">
            {age}
          </span>
        )}

        {selectable && !selectionActive && onClose && (
          <span
            role="button"
            aria-label="Close tab"
            title="Close tab"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="hidden h-8 w-8 items-center justify-center rounded-lg text-neutral-300 transition-colors hover:bg-red-50 hover:text-red-500 group-hover/row:flex"
          >
            <X size={16} />
          </span>
        )}

        {!selectionActive && (
          <span
            className={[
              "items-center gap-1 rounded-lg bg-neutral-900 px-2 py-1 text-[10px] font-medium text-white",
              active ? "flex" : "hidden group-hover/row:flex",
            ].join(" ")}
          >
            <CornerDownLeft size={11} />
            {primary?.label ?? "Open"}
          </span>
        )}
      </div>

    </div>
  );
}
