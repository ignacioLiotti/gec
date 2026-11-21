import { Buffer } from "node:buffer";
import JSZip from "jszip";

export type DocumentFileFixture = {
	name: string;
	mimeType: string;
	buffer: Buffer;
};

function buildMinimalPdf(text: string) {
	const pageContent = `BT /F1 12 Tf 24 72 Td (${text}) Tj ET\n`;
	const objects = [
		"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
		"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
		"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n",
		`4 0 obj\n<< /Length ${Buffer.byteLength(pageContent, "utf8")} >>\nstream\n${pageContent}endstream\nendobj\n`,
		"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
	];
	let body = "%PDF-1.4\n";
	const offsets = [0];
	for (const object of objects) {
		offsets.push(Buffer.byteLength(body, "utf8"));
		body += object;
	}
	const xrefOffset = Buffer.byteLength(body, "utf8");
	body += `xref\n0 ${objects.length + 1}\n`;
	body += "0000000000 65535 f \n";
	body += offsets
		.slice(1)
		.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
		.join("");
	body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
	return Buffer.from(body, "utf8");
}

export const uploadedDocumentFixtures = [
	{
		name: "site-photo.png",
		mimeType: "image/png",
		buffer: Buffer.from(
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
			"base64",
		),
	},
	{
		name: "inspection-report.pdf",
		mimeType: "application/pdf",
		buffer: buildMinimalPdf("E2E inspection report"),
	},
	{
		name: "field-notes.txt",
		mimeType: "text/plain",
		buffer: Buffer.from("Deterministic field note for document persistence.\n", "utf8"),
	},
] satisfies DocumentFileFixture[];

const docxText = "Deterministic DOCX document for upload persistence.";

function addDeterministicZipFile(zip: JSZip, path: string, content: string) {
	zip.file(path, content, { date: new Date("2026-10-19T00:00:00.000Z") });
}

async function buildMinimalDocx() {
	const zip = new JSZip();
	addDeterministicZipFile(
		zip,
		"[Content_Types].xml",
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
	);
	addDeterministicZipFile(
		zip,
		"_rels/.rels",
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
	);
	addDeterministicZipFile(
		zip,
		"word/document.xml",
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>${docxText}</w:t></w:r></w:p><w:sectPr/></w:body>
</w:document>`,
	);
	return Buffer.from(await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }));
}

export async function createUploadedDocumentFixtures() {
	return [
		...uploadedDocumentFixtures,
		{
			name: "daily-report.docx",
			mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			buffer: await buildMinimalDocx(),
		},
	] satisfies DocumentFileFixture[];
}

export async function readDocxDocumentXml(buffer: Buffer) {
	const zip = await JSZip.loadAsync(buffer);
	const document = zip.file("word/document.xml");
	if (!document) throw new Error("DOCX fixture is missing word/document.xml");
	return document.async("string");
}

export const expectedDocxText = docxText;

export const invalidSpreadsheetFixture = {
	name: "not-a-spreadsheet.txt",
	mimeType: "text/plain",
	buffer: Buffer.from("This object is deliberately unsupported by the spreadsheet parser.\n", "utf8"),
} satisfies DocumentFileFixture;

export const spreadsheetFixture = {
	name: "known-items.csv",
	mimeType: "text/csv",
	buffer: Buffer.from("Item,Importe\nALFA-001,1250.5\nBETA-002,99\n", "utf8"),
} satisfies DocumentFileFixture;
