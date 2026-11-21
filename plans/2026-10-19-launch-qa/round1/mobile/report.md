# Mobile baseline: ISSUES

Real email signup passed. Organization creation failed twice, so a usable dashboard was not reached.

- P1, organization.create.generic-error: “No pudimos crear la organización. Probá de nuevo.” after submit and one retry. See preparing-state.png and organization-retry-result.png. Browser evidence does not establish whether the cause is application code or integration setup.
- P2, landing.hero.hidden-until-hydration: hero HTML exists but parent opacity is0; mobile viewport looks blank while scripts load. Ingresar clicks show no response before hydration. See landing.png and loading-progress.png. Essential text should render before JavaScript completes.

Chrome fresh context,375×812, mobile/touch. CDP throttle400ms latency,51,200bytes/s download and upload, cellular3g, cache disabled for the entire journey. Hydration happened roughly132seconds after first DOM capture. Development chunks include main-app.js2.73MB and page.js2.10MB, so this is not a production performance estimate.

No horizontal overflow found on visited screens. Email registration, mobile form controls, preserved organization name and submitting feedback worked. Signup automatically navigated to onboarding after a brief authenticated landing state.

Source HEAD: e04d72020f0fea28c42bf603ae2960ca5e63bb07. Runtime 632e9558-4b39-4e90-b893-3881421b89c7, http://127.0.0.1:62988. Snapshot file hashes and full metadata are in report.json. Console/network failures are in events.json; transfer timing is in network-performance.json. Visitors localhost error and React Scan overlays were development noise. No Google sign-in, real email, payments or product edits performed.
