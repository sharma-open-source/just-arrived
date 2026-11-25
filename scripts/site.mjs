// Shared constants and page shell for the digest and static-pages builders.
import "../rules.js";

export const SITE = "https://sharma-open-source.github.io/just-arrived/";
export const DAY = 864e5;
export const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const num = (n) => n.toLocaleString("en-US");
export const nice = (d) => new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

export const { isBlocked } = globalThis.JA;

export const LANGUAGES = [
  ["Python", "python"],
  ["Rust", "rust"],
  ["JavaScript", "javascript"],
  ["TypeScript", "typescript"],
  ["Go", "go"],
  ["C++", "cpp"],
  ["Swift", "swift"],
];

export function page({ title, desc, path, body }) {
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
<link rel="stylesheet" href="../theme.css?v=2">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4743008845908654"
     crossorigin="anonymous"></script>
</head>
<body>
<script>
try { const t = localStorage.getItem("ja-theme"); if (t) document.documentElement.dataset.theme = t; } catch (e) {}
</script>
<header class="sign"><div class="in"><a class="logo" href="../"><svg viewBox="0 0 34 34" aria-hidden="true"><rect width="34" height="34" rx="4" fill="#15233b"/><path d="M10 9v14h14M10 23 24 9" fill="none" stroke="#ffc72c" stroke-width="4"/></svg>Just Arrived</a><nav aria-label="Site"><a href="../digest/">Digest</a></nav></div></header>
<main class="doc digest">
${body}
<footer class="muted"><a href="../">Just Arrived</a> · <a href="../digest/">All digests</a> · <a href="../privacy.html">Privacy policy</a></footer>
</main>
</body>
</html>
`;
}
