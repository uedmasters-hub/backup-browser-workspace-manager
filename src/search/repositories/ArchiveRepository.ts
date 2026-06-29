import { useWindowStore } from "../../stores/windowStore";
import ArchiveMapper from "../mappers/ArchiveMapper";
import type { SearchableArchive } from "../entities";

export default class ArchiveRepository {
  static getAll(): SearchableArchive[] {
    const archived = useWindowStore
      .getState()
      .windows.filter((w) => w.isArchived);

    return new ArchiveMapper().mapMany(archived);
  }
}
