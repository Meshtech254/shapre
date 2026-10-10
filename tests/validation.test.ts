import { test } from "node:test";
import assert from "node:assert/strict";
import {
  personaInput,
  studioSettings,
  validateFile,
} from "../src/lib/validation/index";
test("persona rights must be affirmed", () => {
  assert.equal(
    personaInput.safeParse({ name: "Nova", consentFace: false }).success,
    false,
  );
  assert.equal(
    personaInput.safeParse({ name: "Nova", consentFace: true }).success,
    true,
  );
});
test("upload formats and limits reject invalid files", () => {
  assert.throws(() => validateFile("face", "image/svg+xml", 100));
  assert.throws(() => validateFile("voice", "audio/mpeg", 51 * 1024 * 1024));
  assert.throws(() => validateFile("face", "image/png", 0));
  assert.doesNotThrow(() =>
    validateFile("face", "image/webp", 10 * 1024 * 1024),
  );
});
test("studio rejects settings outside supported ranges", () => {
  assert.equal(studioSettings.safeParse({ pitch: 13 }).success, false);
  assert.equal(studioSettings.safeParse({ quality: "Ultra" }).success, false);
  assert.equal(studioSettings.parse({}).voiceEnabled, false);
});
