import type {
  SearchableWorkspace,
} from "../entities";

import type {
  BaseIndexer,
} from "./BaseIndexer";

import SearchIndexBuilder from "./pipeline/SearchIndexBuilder";
import KeywordIndexer from "./pipeline/KeywordIndexer";
import MetadataIndexer from "./pipeline/MetadataIndexer";

export default class WorkspaceIndexer
  implements BaseIndexer<SearchableWorkspace>
{
  index(
    workspace: SearchableWorkspace
  ): SearchableWorkspace {
    const searchIndex =
      SearchIndexBuilder.build(
        workspace.title,
        workspace.subtitle,
        ...workspace.aliases,
        ...workspace.tags,
        ...workspace.keywords
      );

    return {
      ...workspace,

      searchIndex,

      keywords:
        KeywordIndexer.generate(
          searchIndex
        ),

      metadata: {
        ...workspace.metadata,

        ...MetadataIndexer.create(),
      },
    };
  }

  indexMany(
    workspaces: SearchableWorkspace[]
  ) {
    return workspaces.map(
      (workspace) =>
        this.index(
          workspace
        )
    );
  }
}