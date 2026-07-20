"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import { isPreTenantRoute } from "@/lib/pre-tenant-routes";

/**
 * AuthGate - Automatic authentication and tenant checking component
 *
 * This component runs on every page load and ensures:
 * 1. Users without a session see a forced (non-dismissible) login modal
 * 2. Users with a session but no tenant are redirected to /onboarding
 *
 * This is a logic-only component that returns null (no UI)
 */
export default function AuthGate({
	allowAnonymous = false,
}: {
	allowAnonymous?: boolean;
}) {
	const { push } = useRouter();
	const pathname = usePathname();

	useEffect(() => {
		if (allowAnonymous) {
			return;
		}

		// Public/auth routes should not force-open auth modal.
		if (isPreTenantRoute(pathname)) {
			return;
		}

		async function checkAuthAndTenant() {
			try {
				const supabase = createSupabaseBrowserClient();
				const {
					data: { session },
				} = await supabase.auth.getSession();

				// No session - trigger forced auth modal
				if (!session) {
					window.dispatchEvent(
						new CustomEvent("open-auth", {
							detail: { forced: true },
						}),
					);
					return;
				}

				// Has session - check for tenant membership
				const { data: memberships, error } = await supabase
					.from("memberships")
					.select("tenant_id")
					.eq("user_id", session.user.id)
					.limit(1);

				if (error) {
					console.error("[AUTH-GATE] Error checking memberships:", error);
					return;
				}

				if (!memberships || memberships.length === 0) {
					push("/onboarding");
				}

			} catch (error) {
				console.error("[AUTH-GATE] Unexpected error:", error);
			}
		}

		checkAuthAndTenant();
	}, [allowAnonymous, pathname, push]);

	// This is a logic-only component - no UI
	return null;
}
