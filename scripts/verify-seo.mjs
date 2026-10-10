import { readFile } from "node:fs/promises";
import { join } from "node:path";

const appDir = join(process.cwd(), ".next-production", "server", "app");
const manifest = JSON.parse(await readFile(join(process.cwd(), ".next-production", "prerender-manifest.json"), "utf8"));
const excluded = new Set(["/robots.txt", "/sitemap.xml", "/_not-found", "/icon.png", "/login", "/signup"]);
const routes = Object.keys(manifest.routes).filter((route) => !excluded.has(route) && !route.startsWith("/api/"));
const issues = [];
const titles = new Set();
const descriptions = new Set();
function meta(html, expression) { return html.match(expression)?.[1]?.replaceAll("&amp;", "&") ?? ""; }
for (const route of routes) {
  const rel = route === "/" ? "index.html" : `${decodeURIComponent(route).replace(/^\/+|\/+$/g, "")}.html`;
  let html;
  try { html = await readFile(join(appDir, rel), "utf8"); }
  catch { issues.push(`${route}: no prerendered HTML`); continue; }
  const title = html.match(/<title>(.*?)<\/title>/s)?.[1] ?? "";
  const description = meta(html, /<meta name="description" content="([^"]*)"/);
  const canonical = meta(html, /<link rel="canonical" href="([^"]*)"/);
  const og = meta(html, /<meta property="og:title" content="([^"]*)"/);
  const ogDescription = meta(html, /<meta property="og:description" content="([^"]*)"/);
  const ogImage = meta(html, /<meta property="og:image" content="([^"]*)"/);
  const twitterCard = meta(html, /<meta name="twitter:card" content="([^"]*)"/);
  if (!title) issues.push(`${route}: missing title`);
  else if (titles.has(title)) issues.push(`${route}: duplicate title`);
  else titles.add(title);
  if (!description) issues.push(`${route}: missing description`);
  else if (descriptions.has(description)) issues.push(`${route}: duplicate description`);
  else descriptions.add(description);
  if (!canonical) issues.push(`${route}: missing canonical`);
  if (!og) issues.push(`${route}: missing Open Graph title`);
  if (!ogDescription) issues.push(`${route}: missing Open Graph description`);
  if (!ogImage) issues.push(`${route}: missing Open Graph image`);
  if (twitterCard !== "summary_large_image") issues.push(`${route}: missing large-image social card`);
  if (route !== "/" && !html.includes('"BreadcrumbList"')) issues.push(`${route}: missing breadcrumb structured data`);
  if (route === "/" && (!html.includes('"SoftwareApplication"') || !html.includes('"FAQPage"'))) issues.push("/: missing visible FAQ or SoftwareApplication structured data");
}
const robots = await readFile(join(appDir, "robots.txt.body"), "utf8");
const sitemap = await readFile(join(appDir, "sitemap.xml.body"), "utf8");
for (const privatePath of ["/admin", "/studio", "/personas", "/demo-personas", "/dashboard", "/settings", "/billing", "/login", "/signup", "/api/"]) if (!robots.includes(privatePath)) issues.push(`robots.txt: missing disallow for ${privatePath}`);
for (const privatePath of ["/admin", "/studio/output", "/settings", "/billing"]) if (sitemap.includes(privatePath)) issues.push(`sitemap.xml: includes private route ${privatePath}`);
const sitemapRoutes = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => {
  try { return new URL(match[1]).pathname; } catch { return ""; }
});
for (const route of routes) if (!sitemapRoutes.includes(route)) issues.push(`sitemap.xml: missing public route ${route}`);
console.log(`Prerendered public routes checked: ${routes.length}`);
console.log(`Unique titles/descriptions: ${titles.size}/${descriptions.size}`);
if (issues.length) { for (const issue of issues) console.error(issue); process.exitCode = 1; }
else console.log("Metadata, canonicals, Open Graph titles, structured data, robots, and sitemap checks passed.");
