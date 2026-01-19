import { formatCompactNumber, formatReadableBytes } from "@/lib/tenant-expenses";
import { estimateUsdForTokens } from "@/lib/ai-pricing";

type UsageEvent = {
	id: string;
	tenant_id: string;
	kind: "storage_bytes" | "ai_tokens" | "whatsapp_messages";
	amount: number;
	context: string | null;
	metadata: Record<string, unknown> | null;
	created_at: string;
};

type UsageEventLogProps = {
	events: UsageEvent[];
	tenantNameById?: Map<string, string>;
	emptyMessage?: string;
};

function formatAmount(event: UsageEvent) {
	switch (event.kind) {
		case "storage_bytes":
			return formatReadableBytes(event.amount);
		case "ai_tokens": {
			const metadata = event.metadata ?? {};
			const model =
				typeof metadata?.model === "string" ? metadata.model : null;
			const costFromMetadata =
				typeof metadata?.costUsd === "number"
					? metadata.costUsd
					: Number.parseFloat(
							typeof metadata?.costUsd === "string"
								? metadata.costUsd
								: ""
					  );
			const estimatedCost =
				Number.isFinite(costFromMetadata) && !Number.isNaN(costFromMetadata)
					? costFromMetadata
					: estimateUsdForTokens(model, event.amount) ?? null;
			if (estimatedCost !== null) {
				const sign = estimatedCost < 0 ? "-" : "";
				return `${sign}$${Math.abs(estimatedCost).toFixed(4)} (${formatCompactNumber(
					event.amount
				)} tokens${model ? ` · ${model}` : ""})`;
			}
			return `${formatCompactNumber(event.amount)} tokens`;
		}
		case "whatsapp_messages":
		default:
			return formatCompactNumber(event.amount);
	}
}

function kindLabel(kind: UsageEvent["kind"]) {
	switch (kind) {
		case "storage_bytes":
			return "Storage";
		case "ai_tokens":
			return "Tokens IA";
		case "whatsapp_messages":
			return "WhatsApp";
		default:
			return kind;
	}
}

export function UsageEventLog({
	events,
	tenantNameById,
	emptyMessage = "No hay movimientos recientes.",
}: UsageEventLogProps) {
	if (events.length === 0) {
		return (
			<div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
				{emptyMessage}
			</div>
		);
	}

	return (
		<div className="rounded-2xl border">
			<table className="w-full text-sm">
				<thead className="bg-muted/50">
					<tr>
						<th className="px-3 py-2 text-left font-medium">Fecha</th>
						{tenantNameById && <th className="px-3 py-2 text-left font-medium">Organización</th>}
						<th className="px-3 py-2 text-left font-medium">Concepto</th>
						<th className="px-3 py-2 text-left font-medium">Cantidad</th>
						<th className="px-3 py-2 text-left font-medium">Contexto</th>
						<th className="px-3 py-2 text-left font-medium">Detalles</th>
					</tr>
				</thead>
				<tbody>
					{events.map((event) => {
						const details = event.metadata
							? JSON.stringify(event.metadata, null, 2)
									.replace(/[{}"]/g, "")
									.replace(/,\s*/g, ", ")
							: null;
						return (
							<tr key={event.id} className="border-b last:border-b-0">
								<td className="px-3 py-2 align-top text-xs text-muted-foreground">
									{new Date(event.created_at).toLocaleString("es-AR", {
										day: "2-digit",
										month: "2-digit",
										year: "numeric",
										hour: "2-digit",
										minute: "2-digit",
									})}
								</td>
								{tenantNameById && (
									<td className="px-3 py-2 align-top">
										{tenantNameById.get(event.tenant_id) ?? "—"}
									</td>
								)}
								<td className="px-3 py-2 align-top">{kindLabel(event.kind)}</td>
						<td className="px-3 py-2 align-top font-semibold">
							{formatAmount(event)}
						</td>
								<td className="px-3 py-2 align-top text-xs text-muted-foreground">
									{event.context ?? "—"}
								</td>
								<td className="px-3 py-2 align-top text-xs text-muted-foreground">
									{details ? <span className="line-clamp-2">{details}</span> : "—"}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
