/* global React */
const { useState } = React;

// ============================================================
// DS PRIMITIVES — mirror components/ui/button.tsx, tray.tsx,
// tabs.tsx and app-sidebar.tsx so every mock reads like the app
// ============================================================

// Lifted button recipe (components/ui/button.tsx): rounded-lg,
// 12px medium, border-black/15, hue-matched 2-layer shadow + glint.
const UIButton = ({ variant = "outline", size = "sm", icon, children, style = {}, ...rest }) => {
  const recipes = {
    default: {
      background: "var(--orange-primary)", color: "#FAF9F5",
      border: "1px solid rgba(0,0,0,.15)",
      boxShadow: "0 1px 3px rgba(180,90,30,.35), 0 2px 6px rgba(180,90,30,.20), inset 0 1px 0 rgba(255,255,255,.15)",
    },
    dark: {
      background: "var(--stone-900)", color: "#fafaf9",
      border: "1px solid rgba(0,0,0,.15)",
      boxShadow: "0 1px 3px rgba(0,0,0,.35), 0 2px 6px rgba(0,0,0,.20), inset 0 1px 0 rgba(255,255,255,.10)",
    },
    outline: {
      background: "var(--stone-100)", color: "var(--stone-700)",
      border: "1px solid rgba(0,0,0,.15)",
      boxShadow: "0 1px 2px rgba(0,0,0,.06), 0 1px 3px rgba(0,0,0,.04), inset 0 1px 0 rgba(255,255,255,.70)",
    },
    ghost: {
      background: "transparent", color: "var(--stone-700)",
      border: "1px solid transparent", boxShadow: "none",
    },
  };
  const sizes = {
    xs: { height: 28, padding: "0 10px" },
    sm: { height: 32, padding: "0 12px" },
    md: { height: 36, padding: "0 16px" },
  };
  return (
    <button style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
      borderRadius: 8, fontSize: 12, fontWeight: 500, fontFamily: "var(--font-sans)",
      cursor: "pointer", whiteSpace: "nowrap",
      ...recipes[variant], ...sizes[size], ...style,
    }} {...rest}>
      {icon}{children}
    </button>
  );
};

// Badge — rounded-full, soft tonal bg (DS: badges/tags = rounded-full)
const StatusBadge = ({ tone = "stone", children }) => {
  const tones = {
    green:  { bg: "#dcfce7", fg: "#15803d" },
    amber:  { bg: "#fef3c7", fg: "#b45309" },
    red:    { bg: "#fee2e2", fg: "#b91c1c" },
    orange: { bg: "#ffedd5", fg: "#c2410c" },
    stone:  { bg: "var(--stone-100)", fg: "var(--stone-600)" },
  }[tone];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "2px 10px", borderRadius: 9999,
      background: tones.bg, color: tones.fg,
      fontSize: 11, fontWeight: 500, whiteSpace: "nowrap",
    }}>{children}</span>
  );
};

// Tray + Chip (components/ui/tray.tsx): white tray, stone-200 border,
// rounded-xl, p-1; chip pill rounded-lg, active = stone-100 fill
const UITray = ({ children, style }) => (
  <div style={{
    display: "inline-flex", alignItems: "center", gap: 4, padding: 4,
    background: "#fff", border: "1px solid var(--stone-200)",
    borderRadius: 12, boxShadow: "0 1px 0 rgba(0,0,0,.03)", ...style,
  }}>{children}</div>
);
const UIChip = ({ active, dark, dot, children, ...rest }) => (
  <button style={{
    display: "inline-flex", alignItems: "center", gap: 6,
    height: 28, padding: "0 12px", borderRadius: 8, border: 0,
    cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12,
    fontWeight: active || dark ? 500 : 400,
    background: dark ? "var(--stone-900)" : active ? "var(--stone-100)" : "transparent",
    color: dark ? "#fff" : active ? "var(--stone-900)" : "var(--stone-700)",
  }} {...rest}>
    {dot && <span style={{ width: 7, height: 7, borderRadius: 9999, background: `var(--src-${dot})`, display: "inline-block" }} />}
    {children}
  </button>
);

// Segment control (DS §8): gray tray + white active pill
const SegmentControl = ({ options, value, onChange }) => (
  <div style={{
    display: "inline-flex", alignItems: "center", borderRadius: 12,
    border: "1px solid #e8e8e8", background: "#f5f5f4", padding: 4,
  }}>
    {options.map((o) => (
      <button key={o} onClick={() => onChange && onChange(o)} style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 500,
        border: 0, cursor: "pointer", fontFamily: "var(--font-sans)",
        background: value === o ? "#fff" : "transparent",
        color: value === o ? "#1a1a1a" : "#999",
        boxShadow: value === o ? "0 1px 2px rgba(0,0,0,.08)" : "none",
        transition: "all .15s",
      }}>{o}</button>
    ))}
  </div>
);

// Top-nav tabs (excel-page-tabs.tsx): dark pill, active = #1a1a1a fill
const PillTabs = ({ tabs, active = 0 }) => (
  <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
    {tabs.map((t, i) => (
      <div key={t} style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        height: 32, padding: "0 14px", borderRadius: 10,
        fontSize: 13, fontWeight: 500,
        background: i === active ? "#1a1a1a" : "transparent",
        color: i === active ? "#fff" : "#999",
      }}>{t}</div>
    ))}
  </div>
);

