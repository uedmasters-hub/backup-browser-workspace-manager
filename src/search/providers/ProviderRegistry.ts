import WorkspaceProvider from "./WorkspaceProvider";
import TabProvider from "./TabProvider";
import BookmarkProvider from "./BookmarkProvider";
import HistoryProvider from "./HistoryProvider";
import DownloadProvider from "./DownloadProvider";
import SessionProvider from "./SessionProvider";
import ArchiveProvider from "./ArchiveProvider";

import type { SearchProvider } from "./SearchProvider";

export default class ProviderRegistry {
  private static providers: SearchProvider[] = [];

  static register(provider: SearchProvider) {
    this.providers.push(provider);
  }

  static initialize() {
    this.clear();

    // Level 1 — instant
    this.register(new WorkspaceProvider());
    this.register(new TabProvider());

    // Level 2 — universal
    this.register(new BookmarkProvider());
    this.register(new HistoryProvider());
    this.register(new DownloadProvider());
    this.register(new SessionProvider());
    this.register(new ArchiveProvider());
  }

  static getProviders() {
    return this.providers;
  }

  static clear() {
    this.providers = [];
  }
}
