import { Extension, Mark } from "@tiptap/core";
import type { AnyExtension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { Placeholder } from "@tiptap/extensions";

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
 * "full": Text blocks — headings, lists, sizes, alignment, spacing, links.
 * "callout": Callouts — inline styles, lists and links (no headings/sizes).
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
      ? [TextAlign.configure({ types: ["heading", "paragraph"] }), FontSize, LineSpacing]
      : []),
    Placeholder.configure({
      placeholder: ({ editor, node, pos }) => {
        if (editor.isEmpty) return emptyPlaceholder;
        // A quiet hint on an empty top-level line of a Text block.
        if (!full || node.type.name !== "paragraph") return "";
        return editor.state.doc.resolve(pos).depth === 0 ? "Type “/” for blocks" : "";
      },
    }),
  ];
}
