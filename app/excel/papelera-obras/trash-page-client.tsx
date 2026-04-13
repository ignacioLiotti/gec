"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { invalidateObrasTableSessionCache } from "@/components/form-table/configs/obras-detalle";
import { useTenantAdminStatus } from "@/hooks/use-tenant-admin-status";

type TrashView = "active" | "history";
type ObraDeleteStatus = "deleted" | "restored" | "expired" | "purged";

type DeletedObraEntry = {
	id: string;
	obraId: string;
	obraN: number | null;
	obraName: string | null;
	deleteReason: string | null;
	deletedAt: string | null;
	deletedByUserId: string | null;
	deletedByLabel: string | null;
	restoreDeadlineAt: string | null;
	recoverable: boolean;
	status: ObraDeleteStatus;
	restoredAt?: string | null;
	restoredByUserId?: string | null;
	restoredByLabel?: string | null;
	purgedAt?: string | null;
	purgedByUserId?: string | null;
	purgedByLabel?: string | null;
	purgeJobId?: string | null;
	purgeReason?: string | null;
	createdAt?: string | null;
	updatedAt?: string | null;
};

type DeletesApiResponse = {
	items?: DeletedObraEntry[];
	error?: string;
};

function formatDateTimeLabel(value: string | null | undefined) {
	if (!value) return "-";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "-";
	return date.toLocaleString();
}

function formatRecoveryTimeLeft(value: string | null | undefined) {
	if (!value) return "Sin fecha";
	const deadline = new Date(value).getTime();
	if (!Number.isFinite(deadline)) return "Sin fecha";
	const diffMs = deadline - Date.now();
	if (diffMs <= 0) return "Expirada";
	const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
	if (diffHours < 24) return `${diffHours}h restantes`;
	const diffDays = Math.ceil(diffHours / 24);
	return `${diffDays}d restantes`;
}

function statusLabel(status: ObraDeleteStatus) {
	switch (status) {
		case "deleted":
			return "Eliminada";
		case "restored":
			return "Recuperada";
		case "expired":
			return "Vencida";
		case "purged":
			return "Purgada";
		default:
			return status;
	}
}

function statusVariant(status: ObraDeleteStatus) {
	switch (status) {
		case "deleted":
			return "secondary";
		case "restored":
			return "default";
		case "expired":
			return "outline";
		case "purged":
			return "destructive";
		default:
			return "outline";
	}
}

