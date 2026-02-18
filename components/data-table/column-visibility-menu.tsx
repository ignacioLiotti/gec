"use client";

import * as React from "react";
import { Columns3, Eye, EyeOff, MoveHorizontal, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
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
};

export function ColumnVisibilityMenu({
	columns,
	hiddenColumns,
	setHiddenColumns,
	pinnedColumns,
	togglePin,
	onBalanceColumns,
	disabled,
}: ColumnVisibilityMenuProps) {
	if (disabled) return null;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="secondary" size="sm" className="gap-2" disabled={disabled}>
					<Columns3 className="h-4 w-4" />
					Columnas
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-72">
				<div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
					Configurar columnas
				</div>
				{onBalanceColumns && (
					<DropdownMenuItem onClick={onBalanceColumns} className="gap-2">
						<MoveHorizontal className="h-4 w-4" />
						Balancear ancho
					</DropdownMenuItem>
				)}
				<DropdownMenuSeparator />
				<div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
					Visibilidad
				</div>
				<DropdownMenuItem
					onClick={() => setHiddenColumns([])}
					className="gap-2"
					disabled={!columns.some((col) => col.canHide)}
				>
					<Eye className="h-4 w-4" />
					Mostrar todo
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={() =>
						setHiddenColumns(columns.filter((col) => col.canHide).map((col) => col.id))
					}
					className="gap-2"
					disabled={!columns.some((col) => col.canHide)}
				>
					<EyeOff className="h-4 w-4" />
					Ocultar todo
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
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
								className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent rounded-sm"
							>
								<input
									type="checkbox"
									className="h-4 w-4 rounded border-border"
									checked={!isHidden}
									onChange={(event) => {
										if (hideDisabled) return;
										setHiddenColumns((prev) => {
											const set = new Set(prev);
											if (event.target.checked) {
												set.delete(col.id);
											} else {
												set.add(col.id);
											}
											return Array.from(set);
										});
									}}
									disabled={hideDisabled}
								/>
								<button
									type="button"
									onClick={() => {
										if (pinDisabled) return;
										togglePin(col.id);
									}}
									className={`rounded p-1 transition-colors ${isPinned ? "text-primary" : "text-muted-foreground"
										}`}
									title={isPinned ? "Desfijar" : "Fijar"}
									disabled={pinDisabled}
								>
									<Pin className="h-3 w-3" />
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


