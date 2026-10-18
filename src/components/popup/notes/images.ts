/**
 * Pictures in notes: pasted, dropped or picked files — and images that
 * arrived as web addresses or SVG — become modest PNG/JPEG data: URLs kept
 * inside the note. That keeps them working offline, inside locked notes and
 * projects (they're encrypted with everything else), in backups and in
 * Word / Rich Text / ZIP downloads.
 */
import type { Editor } from "@tiptap/react";

/** Longest side, in CSS pixels — plenty for a note, small to store. */
const MAX_SIDE = 1600;
/** A PNG bigger than this is re-encoded as JPEG (screenshots stay PNG). */
const PNG_BUDGET = 700_000;
/** GIFs up to this size are kept as they are (animation survives). */
const GIF_KEEP = 1_500_000;
/** Remote images bigger than this aren't downloaded. */
const MAX_DOWNLOAD = 15_000_000;

/** Sources an image in a note may have: data: pictures, or a web address. */
export function isNoteImageSrc(src: string | null | undefined): boolean {
  if (!src) return false;
  return /^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,/i.test(src) || /^https?:\/\//i.test(src);
}

export interface NoteImageAttrs {
  src: string;
  alt: string | null;
  width: number;
  height: number;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("not an image"));
    img.src = url;
  });
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), type, quality)
  );
}

function altFrom(name: string | undefined): string | null {
  if (!name) return null;
  const base = name.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_-]+/g, " ").trim();
  // Generic clipboard names ("image", "image.png") say nothing.
  return base && !/^(image|img|screenshot|pasted|clipboard)\s*\d*$/i.test(base) ? base.slice(0, 120) : null;
}

/** Any picture → a PNG/JPEG data: URL no larger than MAX_SIDE. */
export async function blobToNoteImage(blob: Blob, name?: string): Promise<NoteImageAttrs> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    // SVGs without a size report 0 — give them a sensible canvas.
    const w0 = img.naturalWidth || 800;
    const h0 = img.naturalHeight || 600;
    const alt = altFrom(name);

    if (blob.type === "image/gif" && blob.size <= GIF_KEEP && Math.max(w0, h0) <= MAX_SIDE) {
      return { src: await blobToDataUrl(blob), alt, width: w0, height: h0 };
    }

    const scale = Math.min(1, MAX_SIDE / Math.max(w0, h0));
    const width = Math.max(1, Math.round(w0 * scale));
    const height = Math.max(1, Math.round(h0 * scale));
    const keepAsIs =
      scale === 1 &&
      ((blob.type === "image/png" && blob.size <= PNG_BUDGET) || (blob.type === "image/jpeg" && blob.size <= PNG_BUDGET));
    if (keepAsIs) return { src: await blobToDataUrl(blob), alt, width, height };

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.imageSmoothingQuality = "high";

    if (blob.type !== "image/jpeg") {
      ctx.drawImage(img, 0, 0, width, height);
      const png = await canvasBlob(canvas, "image/png");
      if (png.size <= PNG_BUDGET) return { src: await blobToDataUrl(png), alt, width, height };
    }
    // Photos (and PNGs too big to keep): JPEG on white.
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const jpeg = await canvasBlob(canvas, "image/jpeg", 0.85);
    return { src: await blobToDataUrl(jpeg), alt, width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

/** Image nodes for the files that are pictures (others are skipped). */
export async function filesToImages(files: File[]): Promise<NoteImageAttrs[]> {
  const out: NoteImageAttrs[] = [];
  for (const file of files.filter(isImageFile)) {
    try {
      out.push(await blobToNoteImage(file, file.name));
    } catch {
      // Not decodable (e.g. HEIC on some systems) — skip it.
    }
  }
  return out;
}

/** Insert pictures at `pos` (or the caret), each as its own block. */
export function insertImages(editor: Editor, images: NoteImageAttrs[], pos?: number): void {
  if (!images.length || editor.isDestroyed) return;
  const content = images.map((attrs) => ({ type: "image", attrs }));
  const chain = editor.chain().focus();
  (pos === undefined ? chain.insertContent(content) : chain.insertContentAt(pos, content)).run();
}

// ───────────── images that came in as addresses (pasted web content) ─────────────

const STORED = /^data:image\/(png|jpeg|gif);base64,/i;
const tried = new Set<string>();

async function fetchAsImage(src: string): Promise<NoteImageAttrs> {
  if (src.startsWith("data:")) {
    const blob = await (await fetch(src)).blob();
    return blobToNoteImage(blob);
  }
  const res = await fetch(src, { credentials: "omit", referrerPolicy: "no-referrer" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const size = Number(res.headers.get("content-length") ?? 0);
  if (size > MAX_DOWNLOAD) throw new Error("too large");
  const blob = await res.blob();
  if (!blob.type.startsWith("image/") || blob.size > MAX_DOWNLOAD) throw new Error("not an image");
  return blobToNoteImage(blob);
}

/**
 * Turn images held as web addresses or SVG/WebP data into stored PNG/JPEG,
 * in the background. If one can't be fetched, it simply stays a web image.
 */
export function inlineForeignImages(editor: Editor): void {
  if (editor.isDestroyed) return;
  const pending = new Set<string>();
  editor.state.doc.descendants((node) => {
    if (node.type.name !== "image") return;
    const src = String(node.attrs.src ?? "");
    if (src && !STORED.test(src) && !tried.has(src)) pending.add(src);
  });
  for (const src of pending) {
    tried.add(src);
    void fetchAsImage(src)
      .then((img) => {
        if (editor.isDestroyed) return;
        const tr = editor.state.tr;
        editor.state.doc.descendants((node, pos) => {
          if (node.type.name === "image" && node.attrs.src === src) {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              src: img.src,
              width: node.attrs.width ?? img.width,
              height: node.attrs.height ?? img.height,
            });
          }
        });
        if (tr.docChanged) editor.view.dispatch(tr.setMeta("addToHistory", false));
      })
      .catch(() => {
        // stays as it is
      });
  }
}
