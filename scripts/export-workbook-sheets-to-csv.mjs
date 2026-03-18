import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import xlsx from "xlsx";

function sanitizeFileName(value) {
  return value
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

function withUniqueName(baseName, usedNames) {
  let name = baseName;
  let suffix = 2;
  while (usedNames.has(name.toLowerCase())) {
    name = `${baseName} (${suffix})`;
    suffix += 1;
  }
  usedNames.add(name.toLowerCase());
  return name;
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error("Usage: node scripts/export-workbook-sheets-to-csv.mjs <workbook-path> [output-dir]");
  }

  const resolvedInputPath = path.resolve(inputPath);
  const workbookBaseName = path.basename(resolvedInputPath, path.extname(resolvedInputPath));
  const outputDir =
    process.argv[3] != null
      ? path.resolve(process.argv[3])
      : path.join(path.dirname(resolvedInputPath), `${workbookBaseName} - csv`);

  const workbook = xlsx.readFile(resolvedInputPath, { cellDates: false });
  await fs.mkdir(outputDir, { recursive: true });

  const usedNames = new Set();
  const manifest = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const csv = xlsx.utils.sheet_to_csv(worksheet, {
      blankrows: false,
      FS: ",",
    });
    const safeName = withUniqueName(sanitizeFileName(sheetName) || "sheet", usedNames);
    const fileName = `${safeName}.csv`;
    const filePath = path.join(outputDir, fileName);

    await fs.writeFile(filePath, `\uFEFF${csv}`, "utf8");
    manifest.push({
      sheetName,
      fileName,
      rowCount: xlsx.utils.sheet_to_json(worksheet, { header: 1, blankrows: false }).length,
    });
  }

  await fs.writeFile(
    path.join(outputDir, "manifest.json"),
    JSON.stringify(
      {
        sourceWorkbook: resolvedInputPath,
        generatedAt: new Date().toISOString(),
        sheetCount: workbook.SheetNames.length,
        sheets: manifest,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`Exported ${manifest.length} sheets to ${outputDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
