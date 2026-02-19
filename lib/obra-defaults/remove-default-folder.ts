import type { SupabaseClient } from "@supabase/supabase-js";

type RemoveDefaultFolderParams = {
	tenantId: string;
	folderPath: string;
	defaultTablaIds?: string[];
};

function normalizeFolderPath(value: string): string {
	return value
		.split("/")
		.map((segment) => segment.trim())
		.filter(Boolean)
		.join("/");
}

async function listFolderFilesRecursive(
	supabase: SupabaseClient,
	basePath: string,
): Promise<string[]> {
	const bucket = "obra-documents";
	const toScan = [basePath];
	const files: string[] = [];

	while (toScan.length > 0) {
		const current = toScan.shift()!;
		const { data, error } = await supabase.storage
			.from(bucket)
			.list(current, { limit: 1000 });
		if (error) throw error;

		for (const entry of data ?? []) {
			const fullPath = `${current}/${entry.name}`;
			// In Storage list responses, folders usually have null metadata.
			if (!entry.metadata) {
				toScan.push(fullPath);
				continue;
			}
			files.push(fullPath);
		}
	}

	return files;
}

export async function removeDefaultFolderFromExistingObras(
	supabase: SupabaseClient,
	params: RemoveDefaultFolderParams,
) {
	const normalizedPath = normalizeFolderPath(params.folderPath);
	if (!normalizedPath) return { ok: true, removedTablas: 0, removedFiles: 0 } as const;

	const { data: obras, error: obrasError } = await supabase
		.from("obras")
		.select("id")
		.eq("tenant_id", params.tenantId);
	if (obrasError) throw obrasError;

	const obraIds = (obras ?? [])
		.map((row) => (row as { id?: string }).id)
		.filter((id): id is string => typeof id === "string" && id.length > 0);

	let removedTablas = 0;
	let removedFiles = 0;
	const defaultTablaIdSet = new Set((params.defaultTablaIds ?? []).filter(Boolean));

	for (const obraId of obraIds) {
		const { data: tablas, error: tablasError } = await supabase
			.from("obra_tablas")
			.select("id, settings")
			.eq("obra_id", obraId);
		if (tablasError) throw tablasError;

		const tablaIdsToDelete = (tablas ?? [])
			.filter((tabla) => {
				const settings = ((tabla as any)?.settings ?? {}) as Record<string, unknown>;
				const ocrFolder =
					typeof settings.ocrFolder === "string"
						? normalizeFolderPath(settings.ocrFolder)
						: null;
				const defaultTablaId =
					typeof settings.defaultTablaId === "string" ? settings.defaultTablaId : null;

				const matchesFolder =
					ocrFolder === normalizedPath ||
					(ocrFolder != null && ocrFolder.startsWith(`${normalizedPath}/`));
				const matchesDefaultTabla =
					defaultTablaId != null && defaultTablaIdSet.has(defaultTablaId);
				return matchesFolder || matchesDefaultTabla;
			})
			.map((tabla) => (tabla as any).id as string)
			.filter((id) => typeof id === "string" && id.length > 0);

		if (tablaIdsToDelete.length > 0) {
			await supabase
				.from("ocr_document_processing")
				.delete()
				.eq("obra_id", obraId)
				.in("tabla_id", tablaIdsToDelete);

			const { error: deleteTablasError } = await supabase
				.from("obra_tablas")
				.delete()
				.eq("obra_id", obraId)
				.in("id", tablaIdsToDelete);
			if (deleteTablasError) throw deleteTablasError;
			removedTablas += tablaIdsToDelete.length;
		}

		const storageFolderPath = `${obraId}/${normalizedPath}`;
		const files = await listFolderFilesRecursive(supabase, storageFolderPath);
		if (files.length > 0) {
			const { error: deleteFilesError } = await supabase.storage
				.from("obra-documents")
				.remove(files);
			if (deleteFilesError) throw deleteFilesError;
			removedFiles += files.length;
		}
	}

	return { ok: true, removedTablas, removedFiles } as const;
}
