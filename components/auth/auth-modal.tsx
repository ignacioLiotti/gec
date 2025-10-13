"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

type AuthModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    try {
      if (mode === "sign_in") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        // After sign-up route to onboarding to pick a tenant
        router.push("/onboarding");
      }
      onOpenChange(false);
      setEmail("");
      setPassword("");
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {mode === "sign_in" ? "Sign in" : "Create account"}
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-md px-2 py-1 text-sm hover:bg-foreground/10"
          >
            Esc
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>
          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-500">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white shadow hover:bg-black/90 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-white/90"
          >
            {loading ? "Loading..." : mode === "sign_in" ? "Sign in" : "Sign up"}
          </button>
        </form>

        <div className="mt-3 text-center text-sm">
          {mode === "sign_in" ? (
            <button
              onClick={() => setMode("sign_up")}
              className="text-foreground/80 hover:underline"
            >
              Need an account? Sign up
            </button>
          ) : (
            <button
              onClick={() => setMode("sign_in")}
              className="text-foreground/80 hover:underline"
            >
              Already have an account? Sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


