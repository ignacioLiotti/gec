"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
	Building2,
	Check,
	ChevronRight,
	Folder,
	Loader2,
	Search,
	X,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type WorkOption = { id: string; label: string };

export type ChatScope = {
	obraIds: string[];
	folders: Array<{ obraId: string; path: string; label?: string }>;
};

type FolderNode = {
	name: string;
	relativePath?: string;
	type: "folder" | "file";
	children?: FolderNode[];
};

async function fetchObraFolders(obraId: string): Promise<Array<{ path: string; label: string }>> {
	const response = await fetch(`/api/obras/${encodeURIComponent(obraId)}/documents/list`, {
		cache: "no-store",
	});
	const payload = (await response.json().catch(() => ({}))) as {
		folder?: FolderNode | null;
		tree?: FolderNode | null;
	};
	if (!response.ok) throw new Error("No se pudieron cargar las carpetas");
	const node = payload.folder ?? payload.tree ?? null;
	return (node?.children ?? [])
		.filter((child) => child.type === "folder")
		.map((child) => ({
			path: child.relativePath ?? child.name,
			label: child.name,
		}));
}

function ObraFolderList({
	obraId,
	scope,
	onToggleFolder,
}: {
	obraId: string;
	scope: ChatScope;
	onToggleFolder: (folder: { obraId: string; path: string; label?: string }) => void;
}) {
	const foldersQuery = useQuery({
		queryKey: ["document-ai", "scope-folders", obraId],
		queryFn: () => fetchObraFolders(obraId),
		staleTime: 10 * 60 * 1000,
		refetchOnWindowFocus: false,
	});

	if (foldersQuery.isLoading) {
		return (
			<div className="flex items-center gap-2 py-1.5 pl-9 text-xs text-stone-400">
				<Loader2 className="size-3 animate-spin" />
				Cargando carpetas…
			</div>
		);
	}
	const folders = foldersQuery.data ?? [];
	if (folders.length === 0) {
		return <p className="py-1.5 pl-9 text-xs text-stone-400">Sin carpetas</p>;
	}
	return (
		<div className="space-y-0.5 pb-1">
			{folders.map((folder) => {
				const selected = scope.folders.some(
					(entry) => entry.obraId === obraId && entry.path === folder.path,
				);
				return (
					<button
						key={folder.path}
						type="button"
						onClick={() => onToggleFolder({ obraId, path: folder.path, label: folder.label })}
						className={cn(
							"dai-press flex w-full items-center gap-2 rounded-md py-1.5 pl-9 pr-2 text-left text-xs transition-colors duration-150",
							selected ? "bg-[#fff1e9] text-stone-900" : "text-stone-600 hover:bg-stone-100",
						)}
					>
						<Folder className={cn("size-3.5 shrink-0", selected ? "text-[#ff5800]" : "text-stone-400")} />
						<span className="truncate">{folder.label}</span>
						{selected ? <Check className="ml-auto size-3.5 shrink-0 text-[#ff5800]" /> : null}
					</button>
				);
			})}
		</div>
	);
}

