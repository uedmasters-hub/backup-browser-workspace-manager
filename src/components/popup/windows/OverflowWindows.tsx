import WindowCard from "../window-card/WindowCard";
import type { WorkspaceWindow } from "../../../types/window";

export default function OverflowWindows({
  windows,
}: {
  windows: WorkspaceWindow[];
}) {
  const visible = windows.slice(0, 3);
  const remaining = windows.length - 3;

  return (
    <div className="grid grid-cols-2 gap-3 px-5 pt-2">
      {visible.map((window) => (
        <WindowCard
          key={window.id}
          window={window}
        />
      ))}

      <div className="flex h-[128px] flex-col items-center justify-center rounded-[24px] bg-pink-200">
        <div className="text-5xl font-bold">+{remaining}</div>
        <div className="text-sm text-gray-600">Windows</div>
      </div>
    </div>
  );
}