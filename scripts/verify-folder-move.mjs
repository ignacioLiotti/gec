import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const DOCUMENTS_BUCKET = "obra-documents";

function loadEnvLocal() {
	const envPath = path.resolve(".env.local");
	if (!fs.existsSync(envPath)) return;
	for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;
		const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
		if (!match) continue;
		const [, key, rawValue] = match;
		if (process.env[key]) continue;
		process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
	}
}

function parseArgs(argv) {
	const args = {};
	for (let index = 0; index < argv.length; index += 1) {
		const token = argv[index];
		if (!token.startsWith("--")) continue;
		const key = token.slice(2);
		const next = argv[index + 1];
		if (!next || next.startsWith("--")) {
			args[key] = "true";
			continue;
		}
		args[key] = next;
		index += 1;
	}
	return args;
}

function normalizePath(value) {
	return String(value ?? "")
		.trim()
		.replace(/\\/g, "/")
		.replace(/^\/+|\/+$/g, "")
		.replace(/\/{2,}/g, "/");
}

function normalizeRelativeFolderPath(value, obraId) {
	const normalized = normalizePath(value);
	const obraPrefix = `${obraId}/`;
	return normalized.startsWith(obraPrefix)
		? normalized.slice(obraPrefix.length)
		: normalized;
}

function prefixVariants(obraId, relativeFolderPath) {
	const relative = normalizePath(relativeFolderPath);
	const full = `${obraId}/${relative}`;
	return {
		relative,
		full,
		relativeLike: `${relative}/%`,
		fullLike: `${full}/%`,
	};
}

async function listStorageObjects(supabase, fullFolderPath) {
	const found = [];
	const queue = [fullFolderPath];
	while (queue.length > 0) {
		const current = queue.shift();
		const { data, error } = await supabase.storage
			.from(DOCUMENTS_BUCKET)
			.list(current, { limit: 1000 });
		if (error) {
			throw new Error(`Storage list failed for ${current}: ${error.message}`);
		}
		for (const item of data ?? []) {
			const childPath = `${current}/${item.name}`.replace(/\/{2,}/g, "/");
			if (!item.metadata) {
				queue.push(childPath);
				continue;
			}
			found.push({
				path: childPath,
				size: typeof item.metadata.size === "number" ? item.metadata.size : null,
			});
		}
	}
	return found;
}

async function countRows(queryBuilder) {
	const { count, error } = await queryBuilder;
	if (error) throw error;
	return count ?? 0;
}

async function countPathReferences(supabase, table, column, oldPrefix, newPrefix) {
	const oldFull = await countRows(
		supabase
			.from(table)
			.select(column, { count: "exact", head: true })
			.like(column, oldPrefix.fullLike),
	);
	const oldExact = await countRows(
		supabase
			.from(table)
			.select(column, { count: "exact", head: true })
			.eq(column, oldPrefix.full),
	);
	const newFull = await countRows(
		supabase
			.from(table)
			.select(column, { count: "exact", head: true })
			.like(column, newPrefix.fullLike),
	);
	const newExact = await countRows(
		supabase
			.from(table)
			.select(column, { count: "exact", head: true })
			.eq(column, newPrefix.full),
	);
	return {
		table,
		column,
		old: oldFull + oldExact,
		new: newFull + newExact,
	};
}

async function countRelativePathReferences(supabase, table, column, oldPrefix, newPrefix) {
	const oldNested = await countRows(
		supabase
			.from(table)
			.select(column, { count: "exact", head: true })
			.like(column, oldPrefix.relativeLike),
	);
	const oldExact = await countRows(
		supabase
			.from(table)
			.select(column, { count: "exact", head: true })
			.eq(column, oldPrefix.relative),
	);
	const newNested = await countRows(
		supabase
			.from(table)
			.select(column, { count: "exact", head: true })
			.like(column, newPrefix.relativeLike),
	);
	const newExact = await countRows(
		supabase
			.from(table)
			.select(column, { count: "exact", head: true })
			.eq(column, newPrefix.relative),
	);
	return {
		table,
		column,
		old: oldNested + oldExact,
		new: newNested + newExact,
	};
}

async function countObraTablaFolderReferences(supabase, obraId, oldPrefix, newPrefix) {
	const { data, error } = await supabase
		.from("obra_tablas")
		.select("id, name, settings")
		.eq("obra_id", obraId);
	if (error) throw error;
	let old = 0;
	let newCount = 0;
	for (const row of data ?? []) {
		const settings = row.settings && typeof row.settings === "object" ? row.settings : {};
		const folder = typeof settings.ocrFolder === "string" ? normalizePath(settings.ocrFolder) : "";
		if (folder === oldPrefix.relative) old += 1;
		if (folder === newPrefix.relative) newCount += 1;
	}
	return { table: "obra_tablas", column: "settings.ocrFolder", old, new: newCount };
}

