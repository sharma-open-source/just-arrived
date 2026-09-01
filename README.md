# 🚀 Just Arrived

**Discover GitHub repositories before they hit Trending.**

A single-page dashboard that surfaces brand-new, fast-growing repos from the
GitHub Search API — no backend, no server. A GitHub Actions job refreshes a
static `data.json` snapshot every ~30 min so a normal page load never has to
make a rate-limited API call itself; hit 🔑 Refresh for a live, up-to-the-
second query instead.

**Live site:** https://sharma-open-source.github.io/just-arrived/

## Sections

- ✨ **All** — everything in the window, ranked by trend score
- 🚀 **New this week** — created in the last 7 days
- 📈 **Fastest growing** — ≥ 15 stars/day
- 💎 **Hidden gems** — high velocity but still under 500 stars
- 🔥 **About to trend** — < 14 days old, > 50 stars, > 20 stars/day

## Scoring

```
score = stars_per_day  × 0.5
      + forks_per_day  × 0.2
      + push_freshness × 0.2   (how recently it was pushed, 0–10)
      + community      × 0.1   (open issues + PRs proxy, 0–10)
```

The Search API doesn't expose contributor counts or commit frequency directly,
so push recency and issue/PR activity are used as lightweight proxies.

## Controls

- Window (7 / 14 / 30 / 90 days), language, min-stars slider, text search
- Sort by score, velocity, stars, forks, or age
- Card grid / list / accessible table views, light & dark themes
- 🎲 Surprise (open a random matching repo), ▶ Auto-refresh every 5 min
- 🔑 Optional GitHub token (stored in localStorage only) raises the API
  rate limit from 10 to 30 searches/min
- 💾 **Saved** — click ☆ on any repo to bookmark it (localStorage only);
  bookmarks persist across window/tab changes and refresh their stars/score
  whenever the repo reappears in a freshly loaded window
- Every filter (tab, window, language, min stars, sort, search, view) is
  mirrored into the URL query string, so a specific view is shareable —
  e.g. `?tab=gems&window=30&sort=velocity`
- 📡 [`feed.xml`](feed.xml) — an Atom feed of the current "about to trend"
  repos, refreshed alongside `data.json`, for subscribing without a visit
- Cards show a small trend sparkline (★ over the last few days) once
  `history.json` has accumulated more than one day of data for a repo

## Run locally

Just open `index.html` — or serve it: `python3 -m http.server`.

## Data snapshot

`scripts/fetch-data.mjs` pulls the newest/fastest-growing repos for each
supported age window and writes:

- `data.json` — the full snapshot the UI loads on a normal page view
- `history.json` — a rolling ≤14-day, one-point-per-day star history per
  repo, used for the trend sparklines
- `feed.xml` — an Atom feed of the top "about to trend" repos

Each star-band query is paged up to 3 deep (not just the first 100 results)
so wide windows aren't silently truncated, and all Search API requests are
routed through a single shared, serialized delay to stay under GitHub's
30 req/min (authenticated) search limit even while paginating. If one band's
request fails, the rest of the snapshot still gets written.

`.github/workflows/refresh-data.yml` runs the script on a 30-minute schedule
(and on demand via `workflow_dispatch`) and commits the result. Run it
yourself with `GITHUB_TOKEN=<token> node scripts/fetch-data.mjs`.
