import { createClient } from "@/utils/supabase/server";
import { redirect, notFound } from "next/navigation";
import { PmcClient } from "./pmc-client";

function formatPeriod(date: Date): string {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	return `${year}-${month}`;
}

export default async function PmcLabPage() {
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
			<PmcClient initialPeriod={formatPeriod(new Date())} />
		</div>
	);
}
