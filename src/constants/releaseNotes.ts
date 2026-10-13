/**
 * What's new, shown once in the popup after the extension updates.
 * Add an entry for every release (scripts/release.sh warns if it's missing).
 * Keep each line short and user-facing.
 */
export const RELEASE_NOTES: Record<string, string[]> = {
  "1.3.0": [
    "New app dock: your most-visited apps as icons under the window cards.",
    "Click an app to jump to it if it's open, or open it in a new window.",
    "Open in several windows? Pick which one. Right-click for new tab/window.",
    "Turn the dock on or off from the ☰ menu.",
  ],
  "1.2.1": [
    "You'll now see what's new after every update — like this.",
    "When an update is waiting, a banner lets you install it with one click.",
  ],
  "1.2.0": [
    "Hover a tab for a quick preview of the page.",
    "Private / Incognito windows can be shown and managed.",
    "Links in notes are clickable and open in a new tab.",
    "Smoother tab list with a loading shimmer while you scroll.",
  ],
};

export const CHANGELOG_URL =
  "https://github.com/uedmasters-hub/backup-browser-workspace-manager/blob/main/CHANGELOG.md";

function compare(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/** Notes for every version after `from` up to and including `to`, newest first. */
export function notesBetween(
  from: string,
  to: string
): { version: string; items: string[] }[] {
  return Object.keys(RELEASE_NOTES)
    .filter((v) => compare(v, from) > 0 && compare(v, to) <= 0)
    .sort((a, b) => compare(b, a))
    .map((version) => ({ version, items: RELEASE_NOTES[version] }));
}

export { compare as compareVersions };
