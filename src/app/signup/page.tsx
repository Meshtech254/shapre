import { AuthForm } from "@/components/app/auth-form";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Create account", robots: { index: false, follow: false } };
export default function Signup() {
  return <AuthForm signup />;
}
