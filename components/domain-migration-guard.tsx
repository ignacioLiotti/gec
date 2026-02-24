"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

const domainSplitEnabled = process.env.NEXT_PUBLIC_ENABLE_DOMAIN_SPLIT === "true";
const appHost = process.env.NEXT_PUBLIC_APP_HOST?.toLowerCase();
const marketingHost = process.env.NEXT_PUBLIC_MARKETING_HOST?.toLowerCase();

function normalizeHost(host: string | undefined) {
	return (host ?? "").trim().toLowerCase();
}

export default function DomainMigrationGuard() {
	useEffect(() => {
		if (!domainSplitEnabled || !appHost || !marketingHost) {
			return;
		}

		const currentHost = normalizeHost(window.location.host);
		if (currentHost !== marketingHost) {
			return;
		}

		let redirectTimer: ReturnType<typeof setTimeout> | null = null;
		let cancelled = false;

		const moveToAppHost = () => {
			const targetUrl = new URL(window.location.href);
			targetUrl.host = appHost;
			targetUrl.pathname = "/dashboard";
			targetUrl.search = "";
			targetUrl.hash = "";
			if (!appHost.includes("localhost")) {
				targetUrl.protocol = "https:";
			}
			window.location.replace(targetUrl.toString());
		};

		const run = async () => {
			const supabase = createSupabaseBrowserClient();
			const {
				data: { session },
			} = await supabase.auth.getSession();

			if (cancelled || !session) {
				return;
			}

			toast.warning("Session moved to app.sintesis.dev in 15s", {
				duration: 15000,
				action: {
					label: "Move now",
					onClick: moveToAppHost,
				},
			});

			redirectTimer = setTimeout(moveToAppHost, 15000);
		};

		void run();

		return () => {
			cancelled = true;
			if (redirectTimer) {
				clearTimeout(redirectTimer);
			}
		};
	}, []);

	return null;
}
