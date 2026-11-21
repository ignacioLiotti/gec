"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";


import { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { usePathname, useSearchParams } from "next/navigation";
import { resolveTenantSwitchRedirect } from "@/lib/tenant-switch-redirect";

const DesktopAsciiScene = dynamic(
  () => import("@/components/ascii-scene").then((module) => module.AsciiScene),
  { ssr: false },
);

const DESKTOP_VISUAL_MEDIA_QUERY = "(min-width: 1280px)";

type AuthModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forcedOpen?: boolean;
  initialMode?: "sign_in" | "sign_up";
  entryPage?: boolean;
};

const MOBILE_NAVIGATION_PREVIEW_ORIGIN =
  "https://gec-git-mobile-navigation-ignacioliottis-projects.vercel.app";

function getAuthRedirectOrigin() {
  if (typeof window === "undefined") return "";

  const { hostname, origin } = window.location;
  if (hostname === "gec-git-mobile-navigation-ignacioliottis-projects.vercel.app") {
    return MOBILE_NAVIGATION_PREVIEW_ORIGIN;
  }

  return origin;
}

function getAuthErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (message.includes("invalid login credentials")) {
    return "El correo o la contraseña no son correctos.";
  }
  if (message.includes("email not confirmed")) {
    return "Primero confirmá tu correo desde el mensaje que te enviamos.";
  }
  if (message.includes("user already registered")) {
    return "Ese correo ya tiene una cuenta. Probá iniciar sesión.";
  }
  if (message.includes("password should be")) {
    return "La contraseña debe tener al menos 8 caracteres.";
  }
  if (message.includes("rate limit") || message.includes("too many requests")) {
    return "Hubo demasiados intentos. Esperá un momento y volvé a probar.";
  }

  return "No pudimos completar el acceso. Revisá los datos e intentá nuevamente.";
}

function normalizeReturnPath(value: string | null) {
  if (!value) return null;
  const url = resolveTenantSwitchRedirect("http://localhost", value, "/");
  return `${url.pathname}${url.search}${url.hash}`;
}

function useDesktopVisual() {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_VISUAL_MEDIA_QUERY);
    const updateVisibility = () => setShouldShow(mediaQuery.matches);

    updateVisibility();
    mediaQuery.addEventListener("change", updateVisibility);
    return () => mediaQuery.removeEventListener("change", updateVisibility);
  }, []);

  return shouldShow;
}

