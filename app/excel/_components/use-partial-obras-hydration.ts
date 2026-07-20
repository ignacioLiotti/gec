"use client";

import { useEffect, useMemo, useState } from "react";
import type { ExcelPageObra } from "@/lib/excel/types";

type HydrationSchedule = "idle" | "timer";

function buildObrasKey(obras: ExcelPageObra[]) {
	return obras
		.map((obra) =>
			[
				obra.id,
				obra.__isPartial === true ? "partial" : "full",
				obra.n ?? "",
				obra.designacionYUbicacion ?? "",
				obra.entidadContratante ?? "",
				obra.porcentaje ?? "",
			].join(":"),
		)
		.join("|");
}

export function usePartialObrasHydration<Row>({
	hydrateWhenEmpty = false,
	initialObras,
	logContext,
	mapObra,
	schedule = "timer",
}: {
	hydrateWhenEmpty?: boolean;
	initialObras: ExcelPageObra[];
	logContext: string;
	mapObra: (obra: ExcelPageObra) => Row;
	schedule?: HydrationSchedule;
}) {
	const initialRows = useMemo(() => initialObras.map(mapObra), [initialObras, mapObra]);
	const initialRowsKey = useMemo(() => buildObrasKey(initialObras), [initialObras]);
	const [hydratedRows, setHydratedRows] = useState<{
		key: string;
		rows: Row[];
	} | null>(null);
	const rows = hydratedRows?.key === initialRowsKey ? hydratedRows.rows : initialRows;
	const [isHydrating, setIsHydrating] = useState(false);

	useEffect(() => {
		const hasPartialInitialObras = initialObras.some((obra) => obra.__isPartial === true);
		if (!hasPartialInitialObras && !(hydrateWhenEmpty && initialObras.length === 0)) {
			return;
		}

		let cancelled = false;
		let idleHandle: number | null = null;
		let timeoutHandle: ReturnType<typeof globalThis.setTimeout> | null = null;

		const hydrateRows = async () => {
			setIsHydrating(true);
			try {
				const response = await fetch("/api/obras", { cache: "no-store" });
				if (response.status === 401) {
					return;
				}
				if (!response.ok) {
					throw new Error("No se pudieron obtener las obras");
				}
				const payload = await response.json();
				const nextRows = Array.isArray(payload.detalleObras)
					? (payload.detalleObras as ExcelPageObra[]).map(mapObra)
					: [];
				if (!cancelled) {
					setHydratedRows({ key: initialRowsKey, rows: nextRows });
				}
			} catch (error) {
				console.error(logContext, error);
			} finally {
				if (!cancelled) {
					setIsHydrating(false);
				}
			}
		};

		const scheduleHydration = () => {
			void hydrateRows();
		};

		if (schedule === "idle" && typeof window !== "undefined" && "requestIdleCallback" in window) {
			idleHandle = window.requestIdleCallback(scheduleHydration, {
				timeout: 2000,
			});
		} else {
			timeoutHandle = globalThis.setTimeout(
				scheduleHydration,
				schedule === "idle" ? 250 : 0,
			);
		}

		return () => {
			cancelled = true;
			if (idleHandle != null && typeof window !== "undefined" && "cancelIdleCallback" in window) {
				window.cancelIdleCallback(idleHandle);
			}
			if (timeoutHandle != null) {
				globalThis.clearTimeout(timeoutHandle);
			}
		};
	}, [hydrateWhenEmpty, initialObras, initialRowsKey, logContext, mapObra, schedule]);

	return { isHydrating, rows };
}
