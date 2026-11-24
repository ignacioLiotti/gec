"use client";

import { useEffect, useRef, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

export default function SupabaseAuthListener({ activeTenantId }: { activeTenantId: string | null }) {
	const router = useRouter();
	const { refresh } = router;
	const queryClient = useQueryClient();
	const refreshTimeout = useRef<NodeJS.Timeout | null>(null);
	const currentUserId = useRef<string | null>(null);
	const clearPreviewAccess = useCallback(() => {
		void queryClient.resetQueries({
			predicate: (query) => query.queryKey[2] === "documents-new" && query.queryKey[3] === "preview-access",
		});
		void import("@/lib/document-thumbnail-cache").then(({ clearDocumentThumbnails }) => clearDocumentThumbnails());
	}, [queryClient]);

	useEffect(() => {
		try {
			const key = "sintesis-preview-tenant";
			const previousTenantId = sessionStorage.getItem(key);
			if (activeTenantId) sessionStorage.setItem(key, activeTenantId);
			else sessionStorage.removeItem(key);
			if (previousTenantId && previousTenantId !== activeTenantId) clearPreviewAccess();
		} catch {
			// Access keys still include the authenticated tenant when session storage is unavailable.
		}
	}, [activeTenantId, clearPreviewAccess]);

	// Debounced refresh to handle cookie propagation timing
	const debouncedRefresh = useCallback(
		(delay: number = 100) => {
			if (refreshTimeout.current) {
				clearTimeout(refreshTimeout.current);
			}

			refreshTimeout.current = setTimeout(() => {
				refresh();
			}, delay);
		},
		[refresh],
	);

	useEffect(() => {
		const supabase = createSupabaseBrowserClient();
		let isMounted = true;
		let unsubscribe: (() => void) | undefined;

		void supabase.auth.getSession().then(({ data }) => {
			if (!isMounted) {
				return;
			}

			currentUserId.current = data.session?.user.id ?? null;

			const { data: subscription } = supabase.auth.onAuthStateChange(
				(event, session) => {
					const nextUserId = session?.user.id ?? null;

					if (event === "INITIAL_SESSION") {
						currentUserId.current = nextUserId;
						return;
					}

					if (event === "SIGNED_OUT") {
						currentUserId.current = null;
						clearPreviewAccess();
						refresh();
						return;
					}

					if (event === "SIGNED_IN") {
						const previousUserId = currentUserId.current;
						const isExistingSession =
							!!currentUserId.current && currentUserId.current === nextUserId;

						currentUserId.current = nextUserId;
						if (previousUserId && previousUserId !== nextUserId) {
							clearPreviewAccess();
						}

						if (!isExistingSession) {
							debouncedRefresh(500);
						}
						return;
					}

					if (event === "TOKEN_REFRESHED") {
						currentUserId.current = nextUserId;
						refresh();
					}
				},
			);

			unsubscribe = () => subscription.subscription?.unsubscribe();
		});

		return () => {
			isMounted = false;
			unsubscribe?.();
			if (refreshTimeout.current) {
				clearTimeout(refreshTimeout.current);
			}
		};
	}, [clearPreviewAccess, debouncedRefresh, refresh]);

	return null;
}

