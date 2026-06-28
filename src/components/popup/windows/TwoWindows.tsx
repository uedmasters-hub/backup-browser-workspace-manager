import WindowCard from "../window-card/WindowCard";
import type { WorkspaceWindow } from "../../../types/window";

type Props = {
  windows: WorkspaceWindow[];
};

export default function TwoWindows({ windows }: Props) {
  return (
    <section className="grid grid-cols-2 gap-3 px-5 pt-2">
      {windows.map((window) => (
        <WindowCard
          key={window.id}
          window={window}
        />
      ))}
    </section>
  );
}