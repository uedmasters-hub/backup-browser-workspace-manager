/**
 * App dock harness: ranking, window matching, icons.
 * Run: npx tsx scripts/appDockHarness.ts
 */
import {
  appKey,
  rankApps,
  windowsForApp,
  iconFromTabs,
  type DockTab,
} from "../src/browser/services/appDockRanking";

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean, detail = "") {
  if (cond) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label} ${detail}`); }
}

const now = Date.now();
const day = 86_400_000;
const history = [
  { url: "https://chatgpt.com/", title: "ChatGPT", visitCount: 40, lastVisitTime: now },
  { url: "https://chatgpt.com/c/abc", title: "Chat about X", visitCount: 30, lastVisitTime: now },
  { url: "https://www.youtube.com/", title: "YouTube", visitCount: 20, typedCount: 5, lastVisitTime: now },
  { url: "https://youtube.com/watch?v=1", title: "Video", visitCount: 5, lastVisitTime: now },
  { url: "https://github.com/", title: "GitHub", visitCount: 25, lastVisitTime: now },
  { url: "https://old.example.com/", title: "Old", visitCount: 999, lastVisitTime: now - 60 * day },
  { url: "chrome://settings/", title: "Settings", visitCount: 50, lastVisitTime: now },
  { url: "http://localhost:5173/", title: "Vite App", visitCount: 12, lastVisitTime: now },
];
const tabs: DockTab[] = [
  { id: 1, windowId: 10, url: "https://github.com/a", title: "repo a", active: false, incognito: false, lastAccessed: now - 5000, favicon: "https://github.com/fav.ico" },
  { id: 2, windowId: 10, url: "https://github.com/b", title: "repo b", active: true, incognito: false, lastAccessed: now - 9000 },
  { id: 3, windowId: 20, url: "https://www.github.com/c", title: "repo c", active: false, incognito: false, lastAccessed: now - 1000 },
  { id: 4, windowId: 30, url: "https://secret.example/", title: "private", active: true, incognito: true, lastAccessed: now },
];

check("www. and bare host are one app", appKey("https://www.youtube.com/x") === appKey("https://youtube.com/"));
check("port is part of the app", appKey("http://localhost:5173/") === "localhost:5173");
check("non-web URLs are not apps", appKey("chrome://settings") === null && appKey("file:///a") === null);

const apps = rankApps(history, tabs, { since: now - 30 * day });
const keys = apps.map((a) => a.key);
check("ranked by recent visits", keys[0] === "chatgpt.com", keys.join(","));
check("typed visits weigh more (youtube 20+10+5 = 35 > github 25+9)", keys.indexOf("youtube.com") < keys.indexOf("github.com"), keys.join(","));
check("visits older than the window are ignored", !keys.includes("old.example.com"));
check("chrome:// pages never appear", !keys.some((k) => k.startsWith("settings")));
check("private tabs never appear or count", !keys.includes("secret.example"));
check("name comes from the home page title", apps.find((a) => a.key === "youtube.com")?.name === "YouTube");
check("opens the variant the user visits most", apps.find((a) => a.key === "youtube.com")?.url === "https://www.youtube.com/");
check("hidden apps are excluded", !rankApps(history, tabs, { hidden: ["chatgpt.com"] }).some((a) => a.key === "chatgpt.com"));
check("limit is respected", rankApps(history, tabs, { limit: 2 }).length === 2);
check("open tabs alone still produce apps", rankApps([], tabs)[0]?.key === "github.com");

const wins = windowsForApp("github.com", tabs);
check("github is open in 2 windows", wins.length === 2, String(wins.length));
check("most recently used window first", wins[0].windowId === 20);
check("prefers the window's active tab", wins.find((w) => w.windowId === 10)?.tabId === 2);
check("counts tabs per window", wins.find((w) => w.windowId === 10)?.tabCount === 2);
check("not-open app has no windows", windowsForApp("chatgpt.com", tabs).length === 0);
check("icon from an open tab", iconFromTabs("github.com", tabs) === "https://github.com/fav.ico");
check("no icon from private tabs", iconFromTabs("secret.example", tabs) === undefined);

console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
