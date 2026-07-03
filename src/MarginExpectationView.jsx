import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Chart, registerables } from 'chart.js';
import { useFinance } from './FinanceContext';
import { formatters as Utils } from './formatters';
import Card from './components/Card';
import { PctInput, CurrencyInput } from './components/Inputs';
import { colors } from './theme';
import { supabase } from './supabaseClient';

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

// --- LEDGER: agrupa un breakdown en "Suman (+)" / "Restan (−)" + barra de total ---
// Cada fila normal se clasifica por el signo de su val. Una fila con total:true
// cierra una etapa (mismo componente que en el Dashboard, para que se lea igual en toda la app).
const LedgerGroup = ({ label, rows, tone }) => {
  if (!rows.length) return null;
  const isSuma = tone === 'suma';
  return (
    <div className={`mb-2.5 rounded-2xl overflow-hidden border ${isSuma ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-rose-500/20 bg-rose-500/[0.04]'}`}>
      <p className={`text-[9px] font-black uppercase tracking-[0.15em] px-5 pt-2.5 pb-1.5 ${isSuma ? 'text-emerald-400' : 'text-rose-400'}`}>{label}</p>
      {rows.map((row, i) => (
        <div key={i} className="flex justify-between items-start gap-3 px-5 py-1.5" style={{ paddingBottom: i === rows.length - 1 ? 12 : 6 }}>
          <span className="text-xs text-[var(--text-muted)] flex-1">{row.label}</span>
          <span className={`text-sm font-bold font-mono flex-shrink-0 text-right ${isSuma ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isSuma ? '' : '− '}{Utils.fmt(Math.abs(Utils.num(row.val)))}
          </span>
        </div>
      ))}
    </div>
  );
};

const LedgerTotalBar = ({ row }) => (
  <div className="flex justify-between items-center gap-3 px-5 py-3.5 mb-4 rounded-2xl bg-white/5 border border-white/10">
    <span className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)]">= {row.label}</span>
    <span className={`text-base font-mono tracking-tighter font-black ${row.color || 'text-[var(--text-primary)]'}`}>{Utils.fmt(row.val)}</span>
  </div>
);

const LedgerBreakdown = ({ breakdown }) => {
  if (!breakdown || breakdown.length === 0) return null;

  const stages = [];
  let current = { suma: [], resta: [] };
  breakdown.forEach(row => {
    if (row.total) {
      stages.push({ ...current, totalRow: row });
      current = { suma: [], resta: [] };
    } else if (Utils.num(row.val) < 0) {
      current.resta.push(row);
    } else {
      current.suma.push(row);
    }
  });
  const trailing = (current.suma.length > 0 || current.resta.length > 0) ? current : null;

  return (
    <div>
      {stages.map((stage, i) => (
        <div key={i}>
          <LedgerGroup label="Suman (+)" rows={stage.suma} tone="suma" />
          <LedgerGroup label="Restan (−)" rows={stage.resta} tone="resta" />
          <LedgerTotalBar row={stage.totalRow} />
        </div>
      ))}
      {trailing && (
        <>
          <LedgerGroup label="Suman (+)" rows={trailing.suma} tone="suma" />
          <LedgerGroup label="Restan (−)" rows={trailing.resta} tone="resta" />
        </>
      )}
    </div>
  );
};

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

function ScatterChart({ historial, title }) {
  const chartRef = useRef(null);
  const canvasRef = useRef(null);
  const isLight = useTheme();

  const chartData = useMemo(() => {
    if (!historial || Object.keys(historial).length === 0) return null;
    const points = [];
    Object.entries(historial).sort((a, b) => a[0].localeCompare(b[0])).forEach(([k, data]) => {
      const v = data.v || 0;
      const res = data.resultado_mgn || 0;
      if (v > 0) {
        const margin = (res / v) * 100;
        const [y, m] = k.split('-');
        const label = `${MESES[parseInt(m) - 1].slice(0, 3)} ${y}`;
        points.push({ x: v, y: margin, period: label });
      }
    });
    return points;
  }, [historial]);

  useEffect(() => {
    if (!canvasRef.current || !chartData || chartData.length === 0) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    const gridColor = isLight ? 'rgba(28,37,55,0.07)' : 'rgba(255,255,255,0.05)';
    const tickColor = isLight ? '#6B7A90' : '#64748b';
    const tooltipBg = isLight ? 'rgba(255,255,255,0.97)' : 'rgba(15,23,42,0.95)';
    const tooltipTitle = isLight ? '#1C2537' : '#f8fafc';
    const tooltipBody = isLight ? '#374151' : '#cbd5e1';
    const tooltipBorder = isLight ? 'rgba(228,232,238,0.9)' : 'rgba(51,65,85,0.5)';

    // Calcular línea de tendencia simple
    const n = chartData.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    chartData.forEach(p => {
        sumX += p.x; sumY += p.y; sumXY += p.x * p.y; sumXX += p.x * p.x;
    });
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    const minX = Math.min(...chartData.map(p => p.x));
    const maxX = Math.max(...chartData.map(p => p.x));
    const trendline = [
        { x: minX, y: slope * minX + intercept },
        { x: maxX, y: slope * maxX + intercept }
    ];

    const fmtM = v => {
        const n = Math.abs(parseFloat(v) || 0);
        return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(0) + 'K' : n.toFixed(0);
    };

    chartRef.current = new Chart(canvasRef.current.getContext('2d'), {
      type: 'scatter',
      data: {
        datasets: [
          {
            type: 'scatter',
            label: 'Meses',
            data: chartData,
            backgroundColor: isLight ? 'rgba(59,130,246,0.6)' : 'rgba(96,165,250,0.8)',
            borderColor: isLight ? '#2563eb' : '#60a5fa',
            borderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 8,
          },
          {
            type: 'line',
            label: 'Tendencia',
            data: trendline,
            borderColor: isLight ? 'rgba(244,63,94,0.5)' : 'rgba(251,113,133,0.5)',
            borderWidth: 2,
            borderDash: [5, 5],
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 0,
            order: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          datalabels: { display: false },
          tooltip: {
            backgroundColor: tooltipBg, titleColor: tooltipTitle, bodyColor: tooltipBody,
            borderColor: tooltipBorder, borderWidth: 1, padding: 12, cornerRadius: 8,
            callbacks: {
              label: ctx => {
                  if (ctx.dataset.type === 'line') return 'Línea de Tendencia';
                  const p = ctx.raw;
                  return `${p.period}: Margen ${p.y.toFixed(1)}% | Ventas $${fmtM(p.x)}`;
              }
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Venta Neta ($)', color: tickColor, font: { size: 10, weight: 'bold' }, padding: { top: 10 } },
            grid: { color: gridColor },
            ticks: { color: tickColor, font: { size: 10 }, callback: v => `$${fmtM(v)}` },
            grace: '5%'
          },
          y: {
            title: { display: true, text: 'Margen (%)', color: tickColor, font: { size: 10, weight: 'bold' }, padding: { bottom: 10 } },
            grid: { color: gridColor },
            ticks: { color: tickColor, font: { size: 10 }, callback: v => `${v.toFixed(1)}%` },
            grace: '10%'
          }
        }
      }
    });

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [chartData, isLight]);

  return (
    <Card style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: isLight ? 'rgba(244,63,94,0.1)' : 'rgba(244,63,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f43f5e', fontSize: 12, fontWeight: 'bold' }}>📉</div>
            <div>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>{title}</span>
                <p style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>Relación entre Ventas (escala) y Rentabilidad (eficiencia). Ayuda a ver si vender más genera más margen.</p>
            </div>
        </div>
      </div>
      <div style={{ height: 240, position: 'relative' }}>
        {!chartData || chartData.length === 0
          ? <p style={{ color: 'var(--text-faint)', textAlign: 'center', paddingTop: 90, fontSize: 13 }}>Sin historial disponible.</p>
          : <canvas ref={canvasRef} />
        }
      </div>
    </Card>
  );
}

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
    invalidateCache, configData,
  } = useFinance();

  const [manual, setManual] = useState({ mix_cafe: '', mix_producto: '', mgn_cafe: '', mgn_producto: '', excepcionales: '' });
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'ok' | 'error'
  const [infoModal, setInfoModal] = useState(null);
  const [debugOpen, setDebugOpen] = useState(false);

  const draftKey = `er_draft_${selectedYear}_${selectedMonth}`;

  const n = useCallback((v) => Utils.num(v), []);
  const isLight = useTheme();

  const [activeExpenses, setActiveExpenses] = useState({});
  const toggleExpense = useCallback((key) => {
    setActiveExpenses(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // MUST be before any conditional returns (Rules of Hooks)
  const proveedoresBreakdownData = useMemo(() => {
    const res = { cmv: [], tipoBC: [], noApto: [], sA: [] };
    (arcaData || []).forEach(item => {
      const cuit = item.doc_nro || item.cuit;
      const cat = (categoriesMap || {})[cuit] || '';
      const tipo = (item.tipo_comp || '').toUpperCase();
      if (cat === 'GASTO_FIJO' || item.rubro === 'Costos Estructurales') return;
      const total = Math.abs(Utils.num(item.total ?? item.importe_total));
      const isBC = /(?:FACTURA|TIQUE|RECIBO|CREDITO|DEBITO|TIQUET)\s+[BC]\b/i.test(tipo) || tipo === 'B' || tipo === 'C' || tipo.endsWith(' B') || tipo.endsWith(' C');
      const label = item.entidad || cuit || 'Proveedor';
      if (isBC) { res.tipoBC.push({ label, val: total }); }
      else if (cat === 'PROVEEDOR') { res.cmv.push({ label, val: total }); }
      else if (cat === 'NO_APTO') { res.noApto.push({ label, val: total }); }
      else if (cat && cat !== '') { if (!res[cat]) res[cat] = []; res[cat].push({ label, val: total }); }
      else { res.sA.push({ label, val: total }); }
    });
    const grouped = {};
    Object.entries(res).forEach(([catKey, items]) => {
      const map = {};
      items.forEach(i => { map[i.label] = (map[i.label] || 0) + i.val; });
      grouped[catKey] = Object.entries(map).map(([l, v]) => ({ label: l, val: v })).sort((a, b) => b.val - a.val);
    });
    return grouped;
  }, [arcaData, categoriesMap]);

  // Al cambiar período: cargar borrador local (no mirar dashData, puede ser del mes anterior)
  useEffect(() => {
    const draft = localStorage.getItem(draftKey);
    if (draft) {
      try { setManual(JSON.parse(draft)); return; } catch {}
    }
    setManual({ mix_cafe: '', mix_producto: '', mgn_cafe: '', mgn_producto: '', excepcionales: '' });
  }, [selectedYear, selectedMonth]);

  // Cuando llegan datos de la BD: solo aplicarlos si no hay borrador local
  // (el borrador local es la fuente de verdad mientras no se guarde)
  useEffect(() => {
    if (!dashData?.estado_result_manual) return;
    if (localStorage.getItem(draftKey)) return; // borrador local existe — no pisar

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
  }, [dashData?.estado_result_manual]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // --- GUARDAS DE CARGA Y ERROR ---
  if (!dashData) {
    if (!loading) return (
      <div className="animate-fade-in mt-8 text-center" style={{ color: '#64748b', paddingTop: 60 }}>
        <p style={{ fontSize: 15 }}>Sin datos para el período seleccionado.</p>
      </div>
    );
    return null; // El skeleton de App.jsx cubre este caso
  }

  // --- Lógica de Desgloses para los Modales ---
  // A partir de aquí dashData existe. Extraemos las sub-propiedades con fallbacks para evitar crashes.
  const egresosBase = dashData?.egresos || {};
  const kpisBase = dashData?.kpis || {};
  
  const laboralSueldosNetos = n(egresosBase.laboral) > 0 ? n(egresosBase.laboral) : (empData || []).reduce((acc, emp) => acc + n(emp.recibo) + n(emp.negro), 0);
  const laboralBreakdown = [
    { label: 'Sueldos Netos (Recibo + Informal)', val: laboralSueldosNetos },
    { label: 'Provisión SAC (1/12)', val: n(egresosBase.provision_sac) },
    { label: 'Cargas Sociales Proyectadas', val: n(egresosBase.provision_cargas) },
    { label: 'Costo Laboral Total', val: laboralSueldosNetos + n(egresosBase.provision_sac) + n(egresosBase.provision_cargas), total: true }
  ];

  const arcaGastosFijosItems = (arcaData || [])
    .filter(r => {
        const cuit = r.doc_nro || r.cuit;
        const cat = (categoriesMap || {})[cuit] || '';
        return cat === 'GASTO_FIJO' || r.rubro === 'Costos Estructurales';
    })
    .map(r => ({ label: r.entidad || r.cuit || 'Gasto Fijo S/D', val: Math.abs(n(r.total ?? r.importe_total)) }));

  const mapGF = {};
  arcaGastosFijosItems.forEach(i => { mapGF[i.label] = (mapGF[i.label] || 0) + i.val; });
  const arcaGastosFijosBreakdown = Object.entries(mapGF).map(([l, v]) => ({ label: l, val: v })).sort((a, b) => b.val - a.val);

  const arcaGastosFijosTotal = arcaGastosFijosBreakdown.reduce((acc, r) => acc + r.val, 0);
  const totalEstructural = n(egresosBase.estructural);
  const cargaManualEst = totalEstructural - arcaGastosFijosTotal;

  const estructuralBreakdown = [ ...arcaGastosFijosBreakdown ];
  if (cargaManualEst > 0.01) {
      estructuralBreakdown.push({ label: 'Carga Manual (Adicional)', val: cargaManualEst });
  } else if (cargaManualEst < -0.01) {
      estructuralBreakdown.push({ label: 'Ajuste Backend', val: cargaManualEst });
  }
  estructuralBreakdown.push({ label: 'Total Gastos Fijos', val: totalEstructural, total: true });

  const facturasBCBreakdown = (arcaData || [])
    .filter(r => r.tipo_comp && !r.tipo_comp.endsWith(' A') && r.tipo_comp !== '1')
    .filter(r => categoriesMap[r.cuit] !== 'GASTO_FIJO')
    .map(r => ({ label: r.entidad || r.cuit || 'Proveedor S/D', val: Math.abs(n(r.total ?? r.importe_total)) }));
  if (facturasBCBreakdown.length > 0) {
    facturasBCBreakdown.push({ label: 'Total Facturas B / C', val: facturasBCBreakdown.reduce((a, r) => a + r.val, 0), total: true });
  }

  const iibbBreakdown = (arcaData || [])
    .filter(r => r.rubro === 'Ingresos Brutos')
    .map(r => ({ label: r.sub_rubro || 'Pago IIBB', val: Math.abs(n(r.total ?? r.importe_total)) }));
  if (iibbBreakdown.length > 0) {
    iibbBreakdown.push({ label: 'Total IIBB', val: iibbBreakdown.reduce((a, r) => a + r.val, 0), total: true });
  }

  const retencionesBreakdown = (arcaData || [])
    .filter(r => r.rubro === 'Retenciones')
    .map(r => ({ label: r.sub_rubro || 'Retención', val: Math.abs(n(r.total ?? r.importe_total)) }));
  if (retencionesBreakdown.length > 0) {
    retencionesBreakdown.push({ label: 'Total Retenciones', val: retencionesBreakdown.reduce((a, r) => a + r.val, 0), total: true });
  }

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus(null);
    const periodo = `${selectedYear}-${selectedMonth}`;
    const payload = {
      periodo,
      mix_cafe: parseFloat(manual.mix_cafe) || 0,
      mix_producto: parseFloat(manual.mix_producto) || 0,
      mgn_cafe: parseFloat(manual.mgn_cafe) || 0,
      mgn_producto: parseFloat(manual.mgn_producto) || 0,
      excepcionales: parseFloat(manual.excepcionales) || 0,
    };
    try {
      const { error } = await supabase
        .from('ajustes_periodo')
        .upsert(payload, { onConflict: 'periodo' });

      if (!error) {
        setSaveStatus('ok');
        const saved = { ...payload };
        delete saved.periodo;
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

  if (error) return (
    <div className="animate-fade-in mt-8 text-center" style={{ paddingTop: 60 }}>
      <p style={{ fontSize: 15, color: '#f87171', fontWeight: 600 }}>Error al cargar datos</p>
      <p style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>{error}</p>
    </div>
  );

  const ventaBruta = n(kpisBase.venta_bruta);
  const ivaDébito = n(kpisBase.iva_debito);
  const ventaNeta = n(kpisBase.ventas_netas_reales);
  const cantOps = n(kpisBase.cant_operaciones);
  const ticketProm = cantOps > 0 ? ventaBruta / cantOps : 0;

  const totalFacturasBC = (arcaData || [])
    .filter(r => r.tipo_comp && !r.tipo_comp.endsWith(' A') && r.tipo_comp !== '1')
    .filter(r => categoriesMap[r.cuit] !== 'GASTO_FIJO') // Evitar duplicidad si se categorizó como fijo
    .reduce((acc, r) => acc + Math.abs(n(r.total ?? r.importe_total)), 0);

  const iibbTotal = (arcaData || [])
    .filter(r => r.rubro === 'Ingresos Brutos')
    .reduce((acc, r) => acc + Math.abs(n(r.total ?? r.importe_total)), 0);

  const retencionesTotal = (arcaData || [])
    .filter(r => r.rubro === 'Retenciones')
    .reduce((acc, r) => acc + Math.abs(n(r.total ?? r.importe_total)), 0);

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
  const operaciones = n(egresosBase.estructural); // backend ya incluye ARCA GASTO_FIJO en este total
  const excepcionales = parseFloat(manual.excepcionales) || 0;

  const totalGastos = sueldosTotal + operaciones + excepcionales;
  const resultadoMargenes = margenCafePesos + margenProductoPesos;
  const margenPct = ventaNeta > 0 ? ((resultadoMargenes / ventaNeta) * 100).toFixed(1) : '0.0';
  const resultadoPositivo = resultadoMargenes >= 0;

  const mesNombre = MESES[parseInt(selectedMonth) - 1];
  const periodoLabel = `${mesNombre} ${selectedYear}`;

  let resultadoAjustado = resultadoMargenes;
  const CAT_LABELS = {
    'limpieza_mantenimiento': 'Limpieza y Mant.',
    'servicios_profesionales': 'Servicios Prof.',
    'excepcionales': 'Gastos Excepcionales',
    'personal': 'Gastos Personales',
    'laboral': 'Sueldos y Cargas',
    'estructural': 'Gastos Fijos Operativos',
    'facturas_bc': 'Facturas B / C (ARCA)',
    'iibb': 'Ingresos Brutos',
    'retenciones': 'Retenciones',
    'comisiones': 'Comisiones Bancarias/Apps',
    'cmv': 'Proveedores CMV',
    'tipoBC': 'Proveedores Tipo B / C',
    'noApto': 'Proveedores N / A',
    'sA': 'Proveedores S / A'
  };

  const egresosKeysLower = Object.keys(egresosBase).map(k => k.toLowerCase());

  const dynamicExpenses = Object.keys(egresosBase)
    .filter(k => !['laboral', 'estructural', 'comisiones', 'otros', 'provision_sac', 'provision_cargas', 'proveedores', 'proveedores_varios'].includes(k.toLowerCase()))
    .map(k => ({
        key: k,
        value: n(egresosBase[k]) + (k === 'excepcionales' ? excepcionales : 0),
        label: CAT_LABELS[k] || k.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
        breakdown: proveedoresBreakdownData[k.toUpperCase()] || []
    }));

  const proveedoresCards = Object.keys(proveedoresBreakdownData)
    .filter(k => k !== 'cmv' && k !== 'tipoBC')
    .filter(k => !egresosKeysLower.includes(k.toLowerCase()))
    .map(k => {
        const bd = proveedoresBreakdownData[k];
        const val = bd.reduce((acc, i) => acc + i.val, 0);
        return {
            key: k,
            value: val,
            label: CAT_LABELS[k] || CAT_LABELS[k.toUpperCase()] || k.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
            breakdown: bd
        };
    })
    .filter(c => c.value > 0);

  const expensesToSubtract = [
    { key: 'laboral', value: sueldosTotal, label: 'Sueldos y Cargas', breakdown: laboralBreakdown },
    { key: 'estructural', value: operaciones, label: 'Gastos Fijos Operativos', breakdown: estructuralBreakdown },
    ...dynamicExpenses,
    ...proveedoresCards,
    { key: 'tipoBC', value: totalFacturasBC, label: 'Proveedores Tipo B / C', breakdown: proveedoresBreakdownData.tipoBC },
    { key: 'iibb', value: iibbTotal, label: 'Ingresos Brutos', breakdown: iibbBreakdown },
    { key: 'retenciones', value: retencionesTotal, label: 'Retenciones', breakdown: retencionesBreakdown },
    { key: 'comisiones', value: n(egresosBase.comisiones), label: 'Comisiones Bancarias/Apps' },
  ]; // Quitamos el filtro de !== 0

  expensesToSubtract.forEach(exp => {
    if (activeExpenses[exp.key]) {
      resultadoAjustado -= exp.value;
    }
  });

  const resultadoAjustadoPositivo = resultadoAjustado >= 0;
  const margenAjustadoPct = ventaNeta > 0 ? ((resultadoAjustado / ventaNeta) * 100).toFixed(1) : '0.0';

  const INFO_TOOLTIPS = {
    resultado: {
      title: "Resultado según márgenes esperados",
      explanation: "Esta pantalla arma una segunda mirada del negocio: en vez de partir de lo que gastaste realmente, partís de un margen que vos esperás ganar en Café y en Producto (los porcentajes que cargaste arriba). Con ese margen esperado, restás los gastos que tildes abajo y ves si el resultado da positivo o negativo — te sirve para comparar 'lo que debería dar' contra el Resultado real del Dashboard.",
      breakdown: [
        { label: 'Margen de Contribución (Café + Producto)', val: resultadoMargenes, color: 'text-emerald-400' },
        ...expensesToSubtract.filter(exp => activeExpenses[exp.key]).map(exp => ({ label: exp.label, val: -exp.value })),
        { label: 'Resultado Ajustado', val: resultadoAjustado, total: true, color: resultadoAjustadoPositivo ? 'text-emerald-400' : 'text-rose-400' }
      ]
    },
    ventas_card: {
      title: "Origen: Ventas Netas",
      explanation: `Se toma el Total Facturado que reportó tu sistema de ventas y se le resta el IVA que cobraste (${((configData?.alicuota_iva ?? 0.21) * 100).toFixed(1).replace(/\.0$/, '')}%), porque esa parte es del Estado, no tuya. Lo que queda es el dinero real que le entró al local ese mes.`,
      breakdown: [
        { label: 'Total Facturado (con IVA)', val: ventaBruta },
        { label: 'IVA Cobrado', val: -ivaDébito, color: 'text-rose-400' },
        { label: 'Venta Neta S/IVA', val: ventaNeta, total: true, color: 'text-emerald-400' }
      ]
    },
    gastos_card: {
      title: "Origen: Egresos Totales",
      explanation: "Suma de tres fuentes: el costo de tener empleados (sueldos + cargas + aguinaldo prorrateado), los gastos fijos del local (alquiler, servicios), y los gastos excepcionales que cargues manualmente en esta pantalla.",
      breakdown: [
        { label: 'Sueldos y Cargas', val: sueldosTotal },
        { label: 'Gastos Fijos Operativos', val: operaciones },
        { label: 'Excepcionales', val: excepcionales },
        { label: 'Total Gastos', val: totalGastos, total: true }
      ]
    },
    mix_cafe: { title: "Origen: Mix de Cafetería", explanation: "Lo cargás vos a mano: de cada $100 que vendés, ¿cuánto es café y cuánto es producto (comida, merchandising, etc.)? Esto importa porque el café y el producto casi nunca dejan el mismo margen de ganancia — separarlos te deja calcular un resultado más real que si tratás toda la venta como si fuera lo mismo. El % de Producto se completa solo con lo que sobra hasta 100." },
    laboral: {
        title: "Sueldos y Cargas",
        explanation: "Lo que te cuesta tener empleados en blanco: el sueldo que cobran, más la provisión de aguinaldo (SAC — un sueldo extra que la ley obliga a pagar en dos cuotas al año, acá prorrateado por mes) y las cargas sociales (aportes que vos como empleador le pagás al Estado por cada empleado, además del sueldo).",
        breakdown: laboralBreakdown
    },
    estructural: {
        title: "Gastos Fijos Operativos",
        explanation: "Son los gastos que tenés que pagar exista o no una sola venta ese mes: alquiler, luz, gas, internet, expensas. Se arman con las facturas que marcaste como gasto fijo en Categorías, o cargadas a mano.",
        breakdown: estructuralBreakdown
    },
    excepcionales: { title: "Gastos Excepcionales", explanation: "Gastos que no se repiten todos los meses — una reparación grande, una compra puntual — y que separamos para no distorsionar la lectura de un mes \"normal\" del negocio. Los cargás a mano en esta pantalla, o vienen de proveedores que categorizaste como Excepcionales." },
    limpieza: { title: "Limpieza y Mantenimiento", explanation: "Insumos de limpieza y arreglos del local: lo que hace falta para mantenerlo funcionando." },
    prof: { title: "Servicios Profesionales", explanation: "Lo que le pagás a tu contador, abogado o cualquier consultor externo del negocio." },
    personal: { title: "Gastos Personales", explanation: "Gastos de los dueños o socios que aparecen mezclados en las facturas del negocio pero que en realidad son gastos personales. Separarlos te deja ver la rentabilidad real del local, sin ese ruido." },
    iibb: {
        title: "Ingresos Brutos",
        explanation: "IIBB es un impuesto provincial (distinto del IVA) que se paga sobre lo que facturás. Acá registrás lo que pagaste de IIBB este período, ya sea porque tributás en un solo municipio (Local) o en varios (Convenio Multilateral).",
        breakdown: iibbBreakdown
    },
    retenciones: {
        title: "Retenciones",
        explanation: "Cuando cobrás con tarjeta o por apps de delivery, el banco o la app a veces te retiene una parte de IVA o Ganancias antes de depositarte el resto. Esa plata retenida ya es un pago a cuenta de tus impuestos — cargarla acá evita que el sistema muestre un monto a pagar más alto del real.",
        breakdown: retencionesBreakdown
    },
    comisiones: { title: "Cálculo: Comisiones", explanation: "Lo que te cobran los bancos y las apps de delivery o pago por cada venta con tarjeta u otro medio electrónico. Es un cálculo estimado: (Total Tarjetas × % que configuraste) + (Total Otros medios × % que configuraste). Si el número te parece alto, revisá esos porcentajes en la pestaña de Ajustes." },
    facturas_bc: {
        title: "Facturas B / C (ARCA)",
        explanation: "Proveedores que te facturan con Factura B o C — típicamente monotributistas. No discriminan IVA en la factura, así que son un gasto real del mes pero no generan crédito fiscal (no se descuentan de tu IVA).",
        breakdown: facturasBCBreakdown
    },
    margen_contribucion: { title: "Concepto: Margen de Contribución", explanation: "Es lo que te queda de cada venta después de pagarle al proveedor la mercadería (el CMV, o Costo de Mercadería Vendida). Vos cargás arriba qué % esperás ganar en Café y en Producto (\"MGN Cafetería\" y \"MGN Producto\") — esta pantalla toma esos porcentajes y te muestra si, con esa expectativa, el negocio da resultado positivo o negativo antes de bajar a los gastos operativos (sueldos, alquiler, etc.)." }
  };

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
        {import.meta.env.DEV && (
          <button onClick={() => setDebugOpen(true)} style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border-mid)',
            borderRadius: 8, color: colors.textDim, fontSize: 11, padding: '5px 10px', cursor: 'pointer',
          }}>debug</button>
        )}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <p style={{
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px',
                color: resultadoAjustadoPositivo
                  ? (isLight ? '#059669' : '#6ee7b7')
                  : (isLight ? '#dc2626' : '#fca5a5'),
                margin: 0,
              }}>Resultado según márgenes esperados</p>
              <button
                onClick={() => setInfoModal('resultado')}
                className="w-5 h-5 rounded-full border border-current opacity-50 hover:opacity-100 flex items-center justify-center text-[10px] font-bold transition-all"
                style={{ color: resultadoAjustadoPositivo ? (isLight ? '#059669' : '#4ade80') : (isLight ? '#dc2626' : '#f87171') }}
              >?</button>
            </div>
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
      <ScatterChart
        historial={dashData?.historial || {}}
        title="Escalabilidad: Venta Neta vs. Margen % (Histórico)"
      />
      <HistorialLineChart
        metrics={METRICS_CANTIDAD}
        historial={dashData?.historial || {}}
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

      {infoModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)'
        }} onClick={() => setInfoModal(null)}>
          {(() => {
            const expObj = expensesToSubtract.find(e => e.key === infoModal);
            const info = INFO_TOOLTIPS[infoModal] || {
              title: (expObj ? expObj.label : CAT_LABELS[infoModal]) || infoModal,
              explanation: "Categoría personalizada que vos mismo creaste en la pestaña Categorías. Agrupa los proveedores de ARCA que le asignaste manualmente.",
              breakdown: expObj?.breakdown?.length
                ? [...expObj.breakdown, { label: `Total ${expObj.label}`, val: expObj.value, total: true }]
                : []
            };
            return (
              <div style={{
                background: colors.bgCard, border: `1px solid ${colors.borderCard}`, borderRadius: 24,
                width: '90%', maxWidth: 450, padding: 28, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
              }} className="animate-pop-in" onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 900, color: colors.textPrimary, margin: 0 }}>
                    {info.title}
                  </h3>
                  <button 
                    onClick={() => setInfoModal(null)} 
                    style={{ background: 'none', border: 'none', color: colors.textDim, cursor: 'pointer', fontSize: 20 }}
                  >✕</button>
                </div>
                <p style={{ fontSize: 14, color: colors.textMuted, lineHeight: 1.6, margin: '0 0 24px', whiteSpace: 'pre-line' }}>
                  {info.explanation}
                </p>
                {info.breakdown && info.breakdown.length > 0 && (
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 900, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 14 }}>La Cuenta, Paso a Paso</p>
                    <LedgerBreakdown breakdown={info.breakdown} />
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

    </div>
  );
}
