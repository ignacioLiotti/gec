import { composeReportLayoutPlan, type ReportLayoutBlock } from "@/lib/document-ai/composer/compose-layout-plan";
import type { ChartDefinition, ReportComposition, TableDefinition } from "@/lib/document-ai/schemas/types";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseMoney(value: unknown) {
  const parsed = Number(
    String(value ?? "")
      .replace(/[^\d,.-]/g, "")
      .replace(/\.(?=\d{3}(?:\D|$))/g, "")
      .replace(",", "."),
  );
  return Number.isFinite(parsed) ? parsed : 0;
}

function renderChartSvg(chart: ChartDefinition) {
  const width = 760;
  const height = 280;
  const padding = 44;
  const keys = chart.yKeys.length ? chart.yKeys : [""];
  const values = chart.data.flatMap((entry) => keys.map((key) => Number(entry[key] ?? 0)));
  const max = Math.max(1, ...values);
  if (chart.type === "bar") {
    const groupWidth = (width - padding * 2) / Math.max(1, chart.data.length);
    const barWidth = Math.max(7, Math.min(28, (groupWidth - 14) / Math.max(1, keys.length)));
    const colors = ["#0f766e", "#b45309", "#1d4ed8", "#7c3aed"];
    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(chart.title)}">
    <rect x="0" y="0" width="${width}" height="${height}" rx="8" fill="#fafaf9" />
    <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#d6d3d1" />
    <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#d6d3d1" />
    ${[0.25, 0.5, 0.75, 1].map((tick) => `<line x1="${padding}" y1="${height - padding - tick * (height - padding * 2)}" x2="${width - padding}" y2="${height - padding - tick * (height - padding * 2)}" stroke="#e7e5e4" />`).join("")}
    ${chart.data
      .map((entry, index) =>
        keys
          .map((key, keyIndex) => {
            const value = Number(entry[key] ?? 0);
            const barHeight = (value / max) * (height - padding * 2);
            const x = padding + index * groupWidth + (groupWidth - barWidth * keys.length) / 2 + keyIndex * barWidth;
            const y = height - padding - barHeight;
            return `<rect x="${x}" y="${y}" width="${barWidth - 2}" height="${barHeight}" rx="3" fill="${colors[keyIndex % colors.length]}"><title>${escapeHtml(key)} ${escapeHtml(entry[chart.xKey])}: ${value}</title></rect>`;
          })
          .join(""),
      )
      .join("")}
    ${chart.data.map((entry, index) => `<text x="${padding + index * groupWidth + groupWidth / 2}" y="${height - 16}" text-anchor="middle" font-size="10" fill="#57534e">${escapeHtml(entry[chart.xKey])}</text>`).join("")}
    ${keys.map((key, index) => `<rect x="${padding + index * 180}" y="14" width="10" height="10" fill="${colors[index % colors.length]}" /><text x="${padding + 14 + index * 180}" y="23" font-size="10" fill="#57534e">${escapeHtml(key)}</text>`).join("")}
  </svg>`;
  }
  const key = keys[0] ?? "";
  const points = chart.data.map((entry, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(1, chart.data.length - 1);
    const y = height - padding - (Number(entry[key] ?? 0) / max) * (height - padding * 2);
    return { x, y, label: String(entry[chart.xKey] ?? ""), value: Number(entry[key] ?? 0) };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(chart.title)}">
    <rect x="0" y="0" width="${width}" height="${height}" rx="8" fill="#fafaf9" />
    <path d="${path}" fill="none" stroke="#0f766e" stroke-width="3" />
    ${points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4" fill="#0f766e"><title>${escapeHtml(point.label)}: ${point.value}</title></circle>`).join("")}
    ${points.map((point, index) => index % Math.ceil(points.length / 6 || 1) === 0 ? `<text x="${point.x}" y="${height - 12}" text-anchor="middle" font-size="10" fill="#57534e">${escapeHtml(point.label)}</text>` : "").join("")}
  </svg>`;
}

function renderSimpleTable(table: TableDefinition, limit = 80, title = table.title) {
  return `<section class="table-section"><h2>${escapeHtml(title)}</h2><table><thead><tr>${table.columns
    .map((column) => `<th>${escapeHtml(column.label)}</th>`)
    .join("")}</tr></thead><tbody>${table.rows
    .slice(0, limit)
    .map((row) => `<tr>${table.columns.map((column) => `<td>${escapeHtml(row[column.key])}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></section>`;
}

function renderKpis(table: TableDefinition) {
  return `<section class="kpi-grid">${table.rows
    .map(
      (row) => `<article class="kpi-card">
        <div class="kpi-label">${escapeHtml(row.indicador)}</div>
        <div class="kpi-value">${escapeHtml(row.valor)}</div>
      </article>`,
    )
    .join("")}</section>`;
}

function renderMonthlyCards(table: TableDefinition) {
  return `<section><div class="section-heading"><span>Vista mensual</span><small>Lectura ejecutiva</small></div>
    <div class="month-grid">${table.rows
      .map((row) => {
        const result = parseMoney(row.resultado);
        const tone = result < 0 ? "negative" : "positive";
        return `<article class="month-card ${tone}">
          <div class="month-top"><strong>${escapeHtml(row.periodo)}</strong><span>Cert. ${escapeHtml(row.certificado)}</span></div>
          <dl>
            <div><dt>Certificado</dt><dd>${escapeHtml(row.ingreso_certificado)}</dd></div>
            <div><dt>Gastos OC</dt><dd>${escapeHtml(row.gasto_total)}</dd></div>
            <div><dt>Resultado</dt><dd>${escapeHtml(row.resultado)}</dd></div>
            <div><dt>Avance</dt><dd>${escapeHtml(row.avance)}</dd></div>
          </dl>
        </article>`;
      })
      .join("")}</div></section>`;
}

function renderMonthlyNarrative(table: TableDefinition) {
  return `<section class="narrative-panel"><div class="section-heading"><span>Explicacion mensual</span><small>Interpretacion</small></div>
    ${table.rows
      .map((row) => {
        const certified = parseMoney(row.ingreso_certificado);
        const spent = parseMoney(row.gasto_total);
        const result = parseMoney(row.resultado);
        const base =
          certified > 0 && spent > 0
            ? `se certificaron ${row.ingreso_certificado} y se registraron gastos OC por ${row.gasto_total}, con resultado mensual de ${row.resultado}.`
            : certified > 0
              ? `se certificaron ${row.ingreso_certificado} y no hay gastos OC fechados para ese mes.`
              : spent > 0
                ? `no hay certificado registrado y se observan gastos OC por ${row.gasto_total}.`
                : "hay registros del periodo, pero sin movimiento monetario valorizado.";
        const accumulated = row.monto_acumulado && row.monto_acumulado !== "-" ? ` Acumulado informado: ${row.monto_acumulado}.` : "";
        const progress = row.avance && row.avance !== "-" ? ` Avance fisico: ${row.avance}.` : "";
        const resultTone = result < 0 ? " negative-text" : "";
        return `<p class="${resultTone}"><strong>${escapeHtml(row.periodo)}:</strong> ${escapeHtml(base)}${escapeHtml(accumulated)}${escapeHtml(progress)}</p>`;
      })
      .join("")}</section>`;
}

function renderCategoryMatrix(table: TableDefinition) {
  const periods = Array.from(new Set(table.rows.map((row) => String(row.periodo ?? "")))).filter(Boolean);
  const categories = Array.from(new Set(table.rows.map((row) => String(row.categoria ?? "")))).filter(Boolean).slice(0, 6);
  const valueFor = (periodo: string, categoria: string) =>
    table.rows.find((row) => row.periodo === periodo && row.categoria === categoria)?.gasto_total ?? "-";
  return `<section class="table-section"><h2>3. Costos por mes y categorias</h2><table><thead><tr><th>Mes</th>${categories
    .map((category) => `<th>${escapeHtml(category)}</th>`)
    .join("")}</tr></thead><tbody>${periods
    .map((periodo) => `<tr><td>${escapeHtml(periodo)}</td>${categories.map((category) => `<td>${escapeHtml(valueFor(periodo, category))}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></section>`;
}

function renderCategoryHighlights(table: TableDefinition) {
  return `<section><div class="section-heading"><span>Principales categorias</span><small>OC fechadas</small></div>
    <div class="category-list">${table.rows
      .slice(0, 8)
      .map((row) => `<div class="category-row"><span>${escapeHtml(row.categoria)}</span><strong>${escapeHtml(row.monto)}</strong><em>${escapeHtml(row.participacion)}</em></div>`)
      .join("")}</div></section>`;
}

function renderOrdersWithoutDate(table: TableDefinition) {
  return `<section class="warning-panel"><div class="section-heading"><span>Ordenes pendientes de fecha</span><small>${table.rows.length} orden(es)</small></div>
    <div class="compact-grid">${table.rows
      .slice(0, 12)
      .map((row) => `<div class="compact-card"><strong>OC ${escapeHtml(row.nro)}</strong><span>${escapeHtml(row.proveedor)}</span><em>${escapeHtml(row.total)}</em></div>`)
      .join("")}</div></section>`;
}

function renderQualityNotes(table: TableDefinition) {
  return `<section class="quality-panel"><div class="section-heading"><span>Notas metodologicas</span><small>Criterios aplicados</small></div>${table.rows
    .map((row) => `<p><strong>${escapeHtml(row.control)}:</strong> ${escapeHtml(row.resultado)}</p>`)
    .join("")}</section>`;
}

function renderBlock(block: ReportLayoutBlock) {
  switch (block.type) {
    case "hero":
      return `<div class="hero"><div class="meta">${escapeHtml(block.meta)}</div><h1>${escapeHtml(block.title)}</h1><p>${escapeHtml(block.subtitle)}</p></div>`;
    case "warning_strip":
      return `<section class="warning-strip">${block.warnings.map((warning) => `<span>${escapeHtml(warning)}</span>`).join("")}</section>`;
    case "narrative":
      return `<section class="${block.tone === "muted" ? "muted-panel" : "narrative-panel"}"><h2>${escapeHtml(block.title)}</h2><p>${escapeHtml(block.body)}</p></section>`;
    case "kpi_grid":
      return renderKpis(block.table);
    case "chart":
      return `<section class="chart-panel"><div class="section-heading"><span>${escapeHtml(block.chart.title)}</span><small>${escapeHtml(block.eyebrow ?? "Grafico")}</small></div>${renderChartSvg(block.chart)}</section>`;
    case "comparison_table":
      return renderSimpleTable(block.table, block.limit ?? 20, block.title ?? block.table.title);
    case "monthly_narrative":
      return renderMonthlyNarrative(block.table);
    case "monthly_cards":
      return renderMonthlyCards(block.table);
    case "category_matrix":
      return renderCategoryMatrix(block.table);
    case "category_highlights":
      return renderCategoryHighlights(block.table);
    case "orders_without_date":
      return renderOrdersWithoutDate(block.table);
    case "quality_notes":
      return renderQualityNotes(block.table);
    case "section":
      return `<section><h2>${escapeHtml(block.section.title)}</h2><p>${escapeHtml(block.section.narrative)}</p>${block.section.evidence.length ? `<p class="source">${block.section.evidence.length} fuente(s) vinculadas</p>` : ""}</section>`;
    case "appendix_table":
      return renderSimpleTable(block.table, block.limit ?? 80);
  }
}

export function renderReportHtml(composition: ReportComposition) {
  const plan = composeReportLayoutPlan(composition);
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { margin: 0; font-family: Arial, sans-serif; color: #1c1917; background: #f5f5f4; }
    main { max-width: 980px; margin: 0 auto; padding: 34px 28px; background: white; min-height: 100vh; }
    h1 { font-size: 30px; line-height: 1.08; margin: 0 0 10px; }
    h2 { font-size: 18px; margin: 24px 0 10px; }
    p { line-height: 1.55; }
    .meta { color: #78716c; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
    .hero { border-bottom: 3px solid #0f766e; padding: 10px 0 18px; margin-bottom: 18px; }
    .hero p { max-width: 820px; color: #57534e; margin: 0; }
    .section-heading { align-items: baseline; display: flex; justify-content: space-between; gap: 14px; margin: 22px 0 10px; }
    .section-heading span { font-size: 18px; font-weight: 700; }
    .section-heading small { color: #78716c; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
    .kpi-grid { display: grid; gap: 10px; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 16px 0 8px; }
    .kpi-card { border: 1px solid #e7e5e4; border-left: 4px solid #0f766e; border-radius: 8px; padding: 12px; background: #fff; min-height: 72px; }
    .kpi-label { color: #78716c; font-size: 11px; line-height: 1.3; text-transform: uppercase; }
    .kpi-value { font-size: 18px; font-weight: 700; margin-top: 7px; }
    .chart-panel { border: 1px solid #e7e5e4; border-radius: 8px; padding: 14px; margin-top: 14px; break-inside: avoid; }
    .month-grid { display: grid; gap: 10px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .month-card { border: 1px solid #e7e5e4; border-radius: 8px; padding: 12px; break-inside: avoid; background: #fff; }
    .month-card.positive { border-left: 4px solid #0f766e; }
    .month-card.negative { border-left: 4px solid #b45309; }
    .month-top { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .month-top span { color: #78716c; font-size: 12px; }
    dl { display: grid; gap: 7px; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 0; }
    dt { color: #78716c; font-size: 10px; text-transform: uppercase; }
    dd { margin: 2px 0 0; font-weight: 700; }
    .narrative-panel, .muted-panel { border: 1px solid #e7e5e4; border-radius: 8px; padding: 12px; margin-top: 16px; }
    .narrative-panel p { margin: 8px 0; }
    .muted-panel { background: #fafaf9; color: #57534e; }
    .negative-text { color: #92400e; }
    .category-list { border: 1px solid #e7e5e4; border-radius: 8px; overflow: hidden; }
    .category-row { align-items: center; display: grid; grid-template-columns: minmax(0, 1fr) 150px 76px; gap: 10px; padding: 10px 12px; border-bottom: 1px solid #f5f5f4; }
    .category-row:last-child { border-bottom: 0; }
    .category-row em { color: #78716c; font-style: normal; text-align: right; }
    .warning-strip { display: grid; gap: 6px; margin: 12px 0; }
    .warning-strip span, .warning { color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 8px 10px; }
    .warning-panel { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; margin-top: 18px; }
    .compact-grid { display: grid; gap: 8px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .compact-card { background: #fff; border: 1px solid #fde68a; border-radius: 6px; display: grid; gap: 3px; padding: 8px; }
    .compact-card span { color: #57534e; font-size: 11px; }
    .compact-card em { font-style: normal; font-weight: 700; }
    .quality-panel { background: #f8fafc; border: 1px solid #dbeafe; border-radius: 8px; padding: 12px; margin-top: 18px; }
    .quality-panel p { margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
    th, td { border-bottom: 1px solid #e7e5e4; padding: 7px; text-align: left; vertical-align: top; }
    th { background: #f5f5f4; }
    .table-section { break-inside: avoid; margin-top: 18px; }
    .source { font-size: 11px; color: #57534e; }
    @media print {
      main { padding: 24px; }
      .kpi-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .month-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  </style>
</head>
<body>
<main>
  ${plan.blocks.map((block) => renderBlock(block)).join("")}
</main>
</body>
</html>`;
}
