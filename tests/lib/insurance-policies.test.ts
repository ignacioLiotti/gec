import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { parseInsurancePoliciesWorkbook } from "@/lib/insurance-policies";

function workbookBuffer(rows: unknown[][]): ArrayBuffer {
	const workbook = XLSX.utils.book_new();
	const sheet = XLSX.utils.aoa_to_sheet(rows);
	XLSX.utils.book_append_sheet(workbook, sheet, "PolizasVigentesProductor");
	const output = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
	return Uint8Array.from(output).buffer;
}

describe("parseInsurancePoliciesWorkbook", () => {
	it("imports producer policy lists grouped by policyholder", async () => {
		const buffer = workbookBuffer([
			["", "", "", "", "", ""],
			["", "", "- Listado de Pólizas Vigentes por Tomador al 18-06-2026 -", "", "", ""],
			["", "", "", "", "", ""],
			["", "", "Productor:  91914 - PRODUCTOR DIRECTO CORRIENTES", "", "", ""],
			["", "", "", "", "", ""],
			["", "", "", "", "", ""],
			[
				"Tomador",
				"",
				"",
				"Seccion",
				" Poliza",
				"Vigencia",
				"Sum.Aseg.",
				"Mon",
				"Prima",
				"Premio",
				"Saldo",
				"Saldo $",
				"Estado",
				"Riesgo",
				"Objeto del Seguro",
			],
			["CONCRET LIBRES S.A. (64810)", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
			[
				"",
				"",
				"",
				"Caucion",
				"313584 / 19",
				"04/08/2021 - 04/08/2026",
				298046,
				"$",
				1500,
				1854,
				20657.02,
				20657.02,
				"Vigente",
				"Ob.Pub.Sustitucion Fondo Reparo $298.046,00",
				'ADJUDICACION DIRECTA. OBRA: "REFACCION GENERAL Y READECUACION DEL C.I.C. - LA CRUZ". UBICACION: LOCALIDAD DE LA CRUZ',
			],
			["", "", "", "Total Tomador", "", "", "", "", "", "", "", 20657.02, "", "", ""],
			["Total General", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
		]);

		const parsed = await parseInsurancePoliciesWorkbook(buffer, [], { sourceFileName: "polizas.xlsx" });

		expect(parsed.errors).toEqual([]);
		expect(parsed.rows).toHaveLength(1);
		expect(parsed.rows[0]).toMatchObject({
			sourceFormat: "policy_master",
			sourceFileName: "polizas.xlsx",
			sourceCutoffDate: "2026-06-18",
			policyNumber: "313584 / 19",
			section: "Caucion",
			coveragePeriod: "04/08/2021 - 04/08/2026",
			endDate: "2026-08-04",
			insuredAmount: 298046,
			currency: "$",
			premium: 1500,
			prize: 1854,
			balance: 20657.02,
			status: "Vigente",
		});
		expect(parsed.rows[0]?.notes).toContain("Tomador: CONCRET LIBRES S.A. (64810)");
	});
});
