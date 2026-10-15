import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { NodeSelection } from "@tiptap/pm/state";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  ChevronDown,
  CornerDownLeft,
  Highlighter,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  RemoveFormatting,
  Strikethrough,
  Underline,
} from "lucide-react";

import { LINK_EVENT } from "./useRichEditor";
import type { FontSizeValue, LineSpacingValue, RichVariant } from "./extensions";
import { toHref } from "../linkify";

const MOD = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl+";
const PLUGIN_KEY = "formatToolbar";

const ALIGN_ICONS = { left: AlignLeft, center: AlignCenter, right: AlignRight, justify: AlignJustify } as const;
type Align = keyof typeof ALIGN_ICONS;

const SIZES: { value: FontSizeValue | null; label: string; px: number }[] = [
  { value: "small", label: "Small", px: 11 },
  { value: null, label: "Default", px: 14 },
  { value: "large", label: "Large", px: 17 },
  { value: "huge", label: "Huge", px: 21 },
];

const SPACINGS: { value: LineSpacingValue | null; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: null, label: "Normal" },
  { value: "relaxed", label: "Relaxed" },
  { value: "double", label: "Double" },
];

const STYLES = [
  { level: 0, label: "Normal text", className: "text-sm" },
  { level: 1, label: "Heading 1", className: "text-lg font-semibold" },
  { level: 2, label: "Heading 2", className: "text-base font-semibold" },
  { level: 3, label: "Heading 3", className: "text-sm font-semibold" },
] as const;

