"use client";

import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
	createDemoLinkAction,
	revokeDemoLinkAction,
} from "./actions";

type DemoLinkRow = {
	id: string;
	slug: string;
	label: string | null;
	expires_at: string | null;
	last_seen_at: string | null;
	created_at: string;
	revoked_at: string | null;
	allowed_capabilities?: unknown;
};

type DemoLinksPanelProps = {
	tenantId: string;
	tenantName: string;
	initialLinks: DemoLinkRow[];
};

function formatDate(value: string | null) {
	if (!value) return "—";
	return new Date(value).toLocaleString();
}

function normalizeCapabilities(value: unknown) {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === "string");
}

export default function DemoLinksPanel({
	tenantId,
	tenantName,
	initialLinks,
}: DemoLinksPanelProps) {
	const [links, setLinks] = useState(initialLinks);
	const [label, setLabel] = useState("");
	const [slug, setSlug] = useState("");
	const [expiresInDays, setExpiresInDays] = useState("14");
	const [capabilities, setCapabilities] = useState("dashboard, excel");
	const [resultUrl, setResultUrl] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isCreating, startCreateTransition] = useTransition();
	const [isRevoking, startRevokeTransition] = useTransition();

	const activeLinks = useMemo(
		() => links.filter((link) => !link.revoked_at),
		[links],
	);

	const handleCreate = () => {
		setError(null);
		setResultUrl(null);

		startCreateTransition(async () => {
			const result = await createDemoLinkAction({
				tenantId,
				tenantName,
				label,
				slug,
				expiresInDays: expiresInDays.trim()
					? Number.parseInt(expiresInDays, 10)
					: null,
				capabilities: capabilities
					.split(",")
					.map((item) => item.trim())
					.filter(Boolean),
			});

			if (result.error) {
				setError(result.error);
				return;
			}

			setResultUrl(result.url ?? null);
			setLabel("");
			setSlug("");
			setLinks((current) => [
				{
					id: result.id ?? crypto.randomUUID(),
					slug: result.slug ?? "",
					label: result.label ?? (label.trim() || `Demo ${tenantName}`),
					expires_at: result.expiresAt ?? null,
					last_seen_at: null,
					created_at: new Date().toISOString(),
					revoked_at: null,
					allowed_capabilities:
						result.allowedCapabilities ??
						capabilities
							.split(",")
							.map((item) => item.trim())
							.filter(Boolean),
				},
				...current,
			]);
		});
	};

	const handleRevoke = (linkId: string) => {
		setError(null);
		startRevokeTransition(async () => {
			const result = await revokeDemoLinkAction({ tenantId, linkId });
			if (result.error) {
				setError(result.error);
				return;
			}
			setLinks((current) =>
				current.map((link) =>
					link.id === linkId
						? { ...link, revoked_at: new Date().toISOString() }
						: link,
				),
			);
		});
	};

	return (
		<div className="space-y-6">
			<div className="rounded-xl border bg-card">
				<div className="border-b px-4 py-3">
					<h2 className="font-semibold">Crear demo link</h2>
					<p className="text-sm text-muted-foreground">
						Genera un acceso sin login para {tenantName}. El token se muestra una sola vez.
					</p>
				</div>
				<div className="grid gap-4 px-4 py-4 md:grid-cols-2">
					<label className="space-y-1 text-sm">
						<span className="font-medium">Etiqueta</span>
						<input
							value={label}
							onChange={(event) => setLabel(event.target.value)}
							placeholder={`Demo ${tenantName}`}
							className="w-full rounded-md border px-3 py-2"
						/>
					</label>
					<label className="space-y-1 text-sm">
						<span className="font-medium">Slug opcional</span>
						<input
							value={slug}
							onChange={(event) => setSlug(event.target.value)}
							placeholder="acme-demo"
							className="w-full rounded-md border px-3 py-2"
						/>
					</label>
					<label className="space-y-1 text-sm">
						<span className="font-medium">Expira en dias</span>
						<input
							value={expiresInDays}
							onChange={(event) => setExpiresInDays(event.target.value)}
							placeholder="14"
							type="number"
							min={1}
							max={90}
							className="w-full rounded-md border px-3 py-2"
						/>
					</label>
					<label className="space-y-1 text-sm">
						<span className="font-medium">Capabilities</span>
						<input
							value={capabilities}
							onChange={(event) => setCapabilities(event.target.value)}
							placeholder="dashboard, excel"
							className="w-full rounded-md border px-3 py-2"
						/>
					</label>
				</div>
				<div className="flex items-center gap-3 px-4 pb-4">
					<Button onClick={handleCreate} disabled={isCreating}>
						{isCreating ? "Creando..." : "Crear demo link"}
					</Button>
					{error ? (
						<p className="text-sm text-destructive">{error}</p>
					) : null}
				</div>
				{resultUrl ? (
					<div className="border-t bg-muted/30 px-4 py-4">
						<p className="text-sm font-medium">URL generada</p>
						<p className="mt-2 break-all rounded-md border bg-background px-3 py-2 text-xs">
							{resultUrl}
						</p>
					</div>
				) : null}
			</div>

			<div className="rounded-xl border bg-card">
				<div className="border-b px-4 py-3">
					<h2 className="font-semibold">Links existentes</h2>
					<p className="text-sm text-muted-foreground">
						{activeLinks.length} activos sobre {links.length} creados.
					</p>
				</div>
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
							<tr>
								<th className="px-4 py-2">Etiqueta</th>
								<th className="px-4 py-2">Slug</th>
								<th className="px-4 py-2">Capabilities</th>
								<th className="px-4 py-2">Ultimo uso</th>
								<th className="px-4 py-2">Expira</th>
								<th className="px-4 py-2">Estado</th>
								<th className="px-4 py-2" />
							</tr>
						</thead>
						<tbody>
							{links.map((link) => {
								const linkCapabilities = normalizeCapabilities(
									link.allowed_capabilities,
								);
								const isRevoked = Boolean(link.revoked_at);
								return (
									<tr key={link.id} className="border-b last:border-none">
										<td className="px-4 py-3">
											{link.label ?? "Sin etiqueta"}
										</td>
										<td className="px-4 py-3 font-mono text-xs">
											{link.slug}
										</td>
										<td className="px-4 py-3 text-xs text-muted-foreground">
											{linkCapabilities.join(", ") || "—"}
										</td>
										<td className="px-4 py-3">{formatDate(link.last_seen_at)}</td>
										<td className="px-4 py-3">{formatDate(link.expires_at)}</td>
										<td className="px-4 py-3">
											<span
												className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
													isRevoked
														? "bg-slate-100 text-slate-600"
														: "bg-emerald-100 text-emerald-700"
												}`}
											>
												{isRevoked ? "Revocado" : "Activo"}
											</span>
										</td>
										<td className="px-4 py-3 text-right">
											{!isRevoked ? (
												<Button
													variant="outline"
													size="sm"
													onClick={() => handleRevoke(link.id)}
													disabled={isRevoking}
												>
													Revocar
												</Button>
											) : null}
										</td>
									</tr>
								);
							})}
							{links.length === 0 ? (
								<tr>
									<td
										colSpan={7}
										className="px-4 py-8 text-center text-sm text-muted-foreground"
									>
										Todavia no hay demo links para esta organizacion.
									</td>
								</tr>
							) : null}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
