import { useEffect, useState } from "react";
import type { RefObject } from "react";
import type { Editor } from "@tiptap/react";
import { Trash2 } from "lucide-react";

type Pos = { top: number; left: number };

/** Where the table with the caret sits, relative to `wrapper`. */
function tablePosition(editor: Editor, wrapper: HTMLElement): Pos | null {
  if (editor.isDestroyed || !editor.isFocused || !editor.isActive("table")) return null;
  const { node } = editor.view.domAtPos(editor.state.selection.from);
  const el = (node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement)?.closest("table");
  if (!el) return null;
  const t = el.getBoundingClientRect();
  const w = wrapper.getBoundingClientRect();
  return { top: t.top - w.top, left: Math.max(0, t.left - w.left) };
}

/**
 * A small bar above the table you're editing: add / remove rows and
 * columns, header row on/off, delete the table. Tab moves between cells
 * (and adds a row at the end).
 */
export default function TableControls({ editor, wrapper }: { editor: Editor; wrapper: RefObject<HTMLElement | null> }) {
  const [pos, setPos] = useState<Pos | null>(null);

  useEffect(() => {
    const update = () => {
      const el = wrapper.current;
      setPos(el ? tablePosition(editor, el) : null);
    };
    const hide = () => setPos(null);
    editor.on("selectionUpdate", update);
    editor.on("update", update);
    editor.on("focus", update);
    editor.on("blur", hide);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("update", update);
      editor.off("focus", update);
      editor.off("blur", hide);
    };
  }, [editor, wrapper]);

  if (!pos) return null;

  const run = (fn: () => boolean) => () => {
    fn();
    const el = wrapper.current;
    setPos(el ? tablePosition(editor, el) : null);
  };
  const btn =
    "rounded-md px-1.5 py-1 text-[11px] font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800";

  return (
    <div
      role="toolbar"
      aria-label="Table"
      data-nav-skip
      onMouseDown={(e) => e.preventDefault()}
      style={{ top: pos.top, left: pos.left }}
      className="bwm-toolbar-in absolute z-20 flex -translate-y-[calc(100%+4px)] items-center gap-0.5 whitespace-nowrap rounded-lg border border-neutral-200 bg-white p-0.5 shadow-sm"
    >
      <button type="button" className={btn} onClick={run(() => editor.chain().focus().addRowAfter().run())}>
        + Row
      </button>
      <button type="button" className={btn} onClick={run(() => editor.chain().focus().addColumnAfter().run())}>
        + Column
      </button>
      <span className="mx-0.5 h-4 w-px bg-neutral-200" />
      <button type="button" className={btn} onClick={run(() => editor.chain().focus().deleteRow().run())}>
        − Row
      </button>
      <button type="button" className={btn} onClick={run(() => editor.chain().focus().deleteColumn().run())}>
        − Column
      </button>
      <span className="mx-0.5 h-4 w-px bg-neutral-200" />
      <button
        type="button"
        aria-pressed={editor.isActive("tableHeader")}
        className={btn}
        title="Header row on / off"
        onClick={run(() => editor.chain().focus().toggleHeaderRow().run())}
      >
        Header
      </button>
      <button
        type="button"
        aria-label="Delete table"
        title="Delete table"
        className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-500"
        onClick={run(() => editor.chain().focus().deleteTable().run())}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}