const ProgressBar = ({ value, color = "var(--orange-primary)" }) => (
  <div style={{ height: 6, width: "100%", background: "var(--stone-100)", borderRadius: 9999 }}>
    <div style={{ height: 6, width: value + "%", background: color, borderRadius: 9999 }} />
  </div>
);

const Dot = ({ color, size = 8 }) => (
  <span style={{ width: size, height: size, borderRadius: 9999, background: color, display: "inline-block" }} />
);

// Shell card (DS §10): rounded-xl, border #e8e8e8, white
const cardStyle = {
  background: "#fff", borderRadius: 12,
  border: "1px solid #e8e8e8", overflow: "hidden",
};

// Table cells (DS §4): header px-4 py-2 semibold; rows px-4 py-1.5 text-sm
const thStyle = {
  fontSize: 11, fontWeight: 600, color: "var(--stone-500)",
  padding: "8px 16px", background: "var(--stone-50)",
  borderBottom: "1px solid var(--stone-200)",
};
const tdRow = (last) => ({
  padding: "7px 16px", fontSize: 13, alignItems: "center",
  borderBottom: last ? "none" : "1px solid var(--stone-100)",
});

// ============================================================
// APP SHELL — topbar only (sidebar removed from previews)
// ============================================================
const MockChrome = ({ children, breadcrumb }) => (
  <div style={{ display: "flex", flexDirection: "column", minHeight: 480, background: "var(--background)", fontFamily: "var(--font-sans)" }}>
    <div style={{
      padding: "10px 20px", borderBottom: "1px solid rgba(28,25,23,.06)",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      background: "#fff", flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 18, height: 18, borderRadius: 9999, background: "var(--orange-primary)" }} />
          <span style={{ fontWeight: 700, fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--stone-900)" }}>Sintesis</span>
        </div>
        <div style={{ width: 1, height: 14, background: "var(--stone-200)" }} />
        <div style={{ fontSize: 12, color: "var(--stone-500)" }}>{breadcrumb}</div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 11, color: "var(--stone-500)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px", border: "1px solid var(--stone-200)", borderRadius: 8, background: "var(--stone-50)" }}>
          Buscar
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "1px 5px", borderRadius: 4, background: "#fff", border: "1px solid var(--stone-200)", color: "var(--stone-600)" }}>⌘K</span>
        </span>
        <IBell size={14} />
        <div style={{ width: 26, height: 26, borderRadius: 9999, background: "var(--stone-700)", color: "#fff", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>IL</div>
      </div>
    </div>
    <div style={{ padding: 20, flex: 1, minWidth: 0 }}>{children}</div>
  </div>
);

// ============================================================
// OBRAS OVERVIEW (financiero / operativo flavor)
// ============================================================
function ObrasOverview({ variant }) {
  const rows = variant === "financiero"
    ? [
        { name: "Escuela Tecnica – Etapa II",  ent: "Min. Educacion Corrientes", avance: 38, plazo: 52, saldo: "$42.1M", risk: "alto" },
        { name: "Centro de Salud – Refaccion", ent: "Municipio de Goya",         avance: 64, plazo: 58, saldo: "$18.2M", risk: "medio" },
        { name: "Red Cloacal – Tramo Norte",   ent: "AySA",                       avance: 12, plazo: 31, saldo: "$87.4M", risk: "alto" },
        { name: "Pavimento Av. San Martin",    ent: "Provincia de Buenos Aires", avance: 88, plazo: 80, saldo: "$6.3M",  risk: "bajo" },
        { name: "Polideportivo Municipal",     ent: "Municipio de Mercedes",     avance: 45, plazo: 47, saldo: "$28.9M", risk: "medio" },
      ]
    : [
        { name: "Escuela Tecnica – Etapa II",  ent: "Min. Educacion Corrientes", avance: 38, equipo: 12, pendientes: 8,  risk: "active" },
        { name: "Centro de Salud – Refaccion", ent: "Municipio de Goya",         avance: 64, equipo: 9,  pendientes: 3,  risk: "active" },
        { name: "Red Cloacal – Tramo Norte",   ent: "AySA",                       avance: 12, equipo: 18, pendientes: 14, risk: "active" },
        { name: "Pavimento Av. San Martin",    ent: "Provincia de Buenos Aires", avance: 88, equipo: 7,  pendientes: 1,  risk: "close" },
        { name: "Polideportivo Municipal",     ent: "Municipio de Mercedes",     avance: 45, equipo: 11, pendientes: 5,  risk: "active" },
      ];

  const riskTone = { alto: "red", medio: "amber", bajo: "green" };
  const cols = variant === "financiero" ? "1.8fr 1.1fr 1.4fr 80px 90px" : "1.8fr 1.1fr 1.4fr 60px 100px";

  return (
    <MockChrome breadcrumb="Constructora Norte / Excel / Obras" active="Excel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--stone-500)", letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 600 }}>Cartera activa</div>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 24, color: "var(--stone-900)", marginTop: 4 }}>
            {variant === "financiero" ? "$182.9M de contrato registrado" : "5 obras en ejecución"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <UITray>
            <UIChip active>Todas</UIChip>
            <UIChip>En obra</UIChip>
            <UIChip>Por cerrar</UIChip>
          </UITray>
          <UIButton variant="outline" size="sm" icon={<IFilter size={13} />}>Filtros</UIButton>
          <UIButton variant="dark" size="sm">+ Nueva obra</UIButton>
        </div>
      </div>
      <div style={cardStyle}>
        <div style={{ display: "grid", gridTemplateColumns: cols, ...thStyle, padding: 0 }}>
          <div style={{ padding: "8px 16px" }}>Obra</div>
          <div style={{ padding: "8px 16px" }}>Entidad</div>
          <div style={{ padding: "8px 16px" }}>Avance</div>
          {variant === "financiero"
            ? <div style={{ padding: "8px 16px", textAlign: "right" }}>Saldo</div>
            : <div style={{ padding: "8px 16px", textAlign: "right" }}>Equipo</div>}
          <div style={{ padding: "8px 16px", textAlign: "right" }}>{variant === "financiero" ? "Riesgo" : "Estado"}</div>
        </div>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: cols, ...tdRow(i === rows.length - 1), padding: 0 }}>
            <div style={{ padding: "8px 16px", color: "var(--stone-900)", fontWeight: 500 }}>{r.name}</div>
            <div style={{ padding: "8px 16px", color: "var(--stone-500)" }}>{r.ent}</div>
            <div style={{ padding: "8px 16px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1 }}><ProgressBar value={r.avance} color={r.avance > 60 ? "#16a34a" : r.avance > 30 ? "var(--orange-primary)" : "#dc2626"} /></div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--stone-700)", minWidth: 32, textAlign: "right" }}>{r.avance}%</div>
            </div>
            {variant === "financiero"
              ? <div style={{ padding: "8px 16px", fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--stone-900)", textAlign: "right" }}>{r.saldo}</div>
              : <div style={{ padding: "8px 16px", fontFamily: "var(--font-mono)", color: "var(--stone-700)", textAlign: "right" }}>{r.equipo}</div>}
            <div style={{ padding: "6px 16px", display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
              {variant === "financiero"
                ? <StatusBadge tone={riskTone[r.risk]}>{r.risk}</StatusBadge>
                : <StatusBadge tone={r.risk === "active" ? "orange" : "stone"}>{r.risk === "active" ? "En obra" : "Por cerrar"}</StatusBadge>}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 12, fontSize: 11, color: "var(--stone-500)", alignItems: "center" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Dot color="var(--src-extraction)" size={7} /> Dato extraído de documento</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Dot color="var(--src-manual)" size={7} /> Carga manual</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Dot color="var(--src-mixed)" size={7} /> Mixto</span>
        <span style={{ marginLeft: "auto" }}>Exportar: <b style={{ color: "var(--stone-700)" }}>Excel · PDF</b></span>
      </div>
    </MockChrome>
  );
}

// ============================================================
// OBRA DETAIL — top-nav dark-pill tabs + KPIs + activity rail
// ============================================================
function ObraDetail({ variant }) {
  return (
    <MockChrome breadcrumb="Excel / Obras / Centro de Salud – Refacción" active="Excel">
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--stone-500)", marginBottom: 6 }}>Municipio de Goya · OB-2401</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 26, color: "var(--stone-900)", lineHeight: 1.1 }}>Centro de Salud – Refacción</div>
          <div style={{ display: "flex", gap: 8 }}>
            <UIButton variant="outline" size="sm">Compartir</UIButton>
            <UIButton variant="dark" size="sm" icon={<IDoc size={13} />}>Generar reporte</UIButton>
          </div>
        </div>
      </div>

      {/* top-nav tabs: dark pill (excel-page-tabs pattern) */}
      <div style={{ marginBottom: 12 }}>
        <PillTabs tabs={["General", "Flujo", "Documentos", "Certificados", "Gastos", "Reportes"]} active={0} />
      </div>

      <div style={{ ...cardStyle, padding: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
          {(variant === "financiero" ? [
            { l: "Avance", v: "64%", sub: "+4pp vs mes ant.", c: "#16a34a" },
            { l: "Plazo",  v: "58%", sub: "12 días atraso",   c: "var(--orange-primary)" },
            { l: "Saldo a certificar", v: "$18.2M", sub: "3 certs pendientes", c: "var(--stone-700)" },
            { l: "Desvío acumulado",   v: "-7.4%",  sub: "vs curva plan",      c: "#dc2626" },
          ] : [
            { l: "Avance", v: "64%", sub: "+4pp esta semana", c: "#16a34a" },
            { l: "Equipo activo", v: "9",  sub: "3 roles distintos", c: "var(--stone-700)" },
            { l: "Pendientes", v: "3", sub: "1 vence hoy", c: "var(--orange-primary)" },
            { l: "Documentos", v: "147", sub: "12 sin clasificar", c: "var(--stone-700)" },
          ]).map((k, i) => (
            <div key={i} style={{ padding: "12px 14px", background: "var(--stone-50)", borderRadius: 8, border: "1px solid var(--stone-100)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--stone-500)" }}>{k.l}</div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 28, color: k.c, marginTop: 6, lineHeight: 1 }}>{k.v}</div>
              <div style={{ fontSize: 10.5, color: "var(--stone-500)", marginTop: 6 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--stone-500)", marginBottom: 8 }}>Actividad reciente</div>
        {(variant === "financiero" ? [
          { tag: "CERT", title: "Certificado N° 7 emitido por $4.8M", time: "hace 12 min", who: "Ignacio L." },
          { tag: "ALERT", title: "Curva financiera por debajo del plan", time: "hace 1 h", who: "Sistema" },
          { tag: "DOC", title: "OC 0421 procesada — 12 items extraídos", time: "hace 3 h", who: "Sistema" },
          { tag: "GASTO", title: "Gasto cargado: hormigón H21 — $640k", time: "hoy 09:14", who: "M. Pérez" },
        ] : [
          { tag: "FLUJO", title: "Recordatorio: revisión quincenal mañana 10hs", time: "hace 8 min", who: "Calendario" },
          { tag: "DOC", title: "Nuevo plano subido en /Documentos/Técnico", time: "hace 1 h", who: "C. López" },
          { tag: "ROL", title: "Permiso de Contador habilitado para Compras", time: "hace 3 h", who: "Admin" },
          { tag: "PEND", title: "3 tareas asignadas al equipo de campo", time: "hoy 09:14", who: "Coordinación" },
        ]).map((a, i) => (
          <div key={i} style={{
            display: "grid",
            gridTemplateColumns: "70px 1fr auto",
            gap: 12, alignItems: "center",
            padding: "8px 12px", borderTop: i ? "1px solid var(--stone-100)" : "none",
            fontSize: 13,
          }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".1em", color: "var(--stone-500)" }}>{a.tag}</div>
            <div style={{ color: "var(--stone-900)" }}>{a.title}</div>
            <div style={{ fontSize: 10.5, color: "var(--stone-500)" }}>{a.time} · {a.who}</div>
          </div>
        ))}
      </div>
    </MockChrome>
  );
}

// ============================================================
// PERMISOS / RBAC MATRIX
// ============================================================
function PermisosMatrix() {
  const roles = ["Admin", "Obra Mgr", "Contador", "Técnico", "Dirección"];
  const modules = [
    { m: "Obras",          a: [true, true, false, true, true] },
    { m: "Documentos",     a: [true, true, true,  true, true] },
    { m: "Certificados",   a: [true, true, true,  false, true] },
    { m: "Gastos",         a: [true, true, true,  false, true] },
    { m: "Reportes",       a: [true, true, true,  false, true] },
    { m: "Configuración",  a: [true, false, false, false, false] },
    { m: "Secretos API",   a: [true, false, false, false, false] },
  ];
  return (
    <MockChrome breadcrumb="Administración / Roles y Permisos" active="Roles y Permisos">
      <div style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--stone-500)" }}>Roles de la organización</div>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 24, color: "var(--stone-900)", marginTop: 4 }}>Permisos por módulo y rol</div>
        </div>
        <UIButton variant="dark" size="sm">+ Nuevo rol</UIButton>
      </div>
      <div style={cardStyle}>
        <div style={{ display: "grid", gridTemplateColumns: `1.2fr repeat(${roles.length}, 1fr)`, ...thStyle, padding: "8px 16px" }}>
          <div>Módulo</div>
          {roles.map(r => <div key={r} style={{ textAlign: "center" }}>{r}</div>)}
        </div>
        {modules.map((mod, i) => (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: `1.2fr repeat(${roles.length}, 1fr)`,
            ...tdRow(i === modules.length - 1),
          }}>
            <div style={{ color: "var(--stone-900)", fontWeight: 500 }}>{mod.m}</div>
            {mod.a.map((ok, j) => (
              <div key={j} style={{ textAlign: "center" }}>
                {ok
                  ? <span style={{ display: "inline-flex", width: 18, height: 18, borderRadius: 4, background: "var(--orange-primary)", color: "#fff", alignItems: "center", justifyContent: "center", fontSize: 10 }}>✓</span>
                  : <span style={{ display: "inline-block", width: 18, height: 18, borderRadius: 4, border: "1px dashed var(--stone-300)" }} />}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 11, color: "var(--stone-500)", alignItems: "center" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Dot color="var(--orange-primary)" /> Permitido</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, border: "1px dashed var(--stone-400)", borderRadius: 2 }} /> Sin acceso</span>
        <span style={{ marginLeft: "auto", color: "var(--stone-700)" }}>Override por obra: <b>12 reglas activas</b></span>
      </div>
    </MockChrome>
  );
}

// ============================================================
// FLUJO BOARD — workflow / pending tasks
// ============================================================
function FlujoBoard() {
  const items = [
    { tag: "Alerta",       text: "Póliza Norte II vence en 2 días",            meta: "Vence 31/05",  c: "#dc2626" },
    { tag: "Recordatorio", text: "Cargar certificado N° 7 — Centro de Salud",  meta: "Hoy 16:00",    c: "var(--orange-primary)" },
    { tag: "Calendario",   text: "Visita a obra Polideportivo",                meta: "Jue 30/05",    c: "#9333ea" },
    { tag: "Notificación", text: "Adicional 03 subido por M. Pérez",           meta: "hace 2 h",     c: "#2563eb" },
    { tag: "Alerta",       text: "3 documentos pendientes de revisión",        meta: "Escuela Téc.", c: "#dc2626" },
    { tag: "Recordatorio", text: "Reporte mensual a dirección",                meta: "Vie 31/05",    c: "var(--orange-primary)" },
  ];
  return (
    <MockChrome breadcrumb="Notificaciones / Esta semana" active="Notificaciones">
      <div style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--stone-500)" }}>Notificaciones y recordatorios</div>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 24, color: "var(--stone-900)", marginTop: 4 }}>Actividad de la obra</div>
        </div>
        <UITray>
          <UIChip active>Todas</UIChip>
          <UIChip>Alertas</UIChip>
          <UIChip>Recordatorios</UIChip>
        </UITray>
      </div>
      <div style={cardStyle}>
        {items.map((it, i) => (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: "auto 96px 1fr auto", gap: 12,
            ...tdRow(i === items.length - 1), padding: "10px 16px",
          }}>
            <Dot color={it.c} size={7} />
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: it.c }}>{it.tag}</div>
            <div style={{ fontSize: 12.5, color: "var(--stone-800)" }}>{it.text}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--stone-500)" }}>{it.meta}</div>
          </div>
        ))}
      </div>
    </MockChrome>
  );
}

