import type { ReactNode } from "react";

type DialogFooterProps = {
  left?: ReactNode;
  right?: ReactNode;
};

export default function DialogFooter({
  left,
  right,
}: DialogFooterProps) {
  if (!left && !right) {
    return null;
  }

  return (
    <footer className="flex items-center justify-between border-t border-neutral-100 px-6 py-4">
      <div className="flex items-center gap-3 text-xs text-neutral-500">
        {left}
      </div>

      <div className="flex items-center gap-2">
        {right}
      </div>
    </footer>
  );
}