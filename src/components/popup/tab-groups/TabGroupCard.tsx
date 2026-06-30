import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Shuffle,
  Ungroup,
} from "lucide-react";

import TabItem from "../TabItem";

import { WORKSPACE_EMOJIS } from "../../../constants/workspaceEmojis";
import { useTabStore } from "../../../stores/tabStore";
import { splitGroupTitle } from "../../../browser/services/tabGroupService";

import {
  TAB_GROUP_COLORS,
  TAB_GROUP_COLOR_HEX,
} from "./tabGroupColors";

import type {
  WorkspaceTab,
  WorkspaceTabGroup,
} from "../../../types/tab";

type Props = {
  group: WorkspaceTabGroup;
  tabs: WorkspaceTab[];
  canMoveLeft: boolean;
  canMoveRight: boolean;
  /** Switch the list to manual order so menu reordering is visible. */
  onUseManualOrder: () => void;
};

export default function TabGroupCard({
  group,
  tabs,
  canMoveLeft,
  canMoveRight,
  onUseManualOrder,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const title = splitGroupTitle(group.title);
  const [draft, setDraft] = useState(title.name);

  const toggleGroupCollapsed = useTabStore(
    (state) => state.toggleGroupCollapsed
  );
  const renameGroup = useTabStore((state) => state.renameGroup);
  const updateGroupColor = useTabStore((state) => state.updateGroupColor);
  const updateGroupEmoji = useTabStore((state) => state.updateGroupEmoji);
  const ungroupGroup = useTabStore((state) => state.ungroupGroup);
  const moveGroup = useTabStore((state) => state.moveGroup);
  const shuffleGroupTabs = useTabStore((state) => state.shuffleGroupTabs);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function closeMenu(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  async function saveName() {
    setEditing(false);
    await renameGroup(group.id, draft);
  }

  function startEditing() {
    setDraft(title.name);
    setEditing(true);
  }

  const color = TAB_GROUP_COLOR_HEX[group.color];

  return (
    <section
      className="relative mx-5 mb-3 overflow-visible rounded-2xl border bg-white/60"
      style={{ borderColor: `${color}66` }}
    >
      <div className="flex min-h-12 items-center gap-2 px-3 py-2">
        <button
          type="button"
          aria-label={group.collapsed ? "Expand group" : "Collapse group"}
          onClick={() => toggleGroupCollapsed(group.id)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition hover:bg-black/5"
        >
          <ChevronDown
            size={16}
            className={[
              "transition-transform duration-200",
              group.collapsed ? "-rotate-90" : "",
            ].join(" ")}
          />
        </button>

        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />

        {title.emoji && (
          <span className="shrink-0 text-sm">{title.emoji}</span>
        )}

        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => void saveName()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
              if (event.key === "Escape") {
                setDraft(title.name);
                event.currentTarget.blur();
              }
            }}
            className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm font-semibold outline-none focus:border-neutral-500"
          />
        ) : (
          <button
            type="button"
            onDoubleClick={startEditing}
            onClick={() => toggleGroupCollapsed(group.id)}
            className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-neutral-800"
          >
            {title.name}
          </button>
        )}

        <span className="shrink-0 text-[11px] text-neutral-400">
          {group.tabCount}
        </span>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            aria-label={`Edit ${title.name}`}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-black/5"
          >
            <MoreHorizontal size={17} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-30 mt-1 max-h-[360px] w-56 overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-2 shadow-2xl">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  startEditing();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
              >
                <Pencil size={15} />
                Rename
              </button>

              <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                Color
              </p>
              <div className="grid grid-cols-9 gap-1 px-1 pb-2">
                {TAB_GROUP_COLORS.map(([value, hex]) => (
                  <button
                    key={value}
                    type="button"
                    aria-label={`${value} group color`}
                    onClick={() => void updateGroupColor(group.id, value)}
                    className={[
                      "h-4 w-4 rounded-full transition-transform hover:scale-125",
                      group.color === value
                        ? "ring-2 ring-neutral-700 ring-offset-1"
                        : "",
                    ].join(" ")}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>

              <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                Emoji
              </p>
              <div className="grid grid-cols-8 gap-1 px-1 pb-2">
                {WORKSPACE_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => void updateGroupEmoji(group.id, emoji)}
                    className={[
                      "flex h-6 w-6 items-center justify-center rounded-md text-sm hover:bg-neutral-100",
                      title.emoji === emoji ? "bg-neutral-100" : "",
                    ].join(" ")}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => void updateGroupEmoji(group.id, undefined)}
                className="w-full rounded-lg px-2 py-1.5 text-left text-xs text-neutral-500 hover:bg-neutral-100"
              >
                Remove emoji
              </button>

              <div className="my-1 border-t border-neutral-100" />

              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  disabled={!canMoveLeft}
                  onClick={() => void moveGroup(group.id, "left")}
                  className="flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-30"
                >
                  <ChevronLeft size={14} />
                  Left
                </button>
                <button
                  type="button"
                  disabled={!canMoveRight}
                  onClick={() => void moveGroup(group.id, "right")}
                  className="flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-30"
                >
                  Right
                  <ChevronRight size={14} />
                </button>
              </div>

              <button
                type="button"
                disabled={tabs.length < 2}
                onClick={() => {
                  setMenuOpen(false);
                  onUseManualOrder();
                  void shuffleGroupTabs(group.id);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-30"
              >
                <Shuffle size={15} />
                Shuffle tabs
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  void ungroupGroup(group.id);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <Ungroup size={15} />
                Ungroup all tabs
              </button>
            </div>
          )}
        </div>
      </div>

      {!group.collapsed && (
        <div className="pb-1">
          {tabs.map((tab) => (
            <TabItem
              key={tab.id}
              id={tab.id}
              title={tab.title}
              favicon={tab.favicon}
              favorite={tab.favorite}
              pinned={tab.pinned}
              active={tab.active}
              audible={tab.audible}
              muted={tab.muted}
              lastAccessed={tab.lastAccessed}
              nested
            />
          ))}
        </div>
      )}
    </section>
  );
}
