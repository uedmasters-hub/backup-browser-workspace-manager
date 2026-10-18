/**
 * Download one note as Word (.docx), Rich Text (.rtf) or plain text (.txt).
 * Loaded on demand from the note's ⋮ menu — none of this is needed until a
 * download is asked for.
 */
import { buildDocModel, embeddableImage, pageSetupFor } from "./docModel";
import { CHART_HEIGHT, CHART_WIDTH, chartSvg } from "./chart";
import { docToDocx } from "./docDocx";
import { docToRtf } from "./docRtf";
import { safeFileName } from "./projectExport";
import { noteToText } from "./serialize";

import type { DocImage } from "./docModel";
import type { Note } from "../../../types/notes";

/** Charts drawn as PNG (2× for sharp print), for Word / Rich Text. */
async function renderCharts(note: Note): Promise<Record<string, DocImage>> {
  const out: Record<string, DocImage> = {};
  for (const block of note.blocks) {
    if (block.type !== "chart") continue;
    const svg = chartSvg(block);
    if (!svg) continue;
    try {
      const sized = svg.replace('width="100%"', `width="${CHART_WIDTH}" height="${CHART_HEIGHT}"`);
      const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`;
      const img = new Image();
      img.src = url;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = CHART_WIDTH * 2;
      canvas.height = CHART_HEIGHT * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const picture = embeddableImage(canvas.toDataURL("image/png"), CHART_WIDTH * 1.4, CHART_HEIGHT * 1.4, block.title);
      if (picture) out[block.id] = picture;
    } catch {
      // The data table is written instead.
    }
  }
  return out;
}

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

/**
 * The file for a note (exactly what the editor shows — reveal a locked note
 * first). `pictures`: charts already drawn as images (else written as tables).
 */
export function noteFile(
  note: Note,
  format: NoteDownloadFormat,
  locale?: string,
  pictures?: Record<string, DocImage>
): { name: string; blob: Blob } {
  const name = `${safeFileName(note.title, "Untitled note")}.${format}`;
  if (format === "txt") return { name, blob: new Blob([noteToText(note)], { type: MIME.txt }) };

  const doc = buildDocModel(note, pictures);
  const page = pageSetupFor(locale);
  const data = format === "docx" ? docToDocx(doc, page) : docToRtf(doc, page);
  return { name, blob: new Blob([data as BlobPart], { type: MIME[format] }) };
}

export async function downloadNote(note: Note, format: NoteDownloadFormat): Promise<void> {
  const pictures = format === "txt" ? undefined : await renderCharts(note);
  const { name, blob } = noteFile(note, format, navigator.language, pictures);
  saveBlob(blob, name);
}
