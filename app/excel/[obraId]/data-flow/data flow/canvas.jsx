/* global React, TRAZA, buildGraph, computeLayout, IcoDb, IcoLayers, IcoSigma, IcoTarget, IcoFile, IcoFolder, IcoAlert, IcoCheck, IcoClock, IcoX, IcoChevR, IcoArrow, IcoEye, IcoDownload, IcoTable, IcoShare */
const { useState, useMemo, useRef, useEffect, useLayoutEffect } = React;

// ---------- Layer metadata ----------
const LAYER_META = {
  resultado:  { label: "RESULTADO",   icon: IcoTarget, color: "var(--orange-primary)" },
  calculo:    { label: "CÁLCULO",     icon: IcoSigma,  color: "#7c3aed" },
  macrotabla: { label: "MACROTABLA",  icon: IcoLayers, color: "#0891b2" },
  tabla:      { label: "TABLA",       icon: IcoDb,     color: "#44403c" },
  documento:  { label: "DOCUMENTOS",  icon: IcoFolder, color: "#a8a29e" },
};

// ---------- Edge path generators ----------
function edgePath(a, b, style, horiz) {
  if (!a || !b) return "";
  if (style === "straight") return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  // bezier
  if (horiz) {
    const dx = (b.x - a.x) / 2;
    return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
  }
  const dy = (b.y - a.y) / 2;
  return `M ${a.x} ${a.y} C ${a.x} ${a.y + dy}, ${b.x} ${b.y - dy}, ${b.x} ${b.y}`;
}

