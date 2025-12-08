"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { acceptInvitation, declineInvitation } from "@/app/admin/users/invitation-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, UserPlus, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface InvitationDetails {
  id: string;
  tenant_id: string;
  tenant_name: string;
  email: string;
  invited_role: string;
  status: string;
  expires_at: string;
  inviter_name: string;
}

export default function InvitationPage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

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
          setError("This invitation is invalid or has expired.");
          setLoading(false);
          return;
        }

        const inviteData = data[0];
        setInvitation(inviteData);

        // Check if user email matches
        if (currentUser?.email && currentUser.email.toLowerCase() !== inviteData.email.toLowerCase()) {
          setError(
            `This invitation was sent to ${inviteData.email}. Please log in with that email to accept.`
          );
        }

        setLoading(false);
      } catch (err) {
        console.error("Error loading invitation:", err);
        setError("Failed to load invitation details.");
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
      router.push(`/?returnTo=/invitations/${token}`);
      return;
    }

    setProcessing(true);
    setError(null);

    const result = await acceptInvitation(token);

    if (result.error) {
      if (result.alreadyMember) {
        // Redirect to app if already a member
        router.push("/");
      } else {
        setError(result.error);
        setProcessing(false);
      }
    } else if (result.success) {
      // Success - redirect to app
      router.push("/");
    } else {
      setError("An unexpected error occurred.");
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!user) {
      router.push("/");
      return;
    }

    setProcessing(true);
    setError(null);

    const result = await declineInvitation(token);

    if (result.error) {
      setError(result.error);
      setProcessing(false);
    } else if (result.success) {
      router.push("/");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <Card className="w-full max-w-md border-red-200">
          <CardHeader>
            <div className="flex items-center gap-2">
              <XCircle className="h-6 w-6 text-red-500" />
              <CardTitle className="text-red-700">Invalid Invitation</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => router.push("/")} className="w-full">
              Go to Home
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
  const isExpired = expiresAt < new Date();
  const timeRemaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60)));

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-blue-100 rounded-full">
              <Building2 className="h-10 w-10 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">You&apos;re Invited!</CardTitle>
          <CardDescription className="text-base">
            Join <strong>{invitation.tenant_name}</strong> organization
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Invitation Details */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <UserPlus className="h-5 w-5 text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">Invited by</p>
                <p className="text-sm text-gray-600">{invitation.inviter_name || "Organization admin"}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">Role</p>
                <p className="text-sm text-gray-600 capitalize">{invitation.invited_role}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">Expires</p>
                <p className="text-sm text-gray-600">
                  {isExpired ? (
                    <span className="text-red-600">Expired</span>
                  ) : timeRemaining < 24 ? (
                    <span className="text-orange-600">In {timeRemaining} hours</span>
                  ) : (
                    <span>In {Math.floor(timeRemaining / 24)} days</span>
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
                Please log in with <strong>{invitation.email}</strong> to accept this invitation.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleDecline}
              variant="outline"
              className="flex-1"
              disabled={processing || isExpired}
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Decline"
              )}
            </Button>
            <Button
              onClick={handleAccept}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              disabled={processing || isExpired || (user && error !== null)}
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : !user ? (
                "Log In to Accept"
              ) : (
                "Accept Invitation"
              )}
            </Button>
          </div>

          {isExpired && (
            <p className="text-center text-sm text-gray-500">
              This invitation has expired. Please contact the organization admin for a new invitation.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
