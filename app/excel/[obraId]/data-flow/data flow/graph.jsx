/* global React, TRAZA, IcoDb, IcoLayers, IcoSigma, IcoTarget, IcoFile, IcoFolder, IcoAlert, IcoCheck, IcoClock, IcoX, IcoChevR, IcoArrow, IcoEye, IcoDownload, IcoTable, IcoShare */
const { useState, useMemo, useRef, useEffect } = React;

// =================================================================
// LAYOUT ENGINE — given a set of visible layers + nodes, returns
// {x, y} positions for the chosen layout (vertical | horizontal | radial).
// =================================================================

// Builds the upstream subgraph for a focused result, OR returns the full graph.
function buildGraph({ focusId, showCalc, showDocs }) {
  const { resultados, calculos, macrotablas, tablas, documentos } = TRAZA;

  const layers = [];
  // resultado layer is rendered as the ResultsBar above the canvas, not inside it
  if (showCalc) layers.push({ key: "calculo", nodes: calculos });
  layers.push({ key: "macrotabla", nodes: macrotablas });
  layers.push({ key: "tabla",      nodes: tablas });
  if (showDocs) {
    // Synthesize doc-cluster nodes (one per table that has docs)
    const docNodes = tablas
      .filter(t => (documentos[t.id] || []).length > 0 || t.docs > 0)
      .map(t => ({
        id: "doc-" + t.id,
        label: t.folder,
        tableId: t.id,
        count: t.docs,
        kind: "doc",
      }));
    layers.push({ key: "documento", nodes: docNodes });
  }

  // Edges (always computed downstream → upstream)
  const edges = [];
  resultados.forEach(r => {
    if (showCalc) {
      edges.push({ from: r.id, to: r.calc });
      const c = calculos.find(x => x.id === r.calc);
      if (c) c.inputs.forEach(mid => edges.push({ from: c.id, to: mid }));
    } else {
      // Skip calc → connect result to its sources' macrotablas
      const calc = calculos.find(x => x.id === r.calc);
      if (calc) calc.inputs.forEach(mid => edges.push({ from: r.id, to: mid }));
    }
  });
  macrotablas.forEach(m => {
    m.sources.forEach(tid => edges.push({ from: m.id, to: tid }));
  });
  if (showDocs) {
    tablas.forEach(t => {
      if ((documentos[t.id] || []).length > 0 || t.docs > 0) {
        edges.push({ from: t.id, to: "doc-" + t.id });
      }
    });
  }

  // Filter to upstream subgraph if focusId set
  // resultado is the entry point but rendered as ResultsBar, not in canvas.
  // BFS starts from focused resultado and includes everything reachable downstream.
  let visibleNodes = new Set();
  if (focusId) {
    const queue = [focusId];
    visibleNodes.add(focusId);
    while (queue.length) {
      const cur = queue.shift();
      edges.filter(e => e.from === cur).forEach(e => {
        if (!visibleNodes.has(e.to)) {
          visibleNodes.add(e.to);
          queue.push(e.to);
        }
      });
    }
    // Remove the focused resultado itself from the visible set (rendered above canvas)
    visibleNodes.delete(focusId);
  }

  return { layers, edges, visibleNodes };
}

// Returns positions {nodeId: {x,y,w,h,layer}}
function computeLayout({ layout, layers, focusId, visibleNodes, dims }) {
  const positions = {};
  const { width: W, height: H } = dims;

  if (layout === "radial" && focusId) {
    // No center node anymore — distribute layers in concentric arcs
    const cx = W / 2, cy = H / 2 + 40;
    layers.forEach((layer, li) => {
      const visible = layer.nodes.filter(n => visibleNodes.has(n.id));
      const radius = 100 + li * 130;
      visible.forEach((n, i) => {
        const total = visible.length;
        const spread = Math.min(Math.PI * 1.1, 0.6 + total * 0.22);
        const start = -Math.PI / 2 - spread / 2;
        const angle = total === 1 ? -Math.PI / 2 : start + (spread * i) / (total - 1);
        positions[n.id] = {
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius,
          w: 170, h: 70, layer: li,
        };
      });
    });
    return positions;
  }

  // Vertical or Horizontal: layered Sugiyama-ish
  const horiz = layout === "horizontal";
  const layerCount = layers.length;
  const margin = horiz ? 40 : 30;
  const layerSize = horiz ? (W - margin * 2) / layerCount : (H - margin * 2) / layerCount;

  layers.forEach((layer, li) => {
    const visible = focusId
      ? layer.nodes.filter(n => visibleNodes.has(n.id))
      : layer.nodes;
    const count = visible.length;
    const cross = horiz ? H : W;
    const itemSize = (cross - margin * 2) / Math.max(count, 1);
    visible.forEach((n, i) => {
      const along = margin + li * layerSize + layerSize / 2;
      const across = margin + i * itemSize + itemSize / 2;
      positions[n.id] = horiz
        ? { x: along, y: across, w: layer.key === "resultado" ? 200 : 180, h: 80, layer: li }
        : { x: across, y: along, w: layer.key === "resultado" ? 220 : 180, h: 80, layer: li };
    });
  });

  return positions;
}

window.buildGraph = buildGraph;
window.computeLayout = computeLayout;
