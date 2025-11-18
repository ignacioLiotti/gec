"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getMyPendingInvitations, acceptInvitation } from "@/app/admin/users/invitation-actions";
import { Mail, X, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PendingInvitation {
  id: string;
  token: string;
  tenant_id: string;
  invited_role: string;
  expires_at: string;
  created_at: string;
  tenant: {
    name: string;
  } | null;
  inviter: {
    full_name: string;
  } | null;
}

export function PendingInvitationsBanner() {
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const router = useRouter();

  useEffect(() => {
    async function loadInvitations() {
      const result = await getMyPendingInvitations();
      if (result.invitations) {
        setInvitations(result.invitations as unknown as PendingInvitation[]);
      }
      setLoading(false);
    }
    loadInvitations();
  }, []);

  const handleAccept = async (invitation: PendingInvitation) => {
    setAcceptingId(invitation.id);
    const result = await acceptInvitation(invitation.token);

    if (result.error) {
      toast.error(result.error);
      setAcceptingId(null);
    } else if (result.success) {
      toast.success(`Joined ${result.tenantName}!`);
      setInvitations((prev) => prev.filter((inv) => inv.id !== invitation.id));
      setAcceptingId(null);
      // Refresh the page to update tenant membership
      router.refresh();
    }
  };

  const handleDismiss = (invitationId: string) => {
    setDismissedIds((prev) => new Set([...prev, invitationId]));
  };

  const visibleInvitations = invitations.filter((inv) => !dismissedIds.has(inv.id));

  if (loading || visibleInvitations.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {visibleInvitations.map((invitation) => (
        <div
          key={invitation.id}
          className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg shadow-sm"
        >
          <div className="p-2 bg-blue-100 rounded-full">
            <Mail className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-blue-900">
              You&apos;re invited to join{" "}
              <strong>{invitation.tenant?.name || "an organization"}</strong>
            </p>
            <p className="text-xs text-blue-700">
              {invitation.inviter?.full_name ? `By ${invitation.inviter.full_name}` : "Organization invitation"}{" "}
              • Role: <span className="capitalize">{invitation.invited_role}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-blue-700 hover:text-blue-900 hover:bg-blue-100"
              onClick={() => router.push(`/invitations/${invitation.token}`)}
            >
              View Details
            </Button>
            <Button
              size="sm"
              className="h-8 bg-blue-600 hover:bg-blue-700"
              onClick={() => handleAccept(invitation)}
              disabled={acceptingId === invitation.id}
            >
              {acceptingId === invitation.id ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Accept
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-100"
              onClick={() => handleDismiss(invitation.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
