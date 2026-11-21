import React, { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ArrowUpRight, Layers, Search } from "lucide-react";
import "./review.css";

type Entry = { id: string; title: string; name: string; type: string };
const screens = [
  ["inicio", "Inicio"],
  ["excel", "Excel"],
  ["obra", "Obra"],
  ["documentos", "Documentos"],
  ["general", "General"],
  ["macrotablas", "Macrotablas"],
  ["reportes", "Reportes"],
];
function ProposalReview() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState(false);
  const [section, setSection] = useState("screens");
  const [screen, setScreen] = useState("inicio");
  const [query, setQuery] = useState("");
  const [story, setStory] = useState("app-ui-button--playground");
  const [theme, setTheme] = useState("light");
  const [comparison, setComparison] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/index.json", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("index");
        return response.json();
      })
      .then((index) =>
        setEntries(
          (Object.values(index.entries) as Entry[]).filter(
            (entry) =>
              entry.type === "story" &&
              /^(App UI|Shared system|Patterns)\//.test(entry.title),
          ),
        ),
      )
      .catch((reason) => {
        if (reason.name !== "AbortError") setError(true);
      });
    return () => controller.abort();
  }, []);
  const filtered = entries.filter((entry) =>
    `${entry.title} ${entry.name}`.toLowerCase().includes(query.toLowerCase()),
  );
  const groups = new Set(entries.map((entry) => entry.title)).size;
  const selected = entries.find((entry) => entry.id === story);
  const url = (id: string, design: string) =>
    `/iframe.html?id=${id}&viewMode=story&globals=theme:${theme};design:${design}`;
  const screenId = `rediseno-pantallas--${screen}`;
  return (
    <div className="redesign-review">
      <header>
        <div>
          <span className="redesign-eyebrow">
            SÍNTESIS / PROPUESTA DE REDISEÑO
          </span>
          <h1>Una biblioteca. Un mismo material.</h1>
          <p>
            Papel elevado, grupos sobre bandejas y vidrio esmerilado puntual.
            Sin franjas laterales de selección.
          </p>
        </div>
        <span className="redesign-review-badge">
          <Layers size={14} />
          {groups || "…"} familias · 7 pantallas
        </span>
      </header>
      <nav aria-label="Revisar propuesta">
        <button
          aria-pressed={section === "screens"}
          onClick={() => setSection("screens")}
        >
          Pantallas principales
        </button>
        <button
          aria-pressed={section === "library"}
          onClick={() => setSection("library")}
        >
          Biblioteca completa
        </button>
        <button
          aria-pressed={section === "rules"}
          onClick={() => setSection("rules")}
        >
          Criterios de diseño
        </button>
        <span />
        <label>
          Tema
          <select
            aria-label="Tema de la propuesta"
            value={theme}
            onChange={(event) => setTheme(event.target.value)}
          >
            <option value="light">Claro</option>
            <option value="dark">Oscuro</option>
          </select>
        </label>
      </nav>
      {section === "screens" && (
        <>
          <div className="redesign-screen-picker">
            {screens.map(([id, label]) => (
              <button
                key={id}
                aria-pressed={screen === id}
                onClick={() => setScreen(id)}
              >
                {label}
              </button>
            ))}
            <a href={url(screenId, "paper")} target="_blank" rel="noreferrer">
              Abrir pantalla amplia
              <ArrowUpRight size={14} />
            </a>
          </div>
          <iframe
            className="redesign-screen-frame"
            title={`Propuesta de ${screens.find(([id]) => id === screen)?.[1]}`}
            src={url(screenId, "paper")}
          />
        </>
      )}
      {section === "library" && (
        <>
          <div className="redesign-library-controls">
            <label className="redesign-search">
              <Search size={15} />
              <input
                aria-label="Buscar componente"
                placeholder="Buscar componente o estado…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <select
              aria-label="Componente y variante"
              value={story}
              onChange={(event) => setStory(event.target.value)}
            >
              {!filtered.some((entry) => entry.id === story) && selected && (
                <option value={selected.id}>
                  {selected.title} / {selected.name}
                </option>
              )}
              {filtered.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.title
                    .replace("App UI/", "")
                    .replace("Shared system/", "")}{" "}
                  / {entry.name}
                </option>
              ))}
            </select>
            <label>
              <input
                type="checkbox"
                checked={comparison}
                onChange={(event) => setComparison(event.target.checked)}
              />
              Comparar con actual local
            </label>
          </div>
          {error && (
            <p role="alert">
              No se pudo cargar el catálogo. Recargá la página.
            </p>
          )}
          <p className="redesign-review-note">
            {filtered.length} variantes encontradas. Cada lado ejecuta el mismo
            componente y sus estados con datos iniciales iguales; podés
            interactuar con cada muestra.
          </p>
          <div className="redesign-comparison" data-compare={comparison}>
            {comparison && (
              <section>
                <header>
                  <strong>Actual local</strong>
                  <a
                    href={url(story, "current")}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ampliar ↗
                  </a>
                </header>
                <iframe title="Componente actual" src={url(story, "current")} />
              </section>
            )}
            <section>
              <header>
                <strong>Propuesta · Papel</strong>
                <a href={url(story, "paper")} target="_blank" rel="noreferrer">
                  Ampliar ↗
                </a>
              </header>
              <iframe title="Componente propuesto" src={url(story, "paper")} />
            </section>
          </div>
        </>
      )}
      {section === "rules" && (
        <div className="redesign-rules">
          {[
            [
              "01",
              "Base mate",
              "El fondo sostiene una hoja principal. Las superficies cálidas separan áreas sin añadir bordes decorativos.",
            ],
            [
              "02",
              "Hoja sobre bandeja",
              "Contenido y acciones comparten un contenedor, con una hoja elevada y un pie más bajo. El relieve expresa agrupación.",
            ],
            [
              "03",
              "Selección completa",
              "Se selecciona la fila, el chip o la tarjeta completa. No se usan franjas, bordes de acento o sombras en un solo lateral.",
            ],
            [
              "04",
              "Brillo reservado",
              "Botón principal, tooltip de gráfico y detalles pequeños. El resto conserva superficies mate. El vidrio tiene transparencia real y desenfoque suave.",
            ],
            [
              "05",
              "Estados conservados",
              "Se reutilizan las galerías existentes: variantes, foco, errores, carga, selección y controles deshabilitados. Cambia la presentación, no la lógica de negocio.",
            ],
            [
              "06",
              "Aplicación gradual",
              "Primero materiales y controles compartidos, después contenedores y navegación, luego las pantallas. Reportes impresos, gráficos y visores conservan sus reglas de contenido.",
            ],
          ].map(([n, title, text]) => (
            <article key={n}>
              <span>{n}</span>
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </div>
      )}
      <footer className="redesign-review-note">
        Propuesta aislada en Storybook. Las pantallas usan datos ficticios; la
        biblioteca usa las implementaciones compartidas actuales. La aplicación
        publicada conserva su diseño.
      </footer>
    </div>
  );
}
const meta = {
  id: "rediseno-propuesta",
  title: "Rediseño/Propuesta",
  component: ProposalReview,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ProposalReview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Revision: Story = {};
