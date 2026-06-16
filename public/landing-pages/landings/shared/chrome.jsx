/* global React */
const { useState, useEffect, useRef } = React;

// ============================================================
// PRIMITIVES + CHROME — shared by both landings
// ============================================================

// Lucide-style inline icons
const Icon = ({ size = 16, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);
const IArrow   = (p) => <Icon {...p}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></Icon>;
const ICheck   = (p) => <Icon {...p}><polyline points="20 6 9 17 4 12"/></Icon>;
const IPlay    = (p) => <Icon {...p}><polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none"/></Icon>;
const ISpark   = (p) => <Icon {...p}><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></Icon>;
const IAlert   = (p) => <Icon {...p}><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></Icon>;
const IFolder  = (p) => <Icon {...p}><path d="M4 20a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3l2 3h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2z"/></Icon>;
const ILayers  = (p) => <Icon {...p}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></Icon>;
const ITable   = (p) => <Icon {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></Icon>;
const IShield  = (p) => <Icon {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></Icon>;
const IZap     = (p) => <Icon {...p}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></Icon>;
const IBell    = (p) => <Icon {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></Icon>;
const IUsers   = (p) => <Icon {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></Icon>;
const IWallet  = (p) => <Icon {...p}><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><circle cx="17" cy="14" r="1.5"/></Icon>;
const IChart   = (p) => <Icon {...p}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></Icon>;
const IDoc     = (p) => <Icon {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></Icon>;
const IRefresh= (p) => <Icon {...p}><polyline points="23 4 23 10 17 10"/><path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10"/></Icon>;
const IBuilding= (p) => <Icon {...p}><rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01"/></Icon>;
const IKey     = (p) => <Icon {...p}><path d="M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3"/></Icon>;
const IEye     = (p) => <Icon {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></Icon>;
const IFilter  = (p) => <Icon {...p}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></Icon>;
const ITrend   = (p) => <Icon {...p}><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></Icon>;
const IClock   = (p) => <Icon {...p}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></Icon>;
const IDownload= (p) => <Icon {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></Icon>;

Object.assign(window, {
  IArrow, ICheck, IPlay, ISpark, IAlert, IFolder, ILayers, ITable, IShield, IZap,
  IBell, IUsers, IWallet, IChart, IDoc, IRefresh, IBuilding, IKey, IEye, IFilter, ITrend, IClock, IDownload,
});

// ============================================================
// NAV
// ============================================================
function Nav({ variant }) {
  const cross = variant === "operativo"
    ? { href: "Sintesis - Financiero.html", label: "Ver enfoque financiero" }
    : { href: "Sintesis - Operativo.html", label: "Ver enfoque operativo" };
  return (
    <nav className="nav">
      <div className="nav-inner">
        <a className="nav-brand" href="Sintesis - Principal.html">
          <span className="nav-brand-dot" />
          Sintesis
        </a>
        <div className="nav-links">
          <a href="#producto">Producto</a>
          <a href="#flujo">Flujo</a>
          <a href="#modulos">Módulos</a>
          <a href="#ficha">Ficha técnica</a>
          <a href="#preguntas">Preguntas</a>
          <a href={cross.href} style={{ color: "var(--stone-500)" }}>{cross.label}</a>
        </div>
        <div className="nav-actions">
          <button className="btn btn-ghost">Ingresar</button>
          <button className="btn btn-primary">Agendar demo <IArrow size={14} /></button>
        </div>
      </div>
    </nav>
  );
}

// ============================================================
// HERO BACKGROUND — soft warm gradient + blueprint contours + orange glow
// ============================================================
function HeroBackground({ variant }) {
  return (
    <svg className="hero-bg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="warm-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#fdf3e2" />
          <stop offset="35%" stopColor="#f8eedb" />
          <stop offset="100%" stopColor="#f7f5f1" />
        </linearGradient>
        <radialGradient id="orange-halo" cx="50%" cy="42%" r="40%">
          <stop offset="0%"  stopColor={variant === "financiero" ? "#ff8a3d" : "#ff5800"} stopOpacity="0.32" />
          <stop offset="55%" stopColor="#ffb778" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#ffb778" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="dot-fade" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000" stopOpacity="0.06"/>
          <stop offset="100%" stopColor="#000" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#warm-sky)"/>
      {/* Topographic contour lines — represents site survey, very subtle */}
      <g fill="none" stroke="#c8a87d" strokeOpacity="0.18" strokeWidth="1">
        {[...Array(24)].map((_, i) => (
          <path
            key={i}
            d={`M -100,${120 + i*36} Q 320,${80 + i*36 + (i%2 ? 18 : -8)} 760,${140 + i*36 + (i%3?12:-18)} T 1700,${100 + i*36}`}
          />
        ))}
      </g>
      {/* faint architectural grid */}
      <g stroke="#c8a87d" strokeOpacity="0.10" strokeWidth="0.8">
        {[...Array(20)].map((_, i) => (
          <line key={"v"+i} x1={i*80} y1="0" x2={i*80} y2="900" />
        ))}
      </g>
      {/* central orange halo */}
      <rect width="1600" height="900" fill="url(#orange-halo)"/>
      {/* paper dot noise */}
      {[...Array(80)].map((_, i) => {
        const cx = (i * 73) % 1600;
        const cy = (i * 131) % 900;
        return <circle key={"d"+i} cx={cx} cy={cy} r="1" fill="#7c5a2e" opacity={(i%5)/40 + 0.04}/>;
      })}
      {/* vignette */}
      <rect width="1600" height="900" fill="url(#dot-fade)"/>
    </svg>
  );
}

// ============================================================
// HERO
// ============================================================
function Hero({ variant, eyebrow, title, lead, primaryCta, secondaryCta, trust }) {
  return (
    <section className="hero">
      <HeroBackground variant={variant} />
      <div className="wrap-narrow">
        <div className="hero-eyebrow-row">
          <span className="hero-eyebrow">
            <span className="hero-eyebrow-dot" />
            {eyebrow}
          </span>
        </div>
        <h1 className="serif-display hero-title" dangerouslySetInnerHTML={{ __html: title }} />
        <p className="hero-lead">{lead}</p>
        <div className="hero-cta-row">
          <button className={variant === "financiero" ? "btn btn-orange" : "btn btn-primary"}>
            {primaryCta} <IArrow size={14} />
          </button>
          <button className="btn btn-light">{secondaryCta}</button>
        </div>
        <div className="hero-trust">
          {trust.map(t => <span key={t}>{t}</span>)}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// STATS STRIP (3 big numbers)
// ============================================================
function StatsStrip({ items }) {
  return (
    <section className="stats">
      <div className="stats-inner">
        {items.map((it, i) => (
          <div className="stat-cell" key={i}>
            <div className="stat-eyebrow">{it.eyebrow}</div>
            <div className={"stat-value" + (it.orange ? " orange" : "")}>{it.value}</div>
            <div className="stat-label">{it.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ============================================================
// FOOTER
// ============================================================
function Footer({ variant }) {
  const links = [
    { h: "Producto", items: ["Obras", "Documentos", "Macro Tablas", "Reportes", "Permisos"] },
    { h: "Enfoques", items: ["Operativo", "Financiero", "Dirección", "Obra pública"] },
    { h: "Recursos",  items: ["Documentación", "Changelog", "Estado", "Contacto"] },
  ];
  return (
    <footer className="footer" style={{ background: "#f1ede5" }}>
      <div className="wrap" style={{ padding: "32px 0 8px" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1.3fr 1fr 1fr 1fr",
          gap: 40,
          paddingBottom: 36,
          borderBottom: "1px solid rgba(28,25,23,.08)",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span className="nav-brand-dot" />
              <span style={{ fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", fontSize: 13 }}>Sintesis</span>
            </div>
            <p style={{ margin: 0, color: "var(--stone-600)", fontSize: 14, lineHeight: 1.55, maxWidth: 36 + "ch" }}>
              Sistema operativo para constructoras. Centraliza obras, documentos, certificados, tablas, permisos y reportes en una plataforma configurable por organización.
            </p>
          </div>
          {links.map(col => (
            <div key={col.h}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--stone-500)", marginBottom: 14 }}>{col.h}</div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
                {col.items.map(x => (
                  <li key={x}>
                    <a href="#" style={{ color: "var(--stone-700)", fontSize: 14, textDecoration: "none" }}>{x}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="footer-inner" style={{ padding: "20px 0 0" }}>
          <div className="footer-meta">Sintesis Cloud Solutions &middot; Control de Ingeniería de Próxima Generación</div>
          <div className="footer-meta">Buenos Aires &middot; Corrientes &middot; Córdoba</div>
        </div>
      </div>
    </footer>
  );
}

Object.assign(window, { Nav, Hero, HeroBackground, StatsStrip, Footer });
