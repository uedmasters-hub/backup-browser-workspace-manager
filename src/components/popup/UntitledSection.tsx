import { useEffect, useState } from "react";

import SectionHeader from "./SectionHeader";
import TabItem from "./TabItem";
import BulkActionBar from "./BulkActionBar";
import { TabGroupCard } from "./tab-groups";

import { useWindowStore } from "../../stores/windowStore";
import { useTabStore } from "../../stores/tabStore";
import { useUIStore } from "../../stores/uiStore";
import {
  sortGroups,
  sortTabs,
  type TabSortMode,
} from "../../stores/selectors/tabSelectors";
import {
  getTabSortMode,
  saveTabSortMode,
} from "../../browser/storage/tabSortRepository";

export default function UntitledSection() {
  const [sortMode, setSortMode] = useState<TabSortMode>("favorites");

  const tabs = useTabStore((state) => state.tabs);
  const groups = useTabStore((state) => state.groups);
  const selectionMode = useTabStore((state) => state.selectionMode);
  const selectedTabs = useTabStore((state) => state.selectedTabs);

  const searchQuery = useUIStore((state) => state.searchQuery);
  const selectedWindowId = useWindowStore(
    (state) => state.selectedWindowId
  );

  useEffect(() => {
    void getTabSortMode().then(setSortMode);
  }, []);

  if (!selectedWindowId) {
    return null;
  }

  const matchingTabs = tabs.filter((tab) => {
    if (!searchQuery.trim()) {
      return true;
    }
    const query = searchQuery.toLowerCase();
    return (
      tab.title.toLowerCase().includes(query) ||
      tab.url.toLowerCase().includes(query)
    );
  });

  // Groups first (newest first, or as the sort says); ungrouped tabs after.
  const orderedGroups = sortGroups(
    groups.map((group) => ({
      group,
      tabs: sortTabs(
        matchingTabs.filter((tab) => tab.groupId === group.id),
        sortMode
      ),
    })),
    sortMode
  ).filter(
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

  // Menu reordering (shuffle/move) is only visible in manual order.
  function useManualOrder() {
    handleSortChange("chrome-order");
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
          {orderedGroups.map(({ group, tabs: groupTabs }) => (
            <TabGroupCard
              key={group.id}
              group={group}
              tabs={groupTabs}
              // Left/Right move the group in the tab strip (Chrome order).
              canMoveLeft={groups.some((g) => g.firstIndex < group.firstIndex)}
              canMoveRight={groups.some((g) => g.firstIndex > group.firstIndex)}
              onUseManualOrder={useManualOrder}
            />
          ))}

          <div>
            {ungroupedTabs.length > 0 && groups.length > 0 && (
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
                canFavorite={!tab.incognito}
                pinned={tab.pinned}
                active={tab.active}
              audible={tab.audible}
                muted={tab.muted}
                lastAccessed={tab.lastAccessed}
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
