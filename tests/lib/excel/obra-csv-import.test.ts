import { File as NodeFile } from "node:buffer";
import { describe, expect, it } from "vitest";

import {
	buildCsvObraUpdates,
	prepareCsvObraImport,
} from "@/app/excel/_components/obra-csv-import";

const makeCsvFile = (content: string, name = "obras.csv") =>
	new NodeFile([content], name, { type: "text/csv" }) as unknown as File;

describe("obra CSV import helpers", () => {
	it("maps single-row aliases, skips incomplete rows, and normalizes updates", async () => {
		const { allValid, importErrors, totalSkipped } = await prepareCsvObraImport([
			makeCsvFile(
				[
					"Designacion;Entidad;Mes Basico;Inicio;Contrato Ampliaciones;Certificado;Porc",
					"Ruta Norte;Municipio;ene-5;5/2/2024;1234,50;500,25;120",
					"Sin entidad;;ene-6;6/2/2024;1;2;3",
				].join("\n"),
			),
		]);

		expect(importErrors).toEqual([]);
		expect(totalSkipped).toBe(1);
		expect(buildCsvObraUpdates(allValid, 7)[0]).toMatchObject({
			n: 8,
			designacionYUbicacion: "Ruta Norte",
			entidadContratante: "Municipio",
			mesBasicoDeContrato: "05/01/2025",
			iniciacion: "05/02/2024",
			contratoMasAmpliaciones: 1234.5,
			certificadoALaFecha: 500.25,
			porcentaje: 100,
		});
	});

	it("maps multi-row grouped headers", async () => {
		const { allValid, importErrors, totalSkipped } = await prepareCsvObraImport([
			makeCsvFile(
				[
					"Designacion y ubicacion;Entidad Contratante;Fechas;Fechas;Importes en pesos a valores basicos;Plazos en meses;%",
					";;Mes Basico;Iniciacion;Contrato mas ampliaciones;Plazo Total;",
					";;de Contrato;;;;",
					"Obra Multi;Provincia;mar-9;1/4/2025;900;18;66",
				].join("\n"),
			),
		]);

		expect(importErrors).toEqual([]);
		expect(totalSkipped).toBe(0);
		expect(buildCsvObraUpdates(allValid, 0)[0]).toMatchObject({
			n: 1,
			designacionYUbicacion: "Obra Multi",
			entidadContratante: "Provincia",
			mesBasicoDeContrato: "09/03/2025",
			iniciacion: "01/04/2025",
			contratoMasAmpliaciones: 900,
			plazoTotal: 18,
			porcentaje: 66,
		});
	});
});