function AuthModalContent({ open, onOpenChange, forcedOpen = false, initialMode = "sign_in", entryPage = false }: AuthModalProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryParams = new URLSearchParams(searchParams);
  const getSearchParam = (key: string): string | null => queryParams.get(key);
  const [mode, setMode] = useState<"sign_in" | "sign_up">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const returnTo = normalizeReturnPath(getSearchParam("returnTo"));
  const showDesktopVisual = useDesktopVisual();

  useEffect(() => {
    setReady(true);
  }, []);

  const currentPathWithQuery = (() => {
    const current = `${pathname ?? "/"}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;
    return current.startsWith("/") ? current : "/";
  })();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    const supabase = createSupabaseBrowserClient();
    let navigating = false;
    try {
      if (mode === "sign_in") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;

        navigating = true;
        window.location.assign(returnTo ?? (entryPage ? "/onboarding" : currentPathWithQuery));
      } else {
        const { error: signUpError, data: signUpData } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (signUpError) throw signUpError;

        if (!signUpData.session) {
          setMode("sign_in");
          setPassword("");
          setNotice("Te enviamos un correo de confirmación. Abrilo y después iniciá sesión para continuar.");
          return;
        }

        const signUpDestination =
          returnTo ??
          (currentPathWithQuery.startsWith("/invitations/")
            ? currentPathWithQuery
            : "/onboarding");
        navigating = true;
        window.location.assign(signUpDestination);
      }
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err));
    } finally {
      if (!navigating) setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    setError(null);
    setNotice(null);
    const supabase = createSupabaseBrowserClient();
    try {
      const next = encodeURIComponent(returnTo ?? currentPathWithQuery);
      const redirectTo = `${getAuthRedirectOrigin()}/auth/callback?next=${next}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
        },
      });
      if (error) throw error;
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err));
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className={entryPage ? "min-h-dvh bg-canvas" : "fixed inset-0 z-[10000001] bg-canvas"}
      role={entryPage ? undefined : "dialog"}
      aria-modal={entryPage ? undefined : true}
      aria-labelledby="auth-modal-title"
      aria-describedby="auth-modal-description"
    >
      {entryPage ? null : forcedOpen ? (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />
      ) : (
        <button
          type="button"
          aria-label="Cerrar modal"
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
        />
      )}
      <div className="relative z-10 grid h-dvh grid-cols-1 xl:grid-cols-[minmax(0,1.05fr)_minmax(28rem,0.95fr)]">
        <div className="hidden h-full min-h-0 w-full p-4 xl:block" aria-hidden="true">
          {showDesktopVisual && <DesktopAsciiScene />}
        </div>
        <div className="flex h-full min-h-0 w-full flex-col overflow-y-auto bg-surface px-5 py-6 text-content sm:px-10 sm:py-8">
        <div className="flex items-center justify-end gap-4">
          {entryPage ? (
            <Link href="/" className="text-sm text-content-secondary underline underline-offset-4">
              Volver al inicio
            </Link>
          ) : !forcedOpen && (
            <Button variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-3 py-1.5 text-sm font-medium transition-colors duration-150 active:scale-[0.97]"
            >
              Cerrar
            </Button>
          )}
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 py-6 sm:gap-8">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="mb-8 flex flex-col items-center justify-center gap-2 text-center sm:mb-10">
              <div className="mb-3 flex size-12 items-center justify-center rounded-xl border border-stroke bg-surface-raised shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_2px_8px_rgba(0,0,0,0.06)]">
                <span className="size-4 rounded-full bg-orange-primary shadow-[inset_0_1px_1px_rgba(255,255,255,0.65)]" />
              </div>
              <h2 id="auth-modal-title" className="font-mono text-2xl font-normal sm:text-3xl">
                Bienvenido a Síntesis
              </h2>
              <p id="auth-modal-description" className="text-sm uppercase tracking-wide text-content-muted">
                {mode === "sign_in" ? "Iniciar sesión" : "Crear tu cuenta"}
              </p>
              <p className="max-w-sm text-sm leading-6 text-content-secondary">
                {mode === "sign_in"
                  ? "Entrá a tus obras, documentos y tareas pendientes."
                  : "Usá tu correo habitual. Después te guiaremos para preparar la organización."}
              </p>
            </div>
            <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-sm" htmlFor="email">
                      Correo electrónico
                    </label>
                    <Input
                      id="email"
                      type="email"
                      disabled={!ready || loading}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      placeholder="nombre@empresa.com"
                      required
                      className="min-h-11 w-full px-3 py-2 text-base transition-[border-color,box-shadow] duration-150 sm:text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm" htmlFor="password">
                      Contraseña
                    </label>
                    <Input
                      id="password"
                      type="password"
                      disabled={!ready || loading}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
                      minLength={mode === "sign_up" ? 8 : undefined}
                      placeholder={mode === "sign_up" ? "Mínimo 8 caracteres" : "Tu contraseña"}
                      required
                      className="min-h-11 w-full px-3 py-2 text-base transition-[border-color,box-shadow] duration-150 sm:text-sm"
                    />
                    {mode === "sign_up" && (
                      <p className="text-xs text-content-muted">Usá 8 caracteres o más.</p>
                    )}
                  </div>
                  {error && (
                    <div role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700">
                      {error}
                    </div>
                  )}
                  {notice && (
                    <div role="status" className="rounded-md border border-emerald-600/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800">
                      {notice}
                    </div>
                  )}
                  <Button variant="outline"
                    type="submit"
                    disabled={!ready || loading}
                    className="inline-flex min-h-11 w-full items-center justify-center px-4 py-2 text-sm font-semibold transition-[transform,filter] duration-150 hover:brightness-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {!ready ? "Preparando formulario…" : loading ? "Cargando..." : mode === "sign_in" ? "Iniciar sesión" : "Crear cuenta"}
                  </Button>
            </div>
          </form>
          <Button variant={"dark"}
              type="button"
              onClick={handleGoogleSignIn}
              disabled={!ready || loading}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 px-4 py-2 text-sm font-semibold transition-[transform,background-color] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="size-5" viewBox="0 0 24 24">
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
              {mode === "sign_in" ? "Ingresar con Google" : "Continuar con Google"}
            </Button>
          <p className="text-center text-xs text-content-muted">
            <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
              Política de privacidad (abre en otra pestaña)
            </Link>
          </p>

          <div className="text-center text-sm">
            {mode === "sign_in" ? (
              <button
                type="button"
                onClick={() => {
                  setMode("sign_up");
                  setError(null);
                  setNotice(null);
                  setPassword("");
                }}
                className="font-medium text-content-secondary underline-offset-4 transition-colors duration-150 hover:text-content hover:underline"
              >
                ¿Primera vez? Crear cuenta
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMode("sign_in");
                  setError(null);
                  setNotice(null);
                  setPassword("");
                }}
                className="font-medium text-content-secondary underline-offset-4 transition-colors duration-150 hover:text-content hover:underline"
              >
                ¿Ya tenés una cuenta? Iniciar sesión
              </button>
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthModal(props: AuthModalProps) {
  return (
    <Suspense fallback={null}>
      <AuthModalContent {...props} />
    </Suspense>
  );
}
