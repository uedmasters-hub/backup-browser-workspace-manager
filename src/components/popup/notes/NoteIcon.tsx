import { FileText } from "lucide-react";

import { LockBadge } from "./projects/ProjectIcon";

/** Neutral document tile for a note — the counterpart of ProjectIcon. */
export default function NoteIcon({ size = 36, locked = false }: { size?: number; locked?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="relative flex shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-400"
      style={{ width: size, height: size }}
    >
      <FileText size={Math.round(size * 0.45)} strokeWidth={2} />
      {locked && <LockBadge size={Math.max(14, Math.round(size * 0.42))} />}
    </span>
  );
}
