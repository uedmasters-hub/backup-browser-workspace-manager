/**
 * Search engine harness.
 *
 * This runs the REAL search engine (SearchEngine -> QueryParser -> Pipeline ->
 * WorkspaceProvider + TabProvider -> SearchScorer -> Ranker -> Limiter) against
 * seeded data, with a minimal Chrome mock. It is a functional proof that the
 * engine ranks results correctly; it is not shipped in the extension.
 */

// ---- Minimal Chrome mock (must exist before the engine queries it) ----------

interface MockTab {
  id: number;
  windowId: number;
  title: string;
  url: string;
  favIconUrl?: string;
  pinned?: boolean;
  active?: boolean;
  audible?: boolean;
  discarded?: boolean;
  lastAccessed?: number;
}

const NOW = Date.now();
const DAY = 86_400_000;

const MOCK_TABS: MockTab[] = [
  { id: 1, windowId: 10, title: "GitHub - facebook/react", url: "https://github.com/facebook/react", pinned: true, active: true, lastAccessed: NOW },
  { id: 2, windowId: 10, title: "Gmail - Inbox (12)", url: "https://mail.google.com/mail/u/0/", lastAccessed: NOW - 2 * DAY },
  { id: 3, windowId: 10, title: "React Hooks Reference", url: "https://react.dev/reference/react", lastAccessed: NOW - 1 * DAY },
  { id: 4, windowId: 11, title: "Stack Overflow - zustand persist", url: "https://stackoverflow.com/questions/zustand", lastAccessed: NOW - 5 * DAY },
  { id: 5, windowId: 11, title: "YouTube - lofi beats", url: "https://www.youtube.com/watch?v=lofi", lastAccessed: NOW - 30 * DAY },
  { id: 6, windowId: 12, title: "Figma - Design System", url: "https://www.figma.com/file/design", lastAccessed: NOW - 3 * DAY },
  { id: 7, windowId: 12, title: "Notion - Roadmap", url: "https://www.notion.so/roadmap", lastAccessed: NOW - 12 * DAY },
];

const FAVORITE_TABS = [
  "https://github.com/facebook/react",
];

(globalThis as unknown as { chrome: unknown }).chrome = {
  tabs: {
    query: async () => MOCK_TABS,
    update: async () => undefined,
    remove: async () => undefined,
  },
  windows: {
    getAll: async () => [],
    update: async () => undefined,
  },
  storage: {
    local: {
      get: async () => ({
        favoriteTabs: FAVORITE_TABS,
      }),
      set: async () => undefined,
      remove: async () => undefined,
    },
  },
};

// ---- Imports (after the mock is installed) ----------------------------------

import type { WorkspaceWindow } from "../src/types/window";

const { useWindowStore } = await import(
  "../src/stores/windowStore"
);
const { default: SearchEngine } = await import(
  "../src/search/engine/SearchEngine"
);
const { default: ProviderRegistry } = await import(
  "../src/search/providers/ProviderRegistry"
);

// ---- Seed workspaces directly into the store --------------------------------

const iso = (offsetDays: number) =>
  new Date(NOW - offsetDays * DAY).toISOString();

const WORKSPACES: WorkspaceWindow[] = [
  { id: 10, chromeWindowId: 10, name: "React Project", color: "#DDEDEB", emoji: "💻", tabCount: 3, isActive: true, isArchived: false, createdAt: iso(20), updatedAt: iso(0) },
  { id: 11, chromeWindowId: 11, name: "Research", color: "#FFE9A8", emoji: "🧠", tabCount: 2, isActive: false, isArchived: false, createdAt: iso(15), updatedAt: iso(5) },
  { id: 12, chromeWindowId: 12, name: "Design Work", color: "#DDD0F6", emoji: "🎨", tabCount: 2, isActive: false, isArchived: false, createdAt: iso(10), updatedAt: iso(3) },
  { id: 13, chromeWindowId: 13, name: "Old Receipts", color: "#F8CDE2", emoji: "📦", tabCount: 1, isActive: false, isArchived: true, createdAt: iso(40), updatedAt: iso(40) },
];

useWindowStore.getState().setWindows(WORKSPACES);
ProviderRegistry.initialize();

// ---- Test runner ------------------------------------------------------------

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail = "") {
  if (condition) {
    passed++;
    console.log(`  \u2713 ${label}`);
  } else {
    failed++;
    console.log(`  \u2717 ${label}${detail ? ` -> ${detail}` : ""}`);
  }
}

