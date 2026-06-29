export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Normalize a URL for cross-source de-duplication (drop hash, trailing slash). */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    let out = parsed.toString();
    if (out.endsWith("/")) {
      out = out.slice(0, -1);
    }
    return out.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}
