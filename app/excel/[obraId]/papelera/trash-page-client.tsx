"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatReadableBytes } from "@/lib/tenant-expenses";

import type { DeletedDocumentEntry } from "../tabs/file-manager/types";

type TrashView = "active" | "history";
type DeletesApiResponse = {
	items?: DeletedDocumentEntry[];
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

function statusLabel(status: DeletedDocumentEntry["status"]) {
	switch (status) {
		case "deleted":
			return "Eliminado";
		case "restored":
			return "Recuperado";
		case "expired":
			return "Vencido";
		case "purged":
			return "Purgado";
		default:
			return status;
	}
}

function statusVariant(status: DeletedDocumentEntry["status"]) {
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

export function TrashPageClient({ obraId }: { obraId: string }) {
	const router = useRouter();
	const [tab, setTab] = useState<TrashView>("active");
	const [activeItems, setActiveItems] = useState<DeletedDocumentEntry[]>([]);
	const [historyItems, setHistoryItems] = useState<DeletedDocumentEntry[]>([]);
	const [loading, setLoading] = useState(false);
	const [restoringId, setRestoringId] = useState<string | null>(null);

	const loadItems = useCallback(
		async (view: TrashView) => {
			const response = await fetch(
				`/api/obras/${obraId}/documents/deletes?view=${view}&limit=250`,
				{ cache: "no-store" },
			);
			const payload = (await response.json().catch(() => ({}))) as DeletesApiResponse;
			if (!response.ok) {
				throw new Error(payload.error || "No se pudo cargar la papelera");
			}
			return Array.isArray(payload.items) ? payload.items : [];
		},
		[obraId],
	);

	const refreshCurrentView = useCallback(async () => {
		setLoading(true);
		try {
			if (tab === "active") {
				setActiveItems(await loadItems("active"));
			} else {
				setHistoryItems(await loadItems("history"));
			}
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Error al cargar papelera");
		} finally {
			setLoading(false);
		}
	}, [loadItems, tab]);

	const refreshBothViews = useCallback(async () => {
		setLoading(true);
		try {
			const [active, history] = await Promise.all([loadItems("active"), loadItems("history")]);
			setActiveItems(active);
			setHistoryItems(history);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Error al cargar papelera");
		} finally {
			setLoading(false);
		}
	}, [loadItems]);

	useEffect(() => {
		void refreshBothViews();
	}, [refreshBothViews]);

	const handleRestore = useCallback(
		async (deleteId: string) => {
			setRestoringId(deleteId);
			try {
				const response = await fetch(`/api/obras/${obraId}/documents/deletes/restore`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ deleteId }),
				});
				const payload = (await response.json().catch(() => ({}))) as { error?: string };
				if (!response.ok) {
					throw new Error(payload.error || "No se pudo restaurar el elemento");
				}
				toast.success("Elemento restaurado");
				await refreshBothViews();
			} catch (error) {
				toast.error(error instanceof Error ? error.message : "No se pudo restaurar el elemento");
			} finally {
				setRestoringId(null);
			}
		},
		[obraId, refreshBothViews],
	);

	const currentCount = useMemo(
		() => (tab === "active" ? activeItems.length : historyItems.length),
		[activeItems.length, historyItems.length, tab],
	);

	return (
		<div className="p-6 space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="space-y-1">
					<Button
						type="button"
						variant="ghost"
						className="h-8 px-2 text-xs"
						onClick={() => router.push(`/excel/${encodeURIComponent(obraId)}?tab=documentos`)}
					>
						<ArrowLeft className="mr-1 h-3.5 w-3.5" />
						Volver a documentos
					</Button>
					<h1 className="text-2xl font-semibold text-stone-900">Papelera</h1>
					<p className="text-sm text-stone-500">
						Recuperacion disponible por 30 dias. Historial auditable de deletes, restores y purgas.
					</p>
				</div>
				<Button type="button" variant="outline" onClick={() => void refreshCurrentView()} disabled={loading}>
					{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
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
								No hay elementos en papelera.
							</div>
						) : (
							<div className="divide-y divide-stone-200">
								{activeItems.map((item) => (
									<div key={item.id} className="p-4 flex items-start justify-between gap-4">
										<div className="min-w-0 space-y-1">
											<div className="flex items-center gap-2">
												<p className="truncate text-sm font-medium text-stone-900">{item.fileName}</p>
												<Badge variant={statusVariant(item.status)}>{statusLabel(item.status)}</Badge>
											</div>
											<p className="truncate text-xs text-stone-500">{item.storagePath}</p>
											<div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500">
												<span>Tipo: {item.itemType === "folder" ? "Carpeta" : "Archivo"}</span>
												<span>Eliminado por: {item.deletedByLabel ?? item.deletedByUserId ?? "Sistema"}</span>
												<span>Eliminado: {formatDateTimeLabel(item.deletedAt)}</span>
												<span>Recuperable hasta: {formatDateTimeLabel(item.recoverUntil)}</span>
												<span>{formatRecoveryTimeLeft(item.recoverUntil)}</span>
												<span>
													Tamano:{" "}
													{item.itemType === "folder"
														? `${item.fileCount} archivos (${formatReadableBytes(item.totalBytes ?? 0)})`
														: formatReadableBytes(item.totalBytes ?? 0)}
												</span>
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
												"Expirado"
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
								No hay eventos historicos para mostrar.
							</div>
						) : (
							<div className="divide-y divide-stone-200">
								{historyItems.map((item) => (
									<div key={item.id} className="p-4 space-y-2">
										<div className="flex flex-wrap items-center gap-2">
											<p className="text-sm font-medium text-stone-900">{item.fileName}</p>
											<Badge variant={statusVariant(item.status)}>{statusLabel(item.status)}</Badge>
											<span className="text-xs text-stone-500">
												{item.itemType === "folder" ? "Carpeta" : "Archivo"}
											</span>
										</div>
										<p className="text-xs text-stone-500 break-all">{item.storagePath}</p>
										<div className="grid gap-1 text-xs text-stone-600 md:grid-cols-3">
											<span>
												Eliminado: {formatDateTimeLabel(item.deletedAt)} por{" "}
												{item.deletedByLabel ?? item.deletedByUserId ?? "Sistema"}
											</span>
											<span>
												Restaurado: {formatDateTimeLabel(item.restoredAt)} por{" "}
												{item.restoredByLabel ?? item.restoredByUserId ?? "-"}
											</span>
											<span>
												Purgado: {formatDateTimeLabel(item.purgedAt)} por{" "}
												{item.purgedByLabel ?? item.purgedByUserId ?? "-"}
											</span>
										</div>
										<div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500">
											<span>Deadline de recuperacion: {formatDateTimeLabel(item.recoverUntil)}</span>
											{item.purgeReason ? <span>Motivo purge: {item.purgeReason}</span> : null}
											{item.purgeJobId ? <span>Job purge: {item.purgeJobId}</span> : null}
											<span>
												Tamano:{" "}
												{item.itemType === "folder"
													? `${item.fileCount} archivos (${formatReadableBytes(item.totalBytes ?? 0)})`
													: formatReadableBytes(item.totalBytes ?? 0)}
											</span>
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
