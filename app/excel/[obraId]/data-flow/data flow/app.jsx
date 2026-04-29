/* global React, TRAZA, TrazaCanvas, InspectorPopover, TableDrillDown, DocPreview, useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakToggle, IcoHome, IcoDb, IcoTable, IcoBuilding, IcoFolder, IcoBell, IcoUsers, IcoSettings, IcoChevR, IcoChevD, IcoSearch, IcoRefresh, IcoArrow, IcoLayers, IcoSigma, IcoTarget, IcoFile, IcoEye, IcoCheck, IcoAlert, IcoClock, IcoShare, LAYER_META */
const { useState, useMemo, useEffect, useRef } = React;

// =================================================================
// SIDEBAR (compact, matches Sintesis dashboard)
// =================================================================
function AppSidebar() {
  const items = [
    { k: "dashboard", icon: IcoHome,     label: "Dashboard" },
    { k: "obras",     icon: IcoBuilding, label: "Obras", active: true },
    { k: "excel",     icon: IcoDb,       label: "Excel" },
    { k: "tablas",    icon: IcoTable,    label: "Tablas" },
    { k: "docs",      icon: IcoFolder,   label: "Documentos" },
    { k: "alerts",    icon: IcoBell,     label: "Alertas", badge: 3 },
  ];
  const admin = [
    { k: "org",   icon: IcoUsers,    label: "Organizaciones" },
    { k: "cfg",   icon: IcoSettings, label: "Configuración" },
  ];
  return (
    <aside style={{
      width: 240, background: "#f0efea",
      borderRight: "1px solid rgba(220,213,203,.5)",
      padding: 12, display: "flex", flexDirection: "column", gap: 12,
      flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px" }}>
        <div style={{ width: 32, height: 32, borderRadius: 9999, background: "var(--orange-primary)" }}/>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 16, lineHeight: 1, color: "var(--stone-900)" }}>Sintesis</div>
          <div style={{ fontSize: 10, color: "var(--stone-500)", marginTop: 2 }}>Plataforma de gestión</div>
        </div>
      </div>
      <button style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 10px", background: "rgba(255,255,255,.55)",
        border: "1px solid rgba(220,213,203,.9)", borderRadius: 6,
        cursor: "pointer", textAlign: "left", fontFamily: "inherit",
      }}>
        <div>
          <div style={{ fontSize: 9.5, color: "var(--stone-500)", textTransform: "uppercase", letterSpacing: ".12em", fontWeight: 600 }}>Organización</div>
          <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--stone-800)", marginTop: 2 }}>Constructora Norte S.A.</div>
        </div>
        <IcoChevD size={13}/>
      </button>

      <NavGroup title="Principal" items={items}/>
      <NavGroup title="Admin"     items={admin}/>

      <div style={{ marginTop: "auto", padding: "10px",
                    borderTop: "1px solid rgba(220,213,203,.6)",
                    display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 26, height: 26, borderRadius: 9999, background: "var(--stone-700)",
                      color: "#fff", fontSize: 10, fontWeight: 600,
                      display: "flex", alignItems: "center", justifyContent: "center" }}>IL</div>
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--stone-800)" }}>Ignacio L.</div>
          <div style={{ fontSize: 9.5, color: "var(--stone-500)" }}>ignacio@constnorte.ar</div>
        </div>
      </div>
    </aside>
  );
}

function NavGroup({ title, items }) {
  return (
    <div>
      <div style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".15em",
                    color: "var(--stone-500)", fontWeight: 600, padding: "4px 10px" }}>{title}</div>
      {items.map(i => {
        const Ic = i.icon;
        return (
          <div key={i.k} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "6px 10px", borderRadius: 6, cursor: "pointer",
            background: i.active ? "#fff" : "transparent",
            color: i.active ? "var(--stone-900)" : "var(--stone-700)",
            fontSize: 12.5, fontWeight: i.active ? 500 : 400,
            boxShadow: i.active ? "0 1px 0 rgba(0,0,0,.04)" : "none",
          }}>
            <span style={{ color: i.active ? "var(--stone-900)" : "var(--stone-500)", display: "inline-flex" }}><Ic size={14}/></span>
            <span>{i.label}</span>
            {i.badge && <span style={{
              marginLeft: "auto", background: "#c9323a", color: "#fff", borderRadius: 9999,
              padding: "1px 6px", fontSize: 9, fontWeight: 700,
            }}>{i.badge}</span>}
          </div>
        );
      })}
    </div>
  );
}

