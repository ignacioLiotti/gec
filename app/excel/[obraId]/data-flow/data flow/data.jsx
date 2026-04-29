/* global React */
// =================================================================
// Trazabilidad data model — Hospital Municipal Norte
// =================================================================
// Layers (downstream → upstream):
//   RESULTADO → CÁLCULO → MACROTABLA → TABLA → DOCUMENTOS
// Every edge is a real reference; the graph is computed from this list.
// =================================================================

const TRAZA = {
  obra: {
    nombre: "Hospital Municipal Norte",
    entidad: "Ministerio de Salud · Provincia de Buenos Aires",
    expediente: "EX-2024-1856-MSAL",
    actualizado: "hace 2 horas",
  },

  // ---------- 4 Resultados (entry points) ----------
  resultados: [
    {
      id: "r-avance",
      label: "Avance",
      value: "63%",
      raw: 63,
      kind: "percent",
      trend: "+4 pts vs mes anterior",
      status: "ok",
      explica:
        "Porcentaje de obra ejecutada sobre el total contratado. Se calcula como avance físico ponderado por ítems.",
      formula: "Σ (avance_item × peso_item) / Σ peso_item",
      calc: "c-avance",
      sources: ["t-certificados", "t-items"],
      updated: "hace 2 horas",
      stale: false,
    },
    {
      id: "r-contrato",
      label: "Contrato",
      value: "$156.500.000",
      raw: 156500000,
      kind: "money",
      trend: "+ $4.500.000 (ampliación 02)",
      status: "ok",
      explica:
        "Monto contractual total de la obra. Suma del contrato original más todas las ampliaciones aprobadas.",
      formula: "contrato_original + Σ ampliaciones",
      calc: "c-contrato",
      sources: ["t-contratos", "t-ampliaciones"],
      updated: "hace 2 horas",
      stale: false,
    },
    {
      id: "r-certificado",
      label: "Certificado",
      value: "$0",
      raw: 0,
      kind: "money",
      trend: "Sin certificaciones cargadas",
      status: "empty",
      explica:
        "Monto certificado y aprobado por la entidad contratante. Se actualiza con cada certificado mensual cargado.",
      formula: "Σ monto_certificado (estado = aprobado)",
      calc: "c-certificado",
      sources: ["t-certificados"],
      updated: "sin datos",
      stale: true,
    },
    {
      id: "r-saldo",
      label: "Saldo a certificar",
      value: "$156.500.000",
      raw: 156500000,
      kind: "money",
      trend: "100% del contrato pendiente",
      status: "warn",
      explica:
        "Diferencia entre contrato total y monto certificado. Es el monto que la entidad aún no liberó.",
      formula: "contrato_total − certificado_acumulado",
      calc: "c-saldo",
      sources: ["t-contratos", "t-ampliaciones", "t-certificados"],
      updated: "hace 2 horas",
      stale: false,
    },
  ],

  // ---------- Cálculos (capa intermedia, algunos hardcodeados) ----------
  calculos: [
    {
      id: "c-avance",
      label: "Avance ponderado",
      tipo: "agregación",
      hardcoded: false,
      desc: "Promedio ponderado de avance físico por ítem.",
      inputs: ["m-certificacion"],
    },
    {
      id: "c-contrato",
      label: "Suma contractual",
      tipo: "agregación",
      hardcoded: false,
      desc: "Suma de contrato original + ampliaciones.",
      inputs: ["m-costos"],
    },
    {
      id: "c-certificado",
      label: "Suma certificada",
      tipo: "agregación",
      hardcoded: true,
      desc: "Suma de montos certificados aprobados. Hardcodeado: la capa projected aún no resuelve esta agregación, viene de reporting.",
      inputs: ["m-certificacion"],
    },
    {
      id: "c-saldo",
      label: "Saldo (resta)",
      tipo: "operación",
      hardcoded: false,
      desc: "Resta entre contrato total y certificado acumulado.",
      inputs: ["m-costos", "m-certificacion"],
    },
  ],

  // ---------- Macrotablas ----------
  macrotablas: [
    {
      id: "m-costos",
      label: "Costos de obra",
      desc: "Consolida contratos, ampliaciones, órdenes de compra y facturas para el seguimiento financiero.",
      fuentes: 4,
      columnas: 12,
      sources: ["t-contratos", "t-ampliaciones", "t-ordenes", "t-facturas"],
      status: "ok",
    },
    {
      id: "m-certificacion",
      label: "Certificación mensual",
      desc: "Cruza certificados, ítems contractuales y avance físico para consolidar la curva de obra.",
      fuentes: 3,
      columnas: 9,
      sources: ["t-certificados", "t-items", "t-avance"],
      status: "partial",
    },
  ],

  // ---------- Tablas (8 base) ----------
  tablas: [
    { id: "t-contratos",    label: "Contratos",          rows: 1,   cols: 14, status: "ok",         folder: "01_Contrato",      docs: 3 },
    { id: "t-ampliaciones", label: "Ampliaciones",       rows: 2,   cols: 11, status: "ok",         folder: "02_Ampliaciones",  docs: 5 },
    { id: "t-ordenes",      label: "Órdenes de compra",  rows: 47,  cols: 9,  status: "ok",         folder: "03_OC",            docs: 47 },
    { id: "t-facturas",     label: "Facturas",           rows: 89,  cols: 12, status: "incomplete", folder: "04_Facturas",      docs: 73, missing: 16 },
    { id: "t-certificados", label: "Certificados",       rows: 0,   cols: 7,  status: "empty",      folder: "05_Certificados",  docs: 0 },
    { id: "t-items",        label: "Ítems contractuales", rows: 142, cols: 8,  status: "ok",         folder: "06_Items",         docs: 1 },
    { id: "t-avance",       label: "Avance físico",      rows: 24,  cols: 6,  status: "ok",         folder: "07_Avance",        docs: 12 },
    { id: "t-remitos",      label: "Remitos",            rows: 31,  cols: 7,  status: "stale",      folder: "08_Remitos",       docs: 31, lastUpdate: "hace 18 días" },
  ],

  // ---------- Documentos sample (para drill-down) ----------
  documentos: {
    "t-contratos":    [
      { id: "d-001", name: "Contrato HMN-2024.pdf",        size: "2.4 MB", date: "12/03/2024", type: "pdf" },
      { id: "d-002", name: "Anexo técnico HMN.pdf",         size: "1.8 MB", date: "12/03/2024", type: "pdf" },
      { id: "d-003", name: "Pliego de condiciones.pdf",     size: "4.1 MB", date: "08/03/2024", type: "pdf" },
    ],
    "t-ampliaciones": [
      { id: "d-010", name: "Ampliación 01 — eléctrica.pdf", size: "1.2 MB", date: "22/06/2024", type: "pdf" },
      { id: "d-011", name: "Ampliación 02 — hidráulica.pdf",size: "1.5 MB", date: "11/09/2024", type: "pdf" },
    ],
    "t-ordenes":      [
      { id: "d-020", name: "OC-0042 hormigón H21.pdf",      size: "180 KB", date: "03/10/2024", type: "pdf" },
      { id: "d-021", name: "OC-0043 hierro 8mm.pdf",        size: "165 KB", date: "05/10/2024", type: "pdf" },
      { id: "d-022", name: "OC-0044 ladrillos comunes.pdf", size: "172 KB", date: "07/10/2024", type: "pdf" },
    ],
    "t-facturas":     [
      { id: "d-030", name: "FC-A-00012 Cementera SA.pdf",   size: "210 KB", date: "10/10/2024", type: "pdf" },
      { id: "d-031", name: "FC-A-00013 Hierros del Sur.pdf",size: "195 KB", date: "12/10/2024", type: "pdf" },
    ],
    "t-certificados": [],
    "t-items":        [
      { id: "d-050", name: "Cómputo y presupuesto.xlsx",     size: "320 KB", date: "08/03/2024", type: "xls" },
    ],
    "t-avance":       [
      { id: "d-060", name: "Avance octubre — fotos.zip",     size: "12 MB",  date: "31/10/2024", type: "zip" },
      { id: "d-061", name: "Acta avance 10-2024.pdf",        size: "240 KB", date: "31/10/2024", type: "pdf" },
    ],
    "t-remitos":      [
      { id: "d-070", name: "R-0102 hormigón.pdf",            size: "98 KB",  date: "07/10/2024", type: "pdf" },
    ],
  },

  // ---------- Sample table rows (para drill-down) ----------
  tablaRows: {
    "t-contratos": {
      cols: ["Nº", "Tipo", "Monto", "Inicio", "Plazo", "Estado"],
      rows: [
        ["HMN-2024-001", "Contrato base", "$152.000.000", "12/03/2024", "540 días", "Vigente"],
      ],
    },
    "t-ampliaciones": {
      cols: ["Nº", "Concepto", "Monto", "Aprobado", "Estado"],
      rows: [
        ["AMP-01", "Adicional eléctrica",  "$2.100.000", "22/06/2024", "Aprobada"],
        ["AMP-02", "Adicional hidráulica", "$2.400.000", "11/09/2024", "Aprobada"],
      ],
    },
    "t-ordenes": {
      cols: ["Nº OC", "Proveedor", "Concepto", "Monto", "Fecha", "Estado"],
      rows: [
        ["OC-0042", "Cementera SA",     "Hormigón H21",        "$1.840.000", "03/10/2024", "Recibida"],
        ["OC-0043", "Hierros del Sur",  "Hierro 8mm × 200u",   "$920.000",   "05/10/2024", "Recibida"],
        ["OC-0044", "Ladrillera Norte", "Ladrillos × 12.000",  "$680.000",   "07/10/2024", "Pendiente"],
        ["OC-0045", "Cementera SA",     "Cemento Portland",    "$420.000",   "10/10/2024", "Pendiente"],
        ["OC-0046", "Pinturas del Sur", "Látex interior 200L", "$310.000",   "11/10/2024", "Pendiente"],
      ],
    },
    "t-facturas": {
      cols: ["Nº", "Proveedor", "Tipo", "Neto", "IVA", "Total", "Vto."],
      rows: [
        ["FC-A-00012", "Cementera SA",    "A", "$1.520.661", "$319.339", "$1.840.000", "10/11/2024"],
        ["FC-A-00013", "Hierros del Sur", "A", "$760.331",   "$159.669", "$920.000",   "12/11/2024"],
        ["FC-A-00014", "Ladrillera Norte","A", "$561.983",   "$118.017", "$680.000",   "14/11/2024"],
      ],
    },
    "t-certificados": {
      cols: ["Nº", "Período", "Monto", "Avance %", "Estado"],
      rows: [],
    },
    "t-items": {
      cols: ["Item", "Descripción", "Unidad", "Cantidad", "P. unit.", "Subtotal", "Peso %"],
      rows: [
        ["1.1.1",  "Replanteo y obrador",       "gl", "1",      "$2.400.000",  "$2.400.000",  "1.5"],
        ["2.1.1",  "Excavación masiva",         "m³", "1.240",  "$8.500",      "$10.540.000", "6.7"],
        ["2.2.1",  "Hormigón H21 fundaciones",  "m³", "320",    "$72.000",     "$23.040.000", "14.7"],
        ["3.1.1",  "Mampostería ladrillo común","m²", "1.880",  "$15.200",     "$28.576.000", "18.3"],
      ],
    },
    "t-avance": {
      cols: ["Período", "Avance acum.", "Avance mes", "Foto", "Acta"],
      rows: [
        ["08/2024", "12%", "12%", "✓", "✓"],
        ["09/2024", "31%", "19%", "✓", "✓"],
        ["10/2024", "63%", "32%", "✓", "✓"],
      ],
    },
    "t-remitos": {
      cols: ["Nº", "OC", "Proveedor", "Fecha", "Estado"],
      rows: [
        ["R-0102", "OC-0042", "Cementera SA",    "07/10/2024", "Recibido"],
        ["R-0103", "OC-0043", "Hierros del Sur", "08/10/2024", "Recibido"],
      ],
    },
  },
};

window.TRAZA = TRAZA;
