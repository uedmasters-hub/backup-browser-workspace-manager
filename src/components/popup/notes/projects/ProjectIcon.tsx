import { Folder } from "lucide-react";

/** Tinted folder tile in the project's colour. */
export default function ProjectIcon({ color, size = 36 }: { color: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-xl"
      style={{ width: size, height: size, backgroundColor: `${color}1f`, color }}
    >
      <Folder size={Math.round(size * 0.47)} strokeWidth={2.2} fill={`${color}33`} />
    </span>
  );
}
