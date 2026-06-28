import WindowCard from "../window-card/WindowCard";
import type { WorkspaceWindow } from "../../../types/window";

type Props = {
  windows: WorkspaceWindow[];
};

export default function SingleWindow({
  windows,
}: Props) {
  if (!windows.length) {
    return null;
  }

  return (
    <section className="px-5 pt-2">
      <WindowCard
        window={windows[0]}
      />
    </section>
  );
}