// ============================================================
// CERTIFICADOS — financial cycle table
// ============================================================
function CertificadosTable() {
  const rows = [
    { n: "C-007", obra: "Centro de Salud",   monto: "$4.80M", emit: "12/05",  est: "Facturado", pag: "—",     tone: "amber" },
    { n: "C-006", obra: "Centro de Salud",   monto: "$3.20M", emit: "28/04",  est: "Cobrado",   pag: "10/05", tone: "green" },
    { n: "C-014", obra: "Escuela Téc.",      monto: "$6.10M", emit: "02/05",  est: "Pendiente", pag: "—",     tone: "red" },
    { n: "C-013", obra: "Escuela Téc.",      monto: "$5.40M", emit: "18/04",  est: "Cobrado",   pag: "29/04", tone: "green" },
    { n: "C-022", obra: "Red Cloacal",       monto: "$9.80M", emit: "07/05",  est: "Facturado", pag: "—",     tone: "amber" },
    { n: "C-001", obra: "Polideportivo",     monto: "$2.30M", emit: "01/05",  est: "Pendiente", pag: "—",     tone: "red" },
  ];
  const cols = "70px 1.4fr 1fr 80px 110px 90px";
  return (
    <MockChrome breadcrumb="Excel / Obras / Certificados" active="Excel">
      <div style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--stone-500)" }}>Ciclo de cobro</div>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 24, color: "var(--stone-900)", marginTop: 4 }}>Certificados &amp; facturación</div>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center", fontSize: 11 }}>
          <div><span style={{ color: "var(--stone-500)" }}>Total emitido</span> <b style={{ color: "var(--stone-900)", fontFamily: "var(--font-mono)" }}>$31.6M</b></div>
          <div><span style={{ color: "var(--stone-500)" }}>Por cobrar</span> <b style={{ color: "#b45309", fontFamily: "var(--font-mono)" }}>$16.9M</b></div>
          <UIButton variant="outline" size="sm" icon={<IDownload size={13} />}>Exportar</UIButton>
        </div>
      </div>
      <div style={cardStyle}>
        <div style={{ display: "grid", gridTemplateColumns: cols, ...thStyle, padding: "8px 16px" }}>
          <div>N°</div>
          <div>Obra</div>
          <div style={{ textAlign: "right" }}>Monto</div>
          <div style={{ textAlign: "right" }}>Emisión</div>
          <div style={{ textAlign: "center" }}>Estado</div>
          <div style={{ textAlign: "right" }}>Cobro</div>
        </div>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: cols, ...tdRow(i === rows.length - 1) }}>
            <div style={{ fontFamily: "var(--font-mono)", color: "var(--stone-700)", fontSize: 12 }}>{r.n}</div>
            <div style={{ color: "var(--stone-900)" }}>{r.obra}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--stone-900)", textAlign: "right" }}>{r.monto}</div>
            <div style={{ fontFamily: "var(--font-mono)", color: "var(--stone-600)", textAlign: "right", fontSize: 11 }}>{r.emit}</div>
            <div style={{ textAlign: "center" }}><StatusBadge tone={r.tone}>{r.est}</StatusBadge></div>
            <div style={{ fontFamily: "var(--font-mono)", color: "var(--stone-500)", textAlign: "right", fontSize: 11 }}>{r.pag}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 12, fontSize: 11, color: "var(--stone-500)" }}>
        <span>Tabla editable: doble clic para corregir estado, fecha o nota.</span>
        <span style={{ marginLeft: "auto" }}>Cada fila enlaza al certificado PDF que la respalda.</span>
      </div>
    </MockChrome>
  );
}