function Btn({
  label,
  shortcut,
  active = false,
  onClick,
  children,
  wide = false,
  expanded,
}: {
  label: string;
  shortcut?: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  wide?: boolean;
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-pressed={expanded === undefined ? active : undefined}
      aria-expanded={expanded}
      aria-haspopup={expanded === undefined ? undefined : "menu"}
      onMouseDown={(e) => e.preventDefault()} // keep the selection
      onClick={onClick}
      className={[
        "flex h-7 shrink-0 items-center justify-center rounded-lg transition-colors",
        wide ? "gap-0.5 px-1.5" : "w-7",
        active || expanded
          ? "bg-indigo-50 text-indigo-600"
          : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

const Sep = () => <span aria-hidden="true" className="mx-0.5 h-5 w-px shrink-0 bg-neutral-200" />;

function MenuItem({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-neutral-800 transition-colors hover:bg-neutral-100"
    >
      <span className="min-w-0 flex-1">{children}</span>
      {selected && <Check size={14} className="shrink-0 text-indigo-600" />}
    </button>
  );
}

/**
 * Formatting toolbar that floats over the selected text — hidden until
 * something is selected, gone as soon as the selection is.
 */
export default function FormatToolbar({
  editor,
  variant,
  suppress,
}: {
  editor: Editor;
  variant: RichVariant;
  /** True while something else (the slash menu) owns the keyboard. */
  suppress: () => boolean;
}) {
  const full = variant === "full";
  const [menu, setMenu] = useState<null | "style" | "paragraph">(null);
  const [linkMode, setLinkMode] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState(false);
  const linkModeRef = useRef(false);
  const [scrollTarget, setScrollTarget] = useState<HTMLElement | null>(null);

  // The editor is attached to the page after first render — look up the
  // note's scroll area on the next frame (the toolbar follows its scrolling).
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (!editor.isDestroyed) {
        setScrollTarget(editor.view.dom.closest<HTMLElement>("[data-notes-scroll]"));
      }
    });
    return () => cancelAnimationFrame(id);
  }, [editor]);

  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      highlight: e.isActive("highlight"),
      link: e.isActive("link"),
      href: (e.getAttributes("link").href as string | undefined) ?? "",
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      heading: ([1, 2, 3] as const).find((level) => e.isActive("heading", { level })) ?? 0,
      size: (e.getAttributes("fontSize").size as FontSizeValue | undefined) ?? null,
      align: ((["center", "right", "justify"] as const).find((a) => e.isActive({ textAlign: a })) ?? "left") as Align,
      spacing:
        ((e.getAttributes("paragraph").spacing ?? e.getAttributes("heading").spacing) as LineSpacingValue | undefined) ??
        null,
    }),
  });

  const setLink = (on: boolean) => {
    linkModeRef.current = on;
    setLinkMode(on);
  };

  const openLink = useCallback(() => {
    if (editor.isDestroyed) return;
    setMenu(null);
    setLinkValue((editor.getAttributes("link").href as string | undefined) ?? "");
    setLinkError(false);
    linkModeRef.current = true;
    setLinkMode(true);
    editor.view.dispatch(editor.state.tr.setMeta(PLUGIN_KEY, "show"));
  }, [editor]);

  // ⌘K from the editor.
  useEffect(() => {
    // The editor can be replaced right after mounting (see useRichEditor).
    if (editor.isDestroyed) return;
    const dom = editor.view.dom;
    dom.addEventListener(LINK_EVENT, openLink);
    return () => dom.removeEventListener(LINK_EVENT, openLink);
  }, [editor, openLink]);

  const run = (fn: (c: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) => {
    fn(editor.chain().focus()).run();
  };

  const closeLink = (refocus: boolean) => {
    setLink(false);
    setLinkError(false);
    if (refocus) editor.commands.focus();
    else editor.view.dispatch(editor.state.tr.setMeta(PLUGIN_KEY, "hide"));
  };

  const applyLink = () => {
    const raw = linkValue.trim();
    if (!raw) {
      run((c) => c.extendMarkRange("link").unsetLink());
      closeLink(true);
      return;
    }
    const href = toHref(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    if (!href) {
      setLinkError(true);
      return;
    }
    setLink(false);
    run((c) => c.extendMarkRange("link").setLink({ href }));
  };

  const clearAll = () =>
    run((c) => {
      let chain = c.unsetAllMarks().clearNodes();
      if (full) chain = chain.unsetTextAlign().updateAttributes("paragraph", { spacing: null });
      return chain;
    });

  const setSpacing = (spacing: LineSpacingValue | null) =>
    run((c) => c.updateAttributes("paragraph", { spacing }).updateAttributes("heading", { spacing }));

  const AlignIcon = ALIGN_ICONS[s.align];
  const styleLabel = s.heading ? `H${s.heading}` : "Text";

  if (!scrollTarget || editor.isDestroyed) return null;

  return (
    <BubbleMenu
      editor={editor}
      pluginKey={PLUGIN_KEY}
      updateDelay={120}
      appendTo={() => document.body}
      shouldShow={({ state, from, to, view }) => {
        if (linkModeRef.current) return true;
        if (suppress() || !editor.isEditable || !view.hasFocus()) return false;
        if (state.selection.empty || state.selection instanceof NodeSelection) return false;
        return state.doc.textBetween(from, to, " ").trim().length > 0;
      }}
      options={{
        strategy: "fixed",
        placement: "top",
        offset: 8,
        flip: { padding: 8 },
        shift: { padding: 8 },
        scrollTarget,
        onHide: () => {
          setMenu(null);
          if (linkModeRef.current) setLink(false);
        },
      }}
      className="z-[60]"
    >
      <div
        role="toolbar"
        aria-label="Text formatting"
        className="bwm-toolbar-in relative flex items-center gap-0.5 rounded-xl border border-neutral-200 bg-white p-1 text-[13px] shadow-[0_8px_24px_-6px_rgba(15,23,42,0.22)]"
      >
        {linkMode ? (
          <div className="flex items-center gap-1 px-1">
            <Link2 size={15} className="shrink-0 text-neutral-400" />
            <input
              autoFocus
              value={linkValue}
              onChange={(e) => {
                setLinkValue(e.target.value);
                setLinkError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyLink();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  closeLink(true);
                }
              }}
              onBlur={(e) => {
                if (!e.currentTarget.closest('[role="toolbar"]')?.contains(e.relatedTarget as Node)) {
                  closeLink(false);
                }
              }}
              placeholder="Paste or type a link"
              aria-label="Link address"
              aria-invalid={linkError}
              className={[
                "h-7 w-[220px] rounded-lg bg-neutral-50 px-2 text-[13px] text-neutral-800 outline-none ring-1 placeholder:text-neutral-400",
                linkError ? "ring-red-300" : "ring-transparent focus:ring-indigo-200",
              ].join(" ")}
            />
            <Btn label="Apply link" onClick={applyLink}>
              <CornerDownLeft size={15} />
            </Btn>
            {s.link && (
              <Btn
                label="Remove link"
                onClick={() => {
                  setLink(false);
                  run((c) => c.extendMarkRange("link").unsetLink());
                }}
              >
                <Link2Off size={15} />
              </Btn>
            )}
          </div>
        ) : (
          <>
            {full && (
              <>
                <Btn
                  label="Text style and size"
                  wide
                  expanded={menu === "style"}
                  onClick={() => setMenu(menu === "style" ? null : "style")}
                >
                  <span className="min-w-[26px] text-left text-[12.5px] font-medium">{styleLabel}</span>
                  <ChevronDown size={13} />
                </Btn>
                <Sep />
              </>
            )}
            <Btn label="Bold" shortcut={`${MOD}B`} active={s.bold} onClick={() => run((c) => c.toggleBold())}>
              <Bold size={15} strokeWidth={2.5} />
            </Btn>
            <Btn label="Italic" shortcut={`${MOD}I`} active={s.italic} onClick={() => run((c) => c.toggleItalic())}>
              <Italic size={15} />
            </Btn>
            <Btn label="Underline" shortcut={`${MOD}U`} active={s.underline} onClick={() => run((c) => c.toggleUnderline())}>
              <Underline size={15} />
            </Btn>
            <Btn label="Strikethrough" shortcut={`${MOD}Shift+S`} active={s.strike} onClick={() => run((c) => c.toggleStrike())}>
              <Strikethrough size={15} />
            </Btn>
            <Btn label="Highlight" shortcut={`${MOD}Shift+H`} active={s.highlight} onClick={() => run((c) => c.toggleHighlight())}>
              <Highlighter size={15} />
            </Btn>
            <Sep />
            <Btn label="Bulleted list" shortcut={`${MOD}Shift+8`} active={s.bullet} onClick={() => run((c) => c.toggleBulletList())}>
              <List size={16} />
            </Btn>
            <Btn label="Numbered list" shortcut={`${MOD}Shift+7`} active={s.ordered} onClick={() => run((c) => c.toggleOrderedList())}>
              <ListOrdered size={16} />
            </Btn>
            {full && (
              <Btn
                label="Alignment and spacing"
                wide
                expanded={menu === "paragraph"}
                onClick={() => setMenu(menu === "paragraph" ? null : "paragraph")}
              >
                <AlignIcon size={15} />
                <ChevronDown size={12} />
              </Btn>
            )}
            <Sep />
            <Btn label={s.link ? "Edit link" : "Add link"} shortcut={`${MOD}K`} active={s.link} onClick={openLink}>
              <Link2 size={16} />
            </Btn>
            <Btn label="Clear formatting" onClick={clearAll}>
              <RemoveFormatting size={15} />
            </Btn>
          </>
        )}

        {menu === "style" && (
          <div role="menu" aria-label="Text style" className="absolute left-0 top-full z-10 mt-1.5 w-[188px] rounded-xl border border-neutral-200 bg-white p-1 shadow-xl">
            {STYLES.map((st) => (
              <MenuItem
                key={st.level}
                selected={s.heading === st.level}
                onClick={() => {
                  setMenu(null);
                  run((c) => (st.level ? c.setHeading({ level: st.level }) : c.setParagraph()));
                }}
              >
                <span className={st.className}>{st.label}</span>
              </MenuItem>
            ))}
            <div className="mx-1 my-1 border-t border-neutral-100" />
            <p className="px-2.5 pb-1 pt-0.5 text-[11px] font-medium text-neutral-400">Size</p>
            <div className="grid grid-cols-4 gap-1 px-1 pb-1">
              {SIZES.map((sz) => (
                <button
                  key={sz.label}
                  type="button"
                  role="menuitemradio"
                  aria-checked={s.size === sz.value}
                  aria-label={`${sz.label} size`}
                  title={sz.label}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() =>
                    run((c) => (sz.value ? c.setMark("fontSize", { size: sz.value }) : c.unsetMark("fontSize")))
                  }
                  className={[
                    "flex h-9 items-center justify-center rounded-lg font-medium transition-colors",
                    s.size === sz.value ? "bg-indigo-50 text-indigo-600" : "text-neutral-700 hover:bg-neutral-100",
                  ].join(" ")}
                  style={{ fontSize: sz.px }}
                >
                  A
                </button>
              ))}
            </div>
          </div>
        )}

        {menu === "paragraph" && (
          <div role="menu" aria-label="Alignment and spacing" className="absolute right-0 top-full z-10 mt-1.5 w-[188px] rounded-xl border border-neutral-200 bg-white p-1 shadow-xl">
            <div className="grid grid-cols-4 gap-1 p-1">
              {(Object.keys(ALIGN_ICONS) as Align[]).map((a) => {
                const Icon = ALIGN_ICONS[a];
                return (
                  <button
                    key={a}
                    type="button"
                    role="menuitemradio"
                    aria-checked={s.align === a}
                    aria-label={`Align ${a}`}
                    title={`Align ${a}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => run((c) => (a === "left" ? c.unsetTextAlign() : c.setTextAlign(a)))}
                    className={[
                      "flex h-8 items-center justify-center rounded-lg transition-colors",
                      s.align === a ? "bg-indigo-50 text-indigo-600" : "text-neutral-600 hover:bg-neutral-100",
                    ].join(" ")}
                  >
                    <Icon size={16} />
                  </button>
                );
              })}
            </div>
            <div className="mx-1 my-1 border-t border-neutral-100" />
            <p className="px-2.5 pb-1 pt-0.5 text-[11px] font-medium text-neutral-400">Line spacing</p>
            {SPACINGS.map((sp) => (
              <MenuItem key={sp.label} selected={s.spacing === sp.value} onClick={() => setSpacing(sp.value)}>
                <span className="text-sm">{sp.label}</span>
              </MenuItem>
            ))}
          </div>
        )}
      </div>
    </BubbleMenu>
  );
}