async function inspectRowDocPaths(supabase, obraId, oldPrefix, newPrefix) {
	const { data: tablas, error: tablasError } = await supabase
		.from("obra_tablas")
		.select("id")
		.eq("obra_id", obraId);
	if (tablasError) throw tablasError;
	const tablaIds = (tablas ?? []).map((row) => row.id).filter(Boolean);
	let old = 0;
	let newCount = 0;
	let scanned = 0;
	for (let index = 0; index < tablaIds.length; index += 100) {
		const chunk = tablaIds.slice(index, index + 100);
		const { data: rows, error: rowsError } = await supabase
			.from("obra_tabla_rows")
			.select("id, data")
			.in("tabla_id", chunk);
		if (rowsError) throw rowsError;
		for (const row of rows ?? []) {
			scanned += 1;
			const data = row.data && typeof row.data === "object" ? row.data : {};
			const docPath = typeof data.__docPath === "string" ? normalizePath(data.__docPath) : "";
			if (docPath === oldPrefix.full || docPath.startsWith(`${oldPrefix.full}/`)) old += 1;
			if (docPath === newPrefix.full || docPath.startsWith(`${newPrefix.full}/`)) newCount += 1;
		}
	}
	return {
		table: "obra_tabla_rows",
		column: "data.__docPath",
		old,
		new: newCount,
		scanned,
	};
}

function printUsageAndExit() {
	console.error(`
Usage:
  pnpm verify:folder-move -- --obra-id <uuid> --old-path <folder> --new-path <folder>

Example:
  pnpm verify:folder-move -- --obra-id 0457f981-449a-473c-9144-d12ba022a642 --old-path carpeta-1/subcarpeta-2 --new-path subcarpeta-2
`);
	process.exit(2);
}

loadEnvLocal();
const args = parseArgs(process.argv.slice(2));
const obraId = args["obra-id"];
const oldPath = args["old-path"];
const newPath = args["new-path"];

if (!obraId || !oldPath || !newPath) {
	printUsageAndExit();
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
	throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
	auth: { persistSession: false },
});

const oldPrefix = prefixVariants(obraId, normalizeRelativeFolderPath(oldPath, obraId));
const newPrefix = prefixVariants(obraId, normalizeRelativeFolderPath(newPath, obraId));

console.log("Verifying folder move");
console.log(`Obra:     ${obraId}`);
console.log(`Old path: ${oldPrefix.relative}`);
console.log(`New path: ${newPrefix.relative}`);
console.log("");

const oldStorageObjects = await listStorageObjects(supabase, oldPrefix.full);
const newStorageObjects = await listStorageObjects(supabase, newPrefix.full);

const referenceChecks = [
	await countPathReferences(supabase, "obra_document_uploads", "storage_path", oldPrefix, newPrefix),
	await countPathReferences(supabase, "ocr_document_processing", "source_path", oldPrefix, newPrefix),
	await countPathReferences(supabase, "aps_models", "file_path", oldPrefix, newPrefix),
	await countPathReferences(supabase, "generated_documents", "storage_path", oldPrefix, newPrefix),
	await countRelativePathReferences(supabase, "generated_documents", "folder_path", oldPrefix, newPrefix),
	await countPathReferences(supabase, "obra_document_deletes", "storage_path", oldPrefix, newPrefix),
	await countPathReferences(supabase, "obra_document_deletes", "root_folder_path", oldPrefix, newPrefix),
	await countObraTablaFolderReferences(supabase, obraId, oldPrefix, newPrefix),
	await inspectRowDocPaths(supabase, obraId, oldPrefix, newPrefix),
];

const oldReferences = referenceChecks.reduce((sum, item) => sum + item.old, 0);
const newReferences = referenceChecks.reduce((sum, item) => sum + item.new, 0);
const failures = [];

if (oldStorageObjects.length > 0) {
	failures.push(`Storage still has ${oldStorageObjects.length} object(s) under old path.`);
}
if (oldReferences > 0) {
	failures.push(`Database still has ${oldReferences} reference(s) to old path.`);
}
if (newStorageObjects.length === 0 && newReferences > 0) {
	failures.push("Database points to new path, but Storage has no objects under new path.");
}

console.table([
	{ area: "storage.objects/files", old: oldStorageObjects.length, new: newStorageObjects.length },
	...referenceChecks.map((check) => ({
		area: `${check.table}.${check.column}`,
		old: check.old,
		new: check.new,
	})),
]);

if (oldStorageObjects.length > 0) {
	console.log("\nOld storage samples:");
	for (const item of oldStorageObjects.slice(0, 10)) {
		console.log(`- ${item.path}`);
	}
}

if (newStorageObjects.length > 0) {
	console.log("\nNew storage samples:");
	for (const item of newStorageObjects.slice(0, 10)) {
		console.log(`- ${item.path}`);
	}
}

if (failures.length > 0) {
	console.error("\nMove verification failed:");
	for (const failure of failures) {
		console.error(`- ${failure}`);
	}
	process.exit(1);
}

console.log("\nMove verification passed: old path is clean and new path has coherent references.");