// =================================================================
// CANVAS — main visual
// =================================================================
function TrazaCanvas({ tweaks, focusId, setFocusId, hoverId, setHoverId, openTable, openDoc, openInspector, inspectorOpen, inspectorAnchor }) {
  const ref = useRef(null);
  const [dims, setDims] = useState({ width: 1100, height: 620 });

  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => {
      const r = e.contentRect;
      const isVert = tweaks.layout === "vertical";
      const minH = isVert ? 740 : 560;
      const minW = 720;
      setDims({ width: Math.max(minW, r.width), height: Math.max(minH, r.height) });
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [tweaks.layout]);

  const { layers, edges, visibleNodes } = useMemo(
    () => buildGraph({ focusId, showCalc: tweaks.showCalc, showDocs: tweaks.showDocs }),
    [focusId, tweaks.showCalc, tweaks.showDocs]
  );

  const positions = useMemo(
    () => computeLayout({ layout: tweaks.layout, layers, focusId, visibleNodes, dims }),
    [tweaks.layout, layers, focusId, visibleNodes, dims]
  );

  const horiz = tweaks.layout === "horizontal";
  const flatNodes = layers.flatMap(l => l.nodes.map(n => ({ ...n, _layer: l.key })));

  // Compute edge endpoints (anchored to node edges, not centers)
  const edgeData = edges.map(e => {
    const a = positions[e.from], b = positions[e.to];
    if (!a || !b) return null;
    let from, to;
    if (tweaks.layout === "radial") {
      // Just connect centers in radial (keeps it readable)
      from = { x: a.x, y: a.y };
      to   = { x: b.x, y: b.y };
    } else if (horiz) {
      from = { x: a.x + a.w / 2, y: a.y };
      to   = { x: b.x - b.w / 2, y: b.y };
    } else {
      from = { x: a.x, y: a.y + a.h / 2 };
      to   = { x: b.x, y: b.y - b.h / 2 };
    }
    const isHighlit = focusId && visibleNodes.has(e.from) && visibleNodes.has(e.to);
    const isHover = hoverId && (e.from === hoverId || e.to === hoverId);
    return { ...e, from, to, isHighlit, isHover };
  }).filter(Boolean);

  // ---------- Section labels (column headers) ----------
  const sectionLabels = layers.map((layer, li) => {
    const meta = LAYER_META[layer.key];
    const visibleCount = focusId
      ? layer.nodes.filter(n => visibleNodes.has(n.id)).length
      : layer.nodes.length;
    let pos;
    if (tweaks.layout === "radial") return null;
    if (horiz) {
      const x = 40 + ((dims.width - 80) / layers.length) * (li + 0.5);
      pos = { left: x, top: 12 };
    } else {
      const y = 30 + ((dims.height - 60) / layers.length) * li + 14;
      pos = { left: 24, top: y };
    }
    return { ...meta, key: layer.key, count: visibleCount, total: layer.nodes.length, pos };
  }).filter(Boolean);

  return (
    <div ref={ref} style={{
      position: "relative", flex: 1, minHeight: 0,
      borderRadius: 12, overflow: "auto",
      border: "1px solid var(--stone-200)",
      background: "#fafaf8",
    }}>
    <div style={{
      position: "relative",
      width: dims.width,
      height: dims.height,
      minWidth: "100%",
      minHeight: "100%",
      background:
        "radial-gradient(circle at 1px 1px, rgba(28,25,23,.06) 1px, transparent 0)",
      backgroundSize: "22px 22px",
    }}>
      {/* SVG layer for edges */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#a8a29e" />
          </marker>
          <marker id="arrow-hl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--orange-primary)" />
          </marker>
        </defs>
        {edgeData.map((e, i) => {
          const dimEdge = focusId && !e.isHighlit;
          const stroke = e.isHighlit ? "var(--orange-primary)" : e.isHover ? "#44403c" : "#d6d3d1";
          const sw = e.isHighlit ? 1.8 : e.isHover ? 1.6 : 1.2;
          const dasharray = tweaks.connStyle === "dotted" ? "4 4" : tweaks.connStyle === "dashed" ? "8 4" : "none";
          const marker = e.isHighlit ? "url(#arrow-hl)" : "url(#arrow)";
          return (
            <g key={i} opacity={dimEdge ? 0.25 : 1} style={{ transition: "opacity .35s" }}>
              <path d={edgePath(e.from, e.to, tweaks.connStyle === "straight" ? "straight" : "curve", horiz)}
                    stroke={stroke} strokeWidth={sw} fill="none"
                    strokeDasharray={dasharray}
                    markerEnd={marker}
                    style={tweaks.connStyle === "dotted" && e.isHighlit ? { animation: "dashflow 1.2s linear infinite" } : null}/>
            </g>
          );
        })}
      </svg>

      {/* Section labels */}
      {sectionLabels.map(s => {
        const SI = s.icon;
        return (
          <div key={s.key} style={{
            position: "absolute", left: s.pos.left, top: s.pos.top,
            display: "flex", alignItems: "center", gap: 6,
            fontSize: 10, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase",
            color: s.color, pointerEvents: "none",
            transform: horiz ? "translateX(-50%)" : "none",
          }}>
            <span style={{ display: "inline-flex" }}><SI size={12} /></span>
            {s.label}
            <span style={{
              fontSize: 10, color: "var(--stone-500)", background: "#fff",
              border: "1px solid var(--stone-200)", borderRadius: 9999,
              padding: "1px 6px", letterSpacing: 0, fontWeight: 600,
            }}>{s.count}{focusId && s.total !== s.count ? `/${s.total}` : ""}</span>
          </div>
        );
      })}

      {/* Nodes */}
      {flatNodes.map(n => {
        const p = positions[n.id];
        if (!p) return null;
        const dim = focusId && !visibleNodes.has(n.id);
        const isHover = hoverId === n.id;
        const isFocus = focusId === n.id;
        return (
          <Node key={n.id} node={n} layer={n._layer} pos={p} dim={dim}
                isHover={isHover} isFocus={isFocus}
                accent={tweaks.accent}
                onMouseEnter={() => setHoverId(n.id)}
                onMouseLeave={() => setHoverId(null)}
                onClick={(e) => {
                  if (n._layer === "resultado") {
                    setFocusId(focusId === n.id ? null : n.id);
                    openInspector(n.id, e.currentTarget);
                  } else if (n._layer === "tabla") {
                    openTable(n.id);
                  } else if (n._layer === "documento") {
                    openDoc(n);
                  } else {
                    openInspector(n.id, e.currentTarget);
                  }
                }}
                resultStyle={tweaks.resultStyle}
          />
        );
      })}

      {/* Focus banner — shows when a result is active */}
      {focusId && (() => {
        const r = TRAZA.resultados.find(x => x.id === focusId);
        if (!r) return null;
        return (
          <div data-focus-banner={focusId} style={{
            position: "absolute", top: 14, left: "50%",
            transform: "translateX(-50%)",
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 14px",
            background: "var(--orange-primary)", color: "#fff",
            borderRadius: 999,
            boxShadow: "0 6px 20px rgba(255,88,0,.30)",
            fontSize: 11, fontWeight: 600, zIndex: 5,
          }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".15em",
                           textTransform: "uppercase", opacity: .85 }}>Trazando</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{r.label} · {r.value}</span>
          </div>
        );
      })()}

      {/* Empty state guide when no focus — top-right, dismisses once result chosen */}
      {!focusId && (
        <div style={{
          position: "absolute", top: 14, right: 14,
          background: "rgba(255,255,255,.94)",
          border: "1px solid var(--stone-200)", borderRadius: 10,
          padding: "8px 12px", fontSize: 11, color: "var(--stone-600)",
          boxShadow: "0 1px 0 rgba(0,0,0,.03)",
          maxWidth: 240,
          backdropFilter: "blur(4px)",
          zIndex: 5,
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--orange-primary)", marginBottom: 3 }}>
            Vista completa
          </div>
          <div style={{ lineHeight: 1.4 }}>
            Click en un <strong>resultado</strong> para ver de dónde sale ese número.
          </div>
        </div>
      )}
    </div>
    </div>
  );
}

// =================================================================
// NODE component — renders different shapes per layer
// =================================================================
function Node({ node, layer, pos, dim, isHover, isFocus, accent, onMouseEnter, onMouseLeave, onClick, resultStyle }) {
  const meta = LAYER_META[layer];
  const Icon = meta.icon;

  const baseStyle = {
    position: "absolute",
    left: pos.x - pos.w / 2, top: pos.y - pos.h / 2,
    width: pos.w, height: pos.h,
    transition: "left .4s cubic-bezier(.2,.8,.2,1), top .4s cubic-bezier(.2,.8,.2,1), opacity .3s, box-shadow .2s, transform .2s",
    cursor: "pointer",
    opacity: dim ? 0.32 : 1,
    transform: isHover ? "translateY(-2px)" : "none",
  };

  if (layer === "resultado") {
    const r = node;
    const accentColor = accent === "stone" ? "var(--stone-900)" : "var(--orange-primary)";
    const bg = isFocus
      ? (accent === "stone" ? "var(--stone-900)" : "var(--orange-primary)")
      : "#fff";
    const fg = isFocus ? "#fff" : "var(--stone-900)";
    const borderC = isFocus ? "transparent" : "var(--stone-200)";

    if (resultStyle === "node") {
      // Compact pill node (graph-style)
      return (
        <div style={{
          ...baseStyle,
          width: 200, height: 70,
          left: pos.x - 100, top: pos.y - 35,
          background: bg, color: fg,
          borderRadius: 14,
          border: `1.5px solid ${borderC}`,
          boxShadow: isFocus
            ? "0 0 0 6px rgba(255,88,0,.12), 0 8px 20px rgba(255,88,0,.18)"
            : "0 1px 0 rgba(0,0,0,.04), 0 0 0 1px rgba(28,25,23,.04)",
          padding: "10px 14px",
          display: "flex", flexDirection: "column", justifyContent: "center", gap: 2,
        }} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onClick={onClick}>
          <div style={{ display: "flex", alignItems: "center", gap: 6,
                        fontSize: 9, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase",
                        color: isFocus ? "rgba(255,255,255,.78)" : accentColor }}>
            <Icon size={11} /> {r.label}
            {r.status === "warn"  && <span style={{ marginLeft: "auto", color: isFocus ? "#ffd0b3" : "#b45309" }}><IcoAlert size={11}/></span>}
            {r.status === "empty" && <span style={{ marginLeft: "auto", color: isFocus ? "#ffd0b3" : "#a8a29e" }}><IcoClock size={11}/></span>}
          </div>
          <div style={{
            fontSize: 22, fontWeight: 800, letterSpacing: "-.02em",
            fontVariantNumeric: "tabular-nums",
            color: fg, lineHeight: 1.05,
          }}>{r.value}</div>
        </div>
      );
    }

    // KPI card
    return (
      <div style={{
        ...baseStyle,
        width: 220, height: 110,
        left: pos.x - 110, top: pos.y - 55,
        background: bg, color: fg,
        borderRadius: 14,
        border: `1.5px solid ${borderC}`,
        boxShadow: isFocus
          ? "0 0 0 6px rgba(255,88,0,.10), 0 12px 30px rgba(255,88,0,.20)"
          : "0 0 0 1px rgba(28,25,23,.05), 0 1px 0 rgba(0,0,0,.04)",
        padding: "12px 14px",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
      }} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onClick={onClick}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase",
            color: isFocus ? "rgba(255,255,255,.78)" : accentColor,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <Icon size={11} /> {r.label}
          </div>
          {r.status === "warn"  && <span style={{ color: isFocus ? "#ffd0b3" : "#b45309" }}><IcoAlert size={12}/></span>}
          {r.status === "empty" && <span style={{ color: isFocus ? "#ffd0b3" : "#a8a29e" }}><IcoClock size={12}/></span>}
          {r.status === "ok"    && <span style={{ color: isFocus ? "rgba(255,255,255,.6)" : "#10b981", opacity: .7 }}><IcoCheck size={12}/></span>}
        </div>
        <div style={{
          fontSize: 28, fontWeight: 800, letterSpacing: "-.02em",
          fontVariantNumeric: "tabular-nums",
          color: fg, lineHeight: 1,
        }}>{r.value}</div>
        <div style={{
          fontSize: 10, color: isFocus ? "rgba(255,255,255,.7)" : "var(--stone-500)",
          lineHeight: 1.3,
        }}>{r.trend}</div>
      </div>
    );
  }

  if (layer === "calculo") {
    const c = node;
    return (
      <div style={{
        ...baseStyle,
        width: 170, height: 70,
        left: pos.x - 85, top: pos.y - 35,
        background: c.hardcoded ? "#fef9c3" : "#f5f3ff",
        border: `1.5px dashed ${c.hardcoded ? "#ca8a04" : "#7c3aed"}`,
        borderRadius: 999, // pill shape distinguishes calc
        padding: "8px 14px",
        display: "flex", alignItems: "center", gap: 8,
        boxShadow: isHover ? "0 4px 12px rgba(0,0,0,.06)" : "none",
      }} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onClick={onClick}>
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: c.hardcoded ? "#fde68a" : "#ddd6fe",
          color: c.hardcoded ? "#854d0e" : "#5b21b6",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}><IcoSigma size={14}/></div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--stone-900)", lineHeight: 1.2,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.label}</div>
          <div style={{ fontSize: 9, color: c.hardcoded ? "#854d0e" : "#5b21b6",
                        textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700, marginTop: 1 }}>
            {c.hardcoded ? "hardcodeado" : c.tipo}
          </div>
        </div>
      </div>
    );
  }

  if (layer === "macrotabla") {
    const m = node;
    return (
      <div style={{
        ...baseStyle,
        width: 180, height: 80,
        left: pos.x - 90, top: pos.y - 40,
        background: "#fff",
        border: "1.5px solid #0891b2",
        borderRadius: 10,
        padding: 10,
        boxShadow: isHover ? "0 8px 20px rgba(8,145,178,.15)" : "0 1px 0 rgba(0,0,0,.03)",
        display: "flex", flexDirection: "column", gap: 4,
      }} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onClick={onClick}>
        <div style={{ display: "flex", alignItems: "center", gap: 6,
                      fontSize: 9, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase",
                      color: "#0891b2" }}>
          <IcoLayers size={11}/> Macrotabla
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--stone-900)", lineHeight: 1.2 }}>
          {m.label}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: "auto", fontSize: 10,
                      color: "var(--stone-500)", fontVariantNumeric: "tabular-nums" }}>
          <span><strong style={{ color: "var(--stone-800)" }}>{m.fuentes}</strong> fuentes</span>
          <span><strong style={{ color: "var(--stone-800)" }}>{m.columnas}</strong> cols</span>
        </div>
      </div>
    );
  }

  if (layer === "tabla") {
    const t = node;
    const empty = t.status === "empty";
    const stale = t.status === "stale";
    const incomplete = t.status === "incomplete";
    const badgeColor = empty ? "#a8a29e" : stale ? "#b45309" : incomplete ? "#b91c1c" : "#10b981";
    return (
      <div style={{
        ...baseStyle,
        width: 170, height: 80,
        left: pos.x - 85, top: pos.y - 40,
        background: "#fff",
        border: `1px solid ${empty ? "#d6d3d1" : "var(--stone-200)"}`,
        borderRadius: 8,
        padding: "8px 10px",
        boxShadow: isHover ? "0 6px 14px rgba(0,0,0,.08)" : "0 1px 0 rgba(0,0,0,.03)",
        display: "flex", flexDirection: "column", gap: 2,
      }} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onClick={onClick}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "var(--stone-700)", display: "inline-flex" }}><IcoDb size={11}/></span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--stone-900)",
                         whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.label}</span>
          <span style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: badgeColor }}/>
        </div>
        <div style={{ display: "flex", gap: 10, fontSize: 10,
                      color: "var(--stone-500)", fontVariantNumeric: "tabular-nums" }}>
          <span><strong style={{ color: "var(--stone-800)" }}>{t.rows}</strong> filas</span>
          <span><strong style={{ color: "var(--stone-800)" }}>{t.cols}</strong> cols</span>
        </div>
        {(empty || stale || incomplete) && (
          <div style={{
            fontSize: 9, fontWeight: 600, color: badgeColor,
            textTransform: "uppercase", letterSpacing: ".08em",
            marginTop: "auto",
          }}>
            {empty ? "Sin datos" : stale ? `Vieja · ${t.lastUpdate}` : `Faltan ${t.missing}`}
          </div>
        )}
      </div>
    );
  }

  if (layer === "documento") {
    return (
      <div style={{
        ...baseStyle,
        width: 150, height: 64,
        left: pos.x - 75, top: pos.y - 32,
        background: "#fafaf9",
        border: "1px dashed var(--stone-300)",
        borderRadius: 8,
        padding: "8px 10px",
        display: "flex", alignItems: "center", gap: 8,
        boxShadow: isHover ? "0 4px 10px rgba(0,0,0,.06)" : "none",
      }} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onClick={onClick}>
        <div style={{ color: "var(--stone-500)" }}><IcoFolder size={16}/></div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--stone-700)",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {node.label}
          </div>
          <div style={{ fontSize: 9, color: "var(--stone-500)",
                        textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 600 }}>
            {node.count} doc{node.count !== 1 ? "s" : ""}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

window.TrazaCanvas = TrazaCanvas;
window.LAYER_META = LAYER_META;
