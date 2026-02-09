import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { ShareReportClient } from "@/components/report/share-report-client";

type ShareRow = {
	report_key: string;
	payload: Record<string, unknown> | null;
	expires_at: string | null;
};

type PageProps = {
	params: { token: string };
};

export default async function ShareReportPage({ params }: PageProps) {
	const token = params.token;
	const admin = createSupabaseAdminClient();
	const { data, error } = await admin
		.from("report_share_links")
		.select("report_key,payload,expires_at")
		.eq("token", token)
		.maybeSingle();

	if (error || !data) {
		return (
			<div className="flex h-[60vh] items-center justify-center text-muted-foreground">
				No se encontro el reporte compartido.
			</div>
		);
	}

	if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
		return (
			<div className="flex h-[60vh] items-center justify-center text-muted-foreground">
				El enlace compartido ha expirado.
			</div>
		);
	}

	return <ShareReportClient share={data as ShareRow} />;
}
