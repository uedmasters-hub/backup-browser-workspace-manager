import TextBlockView from "./TextBlockView";
import ChecklistBlockView from "./ChecklistBlockView";
import LinkBlockView from "./LinkBlockView";
import CalloutBlockView from "./CalloutBlockView";
import DividerBlockView from "./DividerBlockView";
import PasswordBlockView from "./PasswordBlockView";

import type { NoteBlock } from "../../../../types/notes";

export default function BlockRenderer({ block }: { block: NoteBlock }) {
  switch (block.type) {
    case "text":
      return <TextBlockView block={block} />;
    case "checklist":
      return <ChecklistBlockView block={block} />;
    case "link":
      return <LinkBlockView block={block} />;
    case "callout":
      return <CalloutBlockView block={block} />;
    case "divider":
      return <DividerBlockView block={block} />;
    case "password":
      return <PasswordBlockView block={block} />;
  }
}
