"use client";

import React from "react";
import { createPortal } from "react-dom";

const LEVELS = [
  { key: "location", label: "Localidad", field: "location" },
  { key: "deviceClass", label: "Clase de dispositivo", field: "deviceClass" },
  { key: "profile", label: "Perfil", field: "profile" },
  { key: "device", label: "Dispositivo", field: "name" },
];

const STATUS_META = {
  healthy: { label: "Operativo", color: "#0ab39c" },
  warning: { label: "Con alertas", color: "#f7b84b" },
  offline: { label: "Offline", color: "#f06548" },
};

const RANGE_CONFIG = {
  "24h": { label: "24 horas", short: "24H", buckets: 16, durationMs: 24 * 60 * 60 * 1000 },
  "7d": { label: "7 días", short: "7D", buckets: 14, durationMs: 7 * 24 * 60 * 60 * 1000 },
  "30d": { label: "30 días", short: "30D", buckets: 15, durationMs: 30 * 24 * 60 * 60 * 1000 },
};

const DAY_DURATION_MS = 24 * 60 * 60 * 1000;
const DEFAULT_HISTORY_VIEW_DURATION_MS = 29 * DAY_DURATION_MS;
const FULL_HISTORY_DURATION_MS = 365 * DAY_DURATION_MS;
const FULL_HISTORY_BAR_COUNT = 731;
const MIN_RANGE_DURATION_MS = 60 * 1000;
const HISTORY_SAMPLE_DURATION_MS = 30 * 60 * 1000;
const ANCHOR_STEP_MS = 60 * 60 * 1000;
const PREVIEW_RENDERED_AT = Date.now();

const TIME_UNIT_CONFIG = {
  minute: { label: "minutos", short: "min", durationMs: 60 * 1000 },
  hour: { label: "horas", short: "h", durationMs: 60 * 60 * 1000 },
  day: { label: "días", short: "d", durationMs: DAY_DURATION_MS },
  month: { label: "meses", short: "mes", durationMs: FULL_HISTORY_DURATION_MS / 12 },
};

const LOCATION_BLUEPRINTS = [
  { id: "mty", name: "MONTERREY", region: "Norte", organization: "Zequenze Demo" },
  { id: "tul", name: "TULTITLÁN", region: "Centro", organization: "Zequenze Demo" },
  { id: "qro", name: "QUERÉTARO", region: "Bajío", organization: "Zequenze Demo" },
];

