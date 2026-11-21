"use client";

import { LightButton } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Loader2, Plus, Save, Undo2 } from "lucide-react";
import { startTransition } from "react";
import { useFormTable } from "./context";
import type { FormTableRow } from "./types";

export function FormTablePagination() {
	const { config, pagination, filters, meta, actions } = useFormTable<FormTableRow, unknown>();
	const {
		page,
		setPage,
		pageSize,
		setPageSize,
		lockedPageSize,
		hasNextPage,
		hasPreviousPage,
		totalPages,
		options,
		totalRowCount,
		isFetching,
		isTransitioning,
	} = pagination;
	const pageSizeLocked = typeof lockedPageSize === "number";
	const isReadOnly = config.readOnly === true;
	const allowAddRows = !isReadOnly && config.allowAddRows !== false;
	const canSave = !isReadOnly && typeof config.onSave === "function";
	const isLoading = isFetching || isTransitioning;
	const hideFooterPaginationSummary = config.hideFooterPaginationSummary === true;
	const showFooterTotalOnly = config.showFooterTotalOnly === true;
	const paginationDisabled = config.disablePagination === true;

	return (
		<div className="flex flex-wrap items-center justify-between gap-3 px-3 pb-4 text-sm text-content-secondary">
			{paginationDisabled ? (
				(isLoading || filters.activeCount > 0) && (
					<div className="flex items-center gap-4 text-content">
						{isLoading && <Loader2 className="size-4 animate-spin text-content-muted" />}
						{filters.activeCount > 0 && (
							<p className="text-xs text-content-muted">
								Filtros activos:{" "}
								<span className="font-medium text-content">{filters.activeCount}</span>
							</p>
						)}
					</div>
				)
			) : showFooterTotalOnly ? (
				<div className="flex items-center gap-4 px-2 py-1 text-content">
					<p className="text-xs font-medium text-content-muted">
						<span className="font-semibold text-content">{totalRowCount}</span>{" "}
						{totalRowCount === 1 ? "fila" : "filas"}
					</p>
					{isLoading && <Loader2 className="size-4 animate-spin text-content-muted" />}
					{filters.activeCount > 0 && (
						<p className="text-xs text-content-muted">
							Filtros activos:{" "}
							<span className="font-medium text-content">{filters.activeCount}</span>
						</p>
					)}
				</div>
			) : hideFooterPaginationSummary ? (
				(isLoading || filters.activeCount > 0) && (
					<div className="flex items-center gap-4 text-content">
						{isLoading && <Loader2 className="size-4 animate-spin text-content-muted" />}
						{filters.activeCount > 0 && (
							<p className="text-xs text-content-muted">
								Filtros activos:{" "}
								<span className="font-medium text-content">{filters.activeCount}</span>
							</p>
						)}
					</div>
				)
			) : (
				<div className="flex flex-wrap items-center gap-2 text-content">
					<div className="inline-flex items-center gap-2  px-2 py-1">
						<span className="pl-1 text-xs font-medium text-content-muted">Filas por página</span>
						{pageSizeLocked ? (
							<span className="rounded-full bg-surface-recessed px-3 py-1.5 text-xs font-semibold text-content shadow-recessed">
								{pageSize}
							</span>
						) : (
							<Select
								value={String(pageSize)}
								onValueChange={(value) => {
									setPageSize(Number(value));
								}}
								disabled={isLoading}
							>
								<SelectTrigger
									className={cn(
										"h-6 w-[74px] rounded-md  px-3 text-xs font-semibold text-content shadow-recessed hover:bg-surface-muted  [&>svg]:size-3.5 [&>svg]:text-content-muted",
										isLoading && "opacity-50"
									)}
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{options.map((size) => (
										<SelectItem key={size} value={String(size)}>
											{size}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					</div>
					{isLoading && <Loader2 className="size-4 animate-spin text-content-muted" />}
				</div>
			)}
			<div className="flex items-center gap-2">
				{config.footerActions}
				{allowAddRows && (
					<LightButton
						type="button"
						variant="primary"
						onClick={actions.addRow}
						data-testid="form-table-add-row"
						className="gap-1.5 px-3 py-4"
					>
						<Plus className="size-4" />
						Agregar fila vacia
					</LightButton>
				)}
				{canSave && meta.hasUnsavedChanges && (
					<LightButton
						type="button"
						onClick={actions.discard}
						disabled={!meta.hasUnsavedChanges || meta.isSaving}
						variant="destructive"
						data-testid="form-table-discard"
						className="gap-1.5 px-3 py-4"
					>
						<Undo2 className="size-4" />
						Descartar cambios
					</LightButton>
				)}
				{canSave ? (
					<LightButton
						type="button"
						onClick={actions.save}
						disabled={!meta.hasUnsavedChanges || meta.isSaving}
						data-testid="form-table-save"
						variant="primarySolid"
						className="gap-1.5 px-3 py-4"
					>
						{meta.isSaving ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Save className="size-4" />
						)}
						{meta.isSaving ? "Guardando..." : "Guardar cambios"}
					</LightButton>
				) : null}
			</div>
			{!paginationDisabled ? (
				<div className="flex items-center gap-1">
					<LightButton
						type="button"
						variant="default"
						onClick={() => startTransition(() => setPage((prev) => Math.max(1, prev - 1)))}
						disabled={!hasPreviousPage || isLoading}
						aria-label="Anterior"
						className="py-4"
					>
						<ChevronLeft className="size-4" />
					</LightButton>
					<span className="min-w-[88px] text-center text-xs text-content-muted">
						Página {page} de {totalPages}
					</span>
					<LightButton
						type="button"
						variant="default"
						onClick={() => startTransition(() => setPage((prev) => prev + 1))}
						disabled={!hasNextPage || isLoading}
						aria-label="Siguiente"
						className="py-4"
					>
						<ChevronRight className="size-4" />
					</LightButton>
				</div>
			) : null}
		</div>
	);
}
