import { createRequire } from "node:module";
import type { APIResponse } from "@playwright/test";
import { expect } from "@playwright/test";
import { z } from "zod";

const pdfParse: unknown = createRequire(`${process.cwd()}/package.json`)("pdf-parse");

const parsedPdfSchema = z.object({
	numpages: z.number().int().positive(),
	text: z.string().min(1),
});

export async function expectPdfContent(
	response: APIResponse,
	expectedText: string | readonly string[],
): Promise<Buffer> {
	expect(response.status()).toBe(200);
	expect(response.headers()["content-type"]).toContain("application/pdf");
	const bytes = await response.body();
	expect(bytes.byteLength).toBeGreaterThan(1_000);
	expect(bytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");
	if (typeof pdfParse !== "function") {
		throw new Error("The installed pdf-parse module does not export a parser function.");
	}
	const parsed: unknown = await pdfParse(bytes);
	const pdf = parsedPdfSchema.parse(parsed);
	for (const text of typeof expectedText === "string" ? [expectedText] : expectedText) {
		expect(pdf.text).toContain(text);
	}
	return bytes;
}
