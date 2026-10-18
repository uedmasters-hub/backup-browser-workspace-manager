import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useEditor } from "@tiptap/react";
import type { Editor, UseEditorOptions } from "@tiptap/react";
import { DOMParser as PMDOMParser } from "@tiptap/pm/model";

import { richExtensions, type RichVariant } from "./extensions";
import { cleanPastedHtml } from "../pasteCleanup";
import { docToPlainText, escapeHtml, pastedTextToHtml, type RichJSON, type RichPart } from "../richText";
import { toHref } from "../linkify";
import { openLinkInNewTab } from "../../../../browser/services/navigationService";
import { filesToImages, inlineForeignImages, insertImages, isImageFile } from "../images";

/** Fired on the editor's DOM to open the toolbar's link field (⌘K). */
export const LINK_EVENT = "bwm:edit-link";

const CLASSES: Record<RichVariant, string> = {
  full: "bwm-rich px-2 py-1.5 text-[15px] leading-relaxed text-neutral-800",
  callout: "bwm-rich w-full text-sm leading-relaxed text-neutral-700",
};

export function editorPart(editor: Editor): RichPart {
  if (editor.isEmpty) return { html: "", text: "" };
  return {
    html: editor.getHTML(),
    text: docToPlainText(editor.getJSON() as RichJSON),
  };
}

