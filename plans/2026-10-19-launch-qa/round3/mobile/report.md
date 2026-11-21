# Mobile round3: PASS

First success reached. A fresh real account created QA móvil R3 1792449985315, arrived directly at /setup, then opened /excel through the visible Obras link. The mobile Panel de obras showed the correct organization and “No hay obras para mostrar.” Opening and closing its navigation verified an actual working interaction.

The initial hero was visible before hydration. Crear cuenta was a real link and navigated to /auth/sign-up before the landing scripts finished. The signup form displayed Preparando formulario… until ready. Organization creation reached its setup directly, with2of3 essential steps complete and the actual organization name. No landing detour or Sin organizaciones state appeared.

No horizontal overflow or clipped controls were observed in the sampled375px screens. The dashboard used the mobile layout. This journey followed SPA navigation and did not separately cold-load /excel.

Chrome fresh context,375×812, mobile/touch. Throttle remained400ms latency and51,200bytes/s in both directions, cellular3g, cache disabled. The form took about102seconds to prepare in this development runtime; this is not a production performance estimate. There was no manual reload or throttle change.

Evidence: initial-loading.png, signup-initial.png, form-ready.png, organization-submitted.png, setup-loading.png, navigation-setup.png, navigation-dashboard.png and final.png. Matching JSON contains actual DOM, accessibility state and browser timing. report.json includes exact steps, snapshot hashes and the synthetic identity.

Run ebf28309-24f4-4aae-93fb-078b45b85b3a, revision round3-final, http://127.0.0.1:61709, HTTP200. Ownership verified using independent-control.json and the matching owned instance manifest. No product edits, external account actions or runtime stop performed. Visitors localhost errors and React Scan overlays are recorded as development noise.
