import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

// These surfaces have their own documented visual language or edit geometry.
const excluded = /^(?:app\/(?:landings|portfolio|dashboard2|system-design|certexampleplayground|permissions-demo)\/|components\/(?:report|viewer|event-calendar)\/)|\/data-flow\/|\/report\/|\/reporte\/|^app\/(?:page|global-error|error)\.tsx$/;
const managed = new Set(["Button", "LightButton", "ExpandableLightButton", "Badge", "Input", "Textarea", "NativeSelect", "SelectTrigger", "TabsList", "TabsTrigger", "Card", "DialogContent"]);
const appearance = /(?:^|:)(?:!?(?:bg-|from-|via-|to-|rounded(?:-|$)|shadow(?:-|$))|!?(?:text|border)-(?:\[#[^\]]+\]|white|black|stone|slate|gray|zinc|neutral|red|rose|emerald|green|blue|sky|cyan|orange|amber|yellow|purple|violet|primary|secondary|destructive|success|warning|content|foreground|muted|stroke|input)(?=-|\/|\[|$))/;
const violations = [];
let inspected = 0;
// Explicit paths allow fixture routes to opt into the same checks as product UI.
const requestedPaths = process.argv.slice(2);

function strings(node) {
  if (!node) return [];
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
  if (ts.isJsxExpression(node) || ts.isParenthesizedExpression(node)) return strings(node.expression);
  if (ts.isConditionalExpression(node)) return [...strings(node.whenTrue), ...strings(node.whenFalse)];
  if (ts.isBinaryExpression(node)) return [...strings(node.left), ...strings(node.right)];
  if (ts.isCallExpression(node) && ["cn", "clsx"].includes(node.expression.getText())) return node.arguments.flatMap(strings);
  if (ts.isTemplateExpression(node)) return [node.head.text, ...node.templateSpans.flatMap(span => [...strings(span.expression), span.literal.text])];
  return [];
}

function scan(file) {
  const source = fs.readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports = new Map();
  for (const node of ast.statements) {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier.text?.startsWith("@/design-system/")) violations.push(`${file}: Product code must import through components/ui`);
    if (ts.isImportDeclaration(node) && node.moduleSpecifier.text?.startsWith("@/components/ui/")) {
      for (const specifier of node.importClause?.namedBindings?.elements ?? []) imports.set(specifier.name.text, specifier.propertyName?.text ?? specifier.name.text);
    }
  }
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const component = imports.get(node.tagName.getText(ast));
      if (managed.has(component)) {
        inspected++;
        // These two cell editors deliberately inherit selection/focus from FormTable.
        const cellEditor = file === "components/form-table/cell-renderers.tsx" && ["Input", "SelectTrigger"].includes(component);
        const className = node.attributes.properties.find(attr => attr.name?.getText(ast) === "className");
        const overrides = strings(className?.initializer).flatMap(value => value.split(/\s+/)).filter(value => appearance.test(value));
        if (overrides.length && !cellEditor) violations.push(`${file}:${ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1} ${component}: use a shared variant for ${[...new Set(overrides)].join(" ")}`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!["api", "ui"].includes(entry.name)) walk(file);
    } else if (file.endsWith(".tsx") && (requestedPaths.length > 0 || !excluded.test(file))) scan(file);
  }
}
if (requestedPaths.length > 0) {
  for (const directory of requestedPaths) walk(directory);
} else {
  walk("app");
  walk("components");
}
for (const entry of fs.readdirSync("design-system/components")) {
  if (!entry.endsWith(".tsx")) continue;
  const wrapper = `components/ui/${entry}`;
  if (fs.existsSync(wrapper) && !/^export \* from ["']@\/design-system\/components\/[\w-]+["'];?\s*$/.test(fs.readFileSync(wrapper, "utf8"))) violations.push(`${wrapper}: keep a reexport, edit the canonical implementation`);
}
if (violations.length) {
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else console.log(`UI contract passed: ${inspected} product controls; canonical wrappers and shared appearance.`);
