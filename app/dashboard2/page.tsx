'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BarChart3, CheckCircle2, Clock3, DollarSign, FileWarning, Receipt, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';


type Obra = {
  id: string;
  n: number;
  designacionYUbicacion: string;
  porcentaje: number;
  contratoMasAmpliaciones: number;
  certificadoALaFecha: number;
  saldoACertificar: number;
  entidadContratante: string;
  plazoTotal: number;
  plazoTransc: number;
};

type SignalItem = {
  signal_key?: string;
  value_num?: unknown;
  value_bool?: unknown;
};

type FindingItem = {
  severity?: 'info' | 'warn' | 'critical' | string;
  status?: 'open' | 'resolved' | string;
};

type MaterialOrderItem = {
  cantidad?: unknown;
  precioUnitario?: unknown;
};

type MaterialOrder = {
  proveedor?: unknown;
  items?: MaterialOrderItem[];
};

type OcrDocument = {
  status?: unknown;
  processing_duration_ms?: unknown;
  retry_count?: unknown;
};

type OcrLink = {
  documents?: OcrDocument[];
};

type DeepObraMetrics = {
  obraId: string;
  materialsSpend: number;
  supplierSpend: Record<string, number>;
  unpaidCount: number;
  unpaidAmount: number;
  inactiveDays: number | null;
  missingCurrentMonth: boolean;
  stageStalledCount: number;
  findingsCritical: number;
  findingsWarn: number;
  findingsInfo: number;
  ocrTotalJobs: number;
  ocrCompleted: number;
  ocrFailed: number;
  ocrJobsWithRetry: number;
  ocrDurationsMs: number[];
};

type ObraRow = {
  obra: Obra;
  timePct: number;
  scheduleVariancePct: number;
  delayPct: number;
  exposureAtRisk: number;
  materialsSpend: number;
};

const currencyFmt = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

const numberFmt = new Intl.NumberFormat('es-AR');

function toNumberLike(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return 0;
    const stripped = raw.replace(/[^\d,.-]/g, '');
    if (!stripped) return 0;
    const lastDot = stripped.lastIndexOf('.');
    const lastComma = stripped.lastIndexOf(',');
    const normalized =
      lastComma > lastDot
        ? stripped.replace(/\./g, '').replace(',', '.')
        : stripped.replace(/,/g, '');
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (['true', '1', 'si', 'yes', 'y'].includes(v)) return true;
  }
  return false;
}

function formatCurrency(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return 'N/A';
  return currencyFmt.format(value);
}

function formatPercent(value: number | null, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return 'N/A';
  return `${value.toFixed(digits)}%`;
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  const safeIdx = Math.max(0, Math.min(sorted.length - 1, idx));
  return sorted[safeIdx] ?? null;
}

async function safeFetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function fetchObras(): Promise<{ obras: Obra[]; isAuthenticated: boolean }> {
  const response = await fetch('/api/obras?orderBy=updated_at&orderDir=desc');

  if (response.status === 401) {
    return { obras: [], isAuthenticated: false };
  }
  if (!response.ok) {
    return { obras: [], isAuthenticated: true };
  }

  const payload = await response.json().catch(() => ({}));
  const obrasRaw = Array.isArray(payload?.detalleObras) ? payload.detalleObras : [];

  const obras: Obra[] = obrasRaw.map((item: Record<string, unknown>) => ({
    id: String(item.id ?? ''),
    n: toNumberLike(item.n),
    designacionYUbicacion: String(item.designacionYUbicacion ?? ''),
    porcentaje: toNumberLike(item.porcentaje),
    contratoMasAmpliaciones: toNumberLike(item.contratoMasAmpliaciones),
    certificadoALaFecha: toNumberLike(item.certificadoALaFecha),
    saldoACertificar: toNumberLike(item.saldoACertificar),
    entidadContratante: String(item.entidadContratante ?? ''),
    plazoTotal: toNumberLike(item.plazoTotal),
    plazoTransc: toNumberLike(item.plazoTransc),
  }));

  return { obras, isAuthenticated: true };
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  if (items.length === 0) return [];
  const concurrency = Math.max(1, Math.min(limit, items.length));
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function runWorker() {
    while (true) {
      const current = cursor;
      cursor += 1;
      if (current >= items.length) break;
      results[current] = await worker(items[current]);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => runWorker()));
  return results;
}

