'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Columns3,
  Copy,
  Eye,
  EyeOff,
  FileCode2,
  GitMerge,
  LayoutGrid,
  Layers,
  MoveHorizontal,
  Pin,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ─── Lazy-imported feature components ─────────────────────────────────────────
import { SearchInput } from '@/app/excel/_components/SearchInput';
import { CustomInput } from '@/app/excel/_components/CustomInput';
import { InBodyStates } from '@/app/excel/_components/InBodyStates';
import { ColumnsMenu } from '@/app/excel/_components/ColumnsMenu';
import { ViewsMenu } from '@/app/excel/_components/ViewsMenu';

// ─── Types ────────────────────────────────────────────────────────────────────

type Decision = 'keep' | 'merge' | 'delete' | 'review' | null;

interface ComponentEntry {
  name: string;
  path: string;
  lines?: number;
  description: string;
  role: 'canonical' | 'duplicate' | 'variant' | 'unknown';
  props?: string[];
  previewId: string; // matches key in PREVIEWS map
}

interface DuplicateGroup {
  id: string;
  category: string;
  title: string;
  risk: 'high' | 'medium' | 'low';
  summary: string;
  recommendation: string;
  components: ComponentEntry[];
}

// ─── Live Preview Components ───────────────────────────────────────────────────

function PreviewShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <span className="text-[10px] uppercase tracking-widest text-stone-400">{label}</span>
      <div className="flex min-h-[80px] items-start justify-start rounded-xl border border-stone-200 bg-white p-4">
        {children}
      </div>
    </div>
  );
}

