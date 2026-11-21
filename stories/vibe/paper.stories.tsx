import React, { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  FileText,
  Moon,
  Search,
  SlidersHorizontal,
  Sun,
  X,
} from "lucide-react";
import "./paper.css";
import { PaperFrame } from "./paper-frame";

const issues = [
  {
    title: "Revisar certificado de agosto",
    detail:
      "El importe detectado difiere del acumulado de la obra. Revisá los datos antes de incorporarlo al cierre mensual.",
    file: "Certificado 08 · Agosto.pdf",
    amount: "$ 184.000.000",
    tag: "Importe por confirmar",
  },
  {
    title: "Completar datos de una factura",
    detail:
      "La factura tiene un proveedor identificado, pero falta confirmar su fecha de emisión.",
    file: "Factura 0004-1258.pdf",
    amount: "$ 2.480.000",
    tag: "Fecha pendiente",
  },
  {
    title: "Verificar plano actualizado",
    detail:
      "Hay una nueva revisión del plano de estructura. Confirmá la versión que usará el equipo.",
    file: "Estructura · Revisión C.pdf",
    amount: "Revisión C",
    tag: "Nueva versión",
  },
  {
    title: "Revisar póliza de caución",
    detail: "La póliza está lista para la revisión del equipo de obra.",
    file: "Póliza de caución.pdf",
    amount: "$ 48.000.000",
    tag: "Pendiente de revisión",
  },
];
const values = [24, 32, 28, 43, 38, 49, 46, 60, 54, 69, 64, 77];

