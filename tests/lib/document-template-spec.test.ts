import { describe, expect, it } from "vitest";

import { analyzeDocumentFormula, evaluateDocumentFormula } from "@/lib/document-formula";
import {
	applyTemplateFormulaInputData,
	applyTemplateReferenceInputData,
	renderDocumentHtml,
	validateTemplateInput,
	validateTemplateReferences,
	type ReferenceRecord,
} from "@/lib/document-generation";
import {
	buildSpecSampleInput,
	compileTemplateSpec,
	EXAMPLE_TEMPLATE_SPEC,
	readTemplateSpec,
	validateTemplateSpec,
	type ReferenceSourceDescriptor,
	type TemplateSpec,
} from "@/lib/document-template-spec";

const catalog: ReferenceSourceDescriptor[] = [
	{
		key: "usuarios",
		label: "Usuarios",
		group: "app",
		description: "",
		display: "nombre",
		requiresWork: false,
		attributes: [
			{ key: "nombre", label: "Nombre" },
			{ key: "email", label: "Email" },
		],
	},
	{
		key: "documento:PURCHASE_ORDER",
		label: "Orden de compra",
		group: "documento",
		description: "",
		display: "label",
		requiresWork: true,
		attributes: [
			{ key: "label", label: "Documento" },
			{ key: "proveedor", label: "Proveedor" },
			{
				key: "items",
				label: "Ítems",
				type: "rows",
				columns: [
					{ key: "descripcion", label: "Descripción" },
					{ key: "cantidad", label: "Cantidad" },
					{ key: "precio_unitario", label: "Precio" },
				],
			},
		],
	},
];

describe("document formulas", () => {
	it("evaluates row arithmetic, aggregates, rounding and conditions", () => {
		expect(evaluateDocumentFormula("[cantidad] * [precio]", { cantidad: "3", precio: "2,5" }).value).toBe(7.5);
		expect(evaluateDocumentFormula("SUMA(items.total)", { items: [{ total: 10 }, { total: "5" }, {}] }).value).toBe(15);
		expect(evaluateDocumentFormula("REDONDEAR([a] * 0.21; 2)", { a: 100.05 }).value).toBe(21.01);
		expect(evaluateDocumentFormula("SI([a] > 10; 1; 2)", { a: 11 }).value).toBe(1);
		expect(evaluateDocumentFormula("[a] + 0,5", { a: 1 }).value).toBe(1.5);
	});

	it("leaves the result empty while a referenced field is missing", () => {
		expect(evaluateDocumentFormula("[a] * [b]", { a: 2 })).toEqual({ value: null, error: null, missing: ["b"] });
	});

	it("rejects code and columns outside aggregates without executing anything", () => {
		expect(evaluateDocumentFormula("constructor.constructor('x')()", {}).error).not.toBeNull();
		expect(analyzeDocumentFormula("items.total * 2").ok).toBe(false);
		expect(analyzeDocumentFormula("alert(1)").error).toContain("no es una función");
	});
});

describe("template spec", () => {
	it("accepts the published example against a matching catalog", () => {
		const result = validateTemplateSpec(EXAMPLE_TEMPLATE_SPEC, catalog);
		expect(result.errors).toEqual([]);
		expect(result.ok).toBe(true);
	});

	it("reports errors by path with a fix hint", () => {
		const broken = structuredClone(EXAMPLE_TEMPLATE_SPEC) as TemplateSpec;
		const fields = broken.sections[1];
		if (fields.kind !== "fields") throw new Error("fixture");
		fields.fields[3] = { ...fields.fields[3], reference: { source: "clientes", display: "nombre" } };
		fields.fields[4] = { ...fields.fields[4], lookup: { from: "estado_carga", attribute: "email" } };
		const table = broken.sections[2];
		if (table.kind !== "table") throw new Error("fixture");
		table.columns[4] = { ...table.columns[4], formula: "[cantidad] * [precio]" };

		const result = validateTemplateSpec(broken, catalog);
		expect(result.ok).toBe(false);
		expect(result.errors.map((issue) => issue.path)).toEqual([
			"sections[1].fields[3].reference.source",
			"sections[1].fields[4].lookup.from",
			"sections[2].columns[4].formula",
		]);
		expect(result.errors[0].message).toContain("usuarios");
	});

	it("rejects duplicate keys and unknown kinds", () => {
		const result = validateTemplateSpec(
			{
				version: 1,
				name: "X",
				documentType: "X",
				sections: [
					{ kind: "fields", fields: [{ key: "a", label: "A", type: "text" }, { key: "a", label: "B", type: "text" }] },
					{ kind: "chart" },
				],
			},
			catalog,
		);
		expect(result.errors.map((issue) => issue.message)).toEqual([
			'La key "a" está repetida.',
			"kind debe ser header, fields, table, totals, text o signatures.",
		]);
	});

	it("lets only the numbering field use the file-name number aliases", () => {
		const spec = (auto?: "sequence") => ({
			version: 1,
			name: "OC",
			documentType: "OC",
			sections: [{ kind: "header", fields: [{ key: "nro", label: "Nro", type: "text", ...(auto ? { auto } : {}) }] }],
		});
		expect(validateTemplateSpec(spec("sequence")).ok).toBe(true);
		expect(validateTemplateSpec(spec()).errors[0].path).toBe("sections[0].fields[0].key");
	});

	it("compiles to a schema and HTML that render and compute", () => {
		const compiled = compileTemplateSpec(EXAMPLE_TEMPLATE_SPEC);
		expect(compiled.documentType).toBe("RECEPCION_MATERIALES");
		expect(compiled.schema.documentNumberFieldKey).toBe("numero");
		const items = compiled.schema.fields.find((field) => field.key === "items");
		expect(items?.type).toBe("table");
		expect(items?.columns?.find((column) => column.key === "precio_total")?.formula).toBe("[cantidad] * [precio_unitario]");

		const data = applyTemplateFormulaInputData(compiled.schema, {
			numero: "7",
			items: [
				{ descripcion: "Cemento", cantidad: "120", precio_unitario: "9800" },
				{ descripcion: "Arena", cantidad: "6", precio_unitario: "38500" },
			],
		});
		expect(data.subtotal).toBe(1407000);
		expect(data.iva).toBe(295470);
		expect(data.total).toBe(1702470);

		const html = renderDocumentHtml(compiled.contentHtml, data);
		expect(html).toContain("REC-7");
		expect(html).toContain("$ 1.702.470,00");
		expect(html).toContain("Cemento");
		expect(html).not.toContain("{{");
	});

	it("round-trips the spec through the stored schema", () => {
		const compiled = compileTemplateSpec(EXAMPLE_TEMPLATE_SPEC);
		const { spec, derived } = readTemplateSpec({ ...compiled, schema: compiled.schema });
		expect(derived).toBe(false);
		expect(spec).toEqual(EXAMPLE_TEMPLATE_SPEC);
	});

	it("derives a spec from a template created without one", () => {
		const { spec, derived } = readTemplateSpec({
			name: "OC",
			documentType: "PURCHASE_ORDER",
			schema: {
				fields: [
					{ key: "numero", label: "Número", type: "text", required: true, autoPopulate: "next_sequence_number" },
					{ key: "proveedor", label: "Proveedor", type: "text", required: true },
					{ key: "items", label: "Ítems", type: "table", required: false, columns: [{ key: "cantidad", label: "Cantidad", type: "number", required: false }] },
				],
			},
		});
		expect(derived).toBe(true);
		expect(validateTemplateSpec(spec).ok).toBe(true);
		expect(spec.sections.map((section) => section.kind)).toEqual(["header", "fields", "table"]);
	});

	it("builds sample input that previews every section", () => {
		const compiled = compileTemplateSpec(EXAMPLE_TEMPLATE_SPEC);
		const sample = applyTemplateFormulaInputData(compiled.schema, buildSpecSampleInput(EXAMPLE_TEMPLATE_SPEC));
		expect(Array.isArray(sample.items)).toBe(true);
		expect(typeof sample.total).toBe("number");
	});
});

