#!/usr/bin/env node
// Refreshes data.json with a snapshot of newest / fastest-growing GitHub repos
// for each "created within" window the UI supports, so a normal page load
// never has to make a rate-limited call to the GitHub Search API itself.
import { writeFile } from "node:fs/promises";

const WINDOWS = [7, 14, 30, 90];
// GitHub search only sorts by total stars, so a single stars-desc query is
// dominated by mega-viral repos and never surfaces low-star/high-velocity
// "hidden gems" (they rank too low to make the top pages). Querying separate
// star bands and merging keeps the sample spread across the whole spectrum.
const STAR_BANDS = ["10..49", "50..199", "200..999", ">=1000"];
const token = process.env.GITHUB_TOKEN;

function daysAgoISO(days) {
  return new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
}

async function fetchPage(query, page) {
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
  return (await res.json()).items || [];
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
  const bandResults = await Promise.all(
    STAR_BANDS.map((band) => fetchPage("created:>" + created + " stars:" + band, 1))
  );
  const seen = new Set();
  return bandResults
    .flat()
    .filter((r) => !seen.has(r.id) && seen.add(r.id))
    .map(trim);
}

async function main() {
  if (!token) throw new Error("GITHUB_TOKEN env var is required");
  const windows = {};
  for (const days of WINDOWS) {
    windows[days] = await fetchWindow(days);
    console.log(`window ${days}d: ${windows[days].length} repos`);
    // stay well under the 30 req/min authenticated Search API limit
    await new Promise((r) => setTimeout(r, 3000));
  }
  const snapshot = { generatedAt: new Date().toISOString(), windows };
  await writeFile(new URL("../data.json", import.meta.url), JSON.stringify(snapshot));
  console.log("wrote data.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
