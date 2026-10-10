import { AuthForm } from "@/components/app/auth-form";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Log in", robots: { index: false, follow: false } };
export default function Login() {
  return <AuthForm />;
}