function PaperDemo({ initialDark = false }: { initialDark?: boolean }) {
  const [graphDark, setGraphDark] = useState(true);
  const [selected, setSelected] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [confirmed, setConfirmed] = useState<number[]>([]);
  const [point, setPoint] = useState(8);
  const [filter, setFilter] = useState("Todos");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("Texto");
  const [name, setName] = useState("Responsable de obra");
  const [fallback, setFallback] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const issue = issues[selected];
  const pending = issues.filter((_, i) => !confirmed.includes(i));
  const docs = issues.filter(
    (doc, i) =>
      doc.file.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "Todos" ||
        (filter === "Verificados"
          ? confirmed.includes(i)
          : !confirmed.includes(i))),
  );

  async function save() {
    if (!name.trim() || saving) return;
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    setSaving(false);
    setNotice(`Campo “${name.trim()}” creado en la demo.`);
  }
  return (
    <PaperFrame
      initialDark={initialDark}
      attention={
        <div className="paper-tray paper-attention">
          <section className="paper-sheet">
            <header>
              <span>Requiere atención</span>
              <span className="paper-count">{pending.length}</span>
            </header>
            <div>
              {issues.slice(0, expanded ? 4 : 3).map((item, i) => (
                <button
                  key={item.file}
                  aria-pressed={selected === i}
                  className="paper-attention-row"
                  onClick={() => setSelected(i)}
                >
                  <span
                    className={
                      confirmed.includes(i) ? "paper-dot is-done" : "paper-dot"
                    }
                  />
                  <span>{item.title}</span>
                  {confirmed.includes(i) && <Check size={12} />}
                </button>
              ))}
            </div>
          </section>
          <button
            className="paper-tray-footer"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            <ChevronDown
              size={15}
              className={expanded ? "paper-rotated" : ""}
            />
            {expanded ? "Mostrar menos" : "Mostrar todo"}
          </button>
        </div>
      }
    >
      <div className="paper-page-title">
        <div>
          <span className="paper-kicker">TORRE MADERO · DIQUE 2</span>
          <h2>Todo en su lugar.</h2>
          <p>El estado de tu obra, los documentos y lo que sigue.</p>
        </div>
        <span className="paper-date">
          SEPTIEMBRE
          <br />
          <strong>2026</strong>
        </span>
      </div>
      <div className="paper-main-grid">
        <div className="paper-primary-column">
          <div className="paper-tray paper-review">
            <section className="paper-sheet">
              <div className="paper-review-heading">
                <span className="paper-document-icon">
                  <FileText />
                </span>
                <div>
                  <span className="paper-kicker">REVISIÓN DE DOCUMENTOS</span>
                  <h3>{issue.title}</h3>
                </div>
                <span className="paper-review-state">
                  {confirmed.includes(selected) ? "Verificado" : "Por revisar"}
                </span>
              </div>
              <p className="paper-review-description">{issue.detail}</p>
              <div className="paper-file-well">
                <FileText size={17} />
                <div>
                  <strong>{issue.file}</strong>
                  <small>{issue.tag}</small>
                </div>
                <span>{issue.amount}</span>
              </div>
            </section>
            <footer className="paper-review-footer">
              <span>
                <span
                  className={
                    confirmed.includes(selected)
                      ? "paper-dot is-done"
                      : "paper-dot"
                  }
                />
                {confirmed.includes(selected)
                  ? "Revisión confirmada"
                  : "Esperando tu confirmación"}
              </span>
              <button
                className="paper-button paper-button-ink"
                disabled={confirmed.includes(selected)}
                onClick={() => {
                  setConfirmed([...confirmed, selected]);
                  setNotice("Documento verificado en la demo.");
                }}
              >
                {confirmed.includes(selected) ? <Check size={14} /> : null}
                {confirmed.includes(selected)
                  ? "Verificado"
                  : "Confirmar revisión"}
              </button>
            </footer>
          </div>
          <section
            className="paper-chart"
            data-dark={graphDark}
            aria-label="Certificación acumulada"
          >
            <header>
              <div>
                <span className="paper-chart-label">
                  Certificación acumulada
                </span>
                <div className="paper-chart-total">
                  $ 3.140 <small>M</small>
                  <span className="paper-growth">
                    <ArrowUpRight size={12} />
                    12,8%
                  </span>
                </div>
                <p>Respecto al período anterior</p>
              </div>
              <button
                className="paper-chart-toggle"
                aria-label="Cambiar material del gráfico"
                onClick={() => setGraphDark(!graphDark)}
              >
                {graphDark ? <Sun size={14} /> : <Moon size={14} />}
              </button>
            </header>
            <div className="paper-chart-plot">
              <svg
                viewBox="0 0 600 220"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="paper-area" x1="0" x2="0" y1="0" y2="1">
                    <stop stopColor="#ff782e" stopOpacity=".13" />
                    <stop offset="1" stopColor="#ff782e" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[30, 80, 130, 180].map((y) => (
                  <line
                    key={y}
                    x1="0"
                    x2="600"
                    y1={y}
                    y2={y}
                    className="paper-chart-grid"
                  />
                ))}
                <path
                  d={`M 0 210 ${values.map((v, i) => `L ${i * 54.5} ${210 - v * 2}`).join(" ")} L 600 210 Z`}
                  fill="url(#paper-area)"
                />
                <polyline
                  points={values
                    .map((v, i) => `${i * 54.5},${220 - v * 1.65}`)
                    .join(" ")}
                  className="paper-chart-previous"
                />
                <polyline
                  points={values
                    .map((v, i) => `${i * 54.5},${210 - v * 2}`)
                    .join(" ")}
                  className="paper-chart-current"
                />
                <line
                  x1={point * 54.5}
                  x2={point * 54.5}
                  y1="5"
                  y2="210"
                  className="paper-chart-guide"
                />
              </svg>
              {values.map((v, i) => (
                <button
                  key={i}
                  className="paper-chart-point"
                  aria-label={`Semana ${i + 1}: ${v} millones`}
                  aria-pressed={point === i}
                  style={{
                    left: `${(i / 11) * 100}%`,
                    top: `${((210 - v * 2) / 220) * 100}%`,
                  }}
                  onMouseEnter={() => setPoint(i)}
                  onFocus={() => setPoint(i)}
                  onClick={() => setPoint(i)}
                />
              ))}
              <div
                className="paper-gloss-tooltip"
                style={{
                  left: `${Math.min(74, Math.max(8, (point / 11) * 100))}%`,
                }}
              >
                <span>SEMANA {point + 1}</span>
                <strong>
                  <i />$ {values[point]} millones
                </strong>
                <small>
                  <i />$ {Math.round(values[point] * 0.83)} millones
                </small>
              </div>
            </div>
            <div className="paper-chart-axis">
              <span>Junio</span>
              <span>Julio</span>
              <span>Agosto</span>
              <span>Septiembre</span>
            </div>
            <footer>
              <span>
                <i />
                Período actual
              </span>
              <span>
                <i />
                Período anterior
              </span>
            </footer>
          </section>
        </div>
        <div className="paper-secondary-column">
          <div className="paper-tray paper-field" id="paper-field">
            <section className="paper-sheet">
              <header>
                <span className="paper-field-glyph">{`{x}`}</span>
                <h3>Crear campo</h3>
                <button
                  className="paper-icon-button"
                  aria-label="Limpiar formulario"
                  onClick={() => {
                    setName("");
                    setFallback("");
                  }}
                >
                  <X size={15} />
                </button>
              </header>
              <label>
                Nombre del campo <span>*</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ej. Responsable de obra"
                />
              </label>
              <p className="paper-field-hint">
                Un dato que tu equipo puede reutilizar.
              </p>
              <fieldset>
                <legend>Tipo de dato</legend>
                <div className="paper-type-options">
                  {["Texto", "Número"].map((option) => (
                    <label
                      key={option}
                      className={kind === option ? "is-selected" : ""}
                    >
                      <input
                        type="radio"
                        name="paper-kind"
                        value={option}
                        checked={kind === option}
                        onChange={() => {
                          setKind(option);
                          setFallback("");
                        }}
                      />
                      <strong>{option}</strong>
                      <small>
                        {option === "Texto"
                          ? "Nombres, referencias y notas."
                          : "Importes, cantidades y medidas."}
                      </small>
                    </label>
                  ))}
                </div>
              </fieldset>
              <label>
                Valor por defecto
                <input
                  type={kind === "Número" ? "number" : "text"}
                  placeholder={kind === "Número" ? "0" : "Opcional"}
                  value={fallback}
                  onChange={(event) => setFallback(event.target.value)}
                />
              </label>
            </section>
            <footer className="paper-form-footer">
              <button
                className="paper-text-button"
                onClick={() => {
                  setName("Responsable de obra");
                  setFallback("");
                  setKind("Texto");
                }}
              >
                Restablecer
              </button>
              <button
                className="paper-button paper-button-gloss"
                disabled={!name.trim() || saving}
                onClick={save}
              >
                {saving ? "Creando…" : "Crear campo"}
                {saving ? (
                  <span className="paper-spinner" />
                ) : (
                  <span className="paper-key">↵</span>
                )}
              </button>
            </footer>
          </div>
          <div className="paper-material-note">
            <span className="paper-kicker">EL MATERIAL, DE CERCA</span>
            <div className="paper-material-swatches">
              <span>Base</span>
              <span>Hoja</span>
              <span>Luz</span>
            </div>
            <p>
              El relieve agrupa. El brillo aparece en la acción principal y en
              el detalle del gráfico.
            </p>
          </div>
        </div>
      </div>
      <section className="paper-tray paper-documents" id="paper-documents">
        <header className="paper-documents-toolbar">
          <div>
            <h3>Documentos de obra</h3>
            <span>Todo lo necesario para el próximo cierre.</span>
          </div>
          <label className="paper-inline-search">
            <Search size={14} />
            <input
              aria-label="Buscar documentos de la demo"
              placeholder="Buscar archivo…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <SlidersHorizontal size={16} />
        </header>
        <div className="paper-sheet">
          <div className="paper-filter-tabs" aria-label="Estado de documentos">
            {["Todos", "Por revisar", "Verificados"].map((item) => (
              <button
                key={item}
                aria-pressed={filter === item}
                onClick={() => setFilter(item)}
              >
                {item}
              </button>
            ))}
            <span className="paper-spacer" />
            <span className="paper-muted">{docs.length} archivos</span>
          </div>
          <div className="paper-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>
                    Nombre <ArrowDown size={11} />
                  </th>
                  <th>Estado</th>
                  <th>Última modificación</th>
                  <th>Importe / versión</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => {
                  const index = issues.indexOf(doc);
                  return (
                    <tr key={doc.file}>
                      <td>
                        <button
                          onClick={() => {
                            setSelected(index);
                            document
                              .getElementById("paper-overview")
                              ?.scrollIntoView({ block: "start" });
                          }}
                        >
                          <FileText size={15} />
                          {doc.file}
                        </button>
                      </td>
                      <td>
                        <span className="paper-status">
                          <span
                            className={
                              confirmed.includes(index)
                                ? "paper-dot is-done"
                                : "paper-dot"
                            }
                          />
                          {confirmed.includes(index)
                            ? "Verificado"
                            : "Por revisar"}
                        </span>
                      </td>
                      <td>Hoy, 09:{42 + index * 3}</td>
                      <td>{doc.amount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!docs.length && (
              <p className="paper-empty">
                No hay documentos con estos filtros.
              </p>
            )}
          </div>
        </div>
        <footer className="paper-table-footer">
          <CircleHelp size={13} />
          Seleccioná un documento para revisar sus datos.
          <span className="paper-spacer" />4 documentos en esta demo
        </footer>
      </section>
      <div className="paper-notice" role="status">
        {notice}
      </div>
    </PaperFrame>
  );
}

const meta = {
  title: "Vibe/Papel y luz",
  component: PaperDemo,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PaperDemo>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Playground: Story = {};
