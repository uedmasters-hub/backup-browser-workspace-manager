/**
 * Auto Group Tabs harness: categories, site groups, existing groups, planning.
 * Run: npx tsx scripts/autoGroupHarness.ts
 */
import {
  categorize,
  categoryKeyFromTitle,
  groupKeyForTab,
  planAutoGroups,
  resolveGroupKey,
  siteName,
  siteOf,
  type PlanTab,
} from "../src/browser/services/tabCategories";

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean, detail = "") {
  if (cond) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label} ${detail}`); }
}
let nextIndex = 0;
function tab(id: number, url: string, title: string, groupId = -1, extra: Partial<PlanTab> = {}): PlanTab {
  return { id, windowId: 1, index: nextIndex++, groupId, url, title, pinned: false, lastAccessed: 1000 + id, ...extra };
}
const cat = (url: string, title = "") => categorize({ url, title })?.key ?? null;
function expectCat(url: string, title: string, want: string | null) {
  const got = cat(url, title);
  check(`${url.slice(0, 60)} ${title ? `“${title.slice(0, 40)}” ` : ""}→ ${want}`, got === want, `(got ${got})`);
}

console.log("Known sites");
expectCat("https://www.figma.com/design/abc/Checkout", "Checkout – Figma", "cat:design");
expectCat("https://github.com/uedmasters-hub/backup-browser-workspace-manager", "repo", "cat:development");
expectCat("https://mail.google.com/mail/u/0/#inbox", "Inbox (12) - me@gmail.com - Gmail", "cat:work");
expectCat("https://docs.google.com/document/d/1/edit", "Q3 plan - Google Docs", "cat:work");
expectCat("https://www.google.com/maps/place/Goa", "Goa - Google Maps", "cat:travel");
expectCat("https://www.google.co.in/maps/@15.2,74.1,10z", "Google Maps", "cat:travel");
expectCat("https://www.irctc.co.in/nget/train-search", "IRCTC Next Generation", "cat:travel");
expectCat("https://netbanking.hdfcbank.com/netbanking/", "HDFC Bank", "cat:finance");
expectCat("https://kite.zerodha.com/dashboard", "Dashboard / Kite", "cat:finance");
expectCat("https://www.practo.com/bangalore/dermatologist", "Dermatologists", "cat:healthcare");
expectCat("https://pubmed.ncbi.nlm.nih.gov/123/", "Study", "cat:healthcare");
expectCat("https://www.ncbi.nlm.nih.gov/books/", "Bookshelf", "cat:research");
expectCat("https://en.wikipedia.org/wiki/Gestalt_psychology", "Gestalt psychology - Wikipedia", "cat:research");
expectCat("https://www.linkedin.com/feed/", "Feed | LinkedIn", "cat:social");
expectCat("https://www.linkedin.com/learning/ux-foundations", "UX Foundations", "cat:learning");
expectCat("https://chatgpt.com/c/123", "ChatGPT", "cat:ai");
expectCat("https://claude.ai/chat/1", "Claude", "cat:ai");
expectCat("https://www.amazon.in/dp/B0", "Amazon.in", "cat:shopping");
expectCat("https://console.aws.amazon.com/ec2/", "EC2", "cat:development");
expectCat("https://www.youtube.com/watch?v=1", "Lofi beats", "cat:entertainment");
expectCat("https://www.thehindu.com/news/national/", "National News", "cat:news");
expectCat("https://economictimes.indiatimes.com/markets/stocks", "Stocks", "cat:finance");
expectCat("https://timesofindia.indiatimes.com/india", "India News", "cat:news");

console.log("\nLocal and private");
expectCat("http://localhost:5173/", "Vite + React", "cat:development");
expectCat("http://127.0.0.1:8080/admin", "Admin", "cat:development");
expectCat("http://myapp.test/", "My app", "cat:development");
expectCat("chrome://extensions/", "Extensions", null);
expectCat("about:blank", "", null);
expectCat("not a url", "", null);

console.log("\nSite name hints");
expectCat("https://app.emedicalls.com/appointments", "Appointments | eMedicalls", "cat:healthcare");
expectCat("https://www.acmehealthlabs.co.in/", "Acme", "cat:healthcare");
expectCat("https://mytravelbuddy.io/plans", "Plans", "cat:travel");
expectCat("https://api.somecompany.com/v1/docs", "Reference", "cat:development");
expectCat("https://www.cs.stanford.edu/people", "People", "cat:research");
check("hint strength is recorded", categorize({ url: "https://app.emedicalls.com/", title: "x" })?.strength === "hint");
check("known-site strength is recorded", categorize({ url: "https://figma.com/", title: "x" })?.strength === "site");

console.log("\nKeywords (need more than one hit)");
expectCat("https://www.google.com/search?q=cheap+flights+to+goa", "cheap flights to goa - Google Search", "cat:travel");
expectCat("https://www.bing.com/search?q=symptoms+of+dengue+fever+treatment", "symptoms of dengue - Search", "cat:healthcare");
expectCat("https://duckduckgo.com/?q=react+useeffect+cleanup", "react useeffect cleanup at DuckDuckGo", "cat:development");
expectCat("https://www.google.com/search?q=weather", "weather - Google Search", null);
expectCat("https://randomblog.example/2026/best-hotels-in-goa", "Best hotels in Goa", "cat:travel");
expectCat("https://randomblog.example/post", "My thoughts on design", null);
expectCat("https://randomblog.example/post", "Design system typography and color palette", "cat:design");
check("notification counts are ignored", cat("https://x.example/", "(3) flights and hotels") === "cat:travel");
check("keywords are whole words (no 'api' in 'capital')", cat("https://capitalcity.example/", "Capital city guide") !== "cat:development");
check("page metadata counts", cat("https://unknownsite.example/", "Home") === null &&
  categorize({ url: "https://unknownsite.example/", title: "Home", meta: { description: "Online pharmacy, doctor consultations and lab tests" } })?.key === "cat:healthcare");
check("site name hints avoid lookalikes ('stripe' is not travel)", cat("https://stripesupply.example/", "Home") !== "cat:travel");
check("'schedule' is not learning", cat("https://myschedule.example/", "Home") !== "cat:learning");

console.log("\nSites and names");
const s1 = siteOf("https://app.emedicalls.co.in/x")!;
check("registrable domain via the public suffix list", s1.site === "emedicalls.co.in" && s1.label === "emedicalls", JSON.stringify(s1.site));
check("github.io pages are separate sites", siteOf("https://a.github.io/")!.site !== siteOf("https://b.github.io/")!.site);
check("www. is ignored", siteOf("https://www.acme.com/")!.site === "acme.com");
check("localhost keeps its port", siteOf("http://localhost:3000/")!.site === "localhost:3000");
check("site name from tab titles keeps its casing",
  siteName(siteOf("https://acmecorp.com/")!, [{ url: "", title: "Dashboard | AcmeCorp" }]) === "AcmeCorp");
check("site name from metadata", siteName(siteOf("https://zxq.com/")!, [{ url: "", title: "Home", meta: { siteName: "Zed Quarterly" } }]) === "Zed Quarterly");
check("site name falls back to the capitalised domain", siteName(siteOf("https://zxq.com/")!, [{ url: "", title: "Home" }]) === "Zxq");
check("unknown site → site key", groupKeyForTab({ url: "https://zxq.com/a", title: "Home" })?.key === "site:zxq.com");
check("plain search with no topic → stays put", groupKeyForTab({ url: "https://www.google.com/search?q=weather", title: "weather" }) === null);

console.log("\nExisting group titles");
check("'💼 Work' is Work", categoryKeyFromTitle("💼 Work") === "cat:work");
check("'dev' is Development", categoryKeyFromTitle("dev") === "cat:development");
check("'UI/UX' is Design", categoryKeyFromTitle("UI/UX") === "cat:design");
check("'Money' is Finance", categoryKeyFromTitle("Money") === "cat:finance");
check("'Client X' is the user's own", categoryKeyFromTitle("Client X") === null);
check("remembered key survives a rename",
  resolveGroupKey({ id: 7, windowId: 1, title: "Acme launch" }, [], { 7: "cat:work" }) === "cat:work");
check("site group recognised by name",
  resolveGroupKey({ id: 8, windowId: 1, title: "Zxq" }, [tab(1, "https://zxq.com/a", "Home", 8)]) === "site:zxq.com");

console.log("\nPlanning");
const tabs: PlanTab[] = [
  tab(1, "https://figma.com/a", "A – Figma"),
  tab(2, "https://dribbble.com/shots/1", "Shot"),
  tab(3, "https://github.com/x", "x"),
  tab(4, "https://stackoverflow.com/q/1", "q"),
  tab(5, "https://booking.com/h", "Hotel"),             // single travel tab → stays loose
  tab(6, "https://zxq.com/a", "A | Zxq"),
  tab(7, "https://zxq.com/b", "B | Zxq"),              // two zxq tabs → site group "Zxq"
  tab(8, "https://only.example/", "Lonely"),           // single unknown → stays loose
  tab(9, "https://mail.google.com/", "Inbox", 50),     // inside a user group → untouched
  tab(10, "https://slack.com/", "Slack", -1, { pinned: true }),
  tab(11, "https://notion.so/p", "Plan"),
  tab(12, "https://youtube.com/watch?v=1", "Video"),   // marked manual below
  tab(13, "https://netflix.com/", "Netflix"),
  tab(14, "chrome://newtab/", "New Tab"),
  tab(20, "https://figma.com/b", "B – Figma", -1, { windowId: 2 }),
];
const plan = planAutoGroups({
  tabs,
  groups: [
    { id: 50, windowId: 1, title: "Client X" },
    { id: 60, windowId: 1, title: "💼 Work" },
  ],
  manualTabIds: [12],
});
const byKey = (k: string, w = 1) => plan.groups.find((g) => g.key === k && g.windowId === w);
check("Design gets the two design tabs", JSON.stringify(byKey("cat:design")?.tabIds.slice().sort()) === "[1,2]");
check("Development gets github + stackoverflow", byKey("cat:development")?.tabIds.length === 2);
check("new group title has its emoji", byKey("cat:design")?.title === "🎨 Design");
check("a single travel tab doesn't make a group", !byKey("cat:travel"));
check("same-site tabs get a site group", byKey("site:zxq.com")?.title === "Zxq");
check("a lone unknown tab stays loose", !plan.groups.some((g) => g.tabIds.includes(8)));
check("tabs in the user's own group stay put", !plan.groups.some((g) => g.tabIds.includes(9)));
check("pinned tabs stay put", !plan.groups.some((g) => g.tabIds.includes(10)));
check("a single Work tab joins the existing 'Work' group (no duplicate)", byKey("cat:work")?.groupId === 60 && byKey("cat:work")?.tabIds[0] === 11);
check("manually placed tabs stay put", !plan.groups.some((g) => g.tabIds.includes(12)));
check("…so the lone Netflix tab stays loose", !byKey("cat:entertainment"));
check("new-tab pages stay put", !plan.groups.some((g) => g.tabIds.includes(14)));
check("windows are planned separately (no moving between windows)", !byKey("cat:design", 2) && byKey("cat:design")!.tabIds.every((id) => id !== 20));
check("tab count adds up", plan.tabCount === plan.groups.reduce((n, g) => n + g.tabIds.length, 0) && plan.tabCount === 7, String(plan.tabCount));
check("kept-in-groups counts grouped tabs", plan.keptInGroups === 1, String(plan.keptInGroups));
check("newest group first", plan.groups.every((g, i, a) => i === 0 || a[i - 1].newest >= g.newest));
check("newest tab first within a group", byKey("site:zxq.com")!.tabIds[0] === 7);
const again = planAutoGroups({ tabs: [tab(30, "https://figma.com/x", "x"), tab(31, "https://figma.com/y", "y")], groups: [{ id: 70, windowId: 1, title: "UI" }] });
check("an existing 'UI' group is reused for Design", again.groups.length === 1 && again.groups[0].groupId === 70);
const dupes = planAutoGroups({
  tabs: [tab(40, "https://figma.com/x", "x"), tab(41, "https://figma.com/y", "y", 81), tab(42, "https://figma.com/z", "z", 81)],
  groups: [{ id: 80, windowId: 1, title: "Design" }, { id: 81, windowId: 1, title: "🎨 Design" }],
});
check("with two Design groups, the bigger one is used", dupes.groups[0]?.groupId === 81);
const withoutDesign = planAutoGroups({ tabs, groups: [{ id: 50, windowId: 1, title: "Client X" }], manualTabIds: [12], excludeKeys: ["cat:design", "site:zxq.com"] });
check("excluded groups are left out", !withoutDesign.groups.some((g) => g.key === "cat:design" || g.key === "site:zxq.com") && withoutDesign.groups.some((g) => g.key === "cat:development"));
check("nothing to do → empty plan", planAutoGroups({ tabs: [], groups: [] }).tabCount === 0);
const perf = Array.from({ length: 300 }, (_, i) => tab(1000 + i, `https://site${i % 40}.example/p/${i}`, `Page ${i} hotels flights`));
const t0 = performance.now();
planAutoGroups({ tabs: perf, groups: [] });
const ms = performance.now() - t0;
check(`300 tabs plan quickly (${ms.toFixed(0)} ms)`, ms < 250);

console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
