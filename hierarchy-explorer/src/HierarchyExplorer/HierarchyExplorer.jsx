import React from "react";

const LEVELS = [
  { key: "location", label: "Locations", singular: "Location", field: "location", idField: "locationId" },
  { key: "deviceClass", label: "Device classes", singular: "Device class", field: "deviceClass" },
  { key: "profile", label: "Profiles", singular: "Profile", field: "profile" },
  { key: "device", label: "Devices", singular: "Device", field: "name", idField: "id" },
];

const STATUS_META = {
  healthy: { label: "Healthy", shortLabel: "Healthy", color: "#1fa971" },
  warning: { label: "Needs attention", shortLabel: "Attention", color: "#e8a23b" },
  offline: { label: "Offline", shortLabel: "Offline", color: "#e15454" },
};

const RANGE_CONFIG = {
  "24h": { label: "24H", buckets: 16, durationMs: 24 * 60 * 60 * 1000 },
  "7d": { label: "7D", buckets: 14, durationMs: 7 * 24 * 60 * 60 * 1000 },
  "30d": { label: "30D", buckets: 15, durationMs: 30 * 24 * 60 * 60 * 1000 },
};

const LOCATION_BLUEPRINTS = [
  { id: "bue", name: "Buenos Aires Hub", region: "South America", organization: "Atlas Retail" },
  { id: "cor", name: "Córdoba Edge", region: "South America", organization: "Atlas Retail" },
  { id: "mdz", name: "Mendoza Relay", region: "South America", organization: "Northstar Logistics" },
];

const CLASS_BLUEPRINTS = [
  { name: "Gateway", code: "GW", profiles: ["EdgeLink X1", "EdgeLink X2"] },
  { name: "Access point", code: "AP", profiles: ["AirMesh Pro", "AirMesh Lite"] },
  { name: "Sensor", code: "SN", profiles: ["PulseSense", "ColdTrack"] },
];

const FIRMWARE = ["5.4.2", "5.4.1", "5.3.8"];

const hashString = (value) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
};

const createDemoDevices = () => {
  let serial = 1000;
  return LOCATION_BLUEPRINTS.flatMap((location, locationIndex) =>
    CLASS_BLUEPRINTS.flatMap((deviceClass, classIndex) =>
      deviceClass.profiles.flatMap((profile, profileIndex) =>
        Array.from({ length: 7 }, (_, deviceIndex) => {
          const seed = locationIndex * 97 + classIndex * 41 + profileIndex * 19 + deviceIndex * 11;
          const statusRoll = seed % 20;
          const status = statusRoll < 17 ? "healthy" : statusRoll < 19 ? "warning" : "offline";
          const availability = Math.min(99.98, 91.5 + ((seed * 17) % 840) / 100);
          const lastSeenMinutes = status === "offline" ? 42 + (seed % 280) : 1 + (seed % 18);
          const id = `${location.id}-${deviceClass.code.toLowerCase()}-${profileIndex + 1}-${deviceIndex + 1}`;
          serial += 1;
          return {
            id,
            name: `${deviceClass.code}-${location.id.toUpperCase()}-${String(serial).padStart(4, "0")}`,
            serial: `ATL-${String(770000 + serial)}`,
            locationId: location.id,
            location: location.name,
            region: location.region,
            organization: location.organization,
            deviceClass: deviceClass.name,
            profile,
            firmware: FIRMWARE[(seed + profileIndex) % FIRMWARE.length],
            signal: Math.max(38, 94 - ((seed * 7) % 55)),
            availability,
            status,
            lastSeenMinutes,
          };
        }),
      ),
    ),
  );
};

export const demoDevices = createDemoDevices();

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const formatPercent = (value, digits = 1) => `${Number(value || 0).toFixed(digits)}%`;

const formatRelativeTime = (minutes) => {
  if (minutes < 2) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
};

