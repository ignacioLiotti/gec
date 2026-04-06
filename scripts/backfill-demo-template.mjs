import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const scriptDir = path.resolve(process.cwd(), "scripts");
const scripts = [
	path.join(scriptDir, "backfill-demo-purchase-orders.mjs"),
	path.join(scriptDir, "backfill-demo-certificados-config.mjs"),
];

for (const scriptPath of scripts) {
	const result = spawnSync(process.execPath, [scriptPath, ...process.argv.slice(2)], {
		stdio: "inherit",
	});
	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}
