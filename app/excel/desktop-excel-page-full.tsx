'use client';

import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState } from "react";
import type { ChangeEvent, RefObject } from "react";
import Link from "next/link";
import { FileText, Trash2, Upload } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
	FormTable,
	FormTableContent,
	FormTablePagination,
	FormTableTabs,
	FormTableToolbar,
} from "@/components/form-table/form-table";
import {
	countActiveAutoColumnFilters,
	createAutoColumnFilters,
	matchesAutoColumnFilters,
	renderAutoColumnFilters,
	type AutoColumnFilters,
} from "@/components/form-table/column-filters";
import {
	createObrasDetalleConfig,
	mapObraToDetailRow,
	type MainTableColumnConfig,
	type ObrasDetalleRow,
} from "@/components/form-table/configs/obras-detalle";
import type { FormTableConfig } from "@/components/form-table/types";
import { ExpandableLightButton } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useTenantAdminStatus } from "@/hooks/use-tenant-admin-status";
import type { ExcelPageClientProps } from "@/lib/excel/types";
import type { WizardFlow } from "@/components/ui/contextual-wizard";
import {
	ExcelPageHeader,
	ExcelPageShell,
	ExcelTableSurface,
	ExcelToolbarFrame,
} from "./_components/excel-page-chrome";
import { ExcelImportPreviewSheet } from "./_components/excel-import-preview-sheet";
import { useObraCsvImport } from "./_components/use-obra-csv-import";
import {
	GUIDED_EXCEL_STAGES,
	getGuidedExcelStage,
	isGuidedExcelTour,
} from "@/lib/demo-tours/excel-guided-flow";
import { DemoPageTour } from "@/components/demo-tours/demo-page-tour";
import { presentacionCarteraTour } from "@/lib/demo-tours/screen-tour-flows";
import { cn } from "@/lib/utils";

const ContextualWizard = dynamic(
	() =>
		import("@/components/ui/contextual-wizard").then((mod) => mod.ContextualWizard),
	{ loading: () => null },
);

const excelTablePageStyles = {
	root: "relative space-y-5",
	headerStack: "flex flex-col gap-4",
	headerRow: "flex w-full flex-col gap-4 xl:flex-row xl:items-start xl:justify-between",
	tabsViewport: "min-w-0 overflow-x-auto",
	tabs: "flex h-11 min-w-max justify-start rounded-lg p-1",
	toolbarRow: "flex w-full flex-col gap-3 xl:-mb-0 xl:flex-row xl:items-center xl:justify-between",
	tableContent:
		"my-0 max-w-full overflow-hidden rounded-lg bg-surface shadow-[0_1px_0_0_#fff_inset,0_-1px_0_0_#0000001f_inset,0_0_0_1px_#00000024,0_2px_2px_0_#0b090c0d,0_1px_1px_0_#0b090c0f,0_5px_8px_-7px_#0b090c08] md:max-w-[calc(96vw-var(--sidebar-current-width))]",
	tableInner: "max-h-[70svh] md:max-h-[calc(100vh-400px)]",
	toolbarAction: "py-4",
};

type ExcelTablePageViewProps = {
	guidedExcelFlow: WizardFlow | null;
	inputRef: RefObject<HTMLInputElement | null>;
	isImporting: boolean;
	isTenantAdmin: boolean;
	onCloseGuidedExcelFlow: () => void;
	onCsvInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
	onImportClick: () => void;
};

