import { defineManifest } from "@crxjs/vite-plugin";

import pkg from "../../package.json";

export default defineManifest({
  manifest_version: 3,

  name: "Browser Workspace Manager",

  // Single source of truth: package.json (bumped by scripts/release.sh).
  version: pkg.version,

  description: "Manage browser windows and tabs.",

  // One shared extension instance that also sees private windows — once the
  // user turns on "Allow in Private" / "Allow in Incognito" for it.
  incognito: "spanning",

  permissions: [
    "tabs",
    "tabGroups",
    "storage",
    // Notes keep their pictures inside them; without this Chrome caps local
    // storage at 10 MB and saves would start failing. No install warning.
    "unlimitedStorage",
    "bookmarks",
    "history",
    "downloads",
    "sessions",
    "scripting"
  ],

  host_permissions: [
    "<all_urls>"
  ],

  action: {
    default_popup: "src/browser/popup/index.html",
    default_icon: {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },

  icons: {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },

  commands: {
    "focus-search": {
      suggested_key: {
        default: "Ctrl+Shift+K",
        mac: "Command+Shift+K"
      },
      description: "Open the extension and focus search"
    },
    "open-notes": {
      suggested_key: {
        default: "Alt+J",
        mac: "Command+J"
      },
      description: "Open the extension and show Notes"
    }
  },

  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/browser/content/noteFloater.ts"],
      run_at: "document_idle"
    }
  ],

  background: {
    service_worker: "src/browser/background/index.ts",
    type: "module"
  }
});
