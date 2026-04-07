# Prompt de Handoff — Estado Result · Fases 3 y 4

Copiá todo este texto y pegalo en una nueva ventana de chat.

---

Soy el dueño de una cafetería en Argentina. Tengo una aplicación de gestión financiera llamada **"Estado Result"** ubicada en:

```
c:\Users\Ryzen\Desktop\Facturas\Estado Result
```

## Stack

- **Frontend**: React + Vite + Tailwind CSS. Dev server corriendo con `npm run dev`.
- **Backend**: `BackEnd.gs` (Google Apps Script), desplegado como Web App en Google.
- **Base de datos**: Google Sheets con las hojas: `Movimientos`, `Sueldos`, `Maxirest`, `Proveedores`, `Categorias`, `Activos`, `Config`.

## Archivos principales

| Archivo | Rol |
|---|---|
| `BackEnd.gs` | Toda la lógica server-side: KPIs, clasificación de egresos, persistencia en Sheets |
| `src/App.jsx` | Orquestador: navegación por tabs, modales de carga, envío de datos al backend |
| `src/DashboardView.jsx` | Visualización de KPIs financieros del P&L |
| `src/FinanceContext.jsx` | Estado global React y comunicación con la API (doGet/doPost) |
| `src/parsers.js` | Parsers de Maxirest PDF, ARCA CSV y Sueldos CSV |
| `src/formatters.js` | Utilidades de formateo de números (`Utils.fmt`, `Utils.num`) |

## Archivos ya creados (no volver a crear)

| Archivo | Qué es |
|---|---|
| `src/IIBBModal.jsx` | Modal para cargar pago mensual de Ingresos Brutos |
| `src/RetentionsModal.jsx` | Modal para cargar retenciones bancarias (IVA/Ganancias de tarjetas y apps) |
| `src/CategoriesView.jsx` | Pantalla para asignar categoría de gasto por CUIT de proveedor |
| `src/AssetsView.jsx` | Gestión de activos fijos y amortizaciones mensuales |
| `src/GuideView.jsx` | Guía educativa con 5 secciones para el usuario sin conocimiento contable |

## Estructura de la API

### `doGet` — endpoints disponibles:
- `?action=GET_SUMMARY&start=YYYY-MM-DD&end=YYYY-MM-DD` → retorna el P&L
- `?action=GET_PROVIDERS` → lista de proveedores con CUIT y alias
- `?action=GET_CATEGORIES_MAP` → mapa CUIT → Categoría
- `?action=GET_ASSETS` → lista de activos fijos
- `?action=GET_EMPLOYEES&start=...&end=...` → empleados del período

### `doPost` — payload: `{ action, origen, payload }`
- `origen: 'ARCA'` → comprobantes ARCA
- `origen: 'MAXIREST'` → resumen de ventas
- `origen: 'SUELDOS'` → nómina
- `origen: 'MANUAL_COSTS'` → egresos manuales (IIBB, retenciones, estructurales, honorarios)
- `origen: 'SAVE_ALIASES'` → alias de proveedores
- `origen: 'SAVE_CATEGORIES'` → mapa CUIT → Categoría
- `origen: 'SAVE_ASSET'` → guardar activo fijo
- `origen: 'DELETE_ASSET'` → eliminar activo por UUID
- `origen: 'SYNC_CONFIG'` → guardar configuración global

## Objeto retornado por `getFinancialSummary()`

```js
{
  periodo: "YYYY-MM-DD al YYYY-MM-DD",
  ajustes: { ipc: 1.0, mep: 1400 },
  kpis: {
    utilidad_neta,          // resultado final
    ventas_netas_reales,    // ventas sin IVA y sin comisiones
    iva_posicion,           // débito - crédito fiscal
    margen_contribuccion,   // ventas - CMV - comisiones
    ticket_promedio,
    break_even_mensual,
    provision_sac           // informativo: egresoLaboral / 12
  },
  egresos: {
    cmv, laboral, estructural, honorarios,
    iibb, retenciones, amortizaciones, otros, comisiones
  },
  mix_pagos: { Efectivo, Tarjetas, Otros },
  history: [
    { periodo: "YYYY-MM", ventas, gastos, ventas_real, gastos_real, mep }
    // últimos 13 meses
  ]
}
```