async function fetchDeepMetricForObra(obraId: string): Promise<DeepObraMetrics> {
  const [materialsPayload, signalsPayload, findingsPayload, ocrPayload] = await Promise.all([
    safeFetchJson<{ orders?: MaterialOrder[] }>(`/api/obras/${obraId}/materials`),
    safeFetchJson<{ signals?: SignalItem[] }>(`/api/obras/${obraId}/signals`),
    safeFetchJson<{ findings?: FindingItem[] }>(`/api/obras/${obraId}/findings`),
    safeFetchJson<{ links?: OcrLink[] }>(`/api/obras/${obraId}/tablas/ocr-links?limit=500`),
  ]);

  const orders = Array.isArray(materialsPayload?.orders) ? materialsPayload.orders : [];
  let materialsSpend = 0;
  const supplierSpendMap = new Map<string, number>();

  for (const order of orders) {
    const items = Array.isArray(order.items) ? order.items : [];
    const providerRaw = String(order.proveedor ?? '').trim();
    const provider = providerRaw || 'Sin proveedor';
    let orderTotal = 0;

    for (const item of items) {
      const qty = toNumberLike(item.cantidad);
      const unitPrice = toNumberLike(item.precioUnitario);
      const rowTotal = qty * unitPrice;
      orderTotal += rowTotal;
    }

    materialsSpend += orderTotal;
    supplierSpendMap.set(provider, (supplierSpendMap.get(provider) ?? 0) + orderTotal);
  }

  const signals = Array.isArray(signalsPayload?.signals) ? signalsPayload.signals : [];
  const signalMap = new Map(signals.map((signal) => [String(signal.signal_key ?? ''), signal]));

  const unpaidCount = toNumberLike(signalMap.get('cert.unpaid_over_days_count')?.value_num);
  const unpaidAmount = toNumberLike(signalMap.get('cert.unpaid_over_days_amount')?.value_num);

  const inactiveRaw = signalMap.get('activity.inactive_days')?.value_num;
  const inactiveDays = inactiveRaw == null ? null : toNumberLike(inactiveRaw);

  const missingCurrentMonth = toBoolean(signalMap.get('cert.missing_current_month')?.value_bool);
  const stageStalledCount = toNumberLike(signalMap.get('stage.stalled_count')?.value_num);

  const findings = Array.isArray(findingsPayload?.findings) ? findingsPayload.findings : [];
  const openFindings = findings.filter((finding) => {
    if (!finding.status) return true;
    return String(finding.status).toLowerCase() === 'open';
  });

  const findingsCritical = openFindings.filter((finding) => finding.severity === 'critical').length;
  const findingsWarn = openFindings.filter((finding) => finding.severity === 'warn').length;
  const findingsInfo = openFindings.filter((finding) => finding.severity === 'info').length;

  const links = Array.isArray(ocrPayload?.links) ? ocrPayload.links : [];
  const documents = links.flatMap((link) => (Array.isArray(link.documents) ? link.documents : []));

  let ocrCompleted = 0;
  let ocrFailed = 0;
  let ocrJobsWithRetry = 0;
  const ocrDurationsMs: number[] = [];

  for (const document of documents) {
    const status = String(document.status ?? '').toLowerCase();
    if (status === 'completed') ocrCompleted += 1;
    if (status === 'failed') ocrFailed += 1;

    const retryCount = toNumberLike(document.retry_count);
    if (retryCount > 0) ocrJobsWithRetry += 1;

    const duration = toNumberLike(document.processing_duration_ms);
    if (duration > 0) ocrDurationsMs.push(duration);
  }

  return {
    obraId,
    materialsSpend,
    supplierSpend: Object.fromEntries(supplierSpendMap.entries()),
    unpaidCount,
    unpaidAmount,
    inactiveDays,
    missingCurrentMonth,
    stageStalledCount,
    findingsCritical,
    findingsWarn,
    findingsInfo,
    ocrTotalJobs: documents.length,
    ocrCompleted,
    ocrFailed,
    ocrJobsWithRetry,
    ocrDurationsMs,
  };
}

