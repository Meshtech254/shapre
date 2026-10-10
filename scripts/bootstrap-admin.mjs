import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
const { createClient } = require("@supabase/supabase-js");
const account = process.argv[2];
if (!account)
  throw new Error("Usage: npm run admin:bootstrap -- <user-uuid-or-email>");
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
let userId = account;
if (account.includes("@")) {
  let found;
  for (let page = 1; page <= 100 && !found; page++) {
    const result = await db.auth.admin.listUsers({ page, perPage: 100 });
    if (result.error) throw result.error;
    found = result.data.users.find(
      (u) => u.email?.toLowerCase() === account.toLowerCase(),
    );
    if (result.data.users.length < 100) break;
  }
  if (!found)
    throw new Error("Sign up with this account before assigning its role.");
  userId = found.id;
}
const result = await db.rpc("bootstrap_platform_owner", { owner_id: userId });
if (result.error) throw new Error(result.error.message);
console.log(
  "Founder role assigned and audited. Sign in again or refresh Studio.",
);
