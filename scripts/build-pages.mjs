#!/usr/bin/env node
// Builds the static homepage repo list, the per-language and hidden-gem
// pages under new/, and sitemap.xml from data.json. Pure functions below are
// exported for testing; main() only runs when this file is executed directly.
import { readFile, writeFile, readdir, mkdir, access } from "node:fs/promises";
import { SITE, DAY, iso, esc, num, nice, page, LANGUAGES, isBlocked } from "./site.mjs";

const ROOT = new URL("../", import.meta.url);

const measure = (item, now) => globalThis.JA.measure(item, now, item.recent_per_day);
export const starsPerDay = (item, now) => measure(item, now).starsPerDay; // lifetime average
export const pace = (item, now) => measure(item, now).pace;
export const score = (item, now) => measure(item, now).score;
export const isGem = (item, now) => measure(item, now).hiddenGem;

export function homeTotal(data) {
  return (data.windows["14"] || [])
    .filter((r) => r.stargazers_count >= 50 && !isBlocked(r)).length;
}

export function homeItems(data, now) {
  return (data.windows["14"] || [])
    .filter((r) => r.stargazers_count >= 50 && !isBlocked(r))
    .sort((a, b) => score(b, now) - score(a, now));
}

export function langItems(data, lang, now) {
  return (data.windows["30"] || [])
    .filter((r) => r.language === lang && r.stargazers_count >= 50 && !isBlocked(r))
    .sort((a, b) => score(b, now) - score(a, now));
}

export function gemItems(data, now) {
  return (data.windows["30"] || [])
    .filter((r) => r.stargazers_count >= 50 && isGem(r, now) && !isBlocked(r))
    .sort((a, b) => pace(b, now) - pace(a, now));
}

export function replaceBlock(html, name, content) {
  const start = `<!-- ${name}:start -->`;
  const end = `<!-- ${name}:end -->`;
  const i = html.indexOf(start);
  const j = html.indexOf(end);
  if (i === -1 || j === -1) throw new Error(`missing marker: ${name}`);
  return html.slice(0, i + start.length) + content + html.slice(j);
}

export const MAX_LISTED = 50;
const listed = (items) => items.slice(0, MAX_LISTED);
const foundNote = (items) => items.length > MAX_LISTED ? ` The top ${MAX_LISTED} are listed here.` : "";

// Decides, for a set of candidate new/ pages, which to (re)write and which
// existing pages to keep linking to. Pulled out of main() so it is testable
// without touching the filesystem.
export function pagesToWrite(candidates, existingSlugs) {
  return candidates.map((c) => ({
    slug: c.slug,
    label: c.label,
    write: c.items.length >= 10,
    keep: existingSlugs.has(c.slug) || c.items.length >= 10,
  }));
}

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// A repo under a day old has no full day to average, so show the stars it
// has rather than a rate projected from a fraction of a day.
function paceLabel(item, now) {
  const hours = (now - Date.parse(item.created_at)) / 36e5;
  if (hours < 24) return `★ ${num(item.stargazers_count)}`;
  return `★ ${num(item.stargazers_count)} · ${num(Math.round(pace(item, now)))} stars a day${item.recent_per_day != null ? " lately" : ""}`;
}

export function staticCardHTML(item) {
  const who = `<span class="repo-owner">${[item.owner?.login, item.language].filter(Boolean).map(esc).join(" · ")}</span>`;
  return `<article class="card static-card">
<div class="card-main">
<div class="who">${who}</div>
<h2 class="card-h"><a class="repo-name" href="${esc(item.html_url)}" rel="noopener nofollow">${esc(item.name)}</a></h2>
<p class="desc">${esc(item.description) || "No description."}</p>
</div>
<div class="stub">
<div><b>${num(item.stargazers_count)}</b><small>stars</small></div>
</div>
</article>`;
}

function listItemHTML(item, now) {
  const stat = [paceLabel(item, now), item.language].filter(Boolean).map(esc).join(" · ");
  return `<li>
<a href="${esc(item.html_url)}" rel="noopener nofollow"><strong>${esc(item.full_name)}</strong></a>
<p>${esc(item.description) || "No description."}</p>
<p class="muted">${stat} · <a href="../?repo=${esc(encodeURIComponent(item.full_name))}">View on Just Arrived</a></p>
</li>`;
}

