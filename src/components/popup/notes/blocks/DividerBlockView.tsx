import BlockShell from "./BlockShell";
import type { DividerBlock } from "../../../../types/notes";

export default function DividerBlockView({
  block,
}: {
  block: DividerBlock;
}) {
  return (
    <BlockShell id={block.id} bare>
      <div className="py-3">
        <div className="h-px bg-neutral-200" />
      </div>
    </BlockShell>
  );
}
