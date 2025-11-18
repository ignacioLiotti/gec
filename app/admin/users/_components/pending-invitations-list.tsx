"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listPendingInvitations, cancelInvitation } from "@/app/admin/users/invitation-actions";
import { Mail, Clock, X, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";

interface Invitation {
  id: string;
  email: string;
  invited_role: string;
  status: string;
  expires_at: string;
  created_at: string;
  inviter: {
    full_name: string;
  } | null;
}

interface PendingInvitationsListProps {
  tenantId: string;
}

export function PendingInvitationsList({ tenantId }: PendingInvitationsListProps) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadInvitations = async () => {
    setLoading(true);
    const result = await listPendingInvitations(tenantId);
    if (result.invitations) {
      setInvitations(result.invitations as unknown as Invitation[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadInvitations();
  }, [tenantId]);

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

  const copyInviteLink = (invitationId: string) => {
    // Note: We'd need to store the token in the invitation data or fetch it
    // For now, this is a placeholder
    toast.info("El token no está disponible en esta vista. Usá el diálogo de invitación para copiar el enlace.");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
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
              Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60))
            );
            const isExpiringSoon = hoursRemaining < 24;

            return (
              <div
                key={invitation.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2 bg-blue-100 rounded-full">
                    <Mail className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{invitation.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs capitalize">
                        {invitation.invited_role}
                      </Badge>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {isExpiringSoon ? (
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCancel(invitation.id)}
                  disabled={cancellingId === invitation.id}
                >
                  {cancellingId === invitation.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
