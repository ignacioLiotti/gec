"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

type DemoEntryClientProps = {
	slug: string;
	token: string | null;
	hasActiveSession: boolean;
	continuePath: string;
};

export function DemoEntryClient({
	slug,
	token,
	hasActiveSession,
	continuePath,
}: DemoEntryClientProps) {
	useEffect(() => {
		if (!token) return;
		window.location.replace(
			`/api/demo/${encodeURIComponent(slug)}/start?token=${encodeURIComponent(token)}`,
		);
	}, [slug, token]);

	if (token) {
		return (
			<div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
				Preparando la sesion demo...
			</div>
		);
	}

	if (hasActiveSession) {
		return (
			<Button asChild className="bg-stone-900 text-white hover:bg-stone-800">
				<Link href={continuePath}>Continuar demo</Link>
			</Button>
		);
	}

	return (
		<div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-600">
			Este link necesita un token valido para iniciar la demo.
		</div>
	);
}
