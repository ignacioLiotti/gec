import { NextResponse } from "next/server";
import { emitEvent } from "@/lib/notifications/engine";
import "@/lib/notifications/rules";

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const { obraId, obraName, documentName, dueDate, notifyUserId } =
			body ?? {};
		if (!obraId || !documentName || !dueDate) {
			return NextResponse.json(
				{ error: "Missing required fields" },
				{ status: 400 }
			);
		}

        await emitEvent("document.reminder.requested", {
            obraId: String(obraId),
            obraName: obraName ? String(obraName) : null,
            documentName: String(documentName),
            dueDate: String(dueDate),
            notifyUserId: notifyUserId ? String(notifyUserId) : null,
        });

		return NextResponse.json({ ok: true });
	} catch (error) {
		return NextResponse.json(
			{ error: "Failed to schedule reminder" },
			{ status: 500 }
		);
	}
}
