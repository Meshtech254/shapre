import { Output } from "@/components/studio/output";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Private session output", robots: { index: false, follow: false, noarchive: true } };
export default async function OutputPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { sessionId } = await params;
  const { token } = await searchParams;
  return <Output id={sessionId} token={token ?? ""} />;
}
