# Plan: Migración a Light Theme

## Contexto
La herramienta usa **Tailwind CSS + React (Vite)**. Actualmente tiene un dark theme baked in con clases Tailwind oscuras y varios inline styles con hexadecimales hardcodeados. Se quiere migrar a un tema claro y profesional basado en el mockup `mockup_light.html` (ya creado en la raíz del proyecto).

## Paleta objetivo (del mockup aprobado)
- **Fondo página:** `#F2F4F7`
- **Cards:** `#FFFFFF` con `border: 1px solid #E4E8EE` y `box-shadow: 0 1px 4px rgba(28,37,55,0.05)`
- **Fondo secundario / hover:** `#F8F9FB` / `#F0F2F5`
- **Texto primario:** `#1C2537`
- **Texto secundario:** `#374151` / `#475569`
- **Labels / subtítulos:** `#6B7A90` — NO gris puro, el usuario pidió explícitamente que los títulos no se pierdan
- **Acento:** `#3B6FD4` (azul pizarra)
- **Verde positivo:** `#16A34A`
- **Rojo negativo:** `#DC2626`
- **Borde:** `#E4E8EE` / `#EEF0F4`

## Estrategia
**Dos frentes:**
1. **`src/index.css`** — overrides de utilidades Tailwind con `!important` (cero cambios en JSX para colores gestionados por Tailwind)
2. **JSX files** — reemplazar inline styles y clases con hexadecimales arbitrarios (`bg-[#0b1121]`, etc.)

---

## Paso 1 — `src/index.css`

Reescribir completamente. Estructura:

```
@tailwind base;
@tailwind components;
@tailwind utilities;

/* body */
body { background: #F2F4F7; color: #1C2537; }

/* Overrides bg-slate-* */
/* Overrides text-slate-* y text-white */
/* Overrides border-slate-*, border-white/* */
/* Overrides hover:, divide-* */
/* Overrides gradient stops from-slate-*, to-slate-* */
/* Overrides bg-white/5, bg-white/[0.02] etc */
/* Modal backdrop: bg-slate-950/40 → rgba(28,37,55,0.4) — mantener oscuro */

/* Reescritura de custom classes:
   .amount-input, .qty-input, .stat-card, .section-label,
   .highlight-val, .sub-val, .badge-calc, .tooltip-box, .skeleton */
```

### Mapeo completo de overrides

**Backgrounds:**
| Clase Tailwind | Nuevo valor |
|---|---|
| `bg-slate-950` | `#EAECF0` |
| `bg-slate-950/40` | `rgba(28,37,55,0.4)` ← mantener oscuro (backdrop modal) |
| `bg-slate-900` | `#F8F9FB` |
| `bg-slate-900/50` | `rgba(248,249,251,0.9)` |
| `bg-slate-900/60` | `rgba(248,249,251,0.95)` |
| `bg-slate-900/80` | `rgba(255,255,255,0.98)` |
| `bg-slate-800` | `#FFFFFF` |
| `bg-slate-800/50` | `rgba(255,255,255,0.9)` |
| `bg-slate-800/20` | `rgba(255,255,255,0.5)` |
| `bg-slate-700` | `#F0F2F5` |
| `bg-slate-700/30` | `rgba(240,242,245,0.6)` |
| `bg-slate-700/60` | `rgba(240,242,245,0.95)` |
| `bg-white/5` | `rgba(28,37,55,0.02)` |
| `bg-white/[0.02]` | `rgba(28,37,55,0.01)` |
| `bg-white/[0.03]` | `rgba(28,37,55,0.02)` |
| `bg-white/[0.05]` | `rgba(28,37,55,0.03)` |

**Texto:**
| Clase Tailwind | Nuevo valor |
|---|---|
| `text-white` | `#1C2537` |
| `text-slate-200` | `#2D3748` |
| `text-slate-300` | `#374151` |
| `text-slate-400` | `#475569` |
| `text-slate-500` | `#64748B` |
| `text-slate-600` | `#6B7A90` |
| `text-slate-700` | `#8A96A8` |

⚠️ **Excepción crítica:** `button.text-white` y `a.text-white` → `#FFFFFF` (texto blanco en botones con bg de color)

**Borders:**
| Clase Tailwind | Nuevo valor |
|---|---|
| `border-slate-700` | `#E4E8EE` |
| `border-slate-700/30` | `rgba(228,232,238,0.8)` |
| `border-slate-700/50` | `rgba(228,232,238,0.9)` |
| `border-slate-800` | `#EEF0F4` |
| `border-slate-800/40` | `rgba(238,240,244,0.9)` |
| `border-slate-600` | `#D8DDE6` |
| `border-slate-600/30` | `rgba(216,221,230,0.8)` |
| `border-white/5` | `rgba(28,37,55,0.06)` |
| `border-white/10` | `rgba(28,37,55,0.09)` |
| `border-white/20` | `rgba(28,37,55,0.13)` |

