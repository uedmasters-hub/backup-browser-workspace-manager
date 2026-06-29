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
      get: async (key: string) =>
        key === "favoriteTabs"
          ? { favoriteTabs: ["https://react.dev/reference/react"] }
          : {},
      set: async () => undefined,
      remove: async () => undefined,
    },
  },
  bookmarks: {
    getTree: async () => [
      {
        id: "root",
        title: "",
        children: [
          { id: "b1", title: "React Docs", url: "https://react.dev/learn" },
          // Same URL as tab #1 -> exercises cross-source de-dupe.
          { id: "b2", title: "React on GitHub", url: "https://github.com/facebook/react" },
          { id: "b3", title: "Cooking recipes", url: "https://recipes.com" },
        ],
      },
    ],
  },
  history: {
    search: async ({ text }: { text: string }) => {
      const HISTORY = [
        { id: "h1", title: "React Tutorial", url: "https://react.dev/learn", lastVisitTime: NOW - DAY, visitCount: 9 },
        { id: "h2", title: "Old React Blog", url: "https://blog.example.com/react", lastVisitTime: NOW - 10 * DAY, visitCount: 2 },
        { id: "h3", title: "Weather", url: "https://weather.com", lastVisitTime: NOW, visitCount: 50 },
      ];
      const q = text.toLowerCase();
      return HISTORY.filter(
        (h) =>
          h.title.toLowerCase().includes(q) ||
          h.url.toLowerCase().includes(q)
      );
    },
  },
  downloads: {
    search: async () => [
      { id: 1, filename: "/Users/me/Downloads/react-cheatsheet.pdf", url: "https://files.com/react-cheatsheet.pdf", finalUrl: "https://files.com/react-cheatsheet.pdf", state: "complete", exists: true },
      { id: 2, filename: "/Users/me/Downloads/invoice.pdf", url: "https://files.com/invoice.pdf", finalUrl: "https://files.com/invoice.pdf", state: "complete", exists: true },
    ],
    open: async () => undefined,
    show: () => undefined,
  },
  sessions: {
    getRecentlyClosed: async () => [
      { lastModified: Math.floor(NOW / 1000), tab: { sessionId: "s1", title: "React Conf 2025", url: "https://reactconf.com" } },
    ],
    restore: async () => undefined,
  },
};

// ---- Imports (after the mock is installed) ----------------------------------

import { useWindowStore } from "../src/stores/windowStore";
import SearchEngine from "../src/search/engine/SearchEngine";
import ProviderRegistry from "../src/search/providers/ProviderRegistry";
import { useSearchStore } from "../src/stores/searchStore";

import type { WorkspaceWindow } from "../src/types/window";

// ---- Seed workspaces directly into the store --------------------------------

const iso = (offsetDays: number) =>
  new Date(NOW - offsetDays * DAY).toISOString();

