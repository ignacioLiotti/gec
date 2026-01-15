"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { useRouter, usePathname } from "next/navigation";

/**
 * AuthGate - Automatic authentication and tenant checking component
 *
 * This component runs on every page load and ensures:
 * 1. Users without a session see a forced (non-dismissible) login modal
 * 2. Users with a session but no tenant are redirected to /onboarding
 *
 * This is a logic-only component that returns null (no UI)
 */
export default function AuthGate() {
	const router = useRouter();
	const pathname = usePathname();
	const [isChecking, setIsChecking] = useState(true);

	useEffect(() => {
		// Skip checks for auth-related routes to prevent redirect loops
		if (pathname === "/onboarding" || pathname.startsWith("/auth/")) {
			setIsChecking(false);
			return;
		}

		async function checkAuthAndTenant() {
			try {
				const supabase = createSupabaseBrowserClient();
				const { data: { session } } = await supabase.auth.getSession();

				// No session - trigger forced auth modal
				if (!session) {
					console.log("[AUTH-GATE] No session detected, opening forced auth modal");
					window.dispatchEvent(
						new CustomEvent("open-auth", {
							detail: { forced: true }
						})
					);
					setIsChecking(false);
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
					setIsChecking(false);
					return;
				}

				if (!memberships || memberships.length === 0) {
					console.log("[AUTH-GATE] Session exists but no tenant, redirecting to onboarding");
					router.push("/onboarding");
				}

				setIsChecking(false);
			} catch (error) {
				console.error("[AUTH-GATE] Unexpected error:", error);
				setIsChecking(false);
			}
		}

		checkAuthAndTenant();
	}, [pathname, router]);

	// This is a logic-only component - no UI
	return null;
}
