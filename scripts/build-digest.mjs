#!/usr/bin/env node
// Builds digest/<year>-W<week>.html for the last complete ISO week (Mon–Sun,
// UTC) from data.json and history.json, then rebuilds digest/index.html and
// sitemap.xml. An existing week page is never overwritten, so its numbers stay
// put and it is safe to add commentary to it by hand.
import { readFile, writeFile, readdir, mkdir, access } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const SITE = "https://sharma-open-source.github.io/just-arrived/";
const DAY = 864e5;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (n) => n.toLocaleString("en-US");
const nice = (d) => new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

function lastWeek(now) {
  const midnight = Date.parse(iso(now));
  const monday = midnight - ((new Date(midnight).getUTCDay() + 6) % 7) * DAY - 7 * DAY;
  // The ISO week's year and number are those of its Thursday.
  const thursday = monday + 3 * DAY;
  const year = new Date(thursday).getUTCFullYear();
  const week = Math.floor((thursday - Date.UTC(year, 0, 1)) / (7 * DAY)) + 1;
  return { monday, id: `${year}-W${String(week).padStart(2, "0")}` };
}

function page({ title, desc, path, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}${path}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}${path}">
<meta property="og:image" content="${SITE}og-image.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="../theme.css">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4743008845908654"
     crossorigin="anonymous"></script>
</head>
<body>
<script>
try { const t = localStorage.getItem("ja-theme"); if (t) document.documentElement.dataset.theme = t; } catch (e) {}
</script>
<header class="sign"><div class="in"><a class="logo" href="../index.html"><svg viewBox="0 0 34 34" aria-hidden="true"><rect width="34" height="34" rx="4" fill="#15233b"/><path d="M10 9v14h14M10 23 24 9" fill="none" stroke="#ffc72c" stroke-width="4"/></svg>Just Arrived</a><nav aria-label="Site"><a href="../digest/index.html">Digest</a></nav></div></header>
<main class="doc digest">
${body}
<footer class="muted"><a href="../index.html">Just Arrived</a> · <a href="index.html">All digests</a> · <a href="../privacy.html">Privacy policy</a></footer>
</main>
</body>
</html>
`;
}

function buildWeek({ monday, id }, data, history) {
  const repos = new Map();
  for (const items of Object.values(data.windows)) for (const r of items) repos.set(r.id, r);
  const all = [...repos.values()];
  const next = monday + 7 * DAY;
  const fresh = all
    .filter((r) => Date.parse(r.created_at) >= monday && Date.parse(r.created_at) < next)
    .sort((a, b) => b.stargazers_count - a.stargazers_count);
  if (fresh.length < 20) return null;

  // Daily points hold each day's last sample: Sunday's end to Sunday's end.
  const at = (r, day) => (history[r.id] || []).find((p) => p.t === day)?.s;
  const gainers = all
    .map((r) => ({ r, gain: at(r, iso(next - DAY)) - at(r, iso(monday - DAY)) }))
    .filter((x) => x.gain > 0) // NaN (a missing day) drops out too
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 10);

  const langs = {};
  for (const r of fresh) if (r.language) langs[r.language] = (langs[r.language] || 0) + 1;
  const topLangs = Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const item = (r, stat) => `<li>
<a href="${esc(r.html_url)}" rel="noopener nofollow"><strong>${esc(r.full_name)}</strong></a>
<p>${esc(r.description || "No description.")}</p>
<p class="muted">${[stat, r.language].filter(Boolean).map(esc).join(" · ")} · <a href="../index.html?repo=${esc(encodeURIComponent(r.full_name))}">View on Just Arrived</a></p>
</li>`;

  const range = `${nice(monday)} – ${nice(next - DAY)}`;
  const top = fresh[0];
  const desc = `The 20 most-starred GitHub repositories created ${range}, led by ${top.full_name} with ${num(top.stargazers_count)} stars.`;
  return page({
    title: `Top new GitHub repos, ${range} — Just Arrived`,
    desc,
    path: `digest/${id}.html`,
    body: `<p><a href="index.html">← Weekly digests</a></p>
<h1>Top new GitHub repos</h1>
<p class="muted">${range} · star counts as of ${nice(data.generatedAt)}</p>
<p>Just Arrived sampled ${num(fresh.length)} repositories created this week. <strong>${esc(top.full_name)}</strong> leads with ${num(top.stargazers_count)} stars.${
      topLangs.length ? ` The most common languages were ${topLangs.map(([l, n]) => `${esc(l)} (${n})`).join(", ")}.` : ""}</p>
<h2>Top 20 created this week</h2>
<ol>
${fresh.slice(0, 20).map((r) => item(r, `★ ${num(r.stargazers_count)}`)).join("\n")}
</ol>
${gainers.length ? `<h2>Most stars gained</h2>
<p class="muted">Among tracked repositories up to 90 days old.</p>
<ol>
${gainers.map(({ r, gain }) => item(r, `+${num(gain)} ★ this week`)).join("\n")}
</ol>` : ""}`,
  });
}

async function main() {
  const read = async (p) => JSON.parse(await readFile(new URL(p, ROOT), "utf8"));
  const dir = new URL("digest/", ROOT);
  await mkdir(dir, { recursive: true });

  const week = lastWeek(Date.now());
  const file = new URL(week.id + ".html", dir);
  const exists = await access(file).then(() => true, () => false);
  if (!exists) {
    const data = await read("data.json");
    if (Date.parse(data.generatedAt) < week.monday + 7 * DAY) {
      console.log("snapshot predates the end of the week; waiting for a newer one");
    } else {
      const html = buildWeek(week, data, await read("history.json"));
      if (html) { await writeFile(file, html); console.log("wrote digest/" + week.id + ".html"); }
      else console.log("too few repos for " + week.id);
    }
  }

  const ids = (await readdir(dir)).filter((f) => /^\d{4}-W\d\d\.html$/.test(f)).map((f) => f.slice(0, -5)).sort().reverse();
  await writeFile(new URL("index.html", dir), page({
    title: "Weekly GitHub digests — Just Arrived",
    desc: "Weekly lists of the top new and fastest-growing GitHub repositories.",
    path: "digest/",
    body: `<p><a href="../index.html">← Just Arrived</a></p>
<h1>Weekly digests</h1>
<p>The top new and fastest-growing GitHub repositories, week by week.</p>
<ul>
${ids.map((id) => `<li><a href="${id}.html">Week ${+id.slice(6)}, ${id.slice(0, 4)}</a></li>`).join("\n")}
</ul>`,
  }));

  const url = (path, freq, prio) => `  <url>
    <loc>${SITE}${path}</loc>
    <changefreq>${freq}</changefreq>
    <priority>${prio}</priority>
  </url>`;
  await writeFile(new URL("sitemap.xml", ROOT), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[url("", "weekly", "1.0"), url("digest/", "weekly", "0.7"), ...ids.map((id) => url(`digest/${id}.html`, "yearly", "0.6")), url("privacy.html", "yearly", "0.3")].join("\n")}
</urlset>
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
