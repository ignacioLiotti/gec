# Sintesis DS — Guía de migración

Referencia completa para migrar una pantalla al sistema de diseño Sintesis DS.
Seguir este documento en orden al trabajar en una pantalla nueva o refactorizar una existente.

---

## 1. Checklist de migración por pantalla

Antes de tocar código, recorrer esta lista:

- [ ] ¿Hay botones con variante incorrecta (`bg-primary` hardcodeado, gradientes custom)?
- [ ] ¿Hay sombras arbitrarias `shadow-[...]` fuera del sistema?
- [ ] ¿Los border-radius son consistentes con la escala?
- [ ] ¿El spacing usa el grid de 4px o tiene valores arbitrarios?
- [ ] ¿Las tabs usan `<TabsList>` / `<TabsTrigger>` del sistema?
- [ ] ¿Los filtros / chips usan `<Tray>` + `<Chip>`?
- [ ] ¿Los estados vacíos / loading son inline o usan componente eliminado?

---

## 2. Colores

### Tokens CSS

```css
/* Fondo y superficies */
--background   oklch(0.975 0 106)   /* off-white cálido — página */
--card         #ffffff              /* blanco puro — cards, paneles */
--muted        oklch(0.905 0 106)   /* stone claro — áreas secundarias */
--secondary    oklch(0.97 0.003 106)/* levemente cálido — hover bg */
--accent       oklch(0.96 0.005 106)/* hover fill en triggers */

/* Texto */
--foreground         oklch(0.145 0 0)  /* stone-900 — texto principal */
--muted-foreground   oklch(0.556 0 0)  /* stone-500 — texto secundario */
--card-foreground    oklch(0.145 0 0)

/* Marca */
--primary      #ff5800   /* naranja — solo para CTAs primarios y accents */

/* Bordes */
--border   oklch(0.17 0.01 0 / 8%)  /* ~8% negro — borde sutil universal */

/* Semáforo de fuentes de datos */
--src-extraction   #16a34a   /* verde */
--src-manual       #2563eb   /* azul */
--src-mixed        #9333ea   /* violeta */
```

### Paleta stone (usar en Tailwind directamente)

| Clase Tailwind | Hex | Uso típico |
|---|---|---|
| `stone-50` | `#fafaf9` | Fondo alterno muy sutil |
| `stone-100` | `#f5f5f4` | Hover background, tray fill |
| `stone-200` | `#e7e5e4` | Bordes visibles, separadores |
| `stone-400` | `#a8a29e` | Placeholders, íconos inactivos |
| `stone-500` | `#78716c` | Texto muted, labels secundarios |
| `stone-700` | `#44403c` | Texto cuerpo |
| `stone-900` | `#1c1917` | Texto fuerte, botón dark, tab activa |

### Reglas de color

