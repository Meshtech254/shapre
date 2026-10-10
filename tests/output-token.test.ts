import { test } from "node:test";
import assert from "node:assert/strict";
import {
  signOutputToken,
  validateOutputToken,
} from "../src/lib/streaming/token-codec";
const secret = "a".repeat(32);
const now = 1800000000000;
test("output capability is session-scoped and expires", () => {
  const token = signOutputToken("session-one", secret, now);
  assert.equal(validateOutputToken("session-one", token, secret, now), true);
  assert.equal(validateOutputToken("session-two", token, secret, now), false);
  assert.equal(
    validateOutputToken("session-one", token, secret, now + 8 * 60 * 60 * 1000),
    false,
  );
});
test("output capability rejects tampering and malformed input", () => {
  const token = signOutputToken("session", secret, now);
  assert.equal(
    validateOutputToken("session", token + "junk", secret, now),
    false,
  );
  assert.equal(
    validateOutputToken("session", token + ".extra", secret, now),
    false,
  );
  assert.equal(
    validateOutputToken("session", "NaN.signature", secret, now),
    false,
  );
  assert.equal(
    validateOutputToken("session", token, "b".repeat(32), now),
    false,
  );
});
