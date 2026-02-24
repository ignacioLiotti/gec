'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  AlertTriangle,
  CalendarIcon,
  Check,
  ChevronsUpDown,
  Circle,
  Command as CommandIcon,
  GripVertical,
  Layers3,
  LayoutGrid,
  MoreHorizontal,
  Palette,
  Search,
  SlidersHorizontal,
  Sparkles,
  Table2,
  Wand2,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import FolderFront from '@/components/ui/FolderFront';
import FolderFrontEmpty from '@/components/ui/FolderFrontEmpty';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Input } from '@/components/ui/input';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sortable,
  SortableContent,
  SortableItem,
  SortableItemHandle,
  SortableOverlay,
} from '@/components/ui/sortable';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const TOKENS = [
  { name: 'background', className: 'bg-background', border: true },
  { name: 'card', className: 'bg-card', border: true },
  { name: 'muted', className: 'bg-muted', border: false },
  { name: 'primary', className: 'bg-primary', border: false, darkText: false },
  { name: 'secondary', className: 'bg-secondary', border: false },
  { name: 'accent', className: 'bg-accent', border: true },
  { name: 'destructive', className: 'bg-destructive', border: false, darkText: false },
  { name: 'orange-primary', className: 'bg-orange-primary', border: false, darkText: false },
];

const commandItems = [
  ['Ir a Documentos', '⌘D'],
  ['Reprocesar extracción', '⌘R'],
  ['Ver Reporte Macro', '⌘M'],
  ['Crear Obra', '⌘N'],
] as const;

const UI_TOKENS = {
  page: 'bg-stone-100 p-10',
  section: 'space-y-6',
  grid2: 'grid grid-cols-1 gap-6 lg:grid-cols-2',
  card: 'rounded-xl border border-stone-200/80 bg-white',
  cardHeader: 'flex items-start justify-between gap-4 p-5',
  cardContentDense: 'p-4',
  cardContentAiry: 'p-5',
  cardFooter: 'border-t border-stone-200 bg-white p-4',
  divider: 'h-px bg-stone-200/70',
  panel: 'rounded-2xl border border-stone-200 bg-stone-50/60 p-6',
  popoverShadow: 'shadow-[0_20px_60px_rgba(0,0,0,0.10)]',
  heroOverlayShadow: 'shadow-[0_30px_90px_rgba(0,0,0,0.12)]',
  tableWrap: 'overflow-hidden rounded-xl border border-stone-200',
  thead: 'bg-stone-50 text-xs font-semibold text-stone-600',
  rowHover: 'hover:bg-stone-50/60',
  chip: 'inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-3 py-2',
  iconButton: 'rounded-xl border border-stone-200 bg-white p-2 text-stone-700 hover:bg-stone-50',
  inputWrap: 'flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2',
  input: 'flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400',
};

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className={cn(UI_TOKENS.card, 'p-4 sm:p-6')}>
      <div className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {subtitle ? <p className="text-sm text-muted-foreground mt-1">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function SurfaceCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className={cn(UI_TOKENS.card, '')}>
      <CardHeader className={cn(UI_TOKENS.cardHeader, 'pb-2')}>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className={UI_TOKENS.cardContentDense}>{children}</CardContent>
    </Card>
  );
}

