import { spawnSync, type SpawnSyncOptionsWithStringEncoding } from "node:child_process";
import {
	lstat,
	mkdir,
	mkdtemp,
	readFile,
	realpath,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";

const temporaryRoots = new Set<string>();
const childEnvironmentResultSchema = z.object({
	lang: z.string(),
	privateSentinel: z.null(),
	supabaseKey: z.null(),
});
const networkResultSchema = z.object({
	received: z.object({ fetch: z.number(), http: z.number() }),
	fetchBody: z.string(),
	httpBody: z.string(),
	remoteFetchError: z.string(),
	remoteHttpError: z.string(),
	remoteHttpsError: z.string(),
});

afterEach(async () => {
	await Promise.all(
		[...temporaryRoots].map((root) => {
			const target = path.resolve(root);
			if (path.dirname(target) !== path.resolve(tmpdir()) || !/^integration-(runner|network)-/.test(path.basename(target))) {
				throw new Error("Refusing to remove a directory outside this test's temporary roots.");
			}
			return rm(target, { recursive: true, force: true });
		}),
	);
	temporaryRoots.clear();
});

function subprocessNode(
	args: string[],
	options: Omit<SpawnSyncOptionsWithStringEncoding, "encoding"> = {},
) {
	return spawnSync(process.execPath, args, {
		...options,
		encoding: "utf8",
		windowsHide: true,
		timeout: 15_000,
	});
}

async function temporaryDirectory(prefix: string) {
	const directory = await mkdtemp(path.join(tmpdir(), prefix));
	temporaryRoots.add(directory);
	return directory;
}

describe("isolated integration runner boundaries", () => {
	it("snapshots the application without secrets, build output, or copied dependencies", async () => {
		const { isolatedEnvironment, snapshotApplication } = await import(
			"../../scripts/test-integration.mjs"
		);
		const fixtureRoot = await temporaryDirectory("integration-runner-");
		const source = path.join(fixtureRoot, "source");
		const destination = path.join(fixtureRoot, "snapshot");
		const sourceApp = path.join(source, "app");
		const sourceNodeModules = path.join(source, "node_modules");

		await Promise.all([
			mkdir(path.join(sourceApp, "nested"), { recursive: true }),
			mkdir(path.join(sourceApp, ".next", "cache"), { recursive: true }),
			mkdir(sourceNodeModules, { recursive: true }),
		]);
		await Promise.all([
			writeFile(path.join(sourceApp, "page.tsx"), "export default function Page() { return null; }"),
			writeFile(path.join(source, "proxy.ts"), "export const proxySentinel = true;"),
			writeFile(
				path.join(source, "instrumentation.ts"),
				"export const instrumentationSentinel = true;",
			),
			writeFile(path.join(source, "package.json"), '{"private":true}'),
			writeFile(path.join(source, ".env"), "ROOT_SECRET=root-sentinel"),
			writeFile(
				path.join(sourceApp, "nested", ".env.local"),
				"NESTED_SECRET=nested-sentinel",
			),
			writeFile(path.join(sourceApp, ".next", "cache", "build.txt"), "build-sentinel"),
			writeFile(path.join(sourceNodeModules, "dependency.txt"), "dependency-sentinel"),
		]);

		const canonicalNodeModulesBefore = await realpath(sourceNodeModules);
		snapshotApplication(source, destination);

		expect(await readFile(path.join(destination, "proxy.ts"), "utf8")).toContain(
			"proxySentinel",
		);
		expect(
			await readFile(path.join(destination, "instrumentation.ts"), "utf8"),
		).toContain("instrumentationSentinel");
		expect(await readFile(path.join(destination, "app", "page.tsx"), "utf8")).toContain(
			"function Page",
		);
		await expect(lstat(path.join(destination, ".env"))).rejects.toMatchObject({
			code: "ENOENT",
		});
		await expect(
			lstat(path.join(destination, "app", "nested", ".env.local")),
		).rejects.toMatchObject({ code: "ENOENT" });
		await expect(lstat(path.join(destination, "app", ".next"))).rejects.toMatchObject({
			code: "ENOENT",
		});

		const linkedNodeModules = path.join(destination, "node_modules");
		expect((await lstat(linkedNodeModules)).isSymbolicLink()).toBe(true);
		expect(await realpath(linkedNodeModules)).toBe(canonicalNodeModulesBefore);
		expect(await realpath(sourceNodeModules)).toBe(canonicalNodeModulesBefore);
		expect(await readFile(path.join(sourceNodeModules, "dependency.txt"), "utf8")).toBe(
			"dependency-sentinel",
		);

		expect(await readFile(path.join(source, ".env"), "utf8")).toContain(
			"root-sentinel",
		);
		expect(
			await readFile(path.join(sourceApp, "nested", ".env.local"), "utf8"),
		).toContain("nested-sentinel");
		expect(
			await readFile(path.join(sourceApp, ".next", "cache", "build.txt"), "utf8"),
		).toBe("build-sentinel");
		expect(await readFile(path.join(sourceApp, "page.tsx"), "utf8")).toContain(
			"function Page",
		);

		const childEnvironment = isolatedEnvironment({
			...process.env,
			LANG: "e2e-safe-marker",
			E2E_PRIVATE_SENTINEL: "must-not-reach-child",
			NEXT_PUBLIC_SUPABASE_ANON_KEY: "must-not-reach-child",
		});
		const child = subprocessNode(
			[
				"-e",
				`process.stdout.write(JSON.stringify({
					lang: process.env.LANG ?? null,
					privateSentinel: process.env.E2E_PRIVATE_SENTINEL ?? null,
					supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null,
				}));`,
			],
			{ env: { NODE_ENV: "test", ...childEnvironment } },
		);
		expect(child.status, child.stderr).toBe(0);
		expect(childEnvironmentResultSchema.parse(JSON.parse(child.stdout))).toEqual({
			lang: "e2e-safe-marker",
			privateSentinel: null,
			supabaseKey: null,
		});
	});

	it("allows loopback fetch and HTTP while rejecting remote transports before DNS", async () => {
		const fixtureRoot = await temporaryDirectory("integration-network-");
		const preload = pathToFileURL(
			path.resolve("scripts/integration-local-network.mjs"),
		).href;
		const childScript = String.raw`
			const http = require("node:http");
			const https = require("node:https");

			const received = { fetch: 0, http: 0 };
			const server = http.createServer((request, response) => {
				if (request.url === "/fetch") received.fetch += 1;
				if (request.url === "/http") received.http += 1;
				response.end("ok");
			});

			function message(error) {
				return error instanceof Error ? error.message : String(error);
			}

			function synchronousFailure(operation) {
				try {
					const request = operation();
					request.destroy();
					return "request unexpectedly started";
				} catch (error) {
					return message(error);
				}
			}

			(async () => {
				await new Promise((resolve, reject) => {
					server.once("error", reject);
					server.listen(0, "127.0.0.1", resolve);
				});
				const address = server.address();
				if (!address || typeof address === "string") throw new Error("No loopback port");
				const origin = "http://127.0.0.1:" + address.port;

				const fetchResponse = await fetch(origin + "/fetch");
				const fetchBody = await fetchResponse.text();
				const httpBody = await new Promise((resolve, reject) => {
					http.get(origin + "/http", (response) => {
						let body = "";
						response.setEncoding("utf8");
						response.on("data", (chunk) => { body += chunk; });
						response.once("end", () => resolve(body));
					}).once("error", reject);
				});

				let remoteFetchError = "";
				try {
					await fetch("http://remote.invalid/fetch");
				} catch (error) {
					remoteFetchError = message(error);
				}
				const remoteHttpError = synchronousFailure(() =>
					http.get("http://remote.invalid/http"),
				);
				const remoteHttpsError = synchronousFailure(() =>
					https.get("https://remote.invalid/https"),
				);

				await new Promise((resolve, reject) =>
					server.close((error) => error ? reject(error) : resolve()),
				);
				process.stdout.write(JSON.stringify({
					received,
					fetchBody,
					httpBody,
					remoteFetchError,
					remoteHttpError,
					remoteHttpsError,
				}));
			})().catch((error) => {
				console.error(error);
				process.exitCode = 1;
			});
		`;

		const child = subprocessNode(["--import", preload, "-e", childScript], {
			cwd: fixtureRoot,
		});
		expect(child.status, child.stderr).toBe(0);
		const result = networkResultSchema.parse(JSON.parse(child.stdout));
		expect(result).toMatchObject({
			received: { fetch: 1, http: 1 },
			fetchBody: "ok",
			httpBody: "ok",
			remoteFetchError: "External HTTP transport disabled in isolated integration runtime",
			remoteHttpError: "External HTTP transport disabled in isolated integration runtime",
			remoteHttpsError: "External HTTP transport disabled in isolated integration runtime",
		});
		expect(result.received.fetch + result.received.http).toBe(2);
	});
});
