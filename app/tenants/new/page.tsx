import { redirect } from "next/navigation";

import { createTenantAction } from "@/app/tenants/actions";
import { createClient } from "@/utils/supabase/server";

type NewTenantPageProps = {
	searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function NewTenantPage({ searchParams }: NewTenantPageProps) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return redirect("/");
	}

	const resolvedSearchParams = await searchParams;
	const rawError = resolvedSearchParams?.error;
	const errorMessage = Array.isArray(rawError) ? rawError[0] : rawError ?? null;

	return (
		<div className="p-6 space-y-6">
			<div className="space-y-2">
				<h1 className="text-2xl font-semibold">Crear una nueva organización</h1>
				<p className="text-sm text-muted-foreground">
					Lanzá otro espacio de trabajo independiente. Vas a ser el propietario inicial y luego podés invitar al equipo.
				</p>
				{errorMessage && (
					<p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
						{errorMessage}
					</p>
				)}
			</div>

				<form action={createTenantAction.bind(null, "/tenants/new")} className="flex flex-col gap-3 md:flex-row">
					<input
						name="name"
						placeholder="Nombre de la organización"
					className="w-full rounded-md border bg-background px-3 py-2 text-sm md:w-80"
					required
					minLength={3}
				/>
					<button className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90">
						Crear organización
					</button>
			</form>
		</div>
	);
}