function moreListsHTML(links) {
  if (!links.length) return "";
  return `<p>More lists: ${links.map((l) => `<a href="${esc(l.slug)}.html">${esc(l.label)}</a>`).join(" · ")}</p>`;
}

function langPageContent(lang, items, now, generatedAt, otherLinks) {
  const top = items[0];
  const medianStars = median(items.map((r) => r.stargazers_count));
  const title = `New ${lang} GitHub repos gaining stars — Just Arrived`;
  const desc = `${num(items.length)} new ${lang} repositories gaining stars on GitHub in the last 30 days, topped by ${top.full_name} with ${num(top.stargazers_count)} stars.`;
  const intro = `Just Arrived found ${num(items.length)} ${esc(lang)} repositories created in the last 30 days with at least 50 stars, ranked by recent growth. <strong>${esc(top.full_name)}</strong> ranks first, with ${num(top.stargazers_count)} stars. The median repo has ${num(Math.round(medianStars))} stars.${foundNote(items)}`;
  const body = `<p><a href="../">← Just Arrived</a></p>
<h1>New ${esc(lang)} GitHub repos gaining stars</h1>
<p class="muted">Updated ${nice(generatedAt)}</p>
<p>${intro}</p>
<ol>
${listed(items).map((r) => listItemHTML(r, now)).join("\n")}
</ol>
${moreListsHTML(otherLinks)}`;
  return { title, desc, body };
}

function gemPageContent(items, now, generatedAt, otherLinks) {
  const top = items[0];
  const medianStars = median(items.map((r) => r.stargazers_count));
  const title = "Hidden gem GitHub repos under 500 stars — Just Arrived";
  const desc = `${num(items.length)} hidden gem GitHub repositories under 500 stars with fast growth, topped by ${top.full_name} with ${num(top.stargazers_count)} stars.`;
  const intro = `Just Arrived found ${num(items.length)} repositories created in the last 30 days with at least 50 stars, under 500 stars, and gaining more than 8 stars a day lately, ranked by stars gained per day. <strong>${esc(top.full_name)}</strong> ranks first, with ${num(top.stargazers_count)} stars. The median repo has ${num(Math.round(medianStars))} stars.${foundNote(items)}`;
  const body = `<p><a href="../">← Just Arrived</a></p>
<h1>Hidden gem GitHub repos under 500 stars</h1>
<p class="muted">Updated ${nice(generatedAt)}</p>
<p>${intro}</p>
<ol>
${listed(items).map((r) => listItemHTML(r, now)).join("\n")}
</ol>
${moreListsHTML(otherLinks)}`;
  return { title, desc, body };
}

