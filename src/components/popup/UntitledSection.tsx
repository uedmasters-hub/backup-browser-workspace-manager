import {
  useEffect,
  useState,
} from "react";

import SectionHeader from "./SectionHeader";
import TabItem from "./TabItem";
import BulkActionBar from "./BulkActionBar";
import { TabGroupCard } from "./tab-groups";

import { useWindowStore } from "../../stores/windowStore";
import { useTabStore } from "../../stores/tabStore";
import { useUIStore } from "../../stores/uiStore";
import {
  sortTabs,
  type TabSortMode,
} from "../../stores/selectors/tabSelectors";
import {
  getTabSortMode,
  saveTabSortMode,
} from "../../browser/storage/tabSortRepository";

export default function UntitledSection() {
  const [sortMode, setSortMode] =
    useState<TabSortMode>("favorites");
  const [draggedTabId, setDraggedTabId] =
    useState<number>();
  const [draggedGroupId, setDraggedGroupId] =
    useState<number>();

  const tabs = useTabStore(
    (state) => state.tabs
  );

  const groups = useTabStore(
    (state) => state.groups
  );
  const selectionMode = useTabStore(
    (state) => state.selectionMode
  );
  const selectedTabs = useTabStore(
    (state) => state.selectedTabs
  );
  const moveTabBefore = useTabStore(
    (state) => state.moveTabBefore
  );
  const moveTabToGroup = useTabStore(
    (state) => state.moveTabToGroup
  );
  const moveGroupBefore = useTabStore(
    (state) => state.moveGroupBefore
  );

  const searchQuery = useUIStore(
    (state) => state.searchQuery
  );

  const selectedWindowId =
    useWindowStore(
      (state) => state.selectedWindowId
    );

  useEffect(() => {
    void getTabSortMode().then(setSortMode);
  }, []);

  useEffect(() => {
    function clearDrag() {
      setDraggedTabId(undefined);
      setDraggedGroupId(undefined);
    }

    document.addEventListener("dragend", clearDrag);

    return () =>
      document.removeEventListener("dragend", clearDrag);
  }, []);

  if (!selectedWindowId) {
    return null;
  }

  const matchingTabs = tabs.filter((tab) => {
      if (!searchQuery.trim()) {
        return true;
      }

      const query =
        searchQuery.toLowerCase();

      return (
        tab.title
          .toLowerCase()
          .includes(query) ||
        tab.url
          .toLowerCase()
          .includes(query)
      );
    });

  const orderedGroups = groups
    .slice()
    .sort((a, b) => a.firstIndex - b.firstIndex)
    .map((group) => ({
      group,
      tabs: sortTabs(
        matchingTabs.filter(
          (tab) => tab.groupId === group.id
        ),
        sortMode
      ),
    }))
    .filter(
      ({ tabs: groupTabs }) =>
        groupTabs.length > 0 || !searchQuery.trim()
    );

  const ungroupedTabs = sortTabs(
    matchingTabs.filter((tab) => tab.groupId === -1),
    sortMode
  );

  function handleSortChange(mode: TabSortMode) {
    setSortMode(mode);
    void saveTabSortMode(mode);
  }

  function beginTabDrag(tabId: number) {
    setDraggedTabId(tabId);
    handleSortChange("chrome-order");
  }

  async function handleTabDrop(targetTabId: number) {
    if (draggedTabId === undefined) {
      return;
    }

    const tabId = draggedTabId;
    setDraggedTabId(undefined);
    await moveTabBefore(tabId, targetTabId);
  }

  async function handleTabDropIntoGroup(groupId: number) {
    if (draggedTabId === undefined) {
      return;
    }

    const tabId = draggedTabId;
    setDraggedTabId(undefined);
    await moveTabToGroup(tabId, groupId);
  }

  async function handleGroupDrop(targetGroupId: number) {
    if (draggedGroupId === undefined) {
      return;
    }

    const groupId = draggedGroupId;
    setDraggedGroupId(undefined);
    await moveGroupBefore(groupId, targetGroupId);
  }

  async function handleUngroupedDrop() {
    if (draggedTabId === undefined) {
      return;
    }

    const tabId = draggedTabId;
    setDraggedTabId(undefined);
    await moveTabToGroup(tabId);
  }

  return (
    <>
      <SectionHeader
        title={`Tabs (${matchingTabs.length})`}
        sortMode={sortMode}
        onSortChange={handleSortChange}
      />

      {matchingTabs.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-gray-400">
          No matching tabs found.
        </div>
      ) : (
        <>
          {orderedGroups.map(
            ({ group, tabs: groupTabs }, index) => (
              <TabGroupCard
                key={group.id}
                group={group}
                tabs={groupTabs}
                canMoveLeft={index > 0}
                canMoveRight={
                  index < orderedGroups.length - 1
                }
                draggingGroup={draggedGroupId === group.id}
                draggingTabId={draggedTabId}
                onTabDragStart={beginTabDrag}
                onTabDrop={(targetTabId) =>
                  void handleTabDrop(targetTabId)
                }
                onTabDropIntoGroup={(groupId) =>
                  void handleTabDropIntoGroup(groupId)
                }
                onGroupDragStart={setDraggedGroupId}
                onGroupDrop={(targetGroupId) =>
                  void handleGroupDrop(targetGroupId)
                }
                onUseChromeOrder={() =>
                  handleSortChange("chrome-order")
                }
              />
            )
          )}

          <div
            onDragOver={(event) => {
              if (draggedTabId !== undefined) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              void handleUngroupedDrop();
            }}
            className={
              draggedTabId !== undefined
                ? "min-h-12"
                : ""
            }
          >
            {(ungroupedTabs.length > 0 ||
              draggedTabId !== undefined) &&
              groups.length > 0 && (
                <div className="px-6 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                  Ungrouped
                </div>
              )}

            {ungroupedTabs.map((tab) => (
              <TabItem
                key={tab.id}
                id={tab.id}
                title={tab.title}
                favicon={tab.favicon}
                favorite={tab.favorite}
                pinned={tab.pinned}
                lastAccessed={tab.lastAccessed}
                dragging={draggedTabId === tab.id}
                onTabDragStart={beginTabDrag}
                onTabDrop={(targetTabId) =>
                  void handleTabDrop(targetTabId)
                }
              />
            ))}
          </div>
        </>
      )}

      {selectionMode && selectedTabs.length > 0 && (
        <div aria-hidden className="h-32" />
      )}

      <BulkActionBar />
    </>
  );
}
