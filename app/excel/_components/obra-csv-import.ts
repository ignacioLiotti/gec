import { clampPercentage, toNumber, toText } from "./excel-page-format";

export type CsvObra = {
	n?: number | string | null;
	designacionYUbicacion?: string | null;
	supDeObraM2?: number | string | null;
	entidadContratante?: string | null;
	mesBasicoDeContrato?: string | null;
	iniciacion?: string | null;
	contratoMasAmpliaciones?: number | string | null;
	certificadoALaFecha?: number | string | null;
	saldoACertificar?: number | string | null;
	segunContrato?: number | string | null;
	prorrogasAcordadas?: number | string | null;
	plazoTotal?: number | string | null;
	plazoTransc?: number | string | null;
	porcentaje?: number | string | null;
};

type CsvRow = (string | null | undefined)[];
type HeaderAliasMap = Readonly<Record<string, string>>;

export type CsvPreviewRow = CsvObra & { _rowIndex: number };

const CSV_IMPORT_DEFAULT_YEAR = 2025;
const CSV_MONTH_MAP: Record<string, string> = {
	ene: "01",
	feb: "02",
	mar: "03",
	abr: "04",
	may: "05",
	jun: "06",
	jul: "07",
	ago: "08",
	sep: "09",
	set: "09",
	oct: "10",
	nov: "11",
	dic: "12",
};

const HEADER_ALIASES: HeaderAliasMap = {
	n: "n",
	numero: "n",
	nro: "n",
	nobra: "n",
	no: "n",
	designacionyubicacion: "designacionYUbicacion",
	designacionubicacion: "designacionYUbicacion",
	designacion: "designacionYUbicacion",
	ubicacion: "designacionYUbicacion",
	supdeobram2: "supDeObraM2",
	supdeobra: "supDeObraM2",
	superficiedeobra: "supDeObraM2",
	superficiedeobram2: "supDeObraM2",
	entidadcontratante: "entidadContratante",
	entidad: "entidadContratante",
	mesbasicodecontrato: "mesBasicoDeContrato",
	mesbasicocontrato: "mesBasicoDeContrato",
	mesbasico: "mesBasicoDeContrato",
	iniciacion: "iniciacion",
	inicio: "iniciacion",
	fechainiciacion: "iniciacion",
	contratomas: "contratoMasAmpliaciones",
	contratomasampliaciones: "contratoMasAmpliaciones",
	contratoampliaciones: "contratoMasAmpliaciones",
	certificadoalafecha: "certificadoALaFecha",
	certificado: "certificadoALaFecha",
	saldoacertificar: "saldoACertificar",
	seguncontrato: "segunContrato",
	prorrogasacordadas: "prorrogasAcordadas",
	plazototal: "plazoTotal",
	plazotransc: "plazoTransc",
	porcentaje: "porcentaje",
	porc: "porcentaje",
};

const normalizeHeader = (value: string) => {
	const raw = value.trim();
	if (raw.includes("%")) return "porcentaje";
	let normalized = raw
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "");
	const prefixes = ["fechas", "importesenpesosavaloresbasicos", "plazosenmeses"];
	for (const prefix of prefixes) {
		if (normalized.startsWith(prefix)) {
			normalized = normalized.slice(prefix.length);
			break;
		}
	}
	return normalized;
};

const normalizeCsvDateValue = (value: unknown): string => {
	const raw = toText(value);
	if (!raw) return "";

	const fullDate = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (fullDate) {
		const day = fullDate[1].padStart(2, "0");
		const month = fullDate[2].padStart(2, "0");
		return `${day}/${month}/${fullDate[3]}`;
	}

	const monthDay = raw
		.toLowerCase()
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.match(/^([a-z]{3})\.?\s*-\s*(\d{1,2})$/);
	if (monthDay) {
		const month = CSV_MONTH_MAP[monthDay[1]];
		if (month) {
			const day = monthDay[2].padStart(2, "0");
			return `${day}/${month}/${CSV_IMPORT_DEFAULT_YEAR}`;
		}
	}

	return raw;
};

const combineHeaderCells = (rows: CsvRow[], colIndex: number) =>
	rows
		.map((row) => toText(row[colIndex]))
		.filter((value) => value.length > 0)
		.join(" ");

const isMultiRowHeader = (rows: CsvRow[]) => {
	if (rows.length < 3) return false;
	const top = rows[0].map((cell) => normalizeHeader(toText(cell))).join(" ");
	const second = rows[1].map((cell) => normalizeHeader(toText(cell))).join(" ");
	return top.includes("designacionyubicacion") && second.includes("mesbasico");
};

