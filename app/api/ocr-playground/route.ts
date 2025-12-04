import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";

// Schema for region input
const RegionSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  label: z.string(),
  color: z.string(),
  type: z.enum(["single", "table"]),
  tableColumns: z.array(z.string()).optional(),
});

const RequestSchema = z.object({
  annotatedImageDataUrl: z.string().startsWith("data:"),
  regions: z.array(RegionSchema).min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { annotatedImageDataUrl, regions } = parsed.data;

    // Separate single fields and table regions
    const singleFields = regions.filter((r) => r.type === "single");
    const tableFields = regions.filter((r) => r.type === "table");

    // Build dynamic schema for extraction
    const fieldSchemas: Record<string, z.ZodTypeAny> = {};
    const keyMap: { key: string; region: (typeof regions)[0]; index: number }[] = [];

    // Add single field schemas
    for (let i = 0; i < regions.length; i++) {
      const region = regions[i];
      const boxNumber = i + 1;
      const key = `box_${boxNumber}`;
      keyMap.push({ key, region, index: i });

      if (region.type === "single") {
        fieldSchemas[key] = z
          .string()
          .nullable()
          .describe(`Text inside box [${boxNumber}] labeled "${region.label}"`);
      } else if (region.type === "table") {
        // For tables, create a schema with the defined columns
        const columns = region.tableColumns || ["Item", "Value"];
        const rowSchema: Record<string, z.ZodTypeAny> = {};
        
        for (const col of columns) {
          const colKey = col
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_|_$/g, "") || "column";
          rowSchema[colKey] = z.string().nullable().describe(`Value for column "${col}"`);
        }

        fieldSchemas[key] = z
          .array(z.object(rowSchema))
          .describe(
            `Array of rows from table [${boxNumber}]📊 "${region.label}" with columns: ${columns.join(", ")}`
          );
      }
    }

    const extractionSchema = z.object(fieldSchemas);

    // Build hierarchical prompt
    let regionDescriptions = "";

    if (singleFields.length > 0) {
      regionDescriptions += "SINGLE VALUE FIELDS (extract one text value each):\n";
      regionDescriptions += singleFields
        .map((r) => {
          const idx = regions.indexOf(r) + 1;
          return `  [${idx}] = "${r.label}"`;
        })
        .join("\n");
    }

    if (tableFields.length > 0) {
      regionDescriptions += "\n\nTABLE REGIONS (extract ALL visible rows as arrays):\n";
      regionDescriptions += tableFields
        .map((r) => {
          const idx = regions.indexOf(r) + 1;
          const cols = r.tableColumns || ["Item", "Value"];
          const colKeys = cols.map((c) =>
            c.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "column"
          );
          return `  [${idx}]📊 = "${r.label}"\n      Columns: ${cols.join(", ")}\n      Keys: ${colKeys.join(", ")}`;
        })
        .join("\n");
    }

    const instructions = `You are an OCR assistant extracting data from a document image with numbered boxes drawn on it.

${regionDescriptions}

CRITICAL INSTRUCTIONS:
1. Look at the VISUAL boxes drawn on the image
2. Boxes with just a number [1], [2] are SINGLE VALUE fields - extract the one text value inside
3. Boxes with [N]📊 are TABLE regions - extract ALL rows visible in that table area
4. For tables:
   - Look at the entire region inside the dashed box
   - Extract EVERY row you can see as a separate object in the array
   - Use the column keys specified above (lowercase with underscores)
   - If a cell is empty, use null
5. Extract text EXACTLY as it appears - no interpretation or formatting
6. Return null for empty or completely illegible fields

IMPORTANT: For table regions, count the actual rows visible and extract each one. Don't skip rows.`;

    const res = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: extractionSchema,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: instructions },
            { type: "image", image: annotatedImageDataUrl },
          ],
        },
      ],
      temperature: 0.1,
    });

    // Map results back to region structure
    const results = keyMap.map(({ key, region }) => {
      const extracted = (res.object as Record<string, unknown>)[key];

      if (region.type === "single") {
        return {
          id: region.id,
          label: region.label,
          type: "single" as const,
          text: (extracted as string | null) ?? "",
          color: region.color,
        };
      } else {
        // Table result - transform column keys back to original names
        const columns = region.tableColumns || ["Item", "Value"];
        const colKeyToName: Record<string, string> = {};
        for (const col of columns) {
          const colKey = col
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_|_$/g, "") || "column";
          colKeyToName[colKey] = col;
        }

        const rows = (extracted as Record<string, string | null>[] | null) || [];
        const transformedRows = rows.map((row) => {
          const transformed: Record<string, string> = {};
          for (const [key, value] of Object.entries(row)) {
            const originalName = colKeyToName[key] || key;
            transformed[originalName] = value || "";
          }
          return transformed;
        });

        return {
          id: region.id,
          label: region.label,
          type: "table" as const,
          rows: transformedRows,
          color: region.color,
        };
      }
    });

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    console.error("OCR Playground extraction error:", error);
    return NextResponse.json(
      { error: "Failed to extract text from image" },
      { status: 500 }
    );
  }
}