// ============================================================
// AVANCE VS PLAZO — chart-style mock
// ============================================================
function AvanceVsPlazo() {
  const obras = [
    { n: "Centro de Salud", av: 64, pl: 58, dx: "+6", c: "#16a34a" },
    { n: "Escuela Técnica", av: 38, pl: 52, dx: "-14", c: "#dc2626" },
    { n: "Red Cloacal",     av: 12, pl: 31, dx: "-19", c: "#dc2626" },
    { n: "Pavimento SM",    av: 88, pl: 80, dx: "+8",  c: "#16a34a" },
    { n: "Polideportivo",   av: 45, pl: 47, dx: "-2",  c: "var(--orange-primary)" },
  ];
  return (
    <MockChrome breadcrumb="Dashboard / Avance vs plazo" active="Dashboard">
      <div style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--stone-500)" }}>Curva física vs cronograma</div>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 24, color: "var(--stone-900)", marginTop: 4 }}>2 obras para revisar</div>
        </div>
        <SegmentControl options={["Mes", "Trimestre", "Obra"]} value="Obra" />
      </div>
      <div style={{ ...cardStyle, padding: 18 }}>
        {obras.map((o, i) => (
          <div key={i} style={{ marginBottom: i < obras.length - 1 ? 18 : 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, fontSize: 13 }}>
              <span style={{ color: "var(--stone-900)", fontWeight: 500 }}>{o.n}</span>
              <span style={{ fontFamily: "var(--font-mono)", color: o.c, fontWeight: 600, fontSize: 12 }}>{o.dx} pp</span>
            </div>
            <div style={{ position: "relative", height: 18, background: "var(--stone-50)", borderRadius: 6, overflow: "hidden" }}>
              {/* plazo (cronograma) */}
              <div style={{ position: "absolute", inset: 0, width: o.pl + "%", background: "repeating-linear-gradient(45deg, var(--stone-200), var(--stone-200) 6px, transparent 6px, transparent 12px)" }} />
              {/* avance fisico */}
              <div style={{ position: "absolute", left: 0, top: 4, bottom: 4, width: o.av + "%", background: o.c, borderRadius: 4 }} />
              <div style={{ position: "absolute", left: o.av + "%", top: 0, bottom: 0, width: 2, background: "var(--stone-900)" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: "var(--stone-500)", fontFamily: "var(--font-mono)" }}>
              <span>Avance {o.av}%</span>
              <span>Plazo {o.pl}%</span>
            </div>
          </div>
        ))}
      </div>
    </MockChrome>
  );
}

