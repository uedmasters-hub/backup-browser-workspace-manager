/**
 * Moving between a note's blocks — Tab / Shift+Tab, ↑ ↓ at a block's edge,
 * clicks on the "next line" under the note — so it reads like one document.
 *
 * Rich-text blocks register their editor here; other blocks are reached
 * through their fields (inputs) inside `[data-block-id]`.
 */
import { Selection, NodeSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import type { Editor } from "@tiptap/react";

import { useNotesStore } from "../../../stores/notesStore";
import { isBlockEmpty } from "./blockTypes";

import type { NoteBlock } from "../../../types/notes";

const editors = new Map<string, Editor>();

/** Returns the cleanup for the effect that registered it. */
export function registerEditor(blockId: string, editor: Editor): () => void {
  editors.set(blockId, editor);
  return () => {
    if (editors.get(blockId) === editor) editors.delete(blockId);
  };
}

export function editorFor(blockId: string): Editor | undefined {
  const ed = editors.get(blockId);
  return ed && !ed.isDestroyed ? ed : undefined;
}

function activeBlocks(): NoteBlock[] {
  const s = useNotesStore.getState();
  return s.notes.find((n) => n.id === s.activeNoteId)?.blocks ?? [];
}

/** Places you can type in a block (not its buttons or hidden toolbar). */
export const FIELD_SELECTOR =
  'input:not([type="hidden"]):not([type="file"]):not([disabled]),textarea:not([disabled]),[contenteditable="true"]';

export function blockFields(shell: Element): HTMLElement[] {
  return Array.from(shell.querySelectorAll<HTMLElement>(FIELD_SELECTOR)).filter(
    (el) => el.getClientRects().length > 0 && !el.closest("[data-nav-skip]")
  );
}

function placeCaret(el: HTMLElement, at: "start" | "end") {
  el.focus({ preventScroll: false });
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const n = at === "start" ? 0 : el.value.length;
    try {
      el.setSelectionRange(n, n);
    } catch {
      // some input types don't support selection ranges
    }
  }
}

/**
 * Focus now, not on the next frame (Tiptap's focus command waits a frame):
 * keys typed right after Enter / Tab must land in the new spot.
 */
export function focusEditor(ed: Editor, at: "start" | "end"): void {
  ed.commands.setTextSelection(at === "start" ? 0 : ed.state.doc.content.size);
  ed.view.focus();
  ed.commands.scrollIntoView();
}

/** Focus a block's first (or last) editable spot. False when it has none (a divider). */
export function focusBlockAt(id: string, at: "start" | "end"): boolean {
  const ed = editorFor(id);
  if (ed) {
    focusEditor(ed, at);
    return true;
  }
  const shell = document.querySelector(`[data-block-id="${CSS.escape(id)}"]`);
  if (!shell) return false;
  const fields = blockFields(shell);
  const field = at === "start" ? fields[0] : fields[fields.length - 1];
  if (!field) return false;
  placeCaret(field, at);
  field.scrollIntoView({ block: "nearest" });
  return true;
}

function focusTitle(): boolean {
  const title = document.querySelector<HTMLInputElement>('input[aria-label="Note title"]');
  if (!title) return false;
  placeCaret(title, "end");
  return true;
}

/**
 * Go to the block before / after `id`, skipping ones with nothing to type in.
 * Past the last block: the next line (when `createLine`); before the first:
 * the note's title.
 */
export function moveToBlock(id: string, dir: 1 | -1, createLine = false): boolean {
  const blocks = activeBlocks();
  let i = blocks.findIndex((b) => b.id === id);
  if (i < 0) return false;
  for (i += dir; i >= 0 && i < blocks.length; i += dir) {
    if (focusBlockAt(blocks[i].id, dir > 0 ? "start" : "end")) return true;
  }
  if (dir < 0) return focusTitle();
  if (createLine) {
    startNextLine();
    return true;
  }
  return false;
}

/**
 * The "next line" under the note: a new, separate Text block right below the
 * last one (or the empty one already there), with the caret in it. It takes
 * the place of the row that showed its hint, so nothing moves.
 */
export function startNextLine(): void {
  const store = useNotesStore.getState();
  const blocks = activeBlocks();
  const last = blocks[blocks.length - 1];
  if (last?.type === "text" && isBlockEmpty(last)) {
    if (!focusBlockAt(last.id, "end")) store.focusBlock(last.id, "end");
    return;
  }
  // No blank line left between the text above and the new section.
  const ed = last?.type === "text" ? editorFor(last.id) : undefined;
  if (ed) trimTrailingEmptyLines(ed);
  store.addBlock("text");
}

/**
 * Empty lines left at the end of an editor (e.g. after Enter, then clicking
 * away) are dropped, so the note doesn't grow a tail of blank lines and the
 * "next line" row sits right under the last line again.
 */
export function trimTrailingEmptyLines(ed: Editor): void {
  if (ed.isDestroyed) return;
  const { doc } = ed.state;
  let n = doc.childCount;
  let from = doc.content.size;
  while (n > 1) {
    const node = doc.child(n - 1);
    if (node.type.name !== "paragraph" || node.content.size > 0) break;
    from -= node.nodeSize;
    n -= 1;
  }
  if (from < doc.content.size) {
    ed.view.dispatch(ed.state.tr.delete(from, doc.content.size).setMeta("addToHistory", false));
  }
}

/** The caret can't go further up / down inside this editor. */
export function atEditorEdge(view: EditorView, dir: 1 | -1): boolean {
  const { selection, doc } = view.state;
  if (selection instanceof NodeSelection) {
    return dir > 0 ? selection.to >= doc.content.size : selection.from <= 0;
  }
  if (!selection.empty) return false;
  if (!view.endOfTextblock(dir > 0 ? "down" : "up")) return false;
  const edge = dir > 0 ? Selection.atEnd(doc) : Selection.atStart(doc);
  return selection.$head.parent === edge.$head.parent;
}

/**
 * Shared key handling for a rich-text block: Tab / Shift+Tab move between
 * blocks (indent / outdent inside lists, next / previous cell in tables),
 * ↑ on the first line and ↓ on the last move to the neighbouring block.
 * Returns true when the key was used.
 */
export function handleRichNavKey(event: KeyboardEvent, ed: Editor, blockId: string): boolean {
  if (event.altKey || event.metaKey || event.ctrlKey) return false;
  if (event.key === "Tab") {
    const back = event.shiftKey;
    if (ed.isActive("table")) {
      if (!back) return false; // the table's own Tab: next cell / new row
      if (!ed.commands.goToPreviousCell()) moveToBlock(blockId, -1);
      return true;
    }
    if (ed.isActive("listItem")) {
      if (back) ed.commands.liftListItem("listItem");
      else ed.commands.sinkListItem("listItem");
      return true; // never jump out of a list by accident
    }
    moveToBlock(blockId, back ? -1 : 1, !back);
    return true;
  }
  if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !event.shiftKey) {
    const dir = event.key === "ArrowDown" ? 1 : -1;
    if (atEditorEdge(ed.view, dir)) return moveToBlock(blockId, dir);
  }
  return false;
}
