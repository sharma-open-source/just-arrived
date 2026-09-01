#!/usr/bin/env node
// Refreshes data.json with a snapshot of newest / fastest-growing GitHub repos
// for each "created within" window the UI supports, so a normal page load
// never has to make a rate-limited call to the GitHub Search API itself.
// Also maintains history.json (a short rolling star-count history per repo,
// sampled at most once/day, for the UI's trend sparklines) and feed.xml (an
// Atom feed of "about to trend" repos for subscribers).
import { writeFile, readFile } from "node:fs/promises";

const WINDOWS = [7, 14, 30, 90];
// GitHub search only sorts by total stars, so a single stars-desc query is
// dominated by mega-viral repos and never surfaces low-star/high-velocity
// "hidden gems" (they rank too low to make the top pages). Querying separate
// star bands and merging keeps the sample spread across the whole spectrum.
const STAR_BANDS = ["10..49", "50..199", "200..999", ">=1000"];
// Each band query can have far more than 100 matches (GitHub search caps a
// single page at 100). Page a few deep per band so a popular band isn't
// silently truncated to just its first 100 results, while staying well
// short of GitHub's 1000-result search ceiling.
const MAX_PAGES_PER_BAND = 3;
const HISTORY_DAYS = 14;
const token = process.env.GITHUB_TOKEN;

function daysAgoISO(days) {
  return new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
}

// The Search API's 30 req/min (authenticated) limit is separate from — and
// much stricter than — GitHub's general rate limits. With multiple windows
// each paginating multiple bands, per-call sites can no longer just sleep
// locally between their own requests: two bands' "wait 1s then fetch page 2"
// timers fire independently and can still burst well past 30/min combined.
// Route every request through one shared, serialized gap instead.
const SEARCH_REQUEST_GAP_MS = 2100; // ~28.5 req/min, safely under the 30/min cap
let throttleQueue = Promise.resolve();
function throttle() {
  const turn = throttleQueue.then(() => new Promise((r) => setTimeout(r, SEARCH_REQUEST_GAP_MS)));
  throttleQueue = turn;
  return turn;
}

async function fetchPage(query, page) {
  await throttle();
  const url =
    "https://api.github.com/search/repositories?q=" +
    encodeURIComponent(query) +
    "&sort=stars&order=desc&per_page=100&page=" +
    page;
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} for "${query}" page ${page}: ${await res.text()}`);
  }
  return res.json();
}

async function fetchBand(query) {
  let items = [];
  for (let page = 1; page <= MAX_PAGES_PER_BAND; page++) {
    const json = await fetchPage(query, page);
    const pageItems = json.items || [];
    items = items.concat(pageItems);
    if (pageItems.length < 100 || items.length >= (json.total_count ?? 0)) break;
  }
  return items;
}

function trim(item) {
  return {
    id: item.id,
    full_name: item.full_name,
    name: item.name,
    owner: { login: item.owner.login, avatar_url: item.owner.avatar_url },
    html_url: item.html_url,
    description: item.description,
    language: item.language,
    topics: item.topics || [],
    stargazers_count: item.stargazers_count,
    forks_count: item.forks_count,
    open_issues_count: item.open_issues_count,
    created_at: item.created_at,
    pushed_at: item.pushed_at,
  };
}

async function fetchWindow(days) {
  const created = daysAgoISO(days);
  // allSettled: one band failing (transient API error) shouldn't blow away
  // the whole scheduled snapshot and leave data.json stale — write what
  // succeeded and log the rest.
  const results = await Promise.allSettled(
    STAR_BANDS.map((band) => fetchBand("created:>" + created + " stars:" + band))
  );
  const seen = new Set();
  const items = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      items.push(...r.value);
    } else {
      console.error(`window ${days}d, band ${STAR_BANDS[i]} failed: ${r.reason.message}`);
    }
  });
  return items.filter((r) => !seen.has(r.id) && seen.add(r.id)).map(trim);
}

// Lightweight versions of the UI's derived-field logic, just enough to rank
// "about to trend" repos for the Atom feed without duplicating the full
// scoring model.
function starsPerDay(item) {
  const ageDays = Math.max((Date.now() - new Date(item.created_at)) / 864e5, 0.25);
  return item.stargazers_count / ageDays;
}
function isAboutToTrend(item) {
  const ageDays = (Date.now() - new Date(item.created_at)) / 864e5;
  return ageDays < 14 && item.stargazers_count > 50 && starsPerDay(item) > 20;
}

function buildFeed(windows, generatedAt) {
  const byId = new Map();
  for (const item of windows[14] || []) byId.set(item.id, item);
  const entries = [...byId.values()]
    .filter(isAboutToTrend)
    .sort((a, b) => starsPerDay(b) - starsPerDay(a))
    .slice(0, 30);

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const entriesXML = entries
    .map(
      (r) => `  <entry>
    <id>${esc(r.html_url)}</id>
    <title>${esc(r.full_name)}</title>
    <link href="${esc(r.html_url)}"/>
    <updated>${new Date(r.pushed_at).toISOString()}</updated>
    <published>${new Date(r.created_at).toISOString()}</published>
    <summary>${esc(r.description || "No description.")} — ★ ${r.stargazers_count} (${starsPerDay(r).toFixed(1)}/day)</summary>
    <author><name>${esc(r.owner.login)}</name></author>
  </entry>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Just Arrived — About to trend on GitHub</title>
  <subtitle>Brand-new, fast-growing GitHub repositories, before they hit Trending.</subtitle>
  <link href="https://sharma-open-source.github.io/just-arrived/feed.xml" rel="self"/>
  <link href="https://sharma-open-source.github.io/just-arrived/"/>
  <id>https://sharma-open-source.github.io/just-arrived/</id>
  <updated>${generatedAt}</updated>
${entriesXML}
</feed>
`;
}

async function loadHistory() {
  try {
    return JSON.parse(await readFile(new URL("../history.json", import.meta.url), "utf8"));
  } catch (e) {
    return {};
  }
}

// One point per repo per UTC day (the job runs every ~30 min, but a sparkline
// only needs daily resolution). Repos no longer present in any window today
// are dropped so the file doesn't grow without bound.
function updateHistory(prevHistory, windows, today) {
  const starsById = new Map();
  for (const items of Object.values(windows)) {
    for (const item of items) starsById.set(item.id, item.stargazers_count);
  }
  const next = {};
  for (const [id, stars] of starsById) {
    const key = String(id);
    const series = prevHistory[key] || [];
    const last = series[series.length - 1];
    const updated = last && last.t === today ? series.slice(0, -1) : series;
    next[key] = [...updated, { t: today, s: stars }].slice(-HISTORY_DAYS);
  }
  return next;
}

async function main() {
  if (!token) throw new Error("GITHUB_TOKEN env var is required");
  const windows = {};
  for (const days of WINDOWS) {
    windows[days] = await fetchWindow(days);
    console.log(`window ${days}d: ${windows[days].length} repos`);
  }
  const generatedAt = new Date().toISOString();
  const snapshot = { generatedAt, windows };
  await writeFile(new URL("../data.json", import.meta.url), JSON.stringify(snapshot));
  console.log("wrote data.json");

  const prevHistory = await loadHistory();
  const history = updateHistory(prevHistory, windows, generatedAt.slice(0, 10));
  await writeFile(new URL("../history.json", import.meta.url), JSON.stringify(history));
  console.log(`wrote history.json (${Object.keys(history).length} repos)`);

  const feed = buildFeed(windows, generatedAt);
  await writeFile(new URL("../feed.xml", import.meta.url), feed);
  console.log("wrote feed.xml");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
