import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
	const { id } = await context.params;
	const obraId = id;

	if (!obraId) {
		return NextResponse.json({ error: "Obra no encontrada" }, { status: 400 });
	}

	try {
		const supabase = await createClient();

		const { data: notes, error } = await supabase
			.from("obra_memoria_notes")
			.select("id, obra_id, user_id, body, created_at")
			.eq("obra_id", obraId)
			.order("created_at", { ascending: false });

		if (error) throw error;

		const userIds = Array.from(
			new Set((notes ?? []).map((n) => n.user_id as string))
		);

		let profilesMap = new Map<string, string | null>();

		if (userIds.length > 0) {
			const { data: profiles, error: profilesError } = await supabase
				.from("profiles")
				.select("user_id, full_name")
				.in("user_id", userIds);

			if (!profilesError && profiles) {
				profilesMap = new Map(
					profiles.map((p: any) => [p.user_id as string, (p.full_name as string | null) ?? null])
				);
			}
		}

		const result = (notes ?? []).map((n: any) => ({
			id: n.id as string,
			obraId: n.obra_id as string,
			userId: n.user_id as string,
			text: n.body as string,
			createdAt: String(n.created_at),
			userName: profilesMap.get(n.user_id as string) ?? null,
		}));

		return NextResponse.json({ notes: result });
	} catch (err) {
		console.error("[memoria:list]", err);
		const anyErr = err as any;
		const message =
			(anyErr && anyErr.message) ||
			(err instanceof Error ? err.message : "Error desconocido");
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

export async function POST(req: Request, context: RouteContext) {
	const { id } = await context.params;
	const obraId = id;

	if (!obraId) {
		return NextResponse.json({ error: "Obra no encontrada" }, { status: 400 });
	}

	try {
		const body = await req.json().catch(() => ({}));
		const text = typeof body?.text === "string" ? body.text.trim() : "";

		if (!text) {
			return NextResponse.json(
				{ error: "Texto de la nota requerido" },
				{ status: 400 }
			);
		}

		const supabase = await createClient();

		// Resolve tenant and ensure obra exists & belongs to caller's tenant (via RLS on obras)
		const { data: obraRow, error: obraError } = await supabase
			.from("obras")
			.select("id")
			.eq("id", obraId)
			.is("deleted_at", null)
			.single();

		if (obraError) throw obraError;
		if (!obraRow) {
			return NextResponse.json(
				{ error: "Obra no encontrada" },
				{ status: 404 }
			);
		}

		const { data: me, error: meError } = await supabase.auth.getUser();
		if (meError) throw meError;

		const userId = me.user?.id;
		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { data: inserted, error } = await supabase
			.from("obra_memoria_notes")
			.insert({
				obra_id: obraId,
				user_id: userId,
				body: text,
			})
			.select("id, obra_id, user_id, body, created_at")
			.single();

		if (error) throw error;

		// Fetch profile for display name
		let userName: string | null = null;
		const { data: profile } = await supabase
			.from("profiles")
			.select("full_name")
			.eq("user_id", userId)
			.maybeSingle();

		if (profile && typeof (profile as any).full_name === "string") {
			userName = (profile as any).full_name as string;
		}

		const note = {
			id: inserted.id as string,
			obraId: inserted.obra_id as string,
			userId: inserted.user_id as string,
			text: inserted.body as string,
			createdAt: String(inserted.created_at),
			userName,
		};

		return NextResponse.json({ note });
	} catch (err) {
		console.error("[memoria:create]", err);
		const anyErr = err as any;
		const message =
			(anyErr && anyErr.message) ||
			(err instanceof Error ? err.message : "Error desconocido");
		return NextResponse.json({ error: message }, { status: 500 });
	}
}






