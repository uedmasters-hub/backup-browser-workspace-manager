import type { MouseEvent } from "react";

import { ArrowUpRight } from "lucide-react";

type Props = {
  tabCount: number;

  onFocus: (
    e: MouseEvent<HTMLButtonElement>
  ) => void | Promise<void>;
};

export default function WindowCardFooter({
  tabCount,
  onFocus,
}: Props) {
  return (
    <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
      <h2 className="text-[48px] font-bold leading-none text-neutral-900">
        {tabCount}
      </h2>

      <button
        type="button"
        onClick={onFocus}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md transition-all duration-200 hover:scale-105 hover:shadow-lg active:scale-95"
      >
        <ArrowUpRight size={18} />
      </button>
    </div>
  );
}