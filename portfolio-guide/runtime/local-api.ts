import { readCertificates } from "../sample-data";
type Preset = {
  id: string;
  name: string;
  filters: unknown;
  report_state: unknown;
};
const key = "sintesis-guide:presets";
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
function readPresets(): Preset[] {
  try {
    return JSON.parse(sessionStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}
/** Installed only by the static guide entry. Unknown API operations never reach a server. */
export function installLocalApi() {
  const fetchAsset = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const request = new Request(
      new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
        window.location.href,
      ),
      input instanceof Request ? input : init,
    );
    const url = new URL(request.url);
    if (url.origin !== window.location.origin)
      return json(
        { error: "External services are unavailable in this local demo." },
        403,
      );
    if (!url.pathname.startsWith("/api/")) return fetchAsset(request);
    if (url.pathname === "/api/reports/presets") {
      let presets = readPresets();
      if (request.method === "GET") return json({ presets });
      if (request.method === "POST") {
        const body = await request.json();
        presets.push({
          id: crypto.randomUUID(),
          name: body.name,
          filters: body.filters,
          report_state: body.reportState,
        });
      } else if (request.method === "DELETE")
        presets = presets.filter((p) => p.id !== url.searchParams.get("id"));
      else return json({ error: "Unsupported demo operation" }, 405);
      sessionStorage.setItem(key, JSON.stringify(presets));
      return json({ presets });
    }
    if (url.pathname === "/api/reports/templates" && request.method === "GET")
      return json({ templates: [] });
    if (url.pathname === "/api/reports/share" && request.method === "POST") {
      const { payload, expiresAt } = await request.json();
      const bytes = new TextEncoder().encode(
        JSON.stringify({ ...payload, rows: readCertificates(), expiresAt }),
      );
      const state = btoa(
        Array.from(bytes, (b) => String.fromCharCode(b)).join(""),
      );
      return json({
        url:
          window.location.pathname +
          "?screen=reports&shared=" +
          encodeURIComponent(state),
      });
    }
    return json(
      {
        error:
          "Esta operación requiere el servicio del producto. La guía usa únicamente el ejemplo incluido.",
      },
      403,
    );
  };
}
export function resetGuideData() {
  for (const storage of [sessionStorage, localStorage]) {
    for (const key of Object.keys(storage))
      if (
        /^(sintesis-guide:|report:last:guide-|guide-(obras|extracted|extracted-preview):|resizable-cols:guide-)/.test(
          key,
        )
      )
        storage.removeItem(key);
  }
}
