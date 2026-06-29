import { extractDomain } from "../util/url";

import type { RawSession } from "../../browser/services/sessionService";
import type { SearchableSession } from "../entities";

export default class SessionMapper {
  map(session: RawSession): SearchableSession {
    const domain = session.url ? extractDomain(session.url) : "";

    return {
      id: `session-${session.sessionId}`,
      source: "session",
      title: session.title,
      subtitle: session.isWindow
        ? `${session.tabCount} tabs`
        : domain,
      description: session.url,
      keywords: [],
      tags: [],
      aliases: [],
      searchIndex: [session.title, domain, session.url ?? ""]
        .join(" ")
        .toLowerCase(),
      lastAccessedAt: session.lastModified
        ? session.lastModified * 1000
        : undefined,
      sessionId: session.sessionId,
      workspaceCount: session.isWindow ? 1 : 0,
      tabCount: session.tabCount,
    };
  }

  mapMany(sessions: RawSession[]) {
    return sessions.map((s) => this.map(s));
  }
}
