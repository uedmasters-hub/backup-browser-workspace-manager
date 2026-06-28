import {
  ChevronDown,
  ChevronRight,
} from "lucide-react";

type Props = {
  count: number;

  expanded: boolean;

  onToggle: () => void;
};

export default function ArchivedHeader({
  count,
  expanded,
  onToggle,
}: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="
        flex
        w-full
        items-center
        justify-between
        rounded-xl
        px-2
        py-2
        transition-colors
        hover:bg-neutral-100
      "
    >
      <div className="flex items-center gap-2">
        {expanded ? (
          <ChevronDown
            size={18}
            className="text-neutral-500"
          />
        ) : (
          <ChevronRight
            size={18}
            className="text-neutral-500"
          />
        )}

        <span className="text-sm font-semibold text-neutral-800">
          Archived
        </span>
      </div>

      <span
        className="
          rounded-full
          bg-neutral-200
          px-2
          py-0.5
          text-xs
          font-medium
          text-neutral-700
        "
      >
        {count}
      </span>
    </button>
  );
}