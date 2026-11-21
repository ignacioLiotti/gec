# Mobile round2: ISSUES, first success reached

Real signup, organization creation and a working mobile dashboard passed. The browser reached /excel with “Panel de obras”, organization QA móvil R2 1792449353826, and “No hay obras para mostrar.” Opening the navigation drawer showed the real application menu.

Fixed from round1: the hero is visible before hydration; auth controls show disabled “Preparando acceso…”. Creating the organization no longer fails.

Remaining findings:

- P2 organization.post-create.landing-detour: creation briefly reaches a tenant switch URL with next=/setup, then returns to the marketing landing. Following the visible Mis obras link recovers the workspace. See setup-loading.png.
- P2 mobile.dashboard.ssr-clipping-before-hydration: the temporary desktop table renders a327px main area inside375px viewport, clipping Guardar cambios at the right edge. After hydration, the mobile panel fills the width. See mobile-clipping.png, layout-evidence.json and final.png.

Chrome fresh context,375×812, mobile/touch. Exact CDP throttle remained400ms latency,51,200bytes/s download/upload, cellular3g, cache disabled. HMR reloaded the page while loading. Root verified snapshot hashes unchanged. Recorded waits include development bundle and HMR costs and are not production performance comparisons.

Stable dashboard evidence is final.png. It is the last stable capture before the navigation interaction; the subsequent close-animation screenshot with React Scan overlays is navigation-closing.png. Navigation proof is navigation-open.png/json. No page-level horizontal overflow remained.

Runtime ebf28309-24f4-4aae-93fb-078b45b85b3a, http://127.0.0.1:61709, HTTP200. Ownership was verified against independent-control.json and instance.json. Only this persona browser was closed; the runtime remains running. Snapshot hashes, exact steps, diagnostics and the new synthetic identity are in report.json.
