import { Extension, Mark } from "@tiptap/core";
import type { AnyExtension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { Placeholder } from "@tiptap/extensions";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";

import { isNoteImageSrc } from "../images";

export const FONT_SIZES = ["small", "large", "huge"] as const;
export type FontSizeValue = (typeof FONT_SIZES)[number];

export const LINE_SPACINGS = ["compact", "relaxed", "double"] as const;
export type LineSpacingValue = (typeof LINE_SPACINGS)[number];

const isOneOf = <T extends string>(list: readonly T[], v: string | null): v is T =>
  v !== null && (list as readonly string[]).includes(v);

/**
 * Text size as a mark with a few presets. Only our own `data-size` is read
 * back, so text pasted from elsewhere comes in at the note's normal size.
 */
const FontSize = Mark.create({
  name: "fontSize",
  addAttributes() {
    return {
      size: {
        default: null,
        parseHTML: (el) => {
          const v = el.getAttribute("data-size");
          return isOneOf(FONT_SIZES, v) ? v : null;
        },
        renderHTML: (attrs) => (attrs.size ? { "data-size": attrs.size } : {}),
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: "span[data-size]",
        getAttrs: (el) => (isOneOf(FONT_SIZES, el.getAttribute("data-size")) ? null : false),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", HTMLAttributes, 0];
  },
});

/**
 * Line spacing per paragraph/heading. Like sizes, only our own presets are
 * read back — pasted line-heights are dropped.
 */
const LineSpacing = Extension.create({
  name: "lineSpacing",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          spacing: {
            default: null,
            parseHTML: (el) => {
              const v = el.getAttribute("data-spacing");
              return isOneOf(LINE_SPACINGS, v) ? v : null;
            },
            renderHTML: (attrs) =>
              attrs.spacing ? { "data-spacing": attrs.spacing } : {},
          },
        },
      },
    ];
  },
});

export type RichVariant = "full" | "callout";

/**
 * Pictures live in the note itself (shrunk data: URLs — see ../images.ts),
 * so they're saved, encrypted, backed up and exported with it. Only images
 * the editor can show safely are read back: data: PNG/JPEG/GIF/WebP/SVG or
 * an http(s) address (pasted from the web; inlined in the background).
 */
const NoteImage = Image.extend({
  draggable: true,
  parseHTML() {
    return [{ tag: "img[src]", getAttrs: (el) => (isNoteImageSrc(el.getAttribute("src")) ? null : false) }];
  },
}).configure({ inline: false, allowBase64: true });

/**
 * "full": Text blocks — headings, lists, sizes, alignment, spacing, links,
 * images and tables.
 * "callout": Callouts — inline styles, lists and links (no headings/sizes;
 * pasted tables keep their text, pictures are left out).
 */
export function richExtensions(
  variant: RichVariant,
  emptyPlaceholder: string
): AnyExtension[] {
  const full = variant === "full";
  return [
    StarterKit.configure({
      heading: full ? { levels: [1, 2, 3] } : false,
      codeBlock: full ? {} : false,
      blockquote: full ? {} : false,
      // A note already has a Divider block for this.
      horizontalRule: false,
      // It edits the document on load (adds a line after a final list), which
      // would mark a note as changed just by opening it. Enter on an empty
      // list item already leaves the list.
      trailingNode: false,
      link: {
        openOnClick: false, // clicks are handled by the block (new tab, ⌘-click)
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: "https",
        HTMLAttributes: { rel: "noopener noreferrer nofollow", target: null },
      },
    }),
    Highlight.configure({ multicolor: false }),
    ...(full
      ? [
          TextAlign.configure({ types: ["heading", "paragraph"] }),
          FontSize,
          LineSpacing,
          NoteImage,
          TableKit.configure({ table: { resizable: false, allowTableNodeSelection: true } }),
        ]
      : []),
    // Only an empty block shows a hint. New lines inside a block stay clean
    // while you write; the "next line" row under the note carries the
    // "/" hint instead (see NoteEditor).
    Placeholder.configure({
      placeholder: ({ editor }) => (editor.isEmpty ? emptyPlaceholder : ""),
    }),
  ];
}
