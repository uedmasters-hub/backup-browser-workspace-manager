/**
 * Floating quick notes — one or more small, draggable notes that live on the
 * page. Toggled from the popup. Each note has its own card; pressing ＋ spawns
 * a new card. Notes (text + position) are stored as an array in
 * chrome.storage.local and synced live across tabs.
 *
 * Self-contained vanilla DOM inside one shadow root (no React, no style bleed).
 */

import { buildNoteFromText } from "./quickNote";

const KEY_ENABLED = "floaterEnabled";
const KEY_FLOATERS = "floaterNotes";
const KEY_SAVED_NOTES = "workspaceNotes";

const WIDTH = 264;
const CARD_H = 230; // approx card height, kept fully on-screen when clamping

interface FloatNote {
  id: string;
  text: string;
  left: number;
  top: number;
}

interface CardRefs {
  el: HTMLDivElement;
  textarea: HTMLTextAreaElement;
  saveBtn: HTMLButtonElement;
  label: HTMLSpanElement;
  savedTimer?: number;
}

function labelFor(index: number): string {
  return index <= 0 ? "Quick note" : `Quick note ${index + 1}`;
}

const ICON_PLUS =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
const ICON_SAVE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>';
const ICON_CHECK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
const ICON_STACK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="3" width="13" height="13" rx="2"/><path d="M16 16v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h3"/></svg>';
const ICON_CLOSE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';

let host: HTMLDivElement | null = null;
let layer: HTMLDivElement | null = null;
let notes: FloatNote[] = [];
const cards = new Map<string, CardRefs>();

let typingId: string | null = null;
let draggingId: string | null = null;
let saveTimer: number | undefined;

function clamp(left: number, top: number): { left: number; top: number } {
  const maxLeft = Math.max(8, window.innerWidth - WIDTH - 8);
  const maxTop = Math.max(8, window.innerHeight - CARD_H - 8);
  return {
    left: Math.min(Math.max(8, left), maxLeft),
    top: Math.min(Math.max(8, top), maxTop),
  };
}

function defaultPosition(index: number): { left: number; top: number } {
  return clamp(
    window.innerWidth - WIDTH - 24 - index * 26,
    window.innerHeight - 280 + index * 26
  );
}

function newNote(index: number, near?: FloatNote): FloatNote {
  const pos = near
    ? clamp(near.left + 28, near.top + 28)
    : defaultPosition(index);
  return { id: crypto.randomUUID(), text: "", left: pos.left, top: pos.top };
}

function persistNotes() {
  if (saveTimer) {
    window.clearTimeout(saveTimer);
  }
  saveTimer = window.setTimeout(() => {
    void chrome.storage.local.set({ [KEY_FLOATERS]: notes });
  }, 200);
}

async function saveToNotes(text: string, title: string): Promise<boolean> {
  if (!text.trim()) {
    return false;
  }
  const stored = await chrome.storage.local.get(KEY_SAVED_NOTES);
  const saved = Array.isArray(stored[KEY_SAVED_NOTES])
    ? (stored[KEY_SAVED_NOTES] as unknown[])
    : [];
  saved.unshift(buildNoteFromText(text, title));
  await chrome.storage.local.set({ [KEY_SAVED_NOTES]: saved });
  return true;
}

