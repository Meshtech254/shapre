import { requireUser } from "@/lib/auth/server";
import { check } from "@/lib/api";
import { SettingsForm } from "@/components/app/settings-form";
export default async function SettingsPage() {
  const { db, user } = await requireUser();
  const { data, error } = await db
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  check(error);
  return (
    <SettingsForm
      email={user.email ?? ""}
      name={data.display_name}
      defaults={data.streaming_defaults}
    />
  );
}
