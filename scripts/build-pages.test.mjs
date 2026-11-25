import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { starsPerDay, score, isGem, homeItems, langItems, gemItems, replaceBlock, pagesToWrite, staticCardHTML, homeTotal } from "./build-pages.mjs";
import { SITE, isBlocked } from "./site.mjs";

const now = Date.parse("2026-01-31T00:00:00Z");
const repo = (o = {}) => ({
  name: "n", full_name: "o/n", owner: { login: "o" }, html_url: "https://github.com/o/n", description: "d", language: "C",
  stargazers_count: 100, forks_count: 0, open_issues_count: 0,
  created_at: new Date(now - 10 * 864e5).toISOString(), pushed_at: new Date(now).toISOString(), ...o,
});
const root = (p) => new URL("../" + p, import.meta.url);
const read = (p) => readFileSync(root(p), "utf8");

test("age floor and score", () => {
  assert.equal(starsPerDay(repo({ created_at: new Date(now).toISOString() }), now), 400);
  assert.equal(score(repo(), now), 10 * 0.5 + 10 * 0.2);
});
test("gem boundaries", () => {
  assert.ok(isGem(repo({ stargazers_count: 499 }), now));
  assert.ok(!isGem(repo({ stargazers_count: 500 }), now));
  assert.ok(!isGem(repo({ stargazers_count: 80 }), now)); // exactly 8 a day
  assert.ok(isGem(repo({ stargazers_count: 81 }), now));
});
test("selection and order", () => {
  const items = [repo({ stargazers_count: 60 }), repo({ stargazers_count: 300 }), repo({ stargazers_count: 49 }), repo({ language: "C++" })];
  const data = { windows: { 14: items, 30: items } };
  assert.deepEqual(homeItems(data, now).map((r) => r.stargazers_count), [300, 100, 60]);
  assert.deepEqual(langItems(data, "C", now).map((r) => r.stargazers_count), [300, 60]);
  assert.deepEqual(gemItems(data, now).map((r) => r.stargazers_count), [300, 100]);
});
test("untrusted text is escaped, nulls are handled", () => {
  const html = staticCardHTML(repo({ description: '<script>"x"</script>', language: null }));
  assert.ok(html.includes("&lt;script&gt;&quot;x&quot;"));
  assert.ok(staticCardHTML(repo({ description: null })).includes("No description."));
});
test("replaceBlock", () => {
  assert.equal(replaceBlock("<!-- a:start -->x<!-- a:end -->", "a", "$& $1"), "<!-- a:start -->$& $1<!-- a:end -->");
  assert.throws(() => replaceBlock("none", "a", ""), /a/);
});
test("small pages are not written but existing ones stay linked", () => {
  const plan = pagesToWrite([{ slug: "a", items: Array(9) }, { slug: "b", items: Array(9) }, { slug: "c", items: Array(10) }], new Set(["a"]));
  assert.deepEqual(plan.map((p) => [p.write, p.keep]), [[false, true], [false, false], [true, true]]);
});
test("built site", () => {
  const index = read("index.html");
  const data = JSON.parse(read("data.json"));
  assert.equal(index.match(/<article class="card static-card">/g).length, 24);
  for (const n of ["static-list", "static-total", "browse"]) for (const e of ["start", "end"])
    assert.equal(index.split(`<!-- ${n}:${e} -->`).length, 2);
  assert.ok(index.includes(`${homeTotal(data)} repos from`));
  const pages = ["index.html", "privacy.html", ...["digest", "new"].flatMap((d) => readdirSync(root(d + "/")).map((f) => `${d}/${f}`))];
  for (const p of pages) assert.doesNotMatch(read(p), /href="[^"]*index\.html["?]/, p);
  for (const [, loc] of read("sitemap.xml").matchAll(/<loc>(.*?)<\/loc>/g)) {
    const p = loc.slice(SITE.length).replace(/(^|\/)$/, "$1index.html");
    assert.ok(read(p).includes(`<link rel="canonical" href="${loc}">`), loc);
  }
});
test("isBlocked", () => {
  assert.ok(isBlocked(repo({ name: "cs2-cheat-esp-aimbot" })));
  assert.ok(isBlocked(repo({ topics: ["mod-menu"] })));
  assert.ok(isBlocked(repo({ description: "Rust Recoil Script" })));
  assert.ok(isBlocked(repo({ name: "fivem_hwid_spoofer" })));
  assert.ok(!isBlocked(repo({ name: "anti-cheat" })));
  assert.ok(!isBlocked(repo({ name: "anticheat" })));
  assert.ok(!isBlocked(repo({ name: "git-cheat-sheet" })));
  assert.ok(!isBlocked(repo({ name: "cheatsheet" })));
  assert.ok(!isBlocked(repo({ name: "discord-bot" })));
  assert.ok(!isBlocked(repo({ name: "model-trainer" })));
  assert.ok(!isBlocked(repo({ name: "esp-idf" })));
  assert.ok(!isBlocked(repo({ name: "esp32" })));
  assert.ok(!isBlocked(repo({ name: "code-executor" })));
  assert.ok(!isBlocked(repo({ description: null, topics: [] })));
});