async function fetchDeepMetrics(obraIds: string[]): Promise<DeepObraMetrics[]> {
  return mapWithConcurrency(obraIds, 6, (obraId) => fetchDeepMetricForObra(obraId));
}

function KpiCard(props: { title: string; value: string; hint?: string; icon: React.ComponentType<{ className?: string }> }) {
  const Icon = props.icon;
  return (
    <Card className='rounded-xl border-stone-200'>
      <CardHeader className='pb-2'>
        <CardDescription className='flex items-center gap-2 text-xs uppercase tracking-wide text-stone-500'>
          <Icon className='h-3.5 w-3.5' />
          {props.title}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className='text-2xl font-semibold text-stone-900'>{props.value}</p>
        {props.hint ? <p className='mt-1 text-xs text-stone-500'>{props.hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export default function Dashboard2Page() {
  const obrasQuery = useQuery({
    queryKey: ['dashboard2-obras'],
    queryFn: fetchObras,
    staleTime: 60_000,
  });

  const obraIds = useMemo(() => obrasQuery.data?.obras.map((obra) => obra.id) ?? [], [obrasQuery.data?.obras]);

  const deepQuery = useQuery({
    queryKey: ['dashboard2-deep', obraIds],
    queryFn: () => fetchDeepMetrics(obraIds),
    enabled: (obrasQuery.data?.isAuthenticated ?? false) && obraIds.length > 0,
    staleTime: 60_000,
  });

  const isAuthenticated = obrasQuery.data?.isAuthenticated ?? true;
  const obras = useMemo(() => obrasQuery.data?.obras ?? [], [obrasQuery.data?.obras]);
  const deepRows = useMemo(() => deepQuery.data ?? [], [deepQuery.data]);

  const model = useMemo(() => {
    const deepByObraId = new Map(deepRows.map((row) => [row.obraId, row]));

    const obraRows: ObraRow[] = obras.map((obra) => {
      const timePct = obra.plazoTotal > 0 ? (obra.plazoTransc / obra.plazoTotal) * 100 : 0;
      const scheduleVariancePct = obra.porcentaje - timePct;
      const delayPct = Math.max(0, timePct - obra.porcentaje);
      const exposureAtRisk = obra.contratoMasAmpliaciones * (delayPct / 100);
      const materialsSpend = deepByObraId.get(obra.id)?.materialsSpend ?? 0;

      return {
        obra,
        timePct,
        scheduleVariancePct,
        delayPct,
        exposureAtRisk,
        materialsSpend,
      };
    });

    const activeRows = obraRows.filter((row) => row.obra.porcentaje < 100);
    const completedRows = obraRows.filter((row) => row.obra.porcentaje >= 100);

    const totalContract = obraRows.reduce((sum, row) => sum + row.obra.contratoMasAmpliaciones, 0);
    const totalCertified = obraRows.reduce((sum, row) => sum + row.obra.certificadoALaFecha, 0);
    const totalPending = obraRows.reduce((sum, row) => sum + row.obra.saldoACertificar, 0);

    const exposureAtRisk = activeRows.reduce((sum, row) => sum + row.exposureAtRisk, 0);
    const delayedObras = activeRows.filter((row) => row.delayPct > 10).length;

    const avgScheduleVariance = activeRows.length > 0
      ? activeRows.reduce((sum, row) => sum + row.scheduleVariancePct, 0) / activeRows.length
      : 0;

    const materialsSpendTotal = deepRows.reduce((sum, row) => sum + row.materialsSpend, 0);
    const grossMarginProxy = totalCertified - materialsSpendTotal;
    const roiMateriales = materialsSpendTotal > 0 ? (grossMarginProxy / materialsSpendTotal) * 100 : null;

    const unpaidCountTotal = deepRows.reduce((sum, row) => sum + row.unpaidCount, 0);
    const unpaidAmountTotal = deepRows.reduce((sum, row) => sum + row.unpaidAmount, 0);

    const inactiveOver90 = deepRows.filter((row) => (row.inactiveDays ?? 0) > 90).length;
    const missingCurrentMonth = deepRows.filter((row) => row.missingCurrentMonth).length;
    const stalledTotal = deepRows.reduce((sum, row) => sum + row.stageStalledCount, 0);

    const findingsCritical = deepRows.reduce((sum, row) => sum + row.findingsCritical, 0);
    const findingsWarn = deepRows.reduce((sum, row) => sum + row.findingsWarn, 0);
    const findingsInfo = deepRows.reduce((sum, row) => sum + row.findingsInfo, 0);

    const ocrTotalJobs = deepRows.reduce((sum, row) => sum + row.ocrTotalJobs, 0);
    const ocrCompleted = deepRows.reduce((sum, row) => sum + row.ocrCompleted, 0);
    const ocrFailed = deepRows.reduce((sum, row) => sum + row.ocrFailed, 0);
    const ocrJobsWithRetry = deepRows.reduce((sum, row) => sum + row.ocrJobsWithRetry, 0);
    const ocrDurationsMs = deepRows.flatMap((row) => row.ocrDurationsMs);

    const ocrSuccessRate = ocrTotalJobs > 0 ? (ocrCompleted / ocrTotalJobs) * 100 : null;
    const ocrRetryRate = ocrTotalJobs > 0 ? (ocrJobsWithRetry / ocrTotalJobs) * 100 : null;
    const ocrP95Ms = percentile(ocrDurationsMs, 95);

    const supplierSpendMap = new Map<string, number>();
    for (const row of deepRows) {
      for (const [supplier, amount] of Object.entries(row.supplierSpend)) {
        supplierSpendMap.set(supplier, (supplierSpendMap.get(supplier) ?? 0) + amount);
      }
    }

    const suppliers = [...supplierSpendMap.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);

    const topSupplierShare =
      suppliers.length > 0 && materialsSpendTotal > 0
        ? (suppliers[0].amount / materialsSpendTotal) * 100
        : null;

    const riskyObras = [...activeRows]
      .filter((row) => row.exposureAtRisk > 0)
      .sort((a, b) => b.exposureAtRisk - a.exposureAtRisk)
      .slice(0, 8);

    return {
      obraRows,
      activeRows,
      completedRows,
      totalContract,
      totalCertified,
      totalPending,
      exposureAtRisk,
      delayedObras,
      avgScheduleVariance,
      materialsSpendTotal,
      grossMarginProxy,
      roiMateriales,
      unpaidCountTotal,
      unpaidAmountTotal,
      inactiveOver90,
      missingCurrentMonth,
      stalledTotal,
      findingsCritical,
      findingsWarn,
      findingsInfo,
      ocrTotalJobs,
      ocrFailed,
      ocrSuccessRate,
      ocrRetryRate,
      ocrP95Ms,
      suppliers,
      topSupplierShare,
      riskyObras,
    };
  }, [obras, deepRows]);

  if (obrasQuery.isLoading) {
    return <div className='p-6 text-sm text-stone-600'>Cargando dashboard...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className='p-6'>
        <Card className='max-w-xl border-stone-200'>
          <CardHeader>
            <CardTitle>Sesion no autenticada</CardTitle>
            <CardDescription>Inicia sesion para ver el dashboard de tenant.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href='/login' className='text-sm font-medium text-blue-700 underline'>
              Ir a login
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isDeepLoading = deepQuery.isLoading || deepQuery.isFetching;

  return (
    <div className='min-h-screen bg-stone-100 p-4 md:p-6'>
      <div className='mx-auto w-full max-w-7xl space-y-6'>
        <div className='space-y-2'>
          <h1 className='text-2xl font-semibold text-stone-900'>Dashboard Tenant v2 (Demo Rapida)</h1>
          <p className='text-sm text-stone-600'>
            Vista de riesgo, rentabilidad parcial y salud operativa consolidada de obras.
          </p>
          <div className='flex flex-wrap items-center gap-2'>
            <Badge variant='secondary' className='border border-stone-300 bg-white text-stone-700'>
              Obras: {numberFmt.format(model.obraRows.length)}
            </Badge>
            <Badge variant='secondary' className='border border-stone-300 bg-white text-stone-700'>
              Activas: {numberFmt.format(model.activeRows.length)}
            </Badge>
            <Badge variant='secondary' className='border border-stone-300 bg-white text-stone-700'>
              Completadas: {numberFmt.format(model.completedRows.length)}
            </Badge>
            {isDeepLoading ? (
              <Badge className='bg-amber-100 text-amber-800'>Actualizando metricas derivadas...</Badge>
            ) : (
              <Badge className='bg-emerald-100 text-emerald-800'>Metricas derivadas listas</Badge>
            )}
          </div>
        </div>

        <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
          <KpiCard
            title='Exposicion En Atraso'
            value={formatCurrency(model.exposureAtRisk)}
            hint='Contrato ponderado por delay de cronograma'
            icon={AlertTriangle}
          />
          <KpiCard
            title='ROI Materiales (Parcial)'
            value={formatPercent(model.roiMateriales, 1)}
            hint='(Certificado - gasto materiales) / gasto materiales'
            icon={DollarSign}
          />
          <KpiCard
            title='Impagos > 90 Dias'
            value={`${numberFmt.format(model.unpaidCountTotal)} | ${formatCurrency(model.unpaidAmountTotal)}`}
            hint='Desde signals de certificados impagos'
            icon={Receipt}
          />
          <KpiCard
            title='Findings Criticos'
            value={numberFmt.format(model.findingsCritical)}
            hint={`Warn: ${numberFmt.format(model.findingsWarn)} | Info: ${numberFmt.format(model.findingsInfo)}`}
            icon={ShieldAlert}
          />
        </div>

        <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
          <KpiCard
            title='Contrato Total'
            value={formatCurrency(model.totalContract)}
            hint='Portfolio del tenant'
            icon={BarChart3}
          />
          <KpiCard
            title='Certificado Total'
            value={formatCurrency(model.totalCertified)}
            hint={`Saldo a certificar: ${formatCurrency(model.totalPending)}`}
            icon={CheckCircle2}
          />
          <KpiCard
            title='Obras Con Delay > 10%'
            value={numberFmt.format(model.delayedObras)}
            hint={`Varianza cronograma promedio: ${formatPercent(model.avgScheduleVariance, 1)}`}
            icon={Clock3}
          />
          <KpiCard
            title='OCR Success Rate'
            value={formatPercent(model.ocrSuccessRate, 1)}
            hint={`Retry rate: ${formatPercent(model.ocrRetryRate, 1)} | P95: ${model.ocrP95Ms ? `${numberFmt.format(Math.round(model.ocrP95Ms))} ms` : 'N/A'}`}
            icon={FileWarning}
          />
        </div>

        <div className='grid gap-4 lg:grid-cols-3'>
          <Card className='rounded-xl border-stone-200 lg:col-span-2'>
            <CardHeader>
              <CardTitle className='text-base'>Top Obras En Riesgo Economico</CardTitle>
              <CardDescription>
                Ranking por exposicion monetaria al atraso (max(0, time% - avance%) * contrato).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {model.riskyObras.length === 0 ? (
                <p className='text-sm text-stone-500'>Sin obras con exposicion de atraso relevante.</p>
              ) : (
                <div className='overflow-x-auto'>
                  <table className='w-full min-w-[760px] text-sm'>
                    <thead>
                      <tr className='border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500'>
                        <th className='pb-2 pr-3'>Obra</th>
                        <th className='pb-2 pr-3'>Avance</th>
                        <th className='pb-2 pr-3'>Tiempo</th>
                        <th className='pb-2 pr-3'>Delay</th>
                        <th className='pb-2 pr-3'>Contrato</th>
                        <th className='pb-2 pr-3'>Exposicion</th>
                        <th className='pb-2 pr-3'>Accion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {model.riskyObras.map((row) => (
                        <tr key={row.obra.id} className='border-b border-stone-100'>
                          <td className='py-2 pr-3'>
                            <div className='max-w-[280px]'>
                              <p className='truncate font-medium text-stone-900'>
                                {row.obra.n}. {row.obra.designacionYUbicacion}
                              </p>
                              <p className='truncate text-xs text-stone-500'>{row.obra.entidadContratante}</p>
                            </div>
                          </td>
                          <td className='py-2 pr-3'>{formatPercent(row.obra.porcentaje, 0)}</td>
                          <td className='py-2 pr-3'>{formatPercent(row.timePct, 0)}</td>
                          <td className='py-2 pr-3'>
                            <span className='font-medium text-amber-700'>{formatPercent(row.delayPct, 1)}</span>
                          </td>
                          <td className='py-2 pr-3'>{formatCurrency(row.obra.contratoMasAmpliaciones)}</td>
                          <td className='py-2 pr-3 font-semibold text-red-700'>{formatCurrency(row.exposureAtRisk)}</td>
                          <td className='py-2 pr-3'>
                            <Link href={`/excel/${row.obra.id}`} className='text-xs font-medium text-blue-700 underline'>
                              Abrir obra
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className='rounded-xl border-stone-200'>
            <CardHeader>
              <CardTitle className='text-base'>Concentracion de Proveedores</CardTitle>
              <CardDescription>
                Gasto de materiales agregado por proveedor.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='rounded-lg border border-stone-200 bg-stone-50 p-3'>
                <p className='text-xs uppercase tracking-wide text-stone-500'>Top proveedor share</p>
                <p className='mt-1 text-xl font-semibold text-stone-900'>{formatPercent(model.topSupplierShare, 1)}</p>
                <p className='text-xs text-stone-500'>sobre {formatCurrency(model.materialsSpendTotal)} de gasto materiales</p>
              </div>

              {model.suppliers.length === 0 ? (
                <p className='text-sm text-stone-500'>No hay ordenes de compra para calcular concentracion.</p>
              ) : (
                <div className='space-y-2'>
                  {model.suppliers.slice(0, 6).map((supplier) => {
                    const ratio = model.materialsSpendTotal > 0 ? (supplier.amount / model.materialsSpendTotal) * 100 : 0;
                    return (
                      <div key={supplier.name} className='rounded-lg border border-stone-200 p-2'>
                        <div className='mb-1 flex items-center justify-between gap-2 text-xs'>
                          <span className='truncate text-stone-700'>{supplier.name}</span>
                          <span className='font-medium text-stone-900'>{formatCurrency(supplier.amount)}</span>
                        </div>
                        <div className='h-2 w-full rounded-full bg-stone-200'>
                          <div className='h-2 rounded-full bg-blue-600' style={{ width: `${Math.min(100, Math.max(0, ratio))}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className='grid gap-4 md:grid-cols-3'>
          <Card className='rounded-xl border-stone-200'>
            <CardHeader>
              <CardTitle className='text-base'>Riesgo De Actividad</CardTitle>
            </CardHeader>
            <CardContent className='space-y-1 text-sm'>
              <p>
                Obras inactivas &gt; 90 dias: <span className='font-semibold'>{numberFmt.format(model.inactiveOver90)}</span>
              </p>
              <p>
                Obras sin certificado del mes: <span className='font-semibold'>{numberFmt.format(model.missingCurrentMonth)}</span>
              </p>
              <p>
                Registros estancados en etapa: <span className='font-semibold'>{numberFmt.format(model.stalledTotal)}</span>
              </p>
            </CardContent>
          </Card>

          <Card className='rounded-xl border-stone-200'>
            <CardHeader>
              <CardTitle className='text-base'>Calidad OCR</CardTitle>
            </CardHeader>
            <CardContent className='space-y-1 text-sm'>
              <p>
                Jobs OCR analizados: <span className='font-semibold'>{numberFmt.format(model.ocrTotalJobs)}</span>
              </p>
              <p>
                Jobs fallidos: <span className='font-semibold text-red-700'>{numberFmt.format(model.ocrFailed)}</span>
              </p>
              <p>
                Exito OCR: <span className='font-semibold'>{formatPercent(model.ocrSuccessRate, 1)}</span>
              </p>
            </CardContent>
          </Card>

          <Card className='rounded-xl border-stone-200'>
            <CardHeader>
              <CardTitle className='text-base'>Rentabilidad Parcial</CardTitle>
            </CardHeader>
            <CardContent className='space-y-1 text-sm'>
              <p>
                Gasto materiales: <span className='font-semibold'>{formatCurrency(model.materialsSpendTotal)}</span>
              </p>
              <p>
                Margen bruto proxy: <span className='font-semibold'>{formatCurrency(model.grossMarginProxy)}</span>
              </p>
              <p>
                ROI materiales: <span className='font-semibold'>{formatPercent(model.roiMateriales, 1)}</span>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
