// Offline, reproducible import. Clone the two MIT repositories into the supplied
// directories first. This script never installs or executes upstream code.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import postcss from "postcss";

const interior = ["loading-button", "copy-button", "hold-to-confirm", "press-depth", "icon-morph", "ripple", "accordion", "tabs", "segmented-control", "dropdown", "modal", "drawer", "popover", "tooltip-group", "tag-input", "inline-validation", "expanding-search", "progress-bar", "skeleton-swap", "task-steps", "sortable-table", "filter-grid", "tree-view", "reorder-list", "value-flash", "collapsible-banner"];
const beautiful = ["LoadingState", "ThinkingState", "ToolChips", "TaskRows", "FilterTable", "RecordsTable", "DiffTable", "SearchList", "SelectionActions", "StreamingText"];
const atoms = ["Button", "Switch", "SegmentedControl", "ProgressRing"];
const roots = { interior: process.argv[2], beautiful: process.argv[3] };
if (!roots.interior || !roots.beautiful) throw new Error("Pass Interior and Beautiful UI checkout paths");
const destination = "stories/motion/vendor";
const sha = text => createHash("sha256").update(text).digest("hex");
const manifest = { libraries: {}, files: [] };

// Only visual tokens are mapped. Motion constants, effects, keyframes, gesture
// handlers and the upstream example's state machine are retained.
const tokens = {
  ink: "var(--foreground)", "ink-2": "var(--muted-foreground)", "ink-3": "var(--muted-foreground)",
  surface: "var(--card)", canvas: "var(--background)", page: "var(--background)",
  inset: "var(--muted)", hover: "var(--accent)", "hover-2": "var(--muted)",
  line: "var(--border)", "line-strong": "var(--input)", "line-soft": "var(--border)",
  field: "var(--muted)", accent: "var(--primary)", "accent-ink": "var(--primary)", "accent-tint": "var(--muted)",
  green: "hsl(var(--success))", "green-tint": "color-mix(in srgb, hsl(var(--success)) 12%, var(--card))",
  red: "var(--destructive)", "red-tint": "color-mix(in srgb, var(--destructive) 12%, var(--card))",
  orange: "hsl(var(--warning))", "orange-tint": "color-mix(in srgb, hsl(var(--warning)) 12%, var(--card))",
  bezel: "var(--background)", panel: "var(--card)", well: "var(--muted)", sub: "var(--muted)",
  hairline: "var(--border)", "hairline-strong": "var(--input)", moss: "hsl(var(--success))", flag: "var(--destructive)",
};
fs.mkdirSync(destination, { recursive: true });
fs.writeFileSync(`${destination}/tokens.css`, `.motion-reference {\n${Object.entries(tokens).map(([k, v]) => `  --mr-${k}: ${v};`).join("\n")}\n}\n`);

