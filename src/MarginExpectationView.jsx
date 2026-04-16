import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { useFinance } from './FinanceContext';
import { formatters as Utils } from './formatters';
import Card from './components/Card';
import { PctInput, CurrencyInput } from './components/Inputs';
import { colors } from './theme';

Chart.register(...registerables);

function useTheme() {
  const [isLight, setIsLight] = useState(() => document.documentElement.dataset.theme === 'light');
  useEffect(() => {
    const obs = new MutationObserver(() => setIsLight(document.documentElement.dataset.theme === 'light'));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return isLight;
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const S = {
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '14px 20px',
    borderBottom: `1px solid ${colors.borderSubtle}`,
  },
  sectionDivider: {
    padding: '5px 20px',
    background: colors.bgSurface,
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '1.2px',
    color: colors.textFaint,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 20px',
    borderBottom: '1px solid var(--border-subtle)',
  },
  rowLabel:     { fontSize: 13, color: colors.textMuted },
  rowLabelBold: { fontSize: 13, color: colors.textSecondary, fontWeight: 600 },
  rowValue:     { fontSize: 14, fontWeight: 600, color: colors.textSecondary, fontVariantNumeric: 'tabular-nums' },
};

const CardHeader = ({ icon, label, iconBg, iconColor, onInfo }) => (
    <div style={{ ...S.cardHeader, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
                width: 28, height: 28, borderRadius: 8, background: iconBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, color: iconColor, fontWeight: 700,
            }}>{icon}</div>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: colors.textDim }}>
                {label}
            </span>
        </div>
        {onInfo && (
            <button 
                onClick={onInfo}
                style={{
                    width: 20, height: 20, borderRadius: '50%', border: '1px solid var(--border-subtle)',
                    background: 'none', color: 'var(--text-dim)', fontSize: 10, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
            >?</button>
        )}
    </div>
);

const Row = ({ label, bold, value, valueColor, right, onInfo }) => (
  <div style={S.row} className={bold ? 'row-highlight' : ''}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={bold ? S.rowLabelBold : S.rowLabel}>{label}</span>
        {onInfo && (
            <button 
                onClick={onInfo}
                style={{
                    width: 14, height: 14, borderRadius: '50%', border: '1px solid var(--border-subtle)',
                    background: 'none', color: 'var(--text-faint)', fontSize: 8, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
            >?</button>
        )}
    </div>
    {right || <span style={{ ...S.rowValue, color: valueColor || colors.textSecondary }}>{value}</span>}
  </div>
);

const METRICS_DINERO = [
  { key: 'v',             label: 'Venta neta s/IVA',      color: '#10b981', yAxisID: 'y' },
  { key: 'ticket',        label: 'Ticket Promedio',        color: '#fbbf24', yAxisID: 'y1' },
  { key: 'sueldo_prom',   label: 'Sueldo prom./empleado', color: '#f97316', yAxisID: 'y' },
  { key: 'resultado_mgn', label: 'Resultado márgenes',    color: '#4ade80', yAxisID: 'y' },
];

const METRICS_CANTIDAD = [
  { key: 'ops', label: 'Cant. Operaciones', color: '#60a5fa', yAxisID: 'y' },
  { key: 'emp', label: 'Cant. Empleados',   color: '#a78bfa', yAxisID: 'y1' },
];

function HistorialLineChart({ metrics, historial, title, isPesos, defaultActive }) {
  const chartRef = useRef(null);
  const canvasRef = useRef(null);
  const [active, setActive] = useState(defaultActive);
  const [open, setOpen] = useState(false);
  const isLight = useTheme();

  const last6 = Object.keys(historial || {}).sort().slice(-6);
  const labels = last6.map(k => {
    const [y, m] = k.split('-');
    return `${MESES[parseInt(m) - 1].slice(0, 3)} ${y}`;
  });

  useEffect(() => {
    if (!canvasRef.current || last6.length === 0) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    const datasets = metrics
      .filter(m => active[m.key])
      .map(m => ({
        label: m.label,
        data: last6.map(k => historial[k]?.[m.key] ?? null),
        borderColor: m.color,
        backgroundColor: m.color + '18',
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.3,
        fill: false,
        yAxisID: m.yAxisID || 'y',
      }));

    const gridColor = isLight ? 'rgba(28,37,55,0.07)' : 'rgba(255,255,255,0.05)';
    const tickColor = isLight ? '#6B7A90' : '#64748b';
    const tooltipBg = isLight ? 'rgba(255,255,255,0.97)' : 'rgba(15,23,42,0.95)';
    const tooltipTitle = isLight ? '#1C2537' : '#f8fafc';
    const tooltipBody = isLight ? '#374151' : '#cbd5e1';
    const tooltipBorder = isLight ? 'rgba(228,232,238,0.9)' : 'rgba(51,65,85,0.5)';

    chartRef.current = new Chart(canvasRef.current.getContext('2d'), {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: tooltipBg,
            titleColor: tooltipTitle,
            bodyColor: tooltipBody,
            borderColor: tooltipBorder,
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: ctx => {
                const v = ctx.parsed.y;
                if (v === null || v === undefined) return `${ctx.dataset.label}: —`;
                return isPesos
                  ? `${ctx.dataset.label}: ${Utils.fmt(v)}`
                  : `${ctx.dataset.label}: ${Math.round(v).toLocaleString('es-AR')}`;
              },
            },
          },
          datalabels: { display: false },
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: tickColor, font: { size: 11 } },
          },
          y: {
            position: 'left',
            grid: { color: gridColor },
            ticks: {
              color: tickColor,
              font: { size: 10 },
              callback: v => isPesos ? `$${(v / 1000).toFixed(0)}k` : Math.round(v).toLocaleString('es-AR'),
            },
          },
          y1: {
            position: 'right',
            display: metrics.some(m => m.yAxisID === 'y1' && active[m.key]),
            grid: { drawOnChartArea: false }, // Evita que las líneas de grilla se superpongan
            ticks: {
              color: tickColor,
              font: { size: 10 },
              callback: v => isPesos ? `$${v.toLocaleString('es-AR')}` : Math.round(v).toLocaleString('es-AR'),
            },
          },
        },
      },
    });

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [active, historial, isLight, metrics]);

  const toggle = key => setActive(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <Card style={{ padding: '20px 20px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: colors.textDim }}>
          {title}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {metrics.map(m => (
            <div
              key={m.key}
              onClick={() => toggle(m.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                cursor: 'pointer', opacity: active[m.key] ? 1 : 0.35,
                transition: 'opacity 0.15s',
              }}
            >
              <span style={{ width: 20, height: 2, background: m.color, borderRadius: 2, display: 'inline-block' }} />
              <span style={{ fontSize: 11, color: colors.textMuted }}>{m.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ height: 220, position: 'relative' }}>
        {last6.length === 0
          ? <p style={{ color: colors.textFaint, textAlign: 'center', paddingTop: 90, fontSize: 13 }}>Sin historial disponible.</p>
          : <canvas ref={canvasRef} />
        }
      </div>
    </Card>
  );
}

export default function MarginExpectationView() {
  const {
    dashData, setDashData, empData, arcaData, categoriesMap, loading, error,
    selectedYear, selectedMonth, isRefreshing,
    apiUrl, finalApiUrl,
    fetchData, invalidateCache,
  } = useFinance();

  const [manual, setManual] = useState({ mix_cafe: '', mix_producto: '', mgn_cafe: '', mgn_producto: '', excepcionales: '' });
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'ok' | 'error'
  const [infoModal, setInfoModal] = useState(null);

  const draftKey = `er_draft_${selectedYear}_${selectedMonth}`;

  const n = useCallback((v) => Utils.num(v), []);
  const isLight = useTheme();

  const [activeExpenses, setActiveExpenses] = useState({});
  const toggleExpense = useCallback((key) => {
    setActiveExpenses(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // --- GUARDAS DE CARGA Y ERROR ---
  // Mantenemos una guarda mínima para evitar crashes, pero el skeleton real lo maneja App.jsx
  if (!dashData && !loading) {
      return (
        <div className="animate-fade-in mt-8 text-center" style={{ color: '#64748b', paddingTop: 60 }}>
          <p style={{ fontSize: 15 }}>Sin datos para el período seleccionado.</p>
        </div>
      );
  }

  if (!dashData) return null; // El skeleton de App.jsx está cubriendo este caso

  // --- Lógica de Desgloses para los Modales ---
  // A partir de aquí dashData existe. Usamos encadenamiento opcional para máxima seguridad.
  const egresosBase = dashData?.egresos || {};
  
  const laboralBreakdown = [
    { label: 'Sueldos Netos (Recibo + Informal)', val: n(egresosBase.laboral) > 0 ? n(egresosBase.laboral) : (empData || []).reduce((acc, emp) => acc + n(emp.recibo) + n(emp.negro), 0) },
    { label: 'Provisión SAC (1/12)', val: n(egresosBase.provision_sac) },
    { label: 'Cargas Sociales Proyectadas', val: n(egresosBase.provision_cargas) }
  ];

  const estructuralBreakdown = [
    { label: 'Carga Manual (Estructurales)', val: n(egresosBase.estructural) },
    { label: 'Detectado en ARCA (Gasto Fijo)', val: (arcaData || []).filter(r => categoriesMap[r.cuit] === 'GASTO_FIJO').reduce((acc, r) => acc + n(r.total ?? r.importe_total), 0) }
  ];

  const facturasBCBreakdown = (arcaData || [])
    .filter(r => r.tipo_comp && !r.tipo_comp.endsWith(' A') && r.tipo_comp !== '1')
    .filter(r => categoriesMap[r.cuit] !== 'GASTO_FIJO')
    .map(r => ({ label: r.entidad || r.cuit || 'Proveedor S/D', val: Math.abs(n(r.total ?? r.importe_total)) }));

  const iibbBreakdown = (arcaData || [])
    .filter(r => r.rubro === 'Ingresos Brutos')
    .map(r => ({ label: r.sub_rubro || 'Pago IIBB', val: Math.abs(n(r.total ?? r.importe_total)) }));

  const retencionesBreakdown = (arcaData || [])
    .filter(r => r.rubro === 'Retenciones')
    .map(r => ({ label: r.sub_rubro || 'Retención', val: Math.abs(n(r.total ?? r.importe_total)) }));

  const INFO_TOOLTIPS = {
    ventas_card: { title: "Origen: Ventas Netas", explanation: "Se toma el 'Neto ACF' del reporte Maxirest. Cálculo: Total Facturado - Anulaciones - IVA (21% sobre Factura B Electrónica). Es el dinero real que ingresa al local sin impuestos ni devoluciones." },
    gastos_card: { title: "Origen: Egresos Totales", explanation: "Suma de tres fuentes: 1. Nómina (planilla de sueldos + cargas + SAC). 2. Gastos fijos (Alquiler/Servicios detectados en ARCA o cargados a mano). 3. Gastos extraordinarios cargados en esta pantalla." },
    mix_cafe: { title: "Origen: Mix de Cafetería", explanation: "Es un valor de entrada manual. Define qué porcentaje de la 'Venta Neta' total se le atribuye a Cafetería para aplicarle su margen de ganancia específico en el cálculo del resultado." },
    laboral: { 
        title: "Sueldos y Cargas", 
        explanation: "Contempla el pago total a empleados, incluyendo la provisión del aguinaldo (SAC) y las cargas sociales estimadas sobre el sueldo en blanco.",
        breakdown: laboralBreakdown
    },
    estructural: { 
        title: "Gastos Fijos Operativos", 
        explanation: "Suma de los costos fijos necesarios para abrir el local: alquileres, servicios y expensas detectados en facturas o cargados manualmente.",
        breakdown: estructuralBreakdown
    },
    excepcionales_manual: { title: "Origen: Gastos Excepcionales", explanation: "Es el valor numérico que ingresaste manualmente en el campo 'Excepcionales' de esta pantalla. No proviene de ninguna planilla externa." },
    iibb: { 
        title: "Ingresos Brutos", 
        explanation: "Pagos de IIBB (Local o Convenio) registrados manualmente para este período.",
        breakdown: iibbBreakdown
    },
    retenciones: { 
        title: "Retenciones", 
        explanation: "Pagos a cuenta de impuestos realizados a través de bancos, tarjetas o aplicaciones de delivery.",
        breakdown: retencionesBreakdown
    },
    comisiones: { title: "Cálculo: Comisiones", explanation: "Cálculo automático basado en Maxirest: (Total Tarjetas × % Tarjeta) + (Total Otros × % Otros). Los porcentajes se definen en la pestaña de Ajustes. Si el número es alto, revisá los % configurados." },
    facturas_bc: { 
        title: "Facturas B / C (ARCA)", 
        explanation: "Gastos de proveedores que no discriminan IVA (Monotributistas o Facturas B/C). Son costos directos del período.",
        breakdown: facturasBCBreakdown
    },
    margen_contribucion: { title: "Concepto: Margen de Contribución", explanation: "Este valor representa la ganancia que la marca calcula tras contemplar los costos de proveedores. Es el porcentaje que la marca ha deducido que debería quedar como remanente luego de quitarle el costo de mercadería vendida (CMV)." }
  };

  // Al cambiar período: cargar borrador local (no mirar dashData, puede ser del mes anterior)
  useEffect(() => {
    const draft = localStorage.getItem(draftKey);
    if (draft) {
      try { setManual(JSON.parse(draft)); return; } catch {}
    }
    setManual({ mix_cafe: '', mix_producto: '', mgn_cafe: '', mgn_producto: '', excepcionales: '' });
  }, [selectedYear, selectedMonth]);

  // Cuando llegan datos de la BD para el período actual: la BD gana
  useEffect(() => {
    if (!dashData?.estado_result_manual) return;
    
    // Solo sobreescribimos si: 
    // 1. Acabamos de guardar exitosamente
    // 2. El estado manual actual está vacío (primera carga tras refresh)
    const m = dashData.estado_result_manual;
    const vals = {
        mix_cafe: m.mix_cafe ?? '',
        mix_producto: m.mix_producto ?? '',
        mgn_cafe: m.mgn_cafe ?? '',
        mgn_producto: m.mgn_producto ?? '',
        excepcionales: m.excepcionales ?? '',
    };
    setManual(vals);
    localStorage.setItem(draftKey, JSON.stringify(vals));
  }, [dashData?.estado_result_manual, saveStatus]); // Añadimos dashData como trigger real

  const setField = useCallback((field) => (val) => {
    setManual(prev => {
      const next = { ...prev, [field]: val };
      localStorage.setItem(draftKey, JSON.stringify(next));
      return next;
    });
    setSaveStatus(null);
  }, [draftKey]);

  const setMixCafe = useCallback((val) => {
    const num = parseFloat(val);
    const producto = isNaN(num) ? '' : (100 - Math.min(100, Math.max(0, num))).toFixed(1);
    setManual(prev => {
      const next = { ...prev, mix_cafe: val, mix_producto: producto };
      localStorage.setItem(draftKey, JSON.stringify(next));
      return next;
    });
    setSaveStatus(null);
  }, [draftKey]);

  const handleSave = async () => {
    if (!finalApiUrl) return;
    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch(finalApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'CARGAR_DATOS',
          origen: 'SAVE_ESTADO_RESULT',
          payload: {
            periodo: `${selectedYear}-${selectedMonth}`,
            mix_cafe: parseFloat(manual.mix_cafe) || 0,
            mix_producto: parseFloat(manual.mix_producto) || 0,
            mgn_cafe: parseFloat(manual.mgn_cafe) || 0,
            mgn_producto: parseFloat(manual.mgn_producto) || 0,
            excepcionales: parseFloat(manual.excepcionales) || 0,
          }
        })
      });
      const data = await res.json();
      if (data.status === 'OK') {
        setSaveStatus('ok');
        const saved = {
          mix_cafe: parseFloat(manual.mix_cafe) || 0,
          mix_producto: parseFloat(manual.mix_producto) || 0,
          mgn_cafe: parseFloat(manual.mgn_cafe) || 0,
          mgn_producto: parseFloat(manual.mgn_producto) || 0,
          excepcionales: parseFloat(manual.excepcionales) || 0,
        };
        setDashData(prev => ({ ...prev, estado_result_manual: saved }));
        invalidateCache(selectedYear, selectedMonth);
        localStorage.setItem(draftKey, JSON.stringify(manual));
      } else {
        setSaveStatus('error');
      }
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  // Solo mostramos skeletons si NO hay datos. Si hay datos y loading es true, es un refresh silencioso.
  if (loading && !dashData) return (
    <div className="animate-fade-in mt-6" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {[1,2,3,4].map(i => (
        <Card key={i} style={{ height: 280, opacity: 0.4 }} className="animate-pulse" />
      ))}
    </div>
  );

  if (error || !dashData) return (
    <div className="animate-fade-in mt-8 text-center" style={{ color: '#64748b', paddingTop: 60 }}>
      <p style={{ fontSize: 15 }}>Sin datos para el período seleccionado.</p>
    </div>
  );

  const { kpis, egresos } = dashData;

  const ventaBruta = n(kpis.venta_bruta);
  const ivaDébito = n(kpis.iva_debito);
  const ventaNeta = n(kpis.ventas_netas_reales);
  const cantOps = n(kpis.cant_operaciones);
  const ticketProm = cantOps > 0 ? ventaBruta / cantOps : 0;

  const totalFacturasBC = (arcaData || [])
    .filter(r => r.tipo_comp && !r.tipo_comp.endsWith(' A') && r.tipo_comp !== '1')
    .filter(r => categoriesMap[r.cuit] !== 'GASTO_FIJO') // Evitar duplicidad si se categorizó como fijo
    .reduce((acc, r) => acc + n(r.total ?? r.importe_total), 0);

  // Sumamos los gastos de ARCA que fueron categorizados manualmente como GASTO_FIJO
  const arcaGastosFijos = (arcaData || [])
    .filter(r => categoriesMap[r.cuit] === 'GASTO_FIJO')
    .reduce((acc, r) => acc + n(r.total ?? r.importe_total), 0);

  const mixCafePct = parseFloat(manual.mix_cafe) || 0;
  const mixProductoPct = parseFloat(manual.mix_producto) || 0;
  const mgnCafePct = parseFloat(manual.mgn_cafe) || 0;
  const mgnProductoPct = parseFloat(manual.mgn_producto) || 0;

  const ventaCafe = (mixCafePct / 100) * ventaNeta;
  const ventaProducto = (mixProductoPct / 100) * ventaNeta;
  const margenCafePesos = (mgnCafePct / 100) * ventaCafe;
  const margenProductoPesos = (mgnProductoPct / 100) * ventaProducto;

  const laboralEfectivo = n(egresosBase.laboral) > 0
    ? n(egresosBase.laboral)
    : (empData || []).reduce((acc, emp) => acc + n(emp.recibo) + n(emp.negro), 0);
  const sueldosTotal = laboralEfectivo + n(egresosBase.provision_sac) + n(egresosBase.provision_cargas);
  const cantEmpleados = (empData || []).length;
  const promedioEmp = cantEmpleados > 0 ? laboralEfectivo / cantEmpleados : 0;
  const operaciones = n(egresosBase.estructural) + arcaGastosFijos;
  const excepcionales = parseFloat(manual.excepcionales) || 0;

  const totalGastos = sueldosTotal + operaciones + excepcionales;
  const resultado = ventaNeta - totalGastos;
  const resultadoMargenes = margenCafePesos + margenProductoPesos;
  const margenPct = ventaNeta > 0 ? ((resultadoMargenes / ventaNeta) * 100).toFixed(1) : '0.0';
  const resultadoPositivo = resultadoMargenes >= 0;

  const mesNombre = MESES[parseInt(selectedMonth) - 1];
  const periodoLabel = `${mesNombre} ${selectedYear}`;

  let resultadoAjustado = resultadoMargenes;
  const expensesToSubtract = [
    { key: 'laboral', value: sueldosTotal, label: 'Sueldos y Cargas' },
    { key: 'estructural', value: operaciones, label: 'Gastos Fijos Operativos' },
    { key: 'excepcionales_manual', value: excepcionales, label: 'Gastos Excepcionales' },
    { key: 'facturas_bc', value: totalFacturasBC, label: 'Facturas B / C (ARCA)' },
    { key: 'iibb', value: n(egresos.iibb), label: 'Ingresos Brutos' },
    { key: 'retenciones', value: n(egresos.retenciones), label: 'Retenciones' },
    { key: 'comisiones', value: n(egresos.comisiones), label: 'Comisiones Bancarias/Apps' },
  ];

  expensesToSubtract.forEach(exp => {
    if (activeExpenses[exp.key]) {
      resultadoAjustado -= exp.value;
    }
  });

  const resultadoAjustadoPositivo = resultadoAjustado >= 0;
  const margenAjustadoPct = ventaNeta > 0 ? ((resultadoAjustado / ventaNeta) * 100).toFixed(1) : '0.0';

  const [debugOpen, setDebugOpen] = useState(false);
  const debugInfo = {
    periodo: `${selectedYear}-${selectedMonth}`,
    apiUrl: finalApiUrl ? finalApiUrl.slice(0, 60) + '...' : '(vacío)',
    error,
    historial_keys: dashData?.historial ? Object.keys(dashData.historial) : 'undefined',
    historial_sample: dashData?.historial ? Object.entries(dashData.historial).slice(-2) : null,
    estado_result_manual: dashData?.estado_result_manual,
    kpis_venta: dashData?.kpis?.ventas_netas_reales,
  };

  return (
    <div className="animate-fade-in mt-6" style={{ display: 'flex', flexDirection: 'column', gap: 16,
      opacity: isRefreshing ? 0.7 : 1, // Atenuar sutilmente durante la sincronización en segundo plano
      transition: 'opacity 0.3s ease-in-out'
    }}>

      {/* Debug overlay */}
      {debugOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setDebugOpen(false)}>
          <div style={{
            background: colors.bgCard, border: `1px solid ${colors.borderMid}`, borderRadius: 14,
            padding: 24, maxWidth: 680, width: '90%', maxHeight: '80vh', overflowY: 'auto',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: colors.textDim, textTransform: 'uppercase', letterSpacing: '1px' }}>Debug — Estado</span>
              <button onClick={() => setDebugOpen(false)} style={{ background: 'none', border: 'none', color: colors.textDim, cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <pre style={{ fontSize: 11, color: colors.textMuted, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: colors.textPrimary, letterSpacing: '-0.3px', margin: 0 }}>
            Estado de Resultado
          </h2>
          <p style={{ fontSize: 12, color: colors.textDim, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            {periodoLabel}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={() => setDebugOpen(true)} style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-mid)',
          borderRadius: 8, color: colors.textDim, fontSize: 11, padding: '5px 10px', cursor: 'pointer',
        }}>debug</button>
        {saveStatus === 'ok' && (
          <span style={{
            fontSize: 12, fontWeight: 600, color: '#4ade80',
            background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)',
            borderRadius: 8, padding: '6px 14px',
          }}>
            ✓ Guardado
          </span>
        )}
        {saveStatus === 'error' && (
          <span style={{
            fontSize: 12, fontWeight: 600, color: '#f87171',
            background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)',
            borderRadius: 8, padding: '6px 14px',
          }}>
            ✗ Error al guardar
          </span>
        )}
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'Venta Sistema', value: Utils.fmt(ventaBruta), sub: 'Bruta c/IVA' },
          { label: 'Cant. Operaciones', value: cantOps.toLocaleString('es-AR'), sub: 'Tickets del período' },
          { label: 'Ticket Promedio', value: Utils.fmt(ticketProm), sub: 'Por operación' },
        ].map(({ label, value, sub }) => (
          <Card key={label}>
            <div style={{ padding: '16px 18px' }}>
              <p style={{ fontSize: 10, color: colors.textFaint, textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 }}>{label}</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: colors.textPrimary, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
              <p style={{ fontSize: 11, color: colors.textDim, marginTop: 2 }}>{sub}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Grid: Ventas + Gastos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* ── VENTAS ── */}
        <Card>
          <CardHeader icon="↑" label="Ventas" iconBg="rgba(16,185,129,0.1)" iconColor="#10b981" onInfo={() => setInfoModal('ventas_card')} />

          <Row label="IVA cobrado" value={Utils.fmt(ivaDébito)} />
          <Row label="Venta Neta S/IVA" bold value={Utils.fmt(ventaNeta)} valueColor="#10b981" />

          <div style={S.sectionDivider}>Mix de producto</div>

          <Row
            label="Mix Cafetería"
            onInfo={() => setInfoModal('mix_cafe')}
            right={
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                <PctInput value={manual.mix_cafe} onChange={setMixCafe} />
                {ventaCafe > 0 && <span style={{ fontSize: 11, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{Utils.fmt(ventaCafe)}</span>}
              </div>
            }
          />
          <Row
            label="Mix Producto"
            right={
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#60a5fa', background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 4, padding: '1px 5px' }}>auto</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#fbbf24', fontVariantNumeric: 'tabular-nums' }}>{mixProductoPct.toFixed(1)}</span>
                  <span style={{ fontSize: 12, color: '#64748b' }}>%</span>
                </div>
                {ventaProducto > 0 && <span style={{ fontSize: 11, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{Utils.fmt(ventaProducto)}</span>}
              </div>
            }
          />

          <div style={{ ...S.sectionDivider, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Margen de contribución</span>
            <button 
                onClick={() => setInfoModal('margen_contribucion')}
                style={{
                    width: 16, height: 16, borderRadius: '50%', border: '1px solid var(--border-subtle)',
                    background: 'none', color: 'var(--text-faint)', fontSize: 9, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
            >?</button>
          </div>

          <Row
            label="MGN Cafetería"
            right={
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                <PctInput value={manual.mgn_cafe} onChange={setField('mgn_cafe')} />
                {margenCafePesos > 0 && <span style={{ fontSize: 15, fontWeight: 700, color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>{Utils.fmt(margenCafePesos)}</span>}
              </div>
            }
          />
          <Row
            label="MGN Producto"
            right={
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                <PctInput value={manual.mgn_producto} onChange={setField('mgn_producto')} />
                {margenProductoPesos > 0 && <span style={{ fontSize: 15, fontWeight: 700, color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>{Utils.fmt(margenProductoPesos)}</span>}
              </div>
            }
          />
        </Card>

        {/* ── GASTOS ── */}
        <Card>
          <CardHeader icon="↓" label="Gastos" iconBg="rgba(244,63,94,0.1)" iconColor="#f43f5e" onInfo={() => setInfoModal('gastos_card')} />

          <div style={S.sectionDivider}>Laboral</div>

          <Row label="Sueldos (incl. prov. SAC y cargas)" bold value={Utils.fmt(sueldosTotal)} />
          <Row label="Cant. empleados" value={cantEmpleados.toString()} />
          <Row label="Promedio por empleado" value={Utils.fmt(promedioEmp)} />

          <div style={S.sectionDivider}>Operaciones</div>

          <Row label="Gastos fijos operativos" bold value={Utils.fmt(operaciones)} />

          <div style={S.sectionDivider}>Otros</div>

          {/* Bancos — placeholder futuro */}
          <div style={{ ...S.row, opacity: 0.4 }}>
            <span style={S.rowLabel}>
              Bancos{' '}
              <span style={{
                fontSize: 9, fontWeight: 700, color: '#60a5fa',
                background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)',
                borderRadius: 4, padding: '1px 5px', marginLeft: 6,
              }}>próximo</span>
            </span>
            <span style={{ ...S.rowValue, color: '#334155' }}>— — —</span>
          </div>

          <Row
            label="Excepcionales"
            onInfo={() => setInfoModal('excepcionales_manual')}
            right={<CurrencyInput value={manual.excepcionales} onChange={setField('excepcionales')} />}
          />

          <div style={S.sectionDivider}>Total</div>

          <Row label="Total Gastos" bold value={Utils.fmt(totalGastos)} valueColor="#f43f5e" />
        </Card>
      </div>

      {/* Resultado */}
      <Card style={{
        background: resultadoAjustadoPositivo
          ? (isLight ? 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)' : 'linear-gradient(135deg, rgba(5,46,22,0.8) 0%, rgba(7,12,24,0.95) 100%)')
          : (isLight ? 'linear-gradient(135deg, #fff1f2 0%, #fff5f5 100%)' : 'linear-gradient(135deg, rgba(45,10,10,0.8) 0%, rgba(7,12,24,0.95) 100%)'),
        border: `1px solid ${resultadoAjustadoPositivo
          ? (isLight ? 'rgba(16,185,129,0.35)' : 'rgba(74,222,128,0.2)')
          : (isLight ? 'rgba(244,63,94,0.35)' : 'rgba(248,113,113,0.2)')}`,
        padding: 0, // Remove padding from Card, add to internal divs
      }}>
        <div style={{ padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px',
              color: resultadoAjustadoPositivo
                ? (isLight ? '#059669' : '#6ee7b7')
                : (isLight ? '#dc2626' : '#fca5a5'),
              margin: 0,
            }}>Resultado según márgenes esperados</p>
            <p style={{
              fontSize: 32, fontWeight: 800, margin: '4px 0 0',
              color: resultadoAjustadoPositivo
                ? (isLight ? '#059669' : '#4ade80')
                : (isLight ? '#dc2626' : '#f87171'),
              fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px',
            }}>{Utils.fmt(resultadoAjustado)}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{
              fontSize: 24, fontWeight: 700, margin: 0,
              color: resultadoAjustadoPositivo
                ? (isLight ? '#059669' : '#4ade80')
                : (isLight ? '#dc2626' : '#f87171'),
            }}>
              {margenAjustadoPct}%
            </p>
            <p style={{ fontSize: 11, color: colors.textFaint, marginTop: 2 }}>sobre venta neta</p>
          </div>
        </div>

        {/* Expense Toggles */}
        <div style={{
          borderTop: `1px solid ${isLight ? 'rgba(28,37,55,0.07)' : 'rgba(255,255,255,0.05)'}`,
          padding: '16px 28px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}>
          {expensesToSubtract.map(exp => (
            <div
              key={exp.key}
              onClick={() => toggleExpense(exp.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                padding: '8px 12px',
                borderRadius: 8,
                background: activeExpenses[exp.key]
                  ? (isLight ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.15)')
                  : (isLight ? 'rgba(28,37,55,0.03)' : 'rgba(255,255,255,0.03)'),
                border: `1px solid ${activeExpenses[exp.key]
                  ? (isLight ? 'rgba(59,130,246,0.3)' : 'rgba(59,130,246,0.4)')
                  : (isLight ? 'rgba(28,37,55,0.07)' : 'rgba(255,255,255,0.05)')}`,
                transition: 'all 0.2s ease-in-out',
              }}
            >
              <input
                type="checkbox"
                checked={activeExpenses[exp.key] || false}
                readOnly
                style={{ accentColor: '#3b82f6', transform: 'scale(1.1)', pointerEvents: 'none' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: activeExpenses[exp.key] ? (isLight ? '#3b82f6' : '#60a5fa') : colors.textMuted }}>
                  {exp.label}
                </span>
                <button 
                    onClick={(e) => { e.stopPropagation(); setInfoModal(exp.key); }}
                    style={{
                        width: 14, height: 14, borderRadius: '50%', border: '1px solid var(--border-subtle)',
                        background: 'none', color: 'var(--text-faint)', fontSize: 8, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                >?</button>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: activeExpenses[exp.key] ? (isLight ? '#3b82f6' : '#60a5fa') : colors.textSecondary, marginLeft: 'auto' }}>
                {Utils.fmt(exp.value)}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Gráficos históricos */}
      <HistorialLineChart
        metrics={METRICS_DINERO}
        historial={dashData.historial || {}}
        title="Evolución — últimos 6 meses (pesos)"
        isPesos
        defaultActive={{ v: true }}
      />
      <HistorialLineChart
        metrics={METRICS_CANTIDAD}
        historial={dashData.historial || {}}
        title="Evolución — últimos 6 meses (cantidades)"
        isPesos={false}
        defaultActive={{ ops: true, emp: true }}
      />

      {/* Save bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: 8 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: saving ? '#1e3a8a' : '#2563eb',
            color: '#fff', border: 'none', borderRadius: 10,
            padding: '11px 26px', fontSize: 14, fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
            opacity: saving ? 0.7 : 1,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          {saving ? 'Guardando...' : 'Guardar período'}
        </button>
      </div>

      {/* Info Modal */}
      {infoModal && INFO_TOOLTIPS[infoModal] && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)', backdropBlur: '4px'
        }} onClick={() => setInfoModal(null)}>
          <div style={{
            background: colors.bgCard, border: `1px solid ${colors.borderCard}`, borderRadius: 24,
            width: '90%', maxWidth: 450, padding: 28, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
          }} className="animate-pop-in" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 900, color: colors.textPrimary, margin: 0 }}>
                {INFO_TOOLTIPS[infoModal].title}
              </h3>
              <button 
                onClick={() => setInfoModal(null)} 
                style={{ background: 'none', border: 'none', color: colors.textDim, cursor: 'pointer', fontSize: 20 }}
              >✕</button>
            </div>
            <p style={{ fontSize: 14, color: colors.textMuted, lineHeight: 1.6, margin: '0 0 24px' }}>
              {INFO_TOOLTIPS[infoModal].explanation}
            </p>
            {INFO_TOOLTIPS[infoModal].breakdown && INFO_TOOLTIPS[infoModal].breakdown.length > 0 && (
              <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 16, border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                {INFO_TOOLTIPS[infoModal].breakdown.map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: i < INFO_TOOLTIPS[infoModal].breakdown.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: colors.textDim, textTransform: 'uppercase' }}>{row.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{Utils.fmt(row.val)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
