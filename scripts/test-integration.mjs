import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { createConnection, createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { startOcrProviderFixture } from "./integration-ocr-provider.mjs";
import { startBillingProviderFixture } from "./integration-billing-provider.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ownedKind = "owned-local-integration";

export function isolatedEnvironment(source) {
  const allowed = ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "WINDIR", "COMSPEC", "PATHEXT", "TEMP", "TMP", "LANG", "LC_ALL"];
  return Object.fromEntries(allowed.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));
}

export function snapshotApplication(source, destination) {
  mkdirSync(destination, { recursive: true });
  const folders = ["app", "components", "design-system", "hooks", "lib", "utils", "workflows", "emails", "public", "types"];
  const files = ["package.json", "package-lock.json", "tsconfig.json", "next.config.ts", "next.config.mjs", "postcss.config.mjs", "postcss.config.js", "tailwind.config.ts", "tailwind.config.js", "proxy.ts", "middleware.ts", "instrumentation.ts", "instrumentation-client.ts", "sentry.server.config.ts", "sentry.edge.config.ts"];
  for (const name of [...folders, ...files]) {
    const from = join(source, name);
    if (existsSync(from)) cpSync(from, join(destination, name), {
      recursive: true,
      dereference: false,
      filter: (path) => !/(?:^|[\\/])(?:\.env[^\\/]*|node_modules|\.next|\.git)(?:[\\/]|$)/.test(path),
    });
  }
  symlinkSync(join(source, "node_modules"), join(destination, "node_modules"), process.platform === "win32" ? "junction" : "dir");
}

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No local port allocated");
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

function redact(text) {
  return text.replace(/eyJ[A-Za-z0-9_.-]+/g, "[redacted JWT]")
    .replace(/(postgres(?:ql)?:\/\/[^:]+:)[^@\s]+@/g, "$1[redacted]@")
    .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, "[redacted local key]");
}

async function captured(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { timeout: 600_000, ...options, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let launchError;
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr = (stderr + chunk.toString()).slice(-24000); });
    child.once("error", (error) => { launchError = error; });
    child.once("close", (code, signal) => {
      if (launchError) reject(new Error(`Cannot run local ${args[0]}: ${launchError.message}`));
      else if (code === 0) resolve(stdout);
      else reject(new Error(`Local ${args[0]} failed (${signal ?? `exit ${code}`}):\n${redact(stderr).slice(-6000)}`));
    });
  });
}

function supabaseConfig({ projectId, ports, appUrl, publicSignup = false }) {
  return `project_id = "${projectId}"
[api]
enabled = true
port = ${ports.api}
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
[db]
port = ${ports.db}
shadow_port = ${ports.shadow}
major_version = 15
[db.seed]
enabled = false
[auth]
enabled = true
site_url = "${appUrl}"
enable_signup = ${publicSignup}
[auth.email]
enable_signup = true
enable_confirmations = false
[auth.external.google]
enabled = false
[storage]
enabled = true
file_size_limit = "50MiB"
[studio]
enabled = false
[inbucket]
enabled = false
[analytics]
enabled = false
[edge_runtime]
enabled = false
[realtime]
enabled = false
`;
}

