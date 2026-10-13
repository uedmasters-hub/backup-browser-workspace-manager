/**
 * Release-notes harness: which "What's new" lines a user sees after an update.
 * Run: npx tsx scripts/releaseNotesHarness.ts
 */
import { notesBetween, compareVersions, RELEASE_NOTES } from "../src/constants/releaseNotes";
import pkg from "../package.json";

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean, detail = "") {
  if (cond) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label} ${detail}`); }
}
const versions = (from: string, to: string) => notesBetween(from, to).map((s) => s.version).join(",");

check("1.2.0 → 1.2.1 shows only 1.2.1", versions("1.2.0", "1.2.1") === "1.2.1", versions("1.2.0", "1.2.1"));
check("1.1.0 → 1.2.1 shows both, newest first", versions("1.1.0", "1.2.1") === "1.2.1,1.2.0");
check("same version shows nothing", versions("1.2.1", "1.2.1") === "");
check("downgrade shows nothing", versions("1.2.1", "1.2.0") === "");
check("numeric, not string, compare (1.10 > 1.9)", compareVersions("1.10.0", "1.9.0") > 0);
check("missing parts count as 0 (1.2 == 1.2.0)", compareVersions("1.2", "1.2.0") === 0);
check("every entry has at least one line", Object.values(RELEASE_NOTES).every((n) => n.length > 0));
check("lines are short (≤ 90 chars)", Object.values(RELEASE_NOTES).flat().every((l) => l.length <= 90));
check(`package version ${pkg.version} has notes or is older`, pkg.version in RELEASE_NOTES || compareVersions(pkg.version, "1.2.1") < 0);

console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
