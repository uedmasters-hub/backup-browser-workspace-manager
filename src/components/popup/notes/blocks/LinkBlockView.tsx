import { useEffect, useRef } from "react";
import { ExternalLink, Globe } from "lucide-react";

import BlockShell from "./BlockShell";
import { useCopy } from "../useCopy";
import { useNotesStore } from "../../../../stores/notesStore";
import type { LinkBlock } from "../../../../types/notes";

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export default function LinkBlockView({ block }: { block: LinkBlock }) {
  const updateBlock = useNotesStore((s) => s.updateBlock);
  const focusBlockId = useNotesStore((s) => s.focusBlockId);
  const consumeFocus = useNotesStore((s) => s.consumeFocus);
  const [copied, copy] = useCopy();

  const labelRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusBlockId === block.id) {
      labelRef.current?.focus();
      consumeFocus();
    }
  }, [focusBlockId, block.id, consumeFocus]);

  const host = hostOf(block.url);
  const ready = block.url.trim().length > 0;

  function open() {
    if (ready) {
      void chrome.tabs.create({ url: block.url, active: true });
    }
  }

  return (
    <BlockShell id={block.id} onCopy={() => copy(block.url)} copied={copied}>
      <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500">
          <Globe size={16} />
        </div>

        <div className="min-w-0 flex-1">
          <input
            ref={labelRef}
            value={block.label}
            placeholder="Label"
            onChange={(e) => updateBlock(block.id, { label: e.target.value })}
            className="w-full bg-transparent text-sm font-medium text-neutral-800 outline-none placeholder:text-neutral-300"
          />
          <input
            value={block.url}
            placeholder="https://"
            onChange={(e) => updateBlock(block.id, { url: e.target.value })}
            className="w-full bg-transparent text-xs text-neutral-400 outline-none placeholder:text-neutral-300"
          />
        </div>

        {ready && (
          <button
            type="button"
            onClick={open}
            aria-label={`Open ${host}`}
            className="shrink-0 rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-indigo-600"
          >
            <ExternalLink size={15} />
          </button>
        )}
      </div>
    </BlockShell>
  );
}