// =================================================================
// HOVER PREVIEW (small floating card following cursor)
// =================================================================
function HoverPreview({ nodeId, mouse }) {
  if (!nodeId || !mouse) return null;
  const node = resolve(nodeId);
  if (!node) return null;
  const meta = LAYER_META[node._layer];
  const Ic = meta.icon;

  return (
    <div style={{
      position: "fixed",
      left: mouse.x + 14, top: mouse.y + 14,
      pointerEvents: "none",
      background: "rgba(28,25,23,.94)", color: "#fff",
      borderRadius: 8, padding: "8px 12px",
      fontSize: 11, lineHeight: 1.45,
      maxWidth: 260,
      zIndex: 100,
      boxShadow: "0 8px 30px rgba(0,0,0,.25)",
      animation: "fadeIn .12s ease-out",
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase",
        color: meta.color, display: "flex", alignItems: "center", gap: 5,
        marginBottom: 3,
      }}>
        <Ic size={10}/> {meta.label}
      </div>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{node.label}</div>
      {node._layer === "resultado" && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,.7)" }}>
          {node.value}
        </div>
      )}
      {node._layer === "tabla" && (
        <div style={{ fontSize: 10, color: "rgba(255,255,255,.7)", fontVariantNumeric: "tabular-nums" }}>
          {node.rows} filas · {node.cols} cols · {node.docs} docs
        </div>
      )}
      {node._layer === "macrotabla" && (
        <div style={{ fontSize: 10, color: "rgba(255,255,255,.7)" }}>
          {node.fuentes} fuentes · {node.columnas} columnas
        </div>
      )}
      {node._layer === "calculo" && (
        <div style={{ fontSize: 10, color: node.hardcoded ? "#fde68a" : "rgba(255,255,255,.7)" }}>
          {node.hardcoded ? "Hardcodeado" : node.tipo}
        </div>
      )}
      {node._layer === "documento" && (
        <div style={{ fontSize: 10, color: "rgba(255,255,255,.7)" }}>
          {node.count} documento{node.count !== 1 ? "s" : ""}
        </div>
      )}
      <div style={{ fontSize: 9, color: "rgba(255,255,255,.5)", marginTop: 4,
                    textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600 }}>
        Click para abrir
      </div>
    </div>
  );
}

function resolve(id) {
  if (!id) return null;
  const r = TRAZA.resultados.find(x => x.id === id); if (r) return { ...r, _layer: "resultado" };
  const c = TRAZA.calculos.find(x => x.id === id);   if (c) return { ...c, _layer: "calculo" };
  const m = TRAZA.macrotablas.find(x => x.id === id); if (m) return { ...m, _layer: "macrotabla" };
  const t = TRAZA.tablas.find(x => x.id === id);     if (t) return { ...t, _layer: "tabla" };
  if (id.startsWith("doc-")) {
    const t = TRAZA.tablas.find(x => "doc-" + x.id === id);
    if (t) return { id, _layer: "documento", label: t.folder, count: t.docs };
  }
  return null;
}

