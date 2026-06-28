import { ArrowUpRight, MoreVertical } from "lucide-react";
import type { WorkspaceWindow } from "../../types/window";

type Props = {
  window: WorkspaceWindow;
};

export default function FeaturedWindowCard({ window }: Props) {
  return (
    <div
      className="relative h-[170px] overflow-hidden rounded-[24px] px-5 py-6"
      style={{ backgroundColor: window.color }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-neutral-800">
          {window.name}
        </h3>

        <button>
          <MoreVertical size={18} strokeWidth={2.3} />
        </button>
      </div>

      <div className="mt-5 flex items-center justify-between gap-4">
        <h2 className="text-[54px] font-bold leading-none">
          {window.tabCount}
        </h2>

        {window.coverImage && (
          <img
            src={window.coverImage}
            alt={window.name}
            className="h-[92px] w-[170px] rounded-2xl object-cover"
          />
        )}

        <button className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-md">
          <ArrowUpRight size={18} />
        </button>
      </div>
    </div>
  );
}