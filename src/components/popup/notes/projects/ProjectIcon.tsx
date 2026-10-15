import { Folder, Lock } from "lucide-react";

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
      {locked && (
        <span
          className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-white text-amber-500 ring-2 ring-white"
          style={{ width: badge, height: badge }}
        >
          <Lock size={Math.round(badge * 0.62)} strokeWidth={2.6} />
        </span>
      )}
    </span>
  );
}
