import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  ChevronLeft,
  FolderInput,
  MoreVertical,
  File,
  FileText,
  FileType,
  Lock,
  LockOpen,
  Trash2,
} from "lucide-react";

import { useNotesStore } from "../../../stores/notesStore";
import { blockFields, editorFor, focusBlockAt, moveToBlock, startNextLine } from "./blockNav";
import { filesToImages, insertImages } from "./images";
import { NEXT_LINE_HINT } from "./rich/extensions";

import BlockRenderer from "./blocks/BlockRenderer";
import PinPrompt from "./PinPrompt";
import LockGate from "./LockGate";
import MoveToProjectMenu from "./projects/MoveToProjectMenu";
import DropdownMenu, { MenuCaption, MenuDivider, MenuRow } from "./menus/DropdownMenu";

import type { Note } from "../../../types/notes";
import type { NoteDownloadFormat } from "./noteDownload";

const DOWNLOADS: { format: NoteDownloadFormat; label: string; icon: ReactNode }[] = [
  { format: "docx", label: "Word document", icon: <FileText size={14} /> },
  { format: "rtf", label: "Rich text", icon: <FileType size={14} /> },
  { format: "txt", label: "Plain text", icon: <File size={14} /> },
];

export default function NoteEditor({ note }: { note: Note }) {
  const closeNote = useNotesStore((s) => s.closeNote);
  const deleteNote = useNotesStore((s) => s.deleteNote);
  const updateNoteTitle = useNotesStore((s) => s.updateNoteTitle);
  const ensureTrailingBlock = useNotesStore((s) => s.ensureTrailingBlock);
  const normalizeTextBlocks = useNotesStore((s) => s.normalizeTextBlocks);
  const lockNote = useNotesStore((s) => s.lockNote);
  const removeLock = useNotesStore((s) => s.removeLock);
  const revealNote = useNotesStore((s) => s.revealNote);
  const verifyNotePin = useNotesStore((s) => s.verifyNotePin);
  const revealedId = useNotesStore((s) => s.revealedId);

  const [mode, setMode] = useState<null | "lock">(null);
  const [moveAnchor, setMoveAnchor] = useState<DOMRect | null>(null);
  const [actionsAnchor, setActionsAnchor] = useState<DOMRect | null>(null);
  const project = useNotesStore((s) =>
    note.projectId ? s.projects.find((p) => p.id === note.projectId) : undefined
  );

  // The last block is a Text block with something in it: offer the "next
  // line" under it (a non-text last block already has an empty line after it).
  const last = note.blocks[note.blocks.length - 1];
  const showNextRow = last?.type === "text" && last.text.trim() !== "";

  const locked = Boolean(note.locked);
  const revealed = revealedId === note.id;
  const secured = locked && !revealed;

  // A note must have at least one block to type into (never for a
  // locked-and-hidden note — that would create plaintext blocks).
  useEffect(() => {
    if (!secured && note.blocks.length === 0) {
      ensureTrailingBlock();
    }
  }, [secured, note.blocks.length, ensureTrailingBlock]);

  // Older notes kept one line per Text block; join neighbours once on open so
  // formatting and selection work across lines.
  useEffect(() => {
    if (!secured) normalizeTextBlocks();
  }, [secured, note.id, normalizeTextBlocks]);

  function download(format: NoteDownloadFormat) {
    // Export code loads on demand — it's only needed for downloads.
    void import("./noteDownload").then(({ downloadNote }) => downloadNote(note, format));
  }

  /** A click on the empty page below the last block continues the note. */
  function onEmptyAreaMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const blocksEl = e.currentTarget.querySelector("[data-note-blocks]");
    const target = e.target as HTMLElement;
    if (target !== e.currentTarget && target !== blocksEl) return;
    const lastBlock = blocksEl?.lastElementChild;
    if (lastBlock && e.clientY < lastBlock.getBoundingClientRect().bottom) return;
    e.preventDefault();
    startNextLine();
  }

  /** Pictures dropped outside a text line are added at the end of the note. */
  function onDropFiles(e: React.DragEvent<HTMLDivElement>) {
    if (e.defaultPrevented || !e.dataTransfer.files.length) return;
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    startNextLine();
    // The new line may be a new Text block — wait for its editor.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const blocks = useNotesStore.getState().notes.find((n) => n.id === note.id)?.blocks ?? [];
        const lastBlock = blocks[blocks.length - 1];
        const ed = lastBlock ? editorFor(lastBlock.id) : undefined;
        if (ed) void filesToImages(files).then((imgs) => insertImages(ed, imgs));
      })
    );
  }

  /**
   * Tab / Shift+Tab, ↑ ↓ for blocks made of fields (checklist, link,
   * password, chart): to the next field in the block, then the next block.
   * Text blocks and callouts handle their own keys (see blockNav).
   */
  function onFieldNavKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey || e.nativeEvent.isComposing) return;
    const tab = e.key === "Tab";
    const vertical = (e.key === "ArrowDown" || e.key === "ArrowUp") && !e.shiftKey;
    if (!tab && !vertical) return;
    const target = e.target as HTMLElement;
    if (target.isContentEditable) return;
    if (vertical && !(target instanceof HTMLInputElement)) return;
    const shell = target.closest<HTMLElement>("[data-block-id]");
    const id = shell?.dataset.blockId;
    if (!shell || !id) return;
    const dir = tab ? (e.shiftKey ? -1 : 1) : e.key === "ArrowDown" ? 1 : -1;
    const fields = blockFields(shell);
    const i = fields.indexOf(target);
    const next = i >= 0 ? fields[i + dir] : undefined;
    e.preventDefault();
    if (next) {
      next.focus();
      return;
    }
    moveToBlock(id, dir, tab && dir > 0);
  }

  // ----- Locked & hidden: a gate. No content, no export, no plain delete. -----
  if (secured) {
    return (
      <LockGate
        title={note.title}
        subtitle="This note is encrypted. Enter your PIN to view, edit or export it."
        backLabel="Back to notes"
        onBack={() => void closeNote()}
        onUnlock={(pin) => revealNote(note.id, pin)}
        remove={{
          toggleLabel: "Delete this note",
          subtitle: "Enter your PIN to permanently delete this encrypted note.",
          confirmLabel: "Delete note",
          verify: (pin) => verifyNotePin(note.id, pin),
          onRemoved: () => deleteNote(note.id),
        }}
      />
    );
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-white">
      <div className="sticky top-0 z-10 shrink-0 bg-white px-3 pb-2 pt-4">
        {/* Row 1 — back · title · move to project · more */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void closeNote()}
            aria-label="Back to notes"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-neutral-100"
          >
            <ChevronLeft size={20} />
          </button>

          {locked && (
            <Lock
              size={13}
              className="ml-1 shrink-0 text-amber-500"
              aria-label="Locked and encrypted"
            />
          )}
          <input
            value={note.title}
            onChange={(e) => updateNoteTitle(note.id, e.target.value)}
            onKeyDown={(e) => {
              // Enter / ↓ / Tab from the title: into the note.
              const into = e.key === "Enter" || e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey);
              if (!into || e.nativeEvent.isComposing) return;
              const first = note.blocks.find((b) => focusBlockAt(b.id, "start"));
              if (first || note.blocks.length === 0) e.preventDefault();
              if (!first) startNextLine();
            }}
            placeholder="Untitled"
            aria-label="Note title"
            className="min-w-0 flex-1 bg-transparent px-1 text-base font-semibold text-neutral-900 outline-none placeholder:text-neutral-300"
          />

          <button
            type="button"
            onClick={(e) => setMoveAnchor(e.currentTarget.getBoundingClientRect())}
            aria-haspopup="menu"
            aria-expanded={Boolean(moveAnchor)}
            aria-label={project ? `Move to project (in ${project.name})` : "Move to project"}
            title={project ? `In ${project.name} · move` : "Move to project"}
            style={project ? { color: project.color } : undefined}
            className={[
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-neutral-100",
              project ? "" : "text-neutral-400 hover:text-neutral-700",
            ].join(" ")}
          >
            <FolderInput size={17} />
          </button>
          {moveAnchor && (
            <MoveToProjectMenu noteId={note.id} anchor={moveAnchor} onClose={() => setMoveAnchor(null)} />
          )}

          <button
            type="button"
            onClick={(e) => setActionsAnchor(e.currentTarget.getBoundingClientRect())}
            aria-label="More actions"
            title="More actions"
            aria-haspopup="menu"
            aria-expanded={Boolean(actionsAnchor)}
            className={[
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
              actionsAnchor
                ? "bg-neutral-100 text-neutral-800"
                : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700",
            ].join(" ")}
          >
            <MoreVertical size={17} />
          </button>
          {actionsAnchor && (
            <DropdownMenu anchor={actionsAnchor} onClose={() => setActionsAnchor(null)} label="Note actions" width={232}>
              <MenuRow
                icon={locked ? <Lock size={14} /> : <LockOpen size={14} />}
                tone={locked ? "warning" : "default"}
                label={locked ? "Remove lock" : "Lock note"}
                onSelect={() => {
                  setActionsAnchor(null);
                  if (locked) removeLock(note.id);
                  else setMode("lock");
                }}
              />
              <MenuDivider />
              <MenuCaption>Download as</MenuCaption>
              {DOWNLOADS.map((d) => (
                <MenuRow
                  key={d.format}
                  icon={d.icon}
                  label={d.label}
                  trailing={<span className="shrink-0 text-[11px] text-neutral-400">.{d.format}</span>}
                  onSelect={() => {
                    setActionsAnchor(null);
                    download(d.format);
                  }}
                />
              ))}
              <MenuDivider />
              <MenuRow
                icon={<Trash2 size={14} />}
                tone="danger"
                label="Delete note"
                onSelect={() => {
                  setActionsAnchor(null);
                  deleteNote(note.id);
                }}
              />
            </DropdownMenu>
          )}
        </div>

        {mode === "lock" && (
          <div className="mt-2 px-1">
            <PinPrompt
              title="Set a PIN to encrypt this note"
              confirmLabel="Lock"
              onCancel={() => setMode(null)}
              onSubmit={async (pin) => {
                await lockNote(note.id, pin);
                setMode(null);
                return true;
              }}
            />
          </div>
        )}
      </div>

      <div
        data-notes-scroll
        onMouseDown={onEmptyAreaMouseDown}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) e.preventDefault();
        }}
        onDrop={onDropFiles}
        className="min-h-0 flex-1 cursor-text overflow-y-auto overscroll-contain px-5 pb-6 pt-3"
      >
        <div
          data-note-blocks
          className="cursor-auto space-y-1.5 py-1"
          onBlur={(e) => {
            // Moving into the empty next line must not remove it.
            const to = e.relatedTarget as HTMLElement | null;
            ensureTrailingBlock(to?.closest<HTMLElement>("[data-block-id]")?.dataset.blockId);
          }}
          onKeyDown={onFieldNavKey}
        >
          {note.blocks.map((block) => (
            <BlockRenderer key={block.id} block={block} />
          ))}
          {showNextRow && (
            // The next section, drawn exactly like an empty Text block (same
            // spacing and hover), so clicking it turns it into one in place.
            <div
              className="bwm-next-row cursor-text rounded-xl px-1 py-0.5 transition-colors hover:bg-neutral-50"
              onMouseDown={(e) => {
                e.preventDefault();
                startNextLine();
              }}
            >
              <div className="select-none px-2 py-1.5 text-[15px] leading-relaxed text-neutral-300">{NEXT_LINE_HINT}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
