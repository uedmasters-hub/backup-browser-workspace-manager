import type {
  WorkspaceWindow,
} from "../../types/window";

import type {
  SearchableWorkspace,
} from "../entities";

import type {
  BaseMapper,
} from "./BaseMapper";

export default class WorkspaceMapper
  implements BaseMapper<WorkspaceWindow, SearchableWorkspace>
{
  map(workspace: WorkspaceWindow): SearchableWorkspace {
    return {
      id: `workspace-${workspace.id}`,

      source: "workspace",

      title: workspace.name,

      subtitle: `${workspace.tabCount} ${
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

      workspaceId: workspace.id,

      chromeWindowId: workspace.chromeWindowId ?? 0,

      archived: workspace.isArchived,

      tabCount: workspace.tabCount,

      createdAt: Date.parse(workspace.createdAt) || undefined,

      updatedAt: Date.parse(workspace.updatedAt) || undefined,

      metadata: {
        emoji: workspace.emoji,
        color: workspace.color,
      },
    };
  }

  mapMany(workspaces: WorkspaceWindow[]) {
    return workspaces.map((workspace) => this.map(workspace));
  }
}
