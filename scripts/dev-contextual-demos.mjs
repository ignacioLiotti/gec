import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = process.env.CONTEXTUAL_DEMOS_PORT || "4320";
// Run only the fixture route using an anonymous local auth configuration.
// This worktree has no copied .env files. No production credentials are needed.
const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "dev", "--webpack", "--hostname", "127.0.0.1", "--port", port], {
  cwd: root,
  stdio: "inherit",
  windowsHide: true,
  env: {
    ...process.env,
    CONTEXTUAL_FLOW_DEMOS: "1",
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-demo-placeholder-no-auth",
    SUPABASE_SERVICE_ROLE_KEY: "",
    NEXT_PUBLIC_ENABLE_REACT_SCAN: "false",
    DOMAIN_SPLIT_ENABLED: "false",
    RATE_LIMIT_IP: "0",
    WORKFLOW_DEV_ENABLED: "0",
    DEBUG_AUTH: "false",
  },
});
child.on("exit", code => { process.exitCode = code ?? 0; });
child.on("error", error => { console.error(error.message); process.exitCode = 1; });
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
