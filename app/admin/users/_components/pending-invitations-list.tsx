"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { listPendingInvitations, cancelInvitation } from "@/app/admin/users/invitation-actions";
import { Mail, Clock, X, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";

interface Invitation {
  id: string;
  email: string;
  invited_role: string;
  invited_operational_role_name?: string | null;
  status: string;
  expires_at: string;
  created_at: string;
  inviter: {
    full_name: string;
  } | null;
  inviteLink: string | null;
}

interface PendingInvitationsListProps {
  tenantId: string;
}

export function PendingInvitationsList({ tenantId }: PendingInvitationsListProps) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadInvitations = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await listPendingInvitations(tenantId);
      if (result.error) throw new Error(result.error);
      setInvitations((result.invitations ?? []) as unknown as Invitation[]);
    } catch {
      setLoadError("No pudimos cargar las invitaciones. Volvé a intentarlo.");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadInvitations();
    });
    return () => {
      cancelled = true;
    };
  }, [loadInvitations]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const handleCancel = async (invitationId: string) => {
    setCancellingId(invitationId);
    const result = await cancelInvitation(invitationId, tenantId);
    setCancellingId(null);

    if (result.error) {
      toast.error(result.error);
    } else if (result.success) {
      toast.success("Invitación cancelada");
      setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
    }
  };

  const copyInviteLink = async (inviteLink: string | null) => {
    if (!inviteLink) {
      toast.error("No encontramos el enlace de esta invitación.");
      return;
    }
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success("Enlace de invitación copiado");
    } catch {
      toast.error("No pudimos copiar el enlace.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-6 animate-spin text-stone-400" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-warning/35 bg-warning/15 p-4 text-sm text-warning-foreground">
        <p>{loadError}</p>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={loadInvitations}>
          Volver a intentar
        </Button>
      </div>
    );
  }

  if (invitations.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Invitaciones Pendientes</CardTitle>
        <CardDescription>
          Usuarios que han sido invitados pero aún no han aceptado
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {invitations.map((invitation) => {
            const expiresAt = new Date(invitation.expires_at);
            const hoursRemaining = Math.max(
              0,
              Math.floor((expiresAt.getTime() - nowMs) / (1000 * 60 * 60))
            );
            const isExpired = expiresAt.getTime() <= nowMs;
            const isExpiringSoon = hoursRemaining < 24;

            return (
              <div
                key={invitation.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-stone-50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2 bg-blue-100 rounded-full">
                    <Mail className="size-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{invitation.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs capitalize">
                        {invitation.invited_role === "admin" ? "Administrador" : "Miembro"}
                      </Badge>
                      {invitation.invited_operational_role_name ? (
                        <Badge variant="secondary" className="text-xs">
                          {invitation.invited_operational_role_name}
                        </Badge>
                      ) : null}
                      <span className="text-xs text-stone-500 flex items-center gap-1">
                        <Clock className="size-3" />
                        {isExpired ? (
                          <span className="font-medium text-destructive">Vencida</span>
                        ) : hoursRemaining === 0 ? (
                          <span className="font-medium text-warning-foreground">
                            Expira en menos de una hora
                          </span>
                        ) : isExpiringSoon ? (
                          <span className="text-orange-600 font-medium">
                            Expira en {hoursRemaining}h
                          </span>
                        ) : (
                          <span>Expira en {Math.floor(hoursRemaining / 24)}d</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => copyInviteLink(invitation.inviteLink)}
                    aria-label={`Copiar invitación para ${invitation.email}`}
                  >
                    <Copy className="size-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="destructiveSecondary"
                        size="icon"
                        disabled={cancellingId === invitation.id}
                        aria-label={`Cancelar invitación para ${invitation.email}`}
                      >
                        {cancellingId === invitation.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <X className="size-4" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancelar invitación</AlertDialogTitle>
                        <AlertDialogDescription>
                          El enlace enviado a {invitation.email} dejará de funcionar.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Volver</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleCancel(invitation.id)}>
                          Cancelar invitación
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
