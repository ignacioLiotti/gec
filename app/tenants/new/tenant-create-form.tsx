"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

import { createTenantAction } from "@/app/tenants/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { STANDARD_TENANT_BLUEPRINT_KEY } from "@/lib/tenant-blueprints/constants";

function CreateButton() {
	const { pending } = useFormStatus();

	return (
		<Button type="submit" size="lg" className="w-full" disabled={pending}>
			{pending && <Loader2 className="size-4 animate-spin" />}
			{pending ? "Preparando tu espacio…" : "Crear y preparar mi espacio"}
		</Button>
	);
}

export function TenantCreateForm({
	errorMessage,
	defaultName,
}: {
	errorMessage: string | null;
	defaultName: string;
}) {
	return (
		<form action={createTenantAction.bind(null, "/tenants/new")} className="mt-7 space-y-5">
			<input type="hidden" name="blueprint" value={STANDARD_TENANT_BLUEPRINT_KEY} />
			{errorMessage ? (
				<div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
					{errorMessage}
				</div>
			) : null}
			<div className="space-y-2">
				<Label htmlFor="tenant-name">Nombre de la empresa u organización</Label>
				<Input
					id="tenant-name"
					name="name"
					defaultValue={defaultName}
					placeholder="Ej.: Constructora del Litoral"
					autoComplete="organization"
					required
					minLength={3}
					maxLength={120}
					className="h-11"
					autoFocus
				/>
				<p className="text-xs text-content-muted">Este nombre aparecerá en el selector de organizaciones.</p>
			</div>
			<CreateButton />
			<Button asChild type="button" variant="outline" className="w-full">
				<Link href="/onboarding">Volver</Link>
			</Button>
			<p className="text-center text-xs leading-5 text-content-muted">
				No se crean obras de ejemplo ni se copia información de otros clientes.
			</p>
		</form>
	);
}