**Hover / Divide:**
- `hover:bg-slate-700/30` → `rgba(240,242,245,0.6)`
- `hover:bg-slate-800` → `#F8F9FB`
- `hover:bg-slate-700` → `#F0F2F5`
- `hover:border-slate-700/70` → `rgba(228,232,238,0.95)`
- `hover:border-slate-600` → `#C8D0DA`
- `divide-slate-700` → `#E4E8EE`
- `divide-slate-800` → `#EEF0F4`

**Gradient stops:**
- `from-slate-800` → `#FFFFFF`
- `from-slate-900` → `#F8F9FB`
- `to-slate-900` → `#F8F9FB`
- `to-slate-800` → `#FFFFFF`

**Custom classes (reescribir completamente):**
- `.amount-input` → fondo transparente, borde bottom `#D8DDE6`, texto `#1C2537`, focus border `#3B6FD4`
- `.qty-input` → fondo `#F0F2F5`, borde `#D8DDE6`, texto `#475569`
- `.stat-card` → fondo `rgba(255,255,255,0.9)`, borde `#E4E8EE`
- `.section-label` → color `#6B7A90`
- `.highlight-val` / `.sub-val` → color `#1C2537`
- `.badge-calc` → fondo `#F0F2F5`, borde `#E4E8EE`, texto `#6B7A90`
- `.tooltip-box` → fondo `#FFFFFF`, borde `#E4E8EE`, texto `#475569`, shadow light
- `.skeleton` → fondo `#EEF0F4`, shimmer con `rgba(255,255,255,0.7)`

---

## Paso 2 — `src/DashboardView.jsx`

### 2a. Modales (líneas ~101 y ~224)
```jsx
// ANTES
className="bg-[#0b1121]/90 backdrop-blur-xl border border-slate-700/50 ..."
// DESPUÉS
className="bg-white border border-slate-700/50 ..."
```

### 2b. ChartWrapper inline style (línea ~21)
```jsx
// ANTES
{ background: '#0b1121', border: '1px solid rgba(255,255,255,0.06)', ... }
// DESPUÉS
{ background: '#FFFFFF', border: '1px solid #E4E8EE', ... }
```

### 2c. Chart dataset config (líneas ~68 y ~401)
```js
// ANTES
pointBorderColor: '#070c18'
backgroundColor: '#070c18'   // (chart area bg)
// DESPUÉS
pointBorderColor: '#FFFFFF'
backgroundColor: '#F2F4F7'
```

---

## Paso 3 — `src/GuideView.jsx`

~12 ocurrencias de inline style. Reemplazar globalmente:
- `background: '#0b1121'` → `background: '#FFFFFF'`
- `border: '1px solid rgba(255,255,255,0.06)'` → `border: '1px solid #E4E8EE'`
- `border: '1px solid rgba(255,255,255,0.04)'` → `border: '1px solid #EEF0F4'`
- `border: '1px solid rgba(244,63,94,0.15)'` → `border: '1px solid rgba(220,38,38,0.2)'` (rojo suave, visible en claro)

---

## Paso 4 — `src/MarginExpectationView.jsx`

Inline styles a cambiar (líneas ~12, ~53, ~72, ~402):
- `background: '#0b1121'` → `background: '#FFFFFF'`
- `background: '#070c18'` (inputs) → `background: '#F8F9FB'`
- `border: '1px solid #334155'` → `border: '1px solid #D8DDE6'`

---

## Paso 5 — `src/StructuralCostsModal.jsx`

(línea ~45)
```jsx
// ANTES
className="bg-[#0b1121]/90 backdrop-blur-xl border border-slate-700/50 ..."
// DESPUÉS
className="bg-white border border-slate-700/50 ..."
```

---

## Notas importantes

- Los colores semánticos (`emerald-*`, `blue-*`, `rose-*`, `amber-*`, `violet-*`) **no se tocan** — son los indicadores de estado y se ven bien en fondo claro.
- `bg-black/80` (overlay de modal) **no se toca** — correcto en oscuro.
- `bg-blue-900/40` (botón cancelar oscuro) puede quedar ligeramente feo en claro — revisar después de la primer pasada.
- El mockup de referencia está en: `mockup_light.html` (raíz del proyecto).
- El usuario especificó: **títulos NO grises** → `text-slate-400` mapea a `#475569` (azul-gris oscuro legible), no gris claro.
