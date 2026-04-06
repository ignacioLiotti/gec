import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_TENANT_NAME = "Codex Demo Tenant Smoke";
const DOCUMENTS_BUCKET = "obra-documents";

const CERTIFICADO_ROWS = [
	{
		nro_certificado: "1",
		periodo: "enero de 2026",
		fecha_certificacion: "27/01/2026",
		monto_certificado: 18650000,
		monto_acumulado: 77110000,
		avance_fisico_acumulado_pct: 12,
		n_expediente: "EXP-2026-014",
	},
	{
		nro_certificado: "2",
		periodo: "febrero de 2026",
		fecha_certificacion: "28/02/2026",
		monto_certificado: 22100000,
		monto_acumulado: 99210000,
		avance_fisico_acumulado_pct: 24,
		n_expediente: "EXP-2026-014",
	},
	{
		nro_certificado: "3",
		periodo: "marzo de 2026",
		fecha_certificacion: "28/03/2026",
		monto_certificado: 14000000,
		monto_acumulado: 44000000,
		avance_fisico_acumulado_pct: 34,
		n_expediente: "EXP-9068/2026",
	},
];

function parseEnvFile(filePath) {
	if (!fs.existsSync(filePath)) return;
	const content = fs.readFileSync(filePath, "utf8");
	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;
		const separatorIndex = line.indexOf("=");
		if (separatorIndex === -1) continue;
		const key = line.slice(0, separatorIndex).trim();
		if (!key || process.env[key] !== undefined) continue;
		let value = line.slice(separatorIndex + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		process.env[key] = value;
	}
}

function loadEnvFiles() {
	const root = process.cwd();
	parseEnvFile(path.join(root, ".env.local"));
	parseEnvFile(path.join(root, ".env"));
}

function getVersionedSecret(baseKey) {
	const activeVersion = process.env[`${baseKey}_VERSION`];
	if (activeVersion) {
		return process.env[`${baseKey}_V${activeVersion}`];
	}
	return process.env[baseKey];
}

