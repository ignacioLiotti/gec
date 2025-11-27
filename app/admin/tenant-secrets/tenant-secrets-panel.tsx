"use client";

import { useMemo, useState } from "react";

type TenantSecretRow = {
	id: string;
	version: number;
	status: "pending" | "active" | "grace" | "revoked";
	valid_from: string | null;
	valid_to: string | null;
	created_at: string | null;
	rotated_at: string | null;
};

type TenantSecretsPanelProps = {
	tenantId: string;
	tenantName: string;
	initialSecrets: TenantSecretRow[];
	requestedTenantId?: string;
};

function formatDate(value?: string | null) {
	if (!value) return "—";
	try {
		return new Date(value).toLocaleString();
	} catch {
		return value;
	}
}

const statusStyles: Record<string, string> = {
	active: "bg-emerald-100 text-emerald-700 border-emerald-200",
	grace: "bg-amber-100 text-amber-800 border-amber-200",
	pending: "bg-slate-100 text-slate-600 border-slate-200",
	revoked: "bg-slate-200 text-slate-600 border-slate-300",
};

function StatusBadge({ status }: { status: string }) {
	const style = statusStyles[status] ?? statusStyles.pending;
	return (
		<span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${style}`}>
			{status}
		</span>
	);
}

export default function TenantSecretsPanel({
	tenantId,
	tenantName,
	initialSecrets,
	requestedTenantId,
}: TenantSecretsPanelProps) {
	const [secrets, setSecrets] = useState<TenantSecretRow[]>(initialSecrets);
	const [graceDays, setGraceDays] = useState("");
	const [rotateError, setRotateError] = useState<string | null>(null);
	const [rotateLoading, setRotateLoading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const [lastSecret, setLastSecret] = useState<{
		value: string | null;
		version: number | null;
		status: string | null;
	} | null>(null);
	const [copyLabel, setCopyLabel] = useState("Copiar");

	const endpoint = useMemo(() => {
		const params = new URLSearchParams();
		params.set("tenantId", requestedTenantId ?? tenantId);
		return `/api/tenant-secrets?${params.toString()}`;
	}, [tenantId, requestedTenantId]);

	async function refreshSecrets() {
		setRefreshing(true);
		try {
			const response = await fetch(endpoint, {
				method: "GET",
				headers: { Accept: "application/json" },
				cache: "no-store",
			});
			const payload = await response.json();
			if (!response.ok) {
				throw new Error(payload.error ?? "No se pudieron recargar los secretos.");
			}
			setSecrets(payload.secrets ?? []);
		} catch (error) {
			console.error("[tenant-secrets] refresh error", error);
			setRotateError(error instanceof Error ? error.message : String(error));
		} finally {
			setRefreshing(false);
		}
	}

	async function rotateSecret() {
		setRotateError(null);
		setRotateLoading(true);
		setCopyLabel("Copiar");
		try {
			let payload: Record<string, number> | undefined;
			const parsed = Number.parseInt(graceDays, 10);
			if (graceDays.trim().length > 0) {
				if (!Number.isFinite(parsed) || parsed <= 0) {
					throw new Error("Ingresá un número válido de días de gracia.");
				}
				payload = { graceDays: parsed };
			}

			const response = await fetch(endpoint, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(payload ?? {}),
			});
			const result = await response.json();
			if (!response.ok) {
				throw new Error(result.error ?? "No se pudo rotar el secreto.");
			}
			setGraceDays("");
			setLastSecret({
				value: result.secret ?? null,
				version: result.version ?? null,
				status: result.status ?? null,
			});
			await refreshSecrets();
		} catch (error) {
			setRotateError(error instanceof Error ? error.message : String(error));
		} finally {
			setRotateLoading(false);
		}
	}

	async function copySecret() {
		if (!lastSecret?.value) return;
		try {
			await navigator.clipboard.writeText(lastSecret.value);
			setCopyLabel("Copiado");
			setTimeout(() => setCopyLabel("Copiar"), 2000);
		} catch {
			setCopyLabel("Error");
			setTimeout(() => setCopyLabel("Copiar"), 2000);
		}
	}

	const activeSecret = secrets.find((secret) => secret.status === "active");

	return (
		<div className="space-y-6">
			<div className="rounded-lg border bg-card">
				<div className="border-b px-4 py-3">
					<p className="text-sm font-medium">
						Organización seleccionada: {tenantName} ({tenantId})
					</p>
					{requestedTenantId && requestedTenantId !== tenantId && (
						<p className="text-xs text-foreground/70">
							Mostrando datos de {tenantId}. No existe acceso a {requestedTenantId}.
						</p>
					)}
				</div>
				<div className="grid gap-4 px-4 py-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
					<div>
						<p className="text-xs text-foreground/60">Versión activa</p>
						<p className="text-lg font-semibold">
							{activeSecret ? `v${activeSecret.version}` : "Sin secreto"}
						</p>
					</div>
					<div>
						<p className="text-xs text-foreground/60">Estado actual</p>
						{activeSecret ? (
							<StatusBadge status={activeSecret.status} />
						) : (
							<span>—</span>
						)}
					</div>
					<div>
						<p className="text-xs text-foreground/60">Creado</p>
						<p>{formatDate(activeSecret?.created_at)}</p>
					</div>
					<div>
						<p className="text-xs text-foreground/60">Expira</p>
						<p>{formatDate(activeSecret?.valid_to)}</p>
					</div>
				</div>
			</div>

			<div className="rounded-lg border bg-card">
				<div className="border-b px-4 py-3">
					<h2 className="font-semibold">Rotar secreto</h2>
					<p className="text-sm text-foreground/70">
						Genera una nueva versión y opcionalmente mantiene la anterior en período de gracia.
					</p>
				</div>
				<div className="space-y-4 px-4 py-4">
					<div className="grid gap-4 sm:grid-cols-[200px_auto]">
						<label className="text-sm font-medium">
							Período de gracia (días)
							<input
								type="number"
								min={1}
								max={30}
								value={graceDays}
								onChange={(event) => setGraceDays(event.target.value)}
								className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
								placeholder="7"
							/>
						</label>
						<div className="flex flex-wrap gap-2">
							<button
								type="button"
								onClick={rotateSecret}
								disabled={rotateLoading}
								className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
							>
								{rotateLoading ? "Rotando..." : "Rotar secreto"}
							</button>
							<button
								type="button"
								onClick={refreshSecrets}
								disabled={refreshing}
								className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
							>
								{refreshing ? "Actualizando..." : "Actualizar historial"}
							</button>
						</div>
					</div>
					{rotateError && (
						<p className="text-sm text-destructive">{rotateError}</p>
					)}
					{lastSecret?.value && (
						<div className="rounded-md border border-dashed bg-muted/40 p-3 text-sm">
							<p className="font-semibold">
								Nuevo secreto v{lastSecret.version ?? "?"} ({lastSecret.status ?? "activo"})
							</p>
							<p className="break-all rounded-md bg-background/80 px-3 py-2 font-mono text-xs">
								{lastSecret.value}
							</p>
							<div className="mt-2 flex flex-wrap gap-2 text-xs">
								<button
									type="button"
									onClick={copySecret}
									className="rounded-md border px-3 py-1"
								>
									{copyLabel}
								</button>
								<span className="text-foreground/70">
									Copialo y distribuilo a los sistemas externos. Se muestra solo una vez.
								</span>
							</div>
						</div>
					)}
				</div>
			</div>

			<div className="rounded-lg border bg-card">
				<div className="border-b px-4 py-3">
					<h2 className="font-semibold">Historial de versiones</h2>
					<p className="text-sm text-foreground/70">
						Solo se muestra metadatos (no almacenamos los valores anteriores en texto plano).
					</p>
				</div>
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead className="bg-foreground/5 text-left text-xs uppercase text-foreground/70">
							<tr>
								<th className="px-4 py-2">Versión</th>
								<th className="px-4 py-2">Estado</th>
								<th className="px-4 py-2">Creado</th>
								<th className="px-4 py-2">Rotado</th>
								<th className="px-4 py-2">Válido desde</th>
								<th className="px-4 py-2">Válido hasta</th>
							</tr>
						</thead>
						<tbody>
							{secrets.map((secret) => (
								<tr key={secret.id} className="border-b last:border-none">
									<td className="px-4 py-2 font-mono">v{secret.version}</td>
									<td className="px-4 py-2">
										<StatusBadge status={secret.status} />
									</td>
									<td className="px-4 py-2">{formatDate(secret.created_at)}</td>
									<td className="px-4 py-2">{formatDate(secret.rotated_at)}</td>
									<td className="px-4 py-2">{formatDate(secret.valid_from)}</td>
									<td className="px-4 py-2">{formatDate(secret.valid_to)}</td>
								</tr>
							))}
							{secrets.length === 0 && (
								<tr>
									<td className="px-4 py-6 text-center text-foreground/60" colSpan={6}>
										No hay versiones de secreto para esta organización.
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>

			<div className="rounded-lg border bg-muted/30 px-4 py-4 text-sm">
				<h3 className="font-semibold">Cómo firmar solicitudes</h3>
				<ol className="list-decimal space-y-2 pl-5">
					<li>Incluí `X-Tenant-Id`, `X-Request-Timestamp`, `X-Request-Signature` y `X-Secret-Version` (opcional) en cada petición.</li>
					<li>Calculá el HMAC SHA-256 del string `timestamp.body` usando el secreto vigente y enviá el resultado como firma.</li>
					<li>La ventana máxima de reenvío es de 5 minutos (`REQUEST_SIGNATURE_MAX_AGE_MS`).</li>
					<li>Cuando rotes, actualizá tus clientes antes de que venza el período de gracia para evitar interrupciones.</li>
				</ol>
			</div>
		</div>
	);
}
