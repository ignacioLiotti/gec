import JSZip from "jszip";
import type { ReportComposition } from "@/lib/document-ai/schemas/types";
import { xmlEscape, zipToBytes } from "./openxml";

function slideXml(title: string, body: string) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>
    <p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="274320"/><a:ext cx="8229600" cy="800000"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="3200" b="1"/><a:t>${xmlEscape(title)}</a:t></a:r></a:p></p:txBody></p:sp>
    <p:sp><p:nvSpPr><p:cNvPr id="3" name="Body"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="1250000"/><a:ext cx="8229600" cy="4300000"/></a:xfrm></p:spPr><p:txBody><a:bodyPr wrap="square"/><a:lstStyle/>${body.split("\n").slice(0, 10).map((line) => `<a:p><a:r><a:rPr sz="1800"/><a:t>${xmlEscape(line)}</a:t></a:r></a:p>`).join("")}</p:txBody></p:sp>
  </p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

export async function renderReportPptx(composition: ReportComposition) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  ${[1, 2, 3, 4, 5, 6].map((index) => `<Override PartName="/ppt/slides/slide${index}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("")}
</Types>`);
  zip.folder("_rels")?.file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`);
  zip.folder("ppt/_rels")?.file("presentation.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${[1, 2, 3, 4, 5, 6].map((index) => `<Relationship Id="rId${index}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index}.xml"/>`).join("")}
</Relationships>`);
  zip.folder("ppt")?.file("presentation.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst>${[1, 2, 3, 4, 5, 6].map((index) => `<p:sldId id="${255 + index}" r:id="rId${index}"/>`).join("")}</p:sldIdLst>
  <p:sldSz cx="9144000" cy="5143500" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`);
  const slideBodies = [
    [composition.title, composition.executiveSummary],
    ["Resumen ejecutivo", composition.sections.map((section) => `${section.title}: ${section.narrative}`).join("\n")],
    ["Graficos", composition.charts.map((chart) => `${chart.title}: ${chart.data.length} puntos`).join("\n") || "Sin graficos disponibles"],
    ["Conflictos", composition.conflicts.map((conflict) => `${conflict.field}: revisar ${conflict.candidates.length} valores`).join("\n") || "Sin conflictos detectados"],
    ["Advertencias", composition.warnings.join("\n") || "Sin advertencias"],
    ["Fuentes", composition.sources.slice(0, 8).map((source) => source.documentFileName ?? source.documentPath ?? source.tableId ?? "Fuente").join("\n")],
  ];
  const slides = zip.folder("ppt/slides");
  slideBodies.forEach(([title, body], index) => slides?.file(`slide${index + 1}.xml`, slideXml(title, body)));
  return zipToBytes(zip);
}
