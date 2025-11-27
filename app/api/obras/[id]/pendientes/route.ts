import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { parseLocalDate } from "@/utils/date";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
	const { id } = await context.params;
	const obraId = id;
	if (!obraId)
		return NextResponse.json({ error: "Obra no encontrada" }, { status: 400 });

	try {
		const supabase = await createClient();
		const { data, error } = await supabase
			.from("obra_pendientes")
			.select("id, name, poliza, due_mode, due_date, offset_days, done")
			.eq("obra_id", obraId)
			.is("deleted_at", null)
			.order("created_at", { ascending: true });
		if (error) throw error;

		const pendientes = (data ?? []).map((row) => ({
			id: row.id as string,
			name: (row as any).name ?? "",
			poliza: (row as any).poliza ?? "",
			dueMode: ((row as any).due_mode ?? "fixed") as
				| "fixed"
				| "after_completion",
			dueDate: (row as any).due_date ? String((row as any).due_date) : "",
			offsetDays: Number((row as any).offset_days ?? 0),
			done: Boolean((row as any).done ?? false),
		}));

		return NextResponse.json({ pendientes });
	} catch (err) {
		console.error("[pendientes:list]", err);
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
	if (!obraId)
		return NextResponse.json({ error: "Obra no encontrada" }, { status: 400 });

	try {
		const body = await req.json();
        const { name, poliza, dueMode, dueDate, offsetDays, done } = body || {};
		if (!name)
			return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });

		const supabase = await createClient();

		const { data: obraRow, error: obraError } = await supabase
			.from("obras")
			.select("tenant_id")
			.eq("id", obraId)
			.is("deleted_at", null)
			.single();
		if (obraError) throw obraError;
		if (!obraRow)
			return NextResponse.json(
				{ error: "Obra no encontrada" },
				{ status: 404 }
			);

		const insertPayload: any = {
			tenant_id: (obraRow as any).tenant_id,
			obra_id: obraId,
			name: String(name),
			poliza: poliza ? String(poliza) : null,
			due_mode: dueMode === "after_completion" ? "after_completion" : "fixed",
      due_date: dueDate ? String(dueDate) : null,
			offset_days: Number.isFinite(Number(offsetDays))
				? Number(offsetDays)
				: null,
			done: Boolean(done ?? false),
		};

		// If a row for the same obra and name already exists, update instead of inserting
		const { data: existingByName } = await supabase
			.from("obra_pendientes")
			.select("id")
			.eq("obra_id", obraId)
			.is("deleted_at", null)
			.eq("name", insertPayload.name)
			.limit(1)
			.maybeSingle();

        if (existingByName?.id) {
			const { error: updErr } = await supabase
				.from("obra_pendientes")
				.update({
					poliza: insertPayload.poliza,
					due_mode: insertPayload.due_mode,
					due_date: insertPayload.due_date,
					offset_days: insertPayload.offset_days,
					done: insertPayload.done,
				})
				.eq("id", existingByName.id)
				.eq("obra_id", obraId);
			if (updErr) throw updErr;
            // Upsert schedules for fixed due date
            if (insertPayload.due_mode === "fixed" && typeof insertPayload.due_date === "string") {
                const due = parseLocalDate(insertPayload.due_date as string);
                if (!due) {
                    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
                }
                const stages: { stage: string; run_at: Date }[] = [];
                const mk = (days: number, label: string) => {
                    const d = new Date(due.getTime() - days * 24 * 60 * 60 * 1000);
                    if (label !== "due_today") d.setHours(9, 0, 0, 0);
                    return d;
                };
                stages.push({ stage: "due_7d", run_at: mk(7, "due_7d") });
                stages.push({ stage: "due_3d", run_at: mk(3, "due_3d") });
                stages.push({ stage: "due_1d", run_at: mk(1, "due_1d") });
                stages.push({ stage: "due_today", run_at: new Date(due) });

                const { data: me } = await supabase.auth.getUser();
                const userId = me.user?.id;
                if (userId) {
                    for (const s of stages) {
                        await supabase
                            .from("pendiente_schedules")
                            .upsert({ pendiente_id: existingByName.id, user_id: userId, tenant_id: (obraRow as any).tenant_id, stage: s.stage, run_at: s.run_at.toISOString() }, { onConflict: "pendiente_id,stage" });
                    }
                }
            }
            return NextResponse.json({ ok: true, pendiente: { id: existingByName.id } });
		}

		const { data, error } = await supabase
			.from("obra_pendientes")
			.insert(insertPayload)
			.select()
			.single();
        if (error) throw error;

        // Upsert schedules for fixed due date
        if (insertPayload.due_mode === "fixed" && typeof insertPayload.due_date === "string") {
            const due = parseLocalDate(insertPayload.due_date as string);
            if (!due) {
                return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
            }
            const stages: { stage: string; run_at: Date }[] = [];
            const mk = (days: number, label: string) => {
                const d = new Date(due.getTime() - days * 24 * 60 * 60 * 1000);
                if (label !== "due_today") d.setHours(9, 0, 0, 0);
                return d;
            };
            stages.push({ stage: "due_7d", run_at: mk(7, "due_7d") });
            stages.push({ stage: "due_3d", run_at: mk(3, "due_3d") });
            stages.push({ stage: "due_1d", run_at: mk(1, "due_1d") });
            stages.push({ stage: "due_today", run_at: new Date(due) });

            const newId = (data as any).id as string;
            const { data: me } = await supabase.auth.getUser();
            const userId = me.user?.id;
            if (userId) {
                for (const s of stages) {
                    await supabase
                        .from("pendiente_schedules")
                        .upsert({ pendiente_id: newId, user_id: userId, tenant_id: (obraRow as any).tenant_id, stage: s.stage, run_at: s.run_at.toISOString() }, { onConflict: "pendiente_id,stage" });
                }
            }
        }

        return NextResponse.json({ ok: true, pendiente: { id: (data as any).id } });
	} catch (err) {
		console.error("[pendientes:create]", err);
		const anyErr = err as any;
		const message =
			(anyErr && anyErr.message) ||
			(err instanceof Error ? err.message : "Error desconocido");
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

export async function PUT(req: Request, context: RouteContext) {
	const { id } = await context.params;
	const obraId = id;
	if (!obraId)
		return NextResponse.json({ error: "Obra no encontrada" }, { status: 400 });

	try {
		const body = await req.json();
        const {
            id: pendienteId,
            name,
            poliza,
            dueMode,
            dueDate,
            offsetDays,
            done,
        } = body || {};
		if (!pendienteId)
			return NextResponse.json({ error: "ID requerido" }, { status: 400 });

		const supabase = await createClient();

		// Ensure the pendiente belongs to this obra
		const { data: existing, error: fetchError } = await supabase
			.from("obra_pendientes")
			.select("id")
			.eq("id", pendienteId)
			.eq("obra_id", obraId)
			.is("deleted_at", null)
			.single();
		if (fetchError) throw fetchError;
		if (!existing)
			return NextResponse.json(
				{ error: "Pendiente no encontrado" },
				{ status: 404 }
			);

        const updatePayload: any = {
			name: typeof name === "string" ? name : undefined,
			poliza: typeof poliza === "string" ? poliza : undefined,
			due_mode:
				dueMode === "after_completion" || dueMode === "fixed"
					? dueMode
					: undefined,
            due_date: typeof dueDate === "string" ? dueDate || null : undefined,
			offset_days: typeof offsetDays === "number" ? offsetDays : undefined,
			done: typeof done === "boolean" ? done : undefined,
		};

		const { error } = await supabase
			.from("obra_pendientes")
			.update(updatePayload)
			.eq("id", pendienteId)
			.eq("obra_id", obraId)
			.is("deleted_at", null);
		if (error) throw error;

		// Upsert schedules for fixed due date; skip for after_completion (handled on obra completion)
		if (
			(updatePayload.due_mode === "fixed" ||
				(typeof updatePayload.due_mode === "undefined" &&
					typeof updatePayload.due_date === "string")) &&
			typeof updatePayload.due_date === "string"
		) {
			const due = parseLocalDate(updatePayload.due_date as string);
			if (!due) {
				return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
			}
			const stages: { stage: string; run_at: Date }[] = [];
			const mk = (days: number, label: string) => {
				const d = new Date(due.getTime() - days * 24 * 60 * 60 * 1000);
				if (label !== "due_today") d.setHours(9, 0, 0, 0);
				return d;
			};
			stages.push({ stage: "due_7d", run_at: mk(7, "due_7d") });
			stages.push({ stage: "due_3d", run_at: mk(3, "due_3d") });
			stages.push({ stage: "due_1d", run_at: mk(1, "due_1d") });
			const today = new Date(due);
			stages.push({ stage: "due_today", run_at: today });

			const { data: me } = await supabase.auth.getUser();
			const userId = me.user?.id;
			if (userId) {
				for (const s of stages) {
					await supabase.from("pendiente_schedules").upsert(
						{
							pendiente_id: pendienteId,
							user_id: userId,
							tenant_id: (obraRow as any).tenant_id,
							stage: s.stage,
							run_at: s.run_at.toISOString(),
						},
						{ onConflict: "pendiente_id,stage" }
					);
				}
			}
		}

		return NextResponse.json({ ok: true });
	} catch (err) {
		console.error("[pendientes:update]", err);
		const anyErr = err as any;
		const message =
			(anyErr && anyErr.message) ||
			(err instanceof Error ? err.message : "Error desconocido");
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

export async function DELETE(req: Request, context: RouteContext) {
	const { id } = await context.params;
	const obraId = id;
	if (!obraId)
		return NextResponse.json({ error: "Obra no encontrada" }, { status: 400 });

	try {
		const { searchParams } = new URL(req.url);
		const pendienteId = searchParams.get("id");
		if (!pendienteId)
			return NextResponse.json({ error: "ID requerido" }, { status: 400 });

		const supabase = await createClient();
		
		// Verify the pendiente exists and belongs to this obra
		const { data: existing, error: fetchError } = await supabase
			.from("obra_pendientes")
			.select("id")
			.eq("id", pendienteId)
			.eq("obra_id", obraId)
			.is("deleted_at", null)
			.single();
		if (fetchError) throw fetchError;
		if (!existing)
			return NextResponse.json(
				{ error: "Pendiente no encontrado" },
				{ status: 404 }
			);

		// Manually delete related records first to avoid stack overflow from cascade
		// Delete notifications linked to this pendiente
		const { error: notifError } = await supabase
			.from("notifications")
			.delete()
			.eq("pendiente_id", pendienteId);
		if (notifError) throw notifError;

		// Delete schedules linked to this pendiente
		const { error: schedError } = await supabase
			.from("pendiente_schedules")
			.delete()
			.eq("pendiente_id", pendienteId);
		if (schedError) throw schedError;

		// Now delete the pendiente itself
		const { error } = await supabase
			.from("obra_pendientes")
			.delete()
			.eq("id", pendienteId)
			.eq("obra_id", obraId);
		if (error) throw error;

		return NextResponse.json({ ok: true });
	} catch (err) {
		console.error("[pendientes:delete]", err);
		const anyErr = err as any;
		const message =
			(anyErr && anyErr.message) ||
			(err instanceof Error ? err.message : "Error desconocido");
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
