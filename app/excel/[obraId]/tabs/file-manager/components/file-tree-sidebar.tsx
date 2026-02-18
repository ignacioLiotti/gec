"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ChevronDown, Folder, FolderPlus, Loader2, RefreshCw, Search, Table2 } from "lucide-react";
import type { FileSystemItem } from "../types";
import type { MouseEvent, ReactNode } from "react";

type FileTreeSidebarProps = {
	searchQuery: string;
	onSearchQueryChange: (value: string) => void;
	selectedFolder: FileSystemItem | null;
	documentViewMode: "cards" | "table";
	onDocumentViewModeChange: (mode: "cards" | "table") => void;
	showDocumentToggle: boolean;
	onCreateFolderClick: (mode: "normal" | "data") => void;
	fileTree: FileSystemItem | null;
	renderTreeItem: (root: FileSystemItem) => ReactNode;
	loading: boolean;
	onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void;
	onRefresh?: () => void;
	isRefreshing?: boolean;
};

export function FileTreeSidebar({
	searchQuery,
	onSearchQueryChange,
	selectedFolder,
	documentViewMode,
	onDocumentViewModeChange,
	showDocumentToggle,
	onCreateFolderClick,
	fileTree,
	renderTreeItem,
	loading,
	onContextMenu,
	onRefresh,
	isRefreshing,
}: FileTreeSidebarProps) {
	return (
		<div
			className={cn(
				"rounded-lg border border-stone-200 bg-white shadow-sm overflow-auto transition-all duration-300 ease-in-out flex flex-col justify-between",
				!selectedFolder ? "h-full w-full" : "max-h-[320px] lg:max-h-full"
			)}
			onContextMenu={onContextMenu}
		>
			<div className="p-4">
				<div className="mb-4 flex flex-col gap-2">
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
						<Input
							type="search"
							placeholder="Buscar..."
							value={searchQuery}
							onChange={(e) => onSearchQueryChange(e.target.value)}
							className="pl-9  h-9 text-sm"
						/>
					</div>

				</div>
				<div className="flex items-center justify-between gap-2 mb-2">
					<h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
						Carpetas
					</h2>
					<div className="flex items-center gap-1">
						{onRefresh && (
							<Button
								variant="ghost"
								size="xs"
								onClick={onRefresh}
								disabled={isRefreshing}
								title="Sincronizar documentos"
								className="h-7 w-7 p-0"
							>
								<RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
							</Button>
						)}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" size="xs">
									<FolderPlus className="w-4 h-4 mr-1" />
									Crear
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={() => onCreateFolderClick("normal")}>
									<Folder className="w-4 h-4 mr-2 text-stone-500" />
									Carpeta normal
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => onCreateFolderClick("data")}>
									<Table2 className="w-4 h-4 mr-2 text-amber-600" />
									Carpeta de datos
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
				{!fileTree ? (
					loading ? (
						<div className="text-sm text-stone-400">Cargando...</div>
					) : (
						<div className="text-sm text-stone-400">Sin archivos</div>
					)
				) : (
					<div className="space-y-2">
						{loading && (
							<div className="flex items-center gap-2 text-xs text-amber-600">
								<Loader2 className="h-3 w-3 animate-spin" />
								<span>Actualizando árbol...</span>
							</div>
						)}
						<div className="space-y-1">{renderTreeItem(fileTree)}</div>
					</div>
				)}
			</div>
			<div className="p-4 border-t border-stone-100 mt-auto">
				<p className="text-xs text-stone-400 mb-2">Leyenda</p>
				<div className="space-y-1.5">
					<div className="flex items-center gap-2 text-xs text-stone-500">
						<Table2 className="w-3.5 h-3.5 text-amber-600" />
						<span>Extracción de datos</span>
					</div>
					<div className="flex items-center gap-2 text-xs text-stone-500">
						<Table2 className="w-3.5 h-3.5 text-blue-600" />
						<span>Entrada manual</span>
					</div>
					<div className="flex items-center gap-2 text-xs text-stone-500">
						<Table2 className="w-3.5 h-3.5 text-purple-600" />
						<span>Mixta (extracción + manual)</span>
					</div>
				</div>
			</div>
		</div>
	);
}
