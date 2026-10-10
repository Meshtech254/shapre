import "server-only";
import { signOutputToken, validateOutputToken } from "./token-codec";
import { env, mockMode } from "@/lib/env";
function secret() {
  if (env.OUTPUT_TOKEN_SECRET && env.OUTPUT_TOKEN_SECRET.length >= 32)
    return env.OUTPUT_TOKEN_SECRET;
  if (mockMode) return "development-only-shapre-output-secret";
  throw new Error("Set OUTPUT_TOKEN_SECRET to at least 32 random characters.");
}
export function outputToken(id: string) {
  return signOutputToken(id, secret());
}
export function verifyOutputToken(id: string, token: string) {
  if (token.split(".").length !== 2) return false;
  return validateOutputToken(id, token, secret());
}
