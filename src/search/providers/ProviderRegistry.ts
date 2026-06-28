import WorkspaceProvider from "./WorkspaceProvider";
import TabProvider from "./TabProvider";

import type { SearchProvider } from "./SearchProvider";

export default class ProviderRegistry {
  private static providers: SearchProvider[] = [];

  static register(provider: SearchProvider) {
    this.providers.push(provider);
  }

  static initialize() {
    this.clear();

    this.register(new WorkspaceProvider());
    this.register(new TabProvider());
  }

  static getProviders() {
    return this.providers;
  }

  static clear() {
    this.providers = [];
  }
}
