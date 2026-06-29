import { useEffect, useRef, useState } from "react";
import {
  Archive,
  Bookmark,
  Check,
  Clipboard,
  Clock,
  CornerDownLeft,
  Download,
  X,
  FileText,
  Globe,
  RotateCcw,
} from "lucide-react";

import type { SearchResult, SearchSource } from "../../../search/models";

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
  const ref = useRef<HTMLButtonElement>(null);

  const primary =
    result.actions.find((a) => a.primary) ?? result.actions[0];

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

  return (
    <button
      ref={ref}
      type="button"
      onClick={handleClick}
      onMouseEnter={onHover}
      onMouseDown={(e) => e.preventDefault()}
      className={[
        "group/row flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
        selected
          ? "bg-indigo-50"
          : active
            ? "bg-neutral-100"
            : "hover:bg-neutral-100/70",
      ].join(" ")}
    >
      {selectable && selectionActive && (
        <span
          role="checkbox"
          aria-checked={selected}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.();
          }}
          className={[
            "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-colors",
            selected
              ? "border-indigo-500 bg-indigo-500 text-white"
              : "border-neutral-300 bg-white",
          ].join(" ")}
        >
          {selected && <Check size={12} strokeWidth={3} />}
        </span>
      )}

      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100">
        <ResultIcon result={result} />
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-medium text-neutral-700">
          {highlight(result.title, result.highlights ?? [])}
        </h3>
        {result.subtitle && (
          <p className="truncate text-xs text-neutral-400">
            {result.subtitle}
          </p>
        )}
      </div>

      {selectable && !selectionActive && onClose && (
        <span
          role="button"
          aria-label="Close tab"
          title="Close tab"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg text-neutral-300 transition-colors hover:bg-red-50 hover:text-red-500 group-hover/row:flex"
        >
          <X size={15} />
        </span>
      )}

      {active && !selectionActive && (
        <span className="flex shrink-0 items-center gap-1 rounded-lg bg-neutral-900 px-2 py-1 text-[10px] font-medium text-white group-hover/row:hidden">
          <CornerDownLeft size={11} />
          {primary?.label ?? "Open"}
        </span>
      )}
    </button>
  );
}
