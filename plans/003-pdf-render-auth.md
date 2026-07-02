# Plan 003: Auth-gate /api/pdf-render and stop internal HTTP loopback to it

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat cc34545..HEAD -- app/api/pdf-render/ lib/pdf/ app/api/document-ai/runs/ app/api/document-generation/generate/ app/api/document-generation/generated/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (4 internal callers must keep producing identical PDFs; breaking them breaks document generation)
- **Depends on**: none (001 recommended first)
- **Category**: security
- **Planned at**: commit `cc34545`, 2026-06-10

## Why this matters

`POST /api/pdf-render` launches Puppeteer on caller-supplied HTML with **no authentication**. The middleware (`proxy.ts:277-279`) explicitly lets requests with no user through to all routes — every API route must enforce its own auth, and this one doesn't. Consequences: any anonymous internet client gets (a) free, expensive headless-Chrome compute (DoS), and (b) an SSRF vector — the rendered HTML can embed `<img>`/`<iframe>` pointing at internal/metadata endpoints, and the response returns the rendered result as a PDF. The fix must not break the 4 server-side API routes that currently call this endpoint over HTTP loopback without cookies; they get a direct function call instead.

## Current state

- `app/api/pdf-render/route.ts` (≈250 lines) — the whole pipeline: `PdfRenderRequest` type (`{ html, options? }`), `createHeaderTemplate`, `createFooterTemplate`, `getBrowserLaunchOptions()` (dev: local Chrome fallback paths; prod: `@sparticuz/chromium`), and the `POST` handler:
  ```ts
  // app/api/pdf-render/route.ts:161-172
  export async function POST(request: NextRequest) {
      let browser: Browser | null = null;
      try {
          const body: PdfRenderRequest = await request.json();
          if (!body.html) {
              return NextResponse.json(
                  { error: "HTML content is required" },
                  { status: 400 }
              );
          }
  ```
  No auth check anywhere in the file. Route config at lines 4-6: `maxDuration = 60`, `dynamic = "force-dynamic"`, `runtime = "nodejs"`.

- Middleware passes unauthenticated requests through:
  ```ts
  // proxy.ts:277-279
  if (!user) {
      return attachSecurityHeaders(res);
  }
  ```

- **Callers** (verified by grep; these are ALL of them):
  - Server-to-server HTTP loopback (no cookies forwarded — would break under cookie auth):
    - `app/api/document-ai/runs/route.ts:97` — `fetch(new URL("/api/pdf-render", request.url), ...)`
    - `app/api/document-ai/runs/[id]/render/route.ts:43` — same pattern
    - `app/api/document-generation/generate/route.ts:372` — same pattern
    - `app/api/document-generation/generated/[id]/route.ts:370` — same pattern
  - Browser-side (cookies sent automatically, same-origin):
    - `lib/pdf/generate-pdf.ts:66` — `fetch("/api/pdf-render", ...)`

- Repo auth convention for API routes (exemplar — match it):
  ```ts
  // app/api/company-files/route.ts:58-63
  const access = await resolveRequestAccessContext();
  const { user, tenantId, actorType } = access;
  if (!user && actorType !== "demo") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  ```
  `resolveRequestAccessContext` comes from `@/lib/demo-session` (defined at `lib/demo-session.ts:263`) and also honors the demo-session actor; use it, not a raw `auth.getUser()`, so demo links keep working.

## Commands you will need

| Purpose   | Command                                        | Expected on success |
|-----------|------------------------------------------------|---------------------|
| Typecheck | `npm run typecheck` (or `npx tsc --noEmit`)    | exit 0              |
| Lint      | `npm run lint`                                 | exit 0              |
| New test  | `npx vitest run tests/app/api/pdf-render.test.ts` | all pass         |
| Full unit | `npm test`                                     | all pass            |

## Scope

**In scope**:
- `lib/pdf/render-pdf.server.ts` (create — extracted rendering function)
- `app/api/pdf-render/route.ts` (auth + delegate to the lib function)
- `app/api/document-ai/runs/route.ts`, `app/api/document-ai/runs/[id]/render/route.ts`, `app/api/document-generation/generate/route.ts`, `app/api/document-generation/generated/[id]/route.ts` (replace HTTP loopback with direct call — ONLY the fetch block, nothing else)
- `tests/app/api/pdf-render.test.ts` (create)

**Out of scope** (do NOT touch):
- `lib/pdf/generate-pdf.ts` — the browser caller keeps using the HTTP route; cookies flow automatically.
- Puppeteer launch logic, header/footer templates, PDF margins — move verbatim, change nothing about output.
- Rate limiting beyond what middleware already does (the auth check is the control here).
- Any sanitization of the HTML — authenticated users rendering their own HTML is the product's design.

## Git workflow

- Branch: `advisor/003-pdf-render-auth`
- Commit per logical unit (extract lib → switch callers → add auth); short imperative subjects.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Extract the rendering pipeline into a lib function

Create `lib/pdf/render-pdf.server.ts`. Move (verbatim) from `app/api/pdf-render/route.ts`: the `PdfRenderRequest`-equivalent types, `createHeaderTemplate`, `createFooterTemplate`, `getBrowserLaunchOptions`, and the body of the POST try-block, reshaped as:

