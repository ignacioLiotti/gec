"use client";

import { useEffect, useState } from "react";

import { createSupabaseBrowserClient } from "@/utils/supabase/client";

const ACTIVE_TENANT_COOKIE = "active_tenant_id";

type MembershipRow = {
	tenant_id: string | null;
	role: string | null;
};

type TenantAdminStatus = {
	isAdmin: boolean;
	isSuperAdmin: boolean;
	isLoading: boolean;
	tenantId: string | null;
};

function readCookieValue(name: string) {
	if (typeof document === "undefined") return null;
	const cookiePrefix = `${name}=`;
	for (const part of document.cookie.split(";")) {
		const trimmed = part.trim();
		if (!trimmed.startsWith(cookiePrefix)) continue;
		return decodeURIComponent(trimmed.slice(cookiePrefix.length));
	}
	return null;
}

export function useTenantAdminStatus(): TenantAdminStatus {
	const [status, setStatus] = useState<TenantAdminStatus>({
		isAdmin: false,
		isSuperAdmin: false,
		isLoading: true,
		tenantId: null,
	});

	useEffect(() => {
		let cancelled = false;

		const checkAdminStatus = async () => {
			try {
				const supabase = createSupabaseBrowserClient();
				const {
					data: { user },
				} = await supabase.auth.getUser();

				if (!user) {
					if (!cancelled) {
						setStatus({
							isAdmin: false,
							isSuperAdmin: false,
							isLoading: false,
							tenantId: null,
						});
					}
					return;
				}

				const [{ data: profile }, { data: memberships }] = await Promise.all([
					supabase
						.from("profiles")
						.select("is_superadmin")
						.eq("user_id", user.id)
						.maybeSingle(),
					supabase
						.from("memberships")
						.select("tenant_id, role")
						.eq("user_id", user.id)
						.order("created_at", { ascending: true }),
				]);

				const isSuperAdmin = profile?.is_superadmin ?? false;
				const membershipRows = (memberships ?? []) as MembershipRow[];
				const preferredTenantId = readCookieValue(ACTIVE_TENANT_COOKIE);
				const activeMembership =
					(preferredTenantId
						? membershipRows.find(
								(membership) => membership.tenant_id === preferredTenantId,
						  )
						: null) ??
					membershipRows[0] ??
					null;
				const membershipRole = activeMembership?.role ?? null;
				const isMembershipAdmin =
					membershipRole === "owner" || membershipRole === "admin";

				if (!cancelled) {
					setStatus({
						isAdmin: isSuperAdmin || isMembershipAdmin,
						isSuperAdmin,
						isLoading: false,
						tenantId: activeMembership?.tenant_id ?? preferredTenantId,
					});
				}
			} catch (error) {
				console.error("[use-tenant-admin-status] failed to resolve admin status", error);
				if (!cancelled) {
					setStatus((previous) => ({
						...previous,
						isLoading: false,
					}));
				}
			}
		};

		void checkAdminStatus();

		return () => {
			cancelled = true;
		};
	}, []);

	return status;
}
