import { Check, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

type DialogItemProps = {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  selected?: boolean;
  onClick: () => void;
};

export default function DialogItem({
  title,
  subtitle,
  leading,
  trailing,
  selected = false,
  onClick,
}: DialogItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full items-center gap-4 px-5 py-4 text-left transition-colors",
        "hover:bg-neutral-50",
        selected ? "bg-neutral-100" : "",
      ].join(" ")}
    >
      {/* Leading */}

      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100">
        {leading}
      </div>

      {/* Content */}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-neutral-900">
          {title}
        </p>

        {subtitle && (
          <p className="mt-0.5 truncate text-xs text-neutral-500">
            {subtitle}
          </p>
        )}
      </div>

      {/* Trailing */}

      {selected ? (
        <Check
          size={18}
          className="text-green-600"
        />
      ) : trailing ? (
        trailing
      ) : (
        <ChevronRight
          size={16}
          className="text-neutral-300"
        />
      )}
    </button>
  );
}