// =================================================================
// MAIN APP
// =================================================================
function App() {
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "layout": "vertical",
    "resultStyle": "kpi",
    "showCalc": true,
    "showDocs": true,
    "connStyle": "curve",
    "accent": "orange"
  }/*EDITMODE-END*/;

  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const [view, setView] = useState("system"); // 'system' | 'result'
  const [focusId, setFocusIdRaw] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const [mouse, setMouse] = useState(null);

  const [inspectorState, setInspectorState] = useState({ open: false, nodeId: null, anchor: null });
  const [tableId, setTableId] = useState(null);
  const [doc, setDoc] = useState(null);

  const setFocusId = (id) => {
    setFocusIdRaw(id);
    setView(id ? "result" : "system");
  };

  const openInspector = (nodeId, anchor) => {
    setInspectorState({ open: true, nodeId, anchor });
  };
  const closeInspector = () => setInspectorState({ open: false, nodeId: null, anchor: null });

  const navigateInspector = (idOrCmd) => {
    if (idOrCmd && idOrCmd.startsWith && idOrCmd.startsWith("__open-table__")) {
      const tid = idOrCmd.replace("__open-table__", "");
      closeInspector();
      setTableId(tid);
      return;
    }
    // Just switch the inspector to the new node, keep anchor
    setInspectorState(s => ({ ...s, nodeId: idOrCmd }));
  };

  const onCanvasMouseMove = (e) => setMouse({ x: e.clientX, y: e.clientY });

  return (
    <div style={{
      display: "flex", height: "100vh", overflow: "hidden",
      background: "var(--background)",
      fontFamily: "var(--font-sans)",
    }}>
      <AppSidebar/>

      <main style={{ flex: 1, display: "flex", flexDirection: "column",
                     minWidth: 0, minHeight: 0 }}>
        {/* Topbar */}
        <Topbar focusId={focusId} setFocusId={setFocusId} view={view} setView={setView}/>

        {/* Workspace */}
        <div style={{ flex: 1, padding: 18, display: "flex", flexDirection: "column",
                      gap: 14, minHeight: 0, overflow: "hidden" }}
             onMouseMove={onCanvasMouseMove}>

          {/* Results bar */}
          <ResultsBar focusId={focusId} setFocusId={setFocusId}
                      openInspector={openInspector}
                      view={view}/>

          {/* Canvas + inspector */}
          <div style={{ flex: 1, display: "flex", minHeight: 0, position: "relative" }}>
            <TrazaCanvas
              tweaks={tweaks}
              focusId={focusId}
              setFocusId={setFocusId}
              hoverId={hoverId}
              setHoverId={setHoverId}
              openTable={(tid) => setTableId(tid)}
              openDoc={(d) => {
                // From canvas docs cluster
                const t = TRAZA.tablas.find(x => "doc-" + x.id === d.id);
                if (t) setTableId(t.id);
              }}
              openInspector={openInspector}
              inspectorOpen={inspectorState.open}
              inspectorAnchor={inspectorState.anchor}
            />

            {inspectorState.open && (
              <InspectorPopover
                nodeId={inspectorState.nodeId}
                anchor={inspectorState.anchor}
                onClose={closeInspector}
                onNavigate={navigateInspector}
              />
            )}
          </div>
        </div>
      </main>

      {/* Hover preview */}
      <HoverPreview nodeId={hoverId && hoverId !== inspectorState.nodeId ? hoverId : null} mouse={mouse}/>

      {/* Drilldowns */}
      <TableDrillDown tableId={tableId} onClose={() => setTableId(null)}
                      onOpenDoc={(d) => setDoc(d)}/>
      <DocPreview doc={doc} onClose={() => setDoc(null)}/>

      {/* Tweaks */}
      <TweaksPanel title="Tweaks">
        <TweakSection label="Layout del canvas">
          <TweakRadio
            label="Dirección"
            value={tweaks.layout}
            onChange={(v) => setTweak("layout", v)}
            options={[
              { value: "vertical",   label: "Vertical" },
              { value: "horizontal", label: "Horizontal" },
              { value: "radial",     label: "Radial" },
            ]}
          />
        </TweakSection>
        <TweakSection label="Forma del resultado">
          <TweakRadio
            label="Estilo"
            value={tweaks.resultStyle}
            onChange={(v) => setTweak("resultStyle", v)}
            options={[
              { value: "kpi",  label: "KPI card" },
              { value: "node", label: "Nodo" },
            ]}
          />
        </TweakSection>
        <TweakSection label="Capas visibles">
          <TweakToggle label="Mostrar Cálculo" value={tweaks.showCalc}
                       onChange={(v) => setTweak("showCalc", v)}/>
          <TweakToggle label="Mostrar Documentos" value={tweaks.showDocs}
                       onChange={(v) => setTweak("showDocs", v)}/>
        </TweakSection>
        <TweakSection label="Estilo de conexiones">
          <TweakRadio
            label="Trazo"
            value={tweaks.connStyle}
            onChange={(v) => setTweak("connStyle", v)}
            options={[
              { value: "curve",    label: "Curva" },
              { value: "straight", label: "Recta" },
              { value: "dashed",   label: "Dashed" },
              { value: "dotted",   label: "Dotted" },
            ]}
          />
        </TweakSection>
        <TweakSection label="Color del resultado activo">
          <TweakRadio
            label="Acento"
            value={tweaks.accent}
            onChange={(v) => setTweak("accent", v)}
            options={[
              { value: "orange", label: "Orange" },
              { value: "stone",  label: "Stone" },
            ]}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

// =================================================================
// TOPBAR
// =================================================================
function Topbar({ focusId, setFocusId, view, setView }) {
  const focus = focusId ? TRAZA.resultados.find(r => r.id === focusId) : null;
  return (
    <div style={{
      padding: "10px 22px",
      borderBottom: "1px solid var(--stone-200)",
      background: "#fff",
      display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
      flexShrink: 0,
    }} data-screen-label="Trazabilidad">
      {/* Crumbs / title */}
      <div style={{ flex: "1 1 320px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6,
                      fontSize: 11, color: "var(--stone-500)" }}>
          <span>Obras</span>
          <IcoChevR size={11}/>
          <span style={{ color: "var(--stone-700)" }}>Hospital Municipal Norte</span>
          <IcoChevR size={11}/>
          <span style={{ color: "var(--stone-900)", fontWeight: 500 }}>Trazabilidad</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 2, flexWrap: "wrap" }}>
          <h1 style={{
            fontSize: 17, fontWeight: 700, color: "var(--stone-900)",
            letterSpacing: "-.01em", margin: 0, whiteSpace: "nowrap",
          }}>
            Trazabilidad de resultados
          </h1>
          <span style={{ fontSize: 11, color: "var(--stone-500)", whiteSpace: "nowrap",
                         overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
            {focus ? <>Foco en <strong style={{ color: "var(--orange-primary)" }}>{focus.label}</strong></>
                   : <>{TRAZA.obra.entidad}</>}
          </span>
        </div>
      </div>

      {/* View toggle */}
      <div style={{
        display: "inline-flex",
        background: "var(--stone-100)", borderRadius: 8,
        padding: 3, gap: 2,
      }}>
        <ViewBtn active={view === "system"} onClick={() => { setFocusId(null); setView("system"); }}>
          Ver todo el sistema
        </ViewBtn>
        <ViewBtn active={view === "result"} onClick={() => { if (!focusId) setFocusId(TRAZA.resultados[0].id); setView("result"); }}>
          Ver por resultado
        </ViewBtn>
      </div>

      <button style={{
        height: 34, padding: "0 12px", borderRadius: 6,
        border: "1px solid var(--stone-200)", background: "#fff",
        color: "var(--stone-700)", fontSize: 12, fontWeight: 500,
        cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
        fontFamily: "inherit",
      }}>
        <IcoRefresh size={13}/> Actualizar
      </button>
      <button style={{
        height: 34, padding: "0 12px", borderRadius: 6,
        border: "1px solid var(--stone-200)", background: "#fff",
        color: "var(--stone-700)", fontSize: 12, fontWeight: 500,
        cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
        fontFamily: "inherit",
      }}>
        <IcoArrow size={13}/> Volver a la obra
      </button>
    </div>
  );
}

function ViewBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 12px", borderRadius: 6,
      border: "none", cursor: "pointer",
      background: active ? "#fff" : "transparent",
      color: active ? "var(--stone-900)" : "var(--stone-600)",
      fontSize: 11.5, fontWeight: active ? 600 : 500,
      boxShadow: active ? "0 1px 0 rgba(0,0,0,.06), 0 0 0 1px rgba(0,0,0,.04)" : "none",
      fontFamily: "inherit",
      transition: "background .15s",
    }}>{children}</button>
  );
}

