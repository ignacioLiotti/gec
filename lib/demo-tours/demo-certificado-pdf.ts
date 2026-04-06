const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;

function pdfEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function yFromTop(top: number) {
  return PAGE_HEIGHT - top;
}

function drawText(
  x: number,
  top: number,
  text: string,
  size = 11,
  font = "F1",
) {
  return `BT /${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${yFromTop(top).toFixed(
    2,
  )} Tm (${pdfEscape(text)}) Tj ET`;
}

function drawLine(x1: number, y1Top: number, x2: number, y2Top: number, width = 1) {
  return `${width.toFixed(2)} w ${x1.toFixed(2)} ${yFromTop(y1Top).toFixed(2)} m ${x2.toFixed(
    2,
  )} ${yFromTop(y2Top).toFixed(2)} l S`;
}

function drawRect(x: number, top: number, width: number, height: number, lineWidth = 1) {
  return `${lineWidth.toFixed(2)} w ${x.toFixed(2)} ${(
    PAGE_HEIGHT - top - height
  ).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S`;
}

function fillRect(
  x: number,
  top: number,
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
) {
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ${x.toFixed(2)} ${(
    PAGE_HEIGHT - top - height
  ).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f 0 0 0 rg`;
}

function buildPdfBytes(contentStream: string) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`,
  ];

  let output = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(output.length);
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = output.length;
  output += `xref\n0 ${objects.length + 1}\n`;
  output += "0000000000 65535 f \n";

  for (let index = 1; index <= objects.length; index += 1) {
    output += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }

  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new TextEncoder().encode(output);
}

