import { NextResponse } from "next/server";
import { getAuthContext } from "../../route";

type Certificate = {
	id: string;
	obra_id: string;
	n_exp: string;
	n_certificado: number;
	monto: number;
	mes: string;
	estado: string;
	created_at: string;
	updated_at: string;
};

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;
	const { supabase, user, tenantId } = await getAuthContext();

	const { data: certificates, error } = await supabase
		.from("certificates")
		.select("*")
		.eq("obra_id", id)
		.order("n_certificado", { ascending: true });

	if (error) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}

	const total = certificates.reduce((sum, cert) => sum + Number(cert.monto), 0);

	return NextResponse.json({
		certificates: certificates as Certificate[],
		total,
	});
}

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;
	const { supabase } = await getAuthContext();
	const body = await request.json();

	const { data: certificate, error } = await supabase
		.from("certificates")
		.insert({
			obra_id: id,
			n_exp: body.n_exp,
			n_certificado: body.n_certificado,
			monto: body.monto,
			mes: body.mes,
			estado: body.estado || "CERTIFICADO",
		})
		.select()
		.single();

	if (error) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}

	return NextResponse.json({ certificate });
}