export default function SystemDesignPage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [switchValue, setSwitchValue] = useState(true);
  const [checkboxValue, setCheckboxValue] = useState<boolean>(true);
  const [radioValue, setRadioValue] = useState('obra');
  const [selectValue, setSelectValue] = useState('admin');
  const [tabValue, setTabValue] = useState('overview');
  const [isCollapsibleOpen, setIsCollapsibleOpen] = useState(true);
  const [ddChecked, setDdChecked] = useState(true);
  const [ddDensity, setDdDensity] = useState('comfortable');
  const [cmView, setCmView] = useState('grid');
  const [cmPinned, setCmPinned] = useState(true);
  const [sortableItems, setSortableItems] = useState([
    'Columna Obra',
    'Entidad',
    'Período',
    'Monto certificado',
    'Cobrado',
  ]);

  const densityLabel = useMemo(() => (ddDensity === 'compact' ? 'Compacta' : ddDensity === 'cozy' ? 'Cozy' : 'Cómoda'), [ddDensity]);

  return (
    <div className="min-h-screen bg-stone-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 xl:px-10">
        <div className={cn('mb-6 flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between', UI_TOKENS.card, UI_TOKENS.heroOverlayShadow)}>
          <div>
            <div className={cn(UI_TOKENS.chip, 'rounded-full py-1 text-xs text-muted-foreground')}>
              <Sparkles className="h-3.5 w-3.5 text-orange-primary" />
              Internal UI Showcase
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">System Design</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Showcase de componentes, estilos y patrones visuales usados en la app.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/dashboard">Ir al dashboard</Link>
            </Button>
            <Button asChild className="bg-zinc-900 text-white hover:bg-zinc-800">
              <Link href="/excel">Abrir app</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className={cn('h-fit p-3 lg:sticky lg:top-4', UI_TOKENS.card)}>
            <div className="mb-2 px-2 text-xs uppercase tracking-wide text-muted-foreground">Secciones</div>
            <nav className="space-y-1 text-sm">
              {[
                ['tokens', 'Tokens + tipografía'],
                ['buttons', 'Buttons + badges'],
                ['forms', 'Forms'],
                ['data', 'Data display'],
                ['menus', 'Menus + overlays'],
                ['command', 'Command + keyboard'],
                ['files', 'Files + folders'],
                ['app-patterns', 'App patterns'],
              ].map(([id, label]) => (
                <a key={id} href={`#${id}`} className="block rounded-lg px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                  {label}
                </a>
              ))}
            </nav>
          </aside>

          <main className="space-y-6">
            <div className="space-y-6">
              <Section title="Reglas Visuales (base)" subtitle="Sistema visual estable para páginas nuevas y refactors.">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className={UI_TOKENS.panel}>
                    <ul className="space-y-2 text-sm text-stone-700">
                      <li><span className="font-medium">Surfaces:</span> fondo `bg-stone-100`, cards `bg-white`, paneles internos `bg-stone-50/60`.</li>
                      <li><span className="font-medium">Borde primero:</span> `border-stone-200/80` + sombra mínima (`1px`) por defecto.</li>
                      <li><span className="font-medium">Radius:</span> `rounded-xl` controles, `rounded-2xl` cards, `rounded-3xl` hero/overlays.</li>
                      <li><span className="font-medium">Spacing:</span> headers `p-5`, content `p-4/p-5`, filas `px-4 py-3`, controles `px-3 py-2`.</li>
                      <li><span className="font-medium">Hover:</span> `hover:bg-stone-50` (botones), `hover:bg-stone-50/60` (rows).</li>
                    </ul>
                  </div>
                  <div className={cn(UI_TOKENS.card, 'p-4')}>
                    <p className="mb-3 text-xs uppercase tracking-wide text-stone-500">Tokens de clases (copy/paste)</p>
                    <ScrollArea className="h-52 rounded-xl border border-stone-200 bg-white">
                      <div className="space-y-2 p-3 font-mono text-xs">
                        {Object.entries(UI_TOKENS).map(([key, value]) => (
                          <div key={key} className="rounded-lg border border-stone-200 bg-stone-50/60 p-2">
                            <div className="text-stone-500">{key}</div>
                            <div className="mt-1 text-stone-800 break-all">{value}</div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              </Section>
            </div>

            <div id="tokens" className="space-y-6">
              <Section title="Tokens + Tipografía" subtitle="Paleta base, superficies y jerarquías de texto del sistema.">
                <div className="grid gap-4 xl:grid-cols-2">
                  <SurfaceCard title="Color Tokens">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {TOKENS.map((token) => (
                        <div key={token.name} className="space-y-2">
                          <div className={cn('h-16 rounded-lg', token.className, token.border && 'border border-stone-200')} />
                          <div className="text-xs">
                            <div className="font-medium text-stone-900">{token.name}</div>
                            <div className="text-stone-500">utility</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </SurfaceCard>

                  <SurfaceCard title="Typography Scale">
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-stone-500">Display</p>
                        <p className="text-3xl font-semibold tracking-tight">Panel de Control</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-stone-500">Section title</p>
                        <p className="text-xl font-semibold tracking-tight">Curva de avance</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-stone-500">Body</p>
                        <p className="text-sm text-stone-600">
                          Texto base para formularios, tablas y descripciones en vistas de obra.
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-stone-500">Mono / numeric</p>
                        <p className="font-mono text-sm">$ 12.345.678,90 · 2026-02 · 98.45%</p>
                      </div>
                    </div>
                  </SurfaceCard>
                </div>
              </Section>
            </div>

            <div id="buttons" className="space-y-6">
              <Section title="Buttons + Badges" subtitle="Acciones primarias/secundarias y estados visuales recurrentes.">
                <div className="grid gap-4 xl:grid-cols-2">
                  <SurfaceCard title="Buttons">
                    <div className="flex flex-wrap gap-2">
                      <Button>Primary</Button>
                      <Button variant="secondary">Secondary</Button>
                      <Button variant="outline">Outline</Button>
                      <Button variant="ghost">Ghost</Button>
                      <Button variant="destructive">Destructive</Button>
                      <Button size="sm">Small</Button>
                      <Button size="icon" aria-label="More">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span className={UI_TOKENS.chip}>
                        <Palette className="h-4 w-4 text-stone-600" />
                        Chip token
                      </span>
                      <button type="button" className={UI_TOKENS.iconButton} aria-label="Search demo">
                        <Search className="h-4 w-4" />
                      </button>
                    </div>
                  </SurfaceCard>

                  <SurfaceCard title="Badges / Status Pills">
                    <div className="flex flex-wrap gap-2">
                      <Badge>Default</Badge>
                      <Badge variant="secondary">Secondary</Badge>
                      <Badge variant="outline">Outline</Badge>
                      <Badge variant="destructive">Error</Badge>
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        <Check className="h-3 w-3" /> Completada
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                        <AlertTriangle className="h-3 w-3" /> Atención
                      </span>
                    </div>
                  </SurfaceCard>
                </div>
              </Section>
            </div>

            <div id="forms" className="space-y-6">
              <Section title="Forms" subtitle="Inputs, selects, toggles y patrones de formulario usados en tabs y modales.">
                <div className="grid gap-4 xl:grid-cols-2">
                  <SurfaceCard title="Field Controls">
                    <div className="space-y-4">
                      <div className={UI_TOKENS.inputWrap}>
                        <Search className="h-4 w-4 text-stone-500" />
                        <input className={UI_TOKENS.input} placeholder="InputWrap token (búsqueda rápida)" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="obra-name">Nombre de obra</Label>
                        <Input id="obra-name" placeholder="Ej. Escuela de Policía - Dormitorios" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="notes">Observaciones</Label>
                        <Textarea id="notes" placeholder="Notas internas, seguimiento, comentarios..." rows={4} />
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Rol</Label>
                          <Select value={selectValue} onValueChange={setSelectValue}>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar rol" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin obra</SelectItem>
                              <SelectItem value="gerencia">Gerencia</SelectItem>
                              <SelectItem value="inspeccion">Inspección</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Vencimiento</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-start text-left font-normal">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : 'Elegir fecha'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </div>
                  </SurfaceCard>

                  <SurfaceCard title="Booleans + Options">
                    <div className="space-y-5">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <p className="text-sm font-medium">Alertas automáticas</p>
                            <p className="text-xs text-muted-foreground">Activar reglas por thresholds</p>
                          </div>
                          <Switch checked={switchValue} onCheckedChange={setSwitchValue} />
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <p className="text-sm font-medium">Incluir OCR reprocesable</p>
                            <p className="text-xs text-muted-foreground">Guardar datos fuente y mapeo</p>
                          </div>
                          <Checkbox checked={checkboxValue} onCheckedChange={(v) => setCheckboxValue(v === true)} />
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <Label>Destino de acción</Label>
                        <RadioGroup value={radioValue} onValueChange={setRadioValue} className="grid gap-2">
                          <div className="flex items-center gap-2 rounded-md border p-2">
                            <RadioGroupItem value="obra" id="r-obra" />
                            <Label htmlFor="r-obra">Solo esta obra</Label>
                          </div>
                          <div className="flex items-center gap-2 rounded-md border p-2">
                            <RadioGroupItem value="tenant" id="r-tenant" />
                            <Label htmlFor="r-tenant">Toda la organización</Label>
                          </div>
                          <div className="flex items-center gap-2 rounded-md border p-2">
                            <RadioGroupItem value="macro" id="r-macro" />
                            <Label htmlFor="r-macro">Macro-reporte</Label>
                          </div>
                        </RadioGroup>
                      </div>
                    </div>
                  </SurfaceCard>
                </div>
              </Section>
            </div>

            <div id="data" className="space-y-6">
              <Section title="Data Display" subtitle="Cards, tablas, placeholders y componentes de datos visuales.">
                <div className="grid gap-4 xl:grid-cols-2">
                  <SurfaceCard title="Cards + Metrics (dashboard style)">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {[
                        ['Avance', '74%', 'bg-cyan-600', 74],
                        ['Plazo', '61%', 'bg-blue-600', 61],
                        ['Cobrado', '42%', 'bg-emerald-600', 42],
                      ].map(([label, value, barClass, pct]) => (
                        <div key={label} className="rounded-xl border border-stone-200 bg-white p-3">
                          <div className="flex items-center justify-between text-xs text-stone-500">
                            <span>{label}</span>
                            <span className="tabular-nums">{String(pct)}%</span>
                          </div>
                          <div className="mt-1 text-base font-semibold">{value}</div>
                          <div className="mt-2 h-2 rounded-full bg-stone-100">
                            <div className={cn('h-2 rounded-full', String(barClass))} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-lg border border-stone-200 bg-stone-50/60 px-3 py-2 text-sm">
                        <div className="text-xs uppercase tracking-wide text-stone-500">Obras activas</div>
                        <div className="mt-1 inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-2 py-1 text-xs text-stone-700">
                          <Circle className="h-2 w-2 fill-cyan-600 text-cyan-600" /> 12 activas
                        </div>
                      </div>
                      <div className="rounded-lg border border-stone-200 bg-stone-50/60 px-3 py-2 text-sm">
                        <div className="text-xs uppercase tracking-wide text-stone-500">Densidad</div>
                        <div className="mt-1 text-sm">{densityLabel}</div>
                      </div>
                    </div>
                  </SurfaceCard>

                  <SurfaceCard title="Table + States">
                    <div className={UI_TOKENS.tableWrap}>
                      <Table>
                        <TableCaption>Macro-tabla contable (demo)</TableCaption>
                        <TableHeader className={UI_TOKENS.thead}>
                          <TableRow>
                            <TableHead>Obra</TableHead>
                            <TableHead>Entidad</TableHead>
                            <TableHead>Período</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow className={UI_TOKENS.rowHover}>
                            <TableCell>Esc. Policía</TableCell>
                            <TableCell>Ministerio</TableCell>
                            <TableCell>Jul 2025</TableCell>
                            <TableCell className="text-right">$ 234.749.391</TableCell>
                          </TableRow>
                          <TableRow data-state="selected" className={UI_TOKENS.rowHover}>
                            <TableCell>Cuartel Bomberos</TableCell>
                            <TableCell>D.P.O.</TableCell>
                            <TableCell>Ago 2025</TableCell>
                            <TableCell className="text-right">$ 98.420.000</TableCell>
                          </TableRow>
                        </TableBody>
                        <TableFooter>
                          <TableRow>
                            <TableCell colSpan={3}>Total</TableCell>
                            <TableCell className="text-right">$ 333.169.391</TableCell>
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <Skeleton className="h-14 rounded-lg" />
                      <Skeleton className="h-14 rounded-lg" />
                      <Skeleton className="h-14 rounded-lg" />
                    </div>
                  </SurfaceCard>
                </div>
              </Section>
            </div>

            <div id="menus" className="space-y-6">
              <Section title="Menus + Overlays" subtitle="Patrones de interacción de menús, tooltips, popovers, dialogs y panels.">
                <div className="grid gap-4 xl:grid-cols-2">
                  <SurfaceCard title="Tooltip / HoverCard / Dropdown / ContextMenu">
                    <div className="flex flex-wrap items-center gap-3">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline">Tooltip</Button>
                        </TooltipTrigger>
                        <TooltipContent sideOffset={6}>Acción rápida de la UI</TooltipContent>
                      </Tooltip>

                      <HoverCard>
                        <HoverCardTrigger asChild>
                          <Button variant="outline">Hover card</Button>
                        </HoverCardTrigger>
                        <HoverCardContent className={UI_TOKENS.popoverShadow}>
                          <div className="p-4">
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarImage src="https://avatars.githubusercontent.com/u/1?v=4" alt="avatar" />
                                <AvatarFallback>AD</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-medium">Admin Obra</p>
                                <p className="text-xs text-stone-500">Permisos: edición + reportes</p>
                              </div>
                            </div>
                          </div>
                        </HoverCardContent>
                      </HoverCard>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline">
                            Menú <ChevronsUpDown className="ml-2 h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuLabel>Vista</DropdownMenuLabel>
                          <DropdownMenuCheckboxItem checked={ddChecked} onCheckedChange={setDdChecked}>
                            Mostrar miniaturas
                          </DropdownMenuCheckboxItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>Densidad</DropdownMenuLabel>
                          <DropdownMenuRadioGroup value={ddDensity} onValueChange={setDdDensity}>
                            <DropdownMenuRadioItem value="compact">Compacta</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="cozy">Cozy</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="comfortable">Cómoda</DropdownMenuRadioItem>
                          </DropdownMenuRadioGroup>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>
                            Exportar
                            <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="mt-4">
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div className="rounded-lg border border-stone-200 border-dashed bg-stone-50/40 p-4 text-sm text-stone-500">
                            Click derecho acá para abrir `ContextMenu` (demo)
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem>Renombrar</ContextMenuItem>
                          <ContextMenuItem>Duplicar</ContextMenuItem>
                          <ContextMenuCheckboxItem checked={cmPinned} onCheckedChange={setCmPinned}>
                            Fijar carpeta
                          </ContextMenuCheckboxItem>
                          <ContextMenuSeparator />
                          <ContextMenuRadioGroup value={cmView} onValueChange={setCmView}>
                            <ContextMenuRadioItem value="grid">Grid</ContextMenuRadioItem>
                            <ContextMenuRadioItem value="list">List</ContextMenuRadioItem>
                          </ContextMenuRadioGroup>
                        </ContextMenuContent>
                      </ContextMenu>
                    </div>
                  </SurfaceCard>

                  <SurfaceCard title="Dialog / Sheet / AlertDialog">
                    <div className="flex flex-wrap gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline">Abrir dialog</Button>
                        </DialogTrigger>
                        <DialogContent className={UI_TOKENS.popoverShadow}>
                          <DialogHeader>
                            <DialogTitle>Editar metadata</DialogTitle>
                            <DialogDescription>Formulario modal para acciones rápidas.</DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-3 p-4">
                            <Input placeholder="Nombre de documento" />
                            <Textarea rows={3} placeholder="Comentario" />
                          </div>
                          <DialogFooter>
                            <Button variant="outline">Cancelar</Button>
                            <Button>Guardar</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <Sheet>
                        <SheetTrigger asChild>
                          <Button variant="outline">Abrir sheet</Button>
                        </SheetTrigger>
                        <SheetContent side="right" className={UI_TOKENS.popoverShadow}>
                          <SheetHeader>
                            <SheetTitle>Panel lateral</SheetTitle>
                            <SheetDescription>Patrón usado para detalle/acciones contextuales.</SheetDescription>
                          </SheetHeader>
                          <div className="space-y-3 px-4">
                            <div className="rounded-lg border p-3 text-sm">
                              <p className="font-medium">Documento activo</p>
                              <p className="text-stone-500 text-xs">PMC Abril · v2</p>
                            </div>
                            <div className="rounded-lg border p-3 text-sm">
                              <p className="font-medium">Comentarios</p>
                              <p className="text-stone-500 text-xs">2 comentarios pendientes</p>
                            </div>
                          </div>
                          <SheetFooter>
                            <Button className="w-full">Aplicar</Button>
                          </SheetFooter>
                        </SheetContent>
                      </Sheet>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive">Alert dialog</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className={UI_TOKENS.popoverShadow}>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar archivo?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. Se eliminará el documento y sus versiones.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction>Eliminar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </SurfaceCard>
                </div>
              </Section>
            </div>

            <div id="command" className="space-y-6">
              <Section title="Command + Keyboard" subtitle="Patrones tipo Raycast / command palette usados para navegación y acciones.">
                <div className="grid gap-4 xl:grid-cols-2">
                  <SurfaceCard title="Command Palette (inline)">
                    <Command className="rounded-xl border border-stone-200 bg-white">
                      <CommandInput placeholder="Buscar acción, tabla, documento..." />
                      <CommandList>
                        <CommandEmpty>Sin resultados</CommandEmpty>
                        <CommandGroup heading="Acciones">
                          {commandItems.map(([label, shortcut]) => (
                            <CommandItem key={label}>
                              <CommandIcon className="h-4 w-4" />
                              {label}
                              <CommandShortcut>{shortcut}</CommandShortcut>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                        <CommandSeparator />
                        <CommandGroup heading="Módulos">
                          <CommandItem><LayoutGrid className="h-4 w-4" /> Dashboard</CommandItem>
                          <CommandItem><Table2 className="h-4 w-4" /> Reportes</CommandItem>
                          <CommandItem><Wand2 className="h-4 w-4" /> Extracción</CommandItem>
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </SurfaceCard>

                  <SurfaceCard title="Kbd / Shortcut tokens">
                    <div className="space-y-4 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>Abrir command palette</span>
                        <KbdGroup>
                          <Kbd>Ctrl</Kbd>
                          <Kbd>K</Kbd>
                        </KbdGroup>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span>Guardar cambios</span>
                        <KbdGroup>
                          <Kbd>Ctrl</Kbd>
                          <Kbd>S</Kbd>
                        </KbdGroup>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span>Reprocesar OCR</span>
                        <KbdGroup>
                          <Kbd>Shift</Kbd>
                          <Kbd>R</Kbd>
                        </KbdGroup>
                      </div>
                    </div>
                  </SurfaceCard>
                </div>
              </Section>
            </div>

            <div id="files" className="space-y-6">
              <Section title="Files + Folders" subtitle="Visuales usados en documentos-tab, thumbnails y previews.">
                <div className="grid gap-4 xl:grid-cols-2">
                  <SurfaceCard title="Folder assets (custom)">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-3">
                        <FolderFront className="h-auto w-full" firstStopColor="#9a8f7a" secondStopColor="#655d53" />
                        <p className="mt-2 text-xs text-stone-500">FolderFront (filled)</p>
                      </div>
                      <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-3">
                        <div className="flex h-[143px] items-center justify-center">
                          <FolderFrontEmpty className="h-auto w-full max-w-[180px]" />
                        </div>
                        <p className="mt-2 text-xs text-stone-500">FolderFrontEmpty (dashed)</p>
                      </div>
                    </div>
                  </SurfaceCard>

                  <SurfaceCard title="Document grid pattern">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {[
                        ['CERT-03.pdf', 'PDF'],
                        ['PMC-ABR.xlsx', 'Excel'],
                        ['Acta inicio.pdf', 'PDF'],
                        ['Curva plan.csv', 'CSV'],
                        ['Portada v2.png', 'Imagen'],
                        ['Contrato.pdf', 'PDF'],
                      ].map(([name, type]) => (
                        <div key={name} className="rounded-xl border border-stone-200 bg-white p-2 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
                          <div className="flex items-center justify-between">
                            <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-700">{type}</span>
                            <Badge variant="secondary" className="rounded-full text-[10px]">{name.includes('PMC') ? 'Activo' : 'Item'}</Badge>
                          </div>
                          <p className="mt-2 truncate text-xs font-medium">{name}</p>
                          <p className="text-[10px] text-stone-500">Vista previa disponible</p>
                        </div>
                      ))}
                    </div>
                  </SurfaceCard>
                </div>
              </Section>
            </div>

            <div id="app-patterns" className="space-y-6">
              <Section title="App Patterns" subtitle="Composición y patrones reales: tabs, collapsibles, scroll areas, sortables y paper report style.">
                <div className="grid gap-4 xl:grid-cols-2">
                  <SurfaceCard title="Tabs + Collapsible + ScrollArea">
                    <Tabs value={tabValue} onValueChange={setTabValue}>
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="docs">Documentos</TabsTrigger>
                        <TabsTrigger value="reports">Reportes</TabsTrigger>
                      </TabsList>
                      <TabsContent value="overview" className="mt-3 space-y-3">
                        <Collapsible open={isCollapsibleOpen} onOpenChange={setIsCollapsibleOpen}>
                          <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-white p-3">
                            <div>
                              <p className="text-sm font-medium">Filtros rápidos</p>
                              <p className="text-xs text-stone-500">Estado, entidad, período, usuario</p>
                            </div>
                            <CollapsibleTrigger asChild>
                              <Button variant="outline" size="sm">
                                <SlidersHorizontal className="mr-2 h-4 w-4" />
                                {isCollapsibleOpen ? 'Ocultar' : 'Mostrar'}
                              </Button>
                            </CollapsibleTrigger>
                          </div>
                          <CollapsibleContent className="mt-2 grid gap-2 rounded-lg border border-stone-200 bg-stone-50/60 p-3 sm:grid-cols-2">
                            <Input placeholder="Buscar obra" />
                            <Input placeholder="Entidad" />
                          </CollapsibleContent>
                        </Collapsible>

                        <ScrollArea className="h-40 rounded-lg border border-stone-200 bg-white">
                          <div className="space-y-2 p-3 text-sm">
                            {Array.from({ length: 14 }).map((_, i) => (
                              <div key={i} className="flex items-center justify-between rounded-md border border-stone-200 bg-white px-3 py-2 hover:bg-stone-50/60">
                                <span>Evento #{i + 1}</span>
                                <Badge variant="outline">audit-log</Badge>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </TabsContent>
                      <TabsContent value="docs" className="mt-3 rounded-lg border border-stone-200 border-dashed bg-stone-50/40 p-4 text-sm text-stone-500">
                        Layout de documentos-tab: file tree + grid + preview.
                      </TabsContent>
                      <TabsContent value="reports" className="mt-3 rounded-lg border border-stone-200 border-dashed bg-stone-50/40 p-4 text-sm text-stone-500">
                        Layout de reportes: filtros + tabla + export.
                      </TabsContent>
                    </Tabs>
                  </SurfaceCard>

                  <SurfaceCard title="Sortable + Accordion + Report Paper">
                    <div className="space-y-4">
                      <div>
                        <p className="mb-2 text-xs uppercase tracking-wide text-stone-500">Ordenar columnas (drag & drop)</p>
                        <Sortable value={sortableItems} onValueChange={setSortableItems}>
                          <SortableContent className="space-y-2">
                            {sortableItems.map((item) => (
                              <SortableItem key={item} value={item} className="rounded-lg border border-stone-200 bg-white">
                                <div className="flex items-center gap-2 px-3 py-2">
                                  <SortableItemHandle className="rounded-md p-1 hover:bg-stone-50">
                                    <GripVertical className="h-4 w-4 text-stone-500" />
                                  </SortableItemHandle>
                                  <span className="text-sm">{item}</span>
                                </div>
                              </SortableItem>
                            ))}
                          </SortableContent>
                          <SortableOverlay>
                            {({ value }) => (
                              <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 shadow-[0_20px_60px_rgba(0,0,0,0.10)] text-sm">{String(value)}</div>
                            )}
                          </SortableOverlay>
                        </Sortable>
                      </div>

                      <Accordion type="single" collapsible>
                        <AccordionItem value="a1">
                          <AccordionTrigger>Reporte estilo “paper”</AccordionTrigger>
                          <AccordionContent>
                            <div className="overflow-auto rounded-lg border border-stone-200 bg-stone-100 p-3">
                              <div className="report-paper scale-[0.42] origin-top-left">
                                <div className="report-border-top" />
                                <div className="report-header-block">
                                  <div className="report-company">Sintesis</div>
                                  <div className="report-divider" />
                                  <div className="report-meta">
                                    <span className="report-title-text">Certificados - Contable</span>
                                    <span className="report-date-text">22/02/2026</span>
                                  </div>
                                </div>
                                <div className="report-body">
                                  <div className="rounded border border-stone-200 p-3 text-xs">
                                    Vista de estilo para exportes PDF/reportes impresos.
                                  </div>
                                  <div className="report-footer-line" />
                                </div>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>
                  </SurfaceCard>
                </div>
              </Section>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
