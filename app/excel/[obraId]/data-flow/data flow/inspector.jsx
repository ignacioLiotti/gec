/* global React, TRAZA, LAYER_META, IcoX, IcoChevR, IcoArrow, IcoEye, IcoDownload, IcoFile, IcoFolder, IcoAlert, IcoCheck, IcoClock, IcoSigma, IcoLayers, IcoDb, IcoTarget */
const { useState, useEffect, useRef } = React;

// =================================================================
// INSPECTOR POPOVER — anchored next to the clicked node
// Explains: what it is, formula, sources, last update
// =================================================================
function InspectorPopover({ nodeId, anchor, onClose, onNavigate }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: 0, top: 0, side: "right" });

  // Resolve node from id
  const node = resolveNode(nodeId);
  if (!node) return null;

  useEffect(() => {
    if (!anchor || !ref.current) return;
    const compute = () => {
      const a = anchor.getBoundingClientRect();
      const popW = 340, popH = ref.current.offsetHeight || 320;
      const margin = 14;
      const vw = window.innerWidth, vh = window.innerHeight;
      // Try right of anchor first
      let left = a.right + margin;
      let side = "right";
      if (left + popW > vw - 16) {
        // Try left
        const leftAlt = a.left - popW - margin;
        if (leftAlt >= 16) {
          left = leftAlt;
          side = "left";
        } else {
          // Neither side fits — pin to whichever edge has more room
          if (vw - a.right >= a.left) {
            left = Math.max(16, vw - popW - 16);
            side = "right";
          } else {
            left = 16;
            side = "left";
          }
        }
      }
      let top = a.top + a.height / 2 - popH / 2;
      top = Math.max(16, Math.min(vh - popH - 16, top));
      setPos({ left, top, side });
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [anchor, nodeId]);

  return (
    <div ref={ref} style={{
      position: "fixed", left: pos.left, top: pos.top,
      width: 340,
      background: "#fff", borderRadius: 12,
      border: "1px solid var(--stone-200)",
      boxShadow: "0 0 0 1px #ffffff14 inset, 0 0 0 1px #09090b1f, 0 10px 30px rgba(28,25,23,.18)",
      padding: 0, zIndex: 60,
      animation: "popIn .18s ease-out",
    }}>
      {/* Pointer */}
      <div style={{
        position: "absolute",
        [pos.side === "right" ? "left" : "right"]: -6,
        top: "50%", transform: "translateY(-50%) rotate(45deg)",
        width: 12, height: 12, background: "#fff",
        borderLeft: pos.side === "right" ? "1px solid var(--stone-200)" : "none",
        borderBottom: pos.side === "right" ? "1px solid var(--stone-200)" : "none",
        borderRight: pos.side === "left" ? "1px solid var(--stone-200)" : "none",
        borderTop: pos.side === "left" ? "1px solid var(--stone-200)" : "none",
      }}/>

      <InspectorBody node={node} onClose={onClose} onNavigate={onNavigate}/>
    </div>
  );
}

function resolveNode(id) {
  if (!id) return null;
  const r = TRAZA.resultados.find(x => x.id === id); if (r) return { ...r, _layer: "resultado" };
  const c = TRAZA.calculos.find(x => x.id === id);   if (c) return { ...c, _layer: "calculo" };
  const m = TRAZA.macrotablas.find(x => x.id === id); if (m) return { ...m, _layer: "macrotabla" };
  const t = TRAZA.tablas.find(x => x.id === id);     if (t) return { ...t, _layer: "tabla" };
  return null;
}

function InspectorBody({ node, onClose, onNavigate }) {
  const meta = LAYER_META[node._layer];
  const Icon = meta.icon;

  return (
    <>
      {/* Header */}
      <div style={{
        padding: "14px 16px 10px",
        borderBottom: "1px solid var(--stone-100)",
        display: "flex", alignItems: "flex-start", gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: meta.color, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}><Icon size={16}/></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".15em",
                        textTransform: "uppercase", color: meta.color }}>
            {meta.label}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--stone-900)",
                        marginTop: 2, lineHeight: 1.25 }}>
            {node.label}
          </div>
        </div>
        <button onClick={onClose} style={{
          background: "transparent", border: "none", cursor: "pointer",
          color: "var(--stone-400)", padding: 4, display: "inline-flex",
        }}><IcoX size={14}/></button>
      </div>

      {/* Body — varies per layer */}
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        {node._layer === "resultado" && <ResultBody node={node} onNavigate={onNavigate}/>}
        {node._layer === "calculo"   && <CalcBody node={node} onNavigate={onNavigate}/>}
        {node._layer === "macrotabla"&& <MacroBody node={node} onNavigate={onNavigate}/>}
        {node._layer === "tabla"     && <TablaBody node={node} onNavigate={onNavigate}/>}
      </div>
    </>
  );
}

