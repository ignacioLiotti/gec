"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { AsciiScene } from "@/components/ascii-scene";
import { AnimatePresence, motion } from "framer-motion";

type AuthModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forcedOpen?: boolean;
};

export default function AuthModal({ open, onOpenChange, forcedOpen = false }: AuthModalProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOtherMethods, setShowOtherMethods] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    console.log("[AUTH-MODAL] handleSubmit started, mode:", mode);
    try {
      if (mode === "sign_in") {
        console.log("[AUTH-MODAL] Calling signInWithPassword...");
        const { error: signInError, data: signInData } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        console.log("[AUTH-MODAL] signInWithPassword result:", { error: signInError, user: signInData?.user?.email, session: !!signInData?.session });
        if (signInError) throw signInError;

        // Wait for session to be fully established
        console.log("[AUTH-MODAL] Calling getSession...");
        const { data: sessionData } = await supabase.auth.getSession();
        console.log("[AUTH-MODAL] getSession result:", { hasSession: !!sessionData?.session, user: sessionData?.session?.user?.email });

        // Check cookies before delay
        console.log("[AUTH-MODAL] Cookies before delay:", document.cookie);

        // Give the session time to persist to cookies
        console.log("[AUTH-MODAL] Waiting 300ms for cookies to persist...");
        await new Promise(resolve => setTimeout(resolve, 300));

        // Check cookies after delay
        console.log("[AUTH-MODAL] Cookies after delay:", document.cookie);

        // Refresh server state to pick up new session
        console.log("[AUTH-MODAL] Calling router.refresh()...");
        router.refresh();
        console.log("[AUTH-MODAL] router.refresh() called");

        // Close modal after session is synced
        onOpenChange(false);
        setEmail("");
        setPassword("");
        console.log("[AUTH-MODAL] Modal closed, login flow complete");
      } else {
        console.log("[AUTH-MODAL] Calling signUp...");
        const { error: signUpError, data: signUpData } = await supabase.auth.signUp({
          email,
          password,
        });
        console.log("[AUTH-MODAL] signUp result:", { error: signUpError, user: signUpData?.user?.email });
        if (signUpError) throw signUpError;

        // Wait for session
        const { data: sessionData } = await supabase.auth.getSession();
        console.log("[AUTH-MODAL] getSession after signUp:", { hasSession: !!sessionData?.session });
        await new Promise(resolve => setTimeout(resolve, 300));

        // After sign-up route to onboarding to pick a tenant
        router.push("/onboarding");
        onOpenChange(false);
        setEmail("");
        setPassword("");
      }
    } catch (err: any) {
      console.error("[AUTH-MODAL] Error:", err);
      setError(err?.message ?? "Algo salió mal");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    console.log("[AUTH-MODAL] handleGoogleSignIn started");
    try {
      const redirectTo = `${window.location.origin}/auth/callback`;
      console.log("[AUTH-MODAL] Calling signInWithOAuth, redirectTo:", redirectTo);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
        },
      });
      if (error) throw error;
      console.log("[AUTH-MODAL] signInWithOAuth initiated, redirecting to Google...");
    } catch (err: any) {
      console.error("[AUTH-MODAL] Google sign in error:", err);
      setError(err?.message ?? "Algo salió mal");
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm grid grid-cols-2"
      onClick={(e) => {
        // Prevent dismissal via backdrop click when forced open
        if (forcedOpen) {
          e.stopPropagation();
          return;
        }
        // Allow backdrop click to close if not forced
        if (e.target === e.currentTarget) {
          onOpenChange(false);
        }
      }}
    >
      <div className="h-full w-full p-4">
        <AsciiScene />
      </div>
      <div className="flex h-full w-full flex-col bg-background px-4 py-6 text-foreground sm:px-10 sm:py-8">
        <div className="flex items-center justify-end gap-4">
          {!forcedOpen && (
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-foreground/10"
            >
              Cerrar
            </button>
          )}
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 py-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex flex-col gap-2 items-center justify-center mb-10">
              <h2 className="text-3xl font-normal font-mono ">
                Bienvenido a Sintesis
              </h2>
              <p className="text-sm uppercase tracking-wide text-muted-foreground">
                {mode === "sign_in" ? "Iniciar sesión" : "Crear una cuenta"}
              </p>
            </div>
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-none border border-input bg-black px-4 py-2 text-sm font-medium shadow-sm text-white hover:bg-black/90 disabled:opacity-50"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continuar con Google
            </button>
            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <button
                type="button"
                onClick={() => setShowOtherMethods(!showOtherMethods)}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                otros metodos
              </button>
              <div className="h-px flex-1 bg-border" />
            </div>
            <AnimatePresence>
              {showOtherMethods && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3 overflow-hidden"
                >
                  <div className="space-y-1">
                    <label className="text-sm" htmlFor="email">
                      Correo electrónico
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
                      Contraseña
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
                    className="inline-flex w-full items-center justify-center rounded-none bg-black px-4 py-2 text-sm font-medium text-white shadow hover:bg-black/90 disabled:opacity-50"
                  >
                    {loading ? "Cargando..." : mode === "sign_in" ? "Iniciar sesión" : "Registrarse"}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            {!showOtherMethods && error && (
              <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-500">
                {error}
              </div>
            )}
          </form>

          <div className="text-center text-sm">
            {mode === "sign_in" ? (
              <button
                onClick={() => setMode("sign_up")}
                className="text-foreground/80 hover:underline"
              >
                ¿Necesitás una cuenta? Registrate
              </button>
            ) : (
              <button
                onClick={() => setMode("sign_in")}
                className="text-foreground/80 hover:underline"
              >
                ¿Ya tenés una cuenta? Iniciá sesión
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

