// Скачивает шрифты Google Fonts, которые подключают игры, и кладёт их рядом с игрой,
// чтобы без интернета игры выглядели так же, как с ним.
// Использование: node scripts/localize-fonts.js dist/games/<игра>/index.html ...
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const get = (url, out) => execFileSync("curl", ["-sSfL", "--retry", "3", "-A", UA, ...(out ? ["-o", out] : []), url], { maxBuffer: 1 << 26 });

for (const file of process.argv.slice(2)) {
  let html = fs.readFileSync(file, "utf8");
  const links = [...html.matchAll(/<link[^>]+href="(https:\/\/fonts\.googleapis\.com\/css2?\?[^"]+)"[^>]*>/g)];
  if (!links.length) continue;
  const dir = path.join(path.dirname(file), "fonts");
  fs.mkdirSync(dir, { recursive: true });
  let n = 0;
  links.forEach((m, i) => {
    let css = get(m[1].replace(/&amp;/g, "&")).toString();
    css = css.replace(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g, (_, u) => {
      const name = `font-${++n}.woff2`;
      get(u, path.join(dir, name));
      return `url(${name})`;
    });
    const cssName = `fonts-${i + 1}.css`;
    fs.writeFileSync(path.join(dir, cssName), css);
    html = html.replace(m[0], `<link rel="stylesheet" href="fonts/${cssName}">`);
  });
  // preconnect к серверам шрифтов больше не нужен
  html = html.replace(/<link[^>]+href="https:\/\/fonts\.(googleapis|gstatic)\.com"[^>]*>\s*/g, "");
  fs.writeFileSync(file, html);
  console.log(`  шрифты: ${path.basename(path.dirname(file))} — ${n} файлов`);
}
