# OCR provider integration review

Date: 2026-10-19  
Source HEAD: `e04d72020f0fea28c42bf603ae2960ca5e63bb07`

## Finding

No source-level blocker was found across `scripts/test-integration.mjs`, `scripts/integration-local-network.mjs`, `scripts/integration-ocr-provider.mjs`, the OCR fixture helper and the two current OCR route callers.

One evidence gap remains: the provider-bound Playwright spec has not run in the owned stack yet. The passing tooling tests prove the transport rewrite and provider protocol in child processes, while the full Vitest run proves the surrounding unit suite. They do not prove the complete Next route → preload → owned provider → route persistence chain. That claim should wait for the provider E2E execution.

## Ownership and startup

- The runner creates the provider only for authenticated runs, records only its loopback URL in the owned manifest and passes the random token through the isolated process environment. The token is absent from the manifest and logs.
- `starting-app` is persisted before the Next process is spawned. The preload therefore sees a manifest status it explicitly accepts during initialization. Playwright starts only after health checks and the manifest moves to `running`; its control helper requires that stronger status.
- The provider binds directly to an OS-assigned `127.0.0.1` port, so it does not add the runner's allocate-then-bind port race.

## Next fetch compatibility

- This installed Next 16.2.6 CLI reads `process.execArgv`, parses `--import`, and writes it into `NODE_OPTIONS` for the forked start-server process. A local probe of the installed formatter produced `--import=file:///.../integration-local-network.mjs`; the network preload is therefore inherited by the process that executes route handlers.
- Next captures and later wraps the existing `globalThis.fetch`, so the preload remains the underlying transport. Its dedupe wrapper forwards non-GET/HEAD requests directly. Both OCR routes issue a normal `POST` to the exact Gemini `generateContent` path with one text part and one `inline_data` part, matching the provider parser.
- The rewritten request preserves body, content type, ordinary headers and signal, removes the Google query and credential headers, and adds only the local provider token. Other remote fetches remain rejected before DNS; builtin `http` and `https` behavior is unchanged from the prior isolation policy.

## Teardown

- The runner stops Playwright and the Next process before closing the provider, preventing application requests from racing provider shutdown.
- Provider close is idempotent, stops accepting connections, closes active connections and destroys tracked sockets. The runner then verifies that the provider port no longer listens before disposing the owned Supabase stack and snapshot.
- Fixture registration uses a namespace and source hash, and the Playwright helper deletes each fixture in `finally`. Any in-memory remainder is bounded to this provider process and disappears when the listener closes.

## Boundary represented by the test

The loopback server simulates the external Gemini wire response. It does not evaluate OCR quality or contact Google. The application route, permission checks, actor request, uploaded source bytes, Storage, SQL writes, failure mapping and retry behavior remain real. Provider request evidence records only hashes, MIME type, byte count, model path, attempt and prompt hash; it does not retain raw uploaded bytes, prompt text or the provider token.
