import { redirect } from "next/navigation";

import { joinTenantAction, createTenantAction } from "@/app/tenants/actions";
import { createClient } from "@/utils/supabase/server";

type OnboardingPageProps = {
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function OnboardingPage({
	searchParams: searchParamsPromise,
}: OnboardingPageProps) {
	const searchParams = (await searchParamsPromise) ?? {};
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return redirect("/");

	const { data: memberships } = await supabase
		.from("memberships")
		.select("tenant_id")
		.eq("user_id", user.id)
		.order("created_at", { ascending: true });

	const firstTenantId = memberships?.[0]?.tenant_id ?? null;
	const previewMode = (() => {
		const raw = searchParams?.preview;
		const value = Array.isArray(raw) ? raw[0] : raw;
		return value === "1" || value === "true";
	})();
	if (firstTenantId && !previewMode) {
		return redirect(`/api/tenants/${firstTenantId}/switch`);
	}

	const { data: tenants } = await supabase
		.from("tenants")
		.select("id, name")
		.order("created_at");

	const errorMessageRaw = searchParams?.error;
	const errorMessage = Array.isArray(errorMessageRaw)
		? errorMessageRaw[0]
		: errorMessageRaw ?? null;
	const hasJoinableTenants = Boolean(tenants && tenants.length > 0);

	return (
		<div className="p-6 space-y-8">
			<div className="space-y-2">
				<h1 className="text-2xl font-semibold">Configura tu primer espacio de trabajo</h1>
				<p className="text-sm text-muted-foreground">
					Cada organización vive en su propio tenant. Elegí una existente o creá una nueva para continuar.
				</p>
				{previewMode && firstTenantId && (
					<p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
						Estás viendo el onboarding en modo vista previa aunque ya tenés una organización asignada.
					</p>
				)}
				{errorMessage && (
					<p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
						{errorMessage}
					</p>
				)}
			</div>

			<section className="space-y-3">
				<h2 className="text-lg font-medium">Unirme a una organización existente</h2>
				<form action={joinTenantAction.bind(null, "/onboarding")} className="flex flex-col gap-3 md:flex-row">
					<select
						name="tenant_id"
						className="rounded-md border bg-background px-3 py-2 text-sm"
						defaultValue=""
						required
						disabled={!hasJoinableTenants}
					>
						<option value="" disabled>
							{hasJoinableTenants ? "Seleccioná una organización" : "No hay organizaciones disponibles"}
						</option>
						{tenants?.map((t) => (
							<option key={t.id} value={t.id}>
								{t.name}
							</option>
						))}
					</select>
					<button
						className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 disabled:opacity-40"
						disabled={!hasJoinableTenants}
					>
						Unirme
					</button>
				</form>
			</section>
			<section className="space-y-3">
				<h2 className="text-lg font-medium">Crear una nueva organización</h2>
				<form action={createTenantAction.bind(null, "/onboarding")} className="flex flex-col gap-3 md:flex-row">
					<input
						name="name"
						placeholder="Ej: Operaciones Norte"
						className="w-full rounded-md border bg-background px-3 py-2 text-sm md:w-64"
						required
						minLength={3}
					/>
					<button className="rounded-md border px-4 py-2 text-sm hover:bg-foreground/10">Crear</button>
				</form>
			</section>
		</div>
	);
}