for (const [library, root] of Object.entries(roots)) {
  const commit = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const repository = library === "interior" ? "https://github.com/ddoemonn/interior" : "https://github.com/slev12397/beautiful-ui";
  manifest.libraries[library] = { commit, repository };
  fs.mkdirSync(`${destination}/${library}`, { recursive: true });
  fs.copyFileSync(path.join(root, "LICENSE"), `${destination}/${library}/LICENSE`);
  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  const keyframes = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map(m => m[1]);
  function transform(text) {
    if (library === "interior") {
      // Token colors already switch with the theme. Keep motion and layout.
      text = text.replace(/dark:(?:hover:|focus-visible:|group-focus-visible:)?(?:bg|text|border|ring|shadow)-(?:stone-\d+|white(?:\/\d+|\/\[[^\]]+\])?|\[[^\]]+\])[^\s"'`<>}]*/g, "");
      text = text.replace(/(?<![\w-])(bg|text|border|ring)-stone-(\d+)(?![\w/])/g, (_, kind, n) => {
        const token = kind === "bg" ? Number(n) >= 700 ? "primary" : Number(n) >= 100 ? "muted" : "card" : kind === "text" ? Number(n) <= 100 ? "primary-foreground" : Number(n) >= 600 ? "foreground" : "muted-foreground" : "border";
        return `${kind}-${token}`;
      });
      text = text.replace(/(?<![\w-])bg-white(?![\w/])/g, "bg-card");
      text = text.replace(/(?<![\w-])text-white(?![\w/])/g, "text-primary-foreground");
      text = text.replace(/(?<![\w-])(bg|text|border|ring)-\[#(?:4568[Ff][Ff]|93[Bb]0[Ff][Ff])\]/g, "$1-primary");
    }
    for (const name of keyframes) text = text.replace(new RegExp(`(?<![\\w-])${name}(?![\\w-])`, "g"), `mr-${library}-${name}`);
    for (const key of Object.keys(tokens).sort((a, b) => b.length - a.length)) {
      text = text.replaceAll(`var(--${key})`, `var(--mr-${key})`);
      text = text.replace(new RegExp(`(?<![\\w-])((?:bg|text|border|ring|stroke|fill|divide)-)${key}(?![\\w-])`, "g"), `$1[var(--mr-${key})]`);
    }
    return text;
  }
  const seen = new Set();
  function copy(file) {
    if (seen.has(file)) return;
    seen.add(file);
    const original = fs.readFileSync(path.join(root, file), "utf8");
    let source = transform(original);
    // Reuse the installed Sintesis icon set; only glyphs change, never motion.
    source = source.replace(/import \{[^}]+\} from "iconoir-react";/g, 'import { ArrowUp, MessageCircleQuestion as ChatBubbleQuestion, Check, Smile as EmojiSatisfied, ChevronRight as NavArrowRight, RefreshCw as Refresh, Scissors as Scissor, Sparkles as Spark, TextCursorInput as TextBox, X as Xmark } from "lucide-react";');
    source = source.replace(/from ["'](@\/[^"']+)["']/g, (statement, specifier) => {
      if (specifier === "@/lib/utils") return statement;
      const dependency = `${specifier.slice(2)}.tsx`;
      copy(dependency);
      let relative = path.posix.relative(path.posix.dirname(file), dependency).replace(/\.tsx$/, "");
      if (!relative.startsWith(".")) relative = `./${relative}`;
      return `from "${relative}"`;
    });
    const runtime = path.posix.relative(path.posix.dirname(`${library}/${file}`), "../reference-runtime");
    source = source.replace(/from "motion\/react"/g, `from "${runtime}"`);
    source = source.replace(/import \{ createPortal \} from "react-dom";/g, `import { createPortal } from "${runtime}";`);
    // Upstream Tabs overwrites the headless hook's ref. Selection changes with
    // arrows, but its focus map stays empty. Compose both refs; motion is intact.
    if (library === "interior" && file === "components/interior/tabs.tsx") {
      source = source.replace("tabRefs.current[index] = node;", "tabs.getTabProps(item, index).ref(node);\n                tabRefs.current[index] = node;");
    }
    const target = `${destination}/${library}/${file}`;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `// MIT source: ${repository}/blob/${commit}/${file}\n// Adaptations: import isolation and Sintesis visual token mapping. See ../../LICENSE.\n${source}`);
    manifest.files.push({ library, file, upstreamSha256: sha(original), localSha256: sha(fs.readFileSync(target)), source: `${repository}/blob/${commit}/${file}` });
  }
  if (library === "interior") for (const id of interior) copy(`lib/demos/${id}-demo.tsx`);
  else {
    for (const name of beautiful) copy(`components/primitives/${name}.tsx`);
    for (const name of atoms) copy(`components/atoms/${name}.tsx`);
  }
  const sheet = postcss.parse(transform(css));
  // The site's foundation, reset, theme and marketing styles must never leak
  // into Storybook. Keep component classes and source keyframes only.
  sheet.walkAtRules(rule => { if (["import", "theme", "custom-variant"].includes(rule.name)) rule.remove(); });
  sheet.walkRules(rule => {
    if (rule.parent.type === "atrule" && /keyframes$/.test(rule.parent.name)) return;
    if (!rule.selector.includes(".") || rule.selector.includes(":root") || rule.selector === ".dark") { rule.remove(); return; }
    rule.selectors = rule.selectors.map(selector => `.motion-reference[data-library="${library}"] ${selector}`);
  });
  sheet.walkComments(comment => comment.remove());
  fs.writeFileSync(`${destination}/${library}/motion.css`, sheet.toString());
}
fs.writeFileSync(`${destination}/manifest.json`, JSON.stringify(manifest, null, 2) + "\n");
fs.writeFileSync(`${destination}/inventory.json`, JSON.stringify({ interior, beautiful, atoms }, null, 2) + "\n");
console.log(`Imported ${interior.length + beautiful.length + atoms.length} examples, ${manifest.files.length} source files with pinned provenance.`);