/** Clipboard HTML that points at pictures only the clipboard itself carries (Word, Outlook). */
function referencesLocalImages(html: string): boolean {
  return /<img[^>]+src=["']?(file:|blob:|cid:)/i.test(html) || /v:imagedata/i.test(html);
}

function htmlHasWords(html: string): boolean {
  if (!html) return false;
  return Boolean(new DOMParser().parseFromString(html, "text/html").body.textContent?.trim());
}

/** Pasted plain text (no HTML on the clipboard), parsed in an inert document. */
function plainSlice(text: string, plain: boolean, view: Editor["view"], $context: Parameters<NonNullable<Editor["view"]["props"]["clipboardTextParser"]>>[1]) {
  const html = plain
    ? text
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .filter((l) => l.trim())
        .map((l) => `<p>${escapeHtml(l.trim())}</p>`)
        .join("")
    : pastedTextToHtml(text);
  const body = new DOMParser().parseFromString(html, "text/html").body;
  return PMDOMParser.fromSchema(view.state.schema).parseSlice(body, {
    preserveWhitespace: false,
    context: $context,
  });
}

type Options = {
  variant: RichVariant;
  /** Stored HTML. Changes coming from outside (e.g. a split) are applied. */
  html: string;
  placeholder: string;
  autoFocus: boolean;
  /** Where the caret goes on auto-focus (default: end). */
  focusAt?: "start" | "end";
  onAutoFocused: () => void;
  onChange: (part: RichPart) => void;
  /** Return true to swallow the key (slash menu, Backspace on empty, …). */
  onKeyDown?: (event: KeyboardEvent, editor: Editor) => boolean;
  onSelectionChange?: (editor: Editor) => void;
  onBlur?: (editor: Editor) => void;
};

/**
 * One rich-text editor for a Text or Callout block.
 *
 * Note: Tiptap may replace the editor instance right after mounting (its
 * hook destroys an editor whose component didn't mount in time). Everything
 * that touches `editor.view` checks `editor.isDestroyed` first and re-runs
 * when the instance changes.
 *
 * Links: while you're not editing the block, a click opens the link in a new
 * tab (⌘/Ctrl-click: in the background). While editing, a click places the
 * caret and ⌘/Ctrl-click opens it. Middle-click always opens in background.
 */
export function useRichEditor(o: Options): Editor | null {
  const latest = useRef(o);
  useLayoutEffect(() => {
    latest.current = o;
  });
  const lastEmitted = useRef(o.html);
  const pendingOpen = useRef<{ href: string; background: boolean } | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const inlineTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Built once: callbacks read the latest props through refs. A stable options
  // object also stops Tiptap re-applying options on every keystroke.
  const [options] = useState<UseEditorOptions>(() => (
    {
      immediatelyRender: true,
      shouldRerenderOnTransaction: false,
      extensions: richExtensions(o.variant, o.placeholder),
      // Read when Tiptap builds the editor — including a rebuild after mount.
      get content() {
        return latest.current.html;
      },
      editorProps: {
        attributes: { class: CLASSES[o.variant], spellcheck: "true" },
        transformPastedHTML: cleanPastedHtml,
        // Pictures on the clipboard (screenshots, copied images, Word/Excel
        // charts). Text wins when there is any — e.g. Excel cells also put a
        // picture of themselves on the clipboard; the table is what you want.
        handlePaste(_view, event) {
          const ed = editorRef.current;
          const data = event.clipboardData;
          if (!ed || !data) return false;
          const files = Array.from(data.files).filter(isImageFile);
          if (!files.length) return false;
          if (o.variant !== "full") return false; // callouts keep text only
          const html = data.getData("text/html");
          const words = htmlHasWords(html) || Boolean(data.getData("text/plain").trim());
          if (!words) {
            event.preventDefault();
            void filesToImages(files).then((imgs) => insertImages(ed, imgs));
            return true;
          }
          if (referencesLocalImages(html)) {
            // The text pastes normally; its pictures follow it.
            setTimeout(() => void filesToImages(files).then((imgs) => insertImages(ed, imgs)), 0);
          }
          return false;
        },
        // Files dropped in: pictures go where they're dropped; anything else
        // is ignored (rather than the popup navigating away to the file).
        handleDrop(view, event, _slice, moved) {
          const ed = editorRef.current;
          const files = Array.from(event.dataTransfer?.files ?? []);
          if (moved || !ed || !files.length) return false;
          event.preventDefault();
          if (o.variant !== "full") return true;
          const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
          void filesToImages(files).then((imgs) => insertImages(ed, imgs, pos));
          return true;
        },
        clipboardTextParser(text, $context, plain, view) {
          return plainSlice(text, plain, view, $context);
        },
        handleKeyDown(view, event) {
          const ed = editorRef.current;
          if (!ed) return false;
          if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "k") {
            if (!view.state.selection.empty) {
              view.dom.dispatchEvent(new CustomEvent(LINK_EVENT));
              return true;
            }
          }
          return latest.current.onKeyDown?.(event, ed) ?? false;
        },
        handleDOMEvents: {
          mousedown(view, event) {
            const a = (event.target as HTMLElement | null)?.closest?.("a[href]");
            const href = a ? toHref(a.getAttribute("href") ?? "") : null;
            if (!href) return false;
            if (event.button === 1) {
              event.preventDefault(); // no autoscroll
              return true;
            }
            const modifier = event.metaKey || event.ctrlKey;
            if (event.button === 0 && (!view.hasFocus() || modifier)) {
              event.preventDefault(); // don't start editing
              pendingOpen.current = { href, background: modifier };
              return true;
            }
            return false;
          },
          click(_view, event) {
            const pending = pendingOpen.current;
            if (!pending) return false;
            pendingOpen.current = null;
            event.preventDefault();
            void openLinkInNewTab(pending.href, { background: pending.background });
            return true;
          },
          auxclick(_view, event) {
            if (event.button !== 1) return false;
            const a = (event.target as HTMLElement | null)?.closest?.("a[href]");
            const href = a ? toHref(a.getAttribute("href") ?? "") : null;
            if (!href) return false;
            event.preventDefault();
            void openLinkInNewTab(href, { background: true });
            return true;
          },
        },
      },
      onCreate({ editor: ed }) {
        if (o.variant === "full") inlineForeignImages(ed);
      },
      onUpdate({ editor: ed }) {
        if (o.variant === "full") {
          if (inlineTimer.current) clearTimeout(inlineTimer.current);
          inlineTimer.current = setTimeout(() => inlineForeignImages(ed), 300);
        }
        const part = editorPart(ed);
        lastEmitted.current = part.html;
        latest.current.onChange(part);
        latest.current.onSelectionChange?.(ed);
      },
      onSelectionUpdate({ editor: ed }) {
        latest.current.onSelectionChange?.(ed);
      },
      onBlur({ editor: ed }) {
        latest.current.onBlur?.(ed);
      },
    }
  ));

  const editor = useEditor(options, []);

  useLayoutEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Content changed from outside (split / merge / undo elsewhere).
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (o.html === lastEmitted.current) return;
    lastEmitted.current = o.html;
    if (o.html === editorPart(editor).html) return;
    editor.commands.setContent(o.html || "", { emitUpdate: false });
  }, [editor, o.html]);

  useEffect(() => {
    if (!editor || editor.isDestroyed || !o.autoFocus) return;
    const at = latest.current.focusAt ?? "end";
    // Focus right away (keys typed straight after Tab / Enter land here).
    editor.commands.setTextSelection(at === "start" ? 0 : editor.state.doc.content.size);
    editor.view.focus();
    editor.commands.scrollIntoView();
    latest.current.onAutoFocused();
  }, [editor, o.autoFocus]);

  return editor;
}
