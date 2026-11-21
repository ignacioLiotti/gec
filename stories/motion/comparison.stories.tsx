import React, { Suspense, useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ExternalLink, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Chip, Tray } from "@/components/ui/tray";
import { examples } from "./catalog";
import { ReferenceSurface, useSystemMotionPreference } from "./reference-runtime";
import "./vendor/tokens.css";
import "./vendor/interior/motion.css";
import "./vendor/beautiful/motion.css";
import "./comparison.css";

function Comparison({ initialExample = "interior-loading-button" }: { initialExample?: string }) {
  const [selected, setSelected] = useState(initialExample);
  const [variant, setVariant] = useState("");
  const [generation, setGeneration] = useState(0);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todos");
  const [library, setLibrary] = useState("Todas");
  const [reduced, setReduced] = useState(false);
  const systemReduced = useSystemMotionPreference();
  const entry = examples.find(item => item.id === selected) ?? examples[0];
  const Demo = entry.Demo;
  const activeVariant = entry.variants.includes(variant) ? variant : entry.variants[0];
  const matches = examples.filter(item =>
    (category === "Todos" || item.category === category) &&
    (library === "Todas" || item.library === library) &&
    `${item.name} ${item.library} ${item.instruction}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  function select(id: string) { setSelected(id); setVariant(""); setGeneration(0); }

  return <main className="motion-lab">
    <header className="motion-lab-intro">
      <span className="motion-lab-eyebrow">SÍNTESIS / MOVIMIENTO EN STORYBOOK</span>
      <h1>Animaciones de origen, componente por componente.</h1>
      <p>40 ejemplos ejecutan las implementaciones de Interior y Beautiful UI con la paleta y tipografía de Síntesis. Cada uno conserva sus resortes, curvas, tiempos y secuencias. Seleccioná un componente para comparar sus estados.</p>
      <div className="motion-lab-summary"><Badge variant="secondary">26 Interior</Badge><Badge variant="secondary">14 Beautiful UI</Badge><Badge variant="outline">Solo Storybook</Badge></div>
    </header>
    <section className="motion-lab-workbench" aria-labelledby="motion-selected" data-example={entry.id}>
      <div className="motion-lab-heading">
        <div><p className="motion-lab-eyebrow">{entry.category} / {entry.library === "interior" ? "Interior" : "Beautiful UI"}</p><h2 id="motion-selected">{entry.name}</h2></div>
        <a href={entry.source} target="_blank" rel="noreferrer">Código original <ExternalLink size={14} /></a>
      </div>
      <p className="motion-lab-instruction">{entry.instruction}</p>
      <div className="motion-lab-controls">
        <label>Componente<NativeSelect aria-label="Componente" value={entry.id} onChange={event => select(event.target.value)}>
          {(["interior", "beautiful"] as const).map(group => <optgroup key={group} label={group === "interior" ? "Interior" : "Beautiful UI"}>{examples.filter(item => item.library === group).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>)}
        </NativeSelect></label>
        {entry.variants.length > 0 && <label>Variante<NativeSelect aria-label="Variante" value={activeVariant} onChange={event => setVariant(event.target.value)}>{entry.variants.map(value => <option key={value}>{value}</option>)}</NativeSelect></label>}
        <Button variant="outline" onClick={() => setGeneration(generation + 1)}><RotateCcw /> Reiniciar ambas muestras</Button>
        <Chip active={reduced || systemReduced === true} disabled={systemReduced === true} onClick={() => setReduced(!reduced)}>Reducir movimiento{systemReduced ? " · sistema" : ""}</Chip>
      </div>
      <div className="motion-lab-comparison" key={`${entry.id}-${activeVariant}-${generation}`}>
        {([true, false] as const).map(quiet => <section className="motion-lab-sample" key={String(quiet)} aria-label={quiet ? "Muestra reducida" : "Muestra animada"}>
          <header><h3>{quiet ? "Movimiento reducido" : `${entry.library === "interior" ? "Interior" : "Beautiful UI"} · movimiento original`}</h3><span>{quiet ? "Mismo contenido y apariencia" : "Interactuá con el componente"}</span></header>
          <div className="motion-lab-stage" data-testid={quiet ? "sample-quiet" : "sample-animated"}>
            <ReferenceSurface library={entry.library} reduced={quiet || reduced}><Suspense fallback={<p role="status">Cargando muestra…</p>}><Demo variant={activeVariant} /></Suspense></ReferenceSurface>
          </div>
        </section>)}
      </div>
      <p className="motion-lab-note">Las muestras son independientes. Reiniciar repite las secuencias automáticas. La columna reducida permite comparar el mismo contenido sin desplazamientos; no representa el comportamiento actual del producto. Las composiciones y textos de ejemplo provienen de las referencias.</p>
    </section>
    <section className="motion-lab-catalog" aria-labelledby="motion-catalog-title">
      <div className="motion-lab-heading"><h2 id="motion-catalog-title">Catálogo de interacciones</h2><span role="status">{matches.length} de {examples.length} componentes</span></div>
      <div className="motion-lab-controls">
        <label className="motion-lab-search"><span><Search size={14} /> Buscar componente</span><Input aria-label="Buscar componente" placeholder="Botón, tabla, tooltip, filtro…" value={search} onChange={event => setSearch(event.target.value)} /></label>
        <label>Biblioteca<NativeSelect aria-label="Biblioteca" value={library} onChange={event => setLibrary(event.target.value)}><option>Todas</option><option value="interior">Interior</option><option value="beautiful">Beautiful UI</option></NativeSelect></label>
      </div>
      <Tray className="flex-wrap">{["Todos", "Acciones", "Campos", "Navegación", "Capas", "Estados", "Datos"].map(value => <Chip key={value} active={category === value} onClick={() => setCategory(value)}>{value}</Chip>)}</Tray>
      <div className="motion-lab-index">{matches.map(item => <button type="button" key={item.id} className="motion-lab-entry" aria-pressed={item.id === entry.id} onClick={() => { select(item.id); document.getElementById("motion-selected")?.scrollIntoView({ block: "start" }); }}>
        <span>{item.library === "interior" ? "Interior" : "Beautiful UI"} · {item.category}</span><strong>{item.name}</strong><small>{item.variants.length > 0 ? `${item.variants.length} variantes` : "Ejemplo interactivo"}</small>
      </button>)}</div>
      {matches.length === 0 && <p>No hay componentes con estos filtros.</p>}
    </section>
    <footer className="motion-lab-note">Fuentes MIT incluidas en el proyecto. Las animaciones se importan con versiones fijadas y los estilos quedan limitados a este laboratorio. Las APIs y los datos de Síntesis no se utilizan.</footer>
  </main>;
}
const meta = {
  title: "Motion/Comparacion", component: Comparison, parameters: { layout: "padded" },
  render: args => <Comparison key={args.initialExample} {...args} />,
  args: { initialExample: "interior-loading-button" },
  argTypes: { initialExample: { control: "select", options: examples.map(item => item.id) } },
} satisfies Meta<typeof Comparison>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Playground: Story = {};
