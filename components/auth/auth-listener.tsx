"use client";

import { useEffect, useRef, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function SupabaseAuthListener() {
	const router = useRouter();
	const { refresh } = router;
	const refreshTimeout = useRef<NodeJS.Timeout | null>(null);
	const currentUserId = useRef<string | null>(null);

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
						refresh();
						return;
					}

					if (event === "SIGNED_IN") {
						const isExistingSession =
							!!currentUserId.current && currentUserId.current === nextUserId;

						currentUserId.current = nextUserId;

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
	}, [debouncedRefresh, refresh]);

	return null;
}

