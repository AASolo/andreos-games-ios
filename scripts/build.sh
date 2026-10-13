#!/usr/bin/env bash
# Собирает сайт-приложение в dist/: меню из src/, свежие игры с GitHub,
# three.js и Pyodide локально (чтобы всё работало без интернета)
# и список файлов для офлайн-кэша.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist"
OWNER="AASolo"
GAMES=(doroga-v-okean ButerBashnya-1.0 kimchi-gleba HackQuest-3.0)
VERSION="${VERSION:-$(date -u +%Y%m%d%H%M)}"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

rm -rf "$DIST"
cp -r "$ROOT/src" "$DIST"
mkdir -p "$DIST/games"

for g in "${GAMES[@]}"; do
  echo "→ $g"
  git clone -q --depth 1 "https://github.com/$OWNER/$g.git" "$TMP/$g"
  rm -rf "$TMP/$g/.git"
  cp -r "$TMP/$g" "$DIST/games/$g"
  f="$DIST/games/$g/index.html"
  # Игры живут внутри приложения: свои манифесты и service worker им не нужны,
  # зато нужна кнопка «Домой» (на iPhone в полноэкранном режиме нет «Назад»)
  sed -i -E 's#<link rel="manifest"[^>]*>##g' "$f"
  sed -i "s#navigator.serviceWorker.register('sw.js')#Promise.resolve()#g" "$f"
  rm -f "$DIST/games/$g/sw.js"
  # Мост: уведомления о рекордах и уровнях в ленту 🔔 приложения (andreos-bridge.js)
  sed -i 's#</head>#<script src="../../andreos-bridge.js" defer></script></head>#' "$f"
  grep -q 'andreos-bridge.js' "$f" || { echo "Не нашёл </head> в $g" >&2; exit 1; }
  sed -i 's#</body>#<script src="../../game-shell.js"></script></body>#' "$f"
  grep -q 'game-shell.js' "$f" || { echo "Не нашёл </body> в $g" >&2; exit 1; }
done

( cd "$TMP" && npm pack --silent three@0.160.0 pyodide@0.26.4 >/dev/null )

# Дорога в океан: three.js локально
mkdir -p "$TMP/three"
tar xzf "$TMP/three-0.160.0.tgz" -C "$TMP/three"
cp "$TMP/three/package/build/three.min.js" "$DIST/games/doroga-v-okean/three.min.js"
sed -i 's#https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js#three.min.js#g' \
  "$DIST/games/doroga-v-okean/index.html"

# HackQuest: Pyodide локально. Он грузится из воркера-blob, поэтому нужен полный адрес,
# который считаем прямо на странице.
mkdir -p "$TMP/pyodide" "$DIST/games/HackQuest-3.0/pyodide"
tar xzf "$TMP/pyodide-0.26.4.tgz" -C "$TMP/pyodide"
for f in pyodide.js pyodide.asm.js pyodide.asm.wasm python_stdlib.zip pyodide-lock.json; do
  cp "$TMP/pyodide/package/$f" "$DIST/games/HackQuest-3.0/pyodide/"
done
sed -i "s#https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js#\"+new URL('pyodide/pyodide.js',location.href).href+\"#g" \
  "$DIST/games/HackQuest-3.0/index.html"

if grep -l 'cdn.jsdelivr.net' "$DIST"/games/*/index.html; then
  echo "Остались ссылки на CDN, обнови scripts/build.sh" >&2
  exit 1
fi

# Список файлов для офлайна: тяжёлый Pyodide докачивается отдельно, в фоне
( cd "$DIST" && find . -type f ! -name sw.js ! -name '*.md' ! -name LICENSE.txt | sed 's#^\./##' | sort ) > "$TMP/files"
grep -v '/pyodide/' "$TMP/files" > "$TMP/core"
grep '/pyodide/' "$TMP/files" > "$TMP/heavy" || true
node -e '
  const fs = require("fs");
  const [core, heavy, v, out] = process.argv.slice(1);
  const list = f => fs.readFileSync(f, "utf8").split("\n").filter(Boolean);
  fs.writeFileSync(out, `self.ASSETS = ${JSON.stringify({ version: v, core: ["./", ...list(core)], heavy: list(heavy) })};\n`);
' "$TMP/core" "$TMP/heavy" "$VERSION" "$DIST/assets.js"
sed -i "s#__VERSION__#$VERSION#g" "$DIST/sw.js" "$DIST/app.js"

touch "$DIST/.nojekyll"
du -sh "$DIST"
echo "Готово: версия $VERSION"
