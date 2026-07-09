import { redirect } from "next/navigation";
import { Building2, Check, FolderTree, ShieldCheck, Sparkles } from "lucide-react";

import { createTenantAction } from "@/app/tenants/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { STANDARD_TENANT_BLUEPRINT_KEY } from "@/lib/tenant-blueprints/constants";
import { createClient } from "@/utils/supabase/server";

type NewTenantPageProps = {
	searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

const includedSetup = [
	{ icon: FolderTree, label: "8 carpetas y 2 modelos de extracción" },
	{ icon: ShieldCheck, label: "3 roles simples para tu equipo" },
	{ icon: Sparkles, label: "Tableros, cálculos y vistas consolidadas" },
];

export default async function NewTenantPage({ searchParams }: NewTenantPageProps) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) redirect("/");

	const resolvedSearchParams = await searchParams;
	const rawError = resolvedSearchParams?.error;
	const errorMessage = Array.isArray(rawError) ? rawError[0] : rawError ?? null;

	return (
		<main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
			<div className="grid overflow-hidden rounded-xl border border-stroke-soft bg-card shadow-card lg:grid-cols-[0.9fr_1.1fr]">
				<section className="border-b border-stroke-soft bg-surface-recessed p-6 lg:border-b-0 lg:border-r lg:p-8">
					<div className="grid size-12 place-items-center rounded-lg border border-orange-primary/25 bg-orange-primary/10 text-orange-primary shadow-sm">
						<Building2 className="size-6" />
					</div>
					<p className="mt-6 text-sm font-semibold uppercase tracking-[0.14em] text-orange-primary">
						Nuevo espacio de trabajo
					</p>
					<h1 className="mt-2 text-3xl font-semibold tracking-tight text-content">
						Creá tu organización
					</h1>
					<p className="mt-3 text-sm leading-6 text-content-secondary">
						Vas a ser el propietario. La configuración recomendada deja la parte técnica resuelta y después te guía para cargar la primera obra.
					</p>

					<div className="mt-7 space-y-3">
						{includedSetup.map((item) => {
							const Icon = item.icon;
							return (
								<div key={item.label} className="flex items-center gap-3 rounded-lg border border-stroke-soft bg-card px-3 py-3 shadow-sm">
									<div className="grid size-8 shrink-0 place-items-center rounded-md bg-success/10 text-success">
										<Icon className="size-4" />
									</div>
									<span className="text-sm font-medium text-content">{item.label}</span>
								</div>
							);
						})}
					</div>
				</section>

				<section className="p-6 lg:p-8">
					<div className="flex items-center gap-2 text-sm font-medium text-success">
						<Check className="size-4" />
						Modelo recomendado seleccionado
					</div>
					<h2 className="mt-2 text-xl font-semibold text-content">Construcción estándar</h2>
					<p className="mt-1 text-sm leading-6 text-content-secondary">
						Una base similar a la configuración operativa de GEC, sin copiar datos, archivos ni identificadores del cliente.
					</p>

					{errorMessage ? (
						<div role="alert" className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
							{errorMessage}
						</div>
					) : null}

					<form action={createTenantAction.bind(null, "/tenants/new")} className="mt-7 space-y-5">
						<input type="hidden" name="blueprint" value={STANDARD_TENANT_BLUEPRINT_KEY} />
						<div className="space-y-2">
							<Label htmlFor="tenant-name">Nombre de la empresa u organización</Label>
							<Input
								id="tenant-name"
								name="name"
								placeholder="Ej.: Constructora del Litoral"
								autoComplete="organization"
								required
								minLength={3}
								maxLength={120}
								className="h-11"
							/>
							<p className="text-xs text-content-muted">Este nombre aparecerá en el selector de organizaciones.</p>
						</div>
						<Button type="submit" size="lg" className="w-full">
							Crear y preparar mi espacio
						</Button>
						<p className="text-center text-xs leading-5 text-content-muted">
							Al continuar no se crean obras de ejemplo ni se copia información de otros clientes.
						</p>
					</form>
				</section>
			</div>
		</main>
	);
}
