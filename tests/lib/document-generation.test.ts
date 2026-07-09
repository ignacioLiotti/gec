import { describe, expect, it } from "vitest";

import {
  applyDocumentAiContextInputData,
  applyTemplateFormulaInputData,
  applyTemplateAliasInputData,
  buildDocumentGenerationExtractionRows,
  buildInitialInputData,
  formatDocumentTypeLabel,
  getTemplateNextSequenceNumber,
  normalizeDocumentType,
  normalizeTemplateSchema,
  parseTemplateSequenceNumber,
  refreshTemplateSequenceInputData,
  renderDocumentHtml,
  validateTemplateInput,
} from "@/lib/document-generation";

describe("document-generation helpers", () => {
  it("normalizes tenant document types and legacy labels", () => {
    expect(normalizeDocumentType("contrato marco")).toBe("CONTRATO_MARCO");
    expect(normalizeDocumentType("facturas")).toBe("INVOICE");
    expect(normalizeDocumentType("remito")).toBe("DELIVERY_NOTE");
    expect(formatDocumentTypeLabel("CONTRATO_MARCO")).toBe("Contrato Marco");
  });

  it("computes formula fields when all referenced values are present", () => {
    const schema = normalizeTemplateSchema({
      fields: [
        { key: "amount", label: "Monto periodo", type: "money", required: true },
        { key: "accumulatedAmount", label: "Monto acumulado", type: "money", required: true },
        {
          key: "monto_acumulado_anterior",
          label: "Monto acumulado anterior",
          type: "money",
          required: false,
          formula: "[accumulatedAmount] - [amount]",
        },
      ],
    });

    expect(applyTemplateFormulaInputData(schema, { amount: 250, accumulatedAmount: 1000 })).toMatchObject({
      monto_acumulado_anterior: 750,
    });
    expect(applyTemplateFormulaInputData(schema, { amount: 250 })).not.toHaveProperty("monto_acumulado_anterior");
  });

  it("hydrates default values from schema", () => {
    const schema = normalizeTemplateSchema({
      fields: [
        { key: "title", label: "Titulo", type: "text", required: true, defaultValue: "Certificado" },
        { key: "notes", label: "Notas", type: "textarea", required: false },
      ],
    });

    expect(buildInitialInputData(schema)).toEqual({
      title: "Certificado",
    });
  });

  it("computes the next folder sequence from existing document input data", () => {
    const schema = normalizeTemplateSchema({
      fields: [
        { key: "nro", label: "Nro", type: "text", required: true, autoPopulate: "next_sequence_number" },
      ],
    });

    expect(parseTemplateSequenceNumber("OC-009")).toBe(9);
    expect(getTemplateNextSequenceNumber(schema, [{ nro: "1" }, { nro: "OC-009" }], 2)).toBe(10);
    expect(getTemplateNextSequenceNumber(schema, [{ nro: "2" }], 5)).toBe(6);
    expect(getTemplateNextSequenceNumber(schema, [{ otro: "sin nro" }], 3)).toBe(4);
  });

  it("refreshes stale auto sequence values without lowering manual future values", () => {
    const schema = normalizeTemplateSchema({
      fields: [
        { key: "nro", label: "Nro", type: "text", required: true, autoPopulate: "next_sequence_number" },
        { key: "detalle", label: "Detalle", type: "text", required: false },
      ],
    });

    expect(refreshTemplateSequenceInputData(schema, { nro: "1", detalle: "manual" }, 2)).toEqual({
      nro: "2",
      detalle: "manual",
    });
    expect(refreshTemplateSequenceInputData(schema, { nro: "5" }, 2)).toEqual({ nro: "5" });
  });

  it("validates required fields", () => {
    const schema = normalizeTemplateSchema({
      fields: [
        { key: "title", label: "Titulo", type: "text", required: true },
        { key: "amount", label: "Monto", type: "money", required: true },
      ],
    });

    expect(validateTemplateInput(schema, { title: "", amount: "abc" })).toEqual([
      { key: "title", message: "Titulo es obligatorio." },
      { key: "amount", message: "Monto debe ser numerico." },
    ]);
  });

  it("hydrates duplicated template aliases before validation", () => {
    const schema = normalizeTemplateSchema({
      fields: [
        { key: "proveedor", label: "Proveedor", type: "text", required: false },
        { key: "supplier", label: "Proveedor", type: "text", required: true },
        { key: "empresa_solicita", label: "Solicitante", type: "text", required: false },
        { key: "requester", label: "Solicitante", type: "text", required: true },
        { key: "detail", label: "Detalle", type: "textarea", required: true },
        { key: "total_orden", label: "Total Orden", type: "money", required: false },
        { key: "total", label: "Total", type: "money", required: true },
        {
          key: "items",
          label: "Items",
          type: "table",
          required: true,
          columns: [
            { key: "detalle", label: "Detalle", type: "text", required: false },
            { key: "precio_total", label: "Precio Total", type: "money", required: false },
          ],
        },
      ],
    });

    const inputData = applyTemplateAliasInputData(schema, {
      proveedor: "Acme SA",
      empresa_solicita: "Ignacio Blanco",
      total_orden: "213121233",
      items: [{ detalle: "Hormigon" }, { detalle: "Arena" }],
    });

    expect(inputData).toMatchObject({
      supplier: "Acme SA",
      requester: "Ignacio Blanco",
      total: "213121233",
      detail: "Hormigon; Arena",
    });
    expect(validateTemplateInput(schema, inputData)).toEqual([]);
  });

  it("renders placeholders with html escaping", () => {
    const html = renderDocumentHtml("<h1>{{title}}</h1><p>{{workName}}</p>", {
      title: "<script>alert(1)</script>",
    }, {
      workName: "Obra 10",
    });

    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("Obra 10");
  });

  it("renders repeatable groups as html blocks", () => {
    const html = renderDocumentHtml(
      "<table>{{#items}}<tr><td>{{cantidad}}</td><td>{{detalle}}</td></tr>{{/items}}</table>",
      {
        items: [
          { cantidad: "2", detalle: "MDF" },
          { cantidad: "1", detalle: "<b>Corte</b>" },
        ],
      },
    );

    expect(html).toContain("<td>2</td><td>MDF</td>");
    expect(html).toContain("<td>1</td><td>&lt;b&gt;Corte&lt;/b&gt;</td>");
  });

  it("overrides oc template font size from the wrapper scale", () => {
    const html = renderDocumentHtml(
      '<div class="oc" style="--oc-font-size: 8.5px;"><style>.oc{font-size:1em}.oc .title{font-size:2em}</style><p>{{title}}</p></div>',
      { title: "Orden" },
    );

    expect(html).toContain("data-document-generation-oc-font-scale");
    expect(html).toContain("--oc-font-size: var(--document-oc-font-size");
    expect(html).toContain("font-size: var(--oc-font-size)");
    expect(html).toContain("!important");
  });

  it("hydrates and validates table fields with configured columns", () => {
    const schema = normalizeTemplateSchema({
      fields: [
        {
          key: "items",
          label: "Materiales",
          type: "table",
          required: true,
          columns: [
            { key: "cantidad", label: "Cantidad", type: "number", required: true, defaultValue: "1" },
            { key: "detalle", label: "Detalle", type: "text", required: true },
          ],
        },
      ],
    });

    expect(buildInitialInputData(schema)).toEqual({
      items: [{ cantidad: "1" }],
    });
    expect(validateTemplateInput(schema, { items: [{ cantidad: "", detalle: "" }] })).toEqual([
      { key: "items.0.cantidad", message: "Cantidad es obligatorio." },
      { key: "items.0.detalle", message: "Detalle es obligatorio." },
    ]);
  });

  it("builds extraction rows from repeatable document items and duplicates parent fields", () => {
    const schema = normalizeTemplateSchema({
      fields: [
        { key: "proveedor", label: "Proveedor", type: "text", required: true },
        { key: "fecha_entrega", label: "Entrega", type: "date", required: false },
        { key: "cantidad", label: "Cantidad", type: "number", required: true, repeatableGroup: "items" },
        { key: "detalle", label: "Detalle", type: "text", required: true, repeatableGroup: "items" },
        { key: "precio_unitario", label: "Precio", type: "money", required: false, repeatableGroup: "items" },
      ],
    });

    const rows = buildDocumentGenerationExtractionRows({
      schema,
      inputData: {
        proveedor: "Hierros del Plata",
        fecha_entrega: "10/05/2026",
        items: [
          { cantidad: "2", detalle: "Malla", precio_unitario: "$ 1.200,50" },
          { cantidad: "1", detalle: "Perfil", precio_unitario: "1000" },
        ],
      },
      columns: [
        { fieldKey: "proveedor", dataType: "text", config: { ocrScope: "parent" } },
        { fieldKey: "fecha_entrega", dataType: "date", config: { ocrScope: "parent" } },
        { fieldKey: "cantidad", dataType: "number", config: { ocrScope: "item" } },
        { fieldKey: "detalle", dataType: "text", config: { ocrScope: "item" } },
        { fieldKey: "precio_unitario", dataType: "currency", config: { ocrScope: "item" } },
      ],
      documentMeta: {
        bucket: "obra-documents",
        path: "obra-1/ordenes/oc-1.pdf",
        fileName: "oc-1.pdf",
      },
    });

    expect(rows).toEqual([
      {
        proveedor: "Hierros del Plata",
        fecha_entrega: "2026-10-05T03:00:00.000Z",
        cantidad: 2,
        detalle: "Malla",
        precio_unitario: 1200.5,
        __docBucket: "obra-documents",
        __docPath: "obra-1/ordenes/oc-1.pdf",
        __docFileName: "oc-1.pdf",
      },
      {
        proveedor: "Hierros del Plata",
        fecha_entrega: "2026-10-05T03:00:00.000Z",
        cantidad: 1,
        detalle: "Perfil",
        precio_unitario: 1000,
        __docBucket: "obra-documents",
        __docPath: "obra-1/ordenes/oc-1.pdf",
        __docFileName: "oc-1.pdf",
      },
    ]);
  });

  it("maps extraction table columns through document field aliases", () => {
    const schema = normalizeTemplateSchema({
      fields: [
        { key: "nro", label: "Nro", type: "text", required: true },
        { key: "empresa_solicita", label: "Solicitante", type: "text", required: true },
        { key: "gestor_compra", label: "Gestor", type: "text", required: false },
        { key: "obra_destino", label: "Obra", type: "text", required: false },
        {
          key: "items",
          label: "Items",
          type: "table",
          required: true,
          columns: [
            { key: "cantidad", label: "Cantidad", type: "number", required: true },
            { key: "detalle", label: "Detalle", type: "text", required: true },
          ],
        },
      ],
    });

    const rows = buildDocumentGenerationExtractionRows({
      schema,
      inputData: {
        nro: "1",
        empresa_solicita: "Ignacio",
        gestor_compra: "Dario",
        obra_destino: "Obra Hospital",
        items: [{ cantidad: "1", detalle: "Cemento" }],
      },
      columns: [
        { fieldKey: "nro", dataType: "text", config: { ocrScope: "parent" } },
        { fieldKey: "solicitante", dataType: "text", config: { ocrScope: "parent" } },
        { fieldKey: "gestor", dataType: "text", config: { ocrScope: "parent" } },
        { fieldKey: "obra", dataType: "text", config: { ocrScope: "parent" } },
        { fieldKey: "detalle_descriptivo", dataType: "text", config: { ocrScope: "item" } },
      ],
      documentMeta: {
        bucket: "obra-documents",
        path: "obra-1/ordenes/oc-1.pdf",
        fileName: "oc-1.pdf",
      },
    });

    expect(rows[0]).toMatchObject({
      nro: "1",
      solicitante: "Ignacio",
      gestor: "Dario",
      obra: "Obra Hospital",
      detalle_descriptivo: "Cemento",
    });
  });

  it("maps extraction table columns through explicit template configuration", () => {
    const schema = normalizeTemplateSchema({
      fields: [
        { key: "custom_requester", label: "Solicitante", type: "text", required: true, extractionFieldKey: "persona_pide" },
        {
          key: "items",
          label: "Items",
          type: "table",
          required: true,
          columns: [
            { key: "custom_detail", label: "Detalle", type: "text", required: true, extractionFieldKey: "concepto" },
          ],
        },
      ],
    });

    const rows = buildDocumentGenerationExtractionRows({
      schema,
      inputData: {
        custom_requester: "Laura",
        items: [{ custom_detail: "Servicio especial" }],
      },
      columns: [
        { fieldKey: "persona_pide", dataType: "text", config: { ocrScope: "parent" } },
        { fieldKey: "concepto", dataType: "text", config: { ocrScope: "item" } },
      ],
      documentMeta: {
        bucket: "obra-documents",
        path: "obra-1/ordenes/oc-2.pdf",
        fileName: "oc-2.pdf",
      },
    });

    expect(rows[0]).toMatchObject({
      persona_pide: "Laura",
      concepto: "Servicio especial",
    });
  });

  it("falls back to a single extraction row for flat schemas and computes formulas", () => {
    const schema = normalizeTemplateSchema({
      fields: [
        { key: "subtotal", label: "Subtotal", type: "money", required: true },
        { key: "iva", label: "IVA", type: "money", required: true },
      ],
    });

    const rows = buildDocumentGenerationExtractionRows({
      schema,
      inputData: {
        subtotal: "1000",
        iva: "210",
      },
      columns: [
        { fieldKey: "subtotal", dataType: "currency" },
        { fieldKey: "iva", dataType: "currency" },
        { fieldKey: "total", dataType: "currency", config: { formula: "[subtotal] + [iva]" } },
      ],
      documentMeta: {
        bucket: "obra-documents",
        path: "obra-1/facturas/f-1.pdf",
        fileName: "f-1.pdf",
      },
    });

    expect(rows).toEqual([
      {
        subtotal: 1000,
        iva: 210,
        total: 1210,
        __docBucket: "obra-documents",
        __docPath: "obra-1/facturas/f-1.pdf",
        __docFileName: "f-1.pdf",
      },
    ]);
  });

  it("does not create metadata-only extraction rows when no table column has data", () => {
    const schema = normalizeTemplateSchema({
      fields: [
        { key: "certificateNumber", label: "Numero", type: "text", required: true },
        { key: "amount", label: "Monto", type: "money", required: true },
      ],
    });

    const rows = buildDocumentGenerationExtractionRows({
      schema,
      inputData: {
        certificateNumber: "1",
        amount: "1000",
      },
      columns: [
        { fieldKey: "periodo", dataType: "text" },
        { fieldKey: "avance_mensual_pct", dataType: "number" },
        { fieldKey: "avance_acumulado_pct", dataType: "number" },
      ],
      documentMeta: {
        bucket: "obra-documents",
        path: "obra-1/certificados/cert-1.pdf",
        fileName: "cert-1.pdf",
      },
    });

    expect(rows).toEqual([]);
  });

  it("hydrates missing document fields from extracted obra rows with source references", () => {
    const schema = normalizeTemplateSchema({
      fields: [
        { key: "proveedor", label: "Proveedor", type: "text", required: true },
        { key: "total", label: "Total", type: "money", required: true, extractionFieldKey: "importe_total" },
        {
          key: "items",
          label: "Items",
          type: "table",
          required: true,
          columns: [
            { key: "detalle", label: "Detalle", type: "text", required: true },
            { key: "cantidad", label: "Cantidad", type: "number", required: true },
          ],
        },
      ],
    });

    const result = applyDocumentAiContextInputData({
      schema,
      current: { proveedor: "Proveedor manual" },
      appliedAt: "2026-05-28T12:00:00.000Z",
      sourceRows: [
        {
          id: "row-1",
          tablaId: "tabla-1",
          tablaName: "Certificados",
          createdAt: "2026-05-27T12:00:00.000Z",
          lineageRowKey: "lineage-1",
          extractionId: "extraction-1",
          documentPath: "obra-1/certificados/certificado.pdf",
          documentFileName: "certificado.pdf",
          documentBucket: "obra-documents",
          data: {
            proveedor: "Proveedor extraido",
            importe_total: "1500",
            detalle: "Hormigon",
            cantidad: "2",
          },
        },
      ],
    });

    expect(result.inputData).toMatchObject({
      proveedor: "Proveedor manual",
      total: "1500",
      items: [{ detalle: "Hormigon", cantidad: "2" }],
    });
    expect(result.context).toMatchObject({
      status: "applied",
      sourceRowCount: 1,
      sourceTableCount: 1,
      appliedAt: "2026-05-28T12:00:00.000Z",
    });
    expect(result.context.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: "total",
          source: expect.objectContaining({
            type: "obra_tabla_row",
            rowId: "row-1",
            lineageRowKey: "lineage-1",
            documentPath: "obra-1/certificados/certificado.pdf",
          }),
        }),
      ]),
    );
  });
});