const sectionLabel = (txt) => (
  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".15em",
                textTransform: "uppercase", color: "var(--stone-400)" }}>{txt}</div>
);

function ResultBody({ node, onNavigate }) {
  const calc = TRAZA.calculos.find(c => c.id === node.calc);
  return (
    <>
      <div>
        <div style={{
          fontSize: 32, fontWeight: 800, letterSpacing: "-.02em",
          fontVariantNumeric: "tabular-nums", color: "var(--stone-900)", lineHeight: 1,
        }}>{node.value}</div>
        <div style={{ fontSize: 11, color: node.status === "warn" ? "#b45309" :
                                          node.status === "empty" ? "var(--stone-500)" : "var(--stone-600)",
                      marginTop: 4 }}>
          {node.trend}
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--stone-100)", paddingTop: 12 }}>
        {sectionLabel("Cómo se calcula")}
        <div style={{ fontSize: 12, color: "var(--stone-700)", marginTop: 6, lineHeight: 1.5 }}>
          {node.explica}
        </div>
        <div style={{
          marginTop: 8, padding: "8px 10px",
          background: "var(--stone-50)",
          border: "1px solid var(--stone-200)",
          borderRadius: 6,
          fontFamily: "var(--font-mono)",
          fontSize: 11, color: "var(--stone-700)",
          letterSpacing: "-.01em",
        }}>{node.formula}</div>
      </div>

      <div>
        {sectionLabel("Trazabilidad upstream")}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
          {calc && (
            <UpstreamRow label={calc.label} kind="cálculo" hardcoded={calc.hardcoded}
                         onClick={() => onNavigate(calc.id)} />
          )}
          {node.sources.map(sid => {
            const t = TRAZA.tablas.find(x => x.id === sid);
            return t ? (
              <UpstreamRow key={sid} label={t.label} kind="tabla"
                           status={t.status}
                           onClick={() => onNavigate(t.id)}/>
            ) : null;
          })}
        </div>
      </div>

      <div style={{
        display: "flex", justifyContent: "space-between",
        fontSize: 10, color: "var(--stone-500)",
        borderTop: "1px solid var(--stone-100)", paddingTop: 10,
      }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <IcoClock size={11}/> {node.updated}
        </span>
        {node.stale && <span style={{ color: "#b45309", fontWeight: 600 }}>Datos viejos</span>}
      </div>
    </>
  );
}

function CalcBody({ node, onNavigate }) {
  return (
    <>
      <div style={{ fontSize: 12, color: "var(--stone-700)", lineHeight: 1.5 }}>
        {node.desc}
      </div>
      {node.hardcoded && (
        <div style={{
          padding: "10px 12px",
          background: "#fef9c3", border: "1px solid #fde68a",
          borderRadius: 8, display: "flex", gap: 8,
        }}>
          <span style={{ color: "#854d0e", marginTop: 1 }}><IcoAlert size={14}/></span>
          <div style={{ fontSize: 11, color: "#854d0e", lineHeight: 1.4 }}>
            <strong>Cálculo hardcodeado.</strong> El valor viene de reporting; la capa <em>projected</em> aún no resuelve esta agregación contra macro_table_sources.
          </div>
        </div>
      )}
      <div>
        {sectionLabel("Tipo")}
        <div style={{ fontSize: 12, color: "var(--stone-800)", marginTop: 4, fontWeight: 500,
                      textTransform: "capitalize" }}>{node.tipo}</div>
      </div>
      <div>
        {sectionLabel("Inputs")}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
          {node.inputs.map(mid => {
            const m = TRAZA.macrotablas.find(x => x.id === mid);
            return m ? (
              <UpstreamRow key={mid} label={m.label} kind="macrotabla"
                           onClick={() => onNavigate(m.id)}/>
            ) : null;
          })}
        </div>
      </div>
    </>
  );
}

function MacroBody({ node, onNavigate }) {
  return (
    <>
      <div style={{ fontSize: 12, color: "var(--stone-700)", lineHeight: 1.5 }}>
        {node.desc}
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        <Stat n={node.fuentes} label="Fuentes"/>
        <Stat n={node.columnas} label="Columnas"/>
      </div>
      <div>
        {sectionLabel("Tablas fuente")}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
          {node.sources.map(tid => {
            const t = TRAZA.tablas.find(x => x.id === tid);
            return t ? (
              <UpstreamRow key={tid} label={t.label} kind="tabla" status={t.status}
                           onClick={() => onNavigate(t.id)}/>
            ) : null;
          })}
        </div>
      </div>
    </>
  );
}

