#!/usr/bin/env bash
# Production release for the Chrome Web Store.
#
#   bash scripts/release.sh            # release the version in package.json
#   bash scripts/release.sh 1.2.1      # bump to 1.2.1 first (commits the bump)
#
# What it does, stopping at the first problem:
#   1. Checks the repo: clean tree, on main, up to date with GitHub
#   2. Checks the version: valid for the store, higher than the last release,
#      not already tagged, has a CHANGELOG entry
#   3. Clean install (npm ci), lint, every test harness, production build
#   4. Checks the built manifest: version, MV3, permissions unchanged from the
#      published listing (new ones would disable the extension for users until
#      they re-approve), no dev-server leftovers, all referenced files present
#   5. Zips dist/ into release/browser-workspace-manager-v<version>.zip
#   6. Tags the release locally (v<version>) — you push when ready
#
# Works on macOS, Linux and Git Bash on Windows.

set -euo pipefail

# Permissions on the published store listing. Change these ONLY together with
# a deliberate permission change (and an updated store justification).
PUBLISHED_PERMISSIONS="tabs tabGroups storage bookmarks history downloads sessions scripting"
PUBLISHED_HOSTS="<all_urls>"

# Template leftovers in public/ that nothing references — kept out of the zip.
ZIP_EXCLUDE=("*.DS_Store" "*.map" "favicon.svg" "icons.svg")

say()  { printf '\n\033[1;34m▸ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m  ✓ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m  ! %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

json() { node -p "require('./$1')$2"; }

# version_gt A B  → true if A > B (dot-separated integers)
version_gt() {
  node -e '
    const [a, b] = process.argv.slice(1).map(v => v.split(".").map(Number));
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const d = (a[i] || 0) - (b[i] || 0);
      if (d) process.exit(d > 0 ? 0 : 1);
    }
    process.exit(1);
  ' "$1" "$2"
}

# ---------------------------------------------------------------------------
say "Checking the repository"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "Not inside a git repo."
cd "$(git rev-parse --show-toplevel)"
[ "$(json package.json .name)" = "browser-workspace-manager" ] \
  || fail "Run this from the browser-workspace-manager project."
command -v node >/dev/null && command -v npm >/dev/null || fail "Node.js 20+ and npm are required."
command -v zip >/dev/null || fail "'zip' is required (macOS/Linux have it; on Windows use Git Bash with zip installed)."

[ -z "$(git status --porcelain)" ] \
  || fail "Uncommitted changes. Commit or stash them so the release matches git exactly:
$(git status --short)"
ok "Working tree clean"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[ "$BRANCH" = "main" ] && ok "On main" || warn "On branch '$BRANCH', not main"

if git fetch -q origin 2>/dev/null; then
  BEHIND="$(git rev-list --count HEAD..origin/"$BRANCH" 2>/dev/null || echo 0)"
  [ "$BEHIND" = "0" ] && ok "Up to date with GitHub" \
    || fail "$BEHIND commit(s) behind origin/$BRANCH — run 'git pull' first."
else
  warn "Couldn't reach GitHub to check for newer commits"
fi