export function ObrasTrashPageClient() {
	const router = useRouter();
	const { isAdmin: isTenantAdmin, isLoading: isTenantAdminLoading } = useTenantAdminStatus();
	const [tab, setTab] = useState<TrashView>("active");
	const [activeItems, setActiveItems] = useState<DeletedObraEntry[]>([]);
	const [historyItems, setHistoryItems] = useState<DeletedObraEntry[]>([]);
	const [loading, setLoading] = useState(false);
	const [restoringId, setRestoringId] = useState<string | null>(null);

	const loadItems = useCallback(async (view: TrashView) => {
		if (!isTenantAdmin) {
			throw new Error("Solo administradores pueden ver la papelera de obras.");
		}
		const response = await fetch(`/api/obras/deletes?view=${view}&limit=250`, {
			cache: "no-store",
		});
		const payload = (await response.json().catch(() => ({}))) as DeletesApiResponse;
		if (!response.ok) {
			throw new Error(payload.error || "No se pudo cargar la papelera de obras");
		}
		return Array.isArray(payload.items) ? payload.items : [];
	}, [isTenantAdmin]);

	const refreshCurrentView = useCallback(async () => {
		setLoading(true);
		try {
			if (tab === "active") {
				setActiveItems(await loadItems("active"));
			} else {
				setHistoryItems(await loadItems("history"));
			}
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Error al cargar papelera de obras",
			);
		} finally {
			setLoading(false);
		}
	}, [loadItems, tab]);

	const refreshBothViews = useCallback(async () => {
		setLoading(true);
		try {
			const [active, history] = await Promise.all([
				loadItems("active"),
				loadItems("history"),
			]);
			setActiveItems(active);
			setHistoryItems(history);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Error al cargar papelera de obras",
			);
		} finally {
			setLoading(false);
		}
	}, [loadItems]);

	useEffect(() => {
		if (!isTenantAdmin) return;
		void refreshBothViews();
	}, [isTenantAdmin, refreshBothViews]);

	const handleRestore = useCallback(
		async (deleteId: string) => {
			setRestoringId(deleteId);
			try {
				const response = await fetch("/api/obras/deletes/restore", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ deleteId }),
				});
				const payload = (await response.json().catch(() => ({}))) as {
					error?: string;
				};
				if (!response.ok) {
					throw new Error(payload.error || "No se pudo restaurar la obra");
				}

				invalidateObrasTableSessionCache({ refreshTable: true });
				toast.success("Obra restaurada");
				await refreshBothViews();
			} catch (error) {
				toast.error(
					error instanceof Error
						? error.message
						: "No se pudo restaurar la obra",
				);
			} finally {
				setRestoringId(null);
			}
		},
		[refreshBothViews],
	);

	const currentCount = useMemo(
		() => (tab === "active" ? activeItems.length : historyItems.length),
		[activeItems.length, historyItems.length, tab],
	);

	if (isTenantAdminLoading) {
		return (
			<div className="p-6">
				<Card className="p-6 text-sm text-stone-600 flex items-center gap-2">
					<Loader2 className="h-4 w-4 animate-spin" />
					Verificando permisos...
				</Card>
			</div>
		);
	}

	if (!isTenantAdmin) {
		return (
			<div className="p-6">
				<Card className="p-6 space-y-3">
					<h1 className="text-lg font-semibold text-stone-900">Acceso restringido</h1>
					<p className="text-sm text-stone-600">
						Solo administradores pueden ver la papelera de obras.
					</p>
					<Button type="button" variant="outline" onClick={() => router.push("/excel")}>
						<ArrowLeft className="mr-2 h-4 w-4" />
						Volver a Excel
					</Button>
				</Card>
			</div>
		);
	}

	return (
		<div className="p-6 space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="space-y-1">
					<Button
						type="button"
						variant="ghost"
						className="h-8 px-2 text-xs"
						onClick={() => router.push("/excel")}
					>
						<ArrowLeft className="mr-1 h-3.5 w-3.5" />
						Volver a Excel
					</Button>
					<h1 className="text-2xl font-semibold text-stone-900">Papelera de obras</h1>
					<p className="text-sm text-stone-500">
						Recuperación disponible por 30 días. Historial auditable de deletes, restores y purgas.
					</p>
				</div>
				<Button
					type="button"
					variant="outline"
					onClick={() => void refreshCurrentView()}
					disabled={loading}
				>
					{loading ? (
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
					) : (
						<RefreshCw className="mr-2 h-4 w-4" />
					)}
					Actualizar
				</Button>
			</div>

			<Tabs value={tab} onValueChange={(value) => setTab(value as TrashView)}>
				<TabsList>
					<TabsTrigger value="active">Papelera ({activeItems.length})</TabsTrigger>
					<TabsTrigger value="history">Historial ({historyItems.length})</TabsTrigger>
				</TabsList>

				<TabsContent value="active" className="mt-4">
					<Card className="p-0 overflow-hidden">
						{loading ? (
							<div className="p-8 text-sm text-stone-500 text-center">Cargando...</div>
						) : activeItems.length === 0 ? (
							<div className="p-8 text-sm text-stone-500 text-center">
								No hay obras en papelera.
							</div>
						) : (
							<div className="divide-y divide-stone-200">
								{activeItems.map((item) => (
									<div key={item.id} className="p-4 flex items-start justify-between gap-4">
										<div className="min-w-0 space-y-1">
											<div className="flex items-center gap-2">
												<p className="truncate text-sm font-medium text-stone-900">
													{item.obraName ?? "Obra sin nombre"}
												</p>
												{item.obraN != null ? (
													<Badge variant="outline">#{item.obraN}</Badge>
												) : null}
												<Badge variant={statusVariant(item.status)}>
													{statusLabel(item.status)}
												</Badge>
											</div>
											<div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500">
												<span>Eliminada por: {item.deletedByLabel ?? item.deletedByUserId ?? "Sistema"}</span>
												<span>Eliminada: {formatDateTimeLabel(item.deletedAt)}</span>
												<span>Recuperable hasta: {formatDateTimeLabel(item.restoreDeadlineAt)}</span>
												<span>{formatRecoveryTimeLeft(item.restoreDeadlineAt)}</span>
												{item.deleteReason ? <span>Motivo: {item.deleteReason}</span> : null}
											</div>
										</div>
										<Button
											type="button"
											size="sm"
											variant="secondary"
											disabled={!item.recoverable || restoringId === item.id}
											onClick={() => void handleRestore(item.id)}
										>
											{restoringId === item.id ? (
												<>
													<Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
													Restaurando...
												</>
											) : item.recoverable ? (
												<>
													<RotateCcw className="mr-2 h-3.5 w-3.5" />
													Restaurar
												</>
											) : (
												"Expirada"
											)}
										</Button>
									</div>
								))}
							</div>
						)}
					</Card>
				</TabsContent>

				<TabsContent value="history" className="mt-4">
					<Card className="p-0 overflow-hidden">
						{loading ? (
							<div className="p-8 text-sm text-stone-500 text-center">Cargando...</div>
						) : historyItems.length === 0 ? (
							<div className="p-8 text-sm text-stone-500 text-center">
								No hay eventos históricos para mostrar.
							</div>
						) : (
							<div className="divide-y divide-stone-200">
								{historyItems.map((item) => (
									<div key={item.id} className="p-4 space-y-2">
										<div className="flex flex-wrap items-center gap-2">
											<p className="text-sm font-medium text-stone-900">
												{item.obraName ?? "Obra sin nombre"}
											</p>
											{item.obraN != null ? (
												<Badge variant="outline">#{item.obraN}</Badge>
											) : null}
											<Badge variant={statusVariant(item.status)}>
												{statusLabel(item.status)}
											</Badge>
										</div>
										<div className="grid gap-1 text-xs text-stone-600 md:grid-cols-3">
											<span>
												Eliminada: {formatDateTimeLabel(item.deletedAt)} por{" "}
												{item.deletedByLabel ?? item.deletedByUserId ?? "Sistema"}
											</span>
											<span>
												Restaurada: {formatDateTimeLabel(item.restoredAt)} por{" "}
												{item.restoredByLabel ?? item.restoredByUserId ?? "-"}
											</span>
											<span>
												Purgada: {formatDateTimeLabel(item.purgedAt)} por{" "}
												{item.purgedByLabel ?? item.purgedByUserId ?? "-"}
											</span>
										</div>
										<div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500">
											<span>Deadline recuperación: {formatDateTimeLabel(item.restoreDeadlineAt)}</span>
											{item.deleteReason ? <span>Motivo delete: {item.deleteReason}</span> : null}
											{item.purgeReason ? <span>Motivo purge: {item.purgeReason}</span> : null}
											{item.purgeJobId ? <span>Job purge: {item.purgeJobId}</span> : null}
										</div>
									</div>
								))}
							</div>
						)}
					</Card>
				</TabsContent>
			</Tabs>

			<div className="flex items-center justify-between text-xs text-stone-500">
				<div className="flex items-center gap-2">
					<Trash2 className="h-3.5 w-3.5" />
					<span>Vista actual: {tab === "active" ? "Papelera" : "Historial"}</span>
				</div>
				<span>{currentCount} elementos</span>
			</div>
		</div>
	);
}
