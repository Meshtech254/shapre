import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const root = process.cwd();
const ignored = new Set([".git", "node_modules", ".next", ".next-local", ".next-production", ".next-remote", "test-results", ".qa"]);
const markers = [
  { label: "JWT-like token", re: /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{8,}\b/g },
  { label: "private key block", re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { label: "credential assignment", re: /(?:^|\n)\s*(?:export\s+)?([A-Z][A-Z0-9_-]*(?:API[_-]?KEY|SERVICE[_-]?ROLE|DATABASE[_-]?URL|DB[_-]?PASSWORD|JWT[_-]?SECRET|OUTPUT[_-]?TOKEN|BILLING[_-]?(?:SECRET|KEY)|WEBHOOK[_-]?SECRET|ACCESS[_-]?TOKEN|PRIVATE[_-]?KEY|CLIENT[_-]?SECRET|PASSWORD)[A-Z0-9_-]*)\s*[:=]\s*([^\s#"']+)/gim },
];
const safeExample = /^(?:|your[-_ ]|example|change[-_ ]me|placeholder|none$|null$|false$|true$|https?:\/\/localhost|http:\/\/127\.0\.0\.1)/i;
const files = [];
async function walk(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    if (item.isDirectory() && ignored.has(item.name)) continue;
    const path = join(dir, item.name);
    if (item.isDirectory()) await walk(path);
    else if (!item.isSymbolicLink()) files.push(path);
  }
}
await walk(root);
let hits = 0;
for (const file of files) {
  const name = relative(root, file).replaceAll("\\", "/");
  if (name === "scripts/audit-secrets.mjs") continue;
  let content;
  try { content = await readFile(file, "utf8"); } catch { continue; }
  if (content.includes("\u0000")) continue;
  const found = new Set();
  for (const { label, re } of markers) {
    re.lastIndex = 0;
    for (const match of content.matchAll(re)) {
      if (label === "credential assignment" && safeExample.test(match[2])) continue;
      found.add(label);
    }
  }
  if (found.size) {
    hits++;
    console.log(`${name}: ${[...found].join(", ")}`);
  }
}
console.log(`Potentially sensitive files: ${hits}`);
