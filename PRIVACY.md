# Privacy Policy

**Last updated:** October 13, 2026

## Browser Workspace Manager Privacy Policy

Browser Workspace Manager is designed with privacy in mind. The extension helps users organize, search, and manage Chrome tabs, windows, and tab groups while keeping user data on the user's device.

## Information We Collect

Browser Workspace Manager **does not collect, transmit, sell, or share personal information**.

The extension does not collect:

* Personally identifiable information
* Financial information
* Authentication credentials
* Personal communications
* Health information
* Location data
* Browsing history for analytics or profiling
* Website content
* User activity for advertising or tracking

## How the Extension Uses Chrome Permissions

The extension uses Chrome's extension APIs solely to provide its core functionality.

### Tabs

The `tabs` permission is used to:

* Display open tabs
* Search and switch between tabs
* Retrieve tab metadata (such as title, URL, favicon, and pinned state)
* Organize tabs across browser windows

### Tab Groups

The `tabGroups` permission is used to:

* Create and manage Chrome Tab Groups
* Rename groups
* Change group colors
* Expand and collapse groups
* Group and ungroup tabs

### Storage

The `storage` permission is used to store extension preferences locally, including:

* Favorite tabs
* Window metadata
* Custom window names
* Colors and emojis
* Sorting preferences
* User interface settings

This information remains on the user's device and is not transmitted to external servers.

### App dock

The app dock shows your most-visited sites as icons. It is built from your browsing history (the existing `history` permission) and your open tabs:

* Visit counts are read on your device and cached **in memory only** for a few minutes; nothing about the sites you visit is written to disk or sent anywhere.
* Icons come from your open tabs (remembered in memory), otherwise the site's own `/favicon.ico` is loaded from that site.
* Private (Incognito) tabs are never counted and never shown.
* The only thing saved is the list of apps you chose to hide. The dock can be turned off from the ☰ menu.

### Locked notes and projects

Locking a note or a project encrypts its content on your device with a PIN you choose (AES-GCM, key derived with PBKDF2). For a locked project, every note in it — titles included — is stored only in encrypted form. The PIN is never stored; it's kept in memory only while the note or project is open. If you forget it, the content can't be recovered.

### Tab previews

Hovering a tab in the popup shows a preview. To make this possible:

* When a tab is shown on screen, the extension takes a small snapshot of what's visible and keeps it **in memory only** (`chrome.storage.session`). Snapshots are cleared when the browser closes, are never written to disk, never included in backups, and never sent anywhere. Private (Incognito) tabs are never captured.
* While you hover, the extension reads the page's own description and share image from its `<meta>` tags. The share image is loaded from the site you already have open.

Previews can be turned off by setting `enabled: false` in `src/constants/tabPreview.ts`.

### Private (Incognito) windows

Private windows are only visible to the extension if you turn on "Allow in Private" (Brave) or "Allow in Incognito" (Chrome) for it in your browser's extension settings. It is off by default and you can turn it off at any time.

When it is on, private windows and their tabs are shown and managed in the popup while they are open, but:

* Private tabs cannot be added to favorites, so their URLs are never saved.
* Private windows and their tabs are never included in exported backups.
* A custom name, color or emoji you give a private window is saved locally like any other window's; no tab data is stored with it.

## Data Processing

All processing is performed locally using Chrome's extension APIs.

Browser Workspace Manager does **not**:

* Upload browsing data
* Sync data to external servers
* Sell user information
* Share user information with third parties
* Use data for advertising or marketing
* Profile users

## Third-Party Services

Browser Workspace Manager does not include:

* Third-party analytics
* Advertising SDKs
* Tracking technologies
* Remote code execution
* External data collection services

## Data Security

The extension stores only the information required to provide its functionality using Chrome's secure extension storage mechanisms. No user data is intentionally transmitted outside the browser.

## Your Control

Users can:

* Remove the extension at any time.
* Clear extension data through Chrome's extension management tools.
* Delete browser tabs, groups, favorites, and locally stored preferences whenever they choose.

## Changes to This Privacy Policy

This Privacy Policy may be updated periodically to reflect improvements to the extension or changes in legal or platform requirements. Updates will be published in this repository with a revised "Last updated" date.

## Contact

If you have questions about this Privacy Policy or Browser Workspace Manager, please open an issue in the project's GitHub repository.

Repository:
https://github.com/uedmasters-hub/browser-workspace-manager
