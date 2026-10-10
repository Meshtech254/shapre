import { test } from "node:test";
import assert from "node:assert/strict";
import seed from "../supabase/seed/demo-personas.json";
import assets from "../supabase/seed/demo-persona-assets.json";
import { demoAvailable, hasAvatar } from "../src/lib/demo-personas/types";
import { avatarCatalog } from "../src/lib/demo-personas/catalog";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

test("six priority identities publish actual matching avatar and face-source files", () => {
  const published = seed.filter((p) => p.active);
  assert.deepEqual(published.map((p) => p.slug).sort(), [
    "amara",
    "atlas",
    "hana",
    "malik",
    "nova",
    "pixel",
  ]);
  assert.equal(seed.filter((p) => p.featured).length, 6);
  for (const p of published) {
    assert.equal(hasAvatar(p), true);
    assert.equal(demoAvailable(p), false);
    assert.equal(p.face_asset_reference, null);
    assert.equal(p.voice_ready, false);
    for (const url of [
      p.thumbnail_url,
      p.preview_image_url,
      p.studio_avatar_url,
      p.face_source_reference,
    ])
      assert.ok(url && existsSync("public" + url));
    assert.ok(!p.thumbnail_url.endsWith(".svg"));
    assert.equal(p.metadata.placeholder, false);
  }
  assert.ok(seed.filter((p) => !p.active).every((p) => !p.featured));
});
test("asset manifest contains actual optimized images and verifiable identity mappings", () => {
  assert.equal(assets.length, 24);
  for (const asset of assets) {
    const bytes = readFileSync("public" + asset.storage_path);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      asset.metadata.sha256,
    );
    assert.equal(bytes.length, asset.metadata.bytes);
    assert.ok(bytes.length > 1000);
    assert.ok(bytes.length < (asset.role === "face_source" ? 800000 : 250000));
    assert.equal(
      seed.find((p) => p.slug === asset.slug)?.id,
      asset.demo_persona_id,
    );
    if (asset.mime_type === "image/webp")
      assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
    else assert.equal(bytes[0], 0xff);
  }
});
test("catalog upgrades old placeholders, suppresses unpublished concepts and preserves admin disabling", () => {
  const old = seed.map((p) => ({
    ...p,
    active: true,
    studio_avatar_url: null,
    metadata: { placeholder: true },
    thumbnail_url: "/demos/old.svg",
    preview_image_url: "/demos/old.svg",
  }));
  assert.equal(avatarCatalog(old).length, 6);
  assert.ok(avatarCatalog(old).every((p) => !p.thumbnail_url.endsWith(".svg")));
  assert.equal(avatarCatalog([{ ...old[0], active: false }]).length, 0);
  const custom = {
    ...seed[0],
    studio_avatar_url: "/custom/identity.webp",
    metadata: { placeholder: false },
  };
  assert.equal(
    avatarCatalog([custom])[0].studio_avatar_url,
    "/custom/identity.webp",
  );
});
test("avatar visuals cannot manufacture model readiness", () => {
  const p = { ...seed[0], inference_ready: true, face_ready: true };
  assert.equal(demoAvailable(p), true);
  assert.equal(demoAvailable({ ...p, active: false }), false);
  assert.equal(demoAvailable({ ...p, face_ready: false }), false);
  assert.equal(demoAvailable({ ...p, metadata: { placeholder: true } }), false);
});
