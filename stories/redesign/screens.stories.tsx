import React, { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import screenMeta from "../motion/screens/screens.stories";
import vibeMeta from "../vibe/paper.stories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { NativeSelect } from "@/components/ui/native-select";
import {
  FileText,
  Layers,
  Search,
  ArrowRight,
  Download,
  Check,
} from "lucide-react";
import "./review.css";
import { PaperFrame } from "../vibe/paper-frame";
import "./paper-screens.css";

const ObraScreens = screenMeta.component;
const Vibe = vibeMeta.component;
const rows = [
  {
    id: 1,
    obra: "Torre Madero",
    folder: "Certificados",
    period: "Agosto 2026",
    value: 184000000,
    status: "Verificado",
  },
  {
    id: 2,
    obra: "Distrito Norte",
    folder: "Certificados",
    period: "Agosto 2026",
    value: 162500000,
    status: "Por revisar",
  },
  {
    id: 3,
    obra: "Campus Río",
    folder: "Facturas",
    period: "Julio 2026",
    value: 2480000,
    status: "Verificado",
  },
  {
    id: 4,
    obra: "Torre Madero",
    folder: "Certificados",
    period: "Julio 2026",
    value: 148600000,
    status: "Verificado",
  },
];
const money = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
function DataScreen({ reports = false }: { reports?: boolean }) {
  const [search, setSearch] = useState("");
  const [state, setState] = useState("Todos");
  const [period, setPeriod] = useState("Todos");
  const [preview, setPreview] = useState(false);
  const [selected, setSelected] = useState(1);
  const [notice, setNotice] = useState("");
  const filtered = rows.filter(
    (row) =>
      row.obra.toLowerCase().includes(search.toLowerCase()) &&
      (state === "Todos" || row.status === state) &&
      (period === "Todos" || row.period === period),
  );
  const row = rows.find((item) => item.id === selected)!;
  const total = filtered.reduce((sum, item) => sum + item.value, 0);
  function download() {
    const csv =
      "Obra,Carpeta,Periodo,Importe,Estado\n" +
      filtered
        .map((item) =>
          [item.obra, item.folder, item.period, item.value, item.status].join(
            ",",
          ),
        )
        .join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "sintesis-propuesta-ejemplo.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("CSV de ejemplo descargado.");
  }
  return (
    <div className="redesign-data-screen">
      <header className="redesign-screen-heading">
        <div>
          <span className="redesign-eyebrow">
            SÍNTESIS / {reports ? "REPORTES" : "MACROTABLAS"}
          </span>
          <h1>
            {reports
              ? "El cierre, listo para revisar."
              : "Una vista compartida de tus datos."}
          </h1>
          <p>
            {reports
              ? "Certificaciones de obra · informe de seguimiento"
              : "Consolidado de certificados y facturas de todas tus obras"}
          </p>
        </div>
        <Badge variant="outline">Datos de ejemplo</Badge>
      </header>
      <div className="redesign-data-layout">
        <aside>
          <Card>
            <CardHeader>
              <CardTitle>{reports ? "Informes" : "Macrotablas"}</CardTitle>
              <CardDescription>Espacio de trabajo</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="secondary"
                className="w-full justify-start"
                onClick={() =>
                  setNotice(
                    reports
                      ? "Informe de certificaciones seleccionado."
                      : "Consolidado seleccionado.",
                  )
                }
              >
                {reports ? <FileText /> : <Layers />}
                {reports ? "Certificaciones" : "Consolidado de obra"}
              </Button>
            </CardContent>
            <CardFooter>
              <span className="text-xs text-muted-foreground">
                Actualizado hoy · 09:42
              </span>
            </CardFooter>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Requiere atención</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Un registro de Distrito Norte está pendiente de revisión.
              </p>
            </CardContent>
            <CardFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  setState("Por revisar");
                  setPeriod("Todos");
                  setSearch("");
                }}
              >
                Ver registro
                <ArrowRight />
              </Button>
            </CardFooter>
          </Card>
        </aside>
        <main>
          <div className="redesign-metrics">
            <Card>
              <CardHeader>
                <CardDescription>Registros visibles</CardDescription>
                <CardTitle>{filtered.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Total de la selección</CardDescription>
                <CardTitle>{money(total)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Verificados</CardDescription>
                <CardTitle>
                  {
                    filtered.filter((item) => item.status === "Verificado")
                      .length
                  }
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>
                {reports ? "Preparar informe" : "Datos consolidados"}
              </CardTitle>
              <CardDescription>
                Los mismos filtros se conservan al abrir la vista previa.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="redesign-filterbar">
                <label>
                  <Search size={14} />
                  <Input
                    aria-label="Buscar obra"
                    placeholder="Buscar obra…"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <NativeSelect
                  aria-label="Estado"
                  value={state}
                  onChange={(event) => setState(event.target.value)}
                >
                  {["Todos", "Por revisar", "Verificado"].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </NativeSelect>
                <NativeSelect
                  aria-label="Período"
                  value={period}
                  onChange={(event) => setPeriod(event.target.value)}
                >
                  {["Todos", "Agosto 2026", "Julio 2026"].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </NativeSelect>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearch("");
                    setState("Todos");
                    setPeriod("Todos");
                  }}
                >
                  Limpiar
                </Button>
              </div>
              {preview ? (
                <article className="redesign-report-paper">
                  <span>INFORME DE SEGUIMIENTO / 2026</span>
                  <h2>Certificaciones de obra</h2>
                  <p>
                    {period === "Todos" ? "Todos los períodos" : period} ·{" "}
                    {filtered.length} registros · {state}
                  </p>
                  <strong>{money(total)}</strong>
                  {filtered.map((item) => (
                    <div key={item.id}>
                      <span>
                        {item.obra} · {item.period}
                      </span>
                      <b>{money(item.value)}</b>
                    </div>
                  ))}
                  <footer>
                    Documento de ejemplo. La propuesta modifica los controles
                    del reporte; el formato final de exportación conserva sus
                    reglas documentales.
                  </footer>
                </article>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Obra</TableHead>
                      <TableHead>Carpeta</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Importe</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((item) => (
                      <TableRow
                        key={item.id}
                        data-state={
                          selected === item.id ? "selected" : undefined
                        }
                      >
                        <TableCell>
                          <Button
                            variant="link"
                            onClick={() => setSelected(item.id)}
                          >
                            {item.obra}
                          </Button>
                        </TableCell>
                        <TableCell>{item.folder}</TableCell>
                        <TableCell>{item.period}</TableCell>
                        <TableCell>{money(item.value)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              item.status === "Verificado"
                                ? "success"
                                : "warning"
                            }
                          >
                            {item.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {filtered.length === 0 && (
                <p className="redesign-empty">
                  No hay registros con estos filtros.
                </p>
              )}
            </CardContent>
            <CardFooter className="redesign-actions">
              <span>
                {filtered.length} registros seleccionados por los filtros
              </span>
              <Button variant="outline" onClick={() => setPreview(!preview)}>
                {preview ? "Volver a datos" : "Vista previa"}
              </Button>
              <Button onClick={download} disabled={!filtered.length}>
                <Download />
                Exportar CSV
              </Button>
            </CardFooter>
          </Card>
          {!reports && (
            <Card>
              <CardHeader>
                <CardTitle>Origen del dato</CardTitle>
                <CardDescription>
                  {row.obra} / {row.folder}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="redesign-lineage">
                  <FileText />
                  <div>
                    <strong>{row.period}</strong>
                    <p>
                      Documento de ejemplo → carpeta de extracción → consolidado
                    </p>
                  </div>
                  <Badge variant="outline">
                    <Check size={12} />
                    Vínculo disponible
                  </Badge>
                </div>
              </CardContent>
              <CardFooter>
                <span className="text-xs text-muted-foreground">
                  Seleccioná una obra de la tabla para inspeccionar su origen.
                </span>
              </CardFooter>
            </Card>
          )}
          <p role="status" className="redesign-notice">
            {notice}
          </p>
        </main>
      </div>
    </div>
  );
}
const meta = {
  id: "rediseno-pantallas",
  title: "Rediseño/Pantallas",
  parameters: { layout: "fullscreen" },
  globals: { design: "paper" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
export const Inicio: Story = {
  render: (_, context) => (
    <Vibe
      key={context.globals.theme}
      initialDark={context.globals.theme === "dark"}
    />
  ),
};
function WorkScreen({
  screen,
  dark,
}: {
  screen: "excel" | "obra" | "documentos" | "general";
  dark: boolean;
}) {
  return (
    <ObraScreens
      initialScreen={screen}
      reducedMotion={false}
      simulateError={false}
      renderWorkspace={(content, current) => (
        <PaperFrame initialDark={dark} section={current}>
          <div className="paper-screen-body">{content}</div>
        </PaperFrame>
      )}
    />
  );
}
export const Excel: Story = {
  render: (_, context) => (
    <WorkScreen
      key={context.globals.theme}
      screen="excel"
      dark={context.globals.theme === "dark"}
    />
  ),
};
export const Obra: Story = {
  render: (_, context) => (
    <WorkScreen
      key={context.globals.theme}
      screen="obra"
      dark={context.globals.theme === "dark"}
    />
  ),
};
export const Documentos: Story = {
  render: (_, context) => (
    <WorkScreen
      key={context.globals.theme}
      screen="documentos"
      dark={context.globals.theme === "dark"}
    />
  ),
};
export const General: Story = {
  render: (_, context) => (
    <WorkScreen
      key={context.globals.theme}
      screen="general"
      dark={context.globals.theme === "dark"}
    />
  ),
};
export const Macrotablas: Story = {
  render: (_, context) => (
    <PaperFrame
      key={context.globals.theme}
      initialDark={context.globals.theme === "dark"}
      section="macrotablas"
    >
      <div className="paper-screen-body">
        <DataScreen />
      </div>
    </PaperFrame>
  ),
};
export const Reportes: Story = {
  render: (_, context) => (
    <PaperFrame
      key={context.globals.theme}
      initialDark={context.globals.theme === "dark"}
      section="reportes"
    >
      <div className="paper-screen-body">
        <DataScreen reports />
      </div>
    </PaperFrame>
  ),
};
