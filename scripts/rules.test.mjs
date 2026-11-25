import test from "node:test";
import assert from "node:assert/strict";
import "../rules.js";
import "./fetch-data.mjs"; // must not run or need a token on import

const { isBlocked, recentPace, measure } = globalThis.JA;
const now = Date.parse("2026-01-10T00:00:00Z");
const r = (o) => ({ name: "n", description: "d", topics: [], stargazers_count: 100, forks_count: 0, open_issues_count: 0, created_at: "2026-01-01T00:00:00Z", pushed_at: "2026-01-10T00:00:00Z", ...o });

test("isBlocked", () => {
  for (const o of [{ description: "X [2026] — Standalone Windows 10/11 (x64) Release, Setup & Config" }, { topics: ["acronis-crack-2026"] },
    { description: "Keyless Roblox Script" }, { name: "cs2-cheat-esp" }, { name: "x", description: "Cheat sheet and aimbot" }]) assert.ok(isBlocked(r(o)), JSON.stringify(o));
  for (const o of [{ description: "helping grads crack interviews" }, { topics: ["crackling"] }, { description: "keyless signing for containers" },
    { description: "Windows 10/11 theme manager" }, { description: "anti cheat for servers" }, { description: "Git cheat sheets" }]) assert.ok(!isBlocked(r(o)), JSON.stringify(o));
});
test("recentPace", () => {
  const pt = (t, s) => ({ t: "2026-01-" + t, s });
  assert.equal(recentPace(undefined, 9, now), null);
  assert.equal(recentPace([], 9, now), null);
  assert.equal(recentPace([pt("09", 5), pt("10", 9)], 9, now), null); // under a day old
  assert.equal(recentPace([pt("08", 10)], 30, now), 20); // exactly 1 day
  assert.equal(recentPace([pt("05", 10)], 50, now), 10); // exactly 4 days
  assert.equal(recentPace([pt("04", 10)], 50, now), null); // too old
  assert.equal(recentPace([pt("08", 40)], 30, now), 0); // lost stars
  assert.equal(recentPace([pt("05", 0), pt("07", 10), pt("09", 49)], 50, now), 20); // gap: newest eligible
});
test("measure prefers recent growth, including zero", () => {
  const flat = measure(r({ stargazers_count: 10000 }), now, 0);
  const rising = measure(r({ stargazers_count: 300 }), now, 100);
  assert.equal(flat.pace, 0);
  assert.ok(flat.score < rising.score && !flat.aboutToTrend && rising.aboutToTrend);
  assert.equal(measure(r({}), now).pace, measure(r({}), now).starsPerDay);
});
test("measure: young repo under 24 hours", () => {
  const young = measure(r({ created_at: "2026-01-09T18:00:00Z", stargazers_count: 183, forks_count: 10 }), now);
  assert.equal(young.pace, 183, "pace should equal actual stars");
  assert.equal(young.starsPerDay, 732, "starsPerDay should be 183/0.25");
  assert.equal(young.forksPerDay, 10, "forksPerDay should be 10/1");
});
test("measure: at exactly 24 hours, pace equals stars", () => {
  const young = measure(r({ created_at: "2026-01-09T00:00:00Z", stargazers_count: 100 }), now);
  assert.equal(young.pace, 100);
});
test("measure: at 48 hours, pace is stars/2", () => {
  const young = measure(r({ created_at: "2026-01-08T00:00:00Z", stargazers_count: 100 }), now);
  assert.equal(young.pace, 50);
});
test("measure: explicit recent value still wins", () => {
  const withRecent = measure(r({ created_at: "2026-01-09T18:00:00Z", stargazers_count: 183, forks_count: 10 }), now, 500);
  assert.equal(withRecent.pace, 500);
});
