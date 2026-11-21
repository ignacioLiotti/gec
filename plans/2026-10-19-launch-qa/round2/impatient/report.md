# Impatient, round 2

BLOCKED. `firstSuccess: false`. Email signup succeeded, but submitting the organization form returned to `/tenants/new` with an empty name and no visible explanation. The persona quit without reaching a usable dashboard. Whether an organization row was created is unknown from this browser journey.

Run `ebf28309-24f4-4aae-93fb-078b45b85b3a` was verified against `independent-control.json` and its matching owned-local-integration manifest. The journey used a fresh Chrome context and fresh synthetic credentials held only in memory. No product source or runtime edits occurred.

The route was landing → Crear cuenta → email signup → Mis obras/onboarding → Crear mi organización → enter organization name → Crear y preparar mi espacio. The button briefly showed “Preparando tu espacio…”. The final state is recorded in `final.png` and `result-15.json`.

| Severity | Finding | Evidence |
| --- | --- | --- |
| P1 | Organization submission returns to the empty creation form without dashboard or explanation. | `result-13.json`, `result-14.json`, `result-15.json`, `final.png` |
| P2 | Escape closes demo dialog but focus lands on BODY rather than its header trigger, still true after a two-second focus check. | `demo-diagnostic.json`, `demo-after-escape.png` |

The separate anonymous demo diagnostic passed the earlier fixes. One header click opens the form, all four requested fields have unobstructed hit targets and receive actual click focus, and the screenshot shows no overlapping landing content. Escape closes the modal. See `demo-viewport.png`; the JSON includes the pointer checks.

No application HTTP errors or uncaught JavaScript errors were observed. Local realtime websocket handshakes repeatedly returned 503 after organization submission; this does not establish the cause of the activation failure. External tracker and development-script blocks were excluded. Initial automation readiness retries were recorded separately from the persona outcome.

All saved PNGs were viewed. Reports and observations contain no synthetic credentials.

Timing limitation: a separate diagnostic command took 6.4 seconds between the loading snapshot and the empty-form snapshot. The later final screenshot still showed `/tenants/new`. Exact time since the loading label disappeared was not recorded. The browser closed afterward, so an additional same-session wait was unavailable. Successful POST/redirect headers were not captured; no claim is made about `x-action-redirect` or database persistence.
