"use client";

import { ColumnVisibilityMenu } from "@/components/data-table/column-visibility-menu";
import { ExpandableLightButton, LightButton } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
	Check,
	Download,
	Filter,
	Loader2,
	Minus,
	MoreHorizontal,
	RotateCcw,
	Search,
} from "lucide-react";
import { useState } from "react";
import { useFormTable } from "./context";
import type { FormTableRow } from "./types";

import { shouldUseSpreadsheetChrome } from "./table-layout";

export function FormTableToolbar({ className }: { className?: string }) {
	const { config, search, filters, columns, sorting, pagination, actions } = useFormTable<
		FormTableRow,
		unknown
	>();
	const [isFiltersOpen, setIsFiltersOpen] = useState(false);
	const isExtrasToolbar = config.toolbarMode === "extras";
	const isSpreadsheetChrome = shouldUseSpreadsheetChrome(config);
	const canShowFilters = filters.enabled && typeof filters.value !== "undefined";
	const rowCountText =
		pagination.totalRowCount > 0 && pagination.visibleRowCount !== pagination.totalRowCount
			? `${pagination.visibleRowCount}/${pagination.totalRowCount} filas`
			: `${pagination.visibleRowCount} filas`;

	const renderFiltersContent =
		isFiltersOpen && typeof filters.draft !== "undefined" && config.renderFilters ? (
			config.renderFilters({
				filters: filters.draft,
				onChange: (updater) => filters.setDraft((prev) => updater(prev ?? filters.draft)),
			})
		) : (
			<p className="text-sm text-content-muted">No hay filtros configurados para esta vista.</p>
		);

	const columnVisibilityMenu = (
		<ColumnVisibilityMenu
			columns={columns.list.map((column) => ({
				id: column.id,
				label: column.label,
				canHide: column.enableHide !== false,
				canPin: column.enablePin !== false,
			}))}
			hiddenColumns={columns.hiddenIds}
			setHiddenColumns={columns.setHiddenIds}
			pinnedColumns={columns.pinnedIds}
			togglePin={columns.togglePin}
			onBalanceColumns={columns.handleBalance}
			disabled={false}
			triggerVariant={isExtrasToolbar ? "secondary" : "default"}
			triggerClassName={cn(
				"h-8 min-w-8 px-2",
				isExtrasToolbar
					? "h-8 w-full justify-start rounded-sm px-2 py-1.5 text-sm font-normal"
					: isSpreadsheetChrome && "text-xs"
			)}
		/>
	);

	return (
		<div
			className={cn(
				"flex flex-wrap items-center justify-between gap-2 z-20",
				isSpreadsheetChrome && "gap-2",
				className
			)}
		>
			<div className="flex flex-wrap items-center gap-2">
				{search.showInline && (
					<div className="group relative ml-0.5 flex items-center gap-2">
						{search.isProcessing ? (
							<Loader2 className="absolute left-4 top-1/2 z-10 size-5 -translate-y-1/2 animate-spin text-content" />
						) : (
							<Search className="absolute left-4 top-1/2 z-10 size-4 -translate-y-1/2 text-content" />
						)}
						<Input
							type="search"
							data-testid="form-table-search"
							className={cn(
								"pointer-events-auto w-[360px] pl-9 pr-[68px] text-sm font-medium [&::-webkit-search-cancel-button]:hidden",
								isSpreadsheetChrome ? "sm:w-[360px]" : "sm:w-64 md:w-[360px]"
							)}
							value={search.value}
							onChange={(event) => search.onChange(event.target.value)}
							placeholder={search.placeholder}
						/>
					</div>
				)}
				{isSpreadsheetChrome && (
					<span className="inline-flex h-8 items-center rounded-md border border-stroke-soft bg-surface-recessed px-2.5 text-[11px] font-semibold text-content-muted shadow-recessed">
						{search.isProcessing ? "Buscando..." : rowCountText}
					</span>
				)}
				{search.showInline && config.toolbarSearchEnd}
				{canShowFilters && (
					<Sheet open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
						{!isExtrasToolbar && (
							<SheetTrigger asChild>
								<ExpandableLightButton
									type="button"
									label="Filtros"
									variant={filters.activeCount > 0 ? "primary" : "default"}
									className="h-8 min-w-8 px-2"
								>
									{filters.isProcessing ? (
										<Loader2 className="size-4 animate-spin" />
									) : (
										<Filter className="size-4" />
									)}
									{filters.activeCount > 0 && (
										<span className="ml-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-foreground/20 px-1.5 text-[10px] font-semibold">
											{filters.activeCount}
										</span>
									)}
								</ExpandableLightButton>
							</SheetTrigger>
						)}
						<SheetContent
							side="right"
							className="flex !max-w-[420px] flex-col border-l border-stroke-soft bg-surface p-0 shadow-dropdown"
						>
							<div className="shrink-0 border-b border-stroke-soft bg-surface px-6 py-5">
								<SheetHeader className="space-y-1">
									<div className="flex items-center gap-3">
										<div className="flex size-9 items-center justify-center rounded-md border border-stroke-soft bg-surface-recessed text-content-muted">
											<Filter className="size-4" />
										</div>
										<div>
											<SheetTitle className="text-lg">Filtros avanzados</SheetTitle>
											<p className="mt-0.5 text-xs text-content-secondary">
												{filters.activeCount > 0
													? `${filters.activeCount} filtro${filters.activeCount > 1 ? "s" : ""} activo${filters.activeCount > 1 ? "s" : ""}`
													: "Refina los resultados de la tabla"}
											</p>
										</div>
									</div>
								</SheetHeader>
							</div>

							<div className="flex-1 overflow-y-auto px-6 py-5">
								<div className="space-y-5">{renderFiltersContent}</div>
							</div>

							<div className="shrink-0 border-t border-stroke-soft bg-surface-recessed px-6 py-4">
								<div className="flex items-center justify-between gap-3">
									<LightButton
										type="button"
										variant="default"
										onClick={filters.reset}
										className="gap-1.5 px-3 py-3"
									>
										<RotateCcw className="size-4" />
										Reiniciar filtros
									</LightButton>
									<LightButton
										type="button"
										variant="primarySolid"
										onClick={() => {
											filters.apply();
											setIsFiltersOpen(false);
										}}
										className="gap-1.5 px-3 py-3"
									>
										<Check className="size-4" />
										Aplicar
									</LightButton>
								</div>
							</div>
						</SheetContent>
					</Sheet>
				)}
				{isExtrasToolbar ? (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<ExpandableLightButton
								type="button"
								label="Extras"
								variant="default"
								className="h-8 min-w-8 px-2"
							>
								<MoreHorizontal className="size-4" />
							</ExpandableLightButton>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="w-[320px]">
							{canShowFilters && (
								<>
									<DropdownMenuItem
										onSelect={(event) => {
											event.preventDefault();
											setIsFiltersOpen(true);
										}}
										className="gap-2"
									>
										{filters.isProcessing ? (
											<Loader2 className="size-4 animate-spin" />
										) : (
											<Filter className="size-4" />
										)}
										<span>Filtros</span>
										{filters.activeCount > 0 && (
											<span className="ml-auto rounded-full bg-orange-primary/10 px-2 py-0.5 text-[10px] font-semibold text-orange-primary">
												{filters.activeCount}
											</span>
										)}
									</DropdownMenuItem>
									<DropdownMenuSeparator />
								</>
							)}
							<div className="">{columnVisibilityMenu}</div>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onSelect={(event) => {
									event.preventDefault();
									void actions.exportCsv();
								}}
								className="gap-2"
							>
								<Download className="size-4" />
								Exportar tabla
							</DropdownMenuItem>
							{config.toolbarActions && (
								<>
									<DropdownMenuSeparator />
									<div className="">{config.toolbarActions}</div>
								</>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
				) : (
					<>
						{columnVisibilityMenu}
						{config.toolbarActions}
					</>
				)}
			</div>
			<div className="flex flex-wrap items-center gap-2 ">
				{!isExtrasToolbar && (
					<ExpandableLightButton
						type="button"
						label={isSpreadsheetChrome ? "Exportar" : "Exportar tabla"}
						variant="default"
						className={cn("h-8 min-w-8 px-2", isSpreadsheetChrome && "text-xs")}
						onClick={() => void actions.exportCsv()}
					>
						<Download className="size-4" />
					</ExpandableLightButton>
				)}
				{sorting.state.columnId && (
					<ExpandableLightButton
						type="button"
						label="Limpiar orden"
						variant="default"
						className={cn("h-8 min-w-8 px-2", isSpreadsheetChrome && "text-xs")}
						onClick={sorting.clear}
					>
						<Minus className="size-4" />
					</ExpandableLightButton>
				)}
			</div>
		</div>
	);
}
