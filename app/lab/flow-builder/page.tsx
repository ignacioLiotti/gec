import { createClient } from "@/utils/supabase/server";
import { redirect, notFound } from "next/navigation";
import { FlowBuilderClient } from "./flow-builder-client";
import pmcDefinition from "@/lib/engine/flows/presupuesto-medicion-certificado.flow.json";

function formatPeriod(date: Date): string {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	return `${year}-${month}`;
}

export default async function FlowBuilderPage() {
	if (process.env.NODE_ENV === "production") {
		notFound();
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/");
	}

	return (
		<div className="p-6 space-y-6">
			<h1 className="text-xl font-semibold">Lab: Flow Builder</h1>
			<FlowBuilderClient
				initialPeriod={formatPeriod(new Date())}
				pmcTemplate={JSON.stringify(pmcDefinition, null, 2)}
			/>
		</div>
	);
}