const formatBucketLabel = (timestamp, rangeKey, long = false) => {
  const date = new Date(timestamp);
  if (rangeKey === "24h") {
    return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  if (long) {
    return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const getHistoricalStatus = (device, bucketIndex, bucketCount, rangeKey) => {
  if (bucketIndex === bucketCount - 1) return device.status;
  const sample = (hashString(`${device.id}:${rangeKey}:${bucketIndex}`) % 10000) / 10000;
  const offlineChance = clamp((100 - device.availability) / 100 + 0.018, 0.025, 0.16);
  const warningChance = clamp(0.06 + (70 - device.signal) / 420, 0.06, 0.19);
  if (sample < offlineChance) return "offline";
  if (sample < offlineChance + warningChance) return "warning";
  return "healthy";
};

const getAvailability = (counts) => {
  if (!counts.total) return 0;
  return ((counts.healthy + counts.warning) / counts.total) * 100;
};

const buildHistory = (devices, rangeKey, now) => {
  const config = RANGE_CONFIG[rangeKey];
  const interval = config.durationMs / (config.buckets - 1);
  return Array.from({ length: config.buckets }, (_, index) => {
    const counts = { healthy: 0, warning: 0, offline: 0, total: devices.length };
    devices.forEach((device) => {
      counts[getHistoricalStatus(device, index, config.buckets, rangeKey)] += 1;
    });
    return {
      ...counts,
      active: counts.healthy + counts.warning,
      availability: getAvailability(counts),
      timestamp: now - config.durationMs + interval * index,
    };
  });
};

const iconPaths = {
  activity: (
    <>
      <path d="M3 12h4l2.4-6 4.2 12 2.2-6H21" />
    </>
  ),
  arrowLeft: <path d="m15 18-6-6 6-6" />,
  bars: (
    <>
      <path d="M5 20V10" />
      <path d="M12 20V4" />
      <path d="M19 20v-7" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  filter: (
    <>
      <path d="M4 5h16" />
      <path d="M7 12h10" />
      <path d="M10 19h4" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3-9 5 9 5 9-5-9-5Z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 16 9 5 9-5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  x: (
    <>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </>
  ),
};

function Icon({ name, size = 18, strokeWidth = 1.8 }) {
  return (
    <svg
      aria-hidden="true"
      className="hx-icon"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
    >
      {iconPaths[name]}
    </svg>
  );
}

function LogoMark() {
  return (
    <span className="hx-logo-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function FilterOption({ checked, count, label, onChange, swatch }) {
  return (
    <label className="hx-filter-option">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="hx-checkbox" aria-hidden="true">
        {checked && <Icon name="check" size={13} strokeWidth={2.4} />}
      </span>
      {swatch && <span className="hx-filter-swatch" style={{ background: swatch }} />}
      <span className="hx-filter-option-label">{label}</span>
      <span className="hx-filter-count">{count}</span>
    </label>
  );
}

function FilterSection({ title, children, action }) {
  return (
    <section className="hx-filter-section">
      <div className="hx-filter-section-heading">
        <h3>{title}</h3>
        {action}
      </div>
      <div className="hx-filter-options">{children}</div>
    </section>
  );
}

function FilterSidebar({
  activeCount,
  classOptions,
  close,
  filters,
  firmwareOptions,
  profileOptions,
  reset,
  statusOptions,
  toggle,
  updateMinAvailability,
}) {
  return (
    <aside className="hx-filters" aria-label="Table filters">
      <div className="hx-filters-header">
        <div>
          <span className="hx-kicker">Refine view</span>
          <h2>Filters</h2>
        </div>
        <button className="hx-icon-button hx-filters-close" onClick={close} aria-label="Close filters">
          <Icon name="x" />
        </button>
      </div>

      <div className="hx-filters-body">
        <FilterSection title="Operational status">
          {statusOptions.map((option) => (
            <FilterOption
              key={option.value}
              checked={filters.statuses.includes(option.value)}
              count={option.count}
              label={STATUS_META[option.value].label}
              onChange={() => toggle("statuses", option.value)}
              swatch={STATUS_META[option.value].color}
            />
          ))}
        </FilterSection>

        <FilterSection title="Device class">
          {classOptions.map((option) => (
            <FilterOption
              key={option.value}
              checked={filters.classes.includes(option.value)}
              count={option.count}
              label={option.value}
              onChange={() => toggle("classes", option.value)}
            />
          ))}
        </FilterSection>

        <FilterSection title="Profile">
          {profileOptions.map((option) => (
            <FilterOption
              key={option.value}
              checked={filters.profiles.includes(option.value)}
              count={option.count}
              label={option.value}
              onChange={() => toggle("profiles", option.value)}
            />
          ))}
        </FilterSection>

        <FilterSection title="Firmware">
          {firmwareOptions.map((option) => (
            <FilterOption
              key={option.value}
              checked={filters.firmware.includes(option.value)}
              count={option.count}
              label={`v${option.value}`}
              onChange={() => toggle("firmware", option.value)}
            />
          ))}
        </FilterSection>

        <FilterSection
          title="Device availability"
          action={<span className="hx-range-value">{filters.minAvailability || 0}%+</span>}
        >
          <label className="hx-range-field">
            <span className="hx-sr-only">Minimum device availability</span>
            <input
              type="range"
              min="0"
              max="99"
              step="1"
              value={filters.minAvailability}
              onChange={(event) => updateMinAvailability(Number(event.target.value))}
              style={{ "--hx-range-progress": `${filters.minAvailability}%` }}
            />
            <span className="hx-range-labels">
              <span>Any</span>
              <span>99%+</span>
            </span>
          </label>
        </FilterSection>
      </div>

      <div className="hx-filters-footer">
        <span>{activeCount ? `${activeCount} active` : "No active filters"}</span>
        <button className="hx-text-button" disabled={!activeCount} onClick={reset}>Clear all</button>
      </div>
    </aside>
  );
}

function Metric({ label, value, detail, tone = "neutral" }) {
  return (
    <div className="hx-metric">
      <span className="hx-metric-label">{label}</span>
      <div className="hx-metric-value-row">
        <strong>{value}</strong>
        {detail && <span className={`hx-metric-detail hx-tone-${tone}`}>{detail}</span>}
      </div>
    </div>
  );
}

function Histogram({
  history,
  rangeKey,
  selectedIndex,
  setRangeKey,
  setSelectedIndex,
}) {
  const selected = history[selectedIndex] || history[history.length - 1];
  const previous = history[Math.max(0, selectedIndex - 1)] || selected;
  const change = selected.active - previous.active;
  const isLatest = selectedIndex === history.length - 1;
  const maxTotal = Math.max(1, ...history.map((bucket) => bucket.total));

  return (
    <section className="hx-histogram-card" aria-labelledby="hx-status-history-title">
      <div className="hx-histogram-header">
        <div>
          <div className="hx-title-line">
            <span className="hx-panel-icon"><Icon name="activity" size={17} /></span>
            <div>
              <h2 id="hx-status-history-title">Status history</h2>
              <p>{isLatest ? "Live operational snapshot" : formatBucketLabel(selected.timestamp, rangeKey, true)}</p>
            </div>
          </div>
        </div>
        <div className="hx-range-switcher" aria-label="Status history range">
          {Object.entries(RANGE_CONFIG).map(([key, config]) => (
            <button
              type="button"
              key={key}
              className={rangeKey === key ? "is-active" : ""}
              onClick={() => {
                setRangeKey(key);
                setSelectedIndex(null);
              }}
            >
              {config.label}
            </button>
          ))}
        </div>
      </div>

      <div className="hx-metrics-grid">
        <Metric label="Active devices" value={`${selected.active}/${selected.total}`} detail={`${change >= 0 ? "+" : ""}${change}`} tone={change >= 0 ? "positive" : "negative"} />
        <Metric label="Availability" value={formatPercent(selected.availability, 1)} detail={selected.availability >= 94 ? "On target" : "Below target"} tone={selected.availability >= 94 ? "positive" : "warning"} />
        <Metric label="Needs attention" value={selected.warning} detail={selected.warning ? "Review" : "Clear"} tone={selected.warning ? "warning" : "positive"} />
        <Metric label="Offline" value={selected.offline} detail={selected.offline ? "Escalate" : "Clear"} tone={selected.offline ? "negative" : "positive"} />
      </div>

      <div className="hx-chart-wrap">
        <div className="hx-chart-y-axis" aria-hidden="true">
          <span>100%</span><span>50%</span><span>0</span>
        </div>
        <div className="hx-chart-plot">
          <span className="hx-grid-line hx-grid-line-top" />
          <span className="hx-grid-line hx-grid-line-mid" />
          <div className="hx-bars" role="list" aria-label="Device availability by time bucket">
            {history.map((bucket, index) => {
              const activeHeight = bucket.total ? (bucket.active / maxTotal) * 100 : 0;
              const warningPart = bucket.active ? (bucket.warning / bucket.active) * 100 : 0;
              const labelStep = Math.max(1, Math.ceil(history.length / 5));
              return (
                <button
                  type="button"
                  role="listitem"
                  key={bucket.timestamp}
                  className={`hx-bar-button ${selectedIndex === index ? "is-selected" : ""}`}
                  aria-label={`${formatBucketLabel(bucket.timestamp, rangeKey, true)}: ${bucket.active} active, ${bucket.warning} need attention, ${bucket.offline} offline`}
                  onClick={() => setSelectedIndex(index)}
                >
                  <span className="hx-bar-track">
                    <span className="hx-bar-stack" style={{ height: `${activeHeight}%` }}>
                      <span className="hx-bar-healthy" style={{ height: `${100 - warningPart}%` }} />
                      <span className="hx-bar-warning" style={{ height: `${warningPart}%` }} />
                    </span>
                    {bucket.offline > 0 && <span className="hx-bar-offline" />}
                  </span>
                  <span className="hx-bar-label">
                    {index % labelStep === 0 || index === history.length - 1
                      ? formatBucketLabel(bucket.timestamp, rangeKey)
                      : ""}
                  </span>
                  <span className="hx-chart-tooltip" role="tooltip">
                    <strong>{formatBucketLabel(bucket.timestamp, rangeKey, true)}</strong>
                    <span><i style={{ background: STATUS_META.healthy.color }} />{bucket.healthy} healthy</span>
                    <span><i style={{ background: STATUS_META.warning.color }} />{bucket.warning} attention</span>
                    <span><i style={{ background: STATUS_META.offline.color }} />{bucket.offline} offline</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="hx-chart-footer">
        <div className="hx-legend">
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <span key={key}><i style={{ background: meta.color }} />{meta.shortLabel}</span>
          ))}
        </div>
        {!isLatest && (
          <button className="hx-live-button" type="button" onClick={() => setSelectedIndex(history.length - 1)}>
            <span /> Return to live
          </button>
        )}
      </div>
    </section>
  );
}

function StatusDistribution({ row }) {
  const total = Math.max(1, row.total);
  return (
    <div className="hx-status-distribution" aria-label={`${row.healthy} healthy, ${row.warning} need attention, ${row.offline} offline`}>
      <div className="hx-status-track">
        <span style={{ width: `${(row.healthy / total) * 100}%`, background: STATUS_META.healthy.color }} />
        <span style={{ width: `${(row.warning / total) * 100}%`, background: STATUS_META.warning.color }} />
        <span style={{ width: `${(row.offline / total) * 100}%`, background: STATUS_META.offline.color }} />
      </div>
      <span className="hx-status-summary">{row.healthy} healthy</span>
    </div>
  );
}

function SortButton({ active, direction, label, onClick }) {
  return (
    <button className={`hx-sort-button ${active ? "is-active" : ""}`} type="button" onClick={onClick}>
      {label}
      <span aria-hidden="true">{active ? (direction === "asc" ? "↑" : "↓") : "↕"}</span>
    </button>
  );
}

function HierarchyPath({ device, onNavigate }) {
  return (
    <button className="hx-path" type="button" onClick={() => onNavigate(device)} title="Open this device in its hierarchy">
      <span>{device.location}</span>
      <Icon name="chevronRight" size={11} />
      <span>{device.deviceClass}</span>
      <Icon name="chevronRight" size={11} />
      <span>{device.profile}</span>
    </button>
  );
}

function ResultsTable({
  currentLevel,
  drillDown,
  isSearchMode,
  navigateToDevice,
  page,
  pageSize,
  rows,
  setPage,
  sort,
  toggleSort,
}) {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = rows.slice(page * pageSize, page * pageSize + pageSize);
  const firstResult = rows.length ? page * pageSize + 1 : 0;
  const lastResult = Math.min(rows.length, (page + 1) * pageSize);
  const canDrill = !isSearchMode && currentLevel.key !== "device";

  return (
    <section className="hx-table-card" aria-labelledby="hx-results-title">
      <div className="hx-table-heading">
        <div>
          <span className="hx-kicker">{isSearchMode ? "Global results" : currentLevel.singular}</span>
          <h2 id="hx-results-title">{isSearchMode ? "Matching devices" : currentLevel.label}</h2>
        </div>
        <span className="hx-row-count">{rows.length} {rows.length === 1 ? "result" : "results"}</span>
      </div>

      <div className="hx-table-scroll">
        <table>
          <thead>
            <tr>
              <th>
                <SortButton label={isSearchMode ? "Device" : currentLevel.singular} active={sort.key === "name"} direction={sort.direction} onClick={() => toggleSort("name")} />
              </th>
              <th><SortButton label="Active devices" active={sort.key === "active"} direction={sort.direction} onClick={() => toggleSort("active")} /></th>
              <th><SortButton label="Variation" active={sort.key === "trend"} direction={sort.direction} onClick={() => toggleSort("trend")} /></th>
              <th><SortButton label="Device status" active={sort.key === "availability"} direction={sort.direction} onClick={() => toggleSort("availability")} /></th>
              <th><SortButton label="Latest" active={sort.key === "latestMinutes"} direction={sort.direction} onClick={() => toggleSort("latestMinutes")} /></th>
              <th aria-label="Open" />
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={row.id}>
                <td>
                  <div className="hx-row-name">
                    <span className={`hx-row-avatar hx-avatar-${isSearchMode ? "device" : currentLevel.key}`}>
                      {row.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="hx-row-copy">
                      {canDrill || isSearchMode ? (
                        <button
                          className="hx-row-link"
                          type="button"
                          onClick={() => (isSearchMode ? navigateToDevice(row.device) : drillDown(row))}
                        >
                          {row.name}
                        </button>
                      ) : (
                        <strong>{row.name}</strong>
                      )}
                      {isSearchMode ? (
                        <HierarchyPath device={row.device} onNavigate={navigateToDevice} />
                      ) : (
                        <small>{row.subtitle}</small>
                      )}
                    </span>
                  </div>
                </td>
                <td>
                  <div className="hx-active-cell">
                    <strong>{row.active}</strong>
                    <span>of {row.total}</span>
                  </div>
                </td>
                <td>
                  <span className={`hx-trend ${row.trend > 0 ? "is-up" : row.trend < 0 ? "is-down" : "is-flat"}`}>
                    {row.trend > 0 ? "↑" : row.trend < 0 ? "↓" : "–"} {Math.abs(row.trend)}
                  </span>
                </td>
                <td><StatusDistribution row={row} /></td>
                <td>
                  <div className="hx-latest-cell">
                    <span className={`hx-status-dot is-${row.dominantStatus}`} />
                    <span>{formatRelativeTime(row.latestMinutes)}</span>
                  </div>
                </td>
                <td>
                  {(canDrill || isSearchMode) && (
                    <button className="hx-open-row" type="button" onClick={() => (isSearchMode ? navigateToDevice(row.device) : drillDown(row))} aria-label={`Open ${row.name}`}>
                      <Icon name="chevronRight" size={17} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!pageRows.length && (
          <div className="hx-empty-state">
            <span className="hx-empty-icon"><Icon name="search" size={22} /></span>
            <h3>No matching data</h3>
            <p>Try clearing a filter or using a broader search.</p>
          </div>
        )}
      </div>

      <footer className="hx-table-footer">
        <span>Showing {firstResult}–{lastResult} of {rows.length}</span>
        <div className="hx-pagination">
          <button type="button" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label="Previous page">
            <Icon name="chevronRight" size={16} />
          </button>
          <span>Page {Math.min(page + 1, pageCount)} of {pageCount}</span>
          <button type="button" disabled={page >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} aria-label="Next page">
            <Icon name="chevronRight" size={16} />
          </button>
        </div>
      </footer>
    </section>
  );
}

const getContextDevices = (devices, breadcrumbs) => breadcrumbs.reduce(
  (result, crumb) => result.filter((device) => String(device[crumb.field]) === String(crumb.value)),
  devices,
);

const getOptions = (devices, field) => Array.from(new Set(devices.map((device) => device[field])))
  .sort((left, right) => String(left).localeCompare(String(right)))
  .map((value) => ({ value, count: devices.filter((device) => device[field] === value).length }));

const aggregateRows = ({ devices, currentLevel, currentStatus, previousStatus }) => {
  if (currentLevel.key === "device") {
    return devices.map((device) => {
      const status = currentStatus(device);
      const previous = previousStatus(device);
      const counts = {
        healthy: status === "healthy" ? 1 : 0,
        warning: status === "warning" ? 1 : 0,
        offline: status === "offline" ? 1 : 0,
        total: 1,
      };
      return {
        ...counts,
        id: device.id,
        name: device.name,
        subtitle: `${device.profile} · v${device.firmware}`,
        groupValue: device.id,
        active: status === "offline" ? 0 : 1,
        trend: (status === "offline" ? 0 : 1) - (previous === "offline" ? 0 : 1),
        availability: getAvailability(counts),
        latestMinutes: device.lastSeenMinutes,
        dominantStatus: status,
        device,
      };
    });
  }

  const groups = new Map();
  devices.forEach((device) => {
    const value = device[currentLevel.field];
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(device);
  });

  return Array.from(groups.entries()).map(([value, groupDevices]) => {
    const counts = { healthy: 0, warning: 0, offline: 0, total: groupDevices.length };
    let previousActive = 0;
    groupDevices.forEach((device) => {
      counts[currentStatus(device)] += 1;
      if (previousStatus(device) !== "offline") previousActive += 1;
    });
    const active = counts.healthy + counts.warning;
    const dominantStatus = counts.offline > 0 ? "offline" : counts.warning > 0 ? "warning" : "healthy";
    const subtitleByLevel = {
      location: `${groupDevices[0].region} · ${new Set(groupDevices.map((device) => device.deviceClass)).size} device classes`,
      deviceClass: `${new Set(groupDevices.map((device) => device.profile)).size} profiles · ${groupDevices[0].organization}`,
      profile: `${groupDevices[0].deviceClass} · firmware ${Array.from(new Set(groupDevices.map((device) => device.firmware))).join(", ")}`,
    };
    return {
      ...counts,
      id: `${currentLevel.key}:${value}`,
      name: value,
      subtitle: subtitleByLevel[currentLevel.key],
      groupValue: value,
      active,
      trend: active - previousActive,
      availability: getAvailability(counts),
      latestMinutes: Math.min(...groupDevices.map((device) => device.lastSeenMinutes)),
      dominantStatus,
    };
  });
};

const initialFilters = {
  statuses: [],
  classes: [],
  profiles: [],
  firmware: [],
  minAvailability: 0,
};

export function HierarchyExplorer({
  brand = "ATLAS",
  devices = demoDevices,
  title = "Network operations",
  subtitle = "Explore fleet health from region to individual device.",
}) {
  const [breadcrumbs, setBreadcrumbs] = React.useState([]);
  const [filters, setFilters] = React.useState(initialFilters);
  const [filtersOpen, setFiltersOpen] = React.useState(() => (
    typeof window === "undefined" ? true : window.innerWidth > 820
  ));
  const [histogramOpen, setHistogramOpen] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [rangeKey, setRangeKey] = React.useState("24h");
  const [selectedBucket, setSelectedBucket] = React.useState(null);
  const [sort, setSort] = React.useState({ key: "name", direction: "asc" });
  const [page, setPage] = React.useState(0);
  const nowRef = React.useRef(Date.now());
  const searchInputRef = React.useRef(null);

  React.useEffect(() => {
    const focusSearch = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const currentLevel = LEVELS[Math.min(breadcrumbs.length, LEVELS.length - 1)];
  const normalizedQuery = query.trim().toLowerCase();
  const isSearchMode = normalizedQuery.length > 0;
  const contextDevices = React.useMemo(
    () => getContextDevices(devices, breadcrumbs),
    [breadcrumbs, devices],
  );

  const searchScopedDevices = React.useMemo(() => {
    const source = isSearchMode ? devices : contextDevices;
    if (!isSearchMode) return source;
    return source.filter((device) => [
      device.name,
      device.serial,
      device.location,
      device.deviceClass,
      device.profile,
      device.firmware,
      device.organization,
    ].some((value) => String(value).toLowerCase().includes(normalizedQuery)));
  }, [contextDevices, devices, isSearchMode, normalizedQuery]);

  const nonStatusFilteredDevices = React.useMemo(() => searchScopedDevices.filter((device) => {
    if (filters.classes.length && !filters.classes.includes(device.deviceClass)) return false;
    if (filters.profiles.length && !filters.profiles.includes(device.profile)) return false;
    if (filters.firmware.length && !filters.firmware.includes(device.firmware)) return false;
    if (filters.minAvailability && device.availability < filters.minAvailability) return false;
    return true;
  }), [filters, searchScopedDevices]);

  const history = React.useMemo(
    () => buildHistory(nonStatusFilteredDevices, rangeKey, nowRef.current),
    [nonStatusFilteredDevices, rangeKey],
  );
  const selectedIndex = selectedBucket === null
    ? history.length - 1
    : clamp(selectedBucket, 0, history.length - 1);
  const previousIndex = Math.max(0, selectedIndex - 1);
  const currentStatus = React.useCallback(
    (device) => getHistoricalStatus(device, selectedIndex, history.length, rangeKey),
    [history.length, rangeKey, selectedIndex],
  );
  const previousStatus = React.useCallback(
    (device) => getHistoricalStatus(device, previousIndex, history.length, rangeKey),
    [history.length, previousIndex, rangeKey],
  );

  const filteredDevices = React.useMemo(() => nonStatusFilteredDevices.filter((device) => (
    !filters.statuses.length || filters.statuses.includes(currentStatus(device))
  )), [currentStatus, filters.statuses, nonStatusFilteredDevices]);

  const rows = React.useMemo(() => aggregateRows({
    devices: filteredDevices,
    currentLevel: isSearchMode ? LEVELS[LEVELS.length - 1] : currentLevel,
    currentStatus,
    previousStatus,
  }), [currentLevel, currentStatus, filteredDevices, isSearchMode, previousStatus]);

  const sortedRows = React.useMemo(() => [...rows].sort((left, right) => {
    const leftValue = left[sort.key];
    const rightValue = right[sort.key];
    const comparison = typeof leftValue === "string"
      ? leftValue.localeCompare(rightValue)
      : Number(leftValue) - Number(rightValue);
    return sort.direction === "asc" ? comparison : -comparison;
  }), [rows, sort]);

  React.useEffect(() => {
    setPage(0);
  }, [breadcrumbs, filters, normalizedQuery, rangeKey, selectedIndex, sort]);

  const activeFilterCount = filters.statuses.length
    + filters.classes.length
    + filters.profiles.length
    + filters.firmware.length
    + (filters.minAvailability > 0 ? 1 : 0);

  const statusOptions = Object.keys(STATUS_META).map((value) => ({
    value,
    count: nonStatusFilteredDevices.filter((device) => currentStatus(device) === value).length,
  }));
  const classOptions = getOptions(searchScopedDevices, "deviceClass");
  const profileOptions = getOptions(searchScopedDevices, "profile");
  const firmwareOptions = getOptions(searchScopedDevices, "firmware");

  const toggleFilter = (key, value) => {
    setFilters((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((item) => item !== value)
        : [...current[key], value],
    }));
  };

  const resetFilters = () => setFilters(initialFilters);

  const drillDown = (row) => {
    if (currentLevel.key === "device") return;
    setBreadcrumbs((current) => [
      ...current,
      { field: currentLevel.field, value: row.groupValue, name: row.name, levelKey: currentLevel.key },
    ]);
    setQuery("");
  };

  const navigateToDevice = (device) => {
    setBreadcrumbs([
      { field: "location", value: device.location, name: device.location, levelKey: "location" },
      { field: "deviceClass", value: device.deviceClass, name: device.deviceClass, levelKey: "deviceClass" },
      { field: "profile", value: device.profile, name: device.profile, levelKey: "profile" },
    ]);
    setQuery("");
  };

  const navigateBreadcrumb = (index) => {
    setBreadcrumbs(index < 0 ? [] : breadcrumbs.slice(0, index + 1));
    setQuery("");
  };

  const toggleSort = (key) => {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  return (
    <div className="hx-app-shell">
      <div className="hx-app">
        <header className="hx-topbar">
          <a className="hx-brand" href="#hx-main" aria-label={`${brand} home`}>
            <LogoMark />
            <span>{brand}</span>
          </a>
          <div className="hx-topbar-context">
            <span>Operations</span><i /> <strong>Fleet intelligence</strong>
          </div>
          <div className="hx-demo-badge"><span /> Sample workspace</div>
        </header>

        <main id="hx-main" className="hx-main">
          <section className="hx-page-header">
            <div>
              <span className="hx-kicker">Operations intelligence</span>
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
            <div className="hx-live-state"><span /> Systems reporting normally</div>
          </section>

          <section className="hx-toolbar" aria-label="Explorer controls">
            <div className="hx-search-field">
              <Icon name="search" size={19} />
              <label htmlFor="hx-global-search" className="hx-sr-only">Search every hierarchy level</label>
              <input
                id="hx-global-search"
                ref={searchInputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search device, profile, location…"
              />
              <kbd>⌘ K</kbd>
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
                  <Icon name="x" size={15} />
                </button>
              )}
            </div>
            <div className="hx-toolbar-actions">
              <button className={`hx-control-button ${histogramOpen ? "is-active" : ""}`} type="button" onClick={() => setHistogramOpen((value) => !value)}>
                <Icon name="bars" size={17} />
                <span>History</span>
              </button>
              <button className={`hx-control-button ${filtersOpen ? "is-active" : ""}`} type="button" onClick={() => setFiltersOpen((value) => !value)}>
                <Icon name="filter" size={17} />
                <span>Filters</span>
                {activeFilterCount > 0 && <b>{activeFilterCount}</b>}
              </button>
            </div>
          </section>

          <nav className="hx-breadcrumbs" aria-label="Hierarchy breadcrumb">
            {breadcrumbs.length > 0 && (
              <button className="hx-back-button" type="button" onClick={() => navigateBreadcrumb(breadcrumbs.length - 2)} aria-label="Go back one level">
                <Icon name="arrowLeft" size={18} />
              </button>
            )}
            <button className={breadcrumbs.length === 0 ? "is-current" : ""} type="button" onClick={() => navigateBreadcrumb(-1)}>
              <Icon name="layers" size={16} /> All locations
            </button>
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={`${crumb.levelKey}:${crumb.value}`}>
                <Icon name="chevronRight" size={13} />
                <button className={index === breadcrumbs.length - 1 && currentLevel.key === "device" ? "is-current" : ""} type="button" onClick={() => navigateBreadcrumb(index)}>
                  {crumb.name}
                </button>
              </React.Fragment>
            ))}
            {!isSearchMode && (
              <>
                <Icon name="chevronRight" size={13} />
                <span className="hx-current-level">{currentLevel.label}</span>
              </>
            )}
          </nav>

          {isSearchMode && (
            <div className="hx-search-notice">
              <span className="hx-search-notice-icon"><Icon name="search" size={16} /></span>
              <span>Searching across all hierarchy levels for <strong>“{query.trim()}”</strong></span>
              <button type="button" onClick={() => setQuery("")}>Return to {currentLevel.label.toLowerCase()}</button>
            </div>
          )}

          <div className={`hx-workspace ${filtersOpen ? "has-filters" : ""}`}>
            {filtersOpen && (
              <FilterSidebar
                activeCount={activeFilterCount}
                classOptions={classOptions}
                close={() => setFiltersOpen(false)}
                filters={filters}
                firmwareOptions={firmwareOptions}
                profileOptions={profileOptions}
                reset={resetFilters}
                statusOptions={statusOptions}
                toggle={toggleFilter}
                updateMinAvailability={(value) => setFilters((current) => ({ ...current, minAvailability: value }))}
              />
            )}

            <div className="hx-content-column">
              {histogramOpen && (
                <Histogram
                  history={history}
                  rangeKey={rangeKey}
                  selectedIndex={selectedIndex}
                  setRangeKey={setRangeKey}
                  setSelectedIndex={setSelectedBucket}
                />
              )}
              <ResultsTable
                currentLevel={currentLevel}
                drillDown={drillDown}
                isSearchMode={isSearchMode}
                navigateToDevice={navigateToDevice}
                page={page}
                pageSize={6}
                rows={sortedRows}
                setPage={setPage}
                sort={sort}
                toggleSort={toggleSort}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
