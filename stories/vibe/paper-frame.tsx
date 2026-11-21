import React, { useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  Moon,
  Search,
  Sun,
} from "lucide-react";
import "./paper.css";
const sections = [
  ["inicio", "Resumen"],
  ["excel", "Excel"],
  ["obra", "Obra"],
  ["documentos", "Documentos"],
  ["general", "General"],
  ["macrotablas", "Macrotablas"],
  ["reportes", "Reportes"],
];
function DefaultAttention() {
  return (
    <div className="paper-tray paper-attention">
      <section className="paper-sheet">
        <header>
          <span>Requiere atención</span>
          <span className="paper-count">3</span>
        </header>
        <div>
          {[
            "Revisar certificado de agosto",
            "Completar datos de una factura",
            "Verificar plano actualizado",
          ].map((label) => (
            <a
              className="paper-attention-row"
              href="?id=rediseno-pantallas--documentos&viewMode=story"
              key={label}
            >
              <span className="paper-dot" />
              <span>{label}</span>
            </a>
          ))}
        </div>
      </section>
      <a
        className="paper-tray-footer"
        href="?id=rediseno-pantallas--documentos&viewMode=story"
      >
        <ChevronDown size={15} />
        Mostrar todo
      </a>
    </div>
  );
}
export function PaperFrame({
  children,
  attention,
  initialDark = false,
  section = "inicio",
}: {
  children: ReactNode;
  attention?: ReactNode;
  initialDark?: boolean;
  section?: string;
}) {
  const [dark, setDark] = useState(initialDark);
  const [depth, setDepth] = useState("normal");
  return (
    <div
      className="paper-demo"
      data-theme={dark ? "dark" : "light"}
      data-depth={depth}
    >
      <header className="paper-demo-toolbar">
        <div>
          <span className="paper-kicker">SÍNTESIS · ESTUDIO VISUAL 01</span>
          <h1>Papel, capas y luz.</h1>
          <p>
            Una dirección para probar. Todos los datos y cambios son locales.
          </p>
        </div>
        <div className="paper-demo-options">
          <label>
            Relieve
            <select
              aria-label="Intensidad del relieve"
              value={depth}
              onChange={(event) => setDepth(event.target.value)}
            >
              <option value="soft">Sutil</option>
              <option value="normal">Medio</option>
              <option value="high">Marcado</option>
            </select>
          </label>
          <button
            className="paper-icon-button"
            aria-label={dark ? "Usar tema claro" : "Usar tema oscuro"}
            onClick={() => {
              setDark(!dark);
              document.documentElement.classList.toggle("dark", !dark);
            }}
          >
            {dark ? <Sun /> : <Moon />}
          </button>
        </div>
      </header>
      <div className="paper-workspace">
        <aside className="paper-sidebar">
          <div className="paper-brand">
            <span />{" "}
            <div>
              Síntesis<small>ESPACIO DE TRABAJO</small>
            </div>
          </div>
          <a
            className="paper-sidebar-search"
            href="?id=rediseno-pantallas--documentos&viewMode=story"
          >
            <Search size={16} />
            Buscar documentos<kbd>/</kbd>
          </a>
          <nav aria-label="Pantallas de Síntesis">
            {sections.map(([id, label]) => (
              <a
                key={id}
                href={`?id=rediseno-pantallas--${id}&viewMode=story`}
                className={section === id ? "paper-nav-active" : undefined}
                aria-current={section === id ? "page" : undefined}
              >
                <Folder size={16} />
                {label}
              </a>
            ))}
          </nav>
          {attention ?? <DefaultAttention />}
          <div className="paper-sidebar-projects">
            <span className="paper-muted">Obras recientes</span>
            <button
              onClick={() => {
                window.location.href =
                  "?id=rediseno-pantallas--obra&viewMode=story";
              }}
            >
              <Folder />
              Torre Madero
            </button>
            <div className="paper-project-meta">Dique 2 · En ejecución</div>
          </div>
          <footer className="paper-user">
            <span>MA</span>
            <div>
              María Álvarez<small>Equipo de obras</small>
            </div>
            <ChevronDown size={14} />
          </footer>
        </aside>
        <main className="paper-main" id="paper-overview">
          <header className="paper-breadcrumb">
            <span>Obras</span>
            <ChevronRight size={13} />
            <span>Torre Madero</span>
            <span className="paper-spacer" />
            <span className="paper-live-dot" />
            Actualizado hoy
          </header>
          {children}
        </main>
      </div>
      <footer className="paper-demo-caption">
        Propuesta de diseño · Datos y cambios locales para evaluar las
        pantallas.
      </footer>
    </div>
  );
}
