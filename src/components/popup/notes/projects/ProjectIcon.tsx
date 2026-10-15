import { Folder, Lock } from "lucide-react";

/** Small amber lock on the corner of an icon tile — only for locked items. */
export function LockBadge({ size }: { size: number }) {
  return (
    <span
      aria-hidden="true"
      className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-white text-amber-500 ring-2 ring-white"
      style={{ width: size, height: size }}
    >
      <Lock size={Math.round(size * 0.62)} strokeWidth={2.6} />
    </span>
  );
}

/** Tinted folder tile in the project's colour; a small amber lock when locked. */
export default function ProjectIcon({
  color,
  size = 36,
  locked = false,
}: {
  color: string;
  size?: number;
  locked?: boolean;
}) {
  const badge = Math.max(14, Math.round(size * 0.42));
  return (
    <span
      aria-hidden="true"
      className="relative flex shrink-0 items-center justify-center rounded-xl"
      style={{ width: size, height: size, backgroundColor: `${color}1f`, color }}
    >
      <Folder size={Math.round(size * 0.47)} strokeWidth={2.2} fill={`${color}33`} />
      {locked && <LockBadge size={badge} />}
    </span>
  );
}
