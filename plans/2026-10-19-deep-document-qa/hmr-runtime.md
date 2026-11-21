# Next development HMR reload diagnosis

Source revision: `e04d72020f0fea28c42bf603ae2960ca5e63bb07`

Observed runtime: Next.js `16.2.6`, `next dev --webpack`, owned immutable application snapshot.

## Finding

The document editor state loss during the template workflow was caused by the Next.js development HMR client reloading the current tab after receiving a `SYNC` message with a compilation hash different from the hash it had already recorded. The product's **Generar documento** action did not initiate the navigation.

This is a verification-runtime limitation. It demonstrates that cold compilation and HMR traffic can interrupt a stateful browser workflow under `next dev --webpack`; it does not establish a production document-generation defect.

## Direct evidence

Owned run `87037b06-a5ba-4c29-b5cb-5b601660a947` attached `navigation-evidence`, stored in the retained trace as `resources/68503378a6c25fe033ddfb26fda9a99a7521a490`.

The Chrome DevTools Protocol events record:

- `Page.frameRequestedNavigation.reason`: `reload`
- `Page.frameRequestedNavigation.disposition`: `currentTab`
- the same editor URL before and after the navigation
- `Network.requestWillBeSent.initiator.type`: `script`
- initiator function: `handleMessage`
- initiator URL: `webpack-internal:///(app-pages-browser)/../../../../../Desktop/projects/multi-tenant/node_modules/next/dist/client/dev/hot-reloader/app/web-socket.js`
- initiator position: `lineNumber: 84`, `columnNumber: 40` in the CDP stack

The installed Next.js source at `node_modules/next/dist/client/dev/hot-reloader/app/web-socket.js` tracks the latest webpack compilation hash in `handleMessage`. For a `SYNC` message, when a previous hash exists and differs from the new hash, it calls `window.location.reload()` and marks the client as reloading. This matches the captured script initiator and reload reason.

The earlier owned run `bc46f695-c278-44f5-9cc7-b43411cc9e88` supplies the timing and network shape:

- **Generar documento** click: trace monotonic `28358.016` to `28427.173`.
- full-document GET of the unchanged editor URL: monotonic `28496.045`.
- the request accepted HTML, included `Upgrade-Insecure-Requests: 1`, and referred to the same URL; it had no RSC/router headers.
- React DevTools initialized again at `29741.551`, HMR reconnected at `30080.989`, and the editor bootstrap restarted at `30129.786`.
- immediately beforehand, the editor observed Fast Refresh cycles `26158.118` to `27150.890` and `27238.921` to `28051.872`.
- `app.log` attributes `2.2s` of the preceding `2.4s` bootstrap request to Next.js compilation.

## Product paths ruled out

`app/document-generation/page-client.tsx` renders **Generar documento** as `type="button"`. On missing required values, `handleGenerate` sets the validation review state and returns before `editorSession.generate`. The inspected application code contains no `window.location.reload()`, `location.reload()`, or router refresh path that corresponds to this click. The CDP script stack points directly to Next's development HMR client.

## Harness boundary

The focused mitigation pins only the SYNC compilation hash on the owned Next development HMR WebSocket to its initial value. The socket remains connected and forwards all other development messages. An initial attempt to suppress the whole HMR transport stalled initial client hydration and was rejected. Product API requests, Supabase traffic, realtime/business WebSockets, SQL, Storage, authentication, and document rendering remain real. The temporary CDP instrumentation belongs only to diagnosis and can be removed after the harness regression proves that the workflow completes without a development-runtime reload.

This mitigation improves determinism for the owned development stack. A production-build browser run remains the appropriate separate check for production reload and performance behavior.
