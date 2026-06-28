export type SearchMode =
  | "instant"
  | "deep";

export type SearchSource =
  | "workspace"
  | "tab"
  | "archive"
  | "session"
  | "download"
  | "bookmark"
  | "history"
  | "clipboard"
  | "page";

export type SearchStatus =
  | "idle"
  | "searching"
  | "loading"
  | "success"
  | "empty"
  | "error";