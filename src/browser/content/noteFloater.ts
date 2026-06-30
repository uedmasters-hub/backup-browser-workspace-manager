import { buildNoteFromText, type StoredNote } from "./quickNote";

/**
 * Floating quick note — a small, draggable note that lives on the page.
 * Toggled from the popup; content, position and enabled-state live in
 * chrome.storage.local so it's the same note across every tab.
 *
 * Self-contained vanilla DOM inside a shadow root (no React, no page-style
 * bleed in either direction).
 */

const KEY_ENABLED = "floaterEnabled";
const KEY_NOTE = "floaterNote";
const KEY_POS = "floaterPosition";
const KEY_NOTES = "workspaceNotes";

const WIDTH = 264;

interface Position {
  left: number;
  top: number;
}

async function saveQuickNoteToNotes(text: string): Promise<boolean> {
  if (!text.trim()) {
    return false;
  }
  const stored = await chrome.storage.local.get(KEY_NOTES);
  const notes = Array.isArray(stored[KEY_NOTES])
    ? (stored[KEY_NOTES] as StoredNote[])
    : [];
  notes.unshift(buildNoteFromText(text));
  await chrome.storage.local.set({ [KEY_NOTES]: notes });
  return true;
}

let host: HTMLDivElement | null = null;
let textarea: HTMLTextAreaElement | null = null;

let saveTimer: number | undefined;
let posTimer: number | undefined;
let typing = false;
let dragging = false;

function clampPosition(pos: Position): Position {
  const maxLeft = Math.max(8, window.innerWidth - WIDTH - 8);
  const maxTop = Math.max(8, window.innerHeight - 80);
  return {
    left: Math.min(Math.max(8, pos.left), maxLeft),
    top: Math.min(Math.max(8, pos.top), maxTop),
  };
}

function defaultPosition(): Position {
  return clampPosition({
    left: window.innerWidth - WIDTH - 24,
    top: window.innerHeight - 240,
  });
}

function applyPosition(pos: Position) {
  if (!host) return;
  host.style.left = `${pos.left}px`;
  host.style.top = `${pos.top}px`;
}

function persistNote(value: string) {
  if (saveTimer) {
    window.clearTimeout(saveTimer);
  }
  saveTimer = window.setTimeout(() => {
    void chrome.storage.local.set({ [KEY_NOTE]: value });
    typing = false;
  }, 250);
}

function persistPosition(pos: Position) {
  if (posTimer) {
    window.clearTimeout(posTimer);
  }
  posTimer = window.setTimeout(() => {
    void chrome.storage.local.set({ [KEY_POS]: pos });
  }, 150);
}

async function disableFloater() {
  await chrome.storage.local.set({ [KEY_ENABLED]: false });
}

