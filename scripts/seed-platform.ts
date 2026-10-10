import { readFileSync, writeFileSync } from "node:fs";
import { platformDefaults } from "../src/lib/platform/schema";
const path = "supabase/migrations/202610070004_platform_control.sql";
const marker = "-- Generated platform defaults";
const sql = Object.entries(platformDefaults)
  .map(
    ([key, value]) =>
      `insert into public.platform_settings(key,value,description) values('${key}','${JSON.stringify(value).replaceAll("'", "''")}'::jsonb,'${key}') on conflict(key) do nothing;`,
  )
  .join("\n");
writeFileSync(
  path,
  readFileSync(path, "utf8").split(marker)[0] + marker + "\n" + sql + "\n",
);
