import { STORAGE_KEYS } from "../../constants/storageKeys";
import type { WorkspaceMetadata } from "../../types/workspace";

export async function getWorkspaces(): Promise<
  WorkspaceMetadata[]
> {
  const result = await chrome.storage.local.get(
    STORAGE_KEYS.WORKSPACES
  );

  const workspaces = result[
    STORAGE_KEYS.WORKSPACES
  ] as WorkspaceMetadata[] | undefined;

  return workspaces ?? [];
}

export async function saveWorkspaces(
  workspaces: WorkspaceMetadata[]
): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.WORKSPACES]: workspaces,
  });
}

export async function upsertWorkspace(
  workspace: WorkspaceMetadata
): Promise<void> {
  const workspaces = await getWorkspaces();

  const index = workspaces.findIndex(
    (item) =>
      item.chromeWindowId === workspace.chromeWindowId
  );

  if (index >= 0) {
    workspaces[index] = workspace;
  } else {
    workspaces.push(workspace);
  }

  await saveWorkspaces(workspaces);
}

export async function getWorkspace(
  chromeWindowId: number
): Promise<WorkspaceMetadata | undefined> {
  const workspaces = await getWorkspaces();

  return workspaces.find(
    (workspace) =>
      workspace.chromeWindowId === chromeWindowId
  );
}

export async function removeWorkspace(
  chromeWindowId: number
): Promise<void> {
  const workspaces = await getWorkspaces();

  const filtered = workspaces.filter(
    (workspace) =>
      workspace.chromeWindowId !== chromeWindowId
  );

  await saveWorkspaces(filtered);
}

export async function clearWorkspaces(): Promise<void> {
  await chrome.storage.local.remove(
    STORAGE_KEYS.WORKSPACES
  );
}