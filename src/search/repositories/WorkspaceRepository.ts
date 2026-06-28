import {
  useWindowStore,
} from "../../stores/windowStore";

import WorkspaceMapper from "../mappers/WorkspaceMapper";
import WorkspaceIndexer from "../indexers/WorkspaceIndexer";

export default class WorkspaceRepository {
  static getAll() {
    const windows = useWindowStore.getState().windows;

    const mapper = new WorkspaceMapper();

    const indexer = new WorkspaceIndexer();

    return indexer.indexMany(mapper.mapMany(windows));
  }
}
