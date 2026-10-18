import { useEffect } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { EditorContent } from "@tiptap/react";

import BlockShell from "./BlockShell";
import FormatToolbar from "../rich/FormatToolbar";
import { useRichEditor } from "../rich/useRichEditor";
import { useCopy } from "../useCopy";
import { isBlockEmpty } from "../blockTypes";
import { blockHtml } from "../richText";
import { handleRichNavKey, registerEditor } from "../blockNav";

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
  const transformBlock = useNotesStore((s) => s.transformBlock);
  const focusBlockId = useNotesStore((s) => s.focusBlockId);
  const focusAt = useNotesStore((s) => s.focusAt);
  const consumeFocus = useNotesStore((s) => s.consumeFocus);
  const [copied, copy] = useCopy();

  const editor = useRichEditor({
    variant: "callout",
    html: blockHtml(block),
    placeholder: "Callout…",
    autoFocus: focusBlockId === block.id,
    focusAt,
    onAutoFocused: consumeFocus,
    onChange: (part) => updateBlock(block.id, part),
    onKeyDown: (event, ed) => {
      if (handleRichNavKey(event, ed, block.id)) return true;
      // Backspace in an empty callout turns it back into a plain line.
      if (event.key === "Backspace" && ed.isEmpty) {
        transformBlock(block.id, "text");
        return true;
      }
      return false;
    },
  });

  const tone = TONES[block.tone];
  const Icon = tone.Icon;

  function cycleTone() {
    const next = ORDER[(ORDER.indexOf(block.tone) + 1) % ORDER.length];
    updateBlock(block.id, { tone: next });
  }

  useEffect(() => (editor ? registerEditor(block.id, editor) : undefined), [editor, block.id]);

  if (!editor) return null;

  return (
    <BlockShell
      id={block.id}
      onCopy={() => copy(block.text, block.html)}
      copied={copied}
      empty={isBlockEmpty(block)}
    >
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
        <div className="min-w-0 flex-1">
          <EditorContent editor={editor} />
          <FormatToolbar editor={editor} variant="callout" suppress={() => false} />
        </div>
      </div>
    </BlockShell>
  );
}