```ts
import "server-only";

export type PdfRenderOptions = {
    companyName?: string;
    reportTitle?: string;
    date?: string;
    format?: "A4" | "Letter";
    landscape?: boolean;
};

export async function renderHtmlToPdf(
    html: string,
    options: PdfRenderOptions = {},
): Promise<Buffer> { /* launch browser, setContent, page.pdf, close — exactly the existing logic, including the try/finally browser cleanup */ }
```

Check first whether the `server-only` package is installed (`grep '"server-only"' package.json`); if not, omit that import line (these files are only imported from route handlers anyway).

**Verify**: `npm run typecheck` → exit 0.

### Step 2: Rewrite the route as auth + thin wrapper

`app/api/pdf-render/route.ts` becomes: keep `maxDuration`/`dynamic`/`runtime` exports; `POST` does (in order): `resolveRequestAccessContext()` with the company-files 401 pattern quoted above → parse body → 400 if `!body.html` → 413 if `body.html.length > 5_000_000` (5 MB guard) → `const buffer = await renderHtmlToPdf(body.html, body.options ?? {})` → return the same `NextResponse` with the same headers (Content-Type/Content-Disposition/Content-Length) as today. Keep the existing catch block shape (500 with error message).

**Verify**: `npm run typecheck` → exit 0; `npm run lint` → exit 0.

### Step 3: Switch the four internal callers to the direct function

In each of the four files, locate the `fetch(new URL("/api/pdf-render", request.url), …)` block. Each sends `JSON.stringify({ html, options })` and reads back the PDF bytes (e.g. `await pdfResponse.arrayBuffer()`). Replace the fetch + response-ok check + arrayBuffer with:

```ts
const pdfBuffer = await renderHtmlToPdf(html, options);
```

adjusting the local variable names to whatever each call site already uses, and converting `Buffer` → whatever the downstream code needs (`Buffer` is a `Uint8Array`; `new Uint8Array(pdfBuffer)` or pass directly). Remove any now-dead "pdf render failed with status X" error branches, but PRESERVE the surrounding try/catch semantics — a render throw must produce the same user-facing error path the non-ok response produced before.

Do this one file at a time, typechecking after each.

**Verify** after each file: `npm run typecheck` → exit 0. After all four: `grep -rn "api/pdf-render" app/api/` → no matches (only `lib/pdf/generate-pdf.ts` and the route itself may reference the path).

### Step 4: Route-level auth test

Create `tests/app/api/pdf-render.test.ts` modeled on `tests/app/api/tenant-usage-post.test.ts` (imports the handler directly). Mock `@/lib/demo-session`'s `resolveRequestAccessContext` with `vi.mock` to return `{ user: null, tenantId: null, actorType: "anonymous" }` and assert `POST` returns 401 **without** the mock for puppeteer being needed (auth must run before any browser work — if the test tries to launch Chrome, the ordering in Step 2 is wrong). Add a second case: authenticated context + missing `html` → 400.

**Verify**: `npx vitest run tests/app/api/pdf-render.test.ts` → 2 tests pass.

## Test plan

- `tests/app/api/pdf-render.test.ts`: (1) unauthenticated POST → 401, (2) authenticated POST without `html` → 400. Pattern: `tests/app/api/tenant-usage-post.test.ts` + `vi.mock`.
- Behavioral check of document generation (the risky part) if a local stack runs: `npm run dev`, generate a document via the document-generation UI, confirm a PDF downloads. If no local stack, state that in the report — the typecheck + unchanged-logic extraction is the fallback evidence.
- `npm test` → entire suite green.

## Done criteria

- [ ] `npm run typecheck` exits 0; `npm run lint` exits 0
- [ ] `npm test` exits 0 including 2 new tests in `tests/app/api/pdf-render.test.ts`
- [ ] `grep -rn "pdf-render" app/api/document-ai app/api/document-generation` → no matches
- [ ] `grep -n "resolveRequestAccessContext" app/api/pdf-render/route.ts` → match
- [ ] `lib/pdf/render-pdf.server.ts` exists and `app/api/pdf-render/route.ts` imports from it
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any internal caller passes something other than `{ html, options }` to the endpoint (re-read the call sites; if one streams or passes extra fields, the extraction contract is wrong).
- You find additional callers of `/api/pdf-render` beyond the five listed (`grep -rn "pdf-render" app lib components`) — each needs a decision.
- `lib/pdf/generate-pdf.ts` turns out to be invoked from a server context (grep its importers) — then the browser-caller assumption is wrong and cookie auth may break it.
- Moving the puppeteer code changes bundling behavior (`next build` errors about `@sparticuz/chromium` or `puppeteer-core` in a new context).

## Maintenance notes

- Anyone adding a new PDF-producing feature should import `renderHtmlToPdf` directly — never loop back through the HTTP route from server code.
- Reviewer should diff the moved code against the original route to confirm the render logic is verbatim (margins, headerTemplate, `waitUntil: "domcontentloaded"`, 45s timeouts).
- Deferred follow-up: outbound-network restrictions inside Puppeteer (`page.setRequestInterception` allow-list) would close residual SSRF by authenticated users; product call, not in this plan.