// ============================================================
// ALERTAS — financial alerts list
// ============================================================
function AlertasFinancieras() {
  const items = [
    { sev: "REVISIÓN", c: "#dc2626", t: "Escuela Técnica: avance menor al plazo", d: "El avance físico está 14 puntos por debajo del plazo transcurrido. Conviene revisar el detalle de obra.", time: "hace 8 min" },
    { sev: "SEGUIMIENTO", c: "#d97706", t: "Certificado C-022 facturado sin cobro", d: "Red Cloacal – Tramo Norte. AySA. 42 días sin registrar cobro en la tabla de certificados.", time: "hace 1 h" },
    { sev: "SEGUIMIENTO", c: "#d97706", t: "Polideportivo: documentos por revisar", d: "Hay documentos recientes vinculados a la obra que todavía no fueron revisados en la tabla destino.", time: "hoy 09:14" },
    { sev: "AVISO", c: "var(--orange-primary)", t: "Centro de Salud: cambio de avance", d: "El porcentaje de avance cambió esta semana. El reporte conserva el contexto de la modificación.", time: "hoy 08:02" },
    { sev: "OK", c: "#16a34a", t: "Pavimento Av. San Martín al día", d: "Avance y certificados registrados sin pendientes visibles en esta vista.", time: "ayer" },
  ];
  return (
    <MockChrome breadcrumb="Notificaciones / Esta semana" active="Notificaciones">
      <div style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--stone-500)" }}>5 señales detectadas</div>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 24, color: "var(--stone-900)", marginTop: 4 }}>Seguimiento financiero</div>
        </div>
        <UIButton variant="outline" size="sm" icon={<IDownload size={13} />}>Exportar reporte</UIButton>
      </div>
      {items.map((it, i) => (
        <div key={i} style={{
          display: "grid", gridTemplateColumns: "90px 1fr auto",
          gap: 16, alignItems: "start",
          padding: "13px 16px",
          ...cardStyle,
          marginBottom: 8,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", color: it.c, paddingTop: 2 }}>{it.sev}</div>
          <div>
            <div style={{ fontSize: 13, color: "var(--stone-900)", fontWeight: 500, marginBottom: 4 }}>{it.t}</div>
            <div style={{ fontSize: 12, color: "var(--stone-600)", lineHeight: 1.45 }}>{it.d}</div>
          </div>
          <div style={{ fontSize: 11, color: "var(--stone-500)", whiteSpace: "nowrap", paddingTop: 2 }}>{it.time}</div>
        </div>
      ))}
    </MockChrome>
  );
}

// ============================================================
// VISTA POR ROL — role switcher demo (segment control DS §8)
// ============================================================
function VistaPorRol() {
  const [rol, setRol] = useState("Admin");
  const roles = ["Admin", "Obra Manager", "Contador"];
  const nav = {
    "Admin":        ["Dashboard", "Excel", "Document AI", "Notificaciones", "Generar Documentos", "Usuarios", "Roles y Permisos", "Facturación", "Organizaciones"],
    "Obra Manager": ["Dashboard", "Excel", "Notificaciones", "Generar Documentos", "Historial"],
    "Contador":     ["Dashboard", "Excel", "Notificaciones", "Generar Documentos", "Facturación"],
  };
  return (
    <MockChrome breadcrumb={"Vista actual: " + rol} active="Dashboard">
      <div style={{ marginBottom: 18 }}>
        <SegmentControl options={roles} value={rol} onChange={setRol} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "230px 1fr", gap: 16 }}>
        <div style={{ ...cardStyle, padding: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".15em", color: "var(--stone-500)", marginBottom: 10, textTransform: "uppercase" }}>Navegación visible</div>
          {nav[rol].map(n => (
            <div key={n} style={{ padding: "6px 10px", fontSize: 12.5, color: "var(--stone-800)", borderRadius: 6 }}>{n}</div>
          ))}
        </div>
        <div style={{ ...cardStyle, padding: 18 }}>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--stone-900)" }}>Buen día, {rol === "Admin" ? "Ignacio" : rol === "Obra Manager" ? "Cecilia" : "Mariano"}</div>
          <div style={{ fontSize: 13, color: "var(--stone-500)", marginTop: 4 }}>
            {rol === "Admin" && "Tenés 12 eventos nuevos y 3 pendientes de la organización."}
            {rol === "Obra Manager" && "Hoy: 2 visitas agendadas y 5 documentos por revisar en tus obras."}
            {rol === "Contador" && "3 certificados emitidos esperan facturación y 6 cobros por confirmar."}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 18 }}>
            {(rol === "Admin" ? ["Cartera total", "Obras activas", "Usuarios"]
              : rol === "Obra Manager" ? ["Mis obras", "Pendientes", "Documentos"]
              : ["Por cobrar", "Por facturar", "Cierre mes"]).map((l, i) => (
              <div key={i} style={{ padding: 12, background: "var(--stone-50)", borderRadius: 8, border: "1px solid var(--stone-100)" }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--stone-500)" }}>{l}</div>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--stone-900)", marginTop: 4 }}>
                  {(rol === "Admin" ? ["$182.9M", "5", "23"]
                    : rol === "Obra Manager" ? ["3", "8", "147"]
                    : ["$16.9M", "$14.4M", "12d"])[i]}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MockChrome>
  );
}

