import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

async function runDispatch() {
  const admin = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  // 1) Load due, unprocessed schedules
  const { data: schedules, error: schedErr } = await admin
    .from("pendiente_schedules")
    .select("id,pendiente_id,user_id,tenant_id,stage,run_at")
    .lte("run_at", nowIso)
    .is("processed_at", null)
    .is("deleted_at", null)
    .order("run_at", { ascending: true })
    .limit(1000);
  if (schedErr) throw schedErr;
  const items = schedules ?? [];
  if (items.length === 0) return { processed: 0 };

  // 2) Fetch pendientes for context
  const pendienteIds = Array.from(new Set(items.map((s: any) => s.pendiente_id)));
  const { data: pendientes, error: pendErr } = await admin
    .from("obra_pendientes")
    .select("id,name,obra_id,due_date")
    .in("id", pendienteIds)
    .is("deleted_at", null);
  if (pendErr) throw pendErr;
  const pendById = new Map<string, any>((pendientes ?? []).map((p: any) => [p.id, p]));

  // 3) Build notifications
  const notifications = items.map((s: any) => {
    const p = pendById.get(s.pendiente_id);
    const obraId = p?.obra_id ?? null;
    const title = `Recordatorio: ${p?.name ?? "Documento"} pendiente`;
    const body = p?.due_date ? `Vence el ${p.due_date}.` : null;
    return {
      user_id: s.user_id,
      tenant_id: s.tenant_id,
      title,
      body,
      type: "reminder" as const,
      action_url: obraId ? `/excel/${obraId}` : null,
      pendiente_id: s.pendiente_id,
      data: {
        stage: s.stage,
        obraId,
        documentName: p?.name ?? null,
        dueDate: p?.due_date ?? null,
      },
    };
  });

  // 4) Insert notifications (admin bypasses RLS)
  const { error: insErr } = await admin.from("notifications").insert(notifications);
  if (insErr) throw insErr;

  // 5) Mark schedules processed
  const ids = items.map((s: any) => s.id);
  const { error: updErr } = await admin
    .from("pendiente_schedules")
    .update({ processed_at: new Date().toISOString() })
    .in("id", ids)
    .is("deleted_at", null);
  if (updErr) throw updErr;

  return { processed: items.length };
}

function checkAuth(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production"; // allow in dev if no secret set
  const header = request.headers.get("x-cron-secret");
  return header === secret;
}

export async function GET(request: Request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const res = await runDispatch();
    return NextResponse.json({ ok: true, ...res });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const res = await runDispatch();
    return NextResponse.json({ ok: true, ...res });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}