// =================================================================
// RESULTS BAR — 4 result chips above canvas
// =================================================================
function ResultsBar({ focusId, setFocusId, openInspector, view }) {
  return (
    <div style={{
      display: "flex", alignItems: "stretch", gap: 8,
      padding: "8px 10px",
      background: "#fff",
      border: "1px solid var(--stone-200)", borderRadius: 12,
      boxShadow: "0 1px 0 rgba(0,0,0,.03)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6,
                    paddingRight: 10, borderRight: "1px solid var(--stone-100)",
                    flexShrink: 0 }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".15em",
                      textTransform: "uppercase", color: "var(--orange-primary)",
                      writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
          Resultados
        </span>
      </div>
      {TRAZA.resultados.map(r => {
        const active = focusId === r.id;
        return (
          <button key={r.id}
            data-result-chip={r.id}
            onClick={(e) => {
              if (active) { setFocusId(null); }
              else {
                setFocusId(r.id);
                // Defer so the focus banner inside the canvas mounts, then anchor there
                setTimeout(() => {
                  const banner = document.querySelector('[data-focus-banner="' + r.id + '"]');
                  openInspector(r.id, banner || e.currentTarget);
                }, 60);
              }
            }}
            style={{
              flex: "1 1 0", minWidth: 0, padding: "8px 12px",
              background: active ? "var(--orange-primary)" : "#fff",
              color: active ? "#fff" : "var(--stone-900)",
              border: `1.5px solid ${active ? "transparent" : "var(--stone-200)"}`,
              borderRadius: 10,
              cursor: "pointer", textAlign: "left",
              display: "flex", flexDirection: "column", gap: 3,
              fontFamily: "inherit",
              transition: "transform .15s, box-shadow .15s, background .15s, border-color .15s",
              boxShadow: active ? "0 6px 20px rgba(255,88,0,.20)" : "none",
            }}
            onMouseEnter={(e) => !active && (e.currentTarget.style.borderColor = "var(--stone-400)")}
            onMouseLeave={(e) => !active && (e.currentTarget.style.borderColor = "var(--stone-200)")}
          >
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: ".15em",
              textTransform: "uppercase",
              color: active ? "rgba(255,255,255,.78)" : "var(--stone-400)",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              {r.label}
              {r.status === "warn"  && <IcoAlert size={10}/>}
              {r.status === "empty" && <IcoClock size={10}/>}
            </div>
            <div style={{
              fontSize: 18, fontWeight: 800, letterSpacing: "-.02em",
              fontVariantNumeric: "tabular-nums",
              color: active ? "#fff" : "var(--stone-900)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              lineHeight: 1,
            }}>{r.value}</div>
            <div style={{
              fontSize: 10,
              color: active ? "rgba(255,255,255,.75)" : "var(--stone-500)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>{r.trend}</div>
          </button>
        );
      })}
    </div>
  );
}

window.App = App;