// ============================================================
// ACCION RAPIDA — Document AI pipeline stepper
// ============================================================
function AccionRapida() {
  const steps = [
    { t: "Subida",       d: "OC_0421.pdf · 240KB",            on: "done" },
    { t: "Tipificación", d: "Detectado: Orden de compra",     on: "done" },
    { t: "Extracción",   d: "12 items reconocidos",           on: "active" },
    { t: "Revisión",     d: "Confirmar y sincronizar con la tabla", on: "queued" },
  ];
  return (
    <MockChrome breadcrumb="Document AI / Carga documental" active="Document AI">
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--stone-500)" }}>Acción rápida en curso</div>
        <div style={{ fontFamily: "var(--font-serif)", fontSize: 24, color: "var(--stone-900)", marginTop: 4 }}>Procesando OC_0421.pdf</div>
      </div>
      <div style={{ ...cardStyle, padding: 18 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 16, alignItems: "center", padding: "10px 0", borderBottom: i < steps.length - 1 ? "1px dashed var(--stone-200)" : "none" }}>
            <div style={{
              width: 28, height: 28, borderRadius: 9999,
              background: s.on === "done" ? "#16a34a" : s.on === "active" ? "var(--orange-primary)" : "var(--stone-100)",
              color: s.on === "queued" ? "var(--stone-400)" : "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 600,
              boxShadow: s.on === "active" ? "0 0 0 4px rgba(255,88,0,.18)" : "none",
            }}>{s.on === "done" ? "✓" : i + 1}</div>
            <div>
              <div style={{ fontSize: 13, color: "var(--stone-900)", fontWeight: 500 }}>{s.t}</div>
              <div style={{ fontSize: 11.5, color: "var(--stone-500)", marginTop: 2 }}>{s.d}</div>
            </div>
            <StatusBadge tone={s.on === "done" ? "green" : s.on === "active" ? "orange" : "stone"}>
              {s.on === "done" ? "Listo" : s.on === "active" ? "En curso" : "En cola"}
            </StatusBadge>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 14, marginTop: 8, borderTop: "1px solid var(--stone-100)", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 11, color: "var(--stone-500)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Dot color="var(--src-extraction)" size={7} /> Extraído</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Dot color="var(--src-manual)" size={7} /> Manual</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Dot color="var(--src-mixed)" size={7} /> Mixto</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <UIButton variant="outline" size="sm">Cancelar</UIButton>
            <UIButton variant="dark" size="sm">Ver resultado</UIButton>
          </div>
        </div>
      </div>
    </MockChrome>
  );
}