function TablaBody({ node, onNavigate }) {
  return (
    <>
      <div style={{ display: "flex", gap: 16 }}>
        <Stat n={node.rows} label="Filas"/>
        <Stat n={node.cols} label="Columnas"/>
        <Stat n={node.docs} label="Docs"/>
      </div>
      {node.status === "empty" && (
        <div style={{
          padding: "10px 12px",
          background: "#f5f5f4", border: "1px solid var(--stone-200)",
          borderRadius: 8, fontSize: 11, color: "var(--stone-600)", lineHeight: 1.4,
        }}>
          Sin filas cargadas. Subí los certificados a <strong>{node.folder}</strong> para empezar a poblar la tabla.
        </div>
      )}
      {node.status === "incomplete" && (
        <div style={{
          padding: "10px 12px",
          background: "#fef2f2", border: "1px solid #fecaca",
          borderRadius: 8, fontSize: 11, color: "#991b1b", lineHeight: 1.4,
        }}>
          Faltan <strong>{node.missing} documentos</strong> referenciados en órdenes de compra.
        </div>
      )}
      {node.status === "stale" && (
        <div style={{
          padding: "10px 12px",
          background: "#fffbeb", border: "1px solid #fde68a",
          borderRadius: 8, fontSize: 11, color: "#854d0e", lineHeight: 1.4,
        }}>
          Última actualización <strong>{node.lastUpdate}</strong>. Verificá que no haya remitos sin procesar.
        </div>
      )}
      <div>
        {sectionLabel("Origen documental")}
        <div style={{ marginTop: 6, padding: "8px 10px", background: "var(--stone-50)",
                      border: "1px solid var(--stone-200)", borderRadius: 6,
                      display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "var(--stone-500)" }}><IcoFolder size={14}/></span>
          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--stone-700)" }}>
            {node.folder}
          </span>
        </div>
      </div>
      <button onClick={() => onNavigate("__open-table__" + node.id)} style={{
        background: "linear-gradient(180deg,#201E25,#323137)",
        color: "#fafafa", border: "none", borderRadius: 6, padding: "8px 12px",
        fontSize: 12, fontWeight: 500, cursor: "pointer",
        boxShadow: "0 2px 4px rgba(0,0,0,.10), 0 0 0 1px #0D0D0D",
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
        fontFamily: "inherit",
      }}>
        Ver filas y documentos <IcoChevR size={13}/>
      </button>
    </>
  );
}

function UpstreamRow({ label, kind, status, hardcoded, onClick }) {
  const dot = status === "empty" ? "#a8a29e" : status === "stale" ? "#b45309" :
              status === "incomplete" ? "#b91c1c" : "#10b981";
  return (
    <div onClick={onClick} style={{
      padding: "7px 10px", border: "1px solid var(--stone-200)",
      borderRadius: 6, background: "#fff", cursor: "pointer",
      display: "flex", alignItems: "center", gap: 8,
      transition: "background .12s, border-color .12s",
    }} onMouseEnter={(e) => e.currentTarget.style.background = "#fafaf9"}
       onMouseLeave={(e) => e.currentTarget.style.background = "#fff"}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: dot }}/>
      <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--stone-900)" }}>{label}</span>
      <span style={{ fontSize: 9, color: "var(--stone-400)", textTransform: "uppercase",
                     letterSpacing: ".1em", fontWeight: 600 }}>{kind}</span>
      {hardcoded && <span style={{ fontSize: 9, color: "#854d0e", background: "#fef9c3",
                                   padding: "1px 6px", borderRadius: 9999, fontWeight: 700,
                                   textTransform: "uppercase", letterSpacing: ".08em" }}>fake</span>}
      <span style={{ marginLeft: "auto", color: "var(--stone-300)" }}><IcoChevR size={12}/></span>
    </div>
  );
}

function Stat({ n, label }) {
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--stone-900)",
                    fontVariantNumeric: "tabular-nums", letterSpacing: "-.01em", lineHeight: 1 }}>{n}</div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".15em",
                    textTransform: "uppercase", color: "var(--stone-400)", marginTop: 4 }}>{label}</div>
    </div>
  );
}

window.InspectorPopover = InspectorPopover;
