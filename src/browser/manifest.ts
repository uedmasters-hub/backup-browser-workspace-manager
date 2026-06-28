import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,

  name: "Browser Workspace Manager",

  version: "0.1.0",

  description: "Manage browser windows and tabs.",

  permissions: [
    "tabs",
    "tabGroups",
    "storage"
  ],

  host_permissions: [
    "<all_urls>"
  ],

  action: {
    default_popup: "src/browser/popup/index.html"
  },

  commands: {
    "focus-search": {
      suggested_key: {
        default: "Ctrl+Shift+K",
        mac: "Command+Shift+K"
      },
      description: "Open the extension and focus search"
    }
  },

  background: {
    service_worker: "src/browser/background/index.ts",
    type: "module"
  }
});
