import { createHmac, timingSafeEqual } from "node:crypto";
export function signOutputToken(id: string, secret: string, now = Date.now()) {
  const expires = now + 8 * 60 * 60 * 1000;
  return `${expires}.${createHmac("sha256", secret).update(`${id}.${expires}`).digest("base64url")}`;
}
export function validateOutputToken(
  id: string,
  token: string,
  secret: string,
  now = Date.now(),
) {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [expires, signature] = parts;
  const expiry = Number(expires);
  if (!signature || !Number.isSafeInteger(expiry) || expiry <= now)
    return false;
  const expected = createHmac("sha256", secret)
    .update(`${id}.${expires}`)
    .digest();
  const actual = Buffer.from(signature, "base64url");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
