"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { invalidateObrasTableSessionCache } from "@/components/form-table/configs/obras-detalle";
import { toNumber } from "./excel-page-format";
import {
	buildCsvObraUpdates,
	prepareCsvObraImport,
	type CsvObra,
	type CsvPreviewRow,
} from "./obra-csv-import";

async function fetchCurrentMaxObraNumber() {
	try {
		const existingResponse = await fetch("/api/obras", { cache: "no-store" });
		if (!existingResponse.ok) return 0;
		const existingPayload = await existingResponse.json();
		const existingObras = Array.isArray(existingPayload.detalleObras)
			? (existingPayload.detalleObras as Array<{ n?: number | string | null }>)
			: [];
		return existingObras.reduce((max, obra) => {
			const obraN = Math.trunc(toNumber(obra.n));
			return Number.isFinite(obraN) && obraN > max ? obraN : max;
		}, 0);
	} catch (existingError) {
		console.error(
			"No se pudieron cargar las obras existentes para calcular el Nro",
			existingError,
		);
		return 0;
	}
}

function buildPendingFileName(files: File[]) {
	const namesJoined = files.map((file) => file.name).join(", ");
	const namesLabel =
		namesJoined.length > 120 ? `${namesJoined.slice(0, 117)}...` : namesJoined;
	return files.length === 1 ? files[0].name : `${files.length} archivos (${namesLabel})`;
}

export function useObraCsvImport({
	onImportConfirmed,
}: {
	onImportConfirmed?: () => void;
} = {}) {
	const [isImporting, setIsImporting] = useState(false);
	const [isPreviewOpen, setIsPreviewOpen] = useState(false);
	const [previewRows, setPreviewRows] = useState<CsvPreviewRow[]>([]);
	const [pendingUpdates, setPendingUpdates] = useState<CsvObra[]>([]);
	const [pendingFileName, setPendingFileName] = useState("");

	const resetPreview = useCallback(() => {
		setIsPreviewOpen(false);
		setPendingUpdates([]);
		setPreviewRows([]);
		setPendingFileName("");
	}, []);

	const startCsvImport = useCallback((files: File[] | FileList, onSettled?: () => void) => {
		const fileList = Array.from(files);
		if (!fileList.length) return;

		setIsImporting(true);

		void (async () => {
			try {
				const currentMaxN = await fetchCurrentMaxObraNumber();
				const { allValid, totalSkipped, importErrors } =
					await prepareCsvObraImport(fileList);

				if (importErrors.length && allValid.length === 0) {
					throw new Error(importErrors.join(" · "));
				}
				if (importErrors.length) {
					toast.message(`Algunos archivos se omitieron: ${importErrors.join(" · ")}`);
				}

				if (!allValid.length) {
					throw new Error(
						"No hay filas validas con campos obligatorios en los archivos seleccionados",
					);
				}

				if (totalSkipped > 0) {
					toast.message(
						`Se omitieron ${totalSkipped} filas sin campos obligatorios en total`,
					);
				}

				const updates = buildCsvObraUpdates(allValid, currentMaxN);
				toast.message(
					`Se asignaron Nro consecutivos desde ${currentMaxN + 1} para agregar las obras al final`,
				);

				setPendingUpdates(updates);
				setPreviewRows(
					updates.slice(0, 5).map((row, idx) => ({
						...row,
						_rowIndex: idx + 1,
					})),
				);
				setPendingFileName(buildPendingFileName(fileList));
				setIsPreviewOpen(true);
			} catch (error) {
				const message = error instanceof Error ? error.message : "No se pudo importar el CSV";
				toast.error(message);
			} finally {
				setIsImporting(false);
				onSettled?.();
			}
		})();
	}, []);

	const confirmCsvImport = useCallback(async () => {
		if (!pendingUpdates.length) {
			setIsPreviewOpen(false);
			return;
		}
		setIsImporting(true);
		try {
			const response = await fetch("/api/obras/bulk", {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ updates: pendingUpdates }),
			});

			if (!response.ok) {
				const errorPayload = await response.json().catch(() => ({}));
				const message = errorPayload?.error || "No se pudieron importar las obras";
				throw new Error(message);
			}

			toast.success(`Importadas ${pendingUpdates.length} obras`);
			onImportConfirmed?.();
			invalidateObrasTableSessionCache({ refreshTable: true });
			resetPreview();
		} catch (error) {
			const message = error instanceof Error ? error.message : "No se pudo importar el CSV";
			toast.error(message);
		} finally {
			setIsImporting(false);
		}
	}, [onImportConfirmed, pendingUpdates, resetPreview]);

	return {
		confirmCsvImport,
		isImporting,
		isPreviewOpen,
		pendingFileName,
		pendingUpdates,
		previewRows,
		resetPreview,
		startCsvImport,
	};
}
