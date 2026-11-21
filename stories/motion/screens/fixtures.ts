// Sanitized Storybook fixtures. No product IDs, storage paths or API requests.
export type ObraExample = {
  id: string;
  n: number;
  name: string;
  client: string;
  area: number;
  contract: number;
  certified: number;
  progress: number;
  status: "En ejecución" | "En revisión" | "Finalizada";
};
export const obras: ObraExample[] = [
  {
    id: "demo-24",
    n: 24,
    name: "Torre Madero · Dique 2",
    client: "Arqline Desarrollos",
    area: 18600,
    contract: 4820000000,
    certified: 3140000000,
    progress: 68.4,
    status: "En ejecución",
  },
  {
    id: "demo-19",
    n: 19,
    name: "Distrito Norte · Etapa II",
    client: "Brava Urbanismo",
    area: 12400,
    contract: 3270000000,
    certified: 2740000000,
    progress: 84.1,
    status: "En ejecución",
  },
  {
    id: "demo-31",
    n: 31,
    name: "Campus Río · Pabellón Central",
    client: "Lumen Educación",
    area: 9200,
    contract: 1980000000,
    certified: 614000000,
    progress: 31,
    status: "En revisión",
  },
  {
    id: "demo-12",
    n: 12,
    name: "Hospital del Sur · Ampliación",
    client: "Municipalidad del Sur",
    area: 6500,
    contract: 1250000000,
    certified: 1250000000,
    progress: 100,
    status: "Finalizada",
  },
  {
    id: "demo-42",
    n: 42,
    name: "Parque Industrial · Nave 4",
    client: "Industria Delta",
    area: 14800,
    contract: 2560000000,
    certified: 1088000000,
    progress: 42.5,
    status: "En ejecución",
  },
  {
    id: "demo-38",
    n: 38,
    name: "Centro Cultural · Restauración",
    client: "Fundación Horizonte",
    area: 3400,
    contract: 860000000,
    certified: 172000000,
    progress: 20,
    status: "En revisión",
  },
];
export type DocumentExample = {
  id: string;
  name: string;
  folder: string;
  size: string;
  date: string;
  status: "Pendiente" | "Revisar" | "Verificado";
  amount: number;
};
export const documents: DocumentExample[] = [
  {
    id: "cert-08",
    name: "Certificado 08 · Agosto.pdf",
    folder: "certificados",
    size: "1,8 MB",
    date: "07/09/2026",
    status: "Revisar",
    amount: 184000000,
  },
  {
    id: "cert-07",
    name: "Certificado 07 · Julio.pdf",
    folder: "certificados",
    size: "1,2 MB",
    date: "04/08/2026",
    status: "Verificado",
    amount: 162500000,
  },
  {
    id: "cert-06",
    name: "Certificado 06 · Junio.pdf",
    folder: "certificados",
    size: "940 KB",
    date: "03/07/2026",
    status: "Verificado",
    amount: 148600000,
  },
  {
    id: "fact-01",
    name: "Factura 0004-00001258.pdf",
    folder: "facturas",
    size: "480 KB",
    date: "05/09/2026",
    status: "Pendiente",
    amount: 2480000,
  },
  {
    id: "plan-01",
    name: "Plano de estructura · Rev. C.pdf",
    folder: "planos",
    size: "4,2 MB",
    date: "02/09/2026",
    status: "Verificado",
    amount: 0,
  },
];
export const folderNames: Record<string, string> = {
  all: "Todos los documentos",
  certificados: "Certificados",
  facturas: "Facturas",
  planos: "Planos",
};
export const folders = [
  {
    id: "all",
    label: "Documentos de obra",
    children: [
      { id: "certificados", label: "Certificados", meta: "3" },
      { id: "facturas", label: "Facturas", meta: "1" },
      { id: "planos", label: "Planos", meta: "1" },
    ],
  },
];
export const currency = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
export const compact = (value: number) =>
  `$ ${(value / 1000000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M`;
export const curve = [12, 24, 38, 50, 64, 76].map((planPct, index) => ({
  label: `2026-${String(index + 4).padStart(2, "0")}`,
  planPct,
  realPct: [10, 22, 34, 46, 58, 68.4][index],
  sortOrder: 2026 * 12 + index + 3,
}));
