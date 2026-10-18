/**
 * Download one note as Word (.docx), Rich Text (.rtf) or plain text (.txt).
 * Loaded on demand from the note's ⋮ menu — none of this is needed until a
 * download is asked for.
 */
import { buildDocModel, pageSetupFor } from "./docModel";
import { docToDocx } from "./docDocx";
import { docToRtf } from "./docRtf";
import { safeFileName } from "./projectExport";
import { noteToText } from "./serialize";

import type { Note } from "../../../types/notes";

export type NoteDownloadFormat = "docx" | "rtf" | "txt";

const MIME: Record<NoteDownloadFormat, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  rtf: "application/rtf",
  txt: "text/plain;charset=utf-8",
};

function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The file for a note (exactly what the editor shows — reveal a locked note first). */
export function noteFile(note: Note, format: NoteDownloadFormat, locale?: string): { name: string; blob: Blob } {
  const name = `${safeFileName(note.title, "Untitled note")}.${format}`;
  if (format === "txt") return { name, blob: new Blob([noteToText(note)], { type: MIME.txt }) };

  const doc = buildDocModel(note);
  const page = pageSetupFor(locale);
  const data = format === "docx" ? docToDocx(doc, page) : docToRtf(doc, page);
  return { name, blob: new Blob([data as BlobPart], { type: MIME[format] }) };
}

export function downloadNote(note: Note, format: NoteDownloadFormat): void {
  const { name, blob } = noteFile(note, format, navigator.language);
  saveBlob(blob, name);
}