async function show(query: string) {
  const results = await SearchEngine.search(query);

  console.log(`\nQUERY: "${query}"  (${results.length} results)`);

  for (const r of results.slice(0, 6)) {
    console.log(
      `   ${r.score.toFixed(1).padStart(6)}  [${r.source.padEnd(9)}] ${r.title}` +
        (r.matchedFields?.length
          ? `   <${r.matchedFields.join(",")}>`
          : "")
    );
  }

  return results;
}

async function run() {
  console.log("=".repeat(64));
  console.log(" SEARCH ENGINE FUNCTIONAL HARNESS");
  console.log("=".repeat(64));

  // 1. Search spans matching workspaces and tabs.
  let r = await show("react");
  check(
    "'react' returns results",
    r.length > 0
  );
  check(
    "'react' returns the React Project workspace",
    r.some(
      (x) =>
        x.source === "workspace" &&
        x.title === "React Project"
    ),
    r.map((x) => x.title).join(" | ")
  );
  check(
    "'react' also matches react.dev tab",
    r.some((x) => x.source === "tab" && x.title.includes("React Hooks"))
  );

  // 2. Prefix beats substring: "git" should surface the GitHub tab high.
  r = await show("git");
  check(
    "'git' matches the GitHub tab",
    r.some((x) => x.title.includes("GitHub")),
    r.map((x) => x.title).join(" | ")
  );

  // 3. Domain matching.
  r = await show("youtube");
  check(
    "'youtube' finds the YouTube tab via domain/title",
    r.some((x) => x.title.includes("YouTube"))
  );

  // 4. Multi-token AND match.
  r = await show("design system");
  check(
    "'design system' finds the Figma design tab",
    r.some((x) => x.title.includes("Design System")),
    r.map((x) => x.title).join(" | ")
  );
  check(
    "'design system' rejects unrelated tabs (AND match)",
    r.every(
      (x) => !x.title.includes("lofi") && !x.title.includes("Inbox")
    )
  );

  // 5. Fuzzy subsequence: "gthb" -> github.
  r = await show("gthb");
  check(
    "fuzzy 'gthb' still finds GitHub",
    r.some((x) => x.title.includes("GitHub")),
    r.map((x) => x.title).join(" | ")
  );

  // 6. Scores are sorted descending.
  r = await show("re");
  const sorted = r.every(
    (x, i) => i === 0 || r[i - 1].score >= x.score
  );
  check("results are ranked by descending score", sorted);

  // 7. Favorite boost: the favorite GitHub tab outranks the other React tab.
  r = await show("react");
  const favoriteReactTab = r.find((x) => x.title.includes("GitHub"));
  const otherReactTab = r.find((x) => x.title.includes("React Hooks"));
  check(
    "favorite tab outranks another matching tab",
    !!favoriteReactTab &&
      !!otherReactTab &&
      favoriteReactTab.score > otherReactTab.score,
    `${favoriteReactTab?.score?.toFixed(1)} vs ${otherReactTab?.score?.toFixed(1)}`
  );

  // 8. Archived workspaces are excluded from search.
  r = await show("receipts");
  check(
    "archived workspace 'Old Receipts' is excluded",
    !r.some((x) => x.source === "workspace" && x.title === "Old Receipts")
  );

  // 9. Deep mode raises URL weight: "stackoverflow" via URL.
  r = await show("@deep stackoverflow");
  check(
    "@deep matches stackoverflow by URL/domain",
    r.some((x) => x.title.includes("Stack Overflow")),
    r.map((x) => x.title).join(" | ")
  );

  // 10. No-match query returns empty.
  r = await show("zxqwvnonexistent");
  check("nonsense query returns no results", r.length === 0);

  // 11. Discovery: empty query surfaces favorite + recent tabs.
  r = await show("");
  check(
    "empty query returns discovery results",
    r.length > 0
  );
  check(
    "discovery includes the favorite tab",
    r.some(
      (x) => x.source === "tab" && x.title.includes("GitHub")
    )
  );
  check(
    "discovery excludes archived workspaces",
    !r.some((x) => x.title === "Old Receipts")
  );
  check(
    "discovery includes recent tabs",
    r.some((x) => x.source === "tab")
  );

  console.log("\n" + "=".repeat(64));
  console.log(` RESULT: ${passed} passed, ${failed} failed`);
  console.log("=".repeat(64));

  if (failed > 0) {
    process.exit(1);
  }
}

run();