## Tabs de navegación actuales en `App.jsx`

```
dashboard | empleados | arca | ventas | honorarios | estructurales
🏷️ Categorías | 🏧 Activos | 📖 Guía | 📥 Volver a Carga
```

Cada tab se agrega así en el switch de `renderTabContent()` y en el array de tabs del navbar.

## Modo de visualización (DashboardView)

El Dashboard tiene 3 modos: `nominal`, `real` (ajustado por IPC), `mep` (dólares MEP).
La función `getAdj(val)` aplica el multiplicador según el modo.

## Patrones de componentes modales

Ver `src/IIBBModal.jsx` como referencia. Props estándar: `{ isOpen, onClose, onConfirm, defaultDate }`.
`onConfirm(data, 'MANUAL_COSTS')` envía al backend.

Los colores del sistema de diseño:
- CMV: `#f59e0b`, Nómina: `#8b5cf6`, Estructurales: `#06b6d4`
- IIBB: `#f97316`, Amortizaciones: `#a78bfa`, Comisiones: `#f43f5e`
- Alertas: rojo `#f43f5e`, amarillo `#f59e0b`, azul info `#3b82f6`

---

## Lo que necesito implementar: FASE 3 + FASE 4

### FASE 3 — Inteligencia

#### 3.1 Panel de alertas automáticas — `DashboardView.jsx`

Crear un componente `AlertsPanel` que aparece **entre el selector de período y los KPIs hero**.

Las alertas se calculan con los datos del período seleccionado:

| Severidad | Condición | Mensaje |
|---|---|---|
| 🔴 Crítica | `utilidad_neta < 0` | "Este mes el negocio perdió dinero." |
| 🔴 Crítica | `margen_contribuccion / ventas_netas_reales < 0.50` | "Tu margen bruto cayó debajo del 50%. Revisá precios o recetas." |
| 🟡 Advertencia | `ventas_netas_reales < break_even_mensual` | "No alcanzaste el punto de equilibrio este mes." |
| 🟡 Advertencia | `egresos.laboral / ventas_netas_reales > 0.35` | "El costo de nómina supera el 35% de las ventas." |
| 🟡 Advertencia | `egresos.cmv / ventas_netas_reales > 0.40` | "El CMV supera el 40% de las ventas. Revisá tus proveedores o precios." |
| 🔵 Info | `egresos.iibb === 0` | "No registraste el pago de Ingresos Brutos este mes." |

Cada alerta tiene un botón ✕ que la descarta. Usar `localStorage` con key `alerts_dismissed_YYYY-MM` para no showearla de nuevo en ese período.

Si no hay alertas → no mostrar el panel (componente retorna null).

#### 3.2 Comparativa interanual YoY — `BackEnd.gs` + `DashboardView.jsx`

**Backend:** El historial ya se construye para 6 meses atrás. Extender `historyStart` a **13 meses** para incluir el mismo mes del año anterior.

**Frontend:** En `DashboardView.jsx`, agregar una sección "Año a año" debajo del gráfico de evolución.

Para el período seleccionado (ej: marzo 2026), buscar en `history` el registro de marzo 2025.

Mostrar 3 comparativas:
- Ventas: valor actual vs. valor año anterior (ajustado IPC), variación %
- Resultado: ídem
- CMV%: ratio actual vs. ratio año anterior

Usar badges verde (mejora) / rojo (empeora) con la variación %.

#### 3.3 Análisis por canal — `DashboardView.jsx`

En el panel de Mix de Pagos ya existente, agregar debajo una sub-sección "Margen estimado por canal":

