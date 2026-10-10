import { requireUser } from "@/lib/auth/server";
import { notFound } from "next/navigation";
import { PersonaDetails } from "@/components/personas/details";
export default async function PersonaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { db } = await requireUser();
  const { data, error } = await db
    .from("personas")
    .select("id")
    .eq("id", id)
    .single();
  if (error || !data) notFound();
  return <PersonaDetails id={id} />;
}
