import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

type Props = {
  icon: ReactNode;
  label: string;
  subtitle?: string;
  danger?: boolean;
  disabled?: boolean;
  selected?: boolean;
  hasSubmenu?: boolean;
  onClick?: () => void;
};

export default function MenuItem({
  icon,
  label,
  subtitle,
  danger = false,
  disabled = false,
  selected = false,
  hasSubmenu = false,
  onClick,
}: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",

        disabled
          ? "cursor-not-allowed opacity-50"
          : "hover:bg-neutral-100",

        selected
          ? "bg-neutral-100"
          : "",

        danger
          ? "text-red-600"
          : "text-neutral-800",
      ].join(" ")}
    >
      {/* Icon */}

      <div className="flex h-5 w-5 shrink-0 items-center justify-center">
        {icon}
      </div>

      {/* Content */}

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">
          {label}
        </div>

        {subtitle && (
          <div className="mt-0.5 truncate text-xs text-neutral-500">
            {subtitle}
          </div>
        )}
      </div>

      {/* Selected */}

      {selected && (
        <div className="h-2 w-2 rounded-full bg-neutral-900" />
      )}

      {/* Submenu */}

      {hasSubmenu && (
        <ChevronRight
          size={16}
          className="text-neutral-400"
        />
      )}
    </button>
  );
}