/** Open a URL in a new active tab. */
export async function openUrl(url: string): Promise<void> {
  await chrome.tabs.create({ url, active: true });
}