```
Efectivo/Mostrador → margen bruto directo (sin comisión adicional)
Tarjetas (salón)   → margen bruto - 1.8% comisión tarjeta
Delivery/Apps      → margen bruto - 25% comisión app
```

Calcular el margen estimado de cada canal usando el % de mezcla de pagos y el margen bruto total.

---

### FASE 4 — Reporting y UX

#### 4.1 Exportación PDF — `DashboardView.jsx`

Instalar: `npm install jspdf html2canvas`

Agregar botón "📄 Exportar P&L" en el header del Dashboard (junto al selector de período).

Al hacer click:
1. Capturar con `html2canvas` el div con `id="pnl-export-area"` (wrappear la sección de KPIs + composición de egresos con ese id)
2. Insertar en `jsPDF` formato A4
3. Agregar header con nombre del local (desde `kpis` o config) y período
4. Agregar footer: "Generado con Estado Result — Solo para uso de gestión interna. No reemplaza estados contables oficiales."
5. Descargar como `EstadoResultado_YYYY-MM.pdf`

#### 4.2 Pantalla de Configuración — nuevo `ConfigView.jsx`

Nueva tab "⚙️ Config" en `App.jsx`.

Formulario con los siguientes campos (se persisten en la hoja `Config` via `SYNC_CONFIG`):

| Campo | Key en Config | Default |
|---|---|---|
| Nombre del local | `LOCAL_NOMBRE` | "Mi Local" |
| CUIT | `LOCAL_CUIT` | "" |
| Alícuota IIBB (%) | `IIBB_ALICUOTA` | 3 |
| Comisión apps delivery (%) | `COMISION_APPS` | 25 |
| Comisión tarjetas (%) | `COMISION_TARJETAS` | 1.8 |
| Objetivo margen bruto (%) | `OBJETIVO_MARGEN` | 60 |
| Objetivo ventas mensuales ($) | `OBJETIVO_VENTAS` | 0 |

En `BackEnd.gs`, la hoja `Config` ya existe. Las keys `COMISION_APPS` y `COMISION_TARJETAS` se leen en `_syncConfigFromSheet()` y se usan en `CONFIG_COMISIONES`. Extender `_syncConfigFromSheet()` para también leer `LOCAL_NOMBRE`, `IIBB_ALICUOTA`, `OBJETIVO_MARGEN`, `OBJETIVO_VENTAS` y exponerlos en el objeto de retorno del `doGet` como `?action=GET_CONFIG`.

El `ConfigView.jsx` debe:
1. Hacer `GET_CONFIG` al montar para cargar los valores actuales
2. Al guardar, hacer `POST` con `origen: 'SYNC_CONFIG'`
3. Mostrar un toast/feedback de éxito

#### 4.3 Historial de cargas — `BackEnd.gs` + nueva tab `AuditView.jsx`

Nueva hoja `AuditLog` con columnas: `Timestamp | Origen | Registros | Usuario | Período`.

En `doPost`, al final de cada operación exitosa, agregar una fila al audit log:
```js
_logAudit(ss, origen, registros.length, startDate);
```

Nueva tab "📋 Historial" en `App.jsx` que muestre esta tabla con filtro por origen.

---

## Instrucciones para el asistente

1. **Lee todos los archivos relevantes antes de tocar nada** — especialmente `BackEnd.gs`, `DashboardView.jsx` y `App.jsx` para tener los números de línea exactos.
2. Seguí el sistema de diseño existente (dark mode, `bg-slate-800/900`, `border-slate-700`, mismos colores por categoría).
3. Ejecutá las 3 fases en orden: 3.1 → 3.2 → 3.3 → 4.1 → 4.2 → 4.3.
4. Para cada cambio en `BackEnd.gs`, verificá que no queden bloques de código huérfanos (sin declaración de función). Este fue el único bug de la sesión anterior.
5. Al terminar, hacé una auditoría rápida de los archivos modificados para verificar que no haya funciones sin declarar ni imports faltantes.
