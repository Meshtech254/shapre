import sharp from "sharp";
import { readFile, writeFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
const seed = JSON.parse(
  await readFile("supabase/seed/demo-personas.json", "utf8"),
);
const assets = [];
for (const persona of seed.filter((p) => p.active && p.metadata.avatar_ready)) {
  const source = "public" + persona.face_source_reference;
  for (const [role, path, size, quality] of [
    ["thumbnail", persona.thumbnail_url, 384, 82],
    ["preview", persona.preview_image_url, 896, 90],
    ["studio", persona.studio_avatar_url, 512, 86],
    ["face_source", persona.face_source_reference, 1024, 95],
  ]) {
    if (role !== "face_source")
      await sharp(source)
        .resize(size, size, { fit: "cover" })
        .webp({ quality })
        .toFile("public" + path);
    const bytes = await readFile("public" + path),
      info = await sharp(bytes).metadata();
    assets.push({
      demo_persona_id: persona.id,
      slug: persona.slug,
      asset_type: role === "face_source" ? "image_source" : "avatar",
      role,
      storage_path: path,
      mime_type: role === "face_source" ? "image/jpeg" : "image/webp",
      metadata: {
        width: info.width,
        height: info.height,
        bytes: (await stat("public" + path)).size,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        synthetic: true,
        adult: true,
        asset_bundle_version: 1,
      },
    });
  }
}
await writeFile(
  "supabase/seed/demo-persona-assets.json",
  JSON.stringify(assets, null, 2) + "\n",
);
console.log(
  `Built ${assets.length} consistent asset variants from six face sources.`,
);
