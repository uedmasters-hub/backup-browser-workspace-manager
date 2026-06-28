import { useEffect, useRef, useState } from "react";
import { CornerDownLeft, Globe } from "lucide-react";

import type { SearchResult } from "../../../search/models";

type Props = {
  result: SearchResult;
  active?: boolean;
  onHover?: () => void;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Bold the matched query tokens inside the title. */
function highlight(
  text: string,
  tokens: string[]
): React.ReactNode {
  const usable = tokens.filter((token) => token.length > 0);

  if (usable.length === 0) {
    return text;
  }

  const pattern = new RegExp(
    `(${usable.map(escapeRegExp).join("|")})`,
    "ig"
  );

  return text.split(pattern).map((part, index) =>
    usable.some(
      (token) => token.toLowerCase() === part.toLowerCase()
    ) ? (
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

function ResultIcon({ result }: { result: SearchResult }) {
  const [errored, setErrored] = useState(false);

  if (result.source === "tab") {
    if (result.icon && !errored) {
      return (
        <img
          src={result.icon}
          alt=""
          onError={() => setErrored(true)}
          className="h-5 w-5 rounded"
        />
      );
    }

    return <Globe size={18} className="text-neutral-400" />;
  }

  return (
    <span className="text-lg leading-none">
      {result.icon ?? "📁"}
    </span>
  );
}

export default function SearchResultCard({
  result,
  active = false,
  onHover,
}: Props) {
  const ref = useRef<HTMLButtonElement>(null);

  const primary =
    result.actions.find((action) => action.primary) ??
    result.actions[0];

  // Keep the keyboard-selected row in view.
  useEffect(() => {
    if (active && ref.current) {
      ref.current.scrollIntoView({ block: "nearest" });
    }
  }, [active]);

  async function handleClick() {
    await primary?.run();
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={handleClick}
      onMouseEnter={onHover}
      // Avoid stealing focus from the input (keeps the overlay open).
      onMouseDown={(e) => e.preventDefault()}
      className={[
        "flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all",
        active
          ? "border-neutral-300 bg-white shadow-sm"
          : "border-transparent bg-white hover:border-neutral-200",
      ].join(" ")}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100">
        <ResultIcon result={result} />
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-medium text-neutral-700">
          {highlight(result.title, result.highlights ?? [])}
        </h3>

        {result.subtitle && (
          <p className="mt-0.5 truncate text-xs text-neutral-500">
            {result.subtitle}
          </p>
        )}
      </div>

      {active ? (
        <span className="flex shrink-0 items-center gap-1 rounded-lg bg-neutral-900 px-2 py-1 text-[10px] font-medium text-white">
          <CornerDownLeft size={11} />
          {primary?.label ?? "Open"}
        </span>
      ) : (
        <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
          {result.source}
        </span>
      )}
    </button>
  );
}