function ExcelTablePageView({
	guidedExcelFlow,
	inputRef,
	isImporting,
	isTenantAdmin,
	onCloseGuidedExcelFlow,
	onCsvInputChange,
	onImportClick,
}: ExcelTablePageViewProps) {
	return (
		<div className={excelTablePageStyles.root}>
			<DemoPageTour flow={presentacionCarteraTour} />

			<div className={excelTablePageStyles.headerStack}>
				<div className={excelTablePageStyles.headerRow}>
					<ExcelPageHeader
						targetId="excel-page-header"
						title="Tus Obras"
						description="Filtra, busca y actualiza tus obras desde una vista unificada."
					/>
					<div
						data-wizard-target="excel-page-tabs"
						className={excelTablePageStyles.tabsViewport}
					>
						<FormTableTabs className={excelTablePageStyles.tabs} />
					</div>
				</div>
				<Separator className="h-full" />
			</div>

			<div className={excelTablePageStyles.toolbarRow}>
				<ExcelToolbarFrame side="left" targetId="excel-page-toolbar">
					<FormTableToolbar />
				</ExcelToolbarFrame>
				<ExcelToolbarFrame side="right">
					<ExcelTablePageActions
						inputRef={inputRef}
						isImporting={isImporting}
						showTrashAction={isTenantAdmin}
						onCsvInputChange={onCsvInputChange}
						onImportClick={onImportClick}
					/>
				</ExcelToolbarFrame>
			</div>

			<ExcelTableSurface data-wizard-target="excel-page-table">
				<FormTableContent
					className={excelTablePageStyles.tableContent}
					innerClassName={excelTablePageStyles.tableInner}
				/>
				<Separator className="bg-stroke-soft" />
				<FormTablePagination />
			</ExcelTableSurface>

			{guidedExcelFlow ? (
				<ContextualWizard
					open
					onOpenChange={(nextOpen) => {
						if (!nextOpen) {
							onCloseGuidedExcelFlow();
						}
					}}
					flow={guidedExcelFlow}
					showCloseButton={true}
				/>
			) : null}
		</div>
	);
}

type ExcelTablePageActionsProps = {
	inputRef: RefObject<HTMLInputElement | null>;
	isImporting: boolean;
	showTrashAction: boolean;
	onCsvInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
	onImportClick: () => void;
};

function ExcelTablePageActions({
	inputRef,
	isImporting,
	showTrashAction,
	onCsvInputChange,
	onImportClick,
}: ExcelTablePageActionsProps) {
	return (
		<>
			<input
				ref={inputRef}
				type="file"
				accept=".csv,text/csv"
				multiple
				className="hidden"
				onChange={onCsvInputChange}
			/>
			<ExpandableLightButton
				type="button"
				label={isImporting ? "Importando..." : "Importar CSV"}
				variant="default"
				onClick={onImportClick}
				disabled={isImporting}
				className={cn(excelTablePageStyles.toolbarAction, '-ml-5')}
			>
				<Upload className="size-4" />
			</ExpandableLightButton>
			<ExpandableLightButton
				label="Generar Reporte"
				variant="default"
				className={excelTablePageStyles.toolbarAction}
				asChild
			>
				<Link href="/excel/reporte" prefetch={false}>
					<FileText className="size-4" />
				</Link>
			</ExpandableLightButton>
			{showTrashAction ? (
				<ExpandableLightButton
					label="Papelera obras"
					variant="default"
					className={excelTablePageStyles.toolbarAction}
					asChild
				>
					<Link href="/excel/papelera-obras" prefetch={false}>
						<Trash2 className="size-4" />
					</Link>
				</ExpandableLightButton>
			) : null}
		</>
	);
}