function buildCard(initialNote: string): HTMLDivElement {
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    .wrap { font-family: Inter, system-ui, -apple-system, sans-serif; }
    .card {
      width: ${WIDTH}px;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 10px 34px rgba(15, 23, 42, 0.18),
        0 2px 8px rgba(15, 23, 42, 0.08);
      overflow: hidden;
      border: 1px solid rgba(15, 23, 42, 0.06);
    }
    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 10px 8px 12px;
      cursor: grab;
      user-select: none;
    }
    .header:active { cursor: grabbing; }
    .dot {
      width: 7px; height: 7px; border-radius: 9999px;
      background: #f59e0b;
      flex: 0 0 auto;
    }
    .label {
      font-size: 12px; font-weight: 600; color: #404040;
      flex: 1 1 auto; letter-spacing: 0.01em;
    }
    .close {
      width: 22px; height: 22px; border: none; background: transparent;
      color: #a3a3a3; border-radius: 7px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 15px; line-height: 1; padding: 0;
      transition: background 0.15s, color 0.15s;
    }
    .close:hover { background: #f5f5f5; color: #525252; }
    textarea {
      display: block;
      width: 100%;
      box-sizing: border-box;
      min-height: 132px;
      max-height: 320px;
      resize: vertical;
      border: none;
      outline: none;
      padding: 2px 14px 14px 14px;
      font-size: 13px;
      line-height: 1.55;
      color: #171717;
      background: transparent;
      font-family: inherit;
    }
    textarea::placeholder { color: #cbcbcb; }
    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 10px 10px 12px;
      border-top: 1px solid rgba(15, 23, 42, 0.06);
    }
    .ghost {
      border: none;
      background: transparent;
      color: #737373;
      font-size: 12px;
      font-weight: 500;
      font-family: inherit;
      cursor: pointer;
      padding: 6px 8px;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: background 0.15s, color 0.15s;
    }
    .ghost:hover { background: #f5f5f5; color: #404040; }
    .primary {
      border: none;
      background: #171717;
      color: #ffffff;
      font-size: 12px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      padding: 6px 12px;
      border-radius: 8px;
      transition: opacity 0.15s, background 0.15s;
    }
    .primary:hover { opacity: 0.9; }
    .primary.saved { background: #059669; }
  `;

  const cardEl = document.createElement("div");
  cardEl.className = "card";
  // Don't let the page react to clicks inside the note (focus stealing, etc.).
  cardEl.addEventListener("pointerdown", (e) => e.stopPropagation());
  cardEl.addEventListener("mousedown", (e) => e.stopPropagation());
  cardEl.addEventListener("click", (e) => e.stopPropagation());

  const header = document.createElement("div");
  header.className = "header";

  const dot = document.createElement("span");
  dot.className = "dot";

  const label = document.createElement("span");
  label.className = "label";
  label.textContent = "Quick note";

  const close = document.createElement("button");
  close.className = "close";
  close.setAttribute("aria-label", "Close floating note");
  close.title = "Hide floating note";
  close.textContent = "\u2715";
  close.addEventListener("click", () => {
    void disableFloater();
  });

  header.append(dot, label, close);

  const ta = document.createElement("textarea");
  ta.placeholder = "Jot something down\u2026";
  ta.value = initialNote;
  ta.spellcheck = false;
  ta.addEventListener("input", () => {
    typing = true;
    persistNote(ta.value);
  });
  ta.addEventListener("blur", () => {
    typing = false;
  });
  // Keep all keyboard/clipboard activity inside the note: many sites have a
  // global "type anywhere to focus the chat box" handler that would otherwise
  // steal our keystrokes and focus.
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
  textarea = ta;

  cardEl.append(header, ta);

  const footer = document.createElement("div");
  footer.className = "footer";

  const newBtn = document.createElement("button");
  newBtn.className = "ghost";
  newBtn.type = "button";
  newBtn.title = "Clear and start a new note";
  newBtn.textContent = "\uFF0B New";
  newBtn.addEventListener("click", () => {
    ta.value = "";
    typing = false;
    void chrome.storage.local.set({ [KEY_NOTE]: "" });
    ta.focus();
  });

  const saveBtn = document.createElement("button");
  saveBtn.className = "primary";
  saveBtn.type = "button";
  saveBtn.title = "Save this note to your Notes";
  saveBtn.textContent = "Save";
  let savedTimer: number | undefined;
  saveBtn.addEventListener("click", async () => {
    const ok = await saveQuickNoteToNotes(ta.value);
    if (!ok) {
      return;
    }
    saveBtn.textContent = "Saved \u2713";
    saveBtn.classList.add("saved");
    if (savedTimer) {
      window.clearTimeout(savedTimer);
    }
    savedTimer = window.setTimeout(() => {
      saveBtn.textContent = "Save";
      saveBtn.classList.remove("saved");
    }, 1400);
  });

  footer.append(newBtn, saveBtn);
  cardEl.append(footer);

  // Dragging via the header.
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  const onMove = (e: PointerEvent) => {
    if (!dragging || !host) return;
    const next = clampPosition({
      left: startLeft + (e.clientX - startX),
      top: startTop + (e.clientY - startY),
    });
    applyPosition(next);
  };
  const onUp = () => {
    if (!dragging || !host) return;
    dragging = false;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    persistPosition({
      left: parseFloat(host.style.left) || 0,
      top: parseFloat(host.style.top) || 0,
    });
  };

  header.addEventListener("pointerdown", (e) => {
    if ((e.target as HTMLElement).closest(".close")) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startLeft = host ? parseFloat(host.style.left) || 0 : 0;
    startTop = host ? parseFloat(host.style.top) || 0 : 0;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });

  const wrap = document.createElement("div");
  wrap.className = "wrap";
  wrap.append(style, cardEl);
  // style + card go into the shadow root
  const container = document.createElement("div");
  container.appendChild(wrap);
  return container;
}

async function mount() {
  if (host) return;

  const stored = await chrome.storage.local.get([KEY_NOTE, KEY_POS]);
  const note = typeof stored[KEY_NOTE] === "string" ? stored[KEY_NOTE] : "";
  const pos = (stored[KEY_POS] as Position | undefined) ?? defaultPosition();

  host = document.createElement("div");
  host.id = "bwm-note-floater";
  host.style.position = "fixed";
  host.style.zIndex = "2147483647";
  host.style.width = `${WIDTH}px`;
  applyPosition(clampPosition(pos));

  const shadow = host.attachShadow({ mode: "open" });
  shadow.appendChild(buildCard(note));

  document.documentElement.appendChild(host);
}

function unmount() {
  if (saveTimer) window.clearTimeout(saveTimer);
  if (posTimer) window.clearTimeout(posTimer);
  host?.remove();
  host = null;
  textarea = null;
}

async function init() {
  if (window.top !== window.self) {
    // Top frame only.
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

    if (KEY_NOTE in changes && textarea && !typing) {
      const value = changes[KEY_NOTE].newValue;
      textarea.value = typeof value === "string" ? value : "";
    }

    if (KEY_POS in changes && host && !dragging) {
      const p = changes[KEY_POS].newValue as Position | undefined;
      if (p) applyPosition(clampPosition(p));
    }
  });

  window.addEventListener("resize", () => {
    if (!host) return;
    applyPosition(
      clampPosition({
        left: parseFloat(host.style.left) || 0,
        top: parseFloat(host.style.top) || 0,
      })
    );
  });
}

const floaterWindow = window as unknown as { __bwmFloaterInit?: boolean };
if (!floaterWindow.__bwmFloaterInit) {
  floaterWindow.__bwmFloaterInit = true;
  void init();
}