const WORKSPACES: WorkspaceWindow[] = [
  { id: 10, chromeWindowId: 10, name: "React Project", color: "#DDEDEB", emoji: "💻", tabCount: 3, isActive: true, isFavorite: true, isArchived: false, createdAt: iso(20), updatedAt: iso(0) },
  { id: 11, chromeWindowId: 11, name: "Research", color: "#FFE9A8", emoji: "🧠", tabCount: 2, isActive: false, isFavorite: false, isArchived: false, createdAt: iso(15), updatedAt: iso(5) },
  { id: 12, chromeWindowId: 12, name: "Design Work", color: "#DDD0F6", emoji: "🎨", tabCount: 2, isActive: false, isFavorite: false, isArchived: false, createdAt: iso(10), updatedAt: iso(3) },
  { id: 13, chromeWindowId: 13, name: "Old Receipts", color: "#F8CDE2", emoji: "📦", tabCount: 1, isActive: false, isFavorite: false, isArchived: true, createdAt: iso(40), updatedAt: iso(40) },
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

  // 1. Exact-ish workspace name match ranks the workspace first.
  let r = await show("react");
  check(
    "'react' returns results",
    r.length > 0
  );
  check(
    "'react' top result is the React Project workspace",
    r[0]?.source === "workspace" && r[0]?.title === "React Project",
    r[0]?.title
  );
  check(
    "'react' also matches react.dev tab",
    r.some((x) => x.source === "tab" && x.title.includes("React Hooks"))
  );
  {
    const hooks = r.find((x) => x.title.includes("React Hooks"));
    const github = r.find((x) => x.title.includes("GitHub"));
    check(
      "favorited react.dev tab is boosted above the GitHub tab",
      !!hooks && !!github && hooks!.score > github!.score,
      `${hooks?.score?.toFixed(1)} vs ${github?.score?.toFixed(1)}`
    );
  }

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

  // 6. Results are grouped into sections; score descends WITHIN each section.
  r = await show("re");
  let perSectionSorted = true;
  for (let i = 1; i < r.length; i++) {
    if (
      r[i].source === r[i - 1].source &&
      r[i].score > r[i - 1].score
    ) {
      perSectionSorted = false;
    }
  }
  check("results sorted by score within each section", perSectionSorted);

  // 7. Favorite boost: React Project (favorite) outranks Research on "re"
  //    when both match by prefix.
  const reProject = r.find((x) => x.title === "React Project");
  const research = r.find((x) => x.title === "Research");
  check(
    "favorite workspace outranks non-favorite on equal prefix match",
    !!reProject && !!research && reProject!.score > research!.score,
    `${reProject?.score?.toFixed(1)} vs ${research?.score?.toFixed(1)}`
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

  // --- Level 2 (Universal) ---

  r = await show("react");
  check(
    "results span multiple sources (tab + bookmark + history)",
    new Set(r.map((x) => x.source)).size >= 3,
    [...new Set(r.map((x) => x.source))].join(",")
  );
  check(
    "bookmark provider returns the React Docs bookmark",
    r.some((x) => x.source === "bookmark" && x.title.includes("React Docs"))
  );
  check(
    "history provider returns a react history item",
    r.some((x) => x.source === "history")
  );
  check(
    "session provider returns React Conf",
    r.some((x) => x.source === "session" && x.title.includes("React Conf"))
  );

  // De-dupe: github.com/facebook/react is a tab AND a bookmark -> one row.
  {
    const gh = r.filter(
      (x) =>
        (x.payload as { url?: string })?.url ===
        "https://github.com/facebook/react"
    );
    check(
      "duplicate URL (tab + bookmark) collapses to one row",
      gh.length === 1,
      `count ${gh.length}`
    );
    check(
      "de-dupe keeps the higher-scored (tab) row",
      gh[0]?.source === "tab",
      gh[0]?.source
    );
  }

  // Section order: a Level-1 row precedes the first Level-2 row.
  {
    const firstTab = r.findIndex((x) => x.source === "tab");
    const firstBookmark = r.findIndex((x) => x.source === "bookmark");
    check(
      "Level-1 (tab) is arranged before Level-2 (bookmark)",
      firstTab >= 0 && firstBookmark >= 0 && firstTab < firstBookmark
    );
  }

  // Lazy Level-2: a 1-char query yields no Level-2 results.
  r = await show("r");
  check(
    "single-char query skips Level-2 providers",
    !r.some((x) =>
      ["bookmark", "history", "download", "session", "archive"].includes(
        x.source
      )
    )
  );

  // 11. Discovery: empty query surfaces favorites + recent tabs.
  r = await show("");
  check(
    "empty query returns discovery results",
    r.length > 0
  );
  check(
    "discovery includes the favorite workspace",
    r.some(
      (x) => x.source === "workspace" && x.title === "React Project"
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
  // --- search selection -> group tabs ---
  {
    type ChromeLike = {
      tabs: {
        get: (id: number) => Promise<{ id: number; windowId: number }>;
        group: (arg: { tabIds: number[] }) => Promise<number>;
        move: (...a: unknown[]) => Promise<unknown>;
        query: (...a: unknown[]) => Promise<unknown[]>;
        remove: (...a: unknown[]) => Promise<unknown>;
      };
      tabGroups?: {
        update: (...a: unknown[]) => Promise<unknown>;
        move: (...a: unknown[]) => Promise<unknown>;
        get: (id: number) => Promise<{ windowId: number }>;
      };
      windows: { update: (...a: unknown[]) => Promise<unknown> };
    };
    const C = (globalThis as unknown as { chrome: ChromeLike }).chrome;

    let grouped: number[] | null = null;
    let titled = "";
    C.tabs.get = async (id: number) => ({ id, windowId: 1 });
    C.tabs.group = async ({ tabIds }: { tabIds: number[] }) => {
      grouped = tabIds;
      return 99;
    };
    C.tabs.move = async () => undefined;
    let movedIndex: number | null = null;
    C.tabGroups = {
      update: async (_id: number, u: { title?: string }) => {
        titled = u.title ?? "";
        return undefined;
      },
      move: async (_id: number, info: { index: number }) => {
        movedIndex = info.index;
        return undefined;
      },
      get: async () => ({ windowId: 1 }),
    };
    const origQuery = C.tabs.query;
    C.tabs.query = async (q: { pinned?: boolean }) =>
      q && q.pinned ? [] : origQuery(q); // no pinned tabs
    C.windows.update = async () => undefined;

    const r = await SearchEngine.search("react");
    const tabResults = r.filter((x) => x.source === "tab");
    useSearchStore.setState({
      results: r,
      query: "react",
      selectedIds: tabResults.map((x) => x.id),
    });

    await useSearchStore.getState().groupSelected();

    check(
      "groupSelected groups the selected tab ids",
      Array.isArray(grouped) && grouped.length === tabResults.length,
      `grouped ${grouped ? grouped.length : 0} of ${tabResults.length}`
    );
    check("group is titled from the query", titled === "react", titled);
    check("group is moved to the front (index 0)", movedIndex === 0, String(movedIndex));
    check(
      "selection cleared after grouping",
      useSearchStore.getState().selectedIds.length === 0
    );

    // close a tab result removes it from the list
    {
      const r2 = await SearchEngine.search("react");
      const tab = r2.find((x) => x.source === "tab");
      let removed: number[] | null = null;
      C.tabs.remove = async (ids: number[]) => {
        removed = ids;
        return undefined;
      };
      useSearchStore.setState({ results: r2, query: "react" });
      if (tab) {
        await useSearchStore.getState().closeTabResult(tab.id);
        check(
          "closeTabResult calls tabs.remove",
          Array.isArray(removed) && removed.length === 1
        );
        check(
          "closed result is removed from the list",
          !useSearchStore
            .getState()
            .results.some((x) => x.id === tab.id)
        );
      }
    }

    // clear recent searches
    useSearchStore.setState({ recentSearches: ["a", "b"] });
    useSearchStore.getState().clearRecentSearches();
    check(
      "clearRecentSearches empties recents",
      useSearchStore.getState().recentSearches.length === 0
    );
  }

  console.log(` RESULT: ${passed} passed, ${failed} failed`);
  console.log("=".repeat(64));

  if (failed > 0) {
    process.exit(1);
  }
}

run();