function styleSheet(): HTMLStyleElement {
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    .layer {
      position: fixed; inset: 0; pointer-events: none;
      font-family: Inter, system-ui, -apple-system, sans-serif;
    }
    .card {
      position: absolute;
      width: ${WIDTH}px;
      pointer-events: auto;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 10px 34px rgba(15, 23, 42, 0.18),
        0 2px 8px rgba(15, 23, 42, 0.08);
      overflow: hidden;
      border: 1px solid rgba(15, 23, 42, 0.06);
    }
    .header {
      display: flex; align-items: center; gap: 3px;
      padding: 10px 6px 8px 12px; cursor: grab; user-select: none;
    }
    .header:active { cursor: grabbing; }
    .dot {
      width: 7px; height: 7px; border-radius: 9999px;
      background: #f59e0b; flex: 0 0 auto;
    }
    .label {
      font-size: 12.5px; font-weight: 600; color: #404040;
      flex: 1 1 auto; min-width: 0; letter-spacing: 0.01em;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .icon {
      width: 25px; height: 25px; border: none; background: transparent;
      color: #a3a3a3; border-radius: 8px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      padding: 0; flex: 0 0 auto;
      transition: background 0.15s, color 0.15s;
    }
    .icon:hover { background: #f5f5f5; color: #404040; }
    .icon svg { width: 15px; height: 15px; }
    .icon.save:hover { color: #059669; }
    .icon.saved { color: #059669; }
    textarea {
      display: block; width: 100%; box-sizing: border-box;
      min-height: 132px; max-height: 320px; resize: vertical;
      border: none; outline: none; padding: 2px 14px 14px 14px;
      font-size: 13px; line-height: 1.55; color: #171717;
      background: transparent; font-family: inherit;
    }
    textarea::placeholder { color: #cbcbcb; }
  `;
  return style;
}

function makeIcon(cls: string, title: string, svg: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = `icon ${cls}`.trim();
  btn.type = "button";
  btn.title = title;
  btn.setAttribute("aria-label", title);
  btn.innerHTML = svg;
  return btn;
}

function createCard(note: FloatNote): CardRefs {
  const el = document.createElement("div");
  el.className = "card";
  el.style.left = `${note.left}px`;
  el.style.top = `${note.top}px`;
  // Keep clicks inside the note from reaching the page.
  el.addEventListener("pointerdown", (e) => e.stopPropagation());
  el.addEventListener("mousedown", (e) => e.stopPropagation());
  el.addEventListener("click", (e) => e.stopPropagation());

  const header = document.createElement("div");
  header.className = "header";

  const dot = document.createElement("span");
  dot.className = "dot";

  const label = document.createElement("span");
  label.className = "label";
  label.textContent = "Quick note";

  const stackBtn = makeIcon("", "Stack notes by name", ICON_STACK);
  const newBtn = makeIcon("", "New note", ICON_PLUS);
  const saveBtn = makeIcon("save", "Save to Notes", ICON_SAVE);
  const close = makeIcon("close", "Hide this note", ICON_CLOSE);

  header.append(dot, label, stackBtn, newBtn, saveBtn, close);

  const ta = document.createElement("textarea");
  ta.placeholder = "Jot something down\u2026";
  ta.value = note.text;
  ta.spellcheck = false;
  ta.addEventListener("input", () => {
    typingId = note.id;
    const entry = notes.find((n) => n.id === note.id);
    if (entry) {
      entry.text = ta.value;
    }
    persistNotes();
  });
  ta.addEventListener("blur", () => {
    if (typingId === note.id) {
      typingId = null;
    }
  });
  [
    "keydown",
    "keyup",
    "keypress",
    "input",
    "beforeinput",
    "paste",
    "cut",
    "copy",
  ].forEach((type) =>
    ta.addEventListener(type, (e) => e.stopPropagation())
  );

  el.append(header, ta);

  const refs: CardRefs = { el, textarea: ta, saveBtn, label };

  stackBtn.addEventListener("click", () => {
    stackNotes();
  });

  newBtn.addEventListener("click", () => {
    void addNote(note.id);
  });

  close.addEventListener("click", () => {
    void removeNote(note.id);
  });

  saveBtn.addEventListener("click", async () => {
    const index = notes.findIndex((n) => n.id === note.id);
    const ok = await saveToNotes(ta.value, labelFor(index));
    if (!ok) {
      return;
    }
    saveBtn.innerHTML = ICON_CHECK;
    saveBtn.classList.add("saved");
    if (refs.savedTimer) {
      window.clearTimeout(refs.savedTimer);
    }
    refs.savedTimer = window.setTimeout(() => {
      saveBtn.innerHTML = ICON_SAVE;
      saveBtn.classList.remove("saved");
    }, 1400);
  });

  // Drag this card via its header.
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  const onMove = (e: PointerEvent) => {
    if (draggingId !== note.id) return;
    const next = clamp(startLeft + (e.clientX - startX), startTop + (e.clientY - startY));
    el.style.left = `${next.left}px`;
    el.style.top = `${next.top}px`;
  };
  const onUp = () => {
    if (draggingId !== note.id) return;
    draggingId = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    const entry = notes.find((n) => n.id === note.id);
    if (entry) {
      entry.left = parseFloat(el.style.left) || 0;
      entry.top = parseFloat(el.style.top) || 0;
      persistNotes();
    }
  };

  header.addEventListener("pointerdown", (e) => {
    if ((e.target as HTMLElement).closest(".icon")) return;
    draggingId = note.id;
    startX = e.clientX;
    startY = e.clientY;
    startLeft = parseFloat(el.style.left) || 0;
    startTop = parseFloat(el.style.top) || 0;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });

  return refs;
}

function render() {
  if (!layer) return;
  const ids = new Set(notes.map((n) => n.id));

  for (const [id, ref] of cards) {
    if (!ids.has(id)) {
      ref.el.remove();
      cards.delete(id);
    }
  }

  for (const note of notes) {
    let ref = cards.get(note.id);
    if (!ref) {
      ref = createCard(note);
      cards.set(note.id, ref);
      layer.appendChild(ref.el);
    }
    ref.label.textContent = labelFor(notes.indexOf(note));
    if (draggingId !== note.id) {
      const pos = clamp(note.left, note.top);
      ref.el.style.left = `${pos.left}px`;
      ref.el.style.top = `${pos.top}px`;
    }
    if (typingId !== note.id && ref.textarea.value !== note.text) {
      ref.textarea.value = note.text;
    }
  }
}

function stackNotes() {
  // Tidy every note into a neat cascade in name order (Quick note, 2, 3 ...).
  const baseLeft = 36;
  const baseTop = 72;
  const step = 30;
  notes.forEach((n, i) => {
    const pos = clamp(baseLeft + i * step, baseTop + i * step);
    n.left = pos.left;
    n.top = pos.top;
  });
  persistNotes();
  render();
}

async function addNote(nearId?: string) {
  const near = nearId ? notes.find((n) => n.id === nearId) : undefined;
  const note = newNote(notes.length, near);
  notes.push(note);
  persistNotes();
  render();
  cards.get(note.id)?.textarea.focus();
}

async function removeNote(id: string) {
  notes = notes.filter((n) => n.id !== id);
  if (notes.length === 0) {
    // No notes left → turn the whole feature off (popup toggle reflects it).
    await chrome.storage.local.set({ [KEY_FLOATERS]: [], [KEY_ENABLED]: false });
    return;
  }
  persistNotes();
  render();
}

async function mount() {
  if (host) return;

  const stored = await chrome.storage.local.get(KEY_FLOATERS);
  notes = Array.isArray(stored[KEY_FLOATERS])
    ? (stored[KEY_FLOATERS] as FloatNote[])
    : [];

  host = document.createElement("div");
  host.id = "bwm-note-floater";
  host.style.position = "fixed";
  host.style.inset = "0";
  host.style.zIndex = "2147483647";
  host.style.pointerEvents = "none";

  const shadow = host.attachShadow({ mode: "open" });
  layer = document.createElement("div");
  layer.className = "layer";
  shadow.append(styleSheet(), layer);

  document.documentElement.appendChild(host);
  render();
}

function unmount() {
  if (saveTimer) window.clearTimeout(saveTimer);
  cards.clear();
  host?.remove();
  host = null;
  layer = null;
  typingId = null;
  draggingId = null;
}

async function init() {
  if (window.top !== window.self) {
    return;
  }

  const { [KEY_ENABLED]: enabled } = await chrome.storage.local.get(
    KEY_ENABLED
  );
  if (enabled) {
    await mount();
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;

    if (KEY_ENABLED in changes) {
      if (changes[KEY_ENABLED].newValue) {
        void mount();
      } else {
        unmount();
      }
    }

    if (KEY_FLOATERS in changes && host) {
      const value = changes[KEY_FLOATERS].newValue;
      notes = Array.isArray(value) ? (value as FloatNote[]) : [];
      render();
    }
  });

  window.addEventListener("resize", () => {
    if (host) render();
  });
}

const floaterWindow = window as unknown as { __bwmFloaterInit?: boolean };
if (!floaterWindow.__bwmFloaterInit) {
  floaterWindow.__bwmFloaterInit = true;
  void init();
}