# ---------------------------------------------------------------------------
say "Checking the version"
CURRENT="$(json package.json .version)"
if [ $# -ge 1 ]; then
  NEW="$1"
  [[ "$NEW" =~ ^[0-9]+(\.[0-9]+){0,3}$ ]] \
    || fail "Version must be 1–4 dot-separated numbers (e.g. 1.2.1)."
  version_gt "$NEW" "$CURRENT" || fail "New version $NEW must be higher than $CURRENT."
  npm version "$NEW" --no-git-tag-version >/dev/null
  git add package.json package-lock.json
  git commit -q -m "chore(release): v$NEW"
  ok "Bumped $CURRENT → $NEW (committed)"
  # If a later check fails, the bump stays committed — say how to carry on.
  trap 'code=$?; [ $code -ne 0 ] && printf "\n  The version is already bumped to %s and committed.\n  Fix the problem, then run:  bash scripts/release.sh   (no version)\n  Or undo the bump:           git reset --hard HEAD~1\n" "$NEW"' EXIT
  VERSION="$NEW"
else
  VERSION="$CURRENT"
fi

for part in ${VERSION//./ }; do
  [ "$part" -le 65535 ] || fail "Store versions allow numbers up to 65535 (got $VERSION)."
done

LAST_TAG="$(git tag --list 'v*' --sort=-v:refname | head -1)"
if git rev-parse -q --verify "refs/tags/v$VERSION" >/dev/null; then
  fail "v$VERSION is already tagged. Bump the version: bash scripts/release.sh <new-version>"
fi
if [ -n "$LAST_TAG" ]; then
  version_gt "$VERSION" "${LAST_TAG#v}" || fail "v$VERSION isn't higher than the last release $LAST_TAG."
fi
ok "Releasing v$VERSION${LAST_TAG:+ (last release $LAST_TAG)}"

grep -q "^## v$VERSION" CHANGELOG.md \
  && ok "CHANGELOG has a v$VERSION entry" \
  || warn "CHANGELOG.md has no '## v$VERSION' heading — consider adding release notes"

grep -q "\"$VERSION\":" src/constants/releaseNotes.ts \
  && ok "In-app \"What's new\" notes for v$VERSION" \
  || warn "src/constants/releaseNotes.ts has no \"$VERSION\" entry — users will see a generic \"Fixes and improvements\""

# ---------------------------------------------------------------------------
say "Clean install"
npm ci --no-audit --no-fund --loglevel=error
ok "Dependencies installed from package-lock.json"

say "Lint"
npm run --silent lint
ok "ESLint clean"

say "Test harnesses"
for h in scripts/*Harness.ts; do
  name="$(basename "$h")"
  if out="$(npx -y tsx "$h" 2>&1)"; then
    ok "$name — $(echo "$out" | grep -E 'passed' | tail -1 | sed 's/^ *//')"
  else
    echo "$out" | tail -20
    fail "$name failed"
  fi
done

say "Production build"
rm -rf dist
NODE_ENV=production npm run --silent build >/dev/null
[ -f dist/manifest.json ] || fail "Build produced no dist/manifest.json."
ok "TypeScript + Vite build"

# ---------------------------------------------------------------------------
say "Checking the built manifest"
M="dist/manifest.json"
[ "$(json "$M" .manifest_version)" = "3" ] || fail "manifest_version is not 3."
[ "$(json "$M" .version)" = "$VERSION" ] || fail "dist manifest version $(json "$M" .version) ≠ $VERSION."
ok "Manifest V3, version $VERSION"

BUILT_PERMS="$(node -p "(require('./$M').permissions||[]).join(' ')")"
BUILT_HOSTS="$(node -p "(require('./$M').host_permissions||[]).join(' ')")"
ADDED="$(comm -13 <(tr ' ' '\n' <<<"$PUBLISHED_PERMISSIONS $PUBLISHED_HOSTS" | sort) \
                  <(tr ' ' '\n' <<<"$BUILT_PERMS $BUILT_HOSTS" | sort) | tr '\n' ' ')"
REMOVED="$(comm -23 <(tr ' ' '\n' <<<"$PUBLISHED_PERMISSIONS $PUBLISHED_HOSTS" | sort) \
                    <(tr ' ' '\n' <<<"$BUILT_PERMS $BUILT_HOSTS" | sort) | tr '\n' ' ')"
[ -z "${ADDED// }" ] || fail "New permissions vs the store listing: $ADDED
Users would see a warning and the extension would be disabled until they accept.
If that's intended, update PUBLISHED_PERMISSIONS in this script and the store justifications."
[ -z "${REMOVED// }" ] || warn "Permissions no longer requested: $REMOVED(fine — update PUBLISHED_PERMISSIONS after release)"
ok "Permissions match the published listing: $BUILT_PERMS + host $BUILT_HOSTS"

if grep -rqE "localhost:5173|@vite/client|/@crx/" dist; then
  fail "dist contains dev-server references — it was built in dev mode."
fi
ok "No dev-server leftovers"

MISSING="$(node -e '
  const fs = require("fs"); const m = require("./dist/manifest.json");
  const files = [
    ...Object.values(m.icons || {}),
    ...Object.values((m.action || {}).default_icon || {}),
    (m.action || {}).default_popup,
    (m.background || {}).service_worker,
    ...(m.content_scripts || []).flatMap(c => [...(c.js || []), ...(c.css || [])]),
  ].filter(Boolean);
  console.log(files.filter(f => !fs.existsSync("dist/" + f)).join(" "));
')"
[ -z "$MISSING" ] || fail "Manifest points at missing files: $MISSING"
ok "Every file the manifest references exists"

# ---------------------------------------------------------------------------
say "Packaging"
mkdir -p release
ZIP="release/browser-workspace-manager-v$VERSION.zip"
rm -f "$ZIP"
EXCLUDES=()
for p in "${ZIP_EXCLUDE[@]}"; do EXCLUDES+=(-x "$p"); done
(cd dist && zip -qr -X -9 "../$ZIP" . "${EXCLUDES[@]}")

unzip -l "$ZIP" | grep -q " manifest.json$" || fail "manifest.json isn't at the top of the zip."
SIZE="$(du -h "$ZIP" | cut -f1 | tr -d ' ')"
COUNT="$(unzip -Z1 "$ZIP" | grep -vc '/$')"
if command -v shasum >/dev/null; then SHA="$(shasum -a 256 "$ZIP" | cut -d' ' -f1)"
else SHA="$(sha256sum "$ZIP" | cut -d' ' -f1)"; fi
ok "$ZIP ($SIZE, $COUNT files)"

git tag -a "v$VERSION" -m "Release v$VERSION"
ok "Tagged v$VERSION (local)"

cat <<EOF

────────────────────────────────────────────────────────────
 v$VERSION is ready
────────────────────────────────────────────────────────────
 Package : $(pwd)/$ZIP
 SHA-256 : $SHA

 1. Push the release:
      git push origin $BRANCH --follow-tags
 2. Chrome Web Store Developer Dashboard → your item → Package
      → "Upload new package" → choose the zip above
 3. Check the draft shows Version $VERSION and the same permissions,
    then "Submit for review".
EOF
