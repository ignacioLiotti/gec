import { NextResponse } from "next/server";
import { emitEvent } from "@/lib/notifications/engine";
import "@/lib/notifications/rules";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const eventType = String(body?.type ?? "");
        const ctx = (body?.ctx ?? {}) as Record<string, unknown>;
        if (!eventType) return NextResponse.json({ error: "type required" }, { status: 400 });
        await emitEvent(eventType, ctx);
        return NextResponse.json({ ok: true });
    } catch (e) {
        return NextResponse.json({ error: "failed" }, { status: 500 });
    }
}



