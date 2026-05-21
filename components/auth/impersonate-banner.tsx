"use client";

import { useState, useSyncExternalStore } from "react";
import { UserRoundX } from "lucide-react";

import { Button } from "@/components/ui/button";

function hasImpersonationCookie() {
	if (typeof document === "undefined") return false;
	return document.cookie
		.split(";")
		.some((cookie) => cookie.trim().startsWith("impersonating="));
}

function subscribeToImpersonationCookieChange() {
	return () => {};
}

export function ImpersonateBanner() {
	const active = useSyncExternalStore(
		subscribeToImpersonationCookieChange,
		hasImpersonationCookie,
		() => false,
	);
	const [isStopping, setIsStopping] = useState(false);

	async function stopImpersonation() {
		setIsStopping(true);
		await fetch("/api/impersonate/stop", { method: "POST" });
		window.location.reload();
	}

	if (!active) return null;

	return (
		<div className="sticky top-0 z-40 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950 shadow-sm">
			<div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-2">
					<UserRoundX className="size-4 shrink-0 text-amber-700" />
					<span className="truncate font-medium">
						Estas tomando posesion de un usuario.
					</span>
				</div>
				<Button
					type="button"
					size="sm"
					variant="outline"
					className="h-7 shrink-0 border-amber-300 bg-white px-2 text-xs text-amber-950 hover:bg-amber-100"
					onClick={() => void stopImpersonation()}
					disabled={isStopping}
				>
					{isStopping ? "Volviendo..." : "Dejar de poseer"}
				</Button>
			</div>
		</div>
	);
}
