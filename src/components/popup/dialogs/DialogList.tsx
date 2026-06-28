import type { ReactNode } from "react";

type DialogListProps = {
  children: ReactNode;
  emptyState?: ReactNode;
  isEmpty?: boolean;
  className?: string;
};

export default function DialogList({
  children,
  emptyState,
  isEmpty = false,
  className = "",
}: DialogListProps) {
  return (
    <div
      className={[
        "max-h-[360px] overflow-y-auto",
        "divide-y divide-neutral-100",
        className,
      ].join(" ")}
    >
      {isEmpty
        ? emptyState ?? (
            <div className="px-6 py-12 text-center text-sm text-neutral-500">
              Nothing found.
            </div>
          )
        : children}
    </div>
  );
}