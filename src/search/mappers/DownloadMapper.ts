import { extractDomain } from "../util/url";

import type { RawDownload } from "../../browser/services/downloadService";
import type { SearchableDownload } from "../entities";

function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export default class DownloadMapper {
  map(download: RawDownload): SearchableDownload {
    const name = baseName(download.filename);
    const extension = name.includes(".")
      ? name.split(".").pop() ?? ""
      : "";
    const domain = extractDomain(download.finalUrl);

    return {
      id: `download-${download.id}`,
      source: "download",
      title: name || download.finalUrl,
      subtitle: domain || download.state,
      description: download.finalUrl,
      keywords: extension ? [extension] : [],
      tags: [],
      aliases: [],
      searchIndex: [name, extension, domain]
        .join(" ")
        .toLowerCase(),
      downloadId: download.id,
      filename: download.filename,
      extension,
      url: download.finalUrl,
    };
  }

  mapMany(downloads: RawDownload[]) {
    return downloads.map((d) => this.map(d));
  }
}
