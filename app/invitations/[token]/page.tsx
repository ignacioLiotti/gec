"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { acceptInvitation, declineInvitation } from "@/app/admin/users/invitation-actions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, UserPlus, Clock, CheckCircle2, XCircle, Loader2, HardHat } from "lucide-react";
import type { User } from "@supabase/supabase-js";

interface InvitationDetails {
  id: string;
  tenant_id: string;
  tenant_name: string;
  email: string;
  invited_role: string;
  invited_operational_role_id: string | null;
  invited_operational_role_name: string | null;
  status: string;
  expires_at: string;
  inviter_name: string;
}

export default function InvitationPage() {
  const params = useParams();
  const router = useRouter();
  const { push } = router;
  const token = params?.token as string;

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    async function loadInvitation() {
      try {
        const supabase = createSupabaseBrowserClient();

        // Get current user
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        setUser(currentUser);

        // Get invitation details
        const { data, error } = await supabase.rpc("get_invitation_by_token", {
          invitation_token: token,
        });

        if (error || !data || data.length === 0) {
          setError("La invitación no es válida o ya venció.");
          setLoading(false);
          return;
        }

        const inviteData = data[0];
        setInvitation(inviteData);

        // Check if user email matches
        if (currentUser?.email && currentUser.email.toLowerCase() !== inviteData.email.toLowerCase()) {
          setError(
            `Esta invitación fue enviada a ${inviteData.email}. Iniciá sesión con ese correo para aceptarla.`
          );
        }

        setLoading(false);
      } catch (err) {
        console.error("Error loading invitation:", err);
        setError("No pudimos cargar los datos de la invitación.");
        setLoading(false);
      }
    }

    if (token) {
      loadInvitation();
    }
  }, [token]);

  const handleAccept = async () => {
    if (!user) {
      // Redirect to login with return URL
      push(`/?returnTo=/invitations/${token}`);
      return;
    }

    setProcessing(true);
    setError(null);
    try {
      const result = await acceptInvitation(token);
      if (result.error) {
        if ("alreadyMember" in result && result.alreadyMember) {
          push("/");
        } else {
          setError(result.error);
        }
      } else if (result.success) {
        push(`/api/tenants/${result.tenantId}/switch?next=${encodeURIComponent("/dashboard")}`);
      } else {
        setError("Ocurrió un problema inesperado.");
      }
    } catch {
      setError("No pudimos aceptar la invitación. Volvé a intentarlo.");
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!user) {
      push(`/?returnTo=/invitations/${token}`);
      return;
    }
    setProcessing(true);
    setError(null);
    try {
      const result = await declineInvitation(token);
      if (result.error) {
        setError(result.error);
        return;
      }
      push("/onboarding");
    } catch {
      setError("No pudimos rechazar la invitación. Volvé a intentarlo.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas p-4">
        <Card className="w-full max-w-md border-stroke-soft shadow-card">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="size-8 animate-spin text-stone-400" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas p-4">
        <Card className="w-full max-w-md border-destructive/30 shadow-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <XCircle className="size-6 text-red-500" />
            <CardTitle className="text-red-700">Invitación no válida</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-stone-600 mb-4">{error}</p>
            <Button onClick={() => push("/")} className="w-full">
              Volver al inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invitation) {
    return null;
  }

  const expiresAt = new Date(invitation.expires_at);
  const now = new Date();
  const isExpired = expiresAt < now;
  const timeRemaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)));

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas p-4">
      <Card className="w-full max-w-lg border-stroke-soft shadow-card">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-xl border border-orange-primary/25 bg-orange-primary/10 p-4 text-orange-primary shadow-sm">
              <Building2 className="size-10" />
            </div>
          </div>
          <CardTitle className="text-2xl">Te invitaron a trabajar en Síntesis</CardTitle>
          <CardDescription className="text-base">
            Sumate a <strong>{invitation.tenant_name}</strong>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Invitation Details */}
          <div className="space-y-3 rounded-lg border border-stroke-soft bg-surface-recessed p-4 shadow-inner">
            <div className="flex items-start gap-3">
              <UserPlus className="size-5 text-stone-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-stone-700">Invitado por</p>
                <p className="text-sm text-stone-600">{invitation.inviter_name || "Administrador de la organización"}</p>
              </div>
            </div>

            {invitation.invited_operational_role_name ? (
              <div className="flex items-start gap-3">
                <HardHat className="mt-0.5 size-5 text-content-muted" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-content">Trabajo principal</p>
                  <p className="text-sm text-content-secondary">
                    {invitation.invited_operational_role_name}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="flex items-start gap-3">
              <CheckCircle2 className="size-5 text-stone-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-content">Nivel de acceso</p>
                <p className="text-sm text-content-secondary">
                  {invitation.invited_role === "admin" ? "Administrador" : "Miembro"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="size-5 text-stone-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-stone-700">Vence</p>
                <p className="text-sm text-stone-600">
                  {isExpired ? (
                    <span className="text-red-600">Vencida</span>
                  ) : timeRemaining < 24 ? (
                    <span className="text-warning-foreground">
                      {timeRemaining === 0 ? "Menos de una hora" : `En ${timeRemaining} horas`}
                    </span>
                  ) : (
                    <span>En {Math.floor(timeRemaining / 24)} días</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* User Status */}
          {!user && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-700">
                Iniciá sesión con <strong>{invitation.email}</strong> para aceptar esta invitación.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={() => push("/")}
              variant="outline"
              className="flex-1"
              disabled={processing}
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Procesando&hellip;
                </>
              ) : (
                "Ahora no"
              )}
            </Button>
            <Button
              onClick={handleAccept}
              className="flex-1"
              disabled={processing || isExpired || (Boolean(user) && error !== null)}
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Procesando&hellip;
                </>
              ) : !user ? (
                "Iniciar sesión para aceptar"
              ) : (
                "Aceptar invitación"
              )}
            </Button>
          </div>

          {user && !isExpired && !error ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="ghost" className="w-full text-destructive" disabled={processing}>
                  Rechazar invitación
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Rechazar esta invitación?</AlertDialogTitle>
                  <AlertDialogDescription>
                    El enlace dejará de funcionar. Para sumarte después, una persona administradora deberá invitarte nuevamente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Volver</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDecline}>
                    Rechazar invitación
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}

          {isExpired && (
            <p className="text-center text-sm text-stone-500">
              Esta invitación venció. Pedile a la persona administradora que envíe una nueva.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