export default function DesktopExcelPageFull({
	initialMainTableColumnsConfig,
	initialObras,
}: ExcelPageClientProps) {
	const { refresh, replace } = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const { isAdmin: isTenantAdmin } = useTenantAdminStatus();
	const mainTableColumnsConfig =
		initialMainTableColumnsConfig as MainTableColumnConfig[] | null;
	const inputRef = useRef<HTMLInputElement>(null);
	const [hydratedRows, setHydratedRows] = useState<ObrasDetalleRow[]>(() =>
		initialObras.map(mapObraToDetailRow),
	);
	const handleCsvImportConfirmed = useCallback(() => {
		void (async () => {
			try {
				const response = await fetch("/api/obras", { cache: "no-store" });
				if (!response.ok) {
					throw new Error("No se pudieron actualizar las obras importadas");
				}
				const payload = await response.json();
				const obras = Array.isArray(payload.detalleObras) ? payload.detalleObras : [];
				setHydratedRows(obras.map(mapObraToDetailRow));
			} catch (error) {
				console.error("[excel:csv-import-refresh]", error);
				refresh();
			}
		})();
	}, [refresh]);
	const {
		confirmCsvImport,
		isImporting,
		isPreviewOpen,
		pendingFileName,
		pendingUpdates,
		previewRows,
		resetPreview,
		startCsvImport,
	} = useObraCsvImport({ onImportConfirmed: handleCsvImportConfirmed });

	const guidedTourStage = getGuidedExcelStage(searchParams);
	const guidedExcelFlow = useMemo<WizardFlow | null>(() => {
		if (!isGuidedExcelTour(searchParams) || guidedTourStage !== GUIDED_EXCEL_STAGES.excelIntro) {
			return null;
		}

		return {
			id: "guided-excel-landing",
			title: "Recorrido guiado",
			steps: [
				{
					id: "header",
					targetId: "excel-page-header",
					title: "Tu cartera de obras",
					content:
						"Aca estan todas las obras con sus datos actualizados. De un vistazo ya sabes cuantas tenes en ejecucion, el avance y los importes mas importantes.",
					placement: "bottom",
					skippable: false,
				},
				{
					id: "table",
					targetId: "excel-page-table",
					title: "Todo de un vistazo",
					content:
						"Cada fila es una obra activa. Las columnas muestran fechas, importes y avance para que en segundos conozcas el estado de tu cartera.",
					placement: "top",
					skippable: false,
				},
				{
					id: "open-obra",
					targetId: "excel-page-open-obra",
					title: "Entra a ver el detalle",
					content:
						"Hace clic en el nombre de la obra para ver todos sus datos: avance, importes, alertas y documentos.",
					placement: "right",
					allowClickThrough: true,
					requiredAction: "click_target",
					waitForMs: 2200,
					skippable: false,
				},
			],
		};
	}, [guidedTourStage, searchParams]);

	const closeGuidedExcelFlow = useCallback(() => {
		const params = new URLSearchParams(searchParams?.toString() ?? "");
		params.delete("tour");
		params.delete("tourStage");
		const nextUrl = params.size > 0 ? `${pathname}?${params.toString()}` : pathname;
		replace(nextUrl, { scroll: false });
	}, [pathname, replace, searchParams]);

	const tableConfig = useMemo(() => {
		const baseConfig = createObrasDetalleConfig(mainTableColumnsConfig, {
			readOnly: false,
			optimizationPreset: "legacy",
		});
		const {
			createFilters,
			renderFilters,
			applyFilters,
			countActiveFilters,
			fetchRows,
			csvExport,
			...baseConfigWithoutFilters
		} = baseConfig;
		void createFilters;
		void renderFilters;
		void applyFilters;
		void countActiveFilters;
		void fetchRows;
		void csvExport;
		const generatedFilterColumns = baseConfig.columns;
		const generatedFilterConfig: FormTableConfig<ObrasDetalleRow, AutoColumnFilters> = {
			...baseConfigWithoutFilters,
			columns: generatedFilterColumns,
			serverSideData: false,
			createFilters: () => createAutoColumnFilters(generatedFilterColumns),
			renderFilters: ({ filters, onChange }) =>
				renderAutoColumnFilters({
					columns: generatedFilterColumns,
					filters,
					onChange,
				}),
			applyFilters: (row, filters) =>
				matchesAutoColumnFilters(row, generatedFilterColumns, filters),
			countActiveFilters: countActiveAutoColumnFilters,
		};
		return {
			...generatedFilterConfig,
			defaultRows: hydratedRows,
		};
	}, [hydratedRows, mainTableColumnsConfig]);

	const handleCsvInputChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			const list = event.target.files;
			if (!list?.length) return;

			startCsvImport(list, () => {
				if (inputRef.current) {
					inputRef.current.value = "";
				}
			});
		},
		[startCsvImport],
	);

	const handleImportClick = useCallback(() => {
		inputRef.current?.click();
	}, []);

	return (
		<ExcelPageShell>
			<ExcelImportPreviewSheet
				open={isPreviewOpen}
				pendingFileName={pendingFileName}
				pendingCount={pendingUpdates.length}
				previewRows={previewRows}
				isImporting={isImporting}
				onCancel={resetPreview}
				onConfirm={confirmCsvImport}
			/>

			<FormTable config={tableConfig}>
				<ExcelTablePageView
					guidedExcelFlow={guidedExcelFlow}
					inputRef={inputRef}
					isImporting={isImporting}
					isTenantAdmin={isTenantAdmin}
					onCloseGuidedExcelFlow={closeGuidedExcelFlow}
					onCsvInputChange={handleCsvInputChange}
					onImportClick={handleImportClick}
				/>
			</FormTable>
		</ExcelPageShell>
	);
}