const CLASS_BLUEPRINTS = [
  { name: "VoIP ATA", code: "ATA", profiles: ["ATA Residential", "ATA Business"] },
  { name: "eMTA", code: "EMTA", profiles: ["Voice Plus", "Voice Standard"] },
  { name: "FWA", code: "FWA", profiles: ["Fixed Wireless Pro", "Fixed Wireless Lite"] },
  { name: "ONT", code: "ONT", profiles: ["Fiber Home", "Fiber Enterprise"] },
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
  let serial = 2080;
  return LOCATION_BLUEPRINTS.flatMap((location, locationIndex) =>
    CLASS_BLUEPRINTS.flatMap((deviceClass, classIndex) =>
      deviceClass.profiles.flatMap((profile, profileIndex) =>
        Array.from({ length: 6 }, (_, deviceIndex) => {
          const seed = locationIndex * 97 + classIndex * 41 + profileIndex * 19 + deviceIndex * 11;
          const statusRoll = seed % 20;
          const status = statusRoll < 16 ? "healthy" : statusRoll < 19 ? "warning" : "offline";
          const availability = Math.min(99.98, 91.5 + ((seed * 17) % 840) / 100);
          const lastSeenMinutes = status === "offline" ? 42 + (seed % 280) : 1 + (seed % 18);
          const id = `${location.id}-${deviceClass.code.toLowerCase()}-${profileIndex + 1}-${deviceIndex + 1}`;
          serial += 1;
          return {
            id,
            name: `${deviceClass.code}-${location.id.toUpperCase()}-${String(serial).padStart(4, "0")}`,
            serial: `ZQ-${String(770000 + serial)}`,
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

const inferTimeUnit = (durationMs) => {
  if (durationMs >= FULL_HISTORY_DURATION_MS) return "month";
  if (durationMs >= 2 * TIME_UNIT_CONFIG.day.durationMs && durationMs % TIME_UNIT_CONFIG.day.durationMs === 0) return "day";
  if (durationMs >= TIME_UNIT_CONFIG.hour.durationMs && durationMs % TIME_UNIT_CONFIG.hour.durationMs === 0) return "hour";
  return "minute";
};

const getRangeKeyForDuration = (durationMs) => Object.entries(RANGE_CONFIG).find(([, config]) => (
  Math.abs(config.durationMs - durationMs) < 60 * 1000
))?.[0] || "custom";

const getRangeConfig = (rangeKey, durationMs = RANGE_CONFIG["24h"].durationMs) => {
  if (rangeKey !== "custom") return RANGE_CONFIG[rangeKey] || RANGE_CONFIG["24h"];
  const minutes = Math.max(1, Math.round(durationMs / (60 * 1000)));
  const hours = Math.max(1, Math.round(durationMs / (60 * 60 * 1000)));
  const days = durationMs / (24 * 60 * 60 * 1000);
  return {
    label: "Rango específico",
    short: durationMs % TIME_UNIT_CONFIG.hour.durationMs !== 0
      ? `${minutes}MIN`
      : durationMs % TIME_UNIT_CONFIG.day.durationMs !== 0 || days < 2
        ? `${hours}H`
        : `${Math.round(days)}D`,
    buckets: days <= 2 ? 16 : days <= 10 ? 14 : 15,
    durationMs,
  };
};

const toDateInputValue = (timestamp) => {
  const value = new Date(timestamp);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toTimeInputValue = (timestamp) => {
  const value = new Date(timestamp);
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
};

const createDateRangeValue = (start, end) => ({
  startDate: toDateInputValue(start),
  startTime: toTimeInputValue(start),
  endDate: toDateInputValue(end),
  endTime: toTimeInputValue(end),
});

const parseLocalDateTime = (date, time) => date && time ? new Date(`${date}T${time}`).getTime() : Number.NaN;

const parseDateRangeValue = (value) => ({
  start: parseLocalDateTime(value.startDate, value.startTime),
  end: parseLocalDateTime(value.endDate, value.endTime),
});

const formatBucketLabel = (timestamp, rangeKey, long = false, durationMs = RANGE_CONFIG["24h"].durationMs) => {
  const date = new Date(timestamp);
  if (durationMs < TIME_UNIT_CONFIG.hour.durationMs) {
    return date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }
  if (rangeKey === "24h" || (rangeKey === "custom" && durationMs <= 2 * 24 * 60 * 60 * 1000)) {
    return date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("es-MX", long
    ? { weekday: "short", month: "short", day: "numeric" }
    : { month: "short", day: "numeric" });
};

const formatLatest = (minutes, now) => new Date(now - minutes * 60 * 1000).toLocaleString("es-MX", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const getHistoricalStatus = (
  device,
  bucketIndex,
  bucketCount,
  rangeKey,
  useLiveEnd = true,
  temporalKey = bucketIndex,
) => {
  if (useLiveEnd && bucketIndex === bucketCount - 1) return device.status;
  const sample = (hashString(`${device.id}:${rangeKey}:${temporalKey}`) % 10000) / 10000;
  const offlineChance = clamp((100 - device.availability) / 100 + 0.018, 0.025, 0.16);
  const warningChance = clamp(0.06 + (70 - device.signal) / 420, 0.06, 0.19);
  if (sample < offlineChance) return "offline";
  if (sample < offlineChance + warningChance) return "warning";
  return "healthy";
};

const getAvailability = (counts) => (counts.total ? ((counts.healthy + counts.warning) / counts.total) * 100 : 0);

const buildHistory = (devices, rangeKey, anchorTime, liveNow = anchorTime, durationMs, bucketCountOverride) => {
  const config = getRangeConfig(rangeKey, durationMs);
  const bucketCount = clamp(Math.round(bucketCountOverride || config.buckets), 2, 64);
  const interval = config.durationMs / (bucketCount - 1);
  return Array.from({ length: bucketCount }, (_, index) => {
    const counts = { healthy: 0, warning: 0, offline: 0, total: devices.length };
    const timestamp = anchorTime - config.durationMs + interval * index;
    const temporalKey = Math.floor(timestamp / HISTORY_SAMPLE_DURATION_MS);
    const useLiveEnd = Math.abs(anchorTime - liveNow) < 60 * 1000;
    devices.forEach((device) => {
      counts[getHistoricalStatus(device, index, bucketCount, rangeKey, useLiveEnd, temporalKey)] += 1;
    });
    return {
      ...counts,
      active: counts.healthy + counts.warning,
      availability: getAvailability(counts),
      timestamp,
      temporalKey,
    };
  });
};

const buildFullHistory = (devices, liveNow) => {
  const interval = FULL_HISTORY_DURATION_MS / (FULL_HISTORY_BAR_COUNT - 1);
  return Array.from({ length: FULL_HISTORY_BAR_COUNT }, (_, index) => {
    const timestamp = liveNow - FULL_HISTORY_DURATION_MS + interval * index;
    const counts = { healthy: 0, warning: 0, offline: 0, total: devices.length };
    devices.forEach((device) => {
      counts[getHistoricalStatus(device, index, FULL_HISTORY_BAR_COUNT, "1y", true, Math.floor(timestamp / interval))] += 1;
    });
    const availability = getAvailability(counts);
    const texture = ((hashString(`full:${index}`) % 1000) / 1000 - 0.5) * 16;
    return { ...counts, timestamp, height: clamp(34 + availability * 0.55 + texture, 38, 96) };
  });
};

const iconPaths = {
  activity: <><path d="M3 12h4l2.4-6 4.2 12 2.2-6H21" /></>,
  bars: <><path d="M5 20V10" /><path d="M12 20V4" /><path d="M19 20v-7" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M13.7 21h-3.4" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  camera: <><path d="M14.5 4 16 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1.5-3h5Z" /><circle cx="12" cy="13" r="3" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronsHorizontal: <><path d="m10 8-4 4 4 4" /><path d="m14 8 4 4-4 4" /></>,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  columns: <><rect x="3" y="5" width="18" height="14" rx="1" /><path d="M9 5v14M15 5v14" /></>,
  download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
  filter: <><path d="M4 5h16" /><path d="M7 12h10" /><path d="M10 19h4" /></>,
  fullscreen: <><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
  layers: <><path d="m12 3-9 5 9 5 9-5-9-5Z" /><path d="m3 12 9 5 9-5" /><path d="m3 16 9 5 9-5" /></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  monitor: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>,
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />,
  pencil: <><path d="m4 20 4.2-1 10.9-10.9a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" /><path d="m14.7 6.5 3 3" /></>,
  refresh: <><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
  table: <><path d="M3 5h18v14H3zM3 10h18M8 5v14" /></>,
  x: <><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>,
};

function Icon({ name, size = 18, strokeWidth = 1.8 }) {
  return (
    <svg aria-hidden="true" className="hx-icon" fill="none" height={size} viewBox="0 0 24 24" width={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth}>
      {iconPaths[name]}
    </svg>
  );
}

function DataTableToolbar({
  activeFilterCount,
  filtersDirty,
  filtersOpen,
  histogramOpen,
  onRefresh,
  query,
  refreshing,
  searchInputRef,
  setFiltersOpen,
  setHistogramOpen,
  setQuery,
}) {
  return (
    <section className="zq-data-toolbar" aria-label="Table tools">
      <div className="zq-toolbar-search-row">
        <button className={`zq-btn zq-btn-soft-primary zq-icon-btn ${refreshing ? "is-refreshing" : ""}`} type="button" onClick={onRefresh} aria-label="Refresh"><Icon name="refresh" size={17} /></button>
        <div className="zq-search-group">
          <textarea ref={searchInputRef} value={query} onChange={(event) => setQuery(event.target.value)} rows="1" placeholder="Search..." aria-label="Search hierarchy" />
          {query && <button className="zq-search-clear" type="button" onClick={() => setQuery("")} aria-label="Clear search"><Icon name="x" size={13} /></button>}
          <button className="zq-btn zq-btn-primary zq-search-submit" type="button" aria-label="Search"><Icon name="search" size={17} /></button>
        </div>
      </div>
      <div className="zq-toolbar-actions">
        <button aria-label="Histogram" className={`zq-btn zq-btn-light ${histogramOpen ? "is-active" : ""}`} type="button" onClick={() => setHistogramOpen((value) => !value)}><Icon name="bars" size={16} /><span>Histogram</span>{histogramOpen && <Icon name="x" size={12} />}</button>
        <button aria-label="Filtro" className={`zq-btn zq-btn-success ${filtersOpen ? "is-active" : ""} ${filtersDirty ? "has-pending" : ""}`} type="button" onClick={() => setFiltersOpen((value) => !value)}><Icon name="filter" size={16} /><span>Filtro</span>{activeFilterCount > 0 && <b>{activeFilterCount}</b>}{filtersDirty && <i className="zq-pending-dot" title="Cambios sin aplicar" />}{filtersOpen && <Icon name="x" size={12} />}</button>
      </div>
    </section>
  );
}

function HierarchyBreadcrumb({ breadcrumbs, currentLevel, isSearchMode, navigate }) {
  return (
    <nav className="react-hierarchy-breadcrumb" aria-label="Hierarchy breadcrumb">
      <button className={`zq-btn zq-breadcrumb-home ${breadcrumbs.length ? "zq-btn-outline-primary" : "zq-btn-primary"}`} type="button" onClick={() => navigate(-1)} aria-label="Go to root level"><Icon name="home" size={14} /></button>
      {breadcrumbs.map((crumb, index) => (
        <React.Fragment key={`${crumb.levelKey}:${crumb.value}`}>
          <Icon name="chevronRight" size={13} />
          <button className="zq-btn zq-btn-primary react-hierarchy-breadcrumb-item" type="button" onClick={() => navigate(index)}>{crumb.name}</button>
        </React.Fragment>
      ))}
      {isSearchMode && <><Icon name="chevronRight" size={13} /><span className="zq-search-crumb">Search results</span></>}
      {!isSearchMode && breadcrumbs.length === 0 && <span className="zq-current-level">{currentLevel.label}</span>}
    </nav>
  );
}

function SnapshotMinimap({ anchorTime, devices, liveNow, onApply, rangeDurationMs, rangeKey, rangeUnit }) {
  const stripRef = React.useRef(null);
  const dragRef = React.useRef(null);
  const panRef = React.useRef(null);
  const viewContextRef = React.useRef(null);
  const applyTimerRef = React.useRef(null);
  const [stripNode, setStripNode] = React.useState(null);
  const [pending, setPending] = React.useState(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [applyState, setApplyState] = React.useState("idle");
  const [view, setView] = React.useState(null);
  const fullHistory = React.useMemo(() => buildFullHistory(devices, liveNow), [devices, liveNow]);
  const historyStart = liveNow - FULL_HISTORY_DURATION_MS;
  const effectiveAnchor = pending?.anchorTime ?? anchorTime;
  const effectiveRangeKey = pending?.rangeKey ?? rangeKey;
  const effectiveDuration = pending?.durationMs ?? rangeDurationMs;
  const effectiveUnit = pending?.unit ?? rangeUnit;
  const unitStepMs = TIME_UNIT_CONFIG[effectiveUnit].durationMs;
  const minimumUnitAmount = Math.max(1, Math.ceil(MIN_RANGE_DURATION_MS / unitStepMs));
  const maximumUnitAmount = Math.max(1, Math.floor(FULL_HISTORY_DURATION_MS / unitStepMs));
  const effectiveAmount = clamp(Math.round(effectiveDuration / unitStepMs), minimumUnitAmount, maximumUnitAmount);
  const effectiveConfig = getRangeConfig(effectiveRangeKey, effectiveDuration);
  const effectiveStart = effectiveAnchor - effectiveDuration;
  const viewStart = view?.start ?? liveNow - DEFAULT_HISTORY_VIEW_DURATION_MS;
  const viewEnd = view?.end ?? liveNow;
  const viewSpan = Math.max(1, viewEnd - viewStart);
  const rawPct = (timestamp) => ((timestamp - viewStart) / viewSpan) * 100;
  const toPct = (timestamp) => clamp(rawPct(timestamp), 0, 100);
  const startPct = toPct(effectiveStart);
  const endPct = toPct(effectiveAnchor);
  const isLive = Math.abs(effectiveAnchor - liveNow) < 60 * 1000;
  const fullSpan = liveNow - historyStart;
  const isCustomView = Boolean(view);
  const isZoomed = viewSpan < fullSpan * 0.995;
  const isViewAtLiveEnd = Math.abs(viewEnd - liveNow) < 60 * 1000;
  const windowOffLeft = rawPct(effectiveAnchor) < 0;
  const windowOffRight = rawPct(effectiveStart) > 100;
  const windowOffView = windowOffLeft || windowOffRight;
  const setStripRefs = React.useCallback((node) => {
    stripRef.current = node;
    setStripNode(node);
  }, []);

  viewContextRef.current = { viewStart, viewEnd, historyStart, liveNow };

  React.useEffect(() => () => {
    if (applyTimerRef.current) window.clearTimeout(applyTimerRef.current);
  }, []);

  React.useEffect(() => {
    if (!stripNode) return undefined;
    const handleWheel = (event) => {
      const context = viewContextRef.current;
      if (!context) return;
      event.preventDefault();
      const rect = stripNode.getBoundingClientRect();
      const ratio = clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
      const span = context.viewEnd - context.viewStart;
      const availableSpan = context.liveNow - context.historyStart;
      const isHorizontalPan = event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY);
      if (isHorizontalPan) {
        const delta = ((event.deltaX || event.deltaY) / Math.max(rect.width, 1)) * span;
        let nextStart = context.viewStart + delta;
        let nextEnd = context.viewEnd + delta;
        if (nextStart < context.historyStart) { nextStart = context.historyStart; nextEnd = nextStart + span; }
        if (nextEnd > context.liveNow) { nextEnd = context.liveNow; nextStart = nextEnd - span; }
        setView({ start: nextStart, end: nextEnd });
        return;
      }
      const factor = event.deltaY > 0 ? 1.28 : 0.78;
      const nextSpan = clamp(span * factor, 3 * 60 * 60 * 1000, availableSpan);
      const anchor = context.viewStart + ratio * span;
      let nextStart = anchor - ratio * nextSpan;
      let nextEnd = nextStart + nextSpan;
      if (nextStart < context.historyStart) { nextStart = context.historyStart; nextEnd = nextStart + nextSpan; }
      if (nextEnd > context.liveNow) { nextEnd = context.liveNow; nextStart = nextEnd - nextSpan; }
      setView({ start: nextStart, end: nextEnd });
    };
    stripNode.addEventListener("wheel", handleWheel, { passive: false });
    return () => stripNode.removeEventListener("wheel", handleWheel);
  }, [stripNode]);

  const makePending = (nextAnchor, nextRange, active, mode, nextDuration = getRangeConfig(nextRange, effectiveDuration).durationMs, nextUnit = effectiveUnit) => {
    const duration = clamp(nextDuration, MIN_RANGE_DURATION_MS, FULL_HISTORY_DURATION_MS);
    const safeAnchor = clamp(nextAnchor, historyStart + duration, liveNow);
    if (duration >= viewSpan * 0.96) {
      const framedSpan = clamp(duration * 1.08, 3 * 60 * 60 * 1000, FULL_HISTORY_DURATION_MS);
      const spareSpan = framedSpan - duration;
      let nextViewStart = safeAnchor - duration - spareSpan / 2;
      let nextViewEnd = nextViewStart + framedSpan;
      if (nextViewStart < historyStart) { nextViewStart = historyStart; nextViewEnd = nextViewStart + framedSpan; }
      if (nextViewEnd > liveNow) { nextViewEnd = liveNow; nextViewStart = nextViewEnd - framedSpan; }
      setView({ start: nextViewStart, end: nextViewEnd });
    }
    setApplyState("idle");
    setPending({
      anchorTime: safeAnchor,
      durationMs: duration,
      rangeKey: getRangeKeyForDuration(duration),
      unit: nextUnit,
      active,
      mode,
    });
  };

  const beginHandleDrag = (mode) => (event) => {
    if (event.button !== 0 || dragRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = stripRef.current?.getBoundingClientRect();
    if (!rect?.width) return;
    dragRef.current = {
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      width: rect.width,
      viewSpan,
      anchorTime: effectiveAnchor,
      startTime: effectiveStart,
      moved: false,
    };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch (_error) { /* synthetic/test pointer */ }
    setIsDragging(true);
  };

  const moveHandleDrag = (event) => {
    const session = dragRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - session.startX;
    if (!session.moved && Math.abs(deltaX) < 3) return;
    session.moved = true;
    const deltaMs = (deltaX / session.width) * session.viewSpan;
    if (session.mode === "move") {
      const nextAnchor = session.anchorTime + Math.round(deltaMs / ANCHOR_STEP_MS) * ANCHOR_STEP_MS;
      makePending(nextAnchor, effectiveRangeKey, true, "move", effectiveDuration, effectiveUnit);
      return;
    }
    const desiredDuration = Math.max(MIN_RANGE_DURATION_MS, session.anchorTime - (session.startTime + deltaMs));
    const snappedAmount = clamp(Math.round(desiredDuration / unitStepMs), minimumUnitAmount, maximumUnitAmount);
    const snappedDuration = snappedAmount * unitStepMs;
    makePending(session.anchorTime, getRangeKeyForDuration(snappedDuration), true, "resize", snappedDuration, effectiveUnit);
  };

  const endHandleDrag = (event) => {
    const session = dragRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setIsDragging(false);
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch (_error) { /* capture already released */ }
    if (!session.moved) return;
    setPending((current) => current ? { ...current, active: false } : current);
  };

  const handleProps = (mode) => ({
    onPointerDown: beginHandleDrag(mode),
    onPointerMove: moveHandleDrag,
    onPointerUp: endHandleDrag,
    onPointerCancel: endHandleDrag,
    onClick: (event) => event.stopPropagation(),
  });

  const beginPan = (event) => {
    if (event.button !== 0 || dragRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    panRef.current = { pointerId: event.pointerId, startX: event.clientX, width: Math.max(rect.width, 1), start: viewStart, end: viewEnd, moved: false };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch (_error) { /* synthetic/test pointer */ }
  };
  const movePan = (event) => {
    const session = panRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    if (!session.moved && Math.abs(event.clientX - session.startX) < 4) return;
    session.moved = true;
    const span = session.end - session.start;
    const delta = ((session.startX - event.clientX) / session.width) * span;
    let nextStart = session.start + delta;
    let nextEnd = session.end + delta;
    if (nextStart < historyStart) { nextStart = historyStart; nextEnd = nextStart + span; }
    if (nextEnd > liveNow) { nextEnd = liveNow; nextStart = nextEnd - span; }
    setView({ start: nextStart, end: nextEnd });
  };
  const endPan = (event) => {
    if (panRef.current?.pointerId !== event.pointerId) return;
    panRef.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch (_error) { /* capture already released */ }
  };

  const moveKeyboard = (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Home") return makePending(historyStart + effectiveDuration, effectiveRangeKey, false, "move", effectiveDuration, effectiveUnit);
    if (event.key === "End") return makePending(liveNow, effectiveRangeKey, false, "move", effectiveDuration, effectiveUnit);
    makePending(effectiveAnchor + ANCHOR_STEP_MS * (event.key === "ArrowLeft" ? -1 : 1), effectiveRangeKey, false, "move", effectiveDuration, effectiveUnit);
  };
  const resizeKeyboard = (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextAmount = event.key === "Home"
      ? maximumUnitAmount
      : event.key === "End"
        ? minimumUnitAmount
        : clamp(effectiveAmount + (event.key === "ArrowLeft" ? 1 : -1), minimumUnitAmount, maximumUnitAmount);
    const nextDuration = nextAmount * unitStepMs;
    makePending(effectiveAnchor, getRangeKeyForDuration(nextDuration), false, "resize", nextDuration, effectiveUnit);
  };

  const applyPending = () => {
    if (!pending || applyState === "applying") return;
    setApplyState("applying");
    applyTimerRef.current = window.setTimeout(() => {
      onApply(pending.anchorTime, pending.rangeKey, pending.durationMs, pending.unit);
      setPending(null);
      setApplyState("applied");
      applyTimerRef.current = window.setTimeout(() => setApplyState("idle"), 800);
    }, 650);
  };

  const frameWindow = () => {
    const windowSpan = clamp(Math.max(effectiveDuration * 3.5, 3 * 60 * 60 * 1000), 3 * 60 * 60 * 1000, FULL_HISTORY_DURATION_MS);
    let start = (effectiveStart + effectiveAnchor) / 2 - windowSpan / 2;
    let end = start + windowSpan;
    if (start < historyStart) { start = historyStart; end = start + windowSpan; }
    if (end > liveNow) { end = liveNow; start = end - windowSpan; }
    setView({ start, end });
  };

  const calendarMarks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    timestamp: viewStart + viewSpan * ratio,
    left: ratio * 100,
  }));
  const fullHistoryInterval = FULL_HISTORY_DURATION_MS / (FULL_HISTORY_BAR_COUNT - 1);
  const rangeStartBarIndex = clamp(Math.round((effectiveStart - historyStart) / fullHistoryInterval), 0, FULL_HISTORY_BAR_COUNT - 1);
  const rangeEndBarIndex = clamp(Math.round((effectiveAnchor - historyStart) / fullHistoryInterval), 0, FULL_HISTORY_BAR_COUNT - 1);
  const visibleBars = fullHistory.map((bucket, index) => ({ ...bucket, index, left: rawPct(bucket.timestamp) })).filter((bucket) => bucket.left >= -2 && bucket.left <= 102);
  const barWidthPct = Math.min(0.9, 64 / Math.max(visibleBars.length, 1));
  const formatTimelineLabel = (timestamp) => new Date(timestamp).toLocaleString("es-MX", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const useCombinedLabel = endPct - startPct < 22;
  const combinedLabelPct = clamp(startPct + (endPct - startPct) / 2, 14, 86);

  const changeRangeAmount = (event) => {
    const amount = Number.parseInt(event.target.value, 10);
    if (!Number.isFinite(amount)) return;
    const nextAmount = clamp(amount, minimumUnitAmount, maximumUnitAmount);
    const nextDuration = nextAmount * unitStepMs;
    makePending(effectiveAnchor, getRangeKeyForDuration(nextDuration), false, "resize", nextDuration, effectiveUnit);
  };

  const changeRangeUnit = (nextUnit) => {
    const nextStepMs = TIME_UNIT_CONFIG[nextUnit].durationMs;
    const nextMaximum = Math.max(1, Math.floor(FULL_HISTORY_DURATION_MS / nextStepMs));
    const nextMinimum = Math.max(1, Math.ceil(MIN_RANGE_DURATION_MS / nextStepMs));
    const nextAmount = clamp(effectiveAmount, nextMinimum, nextMaximum);
    const nextDuration = nextAmount * nextStepMs;
    makePending(effectiveAnchor, getRangeKeyForDuration(nextDuration), false, "resize", nextDuration, nextUnit);
  };

  return (
    <section className={`snapshot-minimap snapshot-minimap-clickable ${isDragging ? "snapshot-minimap-dragging" : ""}`} aria-label="Full history">
      <div className="snapshot-minimap-header">
        <span className="snapshot-minimap-title">Full history{isCustomView && isZoomed && <span className="snapshot-minimap-zoom-hint"> · zoomed — scroll to zoom out, drag background to pan</span>}</span>
        <div className="snapshot-minimap-coverage">
          <span>Comparing <strong>start</strong> vs <strong>end</strong></span>
          <span className="snapshot-minimap-range-inputs">
            <input type="number" min={minimumUnitAmount} max={maximumUnitAmount} step="1" value={effectiveAmount} onChange={changeRangeAmount} aria-label="Comparison amount" disabled={applyState === "applying"} />
            <SelectControl compact value={effectiveUnit} onChange={changeRangeUnit} ariaLabel="Comparison time unit" disabled={applyState === "applying"} options={Object.entries(TIME_UNIT_CONFIG).map(([key, config]) => ({ value: key, label: config.label }))} />
          </span>
          <span>· 1 year on record</span>
          {pending && !pending.active && (
            <span className="snapshot-minimap-actions">
              <button className="zq-btn zq-btn-primary snapshot-minimap-proceed" type="button" onClick={applyPending} disabled={applyState === "applying"}>{applyState === "applying" && <i className="zq-spinner" />}{applyState === "applying" ? "Applying…" : "Proceed"}</button>
              {applyState !== "applying" && <button className="zq-btn zq-btn-light snapshot-minimap-discard" type="button" onClick={() => { setPending(null); setApplyState("idle"); }} aria-label="Discard pending timeline change"><Icon name="x" size={13} /></button>}
            </span>
          )}
        </div>
      </div>
      <div ref={setStripRefs} className="snapshot-minimap-strip" onPointerDown={beginPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan}>
        <span className="snapshot-minimap-bars">
          {visibleBars.map((bucket, visibleIndex) => <span className={`snapshot-minimap-bar ${bucket.index === rangeStartBarIndex ? "is-range-start" : ""} ${bucket.index === rangeEndBarIndex ? "is-range-end" : ""}`} key={bucket.timestamp} style={{ left: `${bucket.left}%`, height: `${bucket.height}%`, width: `${barWidthPct}%`, "--bar-index": Math.min(visibleIndex, 60) }} />)}
        </span>
        {calendarMarks.slice(1, -1).map((mark) => <React.Fragment key={mark.timestamp}><span className="snapshot-minimap-gridline" style={{ left: `${mark.left}%` }} /><span className="snapshot-minimap-gridline-label" style={{ left: `${mark.left}%` }}>{new Date(mark.timestamp).toLocaleDateString("es-MX", { month: "short", day: "numeric" })}</span></React.Fragment>)}
        {windowOffView ? <button className={`snapshot-minimap-offview ${windowOffLeft ? "snapshot-minimap-offview-left" : "snapshot-minimap-offview-right"}`} type="button" onClick={(event) => { event.stopPropagation(); frameWindow(); }}>{windowOffLeft ? "◂ " : ""}{effectiveConfig.short}{windowOffRight ? " ▸" : ""}</button> : (
          <span className="snapshot-minimap-compare" style={{ left: `${startPct}%`, width: `${Math.max(endPct - startPct, 0)}%` }}>
            <span className="snapshot-minimap-compare-handle" {...handleProps("move")} title="Drag to move the snapshot through time" />
            <button className="snapshot-minimap-compare-dot snapshot-minimap-compare-dot-start snapshot-minimap-compare-dot-resizable" type="button" {...handleProps("resize")} onKeyDown={resizeKeyboard} title="Drag to resize the lookback window" aria-label="Resize comparison window" />
            <span className={`snapshot-minimap-compare-dot snapshot-minimap-compare-dot-end ${isLive ? "snapshot-minimap-compare-dot-live" : ""}`} {...handleProps("move")} onKeyDown={moveKeyboard} role="slider" tabIndex={0} aria-label="Move comparison window" />
            {pending?.active && pending.mode === "resize" && <span className="snapshot-minimap-resize-badge">{effectiveAmount}{TIME_UNIT_CONFIG[effectiveUnit].short}</span>}
          </span>
        )}
        {rawPct(liveNow) >= 0 && rawPct(liveNow) <= 100 && <span className="snapshot-minimap-today-marker" style={{ left: `${toPct(liveNow)}%` }} />}
      </div>
      <div className="snapshot-minimap-annotation">
        {!windowOffView && <><span className="snapshot-minimap-annotation-tick is-start" style={{ left: `${startPct}%` }} /><span className="snapshot-minimap-annotation-tick is-end" style={{ left: `${endPct}%` }} />{useCombinedLabel ? <span className="snapshot-minimap-annotation-label is-combined" style={{ left: `${combinedLabelPct}%` }}>{formatTimelineLabel(effectiveStart)} → {isLive ? "now" : formatTimelineLabel(effectiveAnchor)}</span> : <><span className="snapshot-minimap-annotation-label is-start" style={{ left: `${startPct}%` }}>{formatTimelineLabel(effectiveStart)}</span><span className="snapshot-minimap-annotation-label is-end" style={{ left: `${endPct}%` }}>{isLive ? "now" : formatTimelineLabel(effectiveAnchor)}</span></>}</>}
      </div>
      <div className="snapshot-minimap-footer"><span>{new Date(viewStart).toLocaleDateString("es-MX", { month: "short", day: "numeric", year: "numeric" })}</span><span className={isViewAtLiveEnd ? "snapshot-minimap-today-label" : ""}>{new Date(viewEnd).toLocaleDateString("es-MX", { month: "short", day: "numeric", year: "numeric" })}{isViewAtLiveEnd && " · today"}</span></div>
    </section>
  );
}

const CHART_VIEWBOX_HEIGHT = 220;
const CHART_PLOT_LEFT = 48;
const CHART_PLOT_RIGHT_GUTTER = 28;
const CHART_MIN_VIEWBOX_WIDTH = 760;
const CHART_BUCKET_SPACING = 57;

const buildLinePath = (history, accessor, maximum, plotWidth) => history.map((bucket, index) => {
  const x = CHART_PLOT_LEFT + (index / Math.max(1, history.length - 1)) * plotWidth;
  const y = 186 - (accessor(bucket) / Math.max(1, maximum)) * 160;
  return `${index ? "L" : "M"} ${x.toFixed(2)} ${y.toFixed(2)}`;
}).join(" ");

function DeviceStatusTrend({ anchorTime, devices, liveNow, rangeDurationMs, rangeKey }) {
  const frameRef = React.useRef(null);
  const [hoveredIndex, setHoveredIndex] = React.useState(null);
  const [frameSize, setFrameSize] = React.useState({ width: 1000, height: 160 });
  React.useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    const updateFrameSize = () => {
      const bounds = frame.getBoundingClientRect();
      const nextSize = { width: Math.max(1, Math.round(bounds.width)), height: Math.max(1, Math.round(bounds.height)) };
      setFrameSize((current) => current.width === nextSize.width && current.height === nextSize.height ? current : nextSize);
    };
    updateFrameSize();
    const observer = new ResizeObserver(updateFrameSize);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);
  const viewBoxWidth = Math.max(CHART_MIN_VIEWBOX_WIDTH, Math.round((frameSize.width / frameSize.height) * CHART_VIEWBOX_HEIGHT));
  const plotWidth = viewBoxWidth - CHART_PLOT_LEFT - CHART_PLOT_RIGHT_GUTTER;
  const baseBucketCount = getRangeConfig(rangeKey, rangeDurationMs).buckets;
  const visualBucketCount = clamp(Math.round(plotWidth / CHART_BUCKET_SPACING), baseBucketCount, 64);
  const history = React.useMemo(() => buildHistory(devices, rangeKey, anchorTime, liveNow, rangeDurationMs, visualBucketCount), [anchorTime, devices, liveNow, rangeDurationMs, rangeKey, visualBucketCount]);
  const lastHistoryIndex = Math.max(0, history.length - 1);
  const inspectionIndex = hoveredIndex === null ? lastHistoryIndex : clamp(hoveredIndex, 0, lastHistoryIndex);
  const selected = history[inspectionIndex] || history[history.length - 1];
  const maximum = Math.max(1, ...history.map((bucket) => bucket.total));
  const upPath = buildLinePath(history, (bucket) => bucket.active, maximum, plotWidth);
  const downPath = buildLinePath(history, (bucket) => bucket.offline, maximum, plotWidth);
  const selectedX = CHART_PLOT_LEFT + (inspectionIndex / Math.max(1, history.length - 1)) * plotWidth;
  const selectedUpY = 186 - (selected.active / maximum) * 160;
  const labelStep = Math.max(1, Math.ceil(history.length / 5));
  const handleChartPointer = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const plotLeftPx = (CHART_PLOT_LEFT / viewBoxWidth) * rect.width;
    const plotWidthPx = (plotWidth / viewBoxWidth) * rect.width;
    const ratio = clamp((event.clientX - rect.left - plotLeftPx) / Math.max(plotWidthPx, 1), 0, 1);
    setHoveredIndex(Math.round(ratio * (history.length - 1)));
  };
  return (
    <section className="react-table-report-panel" aria-labelledby="zq-trend-title">
      <div className="zq-report-header">
        <h2 id="zq-trend-title">Device status over time</h2>
        <div className="zq-chart-legend"><span><i className="is-up" />Up</span><span><i className="is-down" />Down</span><span><i className="is-availability" />Availability</span></div>
      </div>
      <div className="zq-chart-canvas">
        <div ref={frameRef} className="zq-chart-frame" onPointerMove={handleChartPointer} onPointerDown={handleChartPointer} onPointerLeave={() => setHoveredIndex(null)}>
          <svg key={`${rangeKey}:${history[0]?.timestamp}:${visualBucketCount}`} viewBox={`0 0 ${viewBoxWidth} ${CHART_VIEWBOX_HEIGHT}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Stacked device status histogram and trend lines">
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => <g key={ratio}><line className="zq-chart-gridline" x1={CHART_PLOT_LEFT} x2={CHART_PLOT_LEFT + plotWidth} y1={26 + ratio * 160} y2={26 + ratio * 160} /><text className="zq-chart-y-label" x={CHART_PLOT_LEFT - 10} y={30 + ratio * 160} textAnchor="end">{Math.round(maximum * (1 - ratio))}</text></g>)}
            {history.map((bucket, index) => {
              const slot = plotWidth / history.length;
              const width = Math.max(5, slot * 0.44);
              const upHeight = (bucket.active / maximum) * 160;
              const downHeight = (bucket.offline / maximum) * 160;
              const x = CHART_PLOT_LEFT + (index / Math.max(1, history.length - 1)) * plotWidth - width / 2;
              return <g className="zq-histogram-column" key={bucket.timestamp} style={{ "--bar-index": index }}><rect className="zq-histogram-up" x={x} y={186 - upHeight} width={width} height={upHeight} rx="1.5" /><rect className="zq-histogram-down" x={x} y={186 - upHeight - downHeight} width={width} height={downHeight} rx="1.5" />{(index % labelStep === 0 || index === history.length - 1) && <text className="zq-chart-x-label" x={x + width / 2} y="210" textAnchor="middle">{formatBucketLabel(bucket.timestamp, rangeKey, false, rangeDurationMs)}</text>}</g>;
            })}
            <path className="zq-line zq-line-up" d={upPath} pathLength="1" />
            <path className="zq-line zq-line-down" d={downPath} pathLength="1" />
            {hoveredIndex !== null && <><line className="zq-chart-cursor" x1={selectedX} x2={selectedX} y1="20" y2="188" /><circle className="zq-chart-point" cx={selectedX} cy={selectedUpY} r="4" /></>}
          </svg>
          {hoveredIndex !== null && <div className="zq-chart-tooltip" style={{ left: `${clamp((selectedX / viewBoxWidth) * 100, 10, 90)}%` }}>
            <strong>{formatBucketLabel(selected.timestamp, rangeKey, true, rangeDurationMs)}</strong><span><i className="is-up" />{selected.active} up</span><span><i className="is-down" />{selected.offline} down</span><small>{formatPercent(selected.availability)} availability</small>
          </div>}
        </div>
      </div>
    </section>
  );
}

function useDismissablePopover(open, onClose, containerRef, triggerRef, floatingRef = null) {
  React.useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsidePress = (event) => {
      if (!containerRef.current?.contains(event.target) && !floatingRef?.current?.contains(event.target)) onClose();
    };
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [containerRef, floatingRef, onClose, open, triggerRef]);
}

function SelectControl({ ariaLabel, compact = false, disabled = false, onChange, options, value }) {
  const containerRef = React.useRef(null);
  const triggerRef = React.useRef(null);
  const optionRefs = React.useRef([]);
  const listboxId = React.useId();
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);
  const selectedIndex = Math.max(0, options.findIndex((option) => String(option.value) === String(value)));
  const selectedOption = options[selectedIndex] || options[0];

  useDismissablePopover(open, close, containerRef, triggerRef);

  React.useEffect(() => {
    if (!open) return undefined;
    const frame = window.requestAnimationFrame(() => optionRefs.current[selectedIndex]?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open, selectedIndex]);

  const selectOption = (nextValue) => {
    onChange(nextValue);
    close();
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };
  const handleTriggerKeyDown = (event) => {
    if (!["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) return;
    event.preventDefault();
    setOpen(true);
  };
  const handleOptionKeyDown = (event, index) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectOption(options[index].value);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      optionRefs.current[(index + direction + options.length) % options.length]?.focus();
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      optionRefs.current[event.key === "Home" ? 0 : options.length - 1]?.focus();
    }
  };

  return (
    <div ref={containerRef} className={`zq-select-control ${compact ? "is-compact" : ""} ${open ? "is-open" : ""}`} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) close(); }}>
      <button ref={triggerRef} className="zq-select-trigger" type="button" role="combobox" aria-label={ariaLabel} aria-expanded={open} aria-controls={listboxId} aria-haspopup="listbox" disabled={disabled} onClick={() => setOpen((current) => !current)} onKeyDown={handleTriggerKeyDown}>
        <span>{selectedOption?.label ?? value}</span><Icon name="chevronDown" size={14} />
      </button>
      {open && (
        <div id={listboxId} className="zq-select-popover" role="listbox" aria-label={ariaLabel}>
          {options.map((option, index) => {
            const selected = String(option.value) === String(value);
            return <button ref={(node) => { optionRefs.current[index] = node; }} className={selected ? "is-selected" : ""} key={option.value} type="button" role="option" aria-selected={selected} onClick={() => selectOption(option.value)} onKeyDown={(event) => handleOptionKeyDown(event, index)}><span>{option.label}</span>{selected && <Icon name="check" size={14} strokeWidth={2.2} />}</button>;
          })}
        </div>
      )}
    </div>
  );
}

function FilterSelect({ label, options, selected, toggle }) {
  const detailsRef = React.useRef(null);

  React.useEffect(() => {
    const closeOnOutsidePress = (event) => {
      if (detailsRef.current?.open && !detailsRef.current.contains(event.target)) detailsRef.current.removeAttribute("open");
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && detailsRef.current?.open) {
        detailsRef.current.removeAttribute("open");
        detailsRef.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <div className="zq-filter-field">
      <span>{label}</span>
      <details ref={detailsRef} className={`zq-filter-select ${selected.length ? "has-value" : ""}`} name="hierarchy-filter-select">
        <summary>{selected.length ? `${selected.length} seleccionado${selected.length === 1 ? "" : "s"}` : "Haz clic para ver opciones"}<Icon name="chevronDown" size={13} /></summary>
        <div className="zq-filter-menu">
          {options.map((option) => (
            <label key={option.value}><input type="checkbox" checked={selected.includes(option.value)} onChange={() => toggle(option.value)} /><span>{option.label || option.value}</span>{option.count !== undefined && <small>{option.count}</small>}</label>
          ))}
        </div>
      </details>
    </div>
  );
}

function HourMinuteSelector({ ariaLabel, hidden = false, invalid, onChange, onEditingChange, value }) {
  const [valueHour = "", valueMinute = ""] = (value || "").split(":");
  const [editing, setEditing] = React.useState(false);
  const [instantMotion, setInstantMotion] = React.useState(false);
  const [draftHour, setDraftHour] = React.useState(valueHour);
  const [draftMinute, setDraftMinute] = React.useState(valueMinute);
  const hourInputRef = React.useRef(null);

  React.useEffect(() => {
    if (!editing) {
      setDraftHour(valueHour);
      setDraftMinute(valueMinute);
    }
  }, [editing, valueHour, valueMinute]);

  React.useEffect(() => {
    if (editing) hourInputRef.current?.select();
  }, [editing]);

  const beginEditing = (event) => {
    setInstantMotion(event.detail === 0);
    setDraftHour(valueHour);
    setDraftMinute(valueMinute);
    setEditing(true);
    onEditingChange(true);
  };

  const cancelEditing = () => {
    setInstantMotion(true);
    setDraftHour(valueHour);
    setDraftMinute(valueMinute);
    setEditing(false);
    onEditingChange(false);
  };

  const commit = (useInstantMotion = false) => {
    const parsedHour = Number.parseInt(draftHour, 10);
    const parsedMinute = Number.parseInt(draftMinute, 10);
    const nextHour = clamp(Number.isFinite(parsedHour) ? parsedHour : 0, 0, 23);
    const nextMinute = clamp(Number.isFinite(parsedMinute) ? parsedMinute : 0, 0, 59);
    const nextValue = `${String(nextHour).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}`;

    setInstantMotion(useInstantMotion);
    setDraftHour(String(nextHour).padStart(2, "0"));
    setDraftMinute(String(nextMinute).padStart(2, "0"));
    setEditing(false);
    onEditingChange(false);
    if (nextValue !== value) onChange(nextValue);
  };

  const handleInputKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit(true);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEditing();
    }
  };

  const updateNumber = (setter) => (event) => setter(event.target.value.replace(/\D/g, "").slice(0, 2));

  return (
    <div
      className={`zq-time-selector ${editing ? "is-editing" : ""} ${hidden ? "is-obscured" : ""} ${instantMotion ? "is-instant" : ""}`}
      role="group"
      aria-label={ariaLabel}
      aria-hidden={hidden || undefined}
      onBlur={(event) => {
        if (editing && !event.currentTarget.contains(event.relatedTarget)) commit(false);
      }}
    >
      <div className="zq-time-blob zq-time-hour">
        {editing ? (
          <input ref={hourInputRef} type="text" inputMode="numeric" pattern="[0-9]*" maxLength="2" value={draftHour} onChange={updateNumber(setDraftHour)} onKeyDown={handleInputKeyDown} aria-label={`${ariaLabel}, horas`} aria-invalid={invalid} />
        ) : <strong>{valueHour || "--"}</strong>}
        <span>Hr.</span>
      </div>
      <div className="zq-time-blob zq-time-minute">
        {editing ? (
          <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength="2" value={draftMinute} onChange={updateNumber(setDraftMinute)} onKeyDown={handleInputKeyDown} aria-label={`${ariaLabel}, minutos`} aria-invalid={invalid} />
        ) : <strong>{valueMinute || "--"}</strong>}
        <span>Min.</span>
      </div>
      <button className="zq-time-blob zq-time-action" type="button" onClick={editing ? (event) => commit(event.detail === 0) : beginEditing} aria-label={editing ? `Confirmar ${ariaLabel}` : `Editar ${ariaLabel}`}>
        <Icon name={editing ? "check" : "pencil"} size={editing ? 17 : 15} strokeWidth={editing ? 2.5 : 1.9} />
      </button>
    </div>
  );
}

const CALENDAR_WEEKDAYS = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];

const parseDateControlValue = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
};

const startOfCalendarMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

function DateSelector({ align = "start", ariaLabel, invalid, max, min, onChange, value }) {
  const containerRef = React.useRef(null);
  const triggerRef = React.useRef(null);
  const popoverRef = React.useRef(null);
  const [open, setOpen] = React.useState(false);
  const [popoverPosition, setPopoverPosition] = React.useState({ left: 0, placement: "bottom", ready: false, top: 0 });
  const selectedDate = parseDateControlValue(value);
  const minimumDate = parseDateControlValue(min);
  const maximumDate = parseDateControlValue(max);
  const fallbackDate = selectedDate || maximumDate || new Date();
  const [visibleMonth, setVisibleMonth] = React.useState(() => startOfCalendarMonth(fallbackDate));
  const close = React.useCallback(() => setOpen(false), []);

  useDismissablePopover(open, close, containerRef, triggerRef, popoverRef);

  const updatePopoverPosition = React.useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const popoverWidth = popoverRef.current?.offsetWidth || 286;
    const popoverHeight = popoverRef.current?.offsetHeight || 306;
    const viewportPadding = 10;
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const placement = spaceBelow < popoverHeight && rect.top - viewportPadding > popoverHeight ? "top" : "bottom";
    const desiredLeft = align === "end" ? rect.right - popoverWidth : rect.left;
    const left = clamp(desiredLeft, viewportPadding, window.innerWidth - popoverWidth - viewportPadding);
    const top = placement === "top" ? rect.top - popoverHeight - 8 : rect.bottom + 8;
    setPopoverPosition({ left, placement, ready: true, top: clamp(top, viewportPadding, window.innerHeight - popoverHeight - viewportPadding) });
  }, [align]);

  React.useLayoutEffect(() => {
    if (!open) return undefined;
    updatePopoverPosition();
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);
    return () => {
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [open, updatePopoverPosition, visibleMonth]);

  const openCalendar = () => {
    setVisibleMonth(startOfCalendarMonth(selectedDate || maximumDate || new Date()));
    setPopoverPosition((current) => ({ ...current, ready: false }));
    setOpen((current) => !current);
  };
  const firstDay = startOfCalendarMonth(visibleMonth);
  const gridStart = new Date(firstDay.getFullYear(), firstDay.getMonth(), 1 - firstDay.getDay());
  const daysInVisibleMonth = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0).getDate();
  const calendarCellCount = firstDay.getDay() + daysInVisibleMonth > 35 ? 42 : 35;
  const calendarDays = Array.from({ length: calendarCellCount }, (_, index) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index));
  const minimumTime = minimumDate?.getTime() ?? Number.NEGATIVE_INFINITY;
  const maximumTime = maximumDate?.getTime() ?? Number.POSITIVE_INFINITY;
  const todayValue = toDateInputValue(PREVIEW_RENDERED_AT);
  const canNavigateTo = (offset) => {
    const targetStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + offset, 1);
    const targetEnd = new Date(targetStart.getFullYear(), targetStart.getMonth() + 1, 0);
    return targetEnd.getTime() >= minimumTime && targetStart.getTime() <= maximumTime;
  };
  const selectDate = (dateValue) => {
    onChange(dateValue);
    close();
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <div ref={containerRef} className={`zq-date-selector is-align-${align} ${open ? "is-open" : ""}`} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget) && !popoverRef.current?.contains(event.relatedTarget)) close(); }}>
      <button ref={triggerRef} className="zq-date-trigger" type="button" aria-label={ariaLabel} aria-haspopup="dialog" aria-expanded={open} aria-invalid={invalid} onClick={openCalendar}>
        <span>{selectedDate ? selectedDate.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }) : "Seleccionar fecha"}</span><Icon name="calendar" size={15} strokeWidth={1.8} />
      </button>
      {open && createPortal(
        <div ref={popoverRef} className={`zq-date-popover opens-${popoverPosition.placement}`} style={{ left: popoverPosition.left, opacity: popoverPosition.ready ? undefined : 0, top: popoverPosition.top }} role="dialog" aria-label={`Calendario para ${ariaLabel}`}>
          <div className="zq-calendar-header">
            <strong>{visibleMonth.toLocaleDateString("es-MX", { month: "long", year: "numeric" })}</strong>
            <div>
              <button type="button" aria-label="Mes anterior" disabled={!canNavigateTo(-1)} onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}><Icon name="chevronLeft" size={16} /></button>
              <button type="button" aria-label="Mes siguiente" disabled={!canNavigateTo(1)} onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}><Icon name="chevronRight" size={16} /></button>
            </div>
          </div>
          <div className="zq-calendar-weekdays" aria-hidden="true">{CALENDAR_WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
          <div className="zq-calendar-grid" role="grid">
            {calendarDays.map((day) => {
              const dateValue = toDateInputValue(day.getTime());
              const disabled = day.getTime() < minimumTime || day.getTime() > maximumTime;
              const selected = dateValue === value;
              const outside = day.getMonth() !== visibleMonth.getMonth();
              return <button className={`${selected ? "is-selected" : ""} ${outside ? "is-outside" : ""}`} key={dateValue} type="button" role="gridcell" aria-label={day.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} aria-selected={selected} aria-current={dateValue === todayValue ? "date" : undefined} disabled={disabled} onClick={() => selectDate(dateValue)}>{day.getDate()}</button>;
            })}
          </div>
          {todayValue >= min && todayValue <= max && <button className="zq-calendar-today" type="button" onClick={() => selectDate(todayValue)}>Hoy</button>}
        </div>,
        document.body,
      )}
    </div>
  );
}

function DateTimeRangeFilter({ error, maxDate, minDate, onChange, value }) {
  const [activeTimeField, setActiveTimeField] = React.useState(null);
  const update = (field) => (nextValue) => onChange({ ...value, [field]: nextValue });
  const updateTime = (field) => (nextValue) => onChange({ ...value, [field]: nextValue });
  return (
    <div className={`zq-datetime-range ${error ? "is-invalid" : ""} ${activeTimeField ? "is-time-editing" : ""}`}>
      <span className="zq-datetime-range-title">Interval</span>
      <div className="zq-datetime-range-fields">
        <div className="zq-datetime-range-endpoint">
          <span>Desde</span>
          <DateSelector align="start" ariaLabel="Fecha inicial" invalid={Boolean(error)} value={value.startDate} min={minDate} max={value.endDate || maxDate} onChange={update("startDate")} />
          <HourMinuteSelector ariaLabel="hora inicial" hidden={Boolean(activeTimeField && activeTimeField !== "start")} invalid={Boolean(error)} value={value.startTime} onChange={updateTime("startTime")} onEditingChange={(isEditing) => setActiveTimeField(isEditing ? "start" : null)} />
        </div>
        <span className="zq-datetime-range-arrow" aria-hidden="true"><Icon name="chevronRight" size={14} /></span>
        <div className="zq-datetime-range-endpoint">
          <span>Hasta</span>
          <DateSelector align="end" ariaLabel="Fecha final" invalid={Boolean(error)} value={value.endDate} min={value.startDate || minDate} max={maxDate} onChange={update("endDate")} />
          <HourMinuteSelector ariaLabel="hora final" hidden={Boolean(activeTimeField && activeTimeField !== "end")} invalid={Boolean(error)} value={value.endTime} onChange={updateTime("endTime")} onEditingChange={(isEditing) => setActiveTimeField(isEditing ? "end" : null)} />
        </div>
      </div>
      <small className={`zq-datetime-range-help ${error ? "is-error" : ""}`} role={error ? "alert" : undefined}>{error || "Histórico disponible: último año"}</small>
    </div>
  );
}

const variationDistribution = [6, 8, 10, 13, 17, 22, 28, 33, 37, 40, 41, 39, 36, 31, 26, 21, 17, 13, 10, 8, 7, 6];

function VariationThresholdFilter({ onChange, value }) {
  const inputId = React.useId();
  const activePointer = React.useRef(null);
  const position = `${(value / 99) * 100}%`;

  const updateFromPointer = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
    onChange(Math.round(ratio * 99));
  };

  const handlePointerDown = (event) => {
    if (activePointer.current !== null) return;
    activePointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPointer(event);
  };

  const handlePointerMove = (event) => {
    if (activePointer.current === event.pointerId) updateFromPointer(event);
  };

  const finishPointer = (event) => {
    if (activePointer.current !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    activePointer.current = null;
  };

  const handleKeyDown = (event) => {
    const keyValues = { ArrowLeft: value - 1, ArrowDown: value - 1, ArrowRight: value + 1, ArrowUp: value + 1, Home: 0, End: 99, PageDown: value - 10, PageUp: value + 10 };
    if (!(event.key in keyValues)) return;
    event.preventDefault();
    onChange(clamp(keyValues[event.key], 0, 99));
  };

  return (
    <div className="zq-filter-field zq-variation-filter" style={{ "--variation-position": position }}>
      <div className="zq-variation-distribution" aria-hidden="true">
        {variationDistribution.map((height, index) => {
          const bucketValue = (index / Math.max(1, variationDistribution.length - 1)) * 99;
          const isBelowThreshold = bucketValue < value;
          const scale = (1 - (value / 99) * 0.25) * (isBelowThreshold ? 0.28 : 1);
          return <i key={`${height}:${index}`} style={{ height, opacity: isBelowThreshold ? 0.32 : 1, transform: `scaleY(${scale})` }} />;
        })}
      </div>
      <div className="zq-variation-slider">
        <input id={inputId} className="zq-variation-input" type="range" min="0" max="99" step="1" value={value} onChange={(event) => onChange(Number(event.target.value))} onKeyDown={handleKeyDown} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={finishPointer} onPointerCancel={finishPointer} aria-label="Minimum variation percentage" aria-valuetext={`${value} percent or more`} />
        <div className="zq-variation-track" aria-hidden="true"><i /></div>
        <span className="zq-variation-thumb" aria-hidden="true"><Icon name="chevronsHorizontal" size={14} strokeWidth={2.1} /></span>
      </div>
      <div className="zq-variation-meta">
        <label htmlFor={inputId}><strong>Variation percentage</strong><small>Minimum absolute change</small></label>
        <output htmlFor={inputId}>{value}%+</output>
      </div>
    </div>
  );
}

function FilterSidebar({
  appliedCount,
  applyState,
  classOptions,
  close,
  dirty,
  dateRange,
  dateRangeError,
  draftCount,
  filters,
  onApply,
  maxDate,
  minDate,
  pageSize,
  reset,
  setPageSize,
  setDateRange,
  statusOptions,
  toggle,
  updateMinVariation,
}) {
  const isApplying = applyState === "applying";
  const buttonLabel = isApplying ? "Aplicando…" : applyState === "applied" ? "Aplicado" : dirty ? (draftCount ? `Proceder · ${draftCount}` : "Proceder") : "Sin cambios";
  return (
    <aside className="filter-sidebar" aria-label="Table filters">
      <div className="zq-filter-card">
        <header className="zq-filter-header"><div><span>{appliedCount} {appliedCount === 1 ? "filtro activo" : "filtros activos"}</span><strong>FILTRO</strong></div><button type="button" onClick={close} aria-label="Close filters"><Icon name="x" size={17} /></button></header>
        <div className="zq-filter-body">
          <button className={`zq-btn zq-btn-soft-success zq-proceed is-${applyState} ${dirty ? "is-dirty" : ""}`} type="button" onClick={onApply} disabled={!dirty || isApplying || Boolean(dateRangeError)} aria-live="polite">{isApplying ? <i className="zq-spinner" /> : <Icon name="check" size={16} />}{buttonLabel}</button>
          <div className={`zq-filter-draft-state ${dateRangeError ? "is-invalid" : dirty ? "is-dirty" : "is-synced"}`}><i />{dateRangeError || (dirty ? "Cambios sin aplicar" : "Filtros sincronizados con la tabla")}</div>
          <fieldset className="zq-filter-controls" disabled={isApplying}>
            <section className="zq-active-filters"><header><span>FILTROS ACTIVOS</span>{draftCount > 0 && <button type="button" onClick={reset}>Limpiar borrador</button>}</header><DateTimeRangeFilter error={dateRangeError} maxDate={maxDate} minDate={minDate} onChange={setDateRange} value={dateRange} /></section>
            <div className="zq-filter-field"><span>Logs por página</span><SelectControl ariaLabel="Logs por página" value={pageSize} onChange={(nextValue) => setPageSize(Number(nextValue))} options={[10, 25, 50].map((option) => ({ value: option, label: String(option) }))} /></div>
            <FilterSelect label="Clase de dispositivo" options={classOptions} selected={filters.classes} toggle={(value) => toggle("classes", value)} />
            <FilterSelect label="Estado del dispositivo" options={statusOptions} selected={filters.statuses} toggle={(value) => toggle("statuses", value)} />
            <VariationThresholdFilter value={filters.minVariation} onChange={updateMinVariation} />
            <label className="zq-filter-field"><span>Organización</span><div className="zq-readonly-filter">Zequenze Demo</div></label>
            <label className="zq-filter-field"><span>Sub-organizaciones</span><div className="zq-readonly-filter">Todas</div></label>
          </fieldset>
        </div>
      </div>
    </aside>
  );
}

function StatusDistribution({ row }) {
  const total = Math.max(1, row.total);
  const upPercent = (row.active / total) * 100;
  const downPercent = (row.offline / total) * 100;
  return (
    <div className="zq-status-cell" aria-label={`${row.active} up, ${row.offline} down`}>
      <div className="zq-status-progress"><span className="is-up" style={{ width: `${upPercent}%` }}>{upPercent >= 25 && `${Math.round(upPercent)}%`}</span><span className="is-down" style={{ width: `${downPercent}%` }}>{downPercent >= 25 && `${Math.round(downPercent)}%`}</span></div>
      <small><span><i className="is-up" />{row.active} up</span><span><i className="is-down" />{row.offline} down</span></small>
    </div>
  );
}

function SortButton({ active, direction, label, onClick }) {
  return <button className={`zq-sort ${active ? "is-active" : ""}`} type="button" onClick={onClick}>{label}<span>{active ? (direction === "asc" ? "↑" : "↓") : "↕"}</span></button>;
}

function DataTablePagination({ page, pageCount, pageSize, rowsLength, setPage }) {
  const first = rowsLength ? page * pageSize + 1 : 0;
  const last = Math.min(rowsLength, (page + 1) * pageSize);
  return (
    <footer className="react-table-pagination"><span>Mostrando {first} a {last} de {rowsLength} registros</span><div><button type="button" onClick={() => setPage(0)} disabled={page === 0}>«</button><button type="button" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0}><Icon name="chevronLeft" size={14} /></button><span>{page + 1}</span><button type="button" onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} disabled={page >= pageCount - 1}><Icon name="chevronRight" size={14} /></button><button type="button" onClick={() => setPage(pageCount - 1)} disabled={page >= pageCount - 1}>»</button></div></footer>
  );
}

function ResultsTable({ currentLevel, drillDown, isSearchMode, navigateToDevice, now, page, pageSize, rows, setPage, sort, toggleSort }) {
  const [selectedRows, setSelectedRows] = React.useState([]);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = rows.slice(page * pageSize, page * pageSize + pageSize);
  const canDrill = !isSearchMode && currentLevel.key !== "device";
  const allSelected = pageRows.length > 0 && pageRows.every((row) => selectedRows.includes(row.id));
  const toggleAll = () => setSelectedRows((current) => allSelected ? current.filter((id) => !pageRows.some((row) => row.id === id)) : Array.from(new Set([...current, ...pageRows.map((row) => row.id)])));
  const toggleRow = (id) => setSelectedRows((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  return (
    <>
      <section className="react-table-surface" aria-label="Hierarchy results">
        <div className="react-table-scroll">
          <table>
            <thead className="react-table-header"><tr><th className="zq-check-column"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all rows" /></th><th><SortButton label={isSearchMode ? "Dispositivo" : currentLevel.label} active={sort.key === "name"} direction={sort.direction} onClick={() => toggleSort("name")} /></th><th><SortButton label="Dispositivos activos" active={sort.key === "active"} direction={sort.direction} onClick={() => toggleSort("active")} /></th><th><SortButton label="Status variation" active={sort.key === "trend"} direction={sort.direction} onClick={() => toggleSort("trend")} /></th><th><SortButton label="Variation %" active={sort.key === "variationPercentage"} direction={sort.direction} onClick={() => toggleSort("variationPercentage")} /></th><th><SortButton label="Estado del dispositivo" active={sort.key === "availability"} direction={sort.direction} onClick={() => toggleSort("availability")} /></th><th><SortButton label="Latest" active={sort.key === "latestMinutes"} direction={sort.direction} onClick={() => toggleSort("latestMinutes")} /></th></tr></thead>
            <tbody>
              {pageRows.map((row, rowIndex) => {
                const direction = row.trend > 0 ? "up" : row.trend < 0 ? "down" : "flat";
                return <tr key={row.id} style={{ "--row-index": rowIndex }}><td className="zq-check-column"><input type="checkbox" checked={selectedRows.includes(row.id)} onChange={() => toggleRow(row.id)} aria-label={`Select ${row.name}`} /></td><td className="zq-row-name-cell"><div className="zq-name-cell">{canDrill || isSearchMode ? <button className="zq-hierarchy-button" type="button" onClick={() => isSearchMode ? navigateToDevice(row.device) : drillDown(row)}>{row.name}<Icon name="chevronRight" size={13} /></button> : <strong>{row.name}</strong>}{row.subtitle && <small>{row.subtitle}</small>}</div></td><td className="zq-active-cell" data-label="Activos"><span className="zq-count-badge">{row.active}</span></td><td className="zq-trend-cell" data-label="Cambio"><span className={`zq-variation-badge is-${direction}`}>{row.trend > 0 ? "▲" : row.trend < 0 ? "▼" : "–"} {Math.abs(row.trend)}</span></td><td className="zq-variation-cell" data-label="Variación"><span className={`zq-variation-badge is-${direction}`}>{row.trend > 0 ? "▲" : row.trend < 0 ? "▼" : "–"} {formatPercent(Math.abs(row.variationPercentage), 2)}</span></td><td className="zq-device-state-cell"><StatusDistribution row={row} /></td><td className="zq-latest-cell" data-label="Último registro">{formatLatest(row.latestMinutes, now)}</td></tr>;
              })}
            </tbody>
          </table>
          {!pageRows.length && <div className="zq-empty"><span><Icon name="search" size={22} /></span><strong>No hay resultados</strong><p>Prueba con una búsqueda más amplia o limpia los filtros.</p></div>}
        </div>
      </section>
      <DataTablePagination page={page} pageCount={pageCount} pageSize={pageSize} rowsLength={rows.length} setPage={setPage} />
    </>
  );
}

const getContextDevices = (devices, breadcrumbs) => breadcrumbs.reduce((result, crumb) => result.filter((device) => String(device[crumb.field]) === String(crumb.value)), devices);
const getOptions = (devices, field) => Array.from(new Set(devices.map((device) => device[field]))).sort((left, right) => String(left).localeCompare(String(right))).map((value) => ({ value, count: devices.filter((device) => device[field] === value).length }));

const aggregateRows = ({ devices, currentLevel, currentStatus, previousStatus }) => {
  if (currentLevel.key === "device") {
    return devices.map((device) => {
      const status = currentStatus(device);
      const previous = previousStatus(device);
      const active = status === "offline" ? 0 : 1;
      const previousActive = previous === "offline" ? 0 : 1;
      const counts = { healthy: status === "healthy" ? 1 : 0, warning: status === "warning" ? 1 : 0, offline: status === "offline" ? 1 : 0, total: 1 };
      return { ...counts, id: device.id, name: device.name, subtitle: `${device.profile} · v${device.firmware}`, groupValue: device.id, active, trend: active - previousActive, variationPercentage: previousActive ? ((active - previousActive) / previousActive) * 100 : active ? 100 : 0, availability: getAvailability(counts), latestMinutes: device.lastSeenMinutes, device };
    });
  }
  const groups = new Map();
  devices.forEach((device) => { const value = device[currentLevel.field]; if (!groups.has(value)) groups.set(value, []); groups.get(value).push(device); });
  return Array.from(groups.entries()).map(([value, groupDevices]) => {
    const counts = { healthy: 0, warning: 0, offline: 0, total: groupDevices.length };
    let previousActive = 0;
    groupDevices.forEach((device) => { counts[currentStatus(device)] += 1; if (previousStatus(device) !== "offline") previousActive += 1; });
    const active = counts.healthy + counts.warning;
    const trend = active - previousActive;
    const subtitleByLevel = { location: `${groupDevices[0].region} · ${new Set(groupDevices.map((device) => device.deviceClass)).size} clases`, deviceClass: `${new Set(groupDevices.map((device) => device.profile)).size} perfiles`, profile: `${groupDevices[0].deviceClass} · ${groupDevices.length} dispositivos` };
    return { ...counts, id: `${currentLevel.key}:${value}`, name: value, subtitle: subtitleByLevel[currentLevel.key], groupValue: value, active, trend, variationPercentage: previousActive ? (trend / previousActive) * 100 : active ? 100 : 0, availability: getAvailability(counts), latestMinutes: Math.min(...groupDevices.map((device) => device.lastSeenMinutes)) };
  });
};

const initialFilters = { statuses: [], classes: [], minVariation: 0 };

export function HierarchyExplorer({ devices = demoDevices }) {
  const nowRef = React.useRef(Date.now());
  const [breadcrumbs, setBreadcrumbs] = React.useState([]);
  const [filters, setFilters] = React.useState(initialFilters);
  const [draftFilters, setDraftFilters] = React.useState(initialFilters);
  const [filterApplyState, setFilterApplyState] = React.useState("idle");
  const [filtersOpen, setFiltersOpen] = React.useState(() => typeof window === "undefined" || window.innerWidth > 980);
  const [histogramOpen, setHistogramOpen] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [rangeKey, setRangeKey] = React.useState("24h");
  const [rangeDurationMs, setRangeDurationMs] = React.useState(RANGE_CONFIG["24h"].durationMs);
  const [rangeUnit, setRangeUnit] = React.useState("hour");
  const [draftDateRange, setDraftDateRange] = React.useState(() => createDateRangeValue(nowRef.current - RANGE_CONFIG["24h"].durationMs, nowRef.current));
  const [historyAnchor, setHistoryAnchor] = React.useState(nowRef.current);
  const [navigationDirection, setNavigationDirection] = React.useState("forward");
  const [sort, setSort] = React.useState({ key: "name", direction: "asc" });
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(10);
  const [draftPageSize, setDraftPageSize] = React.useState(10);
  const searchInputRef = React.useRef(null);
  const filterApplyTimerRef = React.useRef(null);
  const filterAppliedTimerRef = React.useRef(null);

  React.useEffect(() => {
    const focusSearch = (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchInputRef.current?.focus(); } };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  React.useEffect(() => () => {
    if (filterApplyTimerRef.current) window.clearTimeout(filterApplyTimerRef.current);
    if (filterAppliedTimerRef.current) window.clearTimeout(filterAppliedTimerRef.current);
  }, []);

  React.useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 980px)");
    const closeFiltersOnCompactLayout = (event) => {
      if (event.matches) setFiltersOpen(false);
    };
    mobileQuery.addEventListener("change", closeFiltersOnCompactLayout);
    return () => mobileQuery.removeEventListener("change", closeFiltersOnCompactLayout);
  }, []);

  const currentLevel = LEVELS[Math.min(breadcrumbs.length, LEVELS.length - 1)];
  const normalizedQuery = query.trim().toLowerCase();
  const isSearchMode = normalizedQuery.length > 0;
  const contextDevices = React.useMemo(() => getContextDevices(devices, breadcrumbs), [breadcrumbs, devices]);
  const searchScopedDevices = React.useMemo(() => {
    const source = isSearchMode ? devices : contextDevices;
    if (!isSearchMode) return source;
    return source.filter((device) => [device.name, device.serial, device.location, device.deviceClass, device.profile, device.firmware, device.organization].some((value) => String(value).toLowerCase().includes(normalizedQuery)));
  }, [contextDevices, devices, isSearchMode, normalizedQuery]);
  const baseFilteredDevices = React.useMemo(() => searchScopedDevices.filter((device) => {
    if (filters.classes.length && !filters.classes.includes(device.deviceClass)) return false;
    return true;
  }), [filters, searchScopedDevices]);
  const history = React.useMemo(() => buildHistory(baseFilteredDevices, rangeKey, historyAnchor, nowRef.current, rangeDurationMs), [baseFilteredDevices, historyAnchor, rangeDurationMs, rangeKey]);
  const rangeStartIndex = 0;
  const rangeEndIndex = Math.max(0, history.length - 1);
  const isLiveAnchor = Math.abs(historyAnchor - nowRef.current) < 60 * 1000;
  const currentStatus = React.useCallback((device) => getHistoricalStatus(device, rangeEndIndex, history.length, rangeKey, isLiveAnchor, history[rangeEndIndex]?.temporalKey), [history, isLiveAnchor, rangeEndIndex, rangeKey]);
  const previousStatus = React.useCallback((device) => getHistoricalStatus(device, rangeStartIndex, history.length, rangeKey, false, history[rangeStartIndex]?.temporalKey), [history, rangeKey, rangeStartIndex]);
  const filteredDevices = React.useMemo(() => baseFilteredDevices.filter((device) => !filters.statuses.length || filters.statuses.includes(currentStatus(device))), [baseFilteredDevices, currentStatus, filters.statuses]);
  const rows = React.useMemo(() => aggregateRows({ devices: filteredDevices, currentLevel: isSearchMode ? LEVELS[LEVELS.length - 1] : currentLevel, currentStatus, previousStatus }), [currentLevel, currentStatus, filteredDevices, isSearchMode, previousStatus]);
  const variationFilteredRows = React.useMemo(() => rows.filter((row) => {
    if (filters.minVariation && Math.abs(row.variationPercentage) < filters.minVariation) return false;
    return true;
  }), [filters.minVariation, rows]);
  const sortedRows = React.useMemo(() => [...variationFilteredRows].sort((left, right) => { const leftValue = left[sort.key]; const rightValue = right[sort.key]; const comparison = typeof leftValue === "string" ? leftValue.localeCompare(rightValue) : Number(leftValue) - Number(rightValue); return sort.direction === "asc" ? comparison : -comparison; }), [variationFilteredRows, sort]);

  React.useEffect(() => { setPage(0); }, [breadcrumbs, filters, historyAnchor, normalizedQuery, pageSize, rangeDurationMs, rangeKey, sort]);

  const activeFilterCount = filters.statuses.length + filters.classes.length + (filters.minVariation > 0 ? 1 : 0);
  const draftActiveFilterCount = draftFilters.statuses.length + draftFilters.classes.length + (draftFilters.minVariation > 0 ? 1 : 0);
  const appliedDateRange = React.useMemo(() => createDateRangeValue(historyAnchor - rangeDurationMs, historyAnchor), [historyAnchor, rangeDurationMs]);
  const draftRangeTimestamps = React.useMemo(() => parseDateRangeValue(draftDateRange), [draftDateRange]);
  const dateRangeError = (() => {
    const { start, end } = draftRangeTimestamps;
    if (!Number.isFinite(start) || !Number.isFinite(end)) return "Completa ambas fechas y horas";
    if (start >= end) return "La fecha inicial debe ser anterior a la final";
    if (end - start < MIN_RANGE_DURATION_MS) return "El intervalo mínimo es de 1 minuto";
    if (start < nowRef.current - FULL_HISTORY_DURATION_MS) return "La fecha inicial supera el año disponible";
    if (end > nowRef.current) return "La fecha final no puede estar en el futuro";
    return "";
  })();
  const filtersDirty = JSON.stringify(filters) !== JSON.stringify(draftFilters) || pageSize !== draftPageSize || JSON.stringify(appliedDateRange) !== JSON.stringify(draftDateRange);
  const classOptions = getOptions(searchScopedDevices, "deviceClass");
  const statusOptions = Object.entries(STATUS_META).map(([value, meta]) => ({ value, label: meta.label, count: baseFilteredDevices.filter((device) => currentStatus(device) === value).length }));
  const markFilterDraftChanged = () => {
    if (filterAppliedTimerRef.current) window.clearTimeout(filterAppliedTimerRef.current);
    setFilterApplyState("idle");
  };
  const toggleFilter = (key, value) => {
    markFilterDraftChanged();
    setDraftFilters((current) => ({ ...current, [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value] }));
  };
  const applyTimelineChange = (nextAnchor, nextRange, nextDuration = getRangeConfig(nextRange, rangeDurationMs).durationMs, nextUnit = rangeUnit) => {
    const duration = clamp(nextDuration, MIN_RANGE_DURATION_MS, FULL_HISTORY_DURATION_MS);
    const earliest = nowRef.current - FULL_HISTORY_DURATION_MS + duration;
    const anchor = clamp(nextAnchor, earliest, nowRef.current);
    setRangeKey(getRangeKeyForDuration(duration));
    setRangeDurationMs(duration);
    setRangeUnit(nextUnit);
    setHistoryAnchor(anchor);
    setDraftDateRange(createDateRangeValue(anchor - duration, anchor));
  };
  const applyFilters = () => {
    if (!filtersDirty || filterApplyState === "applying" || dateRangeError) return;
    const duration = draftRangeTimestamps.end - draftRangeTimestamps.start;
    setFilterApplyState("applying");
    filterApplyTimerRef.current = window.setTimeout(() => {
      setFilters(draftFilters);
      setPageSize(draftPageSize);
      applyTimelineChange(draftRangeTimestamps.end, getRangeKeyForDuration(duration), duration, inferTimeUnit(duration));
      setFilterApplyState("applied");
      if (window.innerWidth <= 980) setFiltersOpen(false);
      filterAppliedTimerRef.current = window.setTimeout(() => setFilterApplyState("idle"), 1100);
    }, 700);
  };
  const resetDraftFilters = () => {
    markFilterDraftChanged();
    setDraftFilters(initialFilters);
  };
  const drillDown = (row) => { if (currentLevel.key === "device") return; setNavigationDirection("forward"); setBreadcrumbs((current) => [...current, { field: currentLevel.field, value: row.groupValue, name: row.name, levelKey: currentLevel.key }]); setQuery(""); };
  const navigateToDevice = (device) => { setNavigationDirection("forward"); setBreadcrumbs([{ field: "location", value: device.location, name: device.location, levelKey: "location" }, { field: "deviceClass", value: device.deviceClass, name: device.deviceClass, levelKey: "deviceClass" }, { field: "profile", value: device.profile, name: device.profile, levelKey: "profile" }]); setQuery(""); };
  const navigateBreadcrumb = (index) => { setNavigationDirection(index < breadcrumbs.length - 1 ? "backward" : "forward"); setBreadcrumbs(index < 0 ? [] : breadcrumbs.slice(0, index + 1)); setQuery(""); };
  const toggleSort = (key) => setSort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }));
  const refresh = () => { const wasLive = Math.abs(historyAnchor - nowRef.current) < 60 * 1000; setRefreshing(true); nowRef.current = Date.now(); if (wasLive) applyTimelineChange(nowRef.current, rangeKey, rangeDurationMs, rangeUnit); window.setTimeout(() => setRefreshing(false), 650); };
  const panelKey = isSearchMode ? "search" : breadcrumbs.map((crumb) => `${crumb.levelKey}:${crumb.value}`).join("/") || "root";

  return (
    <div className="zq-admin-app">
      <main id="zq-main" className="zq-admin-main">
        <div className={`zq-content-layout ${filtersOpen ? "has-filters" : ""}`}>
          <div className={`zq-content-column ${filterApplyState === "applying" ? "is-applying-filters" : ""}`}>
            <DataTableToolbar activeFilterCount={activeFilterCount} filtersDirty={filtersDirty} filtersOpen={filtersOpen} histogramOpen={histogramOpen} onRefresh={refresh} query={query} refreshing={refreshing} searchInputRef={searchInputRef} setFiltersOpen={setFiltersOpen} setHistogramOpen={setHistogramOpen} setQuery={setQuery} />
            <HierarchyBreadcrumb breadcrumbs={breadcrumbs} currentLevel={currentLevel} isSearchMode={isSearchMode} navigate={navigateBreadcrumb} />
            {filterApplyState !== "idle" && <div className={`zq-filter-apply-status is-${filterApplyState}`} role="status">{filterApplyState === "applying" ? <i className="zq-spinner" /> : <Icon name="check" size={15} />}{filterApplyState === "applying" ? "Aplicando filtros…" : "Filtros aplicados"}</div>}
            <div key={panelKey} className={`zq-hierarchy-panel is-${navigationDirection} ${sortedRows.length > 5 ? "has-many-rows" : ""}`} aria-busy={filterApplyState === "applying"}>
              {histogramOpen && <SnapshotMinimap anchorTime={historyAnchor} devices={baseFilteredDevices} liveNow={nowRef.current} onApply={applyTimelineChange} rangeDurationMs={rangeDurationMs} rangeKey={rangeKey} rangeUnit={rangeUnit} />}
              {histogramOpen && <DeviceStatusTrend anchorTime={historyAnchor} devices={baseFilteredDevices} liveNow={nowRef.current} rangeDurationMs={rangeDurationMs} rangeKey={rangeKey} />}
              <ResultsTable currentLevel={currentLevel} drillDown={drillDown} isSearchMode={isSearchMode} navigateToDevice={navigateToDevice} now={nowRef.current} page={page} pageSize={pageSize} rows={sortedRows} setPage={setPage} sort={sort} toggleSort={toggleSort} />
            </div>
          </div>
          {filtersOpen && <><button className="zq-filter-backdrop" type="button" onClick={() => setFiltersOpen(false)} aria-label="Cerrar filtros" /><FilterSidebar appliedCount={activeFilterCount} applyState={filterApplyState} classOptions={classOptions} close={() => setFiltersOpen(false)} dateRange={draftDateRange} dateRangeError={dateRangeError} dirty={filtersDirty} draftCount={draftActiveFilterCount} filters={draftFilters} maxDate={toDateInputValue(nowRef.current)} minDate={toDateInputValue(nowRef.current - FULL_HISTORY_DURATION_MS)} onApply={applyFilters} pageSize={draftPageSize} reset={resetDraftFilters} setDateRange={(value) => { markFilterDraftChanged(); setDraftDateRange(value); }} setPageSize={(value) => { markFilterDraftChanged(); setDraftPageSize(value); }} statusOptions={statusOptions} toggle={toggleFilter} updateMinVariation={(value) => { markFilterDraftChanged(); setDraftFilters((current) => ({ ...current, minVariation: value })); }} /></>}
        </div>
      </main>
      <footer className="zq-admin-footer"><span>2026 © Zequenze.</span><span>Portfolio preview · Hardcoded data</span></footer>
    </div>
  );
}
