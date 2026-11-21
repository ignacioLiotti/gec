import { expect, type APIRequestContext } from "@playwright/test";
import { z } from "zod";

const TINY_PNG_DATA_URL =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sW7xS0AAAAASUVORK5CYII=";

const recordArrayResponseSchema = z.object({
	rows: z.array(z.record(z.unknown())).optional(),
});

const lineageGraphSchema = z.object({
	nodes: z.array(z.record(z.unknown())).optional(),
	coverage: z
		.object({
			items: z
				.array(z.object({ id: z.string().optional(), status: z.string().optional() }))
				.optional(),
		})
		.optional(),
	summary: z.record(z.unknown()).optional(),
});

export type LineageFixture = {
	obraId: string;
	obraName: string;
	tablaId: string;
	macroTableId: string;
	macroCustomColumnId: string;
	macroSourceColumnId: string;
};

export type OcrMultiLineageFixture = {
	obraId: string;
	obraName: string;
	tablaIds: string[];
};

export type SpreadsheetLineageFixture = {
	obraId: string;
	obraName: string;
	tablaId: string;
};

export async function importOcrStub(
	request: APIRequestContext,
	fixture: LineageFixture,
	args: {
		docKey: string;
		extraction: Record<string, unknown>;
		forceLineageConflict?: boolean;
	},
) {
	return request.post(
		`/api/obras/${fixture.obraId}/tablas/${fixture.tablaId}/import/ocr?skipStorage=1`,
		{
			headers: { "x-e2e-ocr-stub": "true" },
			multipart: {
				imageDataUrl: TINY_PNG_DATA_URL,
				existingBucket: "obra-documents",
				existingPath: `${fixture.obraId}/e2e-lineage/${args.docKey}.png`,
				existingFileName: `${args.docKey}.png`,
				e2eExtractionJson: JSON.stringify(args.extraction),
				...(args.forceLineageConflict
					? { e2eForceLineageConflict: "true" }
					: {}),
			},
		},
	);
}

export async function fetchTablaRows(
	request: APIRequestContext,
	fixture: Pick<LineageFixture, "obraId" | "tablaId">,
) {
	const response = await request.get(
		`/api/obras/${fixture.obraId}/tablas/${fixture.tablaId}/rows`,
	);
	expect(response.ok()).toBeTruthy();
	const payload = recordArrayResponseSchema.parse(await response.json());
	return payload.rows ?? [];
}

export async function fetchMacroRows(
	request: APIRequestContext,
	fixture: Pick<LineageFixture, "macroTableId">,
) {
	const response = await request.get(`/api/macro-tables/${fixture.macroTableId}/rows`);
	expect(response.ok()).toBeTruthy();
	return z.record(z.unknown()).parse(await response.json());
}

export async function saveMacroOverride(
	request: APIRequestContext,
	fixture: Pick<LineageFixture, "macroTableId" | "macroCustomColumnId">,
	rowId: string,
	value: unknown,
) {
	return request.post(`/api/macro-tables/${fixture.macroTableId}/rows`, {
		data: {
			customValues: [
				{
					sourceRowId: rowId,
					columnId: fixture.macroCustomColumnId,
					value,
				},
			],
		},
	});
}

export async function importOcrMultiStub(
	request: APIRequestContext,
	fixture: OcrMultiLineageFixture,
	args: {
		docKey: string;
		extraction: Record<string, unknown>;
		forceLineageConflict?: boolean;
	},
) {
	return request.post(`/api/obras/${fixture.obraId}/tablas/import/ocr-multi?skipStorage=1`, {
		headers: { "x-e2e-ocr-stub": "true" },
		multipart: {
			tablaIds: JSON.stringify(fixture.tablaIds),
			imageDataUrl: TINY_PNG_DATA_URL,
			existingBucket: "obra-documents",
			existingPath: `${fixture.obraId}/e2e-lineage/${args.docKey}.png`,
			existingFileName: `${args.docKey}.png`,
			e2eExtractionJson: JSON.stringify(args.extraction),
			...(args.forceLineageConflict
				? { e2eForceLineageConflict: "true" }
				: {}),
		},
	});
}

export async function importSpreadsheetMultiCsv(
	request: APIRequestContext,
	fixture: SpreadsheetLineageFixture,
	args: { docKey: string; csv: string },
) {
	return request.post(`/api/obras/${fixture.obraId}/tablas/import/spreadsheet-multi`, {
		multipart: {
			tablaIds: JSON.stringify([fixture.tablaId]),
			sheetAssignments: JSON.stringify({ [fixture.tablaId]: "CSV" }),
			columnMappings: JSON.stringify({
				[fixture.tablaId]: {
					cert_id: "cert_id",
					description: "description",
					amount: "amount",
				},
			}),
			manualValues: JSON.stringify({}),
			existingBucket: "obra-documents",
			existingPath: `${fixture.obraId}/e2e-lineage/${args.docKey}.csv`,
			existingFileName: `${args.docKey}.csv`,
			file: {
				name: `${args.docKey}.csv`,
				mimeType: "text/csv",
				buffer: Buffer.from(args.csv, "utf8"),
			},
		},
	});
}

export async function fetchLineageGraph(
	request: APIRequestContext,
	args: { obraId: string; tablaId: string; docPath?: string },
) {
	const search = new URLSearchParams({ tablaId: args.tablaId });
	if (args.docPath) search.set("docPath", args.docPath);
	const response = await request.get(
		`/api/obras/${args.obraId}/lineage-graph?${search.toString()}`,
	);
	expect(response.ok()).toBeTruthy();
	return lineageGraphSchema.parse(await response.json());
}
