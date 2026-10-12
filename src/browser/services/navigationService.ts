/** Open a URL in a new active tab. */
export async function openUrl(url: string): Promise<void> {
  await chrome.tabs.create({ url, active: true });
}

/**
 * Open a link from inside the extension UI in a new tab, placed right after
 * the tab the user is on (like a normal link click).
 * `background: true` keeps focus where it is, so the popup stays open —
 * used for Ctrl/⌘-click and middle-click.
 */
export async function openLinkInNewTab(
  url: string,
  { background = false }: { background?: boolean } = {}
): Promise<void> {
  const [current] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  await chrome.tabs.create({
    url,
    active: !background,
    ...(current?.id !== undefined
      ? {
          windowId: current.windowId,
          index: current.index + 1,
          openerTabId: current.id,
        }
      : {}),
  });
}