function ComplexPreview({ name, note, props }: { name: string; note: string; props?: string[] }) {
  return (
    <div className="flex min-h-[80px] flex-col justify-center rounded-xl border border-stone-200 border-dashed bg-stone-50 p-4">
      <p className="text-xs font-mono font-semibold text-stone-500">{name}</p>
      <p className="mt-1 text-xs text-stone-400 leading-relaxed">{note}</p>
      {props && props.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {props.map((p) => (
            <code key={p} className="rounded bg-stone-200 px-1.5 py-0.5 text-[10px] text-stone-600">{p}</code>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Input group ---
function Preview_Input() {
  return (
    <PreviewShell label="components/ui/input.tsx">
      <div className="w-full space-y-3">
        <div className="space-y-1">
          <span className="text-[10px] text-stone-400">default</span>
          <Input placeholder="Nombre de obra..." className="max-w-xs" />
        </div>
        <div className="space-y-1">
          <span className="text-[10px] text-stone-400">type=&quot;search&quot;</span>
          <Input type="search" placeholder="Buscar..." className="max-w-xs" />
        </div>
      </div>
    </PreviewShell>
  );
}

function Preview_SearchInput() {
  const [val, setVal] = useState('');
  return (
    <PreviewShell label="app/excel/_components/SearchInput.tsx">
      <div className="space-y-2 w-full">
        <SearchInput value={val} onChange={setVal} />
        {val && <p className="text-xs text-stone-400">valor: &quot;{val}&quot;</p>}
      </div>
    </PreviewShell>
  );
}

function Preview_CustomInput() {
  const [variant, setVariant] = useState<'default' | 'cammo' | 'show-empty'>('default');
  const [val, setVal] = useState('');
  return (
    <PreviewShell label="app/excel/_components/CustomInput.tsx">
      <div className="w-full space-y-3">
        <div className="flex gap-2">
          {(['default', 'cammo', 'show-empty'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVariant(v)}
              className={cn(
                'rounded-md border px-2 py-1 text-[10px] transition-colors',
                variant === v ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-stone-200 text-stone-500',
              )}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="rounded border border-stone-100 bg-stone-50 px-2 py-1.5">
          <CustomInput
            variant={variant}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder={variant === 'show-empty' ? '(vacío = dashed)' : 'Escribí algo...'}
          />
        </div>
        <p className="text-[10px] text-stone-400">variant=&quot;{variant}&quot; — usado en celdas de tabla inline</p>
      </div>
    </PreviewShell>
  );
}

// --- Loading group ---
function Preview_Skeleton() {
  return (
    <PreviewShell label="components/ui/skeleton.tsx">
      <div className="w-full space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        <Skeleton className="h-20 w-full rounded-lg" />
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
      </div>
    </PreviewShell>
  );
}

function Preview_InBodyStates() {
  const [mode, setMode] = useState<'loading' | 'error' | 'empty'>('loading');
  return (
    <PreviewShell label="app/excel/_components/InBodyStates.tsx">
      <div className="w-full space-y-2">
        <div className="flex gap-2">
          {(['loading', 'error', 'empty'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'rounded-md border px-2 py-1 text-[10px] transition-colors',
                mode === m ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-stone-200 text-stone-500',
              )}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="overflow-hidden rounded-lg border border-stone-200">
          <table className="w-full">
            <tbody>
              <InBodyStates
                isLoading={mode === 'loading'}
                tableError={mode === 'error' ? 'Error de conexión' : null}
                colspan={3}
                empty={mode !== 'loading' || true}
                onRetry={() => {}}
                emptyText="No hay obras que coincidan"
              />
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-stone-400">Renderiza como &lt;tr&gt; — solo usable dentro de &lt;table&gt;</p>
      </div>
    </PreviewShell>
  );
}

function Preview_DocumentsTabSkeleton() {
  return (
    <PreviewShell label="app/excel/[obraId]/tabs/documents-tab-skeleton.tsx">
      <div className="w-full space-y-2">
        <div className="flex gap-4 h-40 overflow-hidden">
          {/* Sidebar */}
          <div className="w-40 shrink-0 rounded-lg border p-2 space-y-2">
            <Skeleton className="h-4 w-24 mb-3" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-1.5 py-1">
                <Skeleton className="h-3 w-3 rounded" />
                <Skeleton className="h-3 flex-1" />
              </div>
            ))}
          </div>
          {/* Main */}
          <div className="flex-1 rounded-lg border p-2 space-y-2">
            <div className="flex justify-between border-b pb-2">
              <Skeleton className="h-6 w-28" />
              <div className="flex gap-1"><Skeleton className="h-6 w-16" /><Skeleton className="h-6 w-6" /></div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-lg border p-2 space-y-1">
                  <Skeleton className="aspect-square w-full rounded" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-2.5 w-1/2" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="text-[10px] text-stone-400">Hardcoded para tab value=&quot;documentos&quot; — no reutilizable</p>
      </div>
    </PreviewShell>
  );
}

// --- Menus group ---
function Preview_DropdownMenuBase() {
  return (
    <PreviewShell label="components/ui/dropdown-menu.tsx">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            Menú base <ChevronDown className="ml-1 h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Opciones</DropdownMenuLabel>
          <DropdownMenuItem>Ver detalle</DropdownMenuItem>
          <DropdownMenuItem>Editar</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-red-600">Eliminar</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </PreviewShell>
  );
}

const MOCK_COLUMNS = [
  { index: 0, label: 'Obra' },
  { index: 1, label: 'Entidad' },
  { index: 2, label: 'Período' },
  { index: 3, label: 'Monto' },
  { index: 4, label: 'Estado' },
];

function Preview_ColumnsMenu() {
  const [hidden, setHidden] = useState<number[]>([]);
  const [pinned, setPinned] = useState<number[]>([0]);

  return (
    <PreviewShell label="app/excel/_components/ColumnsMenu.tsx">
      <div className="space-y-2">
        <ColumnsMenu
          allColumns={MOCK_COLUMNS}
          hiddenCols={hidden}
          setHiddenCols={setHidden}
          pinnedColumns={pinned}
          togglePinColumn={(i) => setPinned((p) => p.includes(i) ? p.filter((x) => x !== i) : [...p, i])}
          onBalanceColumns={() => {}}
        />
        <p className="text-[10px] text-stone-400">
          Props: allColumns, hiddenCols, setHiddenCols, pinnedColumns, togglePinColumn, onBalanceColumns
        </p>
      </div>
    </PreviewShell>
  );
}

const MOCK_VIEWS = [
  { name: 'Vista Gerencia', columns: [0, 1, 2] },
  { name: 'Vista Contable', columns: [0, 3, 4] },
];

function Preview_ViewsMenu() {
  const [views, setViews] = useState(MOCK_VIEWS);
  return (
    <PreviewShell label="app/excel/_components/ViewsMenu.tsx">
      <div className="space-y-2">
        <ViewsMenu
          views={views}
          saveCurrentAsView={() => setViews((v) => [...v, { name: `Vista ${v.length + 1}`, columns: [0] }])}
          applyView={() => {}}
          deleteView={(name) => setViews((v) => v.filter((x) => x.name !== name))}
        />
        <p className="text-[10px] text-stone-400">
          Props: views[], saveCurrentAsView, applyView, deleteView — mismo patrón que ColumnsMenu
        </p>
      </div>
    </PreviewShell>
  );
}

function Preview_ColumnVisibilityMenu() {
  return (
    <PreviewShell label="components/column-visibility-menu.tsx">
      <ComplexPreview
        name="ColumnVisibilityMenu"
        note="Tercer menú de visibilidad de columnas en components/ raíz. Props similares a ColumnsMenu pero sin pinning. Archivo de 60 líneas que duplica ColumnsMenu."
        props={['visibleColumns', 'onToggle']}
      />
    </PreviewShell>
  );
}

// --- Complex / unrenderable ---
function Preview_Complex({ name, path, note, props }: { name: string; path: string; note: string; props?: string[] }) {
  return (
    <PreviewShell label={path}>
      <ComplexPreview name={name} note={note} props={props} />
    </PreviewShell>
  );
}

// ─── Preview registry ──────────────────────────────────────────────────────────
// Maps previewId → React node

const PREVIEWS: Record<string, React.ReactNode> = {
  // Inputs
  'ui-input': <Preview_Input />,
  'search-input': <Preview_SearchInput />,
  'custom-input': <Preview_CustomInput />,

  // Loading
  'ui-skeleton': <Preview_Skeleton />,
  'in-body-states': <Preview_InBodyStates />,
  'documents-tab-skeleton': <Preview_DocumentsTabSkeleton />,

  // Menus
  'dropdown-menu-base': <Preview_DropdownMenuBase />,
  'columns-menu': <Preview_ColumnsMenu />,
  'views-menu': <Preview_ViewsMenu />,
  'column-visibility-menu': <Preview_ColumnVisibilityMenu />,

  // Complex / unrenderable
  'form-table': (
    <Preview_Complex
      name="FormTable"
      path="components/form-table/form-table.tsx"
      note="Tabla editable más completa del proyecto. Requiere config complejo con columnas, datos, callbacks de edición. Sirve como referencia canónica para consolidar el resto."
      props={['config', 'data', 'columns', 'sorting', 'filtering', 'pagination']}
    />
  ),
  'obras-table': (
    <Preview_Complex
      name="ObrasTable"
      path="app/excel/_components/ObrasTable.tsx"
      note="Tabla spreadsheet para obras. Reimplementa sorting + column visibility. Tiene pinning y resize propios que no están en FormTable. Candidata a unificación parcial."
      props={['formApi', 'visible', 'orderBy', 'pinnedColumns', 'resizeMode']}
    />
  ),
  'report-table': (
    <Preview_Complex
      name="ReportTable"
      path="components/report/report-table.tsx"
      note="Tabla de reporte con agregaciones y mini-charts. Formato de datos distinto al resto pero el scaffold visual es idéntico. El sort podría venir de un hook compartido."
      props={['data', 'columns', 'sorting']}
    />
  ),
  'notifications-table': (
    <Preview_Complex
      name="NotificationsTable"
      path="app/notifications/_components/notifications-table.tsx"
      note="Tabla de notificaciones: 180 líneas, sorting manual, acciones inline. La más simple del grupo — fácil de migrar a FormTable o BaseDataTable."
      props={['rows', 'markRead', 'deleteNotification']}
    />
  ),
  'tenant-expense-table': (
    <Preview_Complex
      name="TenantExpenseTable"
      path="components/expenses/tenant-expense-table.tsx"
      note="Tabla mínima de gastos (120 líneas). Formato moneda propio. La más fácil de eliminar."
      props={['expenses', 'currency']}
    />
  ),
  'event-calendar': (
    <Preview_Complex
      name="EventCalendar"
      path="components/event-calendar/event-calendar.tsx"
      note="Calendario completo multi-vista (mes/semana/día/agenda) con drag-and-drop. Sistema de ~10 sub-componentes. Canónico — el otro calendario debería wrapearlo."
      props={['events', 'onEventAdd', 'onEventUpdate', 'onEventDelete', 'initialView', 'readOnly']}
    />
  ),
  'pendientes-calendar': (
    <Preview_Complex
      name="PendientesCalendar"
      path="app/notifications/_components/pendientes-calendar.tsx"
      note="Reimplementa la grilla mensual de cero en 220 líneas. Debería ser EventCalendar con readOnly={true} y eventos filtrados por pendencia."
      props={['events', 'onEventClick']}
    />
  ),
  'spreadsheet-grid-preview': (
    <Preview_Complex
      name="SpreadsheetGridPreview"
      path="app/excel/[obraId]/tabs/file-manager/components/spreadsheet-grid-preview.tsx"
      note="Preview de celdas con edición inline. El más completo del grupo. Fuente de verdad para los otros dos."
      props={['gridData', 'onEdit']}
    />
  ),
  'spreadsheet-extraction-card': (
    <Preview_Complex
      name="SpreadsheetExtractionCard"
      path="app/excel/[obraId]/tabs/file-manager/components/spreadsheet-extraction-card.tsx"
      note="Igual que SpreadsheetGridPreview + collapsible de secciones OCR. Podría ser GridPreview + wrapper de Card."
      props={['table', 'sections']}
    />
  ),
  'data-preview-table': (
    <Preview_Complex
      name="DataPreviewTable"
      path="app/certexampleplayground/_components/data-preview-table.tsx"
      note="Tercera implementación del mismo concepto, en el playground de certificados. 80 líneas, sin edición."
      props={['data', 'columns']}
    />
  ),
  'document-flows-page': (
    <Preview_Complex
      name="DocumentFlowsPage"
      path="app/admin/document-flows/page.tsx"
      note="Página admin de flujos de documentos. Canónica. 1528 líneas."
      props={[]}
    />
  ),
  'document-flows-2-page': (
    <Preview_Complex
      name="DocumentFlows2Page"
      path="app/admin/document-flows-2/page.tsx"
      note="Copia exacta de document-flows para comparación de diseño. 1537 líneas de código muerto. Borrar."
      props={[]}
    />
  ),
};

// ─── Duplicate groups data ─────────────────────────────────────────────────────

const DUPLICATE_GROUPS: DuplicateGroup[] = [
  {
    id: 'tables',
    category: 'Data Display',
    title: 'Table / Grid implementations',
    risk: 'high',
    summary:
      '5+ table implementations con sorting, column management, pagination y estilos duplicados. Cada uno fue construido en aislamiento para una feature específica.',
    recommendation:
      'Definir un BaseDataTable en components/ui/. Migrar ObrasTable, ReportTable y NotificationsTable a usarlo. Mantener FormTable como variante editable especializada.',
    components: [
      {
        name: 'FormTable',
        path: 'components/form-table/form-table.tsx',
        lines: 890,
        description: 'Tabla editable más completa. In-cell editing, filtering, sorting, pagination. Referencia canónica.',
        role: 'canonical',
        props: ['config', 'data', 'columns', 'sorting', 'filtering'],
        previewId: 'form-table',
      },
      {
        name: 'ObrasTable',
        path: 'app/excel/_components/ObrasTable.tsx',
        lines: 620,
        description: 'Spreadsheet de obras con column pinning, resize, context menu. Reimplementa sorting + column visibility.',
        role: 'duplicate',
        props: ['formApi', 'visible', 'orderBy', 'pinnedColumns', 'resizeMode'],
        previewId: 'obras-table',
      },
      {
        name: 'ReportTable',
        path: 'components/report/report-table.tsx',
        lines: 340,
        description: 'Tabla de reporte con agregaciones y mini charts. Reimplementa lógica de sort.',
        role: 'variant',
        props: ['data', 'columns', 'sorting'],
        previewId: 'report-table',
      },
      {
        name: 'NotificationsTable',
        path: 'app/notifications/_components/notifications-table.tsx',
        lines: 180,
        description: 'Tabla de notificaciones. Sorting manual + acciones inline. La más fácil de migrar.',
        role: 'duplicate',
        props: ['rows', 'markRead', 'deleteNotification'],
        previewId: 'notifications-table',
      },
      {
        name: 'TenantExpenseTable',
        path: 'components/expenses/tenant-expense-table.tsx',
        lines: 120,
        description: 'Tabla mínima de gastos con formato moneda. La más fácil de eliminar.',
        role: 'duplicate',
        props: ['expenses', 'currency'],
        previewId: 'tenant-expense-table',
      },
    ],
  },
  {
    id: 'inputs',
    category: 'Forms',
    title: 'Input / Search variants',
    risk: 'medium',
    summary:
      'Tres componentes de input para el mismo propósito. SearchInput y CustomInput wrappean Input con estilos/animaciones extras sin extender el componente base.',
    recommendation:
      'Agregar una prop search al Input base (botón clear animado) y una prop variant="cell" para inline editing. Eliminar SearchInput y CustomInput como archivos standalone.',
    components: [
      {
        name: 'Input',
        path: 'components/ui/input.tsx',
        lines: 45,
        description: 'Input base. Ya soporta type="search" con borde naranja. Fuente de verdad.',
        role: 'canonical',
        props: ['type', 'className', 'value', 'onChange'],
        previewId: 'ui-input',
      },
      {
        name: 'SearchInput',
        path: 'app/excel/_components/SearchInput.tsx',
        lines: 65,
        description: 'Search animado con botón clear. Wrappea el input nativo (ni siquiera usa ui/Input). Debería extender Input.',
        role: 'duplicate',
        props: ['value', 'onChange'],
        previewId: 'search-input',
      },
      {
        name: 'CustomInput',
        path: 'app/excel/_components/CustomInput.tsx',
        lines: 80,
        description: 'Input para celdas de tabla con variantes cammo/show-empty. Parcialmente superpone con cell-renderers.',
        role: 'variant',
        props: ['type', 'variant'],
        previewId: 'custom-input',
      },
    ],
  },
  {
    id: 'loading',
    category: 'Feedback',
    title: 'Loading / Skeleton states',
    risk: 'medium',
    summary:
      'Lógica de estado de carga dividida en tres componentes separados. No hay una API unificada para loading / error / vacío.',
    recommendation:
      'Crear un único <DataState loading error empty> component. Eliminar InBodyStates y unificar todos los skeletons a través de ui/skeleton.',
    components: [
      {
        name: 'Skeleton',
        path: 'components/ui/skeleton.tsx',
        lines: 8,
        description: 'Div animado composable. Building block canónico.',
        role: 'canonical',
        props: ['className'],
        previewId: 'ui-skeleton',
      },
      {
        name: 'InBodyStates',
        path: 'app/excel/_components/InBodyStates.tsx',
        lines: 95,
        description: 'Loading/error/retry como filas de tbody. Reimplementa Skeleton inline.',
        role: 'duplicate',
        props: ['isLoading', 'tableError', 'colspan', 'empty', 'onRetry', 'emptyText'],
        previewId: 'in-body-states',
      },
      {
        name: 'DocumentsTabSkeleton',
        path: 'app/excel/[obraId]/tabs/documents-tab-skeleton.tsx',
        lines: 65,
        description: 'Skeleton hardcoded para el documents tab. Hardcodea tab value="documentos".',
        role: 'duplicate',
        props: [],
        previewId: 'documents-tab-skeleton',
      },
    ],
  },
  {
    id: 'menus',
    category: 'Navigation',
    title: 'Column / View menu dropdowns',
    risk: 'low',
    summary:
      'Tres menús dropdown específicos que duplican el patrón DropdownMenu + lista de checkboxes. ColumnVisibilityMenu en la raíz de components/ ni siquiera estaba catalogado.',
    recommendation:
      'Reemplazar con un <DataGridMenu items onToggle trigger> genérico. ColumnsMenu, ViewsMenu y ColumnVisibilityMenu se vuelven one-liners.',
    components: [
      {
        name: 'DropdownMenu',
        path: 'components/ui/dropdown-menu.tsx',
        lines: 210,
        description: 'Primitivo base con API completa: checkbox, radio, separator, shortcut. Canónico.',
        role: 'canonical',
        props: ['children'],
        previewId: 'dropdown-menu-base',
      },
      {
        name: 'ColumnsMenu',
        path: 'app/excel/_components/ColumnsMenu.tsx',
        lines: 90,
        description: 'Menú de visibilidad de columnas con pinning. Wrappea DropdownMenu.',
        role: 'duplicate',
        props: ['allColumns', 'hiddenCols', 'pinnedColumns', 'togglePinColumn'],
        previewId: 'columns-menu',
      },
      {
        name: 'ViewsMenu',
        path: 'app/excel/_components/ViewsMenu.tsx',
        lines: 70,
        description: 'Selector de vistas guardadas. Mismo patrón que ColumnsMenu con radio items.',
        role: 'duplicate',
        props: ['views', 'saveCurrentAsView', 'applyView', 'deleteView'],
        previewId: 'views-menu',
      },
      {
        name: 'ColumnVisibilityMenu',
        path: 'components/column-visibility-menu.tsx',
        lines: 60,
        description: 'Tercer menú de visibilidad en components/ raíz. Props similares a ColumnsMenu pero sin pinning.',
        role: 'duplicate',
        props: ['visibleColumns', 'onToggle'],
        previewId: 'column-visibility-menu',
      },
    ],
  },
  {
    id: 'calendars',
    category: 'Data Display',
    title: 'Calendar implementations',
    risk: 'medium',
    summary:
      'Dos sistemas de calendario completos. EventCalendar es un calendario rico multi-vista con DnD. PendientesCalendar reimplementa la grilla mensual de cero.',
    recommendation:
      'PendientesCalendar debería wrappear EventCalendar con readOnly={true} y eventos filtrados por pendencia, no reimplementar la lógica.',
    components: [
      {
        name: 'EventCalendar',
        path: 'components/event-calendar/event-calendar.tsx',
        lines: 480,
        description: 'Calendario multi-vista: mes/semana/día/agenda + drag-drop + dialogs. Canónico.',
        role: 'canonical',
        props: ['events', 'onEventAdd', 'onEventUpdate', 'readOnly', 'initialView'],
        previewId: 'event-calendar',
      },
      {
        name: 'PendientesCalendar',
        path: 'app/notifications/_components/pendientes-calendar.tsx',
        lines: 220,
        description: 'Reimplementa la grilla mensual en 220 líneas. Debería ser EventCalendar con readOnly.',
        role: 'duplicate',
        props: ['events', 'onEventClick'],
        previewId: 'pendientes-calendar',
      },
    ],
  },
  {
    id: 'spreadsheet-preview',
    category: 'Data Display',
    title: 'Spreadsheet / data preview',
    risk: 'low',
    summary:
      'Tres componentes similares para visualizar datos tabulares en contextos distintos (file manager, extracción OCR, cert playground).',
    recommendation:
      'Extraer un <SpreadsheetPreview data columns editable> base. Cada consumidor pasa su shape de datos + handler de edición opcional.',
    components: [
      {
        name: 'SpreadsheetGridPreview',
        path: 'app/excel/[obraId]/tabs/file-manager/components/spreadsheet-grid-preview.tsx',
        lines: 160,
        description: 'Preview de celdas con edición inline. El más completo del grupo.',
        role: 'canonical',
        props: ['gridData', 'onEdit'],
        previewId: 'spreadsheet-grid-preview',
      },
      {
        name: 'SpreadsheetExtractionCard',
        path: 'app/excel/[obraId]/tabs/file-manager/components/spreadsheet-extraction-card.tsx',
        lines: 130,
        description: 'GridPreview + Card wrapper con secciones colapsables.',
        role: 'variant',
        props: ['table', 'sections'],
        previewId: 'spreadsheet-extraction-card',
      },
      {
        name: 'DataPreviewTable',
        path: 'app/certexampleplayground/_components/data-preview-table.tsx',
        lines: 80,
        description: 'Tercera implementación en el cert playground. Sin edición.',
        role: 'duplicate',
        props: ['data', 'columns'],
        previewId: 'data-preview-table',
      },
    ],
  },
  {
    id: 'document-flows-page',
    category: 'Pages',
    title: 'document-flows vs document-flows-2',
    risk: 'high',
    summary:
      'Dos páginas admin casi idénticas (1528 vs 1537 líneas). document-flows-2 es una variante de comparación de diseño que nunca se limpió.',
    recommendation:
      'Diffear ambas, quedarse con la más actualizada, eliminar la otra. Son 1537 líneas de código muerto.',
    components: [
      {
        name: 'DocumentFlowsPage',
        path: 'app/admin/document-flows/page.tsx',
        lines: 1528,
        description: 'Página admin principal de flujos de documentos. Canónica.',
        role: 'canonical',
        props: [],
        previewId: 'document-flows-page',
      },
      {
        name: 'DocumentFlows2Page',
        path: 'app/admin/document-flows-2/page.tsx',
        lines: 1537,
        description: 'Copia "comparacion handoff" — nunca eliminada tras la review de diseño.',
        role: 'duplicate',
        props: [],
        previewId: 'document-flows-2-page',
      },
    ],
  },
];

// ─── Config helpers ────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  'Data Display': 'bg-blue-50 text-blue-700 border-blue-200',
  Forms: 'bg-violet-50 text-violet-700 border-violet-200',
  Feedback: 'bg-amber-50 text-amber-700 border-amber-200',
  Navigation: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  Pages: 'bg-rose-50 text-rose-700 border-rose-200',
};

const RISK_CONFIG = {
  high: { label: 'Alto', className: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
  medium: { label: 'Medio', className: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  low: { label: 'Bajo', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
};

const ROLE_CONFIG = {
  canonical: { label: 'Canónico', icon: CheckCircle2, className: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  duplicate: { label: 'Duplicado', icon: XCircle, className: 'text-red-600 bg-red-50 border-red-200' },
  variant: { label: 'Variante', icon: AlertTriangle, className: 'text-amber-600 bg-amber-50 border-amber-200' },
  unknown: { label: 'Sin definir', icon: Circle, className: 'text-stone-500 bg-stone-50 border-stone-200' },
};

const DECISION_CONFIG: Record<Exclude<Decision, null>, { label: string; icon: typeof CheckCircle2; className: string }> = {
  keep: { label: 'Mantener', icon: CheckCircle2, className: 'bg-emerald-600 text-white hover:bg-emerald-700' },
  merge: { label: 'Fusionar', icon: GitMerge, className: 'bg-blue-600 text-white hover:bg-blue-700' },
  delete: { label: 'Eliminar', icon: Trash2, className: 'bg-red-600 text-white hover:bg-red-700' },
  review: { label: 'Revisar', icon: AlertTriangle, className: 'bg-amber-500 text-white hover:bg-amber-600' },
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: ComponentEntry['role'] }) {
  const cfg = ROLE_CONFIG[role];
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', cfg.className)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function ComponentSelector({
  components,
  selected,
  onSelect,
}: {
  components: ComponentEntry[];
  selected: string;
  onSelect: (previewId: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {components.map((c) => {
        const isSelected = selected === c.previewId;
        const roleCfg = ROLE_CONFIG[c.role];
        return (
          <button
            key={c.previewId}
            type="button"
            onClick={() => onSelect(c.previewId)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
              isSelected
                ? 'border-stone-900 bg-stone-900 text-white shadow-sm'
                : 'border-stone-200 bg-white text-stone-600 hover:border-stone-400 hover:bg-stone-50',
            )}
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                c.role === 'canonical' ? 'bg-emerald-500' : c.role === 'duplicate' ? 'bg-red-500' : 'bg-amber-500',
              )}
            />
            {c.name}
            {c.lines && (
              <span className={cn('tabular-nums', isSelected ? 'text-stone-400' : 'text-stone-300')}>
                {c.lines}L
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ComponentMeta({ entry }: { entry: ComponentEntry }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(entry.path);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className={cn(
        'rounded-xl border p-3 transition-colors',
        entry.role === 'canonical'
          ? 'border-emerald-200 bg-emerald-50/40'
          : entry.role === 'duplicate'
            ? 'border-red-200 bg-red-50/30'
            : 'border-amber-200 bg-amber-50/30',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-semibold text-stone-900">{entry.name}</span>
        <RoleBadge role={entry.role} />
        {entry.lines && <span className="text-xs text-stone-400">{entry.lines} líneas</span>}
      </div>
      <button
        type="button"
        onClick={copy}
        className="mt-1 flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 transition-colors"
      >
        <FileCode2 className="h-3 w-3" />
        <span className="truncate font-mono">{entry.path}</span>
        {copied && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
      </button>
      <p className="mt-1.5 text-xs leading-relaxed text-stone-600">{entry.description}</p>
      {entry.props && entry.props.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {entry.props.map((p) => (
            <code key={p} className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-600">{p}</code>
          ))}
        </div>
      )}
    </div>
  );
}

function GroupCard({
  group,
  decision,
  onDecision,
}: {
  group: DuplicateGroup;
  decision: Decision;
  onDecision: (d: Decision) => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedPreviewId, setSelectedPreviewId] = useState<string>(group.components[0].previewId);

  const risk = RISK_CONFIG[group.risk];
  const catColor = CATEGORY_COLORS[group.category] ?? 'bg-stone-50 text-stone-600 border-stone-200';
  const duplicateCount = group.components.filter((c) => c.role === 'duplicate').length;
  const selectedEntry = group.components.find((c) => c.previewId === selectedPreviewId);
  const preview = PREVIEWS[selectedPreviewId];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-start gap-4 p-5">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', catColor)}>{group.category}</span>
            <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', risk.className)}>
              <span className={cn('h-1.5 w-1.5 rounded-full', risk.dot)} />
              Riesgo {risk.label}
            </span>
            <span className="text-xs text-stone-400">
              {group.components.length} componentes · {duplicateCount} duplicados
            </span>
          </div>
          <h3 className="mt-2 font-semibold tracking-tight text-stone-900">{group.title}</h3>
          <p className="mt-1 text-sm text-stone-500 leading-relaxed">{group.summary}</p>
        </div>

        {/* Decision buttons */}
        <div className="hidden sm:flex flex-col gap-1.5 shrink-0">
          {(Object.keys(DECISION_CONFIG) as Exclude<Decision, null>[]).map((d) => {
            const cfg = DECISION_CONFIG[d];
            const Icon = cfg.icon;
            const isActive = decision === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => onDecision(isActive ? null : d)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all',
                  isActive ? cfg.className : 'border border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Recommendation ── */}
      <div className="mx-5 mb-4 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
        <p className="text-xs text-blue-700 leading-relaxed">
          <span className="font-semibold">Recomendación: </span>
          {group.recommendation}
        </p>
      </div>

      {/* ── Mobile decision ── */}
      <div className="mx-5 mb-4 flex flex-wrap gap-1.5 sm:hidden">
        {(Object.keys(DECISION_CONFIG) as Exclude<Decision, null>[]).map((d) => {
          const cfg = DECISION_CONFIG[d];
          const Icon = cfg.icon;
          const isActive = decision === d;
          return (
            <button
              key={d}
              type="button"
              onClick={() => onDecision(isActive ? null : d)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all',
                isActive ? cfg.className : 'border border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* ── Component selector + live preview ── */}
      <div className="border-t border-stone-100 bg-stone-50/60">
        <div className="p-4 space-y-3">
          {/* Selector tabs */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <ComponentSelector
              components={group.components}
              selected={selectedPreviewId}
              onSelect={setSelectedPreviewId}
            />
            <button
              type="button"
              onClick={() => setDetailsOpen(!detailsOpen)}
              className="inline-flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors shrink-0"
            >
              {detailsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {detailsOpen ? 'Ocultar' : 'Ver'} metadata
            </button>
          </div>

          {/* Live preview */}
          {preview && (
            <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
              <div className="flex items-center gap-2 border-b border-stone-100 bg-stone-50 px-3 py-2">
                <Eye className="h-3.5 w-3.5 text-stone-400" />
                <span className="text-xs text-stone-500">Preview — {selectedEntry?.name}</span>
              </div>
              <div className="p-4">
                {preview}
              </div>
            </div>
          )}

          {/* Metadata detail */}
          {detailsOpen && selectedEntry && (
            <ComponentMeta entry={selectedEntry} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ decisions }: { decisions: Record<string, Decision> }) {
  const total = DUPLICATE_GROUPS.length;
  const decided = Object.values(decisions).filter(Boolean).length;
  const toDelete = Object.values(decisions).filter((d) => d === 'delete').length;
  const toMerge = Object.values(decisions).filter((d) => d === 'merge').length;
  const totalDuplicateFiles = DUPLICATE_GROUPS.reduce(
    (acc, g) => acc + g.components.filter((c) => c.role === 'duplicate').length,
    0,
  );

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {[
        { label: 'Grupos', value: total, sub: 'grupos de duplicados', color: 'text-stone-900' },
        { label: 'Archivos duplicados', value: totalDuplicateFiles, sub: 'a resolver', color: 'text-red-600' },
        { label: 'Decididos', value: `${decided}/${total}`, sub: 'grupos', color: 'text-blue-600' },
        { label: 'Eliminar', value: toDelete, sub: 'marcados', color: 'text-red-600' },
        { label: 'Fusionar', value: toMerge, sub: 'marcados', color: 'text-blue-600' },
      ].map(({ label, value, sub, color }) => (
        <div key={label} className="rounded-xl border border-stone-200 bg-white p-3">
          <div className="text-xs text-stone-500">{label}</div>
          <div className={cn('mt-1 text-2xl font-semibold tabular-nums', color)}>{value}</div>
          <div className="text-[10px] text-stone-400">{sub}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Migration tab ────────────────────────────────────────────────────────────

type MigStatus = 'done' | 'partial' | 'pending' | 'unknown';

const MIG_STATUS_CFG: Record<MigStatus, { label: string; cls: string }> = {
  done:    { label: 'Listo',        cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  partial: { label: 'Parcial',      cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  pending: { label: 'Pendiente',    cls: 'bg-stone-100 text-stone-500 border-stone-200' },
  unknown: { label: 'Sin verificar', cls: 'bg-blue-50 text-blue-600 border-blue-200' },
};

function MigStatusBadge({ status }: { status: MigStatus }) {
  const cfg = MIG_STATUS_CFG[status];
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium', cfg.cls)}>
      {cfg.label}
    </span>
  );
}

const CHECKLIST: Array<{ item: string; status: MigStatus; note: string }> = [
  { item: 'Fondo stone-100 sin gradientes',    status: 'partial', note: 'stone-100 usado pero existen gradientes residuales en algunos paneles' },
  { item: 'Geist Sans + Mono',                 status: 'done',    note: 'Ambas fuentes cargadas en layout.tsx y mapeadas en @theme' },
  { item: 'Botones lifted',                    status: 'pending', note: 'Actualmente dark gradient — ver paso 3 del plan de migración' },
  { item: 'Tabs notch',                        status: 'pending', note: 'Actualmente shadcn underline — NotchTail existe pero sin cablear' },
  { item: 'Lucide stroke-only',                status: 'partial', note: 'Mayoría Lucide, pero algunos íconos custom no son stroke-only' },
  { item: 'Naranja como acento puntual',       status: 'partial', note: '--color-orange-primary existe pero también se usa como bg directo en varios lugares' },
  { item: 'Sombras hue-matched',               status: 'pending', note: 'Sombras actuales son genéricas rgba(0,0,0,...) — ver plan tokens → Sombras' },
  { item: 'Copy voseo',                        status: 'unknown', note: 'Requiere grep pass — ver paso 6 del plan de migración' },
  { item: 'UPPERCASE TRACKED eyebrows',        status: 'partial', note: 'tracking-wider / tracking-widest presentes, pero inconsistente entre secciones' },
  { item: 'Border-radius en escala',           status: 'partial', note: 'Mayoría en escala (md/lg/xl), algunos valores arbitrarios en componentes de reporte' },
];

interface Phase {
  num: number;
  title: string;
  groups: string[];
  unlocks: string;
  effort: string;
  color: string;
}

const MIGRATION_PHASES: Phase[] = [
  {
    num: 1,
    title: 'Prerequisitos de tokens',
    groups: ['— (no duplicate groups)'],
    unlocks: 'STEP 1: globals.css tokens · STEP 2: tipografías',
    effort: '~1h — solo globals.css',
    color: 'border-blue-200 bg-blue-50/50',
  },
  {
    num: 2,
    title: 'Limpiar inputs y loading',
    groups: ['inputs (SearchInput, CustomInput)', 'loading (InBodyStates, DocumentsTabSkeleton)'],
    unlocks: 'STEP 3: button lifted recipe (depende de tener inputs limpios primero)',
    effort: '~3h — 4 archivos, riesgo medio',
    color: 'border-amber-200 bg-amber-50/50',
  },
  {
    num: 3,
    title: 'Migrar button.tsx',
    groups: ['— (no duplicate groups, es el componente base)'],
    unlocks: 'STEP 3 completo — desbloquea menus y tables',
    effort: '~2h — 1 archivo, impacto 1,225 usos',
    color: 'border-orange-200 bg-orange-50/50',
  },
  {
    num: 4,
    title: 'Resolver menus + document-flows',
    groups: ['menus (ColumnsMenu, ViewsMenu, ColumnVisibilityMenu)', 'document-flows-page (eliminar -2)'],
    unlocks: 'STEP 5: notch tabs (document-flows debe estar limpio antes)',
    effort: '~4h — 5 archivos, riesgo bajo a medio',
    color: 'border-violet-200 bg-violet-50/50',
  },
  {
    num: 5,
    title: 'Cablear notch tabs + tables',
    groups: ['tables (ObrasTable → BaseDataTable)', 'spreadsheet-preview', 'calendars'],
    unlocks: 'STEP 5 completo · STEP 6: copy audit',
    effort: '~8h — mayor refactor, riesgo alto en tables',
    color: 'border-emerald-200 bg-emerald-50/50',
  },
];

const BLOCKER_GROUPS: Array<{ groupId: string; blocksStep: string; reason: string; files: string[] }> = [
  {
    groupId: 'inputs',
    blocksStep: 'Paso 3 — button lifted',
    reason: 'SearchInput usa un <button> raw (ni siquiera Button). Si migramos button.tsx antes de limpiar SearchInput, el botón dentro de SearchInput queda con estilo inconsistente.',
    files: ['app/excel/_components/SearchInput.tsx'],
  },
  {
    groupId: 'loading',
    blocksStep: 'Paso 3 — button lifted',
    reason: 'InBodyStates usa <Button> directamente para "Reintentar". Al migrar el recipe del botón, InBodyStates hereda el nuevo estilo — verificar que quede bien antes de deployar.',
    files: ['app/excel/_components/InBodyStates.tsx'],
  },
  {
    groupId: 'menus',
    blocksStep: 'Paso 5 — notch tabs',
    reason: 'ColumnsMenu usa DropdownMenu que usa Button internamente. Resolver después del paso 3.',
    files: ['app/excel/_components/ColumnsMenu.tsx'],
  },
  {
    groupId: 'document-flows-page',
    blocksStep: 'Paso 5 — notch tabs',
    reason: 'document-flows-2/page.tsx es código muerto con 1,537 líneas. Eliminarlo antes de agregar notch tabs evita migrar código que se va a borrar.',
    files: ['app/admin/document-flows-2/page.tsx'],
  },
];

function AuditMigrationSection() {
  return (
    <div className="space-y-6">

      {/* Bloqueantes */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-stone-900">Bloqueantes de migración</h3>
          <p className="mt-0.5 text-xs text-stone-500">
            Resolver estos grupos de duplicados ANTES de ejecutar el paso indicado del plan Sintesis DS.
          </p>
        </div>
        <div className="space-y-3">
          {BLOCKER_GROUPS.map((b) => (
            <div key={b.groupId} className="rounded-xl border border-red-100 bg-red-50/40 p-4">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="font-mono text-xs font-semibold text-stone-800">grupo: {b.groupId}</span>
                <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] text-red-700 font-medium">
                  bloquea → {b.blocksStep}
                </span>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">{b.reason}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {b.files.map((f) => (
                  <code key={f} className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700">{f}</code>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Roadmap de fases */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <div className="mb-5">
          <h3 className="text-base font-semibold text-stone-900">Roadmap — 5 fases de migración</h3>
          <p className="mt-0.5 text-xs text-stone-500">Cada fase resuelve duplicados y desbloquea el siguiente paso de Sintesis DS.</p>
        </div>
        <div className="space-y-3">
          {MIGRATION_PHASES.map((phase) => (
            <div key={phase.num} className={cn('rounded-xl border p-4', phase.color)}>
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-stone-300 bg-white text-xs font-bold text-stone-700">
                  {phase.num}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm text-stone-900">{phase.title}</span>
                    <span className="text-[10px] text-stone-400">{phase.effort}</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Grupos a resolver</p>
                    {phase.groups.map((g) => (
                      <div key={g} className="flex items-center gap-1.5 text-xs text-stone-600">
                        <span className="text-stone-400">·</span>
                        {g}
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 rounded-lg border border-white/60 bg-white/60 px-2.5 py-1.5">
                    <p className="text-[10px] text-stone-500">
                      <span className="font-semibold text-stone-700">Desbloquea: </span>
                      {phase.unlocks}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Checklist Sintesis */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-stone-900">Checklist Sintesis DS</h3>
          <p className="mt-0.5 text-xs text-stone-500">10 ítems del design system. Estado actual vs. target.</p>
        </div>
        <div className="divide-y divide-stone-100">
          {CHECKLIST.map((item, i) => (
            <div key={item.item} className="flex items-start gap-3 py-3">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-stone-300 text-[10px] text-stone-400 mt-0.5">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-stone-800">{item.item}</span>
                  <MigStatusBadge status={item.status} />
                </div>
                <p className="mt-0.5 text-[10px] leading-relaxed text-stone-400">{item.note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ComponentAuditPage() {
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [search, setSearch] = useState('');
  const [filterRisk, setFilterRisk] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const setDecision = (id: string, d: Decision) => {
    setDecisions((prev) => ({ ...prev, [id]: d }));
  };

  const filtered = DUPLICATE_GROUPS.filter((g) => {
    if (filterRisk !== 'all' && g.risk !== filterRisk) return false;
    if (filterCategory !== 'all' && g.category !== filterCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        g.title.toLowerCase().includes(q) ||
        g.summary.toLowerCase().includes(q) ||
        g.components.some((c) => c.name.toLowerCase().includes(q) || c.path.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const categories = Array.from(new Set(DUPLICATE_GROUPS.map((g) => g.category)));
  const highRiskGroups = DUPLICATE_GROUPS.filter((g) => g.risk === 'high');
  const undecided = DUPLICATE_GROUPS.filter((g) => !decisions[g.id]);

  return (
    <div className="min-h-screen bg-stone-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Top nav */}
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/system-design">
              <ArrowLeft className="mr-2 h-4 w-4" />
              System Design
            </Link>
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <span className="text-sm text-stone-500">Component Audit</span>
        </div>

        {/* Header */}
        <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs text-orange-700">
                <Layers className="h-3.5 w-3.5" />
                Auditoría de componentes
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">Component Audit</h1>
              <p className="mt-1 text-sm text-stone-500">
                Seleccioná cada componente para ver un preview en vivo. Marcá tu decisión para comenzar el refactor.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/system-design">Ver componentes base</Link>
            </Button>
          </div>
          <div className="mt-5">
            <StatsBar decisions={decisions} />
          </div>
        </div>

        <Tabs defaultValue="all">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabsList>
              <TabsTrigger value="all">Todos ({DUPLICATE_GROUPS.length})</TabsTrigger>
              <TabsTrigger value="high">
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-red-500" />
                Alto riesgo ({highRiskGroups.length})
              </TabsTrigger>
              <TabsTrigger value="pending">Sin decidir ({undecided.length})</TabsTrigger>
              <TabsTrigger value="migration">Migración</TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
                <Input
                  className="h-8 w-44 pl-8 text-xs"
                  placeholder="Buscar componente..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="h-8 rounded-lg border border-stone-200 bg-white px-2 text-xs text-stone-700 focus:outline-none"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="all">Todas las categorías</option>
                {categories.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
              <select
                className="h-8 rounded-lg border border-stone-200 bg-white px-2 text-xs text-stone-700 focus:outline-none"
                value={filterRisk}
                onChange={(e) => setFilterRisk(e.target.value as typeof filterRisk)}
              >
                <option value="all">Todo riesgo</option>
                <option value="high">Alto</option>
                <option value="medium">Medio</option>
                <option value="low">Bajo</option>
              </select>
            </div>
          </div>

          <TabsContent value="all" className="mt-0 space-y-4">
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center text-sm text-stone-400">
                Sin resultados para los filtros actuales.
              </div>
            ) : (
              filtered.map((g) => (
                <GroupCard key={g.id} group={g} decision={decisions[g.id] ?? null} onDecision={(d) => setDecision(g.id, d)} />
              ))
            )}
          </TabsContent>

          <TabsContent value="high" className="mt-0 space-y-4">
            {highRiskGroups.map((g) => (
              <GroupCard key={g.id} group={g} decision={decisions[g.id] ?? null} onDecision={(d) => setDecision(g.id, d)} />
            ))}
          </TabsContent>

          <TabsContent value="pending" className="mt-0 space-y-4">
            {undecided.length === 0 ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-12 text-center text-sm text-emerald-700">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
                Todos los grupos tienen decisión asignada.
              </div>
            ) : (
              undecided.map((g) => (
                <GroupCard key={g.id} group={g} decision={decisions[g.id] ?? null} onDecision={(d) => setDecision(g.id, d)} />
              ))
            )}
          </TabsContent>

          <TabsContent value="migration" className="mt-0">
            <AuditMigrationSection />
          </TabsContent>
        </Tabs>

        {/* Decision summary */}
        {Object.values(decisions).some(Boolean) && (
          <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-stone-900">Resumen de decisiones</h3>
            <div className="space-y-2">
              {DUPLICATE_GROUPS.filter((g) => decisions[g.id]).map((g) => {
                const d = decisions[g.id]!;
                const cfg = DECISION_CONFIG[d];
                const Icon = cfg.icon;
                return (
                  <div key={g.id} className="flex items-center justify-between rounded-lg border border-stone-100 px-3 py-2">
                    <span className="text-sm text-stone-700">{g.title}</span>
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', cfg.className)}>
                      <Icon className="h-3.5 w-3.5" />
                      {cfg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="mt-4 text-center text-xs text-stone-400">
          Las decisiones son locales a esta sesión.
        </p>
      </div>
    </div>
  );
}