async function waitForApplication(child, url, output, signal) {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    signal.throwIfAborted();
    if (child.exitCode !== null) throw new Error(`Isolated Next exited ${child.exitCode}:\n${redact(output()).slice(-6000)}`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000), redirect: "manual" });
      if (response.status < 500) return;
    } catch { /* A newly launched server is not listening yet. */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Isolated Next did not become ready:\n${redact(output()).slice(-6000)}`);
}

const stoppingProcesses = new WeakMap();

function hasExited(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

async function waitForExit(child, timeout) {
  if (hasExited(child)) return true;
  return new Promise((resolve) => {
    const exited = () => { clearTimeout(timer); resolve(true); };
    const timer = setTimeout(() => { child.removeListener("exit", exited); resolve(false); }, timeout);
    child.once("exit", exited);
  });
}

async function stopOwnedProcess(child) {
  if (!child?.pid || hasExited(child)) return;
  let stopping = stoppingProcesses.get(child);
  if (!stopping) {
    stopping = (async () => {
      if (process.platform === "win32") {
        const result = spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, encoding: "utf8", timeout: 10_000 });
        if (result.status !== 0 && !hasExited(child)) throw new Error("Could not stop the owned process tree");
      } else {
        child.kill("SIGTERM");
      }
      if (await waitForExit(child, 10_000)) return;
      child.kill("SIGKILL");
      if (!await waitForExit(child, 5_000)) throw new Error("Owned process did not exit after termination");
    })();
    stoppingProcesses.set(child, stopping);
  }
  await stopping;
}

async function verifyStackDisposal(projectId, environment) {
  const inventories = await Promise.all(["container", "volume", "network"].map(async (kind) => {
    const prefix = kind === "container" ? ["ps", "-a"] : [kind, "ls"];
    const field = kind === "container" ? "{{.Names}}" : "{{.Name}}";
    const options = { env: environment, timeout: 20_000 };
    const [ownedByLabel, allNames] = await Promise.all([
      captured("docker", [...prefix, "--filter", `label=com.supabase.cli.project=${projectId}`, "--format", field], options),
      captured("docker", [...prefix, "--format", field], options),
    ]);
    const named = allNames.split(/\r?\n/).filter((name) => name.endsWith(`_${projectId}`));
    const remaining = new Set([...ownedByLabel.trim().split(/\r?\n/).filter(Boolean), ...named]);
    if (remaining.size) throw new Error(`Owned ${kind} resources remain after stack stop: ${[...remaining].join(", ")}`);
    return [kind, remaining.size];
  }));
  return { verifiedAt: new Date().toISOString(), remaining: Object.fromEntries(inventories) };
}

function processIsAlive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { if (error.code === "ESRCH") return false; throw error; }
}

async function portIsListening(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    const finish = (listening) => { socket.destroy(); resolve(listening); };
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.setTimeout(1000, () => finish(false));
  });
}

function recordFixtureDisposal(workspace, runId, projectId) {
  const directory = join(workspace, "fixture-manifests");
  const summary = { total: 0, runtimeCleanupVerified: 0, runtimeCleanupFailed: 0, runtimeCleanupPending: 0 };
  if (!existsSync(directory)) return summary;
  for (const filename of readdirSync(directory).filter((name) => name.endsWith(".json"))) {
    const path = join(directory, filename);
    if (!lstatSync(path).isFile()) throw new Error("Fixture disposal refused a non-file manifest.");
    const fixture = JSON.parse(readFileSync(path, "utf8"));
    if (fixture.kind !== "owned-local-integration-fixture" || fixture.runId !== runId || fixture.projectId !== projectId) {
      throw new Error("Fixture disposal refused a manifest from another runtime.");
    }
    summary.total++;
    if (fixture.runtimeCleanup === "verified") summary.runtimeCleanupVerified++;
    else if (fixture.runtimeCleanup === "failed") summary.runtimeCleanupFailed++;
    else summary.runtimeCleanupPending++;
    const temporaryPath = `${path}.${process.pid}.tmp`;
    writeFileSync(temporaryPath, `${JSON.stringify({ ...fixture, status: "disposed", disposedAt: new Date().toISOString() }, null, 2)}\n`);
    renameSync(temporaryPath, path);
  }
  return summary;
}

export async function runIntegration(args, { publicSignup = false } = {}) {
  const playwright = join(root, "node_modules/@playwright/test/cli.js");
  const publicOnly = args.includes("--public");
  const forwarded = args.filter((arg) => arg !== "--public");
  if (args.some((arg) => ["--list", "--help", "-h"].includes(arg))) {
    const selection = publicOnly ? ["--project=public"] : [];
    const result = spawnSync(process.execPath, [playwright, "test", ...forwarded, ...selection], { cwd: root, stdio: "inherit", windowsHide: true });
    return result.status ?? 1;
  }
  if (forwarded.some((arg) => /^(?:--config|-c|--project)(?:=|$)/.test(arg))) {
    throw new Error("The isolated runner selects its own config and project. Use --public for anonymous routes.");
  }
  const runId = randomUUID();
  const projectId = `e2e_${runId.replaceAll("-", "")}`;
  const workspace = mkdtempSync(join(tmpdir(), "multi-tenant-integration-"));
  const appDirectory = join(workspace, "app");
  const stackDirectory = join(workspace, "stack");
  const instanceFile = join(workspace, "instance.json");
  const reportDirectory = join(root, "test-results", "integration", runId);
  mkdirSync(reportDirectory, { recursive: true });
  const ports = { app: await freePort(), api: await freePort(), db: await freePort(), shadow: await freePort() };
  const appUrl = `http://127.0.0.1:${ports.app}`;
  const supabaseUrl = `http://127.0.0.1:${ports.api}`;
  const environment = {
    ...isolatedEnvironment(process.env),
    NEXT_TELEMETRY_DISABLED: "1",
    E2E_LOCAL: "1",
    E2E_RUN_ID: runId,
    E2E_MODE: publicOnly ? "public" : "authenticated",
    E2E_INSTANCE_MANIFEST: instanceFile,
    E2E_REPORT_DIR: reportDirectory,
    PLAYWRIGHT_BASE_URL: appUrl,
    APP_URL: appUrl,
    NEXT_PUBLIC_APP_URL: appUrl,
    PORT: String(ports.app),
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anonymous-local-fixture-key",
    SUPABASE_SERVICE_ROLE_KEY_VERSION: "",
  };
  const dockerDirectory = join(workspace, "docker");
  mkdirSync(dockerDirectory);
  writeFileSync(join(dockerDirectory, "config.json"), "{}");
  const stackEnvironment = { ...isolatedEnvironment(process.env), DOCKER_CONFIG: dockerDirectory };
  if (process.platform === "win32") stackEnvironment.DOCKER_HOST = "npipe:////./pipe/dockerDesktopLinuxEngine";
  const supabase = join(root, "node_modules/supabase/bin", process.platform === "win32" ? "supabase.exe" : "supabase");
  const manifest = { kind: ownedKind, runId, mode: environment.E2E_MODE, projectId, workspace, appUrl, supabaseUrl, startedAt: new Date().toISOString(), status: "preparing" };
  const saveManifest = () => { writeFileSync(instanceFile, `${JSON.stringify(manifest, null, 2)}\n`); writeFileSync(join(reportDirectory, "run.json"), `${JSON.stringify(manifest, null, 2)}\n`); };
  saveManifest();
  let app;
  let testProcess;
  let ocrProvider;
  let billingProvider;
  let stackAttempted = false;
  let appOutput = "";
  let result = 1;
  const failures = [];
  const lifecycle = new AbortController();
  const interrupt = () => {
    lifecycle.abort(new Error("Integration run interrupted"));
    void stopOwnedProcess(testProcess).catch((error) => failures.push(String(error)));
  };
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  try {
    if (!publicOnly) {
      await captured("docker", ["info", "--format", "{{.ServerVersion}}"], { env: stackEnvironment, timeout: 20_000, signal: lifecycle.signal });
      mkdirSync(join(stackDirectory, "supabase"), { recursive: true });
      cpSync(join(root, "supabase/migrations"), join(stackDirectory, "supabase/migrations"), { recursive: true });
      writeFileSync(join(stackDirectory, "supabase/config.toml"), supabaseConfig({ projectId, ports, appUrl, publicSignup }));
      stackAttempted = true;
      manifest.stackRequested = true;
      saveManifest();
      console.log("Starting owned local Supabase and applying repository migrations; ordinary seed disabled.");
      await captured(supabase, ["start", "--workdir", stackDirectory, "--yes"], { cwd: workspace, env: stackEnvironment, signal: lifecycle.signal });
      const status = JSON.parse(await captured(supabase, ["status", "--workdir", stackDirectory, "--output", "json"], { cwd: workspace, env: stackEnvironment, signal: lifecycle.signal }));
      if (status.API_URL !== supabaseUrl || !status.ANON_KEY || !status.SERVICE_ROLE_KEY) throw new Error("The owned stack did not return the expected local URL and keys");
      environment.NEXT_PUBLIC_SUPABASE_ANON_KEY = status.ANON_KEY;
      environment.SUPABASE_SERVICE_ROLE_KEY = status.SERVICE_ROLE_KEY;
      ocrProvider = await startOcrProviderFixture();
      environment.E2E_OCR_PROVIDER_URL = ocrProvider.url;
      environment.E2E_OCR_PROVIDER_TOKEN = ocrProvider.token;
      environment.GOOGLE_GENERATIVE_AI_API_KEY = "e2e-owned-provider";
      manifest.ocrProvider = { enabled: true, url: ocrProvider.url };
      billingProvider = await startBillingProviderFixture();
      environment.E2E_BILLING_PROVIDER_URL = billingProvider.url;
      environment.E2E_BILLING_PROVIDER_TOKEN = billingProvider.token;
      environment.E2E_BILLING_WEBHOOK_SECRET = billingProvider.webhookSecret;
      environment.E2E_WHATSAPP_RESPONSE_SECRET = billingProvider.responseSecret;
      environment.MERCADOPAGO_API_BASE_URL = billingProvider.url;
      environment.MERCADOPAGO_ACCESS_TOKEN = billingProvider.accessToken;
      environment.MERCADOPAGO_WEBHOOK_SECRET = billingProvider.webhookSecret;
      environment.WHATSAPP_RESPONSE_SECRET = billingProvider.responseSecret;
      manifest.billingProvider = { enabled: true, url: billingProvider.url };
      saveManifest();
    }
    snapshotApplication(root, appDirectory);
    lifecycle.signal.throwIfAborted();
    const preload = join(workspace, "local-network.mjs");
    cpSync(join(root, "scripts/integration-local-network.mjs"), preload);
    manifest.status = "starting-app";
    saveManifest();
    app = spawn(process.execPath, ["--import", pathToFileURL(preload).href, join(root, "node_modules/next/dist/bin/next"), "dev", appDirectory, "--webpack", "--hostname", "127.0.0.1", "--port", String(ports.app)], {
      cwd: appDirectory, env: { ...environment, NODE_ENV: "development" }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    });
    app.on("error", (error) => failures.push(`Next launch failed: ${error.message}`));
    manifest.appPid = app.pid;
    saveManifest();
    for (const stream of [app.stdout, app.stderr]) stream.on("data", (chunk) => { appOutput = (appOutput + chunk.toString()).slice(-24000); });
    await waitForApplication(app, `${appUrl}/api/health`, () => appOutput, lifecycle.signal);
    await waitForApplication(app, `${appUrl}/`, () => appOutput, lifecycle.signal);
    manifest.status = "running";
    manifest.appPid = app.pid;
    saveManifest();
    console.log(`Running ${environment.E2E_MODE} tests against an owned temporary app.`);
    const selection = publicOnly ? ["--project", "public"] : [];
    testProcess = spawn(process.execPath, [playwright, "test", ...forwarded, ...selection], { cwd: root, env: environment, stdio: "inherit", windowsHide: true });
    result = await new Promise((resolve, reject) => { testProcess.once("error", reject); testProcess.once("exit", (code) => resolve(code ?? 1)); });
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  } finally {
    try { await stopOwnedProcess(testProcess); } catch (error) { failures.push(String(error)); }
    let appStopped = false;
    try { await stopOwnedProcess(app); appStopped = true; } catch (error) { failures.push(String(error)); }
    if (ocrProvider) {
      try {
        await ocrProvider.close();
        manifest.ocrProvider.portListeningAfterRun = await portIsListening(Number(new URL(ocrProvider.url).port));
        if (manifest.ocrProvider.portListeningAfterRun) throw new Error("Owned OCR provider disposal did not complete.");
      } catch (error) { failures.push(String(error)); }
    }
    if (billingProvider) {
      try {
        await billingProvider.close();
        manifest.billingProvider.portListeningAfterRun = await portIsListening(Number(new URL(billingProvider.url).port));
        if (manifest.billingProvider.portListeningAfterRun) throw new Error("Owned billing provider disposal did not complete.");
      } catch (error) { failures.push(String(error)); }
    }
    if (stackAttempted) {
      try {
        await captured(supabase, ["stop", "--project-id", projectId, "--no-backup", "--workdir", stackDirectory, "--yes"], { cwd: workspace, env: stackEnvironment, timeout: 60_000 });
        manifest.stackDisposal = await verifyStackDisposal(projectId, stackEnvironment);
      }
      catch (error) { failures.push(String(error)); }
    }
    if (appStopped && existsSync(appDirectory)) {
      try {
        if (dirname(resolve(workspace)) !== resolve(tmpdir()) || !workspace.startsWith(join(tmpdir(), "multi-tenant-integration-")) || resolve(appDirectory) !== join(resolve(workspace), "app")) {
          throw new Error("Refusing to remove a snapshot outside the owned temporary workspace");
        }
        const dependencies = join(appDirectory, "node_modules");
        if (existsSync(dependencies)) {
          if (!lstatSync(dependencies).isSymbolicLink()) throw new Error("Snapshot dependencies are not the expected link");
          unlinkSync(dependencies);
        }
        rmSync(appDirectory, { recursive: true, force: true });
        manifest.appSnapshotRemoved = true;
      } catch (error) { failures.push(String(error)); }
    }
    try {
      manifest.appProcessAliveAfterRun = processIsAlive(app?.pid);
      manifest.appPortListeningAfterRun = await portIsListening(ports.app);
      manifest.appSnapshotRemoved = !existsSync(appDirectory);
      if (manifest.appProcessAliveAfterRun || manifest.appPortListeningAfterRun || !manifest.appSnapshotRemoved) {
        throw new Error("Owned application disposal did not complete.");
      }
      if (manifest.stackDisposal) {
        manifest.fixtureDisposal = recordFixtureDisposal(workspace, runId, projectId);
        if (result === 0 && (manifest.fixtureDisposal.runtimeCleanupFailed || manifest.fixtureDisposal.runtimeCleanupPending)) {
          throw new Error("Tests passed with an unreleased fixture scope.");
        }
      }
    } catch (error) { failures.push(String(error)); }
    writeFileSync(join(reportDirectory, "app.log"), redact(appOutput));
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", interrupt);
    manifest.status = lifecycle.signal.aborted ? "interrupted" : failures.length ? "failed" : result === 0 ? "passed" : "tests-failed";
    manifest.finishedAt = new Date().toISOString();
    manifest.failures = failures.map(redact);
    manifest.testExitCode = result;
    saveManifest();
    if (failures.length) console.error(failures.map(redact).join("\n"));
    console.log(`Integration evidence: ${reportDirectory}`);
  }
  return failures.length ? 1 : result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runIntegration(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (error) => { console.error(redact(error.message)); process.exitCode = 1; });
}