describe("reference fields", () => {
	const compiled = compileTemplateSpec(EXAMPLE_TEMPLATE_SPEC);
	const records: Record<string, ReferenceRecord[]> = {
		usuarios: [
			{ id: "u1", label: "Lucía Fernández", values: { nombre: "Lucía Fernández", email: "lucia@example.com" } },
			{ id: "u2", label: "Diego Paz", values: { nombre: "Diego Paz", email: "diego@example.com" } },
		],
		"documento:PURCHASE_ORDER": [
			{
				id: "oc-1",
				label: "OC 142",
				values: {
					label: "OC 142",
					proveedor: "Corralón El Sol",
					items: [
						{ descripcion: "Cemento", cantidad: 120, precio_unitario: 9800 },
						{ descripcion: "Arena", cantidad: 8, precio_unitario: 38500 },
					],
				},
			},
		],
	};

	it("fills lookups from the chosen record and identifies it by match attribute", () => {
		const byName = applyTemplateReferenceInputData(compiled.schema, { responsable: "Diego Paz" }, records);
		expect(byName.responsable_email).toBe("diego@example.com");
		expect(byName.__refs).toEqual({ responsable: "u2" });

		const byEmail = applyTemplateReferenceInputData(compiled.schema, { responsable: "lucia@example.com" }, records);
		expect(byEmail.responsable).toBe("Lucía Fernández");
		expect(byEmail.responsable_email).toBe("lucia@example.com");

		const cleared = applyTemplateReferenceInputData(compiled.schema, { ...byEmail, responsable: "" }, records);
		expect(cleared.responsable_email).toBe("");
		expect(cleared.__refs).toBeUndefined();
	});

	it("copies mapped values once, when the linked document changes", () => {
		const linked = applyTemplateReferenceInputData(compiled.schema, { orden_compra: "OC 142" }, records);
		expect(linked.proveedor).toBe("Corralón El Sol");
		expect(linked.items).toEqual([
			{ descripcion: "Cemento", cantidad_pedida: 120, cantidad: "", precio_unitario: 9800, precio_total: "" },
			{ descripcion: "Arena", cantidad_pedida: 8, cantidad: "", precio_unitario: 38500, precio_total: "" },
		]);

		const edited = { ...linked, items: [{ ...(linked.items as Record<string, unknown>[])[0], cantidad: "100" }] };
		const again = applyTemplateReferenceInputData(compiled.schema, edited, records);
		expect(again.items).toEqual(edited.items);

		const computed = applyTemplateFormulaInputData(compiled.schema, again);
		expect(computed.subtotal).toBe(980000);
	});

	it("rejects reference values that match no record", () => {
		const unknown = applyTemplateReferenceInputData(compiled.schema, { responsable: "Alguien" }, records);
		expect(validateTemplateReferences(compiled.schema, unknown, records)).toEqual([
			{ key: "responsable", message: "Recibió debe elegirse de la lista." },
		]);
		const known = applyTemplateReferenceInputData(compiled.schema, { responsable: "Diego Paz" }, records);
		expect(validateTemplateReferences(compiled.schema, known, records)).toEqual([]);
		expect(validateTemplateReferences(compiled.schema, unknown, {})).toEqual([]);
	});

	it("keeps lookups out of required validation", () => {
		const errors = validateTemplateInput(compiled.schema, { responsable: "Diego Paz" });
		expect(errors.map((error) => error.key)).not.toContain("responsable_email");
	});
});
