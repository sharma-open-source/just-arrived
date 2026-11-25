// Shared by the dashboard (a plain script) and the Node build scripts
// (imported for its side effect): what is listed, and how growth is measured.
// Kept free of regex lookbehind, which older Safari can't parse.
(() => {
  const DAY = 864e5;

  // Game cheats and cheat bots. Narrow on purpose: words like "esp",
  // "trainer" or "bot" alone also describe legitimate projects.
  const CHEATS = /\b(?:cheats?|aim[- ]?bots?|trigger[- ]?bots?|color[- ]?bots?|wall[- ]?hacks?|mod[- ]menus?|no[- ]?recoil|recoil[- ](?:script|macro)s?|hwid[- ]spoofers?|roblox[- ](?:script|executor)s?|executor[- ]roblox|esp[- ](?:hack|overlay|macro)s?)\b/i;
  const NOT_CHEATS = /\banti[- ]?cheats?\b|\bcheat[- ]?sheets?\b/gi;
  // Wording shared by mass-produced download repos.
  const SPAM = /standalone windows 10\/11|release, setup & config|portable x64 prebuilt|native 64-bit windows 10\/11|\bpre-?activated\b|\bkeyless[- ](?:\w+[- ])?(?:script|executor)/i;
  const CRACK_TOPIC = /(?:^|-)crack(?:ed)?(?:-|$)/i;

  function isBlocked(r) {
    const topics = r.topics || [];
    const text = [r.name, r.description, ...topics].filter(Boolean).join(" | ").replace(/_/g, " ");
    return CHEATS.test(text.replace(NOT_CHEATS, " ")) || SPAM.test(text) || topics.some((t) => CRACK_TOPIC.test(t));
  }

  // Stars gained per day since the newest daily sample that is 1 to 4 days
  // old, or null without one. A day's point is its last sample, so it counts
  // as taken at the end of that UTC day.
  function recentPace(series, stars, now) {
    for (let i = (series || []).length - 1; i >= 0; i--) {
      const days = (now - (Date.parse(series[i].t) + DAY)) / DAY;
      if (days > 4) return null;
      if (days >= 1) return Math.max(0, stars - series[i].s) / days;
    }
    return null;
  }

  // `recent` is recentPace's value; without it the lifetime average stands in.
  function measure(r, now, recent) {
    const stars = r.stargazers_count;
    const ageDays = Math.max((now - Date.parse(r.created_at)) / DAY, 0.25);
    const daysSincePush = (now - Date.parse(r.pushed_at)) / DAY;
    const starsPerDay = stars / ageDays;
    const days = Math.max(ageDays, 1); // Under a day old there is no full day to average, so count what it has.
    const pace = recent ?? stars / days;
    const forksPerDay = r.forks_count / days;
    // push freshness 0..10: pushed within the hour ≈ 10, a week ago ≈ 0
    const pushFresh = Math.max(0, 10 - daysSincePush * 1.5);
    // community proxy 0..10 from open issues+PRs (search API has no contributor count)
    const community = Math.min(10, Math.sqrt(r.open_issues_count || 0) * 2);
    return {
      ageDays, starsPerDay, pace, forksPerDay,
      score: pace * 0.5 + forksPerDay * 0.2 + pushFresh * 0.2 + community * 0.1,
      isNew: ageDays <= 7,
      aboutToTrend: ageDays < 14 && stars > 50 && pace > 20,
      hiddenGem: stars < 500 && pace > 8,
    };
  }

  globalThis.JA = { isBlocked, recentPace, measure };
})();