export function createDemoCertificadoPdfBytes() {
  const commands: string[] = [];

  commands.push("0 0 0 RG");
  commands.push(drawRect(12, 12, 818, 568, 1.2));

  commands.push(drawText(24, 30, "REPUBLICA ARGENTINA - DOCUMENTO DE DEMOSTRACION", 10, "F2"));
  commands.push(drawText(24, 56, "CERTIFICADO MENSUAL DE OBRA", 24, "F2"));
  commands.push(drawText(24, 78, "Modelo sintetico con formato administrativo de alta densidad", 10, "F1"));
  commands.push(drawLine(24, 92, 818, 92, 1.1));

  commands.push(drawRect(690, 24, 140, 56, 1));
  commands.push(drawText(698, 40, "CERTIFICADO No 10/2026", 10, "F2"));
  commands.push(drawText(698, 56, "Fecha de emision: 2026-04-15", 9, "F1"));
  commands.push(drawText(698, 70, "Periodo: abril de 2026", 9, "F1"));

  commands.push(drawRect(24, 102, 410, 132, 1));
  commands.push(drawRect(442, 102, 388, 132, 1));
  commands.push(drawText(32, 118, "DATOS DEL PROYECTO", 11, "F2"));
  commands.push(drawText(450, 118, "DATOS CONTRACTUALES", 11, "F2"));

  const leftRows = [
    ["OBRA", "Parque Industrial San Martin"],
    ["EXPEDIENTE", "EXP-8835/2024"],
    ["COMITENTE", "Direccion Provincial de Obras Publicas"],
    ["CONTRATISTA", "Constructora Delta SRL"],
    ["UBICACION", "Corrientes Capital"],
    ["INSPECCION", "Departamento Tecnico de Seguimiento"],
  ];
  const rightRows = [
    ["CONTRATO", "LIC-42-4476"],
    ["RESOLUCION", "RES-202/2026"],
    ["FECHA FIRMA", "2025-11-10"],
    ["MONEDA", "ARS"],
    ["MONTO", "$ 291.000.000"],
    ["PLAZO", "258 dias"],
  ];

  let currentTop = 124;
  leftRows.forEach(([label, value]) => {
    commands.push(drawLine(24, currentTop, 434, currentTop, 0.6));
    commands.push(drawLine(144, currentTop, 144, currentTop + 22, 0.6));
    commands.push(drawText(32, currentTop + 15, label, 9, "F2"));
    commands.push(drawText(152, currentTop + 15, value, 9, "F1"));
    currentTop += 22;
  });

  currentTop = 124;
  rightRows.forEach(([label, value]) => {
    commands.push(drawLine(442, currentTop, 830, currentTop, 0.6));
    commands.push(drawLine(560, currentTop, 560, currentTop + 22, 0.6));
    commands.push(drawText(450, currentTop + 15, label, 9, "F2"));
    commands.push(drawText(568, currentTop + 15, value, 9, "F1"));
    currentTop += 22;
  });

  commands.push(drawRect(24, 242, 794, 118, 1));
  commands.push(drawText(32, 258, "DETALLE DE ITEMS CERTIFICADOS", 11, "F2"));
  commands.push(drawLine(24, 268, 818, 268, 0.8));
  commands.push(drawLine(70, 268, 70, 360, 0.6));
  commands.push(drawLine(310, 268, 310, 360, 0.6));
  commands.push(drawLine(364, 268, 364, 360, 0.6));
  commands.push(drawLine(464, 268, 464, 360, 0.6));
  commands.push(drawLine(526, 268, 526, 360, 0.6));
  commands.push(drawLine(580, 268, 580, 360, 0.6));
  commands.push(drawLine(644, 268, 644, 360, 0.6));
  commands.push(drawLine(730, 268, 730, 360, 0.6));
  commands.push(drawText(40, 284, "Item", 8, "F2"));
  commands.push(drawText(122, 284, "Descripcion", 8, "F2"));
  commands.push(drawText(326, 284, "Unid.", 8, "F2"));
  commands.push(drawText(387, 284, "Cant. Contr.", 8, "F2"));
  commands.push(drawText(495, 284, "Ant.", 8, "F2"));
  commands.push(drawText(546, 284, "Mes", 8, "F2"));
  commands.push(drawText(596, 284, "Acum.", 8, "F2"));
  commands.push(drawText(670, 284, "P. Unit.", 8, "F2"));
  commands.push(drawText(756, 284, "Subtotal", 8, "F2"));

  const itemRows = [
    ["1.1", "Movimiento de suelos y nivelacion", "m3", "1.670", "611", "243", "854", "$ 18.500", "$ 4.495.500"],
    ["2.4", "Hormigon elaborado H21", "m3", "676", "369", "71", "440", "$ 92.000", "$ 6.532.000"],
    ["3.2", "Acero ADN 420", "kg", "60.457", "21.209", "5.518", "26.727", "$ 2.100", "$ 11.587.800"],
    ["4.5", "Encofrado recuperable", "m2", "1.713", "712", "71", "783", "$ 36.500", "$ 2.591.500"],
    ["5.1", "Ejecucion de columnas H A", "m3", "643", "344", "37", "381", "$ 124.000", "$ 4.588.000"],
  ];

  currentTop = 294;
  itemRows.forEach((row) => {
    commands.push(drawLine(24, currentTop, 818, currentTop, 0.5));
    commands.push(drawText(38, currentTop + 14, row[0], 7.5, "F1"));
    commands.push(drawText(78, currentTop + 14, row[1], 7.5, "F1"));
    commands.push(drawText(326, currentTop + 14, row[2], 7.5, "F1"));
    commands.push(drawText(437, currentTop + 14, row[3], 7.5, "F1"));
    commands.push(drawText(503, currentTop + 14, row[4], 7.5, "F1"));
    commands.push(drawText(548, currentTop + 14, row[5], 7.5, "F1"));
    commands.push(drawText(598, currentTop + 14, row[6], 7.5, "F1"));
    commands.push(drawText(684, currentTop + 14, row[7], 7.5, "F1"));
    commands.push(drawText(744, currentTop + 14, row[8], 7.5, "F2"));
    currentTop += 18;
  });

  commands.push(drawRect(24, 370, 490, 162, 1));
  commands.push(drawRect(522, 370, 296, 162, 1));
  commands.push(drawText(32, 386, "OBSERVACIONES ADMINISTRATIVAS", 11, "F2"));
  commands.push(drawText(530, 386, "RESUMEN ECONOMICO", 11, "F2"));
  commands.push(drawText(32, 414, "Se deja constancia de que las cantidades certificadas corresponden a", 9, "F1"));
  commands.push(drawText(32, 428, "trabajos efectivamente ejecutados y verificadas en obra por la", 9, "F1"));
  commands.push(drawText(32, 442, "inspeccion tecnica actuante, conforme a la documentacion respaldatoria", 9, "F1"));
  commands.push(drawText(32, 456, "obrante en expediente y a los computos aprobados por la superioridad.", 9, "F1"));

  const summaryRows = [
    ["ACUM. ANTERIOR", "$ 38.000.000"],
    ["% AVANCE ANT.", "21%"],
    ["MONTO MES", "$ 17.000.000"],
    ["ACUM. ACTUAL", "$ 55.000.000"],
    ["% AVANCE ACUM.", "34%"],
    ["SALDO", "$ 236.000.000"],
    ["RETENCION", "$ 850.000"],
    ["IMPUESTOS", "$ 3.570.000"],
  ];

  currentTop = 402;
  summaryRows.forEach(([label, value]) => {
    commands.push(drawLine(522, currentTop, 818, currentTop, 0.6));
    commands.push(drawLine(640, currentTop, 640, currentTop + 22, 0.6));
    commands.push(drawText(532, currentTop + 15, label, 9, "F2"));
    commands.push(drawText(648, currentTop + 15, value, 9, "F1"));
    currentTop += 22;
  });

  commands.push(fillRect(522, 578 - 68, 296, 24, 0.09, 0.12, 0.22));
  commands.push(drawText(532, 534, "NETO A PAGAR", 10, "F2"));
  commands.push("1 1 1 rg");
  commands.push(drawText(744, 534, "$ 19.720.000", 10, "F2"));
  commands.push("0 0 0 rg");

  commands.push(drawRect(24, 540, 268, 50, 1));
  commands.push(drawRect(304, 540, 268, 50, 1));
  commands.push(drawRect(584, 540, 246, 50, 1));
  commands.push(drawLine(36, 562, 280, 562, 0.8));
  commands.push(drawLine(316, 562, 560, 562, 0.8));
  commands.push(drawLine(596, 562, 818, 562, 0.8));
  commands.push(drawText(128, 578, "MARINA SOSA", 9, "F2"));
  commands.push(drawText(136, 592, "PREPARO", 9, "F1"));
  commands.push(drawText(404, 578, "MARTIN QUIROGA", 9, "F2"));
  commands.push(drawText(425, 592, "REVISO", 9, "F1"));
  commands.push(drawText(684, 578, "PAULA SOSA", 9, "F2"));
  commands.push(drawText(692, 592, "APROBO", 9, "F1"));

  return buildPdfBytes(commands.join("\n"));
}

export function downloadDemoCertificadoPdf() {
  const pdfBytes = createDemoCertificadoPdfBytes();
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "certificado-demo-abril-2026.pdf";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
