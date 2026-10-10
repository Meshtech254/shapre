import { requireUser } from "@/lib/auth/server";
import { AppShell } from "@/components/app/shell";
import { accountRole } from "@/lib/platform/server";
import type { Metadata } from "next";
export const metadata: Metadata = { robots: { index: false, follow: false, noarchive: true } };
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireUser();
  const role = await accountRole(user.id);
  return (
    <AppShell email={user.email ?? ""} admin={role !== "user"}>
      {children}
    </AppShell>
  );
}
