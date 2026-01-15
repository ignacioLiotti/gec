"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { createTenantAction } from "@/app/tenants/actions";
import { getMyPendingInvitations, acceptInvitation } from "@/app/admin/users/invitation-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, UserPlus, Loader2, CheckCircle2, Clock, Mail, Plus } from "lucide-react";
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

type Mode = "join" | "create";

export default function OnboardingPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [mode, setMode] = useState<Mode>("join");
	const [user, setUser] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
	const [acceptingId, setAcceptingId] = useState<string | null>(null);
	const [creatingTenant, setCreatingTenant] = useState(false);
	const [tenantName, setTenantName] = useState("");

	const errorMessage = searchParams?.get("error");
	const previewMode = searchParams?.get("preview") === "1" || searchParams?.get("preview") === "true";

	useEffect(() => {
		async function init() {
			const supabase = createSupabaseBrowserClient();

			// Get current user
			const { data: { user: currentUser } } = await supabase.auth.getUser();

			if (!currentUser) {
				router.push("/");
				return;
			}

			setUser(currentUser);

			// Check if user already has memberships (unless preview mode)
			const { data: memberships } = await supabase
				.from("memberships")
				.select("tenant_id")
				.eq("user_id", currentUser.id)
				.order("created_at", { ascending: true });

			if (memberships && memberships.length > 0 && !previewMode) {
				// Redirect to first tenant
				router.push(`/api/tenants/${memberships[0].tenant_id}/switch`);
				return;
			}

			// Load pending invitations
			const result = await getMyPendingInvitations();
			if (result.invitations) {
				setInvitations(result.invitations as unknown as PendingInvitation[]);
				// If there are invitations, default to join mode
				if (result.invitations.length > 0) {
					setMode("join");
				} else {
					// No invitations, default to create mode
					setMode("create");
				}
			} else {
				setMode("create");
			}

			setLoading(false);
		}

		init();
	}, [router, previewMode]);

	const handleAcceptInvitation = async (invitation: PendingInvitation) => {
		setAcceptingId(invitation.id);
		const result = await acceptInvitation(invitation.token);

		if (result.error) {
			toast.error(result.error);
			setAcceptingId(null);
		} else if (result.success) {
			toast.success(`Joined ${result.tenantName}!`);
			// Redirect to the tenant
			router.push("/");
			router.refresh();
		}
	};

	const handleCreateTenant = async (e: React.FormEvent) => {
		e.preventDefault();
		if (tenantName.trim().length < 3) {
			toast.error("Organization name must be at least 3 characters");
			return;
		}

		setCreatingTenant(true);

		try {
			const formData = new FormData();
			formData.append("name", tenantName.trim());

			await createTenantAction("/onboarding", formData);

			// createTenantAction will redirect, but if it doesn't, show success
			toast.success("Organization created!");
		} catch (error: any) {
			toast.error(error?.message || "Failed to create organization");
			setCreatingTenant(false);
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
				<Card className="w-full max-w-2xl">
					<CardContent className="flex items-center justify-center py-12">
						<Loader2 className="h-8 w-8 animate-spin text-gray-400" />
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
			<Card className="w-full max-w-2xl shadow-lg">
				<CardHeader className="text-center">
					<div className="flex justify-center mb-4">
						<div className="p-4 bg-blue-100 rounded-full">
							<Building2 className="h-10 w-10 text-blue-600" />
						</div>
					</div>
					<CardTitle className="text-2xl">Welcome to Síntesis</CardTitle>
					<CardDescription className="text-base">
						Set up your workspace to get started
					</CardDescription>
				</CardHeader>

				<CardContent className="space-y-6">
					{/* Preview Mode Banner */}
					{previewMode && (
						<div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
							<p className="text-sm text-amber-800">
								Preview mode: You already have an organization but are viewing onboarding.
							</p>
						</div>
					)}

					{/* Error Message */}
					{errorMessage && (
						<div className="bg-red-50 border border-red-200 rounded-lg p-3">
							<p className="text-sm text-red-700">{errorMessage}</p>
						</div>
					)}

					{/* Toggle Tabs */}
					<div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
						<button
							onClick={() => setMode("join")}
							className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all ${
								mode === "join"
									? "bg-white text-gray-900 shadow-sm"
									: "text-gray-600 hover:text-gray-900"
							}`}
						>
							<div className="flex items-center justify-center gap-2">
								<UserPlus className="h-4 w-4" />
								Join Organization
								{invitations.length > 0 && (
									<span className="ml-1 px-1.5 py-0.5 text-xs font-bold bg-blue-600 text-white rounded-full">
										{invitations.length}
									</span>
								)}
							</div>
						</button>
						<button
							onClick={() => setMode("create")}
							className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all ${
								mode === "create"
									? "bg-white text-gray-900 shadow-sm"
									: "text-gray-600 hover:text-gray-900"
							}`}
						>
							<div className="flex items-center justify-center gap-2">
								<Plus className="h-4 w-4" />
								Create Organization
							</div>
						</button>
					</div>

					{/* Content Area */}
					{mode === "join" ? (
						<div className="space-y-4">
							<div>
								<h3 className="text-lg font-semibold mb-2">Pending Invitations</h3>
								<p className="text-sm text-gray-600 mb-4">
									Accept an invitation to join an existing organization
								</p>
							</div>

							{invitations.length === 0 ? (
								<div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
									<Mail className="h-12 w-12 text-gray-400 mx-auto mb-3" />
									<p className="text-gray-600 font-medium mb-1">No pending invitations</p>
									<p className="text-sm text-gray-500">
										Ask an organization admin to invite you, or create your own organization.
									</p>
								</div>
							) : (
								<div className="space-y-3">
									{invitations.map((invitation) => {
										const expiresAt = new Date(invitation.expires_at);
										const timeRemaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60)));

										return (
											<Card key={invitation.id} className="border-2 hover:border-blue-200 transition-colors">
												<CardContent className="p-4">
													<div className="flex items-start justify-between gap-4">
														<div className="flex-1 space-y-2">
															<div className="flex items-center gap-2">
																<Building2 className="h-5 w-5 text-blue-600" />
																<h4 className="font-semibold text-gray-900">
																	{invitation.tenant?.name || "Organization"}
																</h4>
															</div>
															<div className="space-y-1 text-sm">
																<div className="flex items-center gap-2 text-gray-600">
																	<UserPlus className="h-4 w-4" />
																	<span>
																		{invitation.inviter?.full_name
																			? `Invited by ${invitation.inviter.full_name}`
																			: "Organization invitation"}
																	</span>
																</div>
																<div className="flex items-center gap-2 text-gray-600">
																	<CheckCircle2 className="h-4 w-4" />
																	<span className="capitalize">
																		Role: {invitation.invited_role}
																	</span>
																</div>
																<div className="flex items-center gap-2 text-gray-600">
																	<Clock className="h-4 w-4" />
																	<span>
																		Expires in{" "}
																		{timeRemaining < 24
																			? `${timeRemaining} hours`
																			: `${Math.floor(timeRemaining / 24)} days`}
																	</span>
																</div>
															</div>
														</div>
														<div className="flex flex-col gap-2">
															<Button
																onClick={() => handleAcceptInvitation(invitation)}
																disabled={acceptingId === invitation.id}
																className="bg-blue-600 hover:bg-blue-700"
															>
																{acceptingId === invitation.id ? (
																	<>
																		<Loader2 className="mr-2 h-4 w-4 animate-spin" />
																		Joining...
																	</>
																) : (
																	<>
																		<CheckCircle2 className="mr-2 h-4 w-4" />
																		Accept
																	</>
																)}
															</Button>
															<Button
																variant="outline"
																size="sm"
																onClick={() => router.push(`/invitations/${invitation.token}`)}
															>
																View Details
															</Button>
														</div>
													</div>
												</CardContent>
											</Card>
										);
									})}
								</div>
							)}
						</div>
					) : (
						<div className="space-y-4">
							<div>
								<h3 className="text-lg font-semibold mb-2">Create New Organization</h3>
								<p className="text-sm text-gray-600 mb-4">
									Start your own workspace and invite team members later
								</p>
							</div>

							<form onSubmit={handleCreateTenant} className="space-y-4">
								<div className="space-y-2">
									<label htmlFor="tenantName" className="text-sm font-medium text-gray-700">
										Organization Name
									</label>
									<input
										id="tenantName"
										type="text"
										value={tenantName}
										onChange={(e) => setTenantName(e.target.value)}
										placeholder="e.g., Acme Inc, Engineering Team"
										className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
										required
										minLength={3}
										disabled={creatingTenant}
									/>
									<p className="text-xs text-gray-500">
										Minimum 3 characters
									</p>
								</div>

								<Button
									type="submit"
									disabled={creatingTenant || tenantName.trim().length < 3}
									className="w-full bg-blue-600 hover:bg-blue-700"
								>
									{creatingTenant ? (
										<>
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											Creating Organization...
										</>
									) : (
										<>
											<Plus className="mr-2 h-4 w-4" />
											Create Organization
										</>
									)}
								</Button>
							</form>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
