import { Search, X } from "lucide-react";

type DialogSearchProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
};

export default function DialogSearch({
  value,
  onChange,
  placeholder = "Search...",
  autoFocus = false,
}: DialogSearchProps) {
  return (
    <div className="border-b border-neutral-100 p-4">
      <div className="flex items-center rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 transition-colors focus-within:border-neutral-400 focus-within:bg-white">
        <Search
          size={18}
          className="mr-3 shrink-0 text-neutral-400"
        />

        <input
          autoFocus={autoFocus}
          value={value}
          onChange={(e) =>
            onChange(e.target.value)
          }
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
        />

        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="ml-2 flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-700"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}