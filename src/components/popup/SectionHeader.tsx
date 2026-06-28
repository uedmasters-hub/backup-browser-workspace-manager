import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowUpDown,
  Check,
} from "lucide-react";

import { useTabStore } from "../../stores/tabStore";
import {
  TAB_SORT_OPTIONS,
  type TabSortMode,
} from "../../stores/selectors/tabSelectors";

type Props = {
  title: string;
  sortMode: TabSortMode;
  onSortChange: (mode: TabSortMode) => void;
};

export default function SectionHeader({
  title,
  sortMode,
  onSortChange,
}: Props) {
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  const selectionMode = useTabStore(
    (state) => state.selectionMode
  );

  const selectedTabs = useTabStore(
    (state) => state.selectedTabs
  );

  const toggleSelectionMode = useTabStore(
    (state) => state.toggleSelectionMode
  );

  useEffect(() => {
    if (!sortOpen) {
      return;
    }

    function closeSort(event: MouseEvent) {
      if (
        sortRef.current &&
        !sortRef.current.contains(event.target as Node)
      ) {
        setSortOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSortOpen(false);
      }
    }

    document.addEventListener("mousedown", closeSort);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeSort);
      document.removeEventListener(
        "keydown",
        closeOnEscape
      );
    };
  }, [sortOpen]);

  return (
    <div className="relative z-10 flex items-center justify-between px-5 pt-6 pb-3">
      <h2 className="text-xl font-semibold">
        {selectionMode
          ? `${selectedTabs.length} Selected`
          : title}
      </h2>

      <div className="flex items-center gap-3">
        {!selectionMode && (
          <div ref={sortRef} className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={sortOpen}
              onClick={() => setSortOpen((open) => !open)}
              className={[
                "flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium transition-colors",
                sortOpen
                  ? "bg-neutral-200 text-neutral-900"
                  : "text-gray-500 hover:bg-neutral-100 hover:text-black",
              ].join(" ")}
            >
              <ArrowUpDown size={14} />
              Sort
            </button>

            {sortOpen && (
              <div
                role="menu"
                aria-label="Sort tabs"
                className="absolute right-0 top-full mt-2 w-44 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-xl"
              >
                {TAB_SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={sortMode === option.value}
                    onClick={() => {
                      onSortChange(option.value);
                      setSortOpen(false);
                    }}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-100"
                  >
                    {option.label}

                    {sortMode === option.value && (
                      <Check size={14} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={toggleSelectionMode}
          className="text-sm font-medium text-gray-500 hover:text-black"
        >
          {selectionMode
            ? "Cancel"
            : "Select"}
        </button>
      </div>
    </div>
  );
}
