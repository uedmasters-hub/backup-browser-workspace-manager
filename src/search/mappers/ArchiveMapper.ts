import type { WorkspaceWindow } from "../../types/window";
import type { SearchableArchive } from "../entities";

export default class ArchiveMapper {
  map(workspace: WorkspaceWindow): SearchableArchive {
    return {
      id: `archive-${workspace.id}`,
      source: "archive",
      title: workspace.name,
      subtitle: `Archived · ${workspace.tabCount} ${
        workspace.tabCount === 1 ? "tab" : "tabs"
      }`,
      description: "",
      keywords: [],
      tags: [],
      aliases: [],
      searchIndex: [workspace.name, workspace.emoji ?? ""]
        .join(" ")
        .toLowerCase()
        .trim(),
      updatedAt: Date.parse(workspace.updatedAt) || undefined,
      workspaceId: workspace.chromeWindowId ?? workspace.id,
      archivedAt: Date.parse(workspace.updatedAt) || undefined,
      metadata: { emoji: workspace.emoji },
    };
  }

  mapMany(workspaces: WorkspaceWindow[]) {
    return workspaces.map((w) => this.map(w));
  }
}