function browseHTML(pages, latestDigest) {
  const links = pages.map((p) => `<a href="new/${esc(p.slug)}.html">${esc(p.label)}</a>`);
  if (latestDigest) links.push(`<a href="digest/${esc(latestDigest.id)}.html">Latest digest: ${esc(latestDigest.label)}</a>`);
  if (!links.length) return "";
  return `<p>${links.join(" · ")}</p>`;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function monthIndex(name) {
  const i = MONTHS.findIndex((m) => m.toLowerCase() === name.toLowerCase());
  return i === -1 ? null : i;
}
// "November 24, 2026"
function parseNiceDate(s) {
  const m = /([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/.exec(s);
  if (!m) return null;
  const mi = monthIndex(m[1]);
  return mi == null ? null : Date.UTC(+m[3], mi, +m[2]);
}
// "24 November 2026"
function parseDMY(s) {
  const m = /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/.exec(s);
  if (!m) return null;
  const mi = monthIndex(m[2]);
  return mi == null ? null : Date.UTC(+m[3], mi, +m[1]);
}

async function lastmodFromFile(fileUrl, regex, parser) {
  const html = await readFile(fileUrl, "utf8").catch(() => null);
  if (!html) return null;
  const m = regex.exec(html);
  if (!m) return null;
  return parser(m[1]);
}

async function exists(fileUrl) {
  return access(fileUrl).then(() => true, () => false);
}

async function main() {
  const read = async (p) => JSON.parse(await readFile(new URL(p, ROOT), "utf8"));
  const data = await read("data.json");
  const now = Date.parse(data.generatedAt);
  // Snapshots from before recent growth was stored.
  const items = Object.values(data.windows).flat();
  if (!items.some((r) => r.recent_per_day != null)) {
    const history = await read("history.json").catch(() => ({}));
    for (const r of items) r.recent_per_day = globalThis.JA.recentPace(history[r.id], r.stargazers_count, now) ?? undefined;
  }
  const newDir = new URL("new/", ROOT);
  const digestDir = new URL("digest/", ROOT);
  await mkdir(newDir, { recursive: true });

  // new/<slug>.html: write only when there are at least 10 items; otherwise
  // leave any existing file untouched (but still list it if it exists).
  const candidates = [
    ...LANGUAGES.map(([lang, slug]) => ({ kind: "lang", lang, slug, label: `New ${lang} repos`, items: langItems(data, lang, now) })),
    { kind: "gem", slug: "hidden-gems", label: "Hidden gems", items: gemItems(data, now) },
  ];
  const existingSlugs = new Set();
  for (const c of candidates) if (await exists(new URL(`${c.slug}.html`, newDir))) existingSlugs.add(c.slug);
  const plan = pagesToWrite(candidates, existingSlugs);
  const decisions = candidates.map((c, i) => ({ ...c, ...plan[i], file: new URL(`${c.slug}.html`, newDir) }));
  const finalPages = decisions.filter((d) => d.keep).map((d) => ({ slug: d.slug, label: d.label }));

  for (const d of decisions) {
    if (!d.write) continue;
    const others = finalPages.filter((p) => p.slug !== d.slug);
    const { title, desc, body } = d.kind === "lang"
      ? langPageContent(d.lang, d.items, now, data.generatedAt, others)
      : gemPageContent(d.items, now, data.generatedAt, others);
    await writeFile(d.file, page({ title, desc, path: `new/${d.slug}.html`, body }));
  }

  const weekIds = (await readdir(digestDir).catch(() => []))
    .filter((f) => /^\d{4}-W\d\d\.html$/.test(f))
    .map((f) => f.slice(0, -5))
    .sort()
    .reverse();
  const latestDigest = weekIds.length ? { id: weekIds[0], label: `Week ${+weekIds[0].slice(6)}, ${weekIds[0].slice(0, 4)}` } : null;

  // index.html: static homepage list, total count, and cross-links.
  const homeAll = homeItems(data, now);
  const home = homeAll.slice(0, 24);
  let indexHtml = await readFile(new URL("index.html", ROOT), "utf8");
  indexHtml = replaceBlock(indexHtml, "static-list", `<div class="grid">\n${home.map(staticCardHTML).join("\n")}\n</div>`);
  indexHtml = replaceBlock(indexHtml, "static-total", `${num(homeTotal(data))} repos from the last 14 days`);
  indexHtml = replaceBlock(indexHtml, "browse", browseHTML(finalPages, latestDigest));
  await writeFile(new URL("index.html", ROOT), indexHtml);

  // sitemap.xml
  const weekLastmods = new Map();
  for (const id of weekIds) {
    weekLastmods.set(id, await lastmodFromFile(new URL(`${id}.html`, digestDir), /star counts as of\s+([A-Za-z]+\s+\d{1,2},\s*\d{4})/i, parseNiceDate));
  }
  const newLastmods = new Map();
  for (const p of finalPages) {
    newLastmods.set(p.slug, await lastmodFromFile(new URL(`${p.slug}.html`, newDir), /Updated\s+([A-Za-z]+\s+\d{1,2},\s*\d{4})/, parseNiceDate));
  }
  const privacyLastmod = await lastmodFromFile(new URL("privacy.html", ROOT), /Last updated:\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/, parseDMY);
  const digestIndexLastmod = weekIds.length ? weekLastmods.get(weekIds[0]) : null;

  const urlEntry = (path, lastmodMs) => {
    const lm = lastmodMs != null ? `\n    <lastmod>${iso(lastmodMs)}</lastmod>` : "";
    return `  <url>\n    <loc>${SITE}${path}</loc>${lm}\n  </url>`;
  };
  const entries = [
    urlEntry("", now),
    urlEntry("digest/", digestIndexLastmod),
    ...weekIds.map((id) => urlEntry(`digest/${id}.html`, weekLastmods.get(id))),
    ...finalPages.map((p) => urlEntry(`new/${p.slug}.html`, newLastmods.get(p.slug))),
    urlEntry("privacy.html", privacyLastmod),
  ];
  await writeFile(new URL("sitemap.xml", ROOT), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