function parseArgs(argv) {
	const args = {};
	for (let index = 0; index < argv.length; index += 1) {
		const current = argv[index];
		if (!current.startsWith("--")) continue;
		const key = current.slice(2);
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

function isDemoTenantRecord(tenant) {
	const demoSettings =
		tenant?.demo_settings && typeof tenant.demo_settings === "object"
			? tenant.demo_settings
			: {};
	return demoSettings?.isDemo === true || typeof tenant?.demo_slug === "string";
}

function assertDemoTenantRecord(tenant, args) {
	if (isDemoTenantRecord(tenant)) return;
	if (args["allow-non-demo"] === "true") return;
	throw new Error(
		`Refusing to modify tenant "${tenant.name}" because it is not marked as a demo tenant. ` +
			`Set tenants.demo_settings.isDemo=true or rerun with --allow-non-demo if this is intentional.`
	);
}

function buildHistoricalCertCsv(rows) {
	const header =
		"periodo,nro_certificado,fecha_certificacion,monto_certificado,avance_fisico_acumulado_pct,monto_acumulado,n_expediente";
	return [
		header,
		...rows.map((row) =>
			[
				row.periodo,
				row.nro_certificado,
				row.fecha_certificacion,
				row.monto_certificado,
				row.avance_fisico_acumulado_pct,
				row.monto_acumulado,
				row.n_expediente,
			].join(",")
		),
	].join("\n");
}

async function main() {
	loadEnvFiles();
	const args = parseArgs(process.argv.slice(2));
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceRoleKey = getVersionedSecret("SUPABASE_SERVICE_ROLE_KEY");
	if (!url || !serviceRoleKey) {
		throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
	}

	const targetTenantName =
		typeof args.tenant === "string" && args.tenant.trim()
			? args.tenant.trim()
			: DEFAULT_TENANT_NAME;

	const adminClient = createClient(url, serviceRoleKey, {
		auth: {
			autoRefreshToken: false,
			persistSession: false,
		},
	});

	const { data: tenant, error: tenantError } = await adminClient
		.from("tenants")
		.select("id, name, demo_slug, demo_settings")
		.eq("name", targetTenantName)
		.single();
	if (tenantError || !tenant) {
		throw tenantError ?? new Error(`Tenant "${targetTenantName}" not found.`);
	}
	assertDemoTenantRecord(tenant, args);

	const { data: firstObra, error: obraError } = await adminClient
		.from("obras")
		.select("id, n, designacion_y_ubicacion")
		.eq("tenant_id", tenant.id)
		.order("n", { ascending: true })
		.limit(1)
		.single();
	if (obraError || !firstObra) {
		throw obraError ?? new Error("No obra found in template tenant.");
	}

	const { data: tablas, error: tablasError } = await adminClient
		.from("obra_tablas")
		.select("id, name, settings")
		.eq("obra_id", firstObra.id);
	if (tablasError) throw tablasError;

	const pmcResumen =
		(tablas ?? []).find((tabla) => tabla.name === "Certificados - PMC Resumen") ?? null;
	if (!pmcResumen) {
		throw new Error("PMC Resumen table not found for first obra.");
	}

	const historicalStoragePath = `${firstObra.id}/certificados/certificado-2026-03.csv`;
	const screenshotStoragePath =
		`${firstObra.id}/certificados/Captura-de-pantalla-2026-04-04-234505.png`;

	const { data: existingRows, error: rowsError } = await adminClient
		.from("obra_tabla_rows")
		.select("id, data")
		.eq("tabla_id", pmcResumen.id)
		.order("created_at", { ascending: true });
	if (rowsError) throw rowsError;

	const rowByCertificate = new Map(
		(existingRows ?? []).map((row) => [String(row.data?.nro_certificado ?? ""), row.id])
	);

	for (const row of CERTIFICADO_ROWS) {
		const rowId = rowByCertificate.get(row.nro_certificado);
		const payload = {
			data: {
				...row,
				__docPath:
					row.nro_certificado === "3"
						? screenshotStoragePath
						: historicalStoragePath,
				__docFileName:
					row.nro_certificado === "3"
						? "captura-de-pantalla-2026-04-04-234505.png"
						: "certificado-2026-03.csv",
			},
		};
		if (rowId) {
			const { error } = await adminClient
				.from("obra_tabla_rows")
				.update(payload)
				.eq("id", rowId);
			if (error) throw error;
			continue;
		}
		const { error } = await adminClient.from("obra_tabla_rows").insert({
			tabla_id: pmcResumen.id,
			source: "seed-template",
			...payload,
		});
		if (error) throw error;
	}

	const staleRowIds = (existingRows ?? [])
		.filter((row) => !CERTIFICADO_ROWS.some((item) => item.nro_certificado === String(row.data?.nro_certificado ?? "")))
		.map((row) => row.id);
	if (staleRowIds.length > 0) {
		const { error } = await adminClient.from("obra_tabla_rows").delete().in("id", staleRowIds);
		if (error) throw error;
	}

	const { error: uploadCsvError } = await adminClient.storage
		.from(DOCUMENTS_BUCKET)
		.upload(historicalStoragePath, new Blob([buildHistoricalCertCsv(CERTIFICADO_ROWS.slice(0, 2))], { type: "text/csv" }), {
			upsert: true,
		});
	if (uploadCsvError) throw uploadCsvError;

	const curveTabla =
		(tablas ?? []).find((tabla) => {
			const settings =
				tabla.settings && typeof tabla.settings === "object" ? tabla.settings : {};
			return settings.ocrFolder === "curva-de-avance";
		}) ?? null;

	const { error: ruleConfigError } = await adminClient.from("obra_rule_config").upsert(
		{
			tenant_id: tenant.id,
			obra_id: firstObra.id,
			config_json: {
				enabledPacks: {
					curve: true,
					unpaidCerts: false,
					inactivity: false,
					monthlyMissingCert: true,
					stageStalled: false,
				},
				mappings: {
					curve: {
						planTableId: curveTabla?.id ?? null,
						resumenTableId: pmcResumen.id,
						actualPctColumnKey: "avance_fisico_acumulado_pct",
						plan: {
							mode: "linear",
							months: 6,
							startPeriod: "2025-12",
						},
					},
					monthlyMissingCert: {
						certTableId: pmcResumen.id,
						certIssuedAtColumnKey: "fecha_certificacion",
					},
				},
				thresholds: {
					curve: { warnBelow: 10, criticalBelow: 20 },
					unpaidCerts: { severity: "warn" },
					inactivity: { severity: "warn" },
					monthlyMissingCert: { severity: "warn" },
					stageStalled: { severity: "warn" },
				},
			},
			updated_at: new Date().toISOString(),
		},
		{ onConflict: "tenant_id,obra_id" }
	);
	if (ruleConfigError) throw ruleConfigError;

	console.log(
		JSON.stringify(
			{
				tenantId: tenant.id,
				tenantName: tenant.name,
				obraId: firstObra.id,
				obra: firstObra.designacion_y_ubicacion,
				pmcResumenTableId: pmcResumen.id,
				historicalStoragePath,
				updatedRows: CERTIFICADO_ROWS.map((row) => ({
					nro: row.nro_certificado,
					periodo: row.periodo,
					fecha: row.fecha_certificacion,
				})),
			},
			null,
			2
		)
	);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
