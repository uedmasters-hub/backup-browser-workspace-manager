import SingleWindow from "./SingleWindow";
import TwoWindows from "./TwoWindows";
import ThreeWindows from "./ThreeWindows";
import FourWindows from "./FourWindows";
import OverflowWindows from "./OverflowWindows";
import type { WorkspaceWindow } from "../../../types/window";

type Props = {
  windows: WorkspaceWindow[];
};

export default function WindowGrid({ windows }: Props) {
  switch (windows.length) {
    case 1:
      return <SingleWindow windows={windows} />;

    case 2:
      return <TwoWindows windows={windows} />;

    case 3:
      return <ThreeWindows windows={windows} />;

    case 4:
      return <FourWindows windows={windows} />;

    default:
      return <OverflowWindows windows={windows} />;
  }
}