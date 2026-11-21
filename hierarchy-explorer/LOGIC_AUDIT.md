# Logic audit and extraction decisions

The production implementation is capable, but the portfolio use case has a different constraint: the feature must run without the Django admin, server-rendered filters, report endpoints, global scripts or application-specific state. The extraction keeps the behavior while replacing those integration points with a small client-side model.

| Before | After | Why |
| --- | --- | --- |
| Hierarchy state lived in a large table component plus `useHierarchyNavigation` and URL synchronization. | Breadcrumb state is a small ordered array of selected dimensions. The current level is derived from its length. | A copied preview has no router or backend contract to hydrate, and derived state avoids synchronization bugs. |
| Root, parent and level filtering could happen either client-side or server-side. | One deterministic `getContextDevices` pipeline applies every breadcrumb selection locally. | The demo works with no endpoint while preserving the same drill-down semantics. |
| Global search used a server request and special “bypass hierarchy” response handling. | Search switches the source from the current context to the complete dataset and renders device paths. | The user can demonstrate the important cross-hierarchy behavior without transport or cache logic. |
| Filters came from Django-rendered HTML and were synchronized through URL parameters and custom DOM events. | Filters are controlled React state with facet counts and a single typed data contract. | The module is portable, predictable and easy to adapt to another project's state layer. |
| Hierarchy filter parameters required allowlists and URL sanitization. | The demo exposes only valid filter controls and composes predicates in a fixed pipeline. | Invalid or stale query parameters cannot enter the preview state. |
| The report panel fetched HTML, sanitized it, injected scripts and depended on globally loaded Chart.js assets. | The histogram is native React and CSS, generated from local device snapshots. | No `innerHTML`, iframe, network request, global asset or chart dependency is needed. |
| Report configuration changed by hierarchy level through backend-provided URLs and model IDs. | Histogram input is the currently scoped dataset, so it changes automatically at every hierarchy level. | The visual and the table always share the same source of truth. |
| Current report visibility and height were persisted in `localStorage` and managed with DOM observers. | History visibility is a normal React toggle and the panel is responsive by CSS. | Portfolio state should reset cleanly and avoid environment-specific persistence. |
| Table animation used a JavaScript motion runtime for hierarchy panel transitions. | Repeated navigation is immediate; only short color, opacity and press feedback transitions remain. | Frequent drill-down stays responsive and reduced-motion behavior is straightforward. |
| Row data, configuration, deferred columns, counts and report HTML had separate loading and cache paths. | Sample data, aggregates, history and table rows are computed synchronously with memoized selectors. | A deterministic demo has no fake loading states and no cache invalidation surface. |
| Status summaries were HTML cells produced by the backend. | Aggregation computes healthy, attention, offline, availability and variation values from device records. | The same logic can feed cards, histogram and table without parsing markup. |

## State flow

```text
sample devices
  → hierarchy context or global search
  → class / profile / firmware / availability filters
  → deterministic snapshot status
  → optional status filter
  → aggregate rows
  → sort and paginate
```

The histogram intentionally branches immediately before the status filter. This keeps the complete status distribution visible while a user filters the table to one or more statuses, which is the expected cross-filter behavior in an operational dashboard.

## Portable contract

The exported component accepts `brand`, `title`, `subtitle` and `devices`. The bundled `demoDevices` export can be reused in storybooks, screenshots or a static case-study page. There are no external fonts, images, APIs or runtime globals.
