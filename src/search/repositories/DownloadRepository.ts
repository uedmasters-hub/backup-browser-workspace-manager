import { getDownloads } from "../../browser/services/downloadService";
import DownloadMapper from "../mappers/DownloadMapper";
import type { SearchableDownload } from "../entities";

export default class DownloadRepository {
  static async getAll(): Promise<SearchableDownload[]> {
    const downloads = await getDownloads();
    return new DownloadMapper().mapMany(downloads);
  }
}