// ============================================================
// REPORTE PDF — skeumorphic paper report
// ============================================================
function ReporteDireccion() {
  return (
    <MockChrome breadcrumb="Generar Documentos / Cartera Mayo 2026" active="Generar Documentos">
      <div style={{ background: "linear-gradient(180deg, #fcfaf5 0%, #f5efe1 100%)", borderRadius: 8, padding: "28px 36px", boxShadow: "0 1px 0 rgba(0,0,0,.04)", border: "1px solid var(--stone-200)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, paddingBottom: 16, borderBottom: "2px solid var(--stone-900)" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--stone-500)" }}>Reporte de dirección</div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 28, color: "var(--stone-900)", marginTop: 4, lineHeight: 1.05 }}>Cartera Mayo 2026</div>
            <div style={{ fontSize: 11, color: "var(--stone-500)", marginTop: 4 }}>Constructora Norte S.A. · Generado 28/05/2026 11:42</div>
          </div>
          <div style={{ width: 36, height: 36, borderRadius: 9999, background: "var(--orange-primary)" }} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 22 }}>
          {[
            { l: "Cartera total", v: "$182.9M" },
            { l: "Saldo a certificar", v: "$82.0M" },
            { l: "Por cobrar", v: "$16.9M" },
          ].map((k, i) => (
            <div key={i} style={{ padding: "10px 12px", borderLeft: "2px solid var(--orange-primary)" }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--stone-500)" }}>{k.l}</div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--stone-900)", marginTop: 4 }}>{k.v}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 13, color: "var(--stone-800)", lineHeight: 1.6 }}>
          <p style={{ margin: "0 0 10px" }}>
            La cartera muestra dos obras para revisar por diferencia entre avance y plazo: <b>Escuela Técnica</b> (-14pp) y <b>Red Cloacal</b> (-19pp). El saldo a certificar registrado suma <b>$82.0M</b>.
          </p>
          <p style={{ margin: 0 }}>
            Se mantienen <b>14 certificados</b> facturados sin cobrar por un total de $16.9M. Pavimento Av. San Martín opera por encima del plan y compensa parcialmente el desvío agregado.
          </p>
        </div>

        <div style={{ marginTop: 18, padding: "10px 0 0", borderTop: "1px solid var(--stone-200)", display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--stone-500)", fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase" }}>
          <span>Página 1 / 8</span>
          <span>Sintesis · Reporte exportable</span>
        </div>
      </div>
    </MockChrome>
  );
}

