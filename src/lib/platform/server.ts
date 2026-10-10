import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import { admin } from "@/lib/supabase/admin";
import { HttpError } from "@/lib/api";
import {
  platformDefaults,
  settingSchemas,
  type ProductPolicy,
  type Role,
  type SettingKey,
} from "./schema";
export const platformSettings = unstable_cache(
  async () => {
    const { data, error } = await admin()
      .from("platform_settings")
      .select("key,value");
    if (error)
      throw new HttpError(
        "Apply migration 004 to enable platform controls.",
        503,
      );
    const settings = { ...platformDefaults } as Record<SettingKey, unknown>;
    for (const row of data ?? []) {
      const key = row.key as SettingKey,
        parsed = settingSchemas[key]?.safeParse(row.value);
      if (parsed?.success) settings[key] = parsed.data;
    }
    return settings as unknown as {
      [K in SettingKey]: import("zod").infer<(typeof settingSchemas)[K]>;
    };
  },
  ["platform-settings-v1"],
  { revalidate: 30, tags: ["platform-settings"] },
);
export const accountRole = cache(async (userId: string): Promise<Role> => {
  const { data, error } = await admin()
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error)
    throw new HttpError("Apply migration 004 to enable platform roles.", 503);
  return data?.role ?? "user";
});
export async function getUserEntitlements(
  userId: string,
): Promise<ProductPolicy> {
  const testing = (await cookies()).get("shapre-test-user")?.value === "true";
  const { data, error } = await admin().rpc("resolve_product_policy", {
    owner_id: userId,
    test_normal: testing,
  });
  if (error)
    throw new HttpError(
      "Platform entitlements are unavailable. Apply migration 004.",
      503,
    );
  return data as ProductPolicy;
}
export async function hasEntitlement(userId: string, key: keyof ProductPolicy) {
  return (await getUserEntitlements(userId))[key] === true;
}
export async function requireAdmin(userId: string, superOnly = false) {
  const role = await accountRole(userId);
  if (role === "user" || (superOnly && role !== "super_admin"))
    throw new HttpError("Administrator access required.", 403);
  return role;
}
