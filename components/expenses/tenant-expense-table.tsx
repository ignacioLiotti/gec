import { Badge } from "@/components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	formatCompactNumber,
	formatReadableBytes,
	type TenantExpenseSnapshot,
} from "@/lib/tenant-expenses";

type TenantExpenseTableProps = {
	rows: TenantExpenseSnapshot[];
	showOwnerColumn?: boolean;
	emptyMessage?: string;
};

export function TenantExpenseTable({
	rows,
	showOwnerColumn = false,
	emptyMessage = "Todavía no registramos consumos para estas organizaciones.",
}: TenantExpenseTableProps) {
	if (rows.length === 0) {
		return (
			<div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
				{emptyMessage}
			</div>
		);
	}

	return (
		<div className="rounded-2xl border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Organización</TableHead>
						{showOwnerColumn && <TableHead>Administrada por</TableHead>}
						<TableHead>Supabase Storage</TableHead>
						<TableHead>Tokens de IA</TableHead>
						<TableHead>WhatsApp API</TableHead>
						<TableHead className="text-right">Estado</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{rows.map((row) => {
						const storageUsage = formatUsage(row.supabaseStorageBytes, row.supabaseStorageLimitBytes, {
							type: "storage",
						});
						const aiUsage = formatUsage(row.aiTokensUsed, row.aiTokenBudget, {
							label: "tokens",
						});
						const whatsappUsage = formatUsage(row.whatsappMessages, row.whatsappBudget, {
							label: "mensajes",
						});
						const status = getRowStatus([storageUsage, aiUsage, whatsappUsage]);
						return (
							<TableRow key={row.id}>
								<TableCell className="align-top">
									<div className="font-semibold">{row.tenantName}</div>
									<p className="text-xs text-muted-foreground">
										{formatBillingPeriod(row.billingPeriodStart, row.billingPeriodEnd)}
									</p>
									{row.notes && (
										<p className="mt-1 text-xs text-muted-foreground line-clamp-2">
											{row.notes}
										</p>
									)}
								</TableCell>
								{showOwnerColumn && (
									<TableCell className="align-top text-sm">
										<div className="font-medium">{row.ownerName ?? "—"}</div>
										{row.ownerId && (
											<p className="text-xs text-muted-foreground">
												{row.ownerId.slice(0, 8)}…{row.ownerId.slice(-4)}
											</p>
										)}
									</TableCell>
								)}
								<TableCell className="align-top">
									<UsageBlock usage={storageUsage} />
								</TableCell>
								<TableCell className="align-top">
									<UsageBlock usage={aiUsage} />
								</TableCell>
								<TableCell className="align-top">
									<UsageBlock usage={whatsappUsage} />
								</TableCell>
								<TableCell className="align-top text-right">
									{status ? (
										<Badge variant={status.variant}>{status.label}</Badge>
									) : (
										<span className="text-sm text-muted-foreground">Sin datos</span>
									)}
									{row.updatedAt && (
										<p className="mt-1 text-xs text-muted-foreground">
											Actualizado {formatRelativeDate(row.updatedAt)}
										</p>
									)}
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</div>
	);
}

type UsageMeta = {
	type?: "storage";
	label?: string;
};

type UsageDescriptor = {
	label: string;
	valueLabel: string;
	limitLabel: string;
	limitDefined: boolean;
	percent: number | null;
	severity: number;
};

type StatusDescriptor = { label: string; variant: "secondary" | "outline" | "default" | "destructive" };

function UsageBlock({ usage }: { usage: UsageDescriptor }) {
	return (
		<div className="space-y-1.5 text-sm">
			<div className="flex items-center justify-between text-xs">
				<span className="font-medium text-muted-foreground">{usage.label}</span>
				{usage.limitDefined && usage.percent !== null && (
					<span className="text-muted-foreground">{Math.min(usage.percent, 100).toFixed(0)}%</span>
				)}
			</div>
			<div className="flex items-baseline gap-1">
				<span className="font-semibold">{usage.valueLabel}</span>
				<span className="text-xs text-muted-foreground">
					{usage.limitDefined ? `de ${usage.limitLabel}` : usage.limitLabel}
				</span>
			</div>
			{usage.limitDefined ? (
				<div className="h-1.5 w-full rounded-full bg-muted">
					<div
						className={`h-1.5 rounded-full ${
							usage.severity >= 3
								? "bg-red-500"
								: usage.severity === 2
									? "bg-amber-500"
									: usage.severity === 1
										? "bg-amber-300"
										: "bg-emerald-500"
						}`}
						style={{ width: `${Math.min(usage.percent ?? 0, 100)}%` }}
					/>
				</div>
			) : (
				<p className="text-xs text-muted-foreground">Sin límite configurado</p>
			)}
		</div>
	);
}

function formatUsage(value: number, limit: number, meta: UsageMeta): UsageDescriptor {
	const percent = limit > 0 ? (value / limit) * 100 : null;
	const severity = determineSeverity(percent);
	if (meta.type === "storage") {
		return {
			label: "Supabase",
			valueLabel: formatReadableBytes(value),
			limitLabel: limit > 0 ? formatReadableBytes(limit) : "Sin límite",
			limitDefined: limit > 0,
			percent,
			severity,
		};
	}
	const unit = meta.label ?? "unidades";
	return {
		label: meta.label ? meta.label.charAt(0).toUpperCase() + meta.label.slice(1) : "Uso",
		valueLabel: `${formatCompactNumber(value)} ${unit}`,
		limitLabel: limit > 0 ? `${formatCompactNumber(limit)} ${unit}` : "Sin cupo",
		limitDefined: limit > 0,
		percent,
		severity,
	};
}

function determineSeverity(percent: number | null): number {
	if (percent === null) return 0;
	if (percent >= 110) return 4;
	if (percent >= 95) return 3;
	if (percent >= 80) return 2;
	if (percent >= 60) return 1;
	return 0;
}

function getRowStatus(usages: UsageDescriptor[]): (StatusDescriptor & { severity: number }) | null {
	const statuses = usages
		.filter((usage) => usage.limitDefined)
		.map((usage) => ({
			severity: usage.severity,
			label:
				usage.severity >= 3
					? "Crítico"
					: usage.severity === 2
						? "Atención"
						: usage.severity === 1
							? "Seguimiento"
							: "Estable",
			variant:
				usage.severity >= 3
					? "destructive"
					: usage.severity === 2
						? "default"
						: "secondary",
		}));
	if (statuses.length === 0) {
		return null;
	}
	return statuses.reduce((worst, current) => (current.severity >= worst.severity ? current : worst));
}

function formatBillingPeriod(start: string, end: string): string {
	const formatter = new Intl.DateTimeFormat("es-AR", {
		month: "short",
		day: "numeric",
	});
	const startLabel = formatter.format(new Date(start));
	const endLabel = formatter.format(new Date(end));
	return start === end ? startLabel : `${startLabel} → ${endLabel}`;
}

function formatRelativeDate(value: string): string {
	const date = new Date(value);
	return new Intl.DateTimeFormat("es-AR", {
		day: "numeric",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
	}).format(date);
}
