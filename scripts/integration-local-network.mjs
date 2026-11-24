import http from "node:http";
import https from "node:https";
import { readFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";

const blockedMessage = "External HTTP transport disabled in isolated integration runtime";
const providerPath = /^\/v1beta\/models\/[A-Za-z0-9_.-]+:generateContent$/;

function configurationError(message) {
  return new Error(`Invalid isolated OCR provider configuration: ${message}`);
}

function readProviderConfiguration() {
  const configuredUrl = process.env.E2E_OCR_PROVIDER_URL?.trim();
  if (!configuredUrl) return null;
  if (process.env.E2E_LOCAL !== "1") {
    throw configurationError("E2E_LOCAL must be 1");
  }
  const runId = process.env.E2E_RUN_ID?.trim();
  if (!runId) throw configurationError("E2E_RUN_ID is required");
  const manifestPath = process.env.E2E_INSTANCE_MANIFEST?.trim();
  if (!manifestPath) throw configurationError("E2E_INSTANCE_MANIFEST is required");
  const token = process.env.E2E_OCR_PROVIDER_TOKEN?.trim();
  if (!token) throw configurationError("E2E_OCR_PROVIDER_TOKEN is required");

  let url;
  try {
    url = new URL(configuredUrl);
  } catch {
    throw configurationError("E2E_OCR_PROVIDER_URL must be a valid URL");
  }
  const port = Number(url.port);
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    !url.port ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65_535 ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw configurationError(
      "E2E_OCR_PROVIDER_URL must be an HTTP 127.0.0.1 origin with an explicit port",
    );
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    throw configurationError("the owned instance manifest is unreadable");
  }
  const expectedProjectId = `e2e_${runId.replaceAll("-", "")}`;
  if (
    !manifest ||
    typeof manifest !== "object" ||
    manifest.kind !== "owned-local-integration" ||
    manifest.runId !== runId ||
    manifest.projectId !== expectedProjectId ||
    manifest.mode !== "authenticated" ||
    !["starting-app", "running"].includes(manifest.status) ||
    !manifest.ocrProvider ||
    manifest.ocrProvider.enabled !== true ||
    manifest.ocrProvider.url !== configuredUrl
  ) {
    throw configurationError("the owned instance manifest does not match this provider");
  }

  return { origin: url.origin, token };
}

const provider = readProviderConfiguration();

function assertLoopback(input) {
  const url = typeof input === "string" || input instanceof URL
    ? new URL(input)
    : new URL(`http://${input.hostname ?? input.host ?? "localhost"}`);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error(blockedMessage);
  }
}

function isGoogleGenerateContentRequest(request) {
  const url = new URL(request.url);
  return (
    url.protocol === "https:" &&
    url.hostname === "generativelanguage.googleapis.com" &&
    url.port === "" &&
    !url.username &&
    !url.password &&
    !url.hash &&
    request.method === "POST" &&
    providerPath.test(url.pathname)
  );
}

function rewriteGoogleRequest(request) {
  const sourceUrl = new URL(request.url);
  const headers = new Headers(request.headers);
  headers.delete("authorization");
  headers.delete("x-goog-api-key");
  headers.set("x-e2e-provider-token", provider.token);
  const body = request.body;
  return new Request(`${provider.origin}/google${sourceUrl.pathname}`, {
    method: request.method,
    headers,
    body,
    signal: request.signal,
    redirect: request.redirect,
    ...(body ? { duplex: "half" } : {}),
  });
}

// Opt-in exceptions for local comparison servers (never set by the integration
// harness): exact HTTPS hosts, comma separated, e.g. "api.openai.com".
const allowedHttpsHosts = new Set(
  (process.env.INTEGRATION_ALLOWED_HTTPS_HOSTS ?? "").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean),
);

function isAllowedExternalRequest(request) {
  const url = new URL(request.url);
  return url.protocol === "https:" && url.port === "" && !url.username && !url.password && allowedHttpsHosts.has(url.hostname);
}

const originalFetch = globalThis.fetch;
globalThis.fetch = function (input, init) {
  let request;
  try {
    request = new Request(input, init);
    if (provider && isGoogleGenerateContentRequest(request)) {
      return originalFetch(rewriteGoogleRequest(request));
    }
    if (isAllowedExternalRequest(request)) return originalFetch(request);
    assertLoopback(request.url);
  }
  catch (error) { return Promise.reject(error); }
  return originalFetch(request);
};
for (const transport of [http, https]) {
  for (const operation of ["request", "get"]) {
    const original = transport[operation];
    transport[operation] = function (input, ...rest) {
      assertLoopback(input);
      if (rest[0] && typeof rest[0] === "object") assertLoopback(rest[0]);
      return original.call(this, input, ...rest);
    };
  }
}
syncBuiltinESMExports();
