import { readFile, writeFile } from "node:fs/promises";
const personas = JSON.parse(
  await readFile("supabase/seed/demo-personas.json", "utf8"),
);
const assets = JSON.parse(
  await readFile("supabase/seed/demo-persona-assets.json", "utf8"),
);
const path = "supabase/migrations/202610070003_demo_avatar_assets.sql";
const marker =
  "-- Generated avatar seed updates; preserve administrator-configured identities.";
const header = (await readFile(path, "utf8")).split(marker)[0];
function literal(value) {
  if (value === null) return "null";
  if (typeof value === "boolean" || typeof value === "number")
    return String(value);
  if (typeof value === "object")
    return `${literal(JSON.stringify(value))}::jsonb`;
  return `'${value.replaceAll("'", "''")}'`;
}
const statements = [];
for (const persona of personas) {
  if (!persona.active) {
    statements.push(
      `update public.demo_personas set active=false,featured=false where slug=${literal(persona.slug)} and metadata->>'placeholder'='true';`,
    );
    continue;
  }
  const columns = [
    "description",
    "thumbnail_url",
    "preview_image_url",
    "studio_avatar_url",
    "face_source_reference",
    "featured",
  ];
  statements.push(
    `update public.demo_personas set ${columns.map((key) => `${key}=${literal(persona[key])}`).join(",")},metadata=metadata || ${literal(persona.metadata)} where slug=${literal(persona.slug)} and (metadata->>'placeholder'='true' or metadata->>'asset_bundle_version'='1');`,
  );
}
for (const asset of assets)
  statements.push(
    `insert into public.demo_persona_assets(demo_persona_id,asset_type,storage_path,mime_type,role,metadata) select id,${["asset_type", "storage_path", "mime_type", "role", "metadata"].map((key) => literal(asset[key])).join(",")} from public.demo_personas where slug=${literal(asset.slug)} and metadata->>'asset_bundle_version'='1' on conflict(demo_persona_id,role) do nothing;`,
  );
await writeFile(path, `${header}${marker}\n${statements.join("\n")}\n`);
console.log(
  "Generated avatar migration from the canonical personas and asset manifest. No database writes performed.",
);
