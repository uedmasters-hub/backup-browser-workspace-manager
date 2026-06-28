# Browser Workspace Manager

Version: 1.0

---

# Vision

Browser Workspace Manager is a Chrome Extension that helps users organize browser windows into reusable workspaces, making multitasking effortless while reducing tab overload.

The experience should feel native, lightweight, premium and extremely fast.

Design principles:

- Less is More
- Zero Learning Curve
- One Click Actions
- Beautiful Motion
- Apple / Arc Browser Quality

---

# Popup Size

Width: 380px

Height: 640px

---

# Primary Navigation

Popup

Search

Windows

Tabs

Settings

---

# Main Sections

Header

Window Section

Tab List

Floating Action Button

Bottom Sheet (Future)

---

# Window Layout Rules

## One Window

Display a featured card.

Large preview image.

Large tab count.

---

## Two Windows

Display a 2-column grid.

No preview image.

---

## Three Windows

Display:

Window 1

Window 2

Window 3

Window 2 may optionally contain preview image.

---

## Four Windows

Display a 2×2 grid.

No preview image.

---

## More than Four

Display first three windows.

Fourth card becomes overflow.

Example:

+2 Windows

Tap opens full window list.

---

# Window Card

Properties

- Name
- Emoji
- Color
- Cover Image
- Tab Count
- Active
- Archived
- Created Date
- Updated Date

---

# Window Actions

Open

Rename

Change Color

Change Emoji

Change Cover

Archive

Delete

Merge

Duplicate

Export

---

# Tab

Properties

- Title
- URL
- Domain
- Favicon
- Last Active
- Pinned
- Muted
- Playing Audio
- Group
- Selected
- Favourite

---

# Tab Actions

Move

Duplicate

Pin

Mute

Archive

Delete

Favourite

Move To Window

Open In New Window

Copy URL

---

# Tab Group

Properties

- Native Chrome Group ID
- Title
- Emoji (stored as a title prefix)
- Color
- Collapsed
- Tab Count
- Position

Actions

- Create Group
- Add Tabs To Group
- Ungroup Selected Tabs
- Expand / Collapse
- Rename
- Change Color
- Add / Remove Emoji
- Move Left / Right
- Shuffle Tabs

All group mutations update Chrome directly through `chrome.tabs` and
`chrome.tabGroups`.

---

# Search

Search Windows

Search Tabs

Search URL

Search Domain

Search History

---

# Window Colors

Blue

Green

Purple

Pink

Orange

Yellow

Grey

Custom

---

# States

Loading

Empty

Syncing

Offline

Permission Required

No Tabs

Search Results

Multi Select

Drag

Dragging

Success

Error

---

# Chrome APIs

chrome.tabs

chrome.windows

chrome.storage.local

chrome.storage.sync

chrome.sessions

chrome.tabGroups

chrome.bookmarks (Future)

---

# Architecture

Popup

↓

App

↓

Header

↓

Window Grid

↓

Tab List

↓

Floating Button

---

# Tech Stack

React 19

TypeScript

Vite

Tailwind CSS v4

Chrome Manifest V3

Zustand

React Query

React Hook Form

Zod

Framer Motion

Lucide Icons

---

# Folder Structure

src

app

browser

components

features

hooks

lib

services

stores

types

utils

---

# Coding Rules

One component.

One responsibility.

No duplicated UI.

Everything typed.

No inline mock data after API integration.

Every Chrome API wrapped inside services.

Business logic never inside UI components.

---

# Performance Goals

Popup opens under 100ms

Search under 50ms

No unnecessary rerenders

Lazy load heavy components

Minimal bundle size

---

# Design Principles

Rounded

Soft shadows

Minimal

Readable

Accessible

Motion first

Content first
