export function flowResponseDenial(run: { status: string; expires_at: string }) {
	if (run.status === "completed") return "Esta respuesta ya fue enviada.";
	if (run.status === "cancelled") return "Esta solicitud fue cancelada.";
	if (run.status === "expired" || Date.parse(run.expires_at) <= Date.now()) {
		return "El plazo para responder esta solicitud venció.";
	}
	if (run.status !== "sent") return "Esta solicitud no admite respuestas.";
	return null;
}