// ============================================================
// CARTERA / Dashboard executive
// ============================================================
function CarteraDashboard() {
  const bars = [22, 38, 31, 45, 52, 64, 70, 58, 66, 74, 81, 88];
  return (
    <MockChrome breadcrumb="Dashboard / Cartera" active="Dashboard">
      <div style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--stone-500)" }}>Resumen ejecutivo</div>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 24, color: "var(--stone-900)", marginTop: 4 }}>Cartera de la organización</div>
        </div>
        <SegmentControl options={["6m", "12m", "YTD"]} value="12m" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14 }}>
        <div style={{ ...cardStyle, padding: 18 }}>
          <div style={{ fontSize: 11, color: "var(--stone-500)", marginBottom: 12 }}>Avance ponderado de cartera (%)</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 140 }}>
            {bars.map((v, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
                <div style={{ width: "100%", height: v + "%", background: i === bars.length - 1 ? "var(--orange-primary)" : "var(--stone-300)", borderRadius: 3 }} />
                <div style={{ fontSize: 9, color: "var(--stone-500)", fontFamily: "var(--font-mono)" }}>{["E","F","M","A","M","J","J","A","S","O","N","D"][i]}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ ...cardStyle, padding: 18 }}>
          <div style={{ fontSize: 11, color: "var(--stone-500)", marginBottom: 12 }}>Riesgo por obra</div>
          {[
            { l: "Crítico", v: 2, c: "#dc2626" },
            { l: "Atención", v: 1, c: "#d97706" },
            { l: "OK", v: 2, c: "#16a34a" },
          ].map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < 2 ? "1px solid var(--stone-100)" : "none" }}>
              <Dot color={r.c} />
              <div style={{ flex: 1, fontSize: 12.5, color: "var(--stone-800)" }}>{r.l}</div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--stone-900)" }}>{r.v}</div>
            </div>
          ))}
          <div style={{ marginTop: 14, padding: "10px 12px", background: "var(--stone-50)", borderRadius: 8, border: "1px solid var(--stone-100)", fontSize: 11.5, color: "var(--stone-700)" }}>
            <b style={{ color: "var(--stone-900)" }}>2 obras para revisar</b> &mdash; saldo a certificar <b style={{ fontFamily: "var(--font-mono)" }}>$82M</b>.
          </div>
        </div>
      </div>
    </MockChrome>
  );
}

Object.assign(window, {
  ObrasOverview, ObraDetail, PermisosMatrix, FlujoBoard,
  CertificadosTable, AvanceVsPlazo, AlertasFinancieras,
  VistaPorRol, AccionRapida, ReporteDireccion, CarteraDashboard,
  UIButton, UITray, UIChip, StatusBadge, SegmentControl, PillTabs,
});
