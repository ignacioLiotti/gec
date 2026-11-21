# Independent cohort repair evidence

This cohort owns `round1/*` and `round2/*`. Another task owns the prepared runtime and current source repair pass. These observations must be incorporated before freezing the repaired snapshot. Counts refer only to actual encounters among this cohort's five personas.

## Landing content paints over the contact dialog

Confirmed by impatient in an ordinary viewport, not just a full-page capture: [screenshot](round1/impatient/04-diagnostic-viewport-layering.png). The orange circle covers Nombre, the heading covers Empresa and Teléfono, and the landing demo button covers Mensaje. The fixed header also paints above the dialog overlay.

`app/page.tsx` contains page stacking contexts with arbitrary indexes up to 1000000. The shared dialog uses semantic `z-overlay` / `z-modal` tokens. Contain landing decorations and navigation in one isolated page stacking context, rather than increasing shared modal indexes. Verify the contact dialog with pointer hit-testing, a viewport screenshot, Escape and focus restoration.

The header's Agendar demo also scrolls to a second Agendá una demo button before opening the form. Open the same contact dialog directly from the header to remove that redundant click. Preserve the account-creation path as the primary first-time action.

## Essential hero hidden while hydration downloads

Confirmed by mobile at 375x812 with cache disabled, 400ms latency, 51200 bytes/s in both directions. [Initial viewport](round1/mobile/landing.png) and [performance evidence](round1/mobile/network-performance.json). The hero's HTML exists but its parent is opacity zero until hydration. Ingresar initially does nothing because it is an event-only button.

Render essential hero text visible in the initial HTML. Give account entry a real navigation fallback or an explicit preparing state, then repeat under the same network settings. Development bundle load times are not a production benchmark. Do not disable throttling to claim a mobile pass.

## Organization creation rollback

Both mobile and literal reached real local Auth signup and failed twice when creating an organization. The server-side failure was independently confirmed in logs of the manifest-matching owned database: `function digest(text, unknown) does not exist`, in `create_tenant_from_blueprint(text,jsonb)`.

The proposed additive migration `0133_blueprint_fingerprint_builtin_sha256.sql` addresses the restricted-search-path dependency without widening it. Verify the existing atomic creation contract, fingerprint equivalence, execution privileges and visible signup-to-dashboard flow. Do not apply it to ordinary local or production databases as part of QA.

## Commercial launch blocker

The skeptic stops before signup without approved pricing, terms and a discoverable privacy policy. Linking the existing policy and making `/privacy` anonymous solves the privacy branch. It does not supply approved terms or prices. Those remain an explicit content dependency until the operator supplies them; do not mark this persona passed through a diagnostic signup branch.
