import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const [selected, ...args] = process.argv.slice(2);
const mode = selected === "configured" ? undefined : selected;
if (mode && !["mock", "local", "remote"].includes(mode))
  throw new Error("Choose mock, local, or remote.");
const child = spawn(
  process.execPath,
  [require.resolve("next/dist/bin/next"), "dev", ...args],
  {
    stdio: "inherit",
    env: { ...process.env, ...(mode ? { INFERENCE_MODE: mode } : {}) },
  },
);
const cleanup = spawn(
  process.execPath,
  [fileURLToPath(new URL("./reap-sessions.mjs", import.meta.url)), "--watch"],
  {
    stdio: "ignore",
    windowsHide: true,
    env: { ...process.env, ...(mode ? { INFERENCE_MODE: mode } : {}) },
  },
);
child.on("exit", (code) => {
  cleanup.kill();
  process.exitCode = code ?? 1;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    child.kill(signal);
    cleanup.kill();
  });
