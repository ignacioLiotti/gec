# Breaker round2 — ISSUES

firstSuccess: true, with diagnostic reload recovery. Run ebf28309-24f4-4aae-93fb-078b45b85b3a; HEAD e04d72020f0fea28c42bf603ae2960ca5e63bb07; owned app61709.

1. **High: Back/Forward leaves account access disabled.** Preparando acceso… and Ingresar stayed disabled after15s plus20s enabled-waits. Reload restored access. Evidence04-forward-blocked.png.
2. **High: new organization absent until reload.** Successful creation led to /dashboard with Seleccionar / Sin organizaciones disponibles. Reload populated the new organization and administration. Evidence16-org-selector.png versus17-recovered-selector.png/final.png.

Invalid email/password:0POST, correct Spanish validation. Double-click signup:1signupPOST. Whitespace organization: rejected with Elegí un nombre de al menos 3 caracteres.; recovery worked. Inert QA <test> & texto remained literal in input (not persisted). Max120 enforced on130-character fill. Valid double-click creation:1POST; after reload selector contained one organization, no visible duplicate.

Actual dashboard reached with synthetic organization after recovery; final.png visually inspected. Browser logs capture app HTTP/runtime; no app HTTP>=400. Visitors/React Scan dev noise excluded. No app/source/runtime changes. See report.json for exact steps, observed limits and evidence.
