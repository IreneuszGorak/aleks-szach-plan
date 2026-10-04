import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const comment = `<!--
THESIS: The week is a shopping list you can check, not a dashboard of meal cards. The page refuses the icon grid and the three-stat hero.
OWN-WORLD: Bottle-green awning #12392C, cool gray-green paper #e7eee8, Familjen Grotesk, thermal ticket #f4efe2 set in Fragment Mono.
STORY: You set people, days, meals and a zloty cap, then read a week of real recipes and a receipt whose sums come from the data.
FIRST VIEWPORT: Headline and the button sit left; the receipt sits right, turned slightly, with real catalogue lines.
FORM: Market awning plus thermal ticket. Brief-pinned. Seed brief-pinned-go.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
-->`;

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (name.endsWith(".html")) files.push(full);
  }
  return files;
}

const root = path.join(process.cwd(), "out");
for (const file of walk(root)) {
  const html = readFileSync(file, "utf8");
  if (html.includes("Seed brief-pinned-go")) continue;
  const next = html.replace(/<body([^>]*)>/, `<body$1>\n${comment}`);
  writeFileSync(file, next);
}
