# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Curious developers who browse regularly to spot interesting new GitHub projects before everyone else (confirmed). Other audiences have not been confirmed.

## Product Purpose

Just Arrived surfaces brand-new, fast-growing GitHub repositories before they reach GitHub Trending. Success means people come back (confirmed): return visits matter more than longer sessions, ad income or reach when they conflict.

## Positioning

Taken from the existing site copy and code, not separately confirmed: it ranks repositories by growth speed relative to their age rather than by total stars, and samples several star bands so small, fast-rising repos are not buried under very large ones.

## Operating Context

- Live at https://sharma-open-source.github.io/just-arrived/, hosted on GitHub Pages.
- A GitHub Actions job aims to refresh `data.json`, `history.json` and `feed.xml` about every 30 minutes. Normal visits load that snapshot; the Refresh control queries GitHub live.
- Reasons to return: Since last visit, saved repos with star gains, repo of the day, Just landed, weekly digests and an Atom feed.
- Visitors filter, open a repo preview with its README, then continue to GitHub. Filters and individual repos have shareable URLs.

## Capabilities and Constraints

- No accounts and no backend (confirmed). The site stays static; saved repos, visit history, preferences and an optional GitHub token are stored in the visitor's browser.
- Free for everyone, with no paid features (confirmed).
- Supported by Google AdSense. Ads may match the repo cards but are always clearly labeled as ads (confirmed).
- Third-party services, including Google Tag Manager and AdSense, process visitor data as described in `privacy.html`. Keep that page accurate.
- GitHub rate limits apply: READMEs count against 60 requests an hour without a token; search allows 10 a minute without one and 30 with one.
- READMEs and repository details are untrusted content. README images load only from GitHub hosts.
- Moving an ad node reloads the ad, so in-feed ads stay in place while cards are rebuilt.
- List names: All, Since last visit, Trending, Hidden gems, Saved. Scoring rules are in `README.md`.

## Brand Commitments

- Name: Just Arrived.
- The current arrivals-hall look is locked (confirmed): yellow sign, navy, ticket cards and Overpass.

## Evidence on Hand

- Live repository data in `data.json` and daily star history in `history.json`.
- Weekly digests in `digest/`.
- No testimonials, user counts, press or case studies are on hand. Do not invent them.
- Open: the About text says the site scans GitHub "live in your browser", but normal visits use the snapshot. Wording not yet decided.

## Product Principles

1. Give people a reason to come back: show what is new since they were last here.
2. Protect trust over ad income: label ads, and keep them from getting in the way of browsing.
3. Show momentum early: how fast a repo is growing matters more than how big it already is.
4. Keep it open to everyone: no sign-up, no paywall, and visitor choices stay in their browser.
