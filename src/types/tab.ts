export interface WorkspaceTab {
  id: number;

  windowId: number;

  index: number;

  groupId: number;

  title: string;

  url: string;

  favicon?: string;

  favorite: boolean;

  pinned: boolean;

  active: boolean;

  audible: boolean;

  discarded: boolean;

  lastAccessed?: number;
}

export type TabGroupColor =
  | "grey"
  | "blue"
  | "red"
  | "yellow"
  | "green"
  | "pink"
  | "purple"
  | "cyan"
  | "orange";

export interface WorkspaceTabGroup {
  id: number;

  windowId: number;

  title: string;

  color: TabGroupColor;

  collapsed: boolean;

  tabCount: number;

  firstIndex: number;

  lastIndex: number;
}