const buildHeaders = (rows: CsvRow[], headerRows: number) => {
	const maxCols = Math.max(...rows.slice(0, headerRows).map((row) => row.length));
	const headers: string[] = [];
	for (let i = 0; i < maxCols; i += 1) {
		headers.push(combineHeaderCells(rows.slice(0, headerRows), i));
	}
	return headers;
};

async function parseCsvFileToValidRows(
	file: File,
): Promise<{ validRows: CsvObra[]; skippedCount: number }> {
	const decodeWithFallback = async () => {
		const buffer = await file.arrayBuffer();
		const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
		const utf8ReplacementCount = (utf8.match(/\uFFFD/g) ?? []).length;
		if (utf8ReplacementCount === 0) return utf8;
		const win1252 = new TextDecoder("windows-1252", { fatal: false }).decode(buffer);
		const winReplacementCount = (win1252.match(/\uFFFD/g) ?? []).length;
		return winReplacementCount < utf8ReplacementCount ? win1252 : utf8;
	};

	const [{ default: Papa }, csvText] = await Promise.all([
		import("papaparse"),
		decodeWithFallback(),
	]);
	const results = Papa.parse<string[]>(csvText, {
		header: false,
		skipEmptyLines: true,
		delimiter: ";",
	});

	if (results.errors.length) {
		throw new Error(results.errors[0]?.message || "No se pudo leer el CSV");
	}

	const rows = results.data as CsvRow[];
	if (!rows.length) {
		throw new Error("El CSV esta vacio");
	}

	const headerRows = isMultiRowHeader(rows) ? 3 : 1;
	const headers = buildHeaders(rows, headerRows);
	const mappedRows = rows
		.slice(headerRows)
		.map((row) => {
			const mapped: Record<string, string> = {};
			headers.forEach((header, index) => {
				if (!header) return;
				const normalized = normalizeHeader(header);
				const mappedKey = HEADER_ALIASES[normalized] ?? normalized;
				mapped[mappedKey] = toText(row[index]);
			});
			return mapped as CsvObra;
		})
		.filter((row) => Object.values(row).some((value) => toText(value).length > 0));

	if (!mappedRows.length) {
		throw new Error("El CSV no contiene filas validas");
	}

	const validRows = mappedRows.filter(
		(row) =>
			toText(row.designacionYUbicacion) &&
			toText(row.entidadContratante) &&
			toText(row.mesBasicoDeContrato) &&
			toText(row.iniciacion),
	);

	if (!validRows.length) {
		throw new Error("No hay filas validas con campos obligatorios");
	}

	return {
		validRows,
		skippedCount: mappedRows.length - validRows.length,
	};
}

export async function prepareCsvObraImport(files: File[]) {
	const allValid: CsvObra[] = [];
	let totalSkipped = 0;
	const importErrors: string[] = [];

	for (const file of files) {
		try {
			const { validRows, skippedCount } = await parseCsvFileToValidRows(file);
			allValid.push(...validRows);
			totalSkipped += skippedCount;
		} catch (err) {
			const message = err instanceof Error ? err.message : "No se pudo leer el archivo";
			importErrors.push(`${file.name}: ${message}`);
		}
	}

	return { allValid, totalSkipped, importErrors };
}

export function buildCsvObraUpdates(rows: CsvObra[], currentMaxN: number) {
	let nextAuto = currentMaxN + 1;
	return rows.map((row) => {
		const finalN = nextAuto;
		nextAuto += 1;
		return {
			n: finalN,
			designacionYUbicacion: toText(row.designacionYUbicacion),
			supDeObraM2: toNumber(row.supDeObraM2),
			entidadContratante: toText(row.entidadContratante),
			mesBasicoDeContrato: normalizeCsvDateValue(row.mesBasicoDeContrato),
			iniciacion: normalizeCsvDateValue(row.iniciacion),
			contratoMasAmpliaciones: toNumber(row.contratoMasAmpliaciones),
			certificadoALaFecha: toNumber(row.certificadoALaFecha),
			saldoACertificar: toNumber(row.saldoACertificar),
			segunContrato: toNumber(row.segunContrato),
			prorrogasAcordadas: toNumber(row.prorrogasAcordadas),
			plazoTotal: toNumber(row.plazoTotal),
			plazoTransc: toNumber(row.plazoTransc),
			porcentaje: clampPercentage(row.porcentaje),
		};
	});
}