- **Nunca** `bg-primary` en texto — `--primary` es naranja, no un tono de gris.
- **Naranja** sólo para: botón CTA principal (`variant="default"`), accents de datos, estados activos destacados.
- **Negro** (#1a1a1a / stone-900) para: botón primary en UI densa (`variant="dark"`), tab activa top-nav.
- **Hardcoded hex** permitido sólo para: colores de report paper (dominio aparte), colores de gráficos.

---

## 3. Tipografía

### Escala de texto

| Token / clase | Tamaño | Uso |
|---|---|---|
| `text-xs` | 11px (`0.6875rem`) | Labels densos, badges, metadatos |
| `text-sm` | 13px (`0.8125rem`) | Texto UI por defecto, filas de tabla |
| `text-base` | 16px (Tailwind default) | Párrafos, texto de contenido |
| `text-lg` | 18px | Títulos de sección |
| `text-xl` | 20px | Títulos de página |
| `text-[10px]` | 10px | Microscopicos — preferir `text-xs` |

### Fuentes

```css
font-sans  → Geist Sans    /* todo el UI */
font-mono  → Geist Mono    /* números en tablas, código */
```

### Reglas de tipografía

- Usar `text-xs font-medium` para labels de formulario, no `text-[10px]` ni `text-[11px]`.
- El peso por defecto en UI denso es `font-medium` (500), no `font-normal`.
- `font-semibold` para encabezados de sección y headers de tabla.
- Evitar `text-[13px]` hardcodeado — usar `text-sm` (ya override a 13px).

---

## 4. Espaciado (grid de 4px)

### Escala

| Clase | px | Uso principal |
|---|---|---|
| `gap-1` / `p-1` | 4px | Separación mínima, padding interno de tray |
| `gap-1.5` | 6px | Gap entre ícono y label en botón/chip |
| `gap-2` | 8px | Gap entre elementos inline, padding xs |
| `gap-3` | 12px | Gap entre controles de toolbar |
| `gap-4` | 16px | Gap entre secciones de formulario |
| `gap-6` | 24px | Gap entre cards en grid |
| `p-3` | 12px | Padding de chip, padding compact |
| `p-4` | 16px | Padding de card estándar |
| `p-6` | 24px | Padding de panel o modal |
| `px-4 py-2` | 16/8px | Padding de botón default |
| `px-3` | 12px | Padding de botón sm |

### Casos de uso

```
Botón con ícono:       gap-1.5 entre ícono y texto
Toolbar de controles:  gap-2 entre botones
Secciones de form:     gap-4 entre campos
Cards en grid:         gap-6 (desktop) / gap-4 (mobile)
Header de card:        px-5 py-3.5
Body de card:          p-5 o p-6
Tabla: celda:          px-4 py-2 (header) / px-4 py-1.5 (row)
```

### Spacing arbitrario a reemplazar

```
gap-[14px]  →  gap-3.5
gap-[10px]  →  gap-2.5
gap-[8px]   →  gap-2
p-[12px]    →  p-3
px-[14px]   →  px-3.5
mt-[18px]   →  mt-4 o mt-[18px] si es excepción justificada
```

---

## 5. Border Radius

### Escala activa

Con `--radius: 0.5rem` en globals.css, el mapeo es:

| Clase Tailwind | px | Uso |
|---|---|---|
| `rounded-sm` | 4px | Items muy compactos (no recomendado) |
| `rounded-md` | 6px | — (poco usado, se saltea) |
| `rounded-lg` | 8px | **Controles UI**: botones, inputs, chips, selects |
| `rounded-xl` | 12px | **Cards y paneles**: ShellCard, dropdowns, popovers |
| `rounded-2xl` | 16px | **Overlays**: modals, drawers, dialogs grandes |
| `rounded-3xl` | 24px | Elementos especiales: day cells de calendario |
| `rounded-full` | 9999px | Badges, avatars, pills, chips de origen |

### Reglas de radius

- **Botón** → `rounded-lg` (definido en `button.tsx`, no override)
- **Input / Select** → `rounded-lg`
- **Card estándar** → `rounded-xl border border-stone-200`
- **Dropdown / Popover** → `rounded-xl shadow-lg`
- **Modal / Dialog** → `rounded-2xl`
- **Badge / Tag** → `rounded-full`
- **Tabla** → `rounded-none` (las celdas no tienen radius)
- **Toolbar panel** → `rounded-xl` con bordes abiertos hacia el contenido (`rounded-b-none` o `rounded-l-none`)

---

## 6. Sombras (sistema de elevación)

### Niveles

| Nivel | Clase / Valor | Dónde usar |
|---|---|---|
| 0 — Flat | `shadow-none` | Inline, dentro de tabla, contextos planos |
| 1 — Lifted | Ver `button.tsx` | Botones (hue-matched shadow) |
| 2 — Card | `shadow-card` (CSS var) | Cards, paneles flotantes |
| 3 — Dropdown | `shadow-md` | Dropdowns, tooltips, floating elements |
| 4 — Popover | `shadow-lg` | Popovers, comboboxes, date pickers |
| 5 — Modal | `shadow-xl` | Modals, dialogs |
| 6 — Overlay | `shadow-2xl` | Command palette, side sheets full-screen |

### Botones — lifted recipe

Cada variante tiene shadow hue-matched (2 capas externas + inset glint). **No agregar sombras custom a botones** — ya están en `button.tsx`.

```
default (naranja):    shadow rgba(180,90,30, .35/.20) + inset white 15%
dark (stone-900):     shadow rgba(0,0,0, .35/.20) + inset white 10%
outline (blanco):     shadow rgba(0,0,0, .08/.06) + inset white 80%
secondary (stone-100):shadow rgba(0,0,0, .06/.04) + inset white 70%
destructive (rojo):   shadow rgba(150,30,35, .35/.20) + inset white 12%
```

### Regla: nunca `shadow-[...]` custom si hay equivalente en el sistema

```tsx
// ❌ Mal
<div className="shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.06)]">

// ✅ Bien
<div className="shadow-card">
<div className="shadow-md">
```

---

## 7. Botones

### Variantes disponibles

| Variante | Cuándo usar |
|---|---|
| `default` | CTA principal único por pantalla — naranja lifted |
| `dark` | Acción primaria en UI densa, toolbars, confirmaciones importantes |
| `outline` | Acción secundaria — el más usado en UI general |
| `secondary` | Acción terciaria, menos énfasis que outline |
| `ghost` | Botones en toolbars donde el fondo ya da contexto |
| `destructive` | Eliminar, archivar — acción irreversible |
| `destructiveSecondary` | Confirmación de destructive (paso 2), warnings inline |
| `link` | Navegación inline en párrafos |

### Tamaños

| Size | h | Uso |
|---|---|---|
| `xs` | 28px | Badges-botón, chips de acción |
| `sm` | 32px | Toolbars compactas, acciones dentro de cards |
| `default` | 36px | Formularios, headers de página |
| `lg` | 40px | CTAs de onboarding, botones principales en vacío |
| `icon` | 36×36px | Solo ícono, mismo alto que default |
| `icon-sm` | 32×32px | Solo ícono en toolbar compacta |

### Reglas de botones

```tsx
// ❌ No usar bg hardcodeado en botones
<button className="bg-stone-900 text-white px-4 py-2 rounded-lg">

// ✅ Usar <Button> con variante
<Button variant="dark" size="sm">

// ❌ No agregar shadow manual encima del componente
<Button className="shadow-lg">

// ✅ Las sombras ya están en cada variante
<Button variant="outline">

// Botón con ícono — el gap ya está en base
<Button variant="outline" size="sm">
  <PlusIcon />
  Agregar
</Button>
```

---

## 8. Tabs

### Patrón tray + chip (default)

`<TabsList>` = contenedor tray (blanco, borde stone-200, rounded-xl, p-1)
`<TabsTrigger>` = chip pill, activo = stone-900 fill

```tsx
// Para tabs de contenido (settings, formularios)
<Tabs defaultValue="general">
  <TabsList>
    <TabsTrigger value="general">General</TabsTrigger>
    <TabsTrigger value="avanzado">Avanzado</TabsTrigger>
  </TabsList>
  <TabsContent value="general">...</TabsContent>
</Tabs>
```

### Patrón top-nav (dark pill, sin contenedor)

Para navegación principal entre vistas de una página (como General / Flujo / Documentos):

```tsx
<TabsList className="bg-transparent border-none p-0 gap-1 h-auto">
  <TabsTrigger
    value="general"
    className="h-9 gap-2 px-4 rounded-xl text-[13px] font-medium
               text-[#999] hover:bg-[#f5f5f5] hover:text-[#555]
               data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-white"
  >
    <Icon className="size-3.5" />
    General
  </TabsTrigger>
</TabsList>
```

### Patrón segment control (gris + pill blanco)

Para toggles de modo (Vista previa / Edición):

```tsx
<div className="inline-flex items-center rounded-xl border border-[#e8e8e8] bg-[#f5f5f5] p-1">
  {modes.map((m) => (
    <button
      key={m.value}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-[13px] font-medium transition",
        isActive ? "bg-white text-[#1a1a1a] shadow-sm" : "text-[#999] hover:text-[#555]"
      )}
    >
      <m.icon className="size-3.5" />
      {m.label}
    </button>
  ))}
</div>
```

---

## 9. Tray + Chip (filtros / origen de datos)

```tsx
import { Tray, Chip } from "@/components/ui/tray";

// Filtros de estado
<Tray>
  <Chip active={filter === "all"} onClick={() => setFilter("all")}>Todos</Chip>
  <Chip active={filter === "pending"} onClick={() => setFilter("pending")}>Pendientes</Chip>
</Tray>

// Chips con dot de origen de datos
<Tray>
  <Chip dot="extraction">Extracción</Chip>
  <Chip dot="manual">Manual</Chip>
  <Chip dot="mixed">Mixto</Chip>
</Tray>
```

---

## 10. Cards y paneles

### Shell card estándar

```tsx
<section className="overflow-hidden rounded-xl border border-[#e8e8e8] bg-white">
  <header className="flex items-center justify-between gap-3 border-b border-[#f0f0f0] px-5 py-3.5">
    <div className="flex items-center gap-2.5">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#e8e8e8] bg-[#fafafa]">
        <Icon className="size-3.5 text-[#999]" />
      </div>
      <h2 className="text-[13px] font-semibold text-[#1a1a1a]">{title}</h2>
    </div>
    {action}
  </header>
  <div className="p-5">{children}</div>
</section>
```

### Panel con toolbar (notch)

Para paneles que conectan con contenido debajo, usar `NotchTail` en la unión:

```tsx
<div
  className="relative rounded-xl border border-[#09090b1f] bg-card p-2 pb-0
             xl:rounded-b-none xl:border-b-0"
  style={{ "--notch-bg": "white", "--notch-stroke": "rgb(231 229 228)" } as CSSProperties}
>
  <Toolbar />
  <NotchTail side="right" className="mb-[1px]" />
</div>
```

---

## 11. Estados vacíos y loading

**No usar componentes separados** — inline directo en el JSX:

```tsx
// Loading
<div className="flex flex-col items-center gap-3 py-16">
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  <p className="text-sm text-muted-foreground">Cargando...</p>
</div>

// Error con retry
<div className="flex flex-col items-center gap-3 py-16">
  <p className="text-sm text-destructive">{errorMessage}</p>
  <Button variant="outline" size="sm" onClick={onRetry}>
    <RefreshCw />
    Reintentar
  </Button>
</div>

// Vacío
<p className="py-16 text-center text-sm text-muted-foreground">{emptyText}</p>

// Skeleton animate-pulse
<div className="flex h-[600px] animate-pulse gap-4">
  <div className="w-64 shrink-0 rounded-xl border bg-stone-100" />
  <div className="flex-1 rounded-xl border bg-stone-100" />
</div>
```

---

## 12. Proceso de migración de una pantalla

1. **Leer** la pantalla completa antes de cambiar nada.
2. **Identificar** los 3-5 componentes más usados en esa pantalla.
3. **Migrar en este orden**:
   a. Tokens (clases de color hardcodeadas → vars / clases Tailwind)
   b. Border radius (homogeneizar con la escala)
   c. Botones (variante y tamaño correcto)
   d. Spacing (reemplazar arbitrarios con grid de 4px)
   e. Sombras (reemplazar custom con nivel de elevación)
   f. Tabs / Tray si los hay
4. **No mejorar** lo que no está en alcance — si encontrás un bug o inconsistencia fuera de la pantalla, anotarlo pero no tocarlo.
5. **Verificar** que no se rompió nada en mobile (flex-wrap, overflow).
