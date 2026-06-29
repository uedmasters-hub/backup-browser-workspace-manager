export interface RawSession {
  sessionId: string;
  title: string;
  url?: string;
  tabCount: number;
  isWindow: boolean;
  lastModified?: number;
}

export async function getRecentlyClosed(
  limit = 25
): Promise<RawSession[]> {
  const sessions = await chrome.sessions.getRecentlyClosed({
    maxResults: limit,
  });

  return sessions.map((session) => {
    if (session.window) {
      const tabs = session.window.tabs ?? [];
      return {
        sessionId: session.window.sessionId ?? "",
        title:
          tabs[0]?.title ??
          `Window with ${tabs.length} tabs`,
        url: tabs[0]?.url,
        tabCount: tabs.length,
        isWindow: true,
        lastModified: session.lastModified,
      };
    }

    const tab = session.tab;
    return {
      sessionId: tab?.sessionId ?? "",
      title: tab?.title ?? tab?.url ?? "",
      url: tab?.url,
      tabCount: 1,
      isWindow: false,
      lastModified: session.lastModified,
    };
  });
}

export async function restoreSession(
  sessionId: string
): Promise<void> {
  await chrome.sessions.restore(sessionId);
}