export function ScopePicker({
	works,
	scope,
	onScopeChange,
}: {
	works: WorkOption[];
	scope: ChatScope;
	onScopeChange: (scope: ChatScope) => void;
}) {
	const [search, setSearch] = useState("");
	const [expandedObraId, setExpandedObraId] = useState<string | null>(null);

	const filteredWorks = useMemo(() => {
		const term = search.trim().toLowerCase();
		if (!term) return works;
		return works.filter((work) => work.label.toLowerCase().includes(term));
	}, [works, search]);

	const toggleObra = (obraId: string) => {
		const selected = scope.obraIds.includes(obraId);
		onScopeChange({
			obraIds: selected
				? scope.obraIds.filter((id) => id !== obraId)
				: [...scope.obraIds, obraId],
			folders: selected
				? scope.folders.filter((folder) => folder.obraId !== obraId)
				: scope.folders,
		});
	};

	const toggleFolder = (folder: { obraId: string; path: string; label?: string }) => {
		const exists = scope.folders.some(
			(entry) => entry.obraId === folder.obraId && entry.path === folder.path,
		);
		onScopeChange({
			// Selecting a folder implies its obra is in scope.
			obraIds: scope.obraIds.includes(folder.obraId)
				? scope.obraIds
				: [...scope.obraIds, folder.obraId],
			folders: exists
				? scope.folders.filter(
					(entry) => !(entry.obraId === folder.obraId && entry.path === folder.path),
				)
				: [...scope.folders, folder],
		});
	};

	const totalSelected = scope.obraIds.length + scope.folders.length;

	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={cn(
						"dai-press inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors duration-150",
						totalSelected > 0
							? "border-[#ffd6c2] bg-[#fff1e9] text-[#c24300]"
							: "border-stone-200 bg-white text-stone-500 hover:border-stone-300 hover:text-stone-700",
					)}
				>
					<Building2 className="size-3.5" />
					{totalSelected > 0 ? `${scope.obraIds.length} obra${scope.obraIds.length === 1 ? "" : "s"}` : "Obras"}
					{scope.folders.length > 0 ? (
						<span className="text-[#ff5800]">· {scope.folders.length} carpeta{scope.folders.length === 1 ? "" : "s"}</span>
					) : null}
				</button>
			</PopoverTrigger>
			<PopoverContent align="start" sideOffset={8} className="w-80 p-0">
				<div className="border-b border-stone-100 p-2">
					<div className="relative">
						<Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-stone-400" />
						<input
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Buscar obra"
							className="h-8 w-full rounded-md border border-stone-200 bg-white pl-8 pr-2 text-xs outline-none transition-colors focus:border-stone-400"
						/>
					</div>
				</div>
				<div className="max-h-72 overflow-y-auto p-1.5">
					{filteredWorks.length === 0 ? (
						<p className="px-2 py-4 text-center text-xs text-stone-400">Sin resultados</p>
					) : (
						filteredWorks.map((work) => {
							const selected = scope.obraIds.includes(work.id);
							const expanded = expandedObraId === work.id;
							return (
								<div key={work.id}>
									<div
										className={cn(
											"group flex items-center rounded-md transition-colors duration-150",
											selected ? "bg-[#fff1e9]" : "hover:bg-stone-100",
										)}
									>
										<button
											type="button"
											onClick={() => setExpandedObraId(expanded ? null : work.id)}
											aria-label={expanded ? "Contraer carpetas" : "Ver carpetas"}
											className="grid size-7 shrink-0 place-items-center rounded-md text-stone-400 hover:text-stone-600"
										>
											<ChevronRight
												className={cn("size-3.5 transition-transform duration-200", expanded && "rotate-90")}
											/>
										</button>
										<button
											type="button"
											onClick={() => toggleObra(work.id)}
											className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 text-left"
										>
											<span className="truncate text-xs font-medium text-stone-700">{work.label}</span>
											{selected ? <Check className="ml-auto size-3.5 shrink-0 text-[#ff5800]" /> : null}
										</button>
									</div>
									{expanded ? (
										<ObraFolderList obraId={work.id} scope={scope} onToggleFolder={toggleFolder} />
									) : null}
								</div>
							);
						})
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}

export function ScopeChips({
	works,
	scope,
	onScopeChange,
}: {
	works: WorkOption[];
	scope: ChatScope;
	onScopeChange: (scope: ChatScope) => void;
}) {
	if (scope.obraIds.length === 0 && scope.folders.length === 0) return null;
	const labelByObraId = new Map(works.map((work) => [work.id, work.label]));
	return (
		<div className="flex flex-wrap items-center gap-1.5 px-3 pt-2.5">
			{scope.obraIds.map((obraId) => (
				<span
					key={obraId}
					className="inline-flex max-w-56 items-center gap-1.5 rounded-full bg-stone-100 py-1 pl-2.5 pr-1 text-[11px] font-medium text-stone-700"
				>
					<Building2 className="size-3 shrink-0 text-stone-400" />
					<span className="truncate">{labelByObraId.get(obraId) ?? "Obra"}</span>
					<button
						type="button"
						aria-label="Quitar obra"
						onClick={() =>
							onScopeChange({
								obraIds: scope.obraIds.filter((id) => id !== obraId),
								folders: scope.folders.filter((folder) => folder.obraId !== obraId),
							})
						}
						className="grid size-4 place-items-center rounded-full text-stone-400 transition-colors hover:bg-stone-200 hover:text-stone-600"
					>
						<X className="size-3" />
					</button>
				</span>
			))}
			{scope.folders.map((folder) => (
				<span
					key={`${folder.obraId}-${folder.path}`}
					className="inline-flex max-w-56 items-center gap-1.5 rounded-full bg-[#fff1e9] py-1 pl-2.5 pr-1 text-[11px] font-medium text-[#c24300]"
				>
					<Folder className="size-3 shrink-0 text-[#ff5800]" />
					<span className="truncate">{folder.label ?? folder.path}</span>
					<button
						type="button"
						aria-label="Quitar carpeta"
						onClick={() =>
							onScopeChange({
								obraIds: scope.obraIds,
								folders: scope.folders.filter(
									(entry) => !(entry.obraId === folder.obraId && entry.path === folder.path),
								),
							})
						}
						className="grid size-4 place-items-center rounded-full text-[#ff8a4d] transition-colors hover:bg-[#ffe1d1] hover:text-[#c24300]"
					>
						<X className="size-3" />
					</button>
				</span>
			))}
		</div>
	);
}
