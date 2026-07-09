"use client";

import * as React from "react";
import { Columns3, Eye, EyeOff, MoveHorizontal, Pin } from "lucide-react";
import {
	ExpandableLightButton,
	type LightButtonProps,
} from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ColumnMeta = {
	id: string;
	label: string;
	canHide?: boolean;
	canPin?: boolean;
};

export type ColumnVisibilityMenuProps = {
	columns: ColumnMeta[];
	hiddenColumns: string[];
	setHiddenColumns: React.Dispatch<React.SetStateAction<string[]>>;
	pinnedColumns: string[];
	togglePin: (columnId: string) => void;
	onBalanceColumns?: () => void;
	disabled?: boolean;
	triggerVariant?: LightButtonProps["variant"];
	triggerClassName?: string;
};

export function ColumnVisibilityMenu({
	columns,
	hiddenColumns,
	setHiddenColumns,
	pinnedColumns,
	togglePin,
	onBalanceColumns,
	disabled,
	triggerVariant = "default",
	triggerClassName,
}: ColumnVisibilityMenuProps) {
	if (disabled) return null;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<ExpandableLightButton
					label="Columnas"
					variant={triggerVariant}
					className={triggerClassName}
					disabled={disabled}
				>
					<Columns3 className="size-4" />
				</ExpandableLightButton>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="z-[10000001] w-72">
				<div className="px-2 py-1.5 text-sm font-medium text-content-muted">
					Configurar columnas
				</div>
				{onBalanceColumns && (
					<DropdownMenuItem onClick={onBalanceColumns} className="gap-2">
						<MoveHorizontal className="size-4" />
						Balancear ancho
					</DropdownMenuItem>
				)}
				<DropdownMenuSeparator />
				<div className="px-2 py-1.5 text-sm font-medium text-content-muted">
					Visibilidad
				</div>
				<DropdownMenuItem
					onClick={() => setHiddenColumns([])}
					className="gap-2"
					disabled={!columns.some((col) => col.canHide)}
				>
					<Eye className="size-4" />
					Mostrar todo
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={() =>
						setHiddenColumns(columns.filter((col) => col.canHide).map((col) => col.id))
					}
					className="gap-2"
					disabled={!columns.some((col) => col.canHide)}
				>
					<EyeOff className="size-4" />
					Ocultar todo
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<div className="px-2 py-1.5 text-sm font-medium text-content-muted">
					Columnas
				</div>
				<div className="space-y-1">
					{columns.map((col) => {
						const isHidden = hiddenColumns.includes(col.id);
						const isPinned = pinnedColumns.includes(col.id);
						const hideDisabled = !col.canHide;
						const pinDisabled = !col.canPin;
						return (
							<div
								key={col.id}
								className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-content transition-colors hover:bg-surface-recessed"
							>
								<Checkbox
									checked={!isHidden}
									onCheckedChange={(checked) => {
										if (hideDisabled) return;
										setHiddenColumns((prev) => {
											const set = new Set(prev);
											if (checked === true) {
												set.delete(col.id);
											} else {
												set.add(col.id);
											}
											return Array.from(set);
										});
									}}
									disabled={hideDisabled}
									className="size-4"
								/>
								<button
									type="button"
									onClick={() => {
										if (pinDisabled) return;
										togglePin(col.id);
									}}
									className={`rounded p-1 transition-colors hover:bg-surface-recessed ${isPinned ? "text-orange-primary" : "text-content-muted"
										}`}
									aria-label={isPinned ? "Desfijar columna" : "Fijar columna"}
									disabled={pinDisabled}
								>
									<Pin className="size-3" />
								</button>
								<span className="flex-1 truncate">{col.label}</span>
							</div>
						);
					})}
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

