import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

import BlockShell from "./BlockShell";
import AutoTextarea from "./AutoTextarea";
import { useCopy } from "../useCopy";
import { useEffect } from "react";

import { useNotesStore } from "../../../../stores/notesStore";
import type {
  CalloutBlock,
  CalloutTone,
} from "../../../../types/notes";

const TONES: Record<
  CalloutTone,
  { wrap: string; icon: string; Icon: typeof Info }
> = {
  info: {
    wrap: "border-indigo-100 bg-indigo-50/70",
    icon: "text-indigo-500",
    Icon: Info,
  },
  warn: {
    wrap: "border-amber-100 bg-amber-50/70",
    icon: "text-amber-500",
    Icon: AlertTriangle,
  },
  success: {
    wrap: "border-emerald-100 bg-emerald-50/70",
    icon: "text-emerald-500",
    Icon: CheckCircle2,
  },
};

const ORDER: CalloutTone[] = ["info", "warn", "success"];

export default function CalloutBlockView({
  block,
}: {
  block: CalloutBlock;
}) {
  const updateBlock = useNotesStore((s) => s.updateBlock);
  const focusBlockId = useNotesStore((s) => s.focusBlockId);
  const consumeFocus = useNotesStore((s) => s.consumeFocus);
  const [copied, copy] = useCopy();

  const autoFocus = focusBlockId === block.id;
  useEffect(() => {
    if (autoFocus) consumeFocus();
  }, [autoFocus, consumeFocus]);

  const tone = TONES[block.tone];
  const Icon = tone.Icon;

  function cycleTone() {
    const next = ORDER[(ORDER.indexOf(block.tone) + 1) % ORDER.length];
    updateBlock(block.id, { tone: next });
  }

  return (
    <BlockShell id={block.id} onCopy={() => copy(block.text)} copied={copied}>
      <div
        className={[
          "flex gap-3 rounded-xl border px-3 py-2.5 transition-colors",
          tone.wrap,
        ].join(" ")}
      >
        <button
          type="button"
          onClick={cycleTone}
          aria-label="Change callout tone"
          className={["mt-0.5 shrink-0", tone.icon].join(" ")}
        >
          <Icon size={16} />
        </button>
        <AutoTextarea
          value={block.text}
          onChange={(text) => updateBlock(block.id, { text })}
          placeholder="Callout…"
          autoFocus={autoFocus}
          className="text-sm leading-relaxed text-neutral-700"
        />
      </div>
    </BlockShell>
  );
}
