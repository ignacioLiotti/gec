# Hierarchy Operations Explorer

Portable React demo of a four-level operations hierarchy with an interactive status histogram, global search, cross-filters, sorting and pagination. It is intentionally independent from Django, Chart.js, TanStack Table, Bootstrap and any API.

The included preview uses deterministic sample data, so it can be shared in a portfolio without exposing production data or requiring a backend.

## Run the portfolio preview

```bash
npm install
npm run dev
```

For a production build:

```bash
npm run build
npm run preview
```

## Copy it into another React project

Copy this folder:

```text
src/HierarchyExplorer/
```

Then import the component:

```jsx
import { HierarchyExplorer } from "./HierarchyExplorer";

export default function App() {
  return <HierarchyExplorer />;
}
```

The portable folder depends only on React. The histogram, icons, aggregation, filters and sample dataset are implemented locally.

## Use your own hardcoded data

```jsx
import { HierarchyExplorer } from "./HierarchyExplorer";

const devices = [
  {
    id: "device-01",
    name: "GW-BUE-1001",
    serial: "ATL-771001",
    locationId: "bue",
    location: "Buenos Aires Hub",
    region: "South America",
    organization: "Atlas Retail",
    deviceClass: "Gateway",
    profile: "EdgeLink X1",
    firmware: "5.4.2",
    signal: 87,
    availability: 99.7,
    status: "healthy",
    lastSeenMinutes: 2
  }
];

export default function App() {
  return (
    <HierarchyExplorer
      brand="YOUR BRAND"
      title="Network operations"
      subtitle="A clear description for the portfolio case study."
      devices={devices}
    />
  );
}
```

`status` accepts `healthy`, `warning` or `offline`. Historical snapshots are generated deterministically from each device's ID, availability and signal, so the preview remains stable and requires no service.

## Included interactions

- Drill-down: Location → Device class → Profile → Device.
- Breadcrumb and back navigation.
- Global search that intentionally bypasses the current hierarchy scope.
- Direct navigation from a search result to its hierarchy path.
- Cross-filters for status, class, profile, firmware and availability.
- 24-hour, 7-day and 30-day status histograms.
- Clickable historical snapshots and “return to live”.
- Aggregate metrics, status distributions and snapshot-over-snapshot variation.
- Column sorting, pagination, empty states and responsive layouts.
- Keyboard focus states and reduced-motion support.

See [LOGIC_AUDIT.md](./LOGIC_AUDIT.md) for the extraction decisions.
