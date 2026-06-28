import type { WorkspaceWindow } from "../../types/window";

export function getActiveWorkspaces(
  windows: WorkspaceWindow[]
) {
  return windows.filter(
    (window) => !window.isArchived
  );
}

export function getArchivedWorkspaces(
  windows: WorkspaceWindow[]
) {
  return windows.filter(
    (window) => window.isArchived
  );
}
