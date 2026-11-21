import React, { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  ArrowLeft,
  ChevronRight,
  RotateCcw,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScreenSidebar, ScreenTabs } from "./app-chrome";
import { ReferenceSurface } from "../reference-runtime";
import {
  ExcelScreen,
  GeneralScreen,
  DocumentsScreen,
  Panel,
  ExtractionTrace,
} from "./screen-components";
import { obras, documents, type ObraExample } from "./fixtures";
import "../vendor/tokens.css";
import "../vendor/interior/motion.css";
import "../vendor/beautiful/motion.css";
import "../comparison.css";
import "./screens.css";
import "./published-theme.css";

const screens = {
  excel: "Excel · Tus Obras",
  obra: "Obra · página completa",
  documentos: "Obra · Documentos",
  general: "Obra · General",
};
type Screen = keyof typeof screens;
type Props = {
  initialScreen: Screen;
  reducedMotion: boolean;
  simulateError: boolean;
  renderWorkspace?: (
    content: React.ReactNode,
    screen: Screen,
  ) => React.ReactNode;
};

function ScreenExamples({
  initialScreen,
  reducedMotion,
  simulateError,
  renderWorkspace,
}: Props) {
  const [screen, setScreen] = useState(initialScreen);
  const [rows, setRows] = useState(obras);
  const [docs, setDocs] = useState(documents);
  const [selectedId, setSelectedId] = useState(obras[0].id);
  const [quiet, setQuiet] = useState(reducedMotion);
  const [fail, setFail] = useState(simulateError);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState([
    "Revisar el importe del certificado de agosto antes del cierre mensual.",
  ]);
  const obra = rows.find((row) => row.id === selectedId) ?? rows[0];

  function create(name: string) {
    const next: ObraExample = {
      id: `demo-new-${rows.length}`,
      n: Math.max(...rows.map((row) => row.n)) + 1,
      name,
      client: "Entidad de ejemplo",
      area: 1200,
      contract: 250000000,
      certified: 0,
      progress: 0,
      status: "En revisión",
    };
    setRows([...rows, next]);
    setNotice(`Obra creada: ${name}`);
  }
  function save(next: ObraExample) {
    setRows(rows.map((row) => (row.id === next.id ? next : row)));
    setNotice("Datos de obra guardados en este ejemplo.");
  }
  function reset() {
    setRows(obras);
    setDocs(documents);
    setSelectedId(obras[0].id);
    setNotes([
      "Revisar el importe del certificado de agosto antes del cierre mensual.",
    ]);
    setNote("");
    setNotice("");
    setRevision(revision + 1);
  }
  const general = (
    <GeneralScreen key={obra.id} obra={obra} onSave={save} fail={fail} />
  );
  const content = (
    <div className="screen-content">
      <div role="status" className="screen-notice">
        {notice}
      </div>
      {screen === "excel" ? (
        <ExcelScreen
          rows={rows}
          onOpen={(row) => {
            setSelectedId(row.id);
            setScreen("obra");
            setNotice("");
          }}
          onCreate={create}
          fail={fail}
        />
      ) : (
        <>
          <div className="screen-breadcrumb">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setScreen("excel")}
            >
              <ArrowLeft />
              Tus Obras
            </Button>
            <ChevronRight size={13} />
            <span>Obra {obra.n}</span>
          </div>
          <div className="screen-obra-heading">
            <div>
              <p className="screen-eyebrow">
                OBRA {obra.n} · {obra.client}
              </p>
              <h1>{obra.name}</h1>
            </div>
            <Badge
              variant={
                obra.status === "En revisión"
                  ? "warning"
                  : obra.status === "Finalizada"
                    ? "success"
                    : "secondary"
              }
            >
              {obra.status}
            </Badge>
          </div>
          <ScreenTabs
            value={screen === "documentos" ? "documentos" : "general"}
            onValueChange={(value) => setScreen(value as Screen)}
            renderPanel={(value) =>
              value === "documentos" ? (
                <DocumentsScreen
                  docs={docs}
                  onVerify={(id) => {
                    setDocs(
                      docs.map((doc) =>
                        doc.id === id ? { ...doc, status: "Verificado" } : doc,
                      ),
                    );
                    setNotice("Revisión confirmada en este ejemplo.");
                  }}
                  fail={fail}
                />
              ) : screen === "obra" ? (
                <div className="screen-obra-layout">
                  {general}
                  <aside className="screen-activity">
                    <Panel
                      title="Notas de obra"
                      detail="Coordinación del equipo"
                    >
                      <div className="screen-notes">
                        {notes.map((text, index) => (
                          <article key={index}>
                            <span className="screen-avatar">MA</span>
                            <div>
                              <strong>María Álvarez</strong>
                              <small>
                                {index === 0 ? "Hoy · 09:42" : "Ahora"}
                              </small>
                              <p>{text}</p>
                            </div>
                          </article>
                        ))}
                      </div>
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (!note.trim()) return;
                          setNotes([...notes, note.trim()]);
                          setNote("");
                        }}
                      >
                        <Textarea
                          aria-label="Nueva nota"
                          placeholder="Escribí una nota para el equipo…"
                          value={note}
                          onChange={(event) => setNote(event.target.value)}
                        />
                        <Button type="submit" disabled={!note.trim()}>
                          <MessageSquare />
                          Agregar nota
                        </Button>
                      </form>
                    </Panel>
                    <Panel
                      title="Última extracción"
                      detail="Certificados de obra"
                    >
                      <ExtractionTrace />
                      <Button
                        variant="outline"
                        onClick={() => setScreen("documentos")}
                      >
                        Revisar documentos
                        <ChevronRight />
                      </Button>
                    </Panel>
                  </aside>
                </div>
              ) : (
                general
              )
            }
          />
        </>
      )}
    </div>
  );
  if (renderWorkspace)
    return (
      <ReferenceSurface library="interior" reduced={quiet}>
        {renderWorkspace(content, screen)}
      </ReferenceSurface>
    );
  return (
    <div className="motion-screens">
      <header className="screen-example-controls">
        <div>
          <span className="screen-eyebrow">SÍNTESIS / MOTION</span>
          <h1>Pantallas con Interior + Beautiful</h1>
          <p>
            Probá el recorrido con datos ficticios. Los cambios duran hasta
            reiniciar el ejemplo.
          </p>
        </div>
        <div className="screen-example-options">
          <label>
            Pantalla de ejemplo
            <select
              value={screen}
              onChange={(event) => setScreen(event.target.value as Screen)}
            >
              {Object.entries(screens).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="screen-check">
            <input
              type="checkbox"
              checked={quiet}
              onChange={(event) => setQuiet(event.target.checked)}
            />
            Movimiento reducido
          </label>
          <label className="screen-check">
            <input
              type="checkbox"
              checked={fail}
              onChange={(event) => setFail(event.target.checked)}
            />
            Simular error al guardar
          </label>
          <Button variant="outline" onClick={reset}>
            <RotateCcw />
            Reiniciar
          </Button>
        </div>
      </header>
      <ReferenceSurface
        library="interior"
        reduced={quiet}
        productTheme="published"
      >
        <div className="screen-app" key={revision} data-screen={screen}>
          <ScreenSidebar onOpen={() => setScreen("excel")} />
          <div className="screen-workspace">
            <header className="screen-topbar">
              <span>Arqline / Equipo de obras</span>
              <Badge variant="outline">Ejemplo interactivo</Badge>
            </header>
            {content}
          </div>
        </div>
      </ReferenceSurface>
      <footer className="screen-source-note">
        <p>
          <strong>Interior:</strong> tabla ordenable, tabs con indicador,
          drawer, validación, botón con estados, árbol de carpetas, acordeón,
          progreso y cifras. <strong>Beautiful:</strong> selector deslizante,
          pasos de extracción y carga con puntos.
        </p>
        <p>
          Se conserva el movimiento del código de referencia y se aplican los
          tokens de Síntesis. Estas pantallas son prototipos en Storybook; no
          modifican la aplicación ni sus datos.
        </p>
        <a href="?path=/story/motion-comparacion--playground">
          Abrir comparación por componente →
        </a>
      </footer>
    </div>
  );
}

const meta = {
  title: "Motion/Pantallas",
  component: ScreenExamples,
  parameters: { layout: "fullscreen" },
  args: { initialScreen: "excel", reducedMotion: false, simulateError: false },
  argTypes: {
    initialScreen: { control: "select", options: Object.keys(screens) },
    reducedMotion: { control: "boolean" },
    simulateError: { control: "boolean" },
  },
  render: (args) => (
    <ScreenExamples
      key={`${args.initialScreen}-${args.reducedMotion}-${args.simulateError}`}
      {...args}
    />
  ),
} satisfies Meta<typeof ScreenExamples>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Playground: Story = {};
export const Excel: Story = {};
export const Obra: Story = { args: { initialScreen: "obra" } };
export const Documentos: Story = { args: { initialScreen: "documentos" } };
export const General: Story = { args: { initialScreen: "general" } };
