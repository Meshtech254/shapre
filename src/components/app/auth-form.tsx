"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { browserSupabase } from "@/lib/supabase/browser";
import { Brand } from "@/components/ui";
export function AuthForm({ signup = false }: { signup?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <div className="auth">
      <div className="auth-story">
        <Brand />
        <div>
          <div className="eyebrow">Your identity. Your stage.</div>
          <h1 style={{ margin: "20px 0" }}>
            A new way
            <br />
            to show up.
          </h1>
          <p>
            Create a realistic AI face and voice, then use them live on stream.
          </p>
        </div>
        <p style={{ fontSize: 12 }}>
          Built for creators. Designed for responsible use.
        </p>
      </div>
      <div className="auth-form">
        {(!process.env.NEXT_PUBLIC_SUPABASE_URL ||
          !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) && (
          <div className="notice">
            Connect Supabase to enable accounts. Add the Supabase URL and anon
            key from .env.example to your deployment environment.
          </div>
        )}
        <div className="stack">
          <Brand />
          <h1>{signup ? "Create your account" : "Welcome back."}</h1>
          <p>
            {signup
              ? "Your next creative chapter starts here."
              : "Your studio is waiting for you."}
          </p>
        </div>
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
        {sent ? (
          <div className="notice">
            Check your email to confirm your account, then return to log in.
          </div>
        ) : (
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                const form = new FormData(e.currentTarget);
                const db = browserSupabase();
                const credentials = {
                  email: String(form.get("email")),
                  password: String(form.get("password")),
                };
                const result = signup
                  ? await db.auth.signUp({
                      ...credentials,
                      options: {
                        data: { display_name: form.get("name") },
                        emailRedirectTo: `${location.origin}/auth/callback`,
                      },
                    })
                  : await db.auth.signInWithPassword(credentials);
                if (result.error) throw result.error;
                if (signup && !result.data.session) setSent(true);
                else {
                  router.push("/dashboard");
                  router.refresh();
                }
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Authentication failed.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {signup && (
              <label className="field">
                <span>Display name</span>
                <input
                  name="name"
                  required
                  maxLength={80}
                  autoComplete="name"
                  placeholder="How should we call you?"
                />
              </label>
            )}
            <label className="field">
              <span>Email address</span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                name="password"
                type="password"
                minLength={8}
                autoComplete={signup ? "new-password" : "current-password"}
                required
                placeholder="At least 8 characters"
              />
            </label>
            {signup && (
              <label className="consent">
                <input type="checkbox" required />
                <span>
                  I agree to the <Link href="/legal/terms">Terms</Link> and{" "}
                  <Link href="/legal/acceptable-use">
                    Acceptable Use Policy
                  </Link>
                  .
                </span>
              </label>
            )}
            <button disabled={busy} className="btn primary">
              {busy ? "Please wait…" : signup ? "Create account" : "Log in"}
            </button>
          </form>
        )}
        {process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true" && (
          <button
            className="btn"
            onClick={async () => {
              try {
                const { error } = await browserSupabase().auth.signInWithOAuth({
                  provider: "google",
                  options: { redirectTo: `${location.origin}/auth/callback` },
                });
                if (error) throw error;
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Google login failed.",
                );
              }
            }}
          >
            Continue with Google
          </button>
        )}
        <p style={{ fontSize: 12, textAlign: "center" }}>
          {signup ? "Already have an account?" : "New to Shapre?"}{" "}
          <Link
            style={{ color: "var(--accent)" }}
            href={signup ? "/login" : "/signup"}
          >
            {signup ? "Log in" : "Create an account"}
          </Link>
        </p>
      </div>
    </div>
  );
}
