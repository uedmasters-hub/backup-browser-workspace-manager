export async function closeTabs(
  tabIds: number[]
): Promise<void> {
  if (tabIds.length === 0) return;

  await chrome.tabs.remove(tabIds);
}

export async function pinTabs(
  tabIds: number[],
  pinned = true
): Promise<void> {
  if (tabIds.length === 0) return;

  await Promise.all(
    tabIds.map((tabId) =>
      chrome.tabs.update(tabId, {
        pinned,
      })
    )
  );
}

export async function togglePinTabs(
  tabIds: number[]
): Promise<void> {
  if (tabIds.length === 0) return;

  const tabs = await Promise.all(
    tabIds.map((tabId) =>
      chrome.tabs.get(tabId)
    )
  );

  await Promise.all(
    tabs.map((tab) =>
      chrome.tabs.update(tab.id!, {
        pinned: !tab.pinned,
      })
    )
  );
}

export async function duplicateTabs(
  tabIds: number[]
): Promise<void> {
  if (tabIds.length === 0) return;

  await Promise.all(
    tabIds.map((tabId) =>
      chrome.tabs.duplicate(tabId)
    )
  );
}

export async function moveTabs(
  tabIds: number[],
  windowId: number
): Promise<void> {
  if (tabIds.length === 0) return;

  await chrome.tabs.move(tabIds, {
    windowId,
    index: -1,
  });
}
export async function activateTab(
  tabId: number,
  windowId?: number
): Promise<void> {
  await chrome.tabs.update(tabId, { active: true });

  if (windowId !== undefined) {
    await chrome.windows.update(windowId, { focused: true });
  }
}
