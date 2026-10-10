# Published demo avatar assets

The initial published set is **Amara, Malik, Hana, Nova, Atlas and Pixel**. Each has an original generated adult portrait. The remaining 18 planned concepts stay in the central catalog but are unpublished; the interface filters out identities without actual avatar bundles. All old placeholder SVG files were removed. No silhouette frames or concept layouts appear in the visible library.

## Setup

Apply migrations 001, 002, then `supabase/migrations/202610070003_demo_avatar_assets.sql`. Migration 003 adds `studio_avatar_url`, `face_source_reference` and the server-owned `demo_persona_assets` table. It records thumbnail, preview, Studio and face-source assets, and supports future face_model/voice_model records. Seed updates target old Shapre concepts; they preserve independently configured admin identities and existing inference/voice readiness. Previously disabled personas stay disabled.

Before migration 003, the server can read the legacy schema and upgrade known bundled placeholder artwork locally. It preserves activation/readiness from the database and filters remaining placeholders out. The fallback affects only visual publication; it never enables inference. Migration 003 is required for model preparation and persisted asset administration.

## Asset layout and consistency

`public/demos/{slug}/` contains:

- `thumbnail.webp`: 384�384, quality 82, used by grids.
- `preview.webp`: 896�896, quality 90, used on the detail page.
- `studio.webp`: 512�512, quality 86, used by Studio.
- `face-source.jpg`: 1024�1024, quality 95, source image for worker preparation.

All variants come from the same face source. Public portrait assets contain no real-person uploads or secrets. The canonical metadata lives in `supabase/seed/demo-personas.json`; image hashes, sizes, MIME and role mappings live in `supabase/seed/demo-persona-assets.json`. `npm run assets:demos` regenerates optimized variants and hashes from the existing face-source images. `npm run seed:demos` regenerates the new avatar migration section, without making database writes. Once a migration is applied, use a new migration or admin operation for later updates.

Next Image handles grid/portrait sizing and optimization. Offscreen thumbnails are lazy-loaded; the first three featured thumbnails are prioritized. Full detail portraits load only on detail navigation; card links disable speculative route prefetch. Studio loads only its selected avatar. New external avatar hosts must be added to the Next Image allowlist; bundled avatars and configured Supabase storage already work.

## Real artwork versus real inference

The six published bundles include **actual face-source image assets**, not face reenactment or voice conversion models. `face_source_reference` points to the source image; `face_asset_reference` remains reserved for a model/identity artifact prepared and accepted by your worker. The seed keeps face_ready=false, inference_ready=false and voice_ready=false because no working model service was provided. The UI says Preview only, while displaying the finished avatar. It never calls a portrait a working transformation.

To make a demo available, prepare its bundled face source using your local/remote worker, scoped to the same demo UUID. Register the prepared artifact with role=face_model and assign its worker reference to face_asset_reference. Set face_ready/inference_ready only after a real session transforms video successfully. A worker can use a source-image identity embedding instead of a separate trained model if supported; its accepted identity artifact still belongs in face_asset_reference. The app sends prepared model reference plus optional absolute source/Studio URLs through the generic session interface. No frontend model SDK is required.

For voice, add a licensed or original synthetic voice artifact with role=voice_model, set voice_asset_reference, then voice_ready after validation. Until then, normal microphone audio passes through with voice transformation disabled. Do not invent Voice Included badges. The existing one-time 60-second demo trial applies only to genuinely ready identities. Portrait generation alone cannot satisfy that requirement. Cloud GPUs are not required if your local worker can run the chosen models.

## Generation and provenance

Built-in image_gen produced the six original synthetic adult portraits. The complete prompt set and image-generation provenance are recorded in [assets/avatar-generation.json](assets/avatar-generation.json). Prompts request fictional adult faces, clear front/bust framing, dark studio backgrounds, premium lighting, no real identifiable people, no celebrity likenesses, no copied franchise characters and no text/frames/logos. Photorealistic subjects cover Amara, Malik and Hana; Nova/Atlas are cybernetic character portraits and Pixel is a stylized adult 3D creator. Generated PNG originals remain in the tool's image directory; all application-required assets are saved in the project.

Run `npm test` for publication/readiness, file signatures, byte limits, checksums, stable identity mappings and legacy/admin behavior. Run `npm run test:studio` for actual browser avatar loading, category filtering, five persona selections, camera/mic switching, frame-rate comparison and unmount cleanup. Screenshots and CPU/React measurements are saved under test-results. Physical/Iriun devices and prepared model output still require local hardware/worker verification.
