import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useFinance } from './FinanceContext';
import { formatters as Utils } from './formatters';
import { Chart, registerables } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { CardSkeleton, ChartSkeleton } from './Skeleton';
import Card from './components/Card';

Chart.register(...registerables, ChartDataLabels);

function useTheme() {
  const [isLight, setIsLight] = useState(() => document.documentElement.dataset.theme === 'light');
  useEffect(() => {
    const obs = new MutationObserver(() => setIsLight(document.documentElement.dataset.theme === 'light'));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return isLight;
}

const MIX_COLORS = ['#3b82f6', '#10b981', '#64748b', '#f59e0b'];

const fmtM = v => {
    const n = Math.abs(parseFloat(v) || 0);
    return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(0) + 'K' : n.toFixed(0);
};

const WaterfallChart = ({ base, expenses, prefix }) => {
    const canvasRef = useRef(null);
    const chartRef = useRef(null);
    const isLight = useTheme();

    const chartData = useMemo(() => {
        if (!base && expenses.length === 0) return null;
        
        const labels = ['Ingreso Base'];
        const data = [[0, base]];
        const bgColors = [isLight ? 'rgba(16,185,129,0.8)' : 'rgba(16,185,129,0.6)'];
        const borders = [isLight ? '#10b981' : '#34d399'];

        let current = base;

        // Filtrar y agrupar gastos menores al 2% del total para no saturar el gráfico
        let sumOtros = 0;
        expenses.forEach(exp => {
            if (exp.value <= 0) return;
            if (exp.value / base < 0.02 && expenses.length > 6) {
                sumOtros += exp.value;
            } else {
                labels.push(exp.label);
                const end = current - exp.value;
                data.push([current, end]);
                current = end;
                bgColors.push(isLight ? 'rgba(244,63,94,0.7)' : 'rgba(244,63,94,0.5)');
                borders.push(isLight ? '#f43f5e' : '#fb7185');
            }
        });

        if (sumOtros > 0) {
            labels.push('Otros Gastos Menores');
            const end = current - sumOtros;
            data.push([current, end]);
            current = end;
            bgColors.push(isLight ? 'rgba(244,63,94,0.7)' : 'rgba(244,63,94,0.5)');
            borders.push(isLight ? '#f43f5e' : '#fb7185');
        }

        // Resultado Final
        labels.push('Resultado');
        data.push([0, current]);
        const isPositive = current >= 0;
        bgColors.push(isPositive ? (isLight ? 'rgba(59,130,246,0.8)' : 'rgba(59,130,246,0.6)') : (isLight ? 'rgba(244,63,94,0.8)' : 'rgba(244,63,94,0.6)'));
        borders.push(isPositive ? (isLight ? '#3b82f6' : '#60a5fa') : (isLight ? '#f43f5e' : '#fb7185'));

        return { labels, data, bgColors, borders };
    }, [base, expenses, isLight]);

    useEffect(() => {
        if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
        if (!canvasRef.current || !chartData) return;
        
        const gridColor = isLight ? 'rgba(28,37,55,0.07)' : 'rgba(255,255,255,0.035)';
        const tickColor = isLight ? '#6B7A90' : '#475569';
        const tooltipBg = isLight ? 'rgba(255,255,255,0.97)' : 'rgba(7,12,24,0.97)';
        const tooltipTitle = isLight ? '#1C2537' : '#f1f5f9';
        const tooltipBody = isLight ? '#374151' : '#94a3b8';

        chartRef.current = new Chart(canvasRef.current.getContext('2d'), {
            type: 'bar',
            data: {
                labels: chartData.labels,
                datasets: [{
                    data: chartData.data,
                    backgroundColor: chartData.bgColors,
                    borderColor: chartData.borders,
                    borderWidth: 1.5,
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                animation: { duration: 600, easing: 'easeOutBounce' },
                plugins: {
                    legend: { display: false },
                    datalabels: { display: false },
                    tooltip: {
                        backgroundColor: tooltipBg, titleColor: tooltipTitle, bodyColor: tooltipBody,
                        padding: 12, cornerRadius: 8,
                        callbacks: {
                            label: (ctx) => {
                                const raw = ctx.raw;
                                const val = Array.isArray(raw) ? Math.abs(raw[0] - raw[1]) : raw;
                                return `  ${prefix}${fmtM(val)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: tickColor, font: { size: 9, weight: '700' }, maxRotation: 45, minRotation: 45 } },
                    y: { grid: { color: gridColor }, border: { display: false }, ticks: { color: tickColor, font: { size: 10 }, callback: v => prefix + fmtM(v) } }
                }
            }
        });
        return () => { if (chartRef.current) chartRef.current.destroy(); };
    }, [chartData, prefix, isLight]);

    if (!chartData) return <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: '#64748b', fontSize: 11 }}>Sin datos suficientes</p></div>;
    return <div style={{ height: 260 }}><canvas ref={canvasRef}></canvas></div>;
};

// --- LEDGER: agrupa un breakdown en "Suman (+)" / "Restan (−)" + barra de total ---
// Cada fila normal se clasifica por el signo de su val. Una fila con total:true
// cierra una etapa (permite ledgers en varias etapas, ej. IVA con arrastre).
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

// --- MODAL DE INFORMACIÓN ---
const InfoModal = ({ isOpen, onClose, title, explanation, breakdown }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 backdrop-blur-md animate-fade-in p-4" onClick={onClose}>
            <div className="bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-card)] w-full max-w-lg rounded-[2.5rem] shadow-[0_0_50px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col max-h-[90vh] animate-pop-in pointer-events-auto" onClick={e => e.stopPropagation()}>
                <div className="p-7 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <h3 className="text-xl font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-black ring-1 ring-blue-500/30">?</span>
                        {title}
                    </h3>
                    <button onClick={onClose} className="text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-all w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/5 active:scale-90">✕</button>
                </div>
                <div className="p-8 overflow-y-auto scrollbar-hide">
                    <div className="mb-8">
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-3">Explicación Simple</p>
                        <p className="text-base text-slate-300 leading-relaxed font-medium whitespace-pre-line">{explanation}</p>
                    </div>
                    {breakdown && breakdown.length > 0 && (
                        <div>
                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-4">La Cuenta, Paso a Paso</p>
                            <LedgerBreakdown breakdown={breakdown} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const CardTitle = ({ title, onInfo }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--text-dim)', textTransform: 'uppercase', margin: 0 }}>{title}</p>
        <button onClick={onInfo} className="w-6 h-6 rounded-full border border-slate-700/50 text-slate-500 hover:text-blue-400 hover:border-blue-500/50 hover:bg-slate-800/50 flex items-center justify-center text-[10px] font-bold transition-all">?</button>
    </div>
);

const AlertsPanel = ({ kpis, egresos, periodo, empData = [], arcaData = [], ventasData = [] }) => {
    const [dismissed, setDismissed] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem(`alerts_dismissed_${periodo}`) || '[]');
        } catch (e) { return []; }
    });
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        try {
            setDismissed(JSON.parse(localStorage.getItem(`alerts_dismissed_${periodo}`) || '[]'));
        } catch (e) { setDismissed([]); }
    }, [periodo]);

    const alerts = useMemo(() => {
        const list = [];
        const ventasNetas = Utils.num(kpis.ventas_netas_reales);

        if (ventasNetas === 0 && ventasData.length === 0) {
            list.push({ id: 'sales_missing', type: 'warning', msg: 'Falta cargar Mis Ventas (resumen mensual de sistema de facturación).' });
        }
        if (Utils.num(egresos.laboral) === 0 && empData.length === 0) {
            list.push({ id: 'labor_missing', type: 'warning', msg: 'Falta cargar Salarios en "Mi equipo".' });
        }
        if (Utils.num(egresos.otros) === 0 && arcaData.length === 0) {
            list.push({ id: 'arca_missing', type: 'warning', msg: 'Falta cargar Mis compras (ARCA).' });
        }
        if (Utils.num(egresos.estructural) === 0) {
            list.push({ id: 'struct_missing', type: 'warning', msg: 'Falta cargar Gastos Fijos (alquiler, luz, gas, etc).' });
        }

        if (ventasNetas > 0) {
            if (Utils.num(kpis.utilidad_neta) < 0) {
                list.push({ id: 'loss', type: 'critical', msg: 'Este mes los gastos superaron a las ventas. El negocio está en pérdida operativa.' });
            }
            if (Utils.num(kpis.ventas_netas_reales) / ventasNetas < 0.50) {
                list.push({ id: 'low_margin', type: 'critical', msg: 'Menos del 50% de tus ventas quedan disponibles después de las comisiones. Revisá los medios de pago.' });
            }
            if (ventasNetas < Utils.num(kpis.break_even_mensual)) {
                list.push({ id: 'breakeven', type: 'warning', msg: 'Las ventas de este mes no alcanzan para cubrir todos los gastos fijos.' });
            }
            if (Utils.num(egresos.laboral) / ventasNetas > 0.35) {
                list.push({ id: 'labor_cost', type: 'warning', msg: 'El pago a empleados supera el 35% de las ventas. Es una proporción alta para el nivel de ingresos.' });
            }
        }

        return list.filter(a => !dismissed.includes(a.id));
    }, [kpis, egresos, dismissed]);

    const handleDismiss = (id) => {
        const newDismissed = [...dismissed, id];
        setDismissed(newDismissed);
        localStorage.setItem(`alerts_dismissed_${periodo}`, JSON.stringify(newDismissed));
    };

    if (alerts.length === 0) return null;

    return (
        <>
            <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 px-3 py-2 rounded-xl text-[10px] font-bold transition-all"
            >
                <span className="border border-amber-500/50 rounded-full w-4 h-4 flex items-center justify-center bg-amber-500 text-slate-900 text-[9px] font-black leading-none">{alerts.length}</span>
                <span>{alerts.length === 1 ? '1 aviso' : `${alerts.length} avisos`}</span>
            </button>

            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 backdrop-blur-md animate-fade-in p-4" onClick={() => setShowModal(false)}>
                    <div className="bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-card)] w-full max-w-lg rounded-[2.5rem] shadow-[0_0_50px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col max-h-[90vh] animate-pop-in pointer-events-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-7 border-b border-white/5 flex justify-between items-center bg-white/5">
                            <h3 className="text-xl font-extrabold text-[var(--text-primary)] tracking-tight flex items-center gap-3">
                                <span className="text-2xl animate-pulse">⚠️</span> Avisos del mes
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-all w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/5 active:scale-90">✕</button>
                        </div>
                        <div className="p-8 overflow-y-auto flex flex-col gap-4 scrollbar-hide">
                            {alerts.map((alert, idx) => (
                                <div
                                    key={alert.id}
                                    style={{ animationDelay: `${idx * 100}ms` }}
                                    className={`flex items-start justify-between p-5 rounded-3xl border animate-slide-up-fade shadow-lg transition-transform hover:scale-[1.02] ${
                                        alert.type === 'critical' ? 'bg-rose-500/10 border-rose-500/30' :
                                        alert.type === 'warning' ? 'bg-amber-400/10 border-amber-400/30' :
                                        'bg-blue-500/10 border-blue-500/30'
                                    }`}
                                >
                                    <div className="flex items-start gap-4">
                                        <span className="text-2xl pt-0.5 filter drop-shadow-md">
                                            {alert.type === 'critical' ? '🔴' : alert.type === 'warning' ? '🟡' : '🔵'}
                                        </span>
                                        <div className="flex flex-col gap-1">
                                            <p className={`text-[10px] font-black uppercase tracking-[0.2em] opacity-60 ${
                                                alert.type === 'critical' ? 'text-rose-400' :
                                                alert.type === 'warning' ? 'text-amber-400' :
                                                'text-blue-400'
                                            }`}>
                                                {alert.type === 'critical' ? 'Riesgo Crítico' : alert.type === 'warning' ? 'Advertencia' : 'Información'}
                                            </p>
                                            <span className={`text-sm font-bold leading-relaxed tracking-tight ${
                                                alert.type === 'critical' ? 'text-rose-100' :
                                                alert.type === 'warning' ? 'text-amber-100' :
                                                'text-blue-100'
                                            }`}>
                                                {alert.msg}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDismiss(alert.id)}
                                        className="text-slate-500 hover:text-white transition-colors p-1.5 hover:bg-white/5 rounded-lg ml-2"
                                        title="Ocultar esta alerta"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

const DashboardView = () => {
    const {
        dashData: data, empData, arcaData, ventasData, categoriesMap,
        loading, error, viewMode, setViewMode, isRefreshing,
        localAjustes, setLocalAjustes, updateConfig,
        selectedYear, selectedMonth, cargasPct,
        configData, availablePeriods
    } = useFinance();
    const isLight = useTheme();
    const [infoModalKey, setInfoModalKey] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [ivaShowAll, setIvaShowAll] = useState(false);
    const [ivaCobradoExpanded, setIvaCobradoExpanded] = useState(false);
    const [ivaProveedoresExpanded, setIvaProveedoresExpanded] = useState(false);
    const [detalleExpanded, setDetalleExpanded] = useState(false);
    const [resultadoBaseExpanded, setResultadoBaseExpanded] = useState(false);
    const [activeExpenses, setActiveExpenses] = useState({});

    const toggleExpense = (key) => {
        setActiveExpenses(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const ivaGrouped = useMemo(() => {
        const map = {};
        Utils.arr(arcaData).filter(r => Utils.num(r.iva) !== 0).forEach(item => {
            const key = item.entidad || 'Proveedor';
            if (!map[key]) map[key] = 0;
            map[key] += Math.abs(Utils.num(item.iva));
        });
        return Object.entries(map).sort((a, b) => b[1] - a[1]);
    }, [arcaData]);

    const alicuotaIva = configData?.alicuota_iva ?? 0.21;
    const ivaDivisor = 1 + alicuotaIva;

    const ivaCobradoBreakdown = useMemo(() => {
        return Utils.arr(ventasData).reduce((acc, v) => {
            const b = Utils.num(v.val_factura_b_elec);
            const a = Utils.num(v.val_factura_a_elec);
            const manual = Utils.num(v.val_factura_b);
            acc.totalBElec += b;
            acc.ivaB += b - (b / ivaDivisor);
            acc.totalAElec += a;
            acc.ivaA += a - (a / ivaDivisor);
            acc.totalB += manual;
            return acc;
        }, { ivaB: 0, ivaA: 0, totalB: 0, totalBElec: 0, totalAElec: 0 });
    }, [ventasData, ivaDivisor]);

    const { kpis, egresos, historial, mixPagos } = useMemo(() => ({
        kpis: data?.kpis || {},
        egresos: data?.egresos || {},
        historial: data?.historial || {},
        mixPagos: data?.mix_pagos || {}
    }), [data]);

    // Cálculo de Posición Fiscal Estimada (arrastra saldo a favor de los meses cargados en el sistema;
    // no contempla periodos anteriores a la primera carga, percepciones, ni alícuotas diferenciadas)
    const ivaPosicionTeorica = Utils.num(kpis.iva_posicion); // bruta del mes, sin arrastre
    const ivaSaldoFavorAnterior = Utils.num(kpis.iva_saldo_favor_anterior);
    const ivaPosicionConArrastre = kpis.iva_posicion_neta !== undefined
        ? Utils.num(kpis.iva_posicion_neta)
        : ivaPosicionTeorica;
    const ivaPosicionEstimada = ivaPosicionConArrastre - Math.abs(Utils.num(egresos.retenciones));

    // Completitud del período (reusa el score 0-4 ya calculado para el selector de períodos)
    const periodMeta = useMemo(() =>
        (availablePeriods || []).find(p => p.id === `${selectedYear}-${selectedMonth}`),
        [availablePeriods, selectedYear, selectedMonth]
    );
    const faltantes = useMemo(() => {
        if (!periodMeta) return [];
        return [
            [!periodMeta.hasVentas, 'Ventas'],
            [!periodMeta.hasCompras, 'ARCA'],
            [!periodMeta.hasEmp, 'Sueldos'],
            [!periodMeta.hasCostos, 'Costos manuales'],
        ].filter(([missing]) => missing).map(([, label]) => label);
    }, [periodMeta]);

    const getAdj = (val) => {
        const n = Utils.num(val);
        if (viewMode === 'REAL_IPC') return n * (localAjustes?.ipc || 1);
        if (viewMode === 'DOLAR_MEP') return n / (localAjustes?.mep || 1000);
        return n;
    };

    const handleSaveConfig = async () => {
        setIsSaving(true);
        const periodo = `${selectedYear}-${selectedMonth}`;
        await updateConfig(periodo, localAjustes.ipc, localAjustes.mep);
        setIsSaving(false);
    };

    const handleExportPDF = async () => {
        const element = document.getElementById('pnl-export-area');
        if (!element) return;
        setIsExporting(true);
        try {
            const canvas = await html2canvas(element, {
                scale: 2, backgroundColor: isLight ? '#F2F4F7' : '#070c18', logging: false, useCORS: true
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const imgProps = pdf.getImageProperties(imgData);
            const pdfImgHeight = (imgProps.height * (pdfWidth - 20)) / imgProps.width;
            pdf.setFillColor(15, 23, 42);
            pdf.rect(0, 0, pdfWidth, 40, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(22);
            pdf.text("Estado Result", 15, 20);
            pdf.setFontSize(10);
            pdf.setTextColor(148, 163, 184);
            pdf.text(`Reporte de P&L · ${selectedMonth}/${selectedYear}`, 15, 28);
            pdf.text(`Modo: ${viewMode}`, pdfWidth - 40, 28);
            pdf.addImage(imgData, 'PNG', 10, 45, pdfWidth - 20, pdfImgHeight);
            const pageHeight = pdf.internal.pageSize.getHeight();
            pdf.setFontSize(8);
            pdf.setTextColor(100, 116, 139);
            pdf.text("Generado con Estado Result — Solo para uso de gestión interna. No reemplaza estados contables oficiales.", 15, pageHeight - 16);
            pdf.text("(*) SAC y Cargas Sociales son provisiones estimadas. Comisiones bancarias son aproximaciones. Consultar con contador para liquidación definitiva.", 15, pageHeight - 10);
            pdf.save(`EstadoResultado_${selectedYear}_${selectedMonth}.pdf`);
        } catch (err) {
            console.error("Error al exportar PDF:", err);
            alert("Error al generar el PDF. Verifica que la página haya cargado completamente.");
        } finally {
            setIsExporting(false);
        }
    };

    const utilidad = getAdj(kpis.utilidad_neta);
    const ventasNetas = getAdj(kpis.ventas_netas_reales);
    const margen = ventasNetas !== 0 ? ((utilidad / ventasNetas) * 100).toFixed(1) : '0.0';

    // Mes anterior para comparativas
    const prevPeriod = useMemo(() => {
        const d = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 2, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }, [selectedYear, selectedMonth]);
    const prev = historial[prevPeriod];

    const pctDelta = (current, previous) => {
        if (!previous || previous === 0) return null;
        return ((current - previous) / Math.abs(previous) * 100).toFixed(1);
    };

    const laboralEfectivo = Utils.num(egresos.laboral) > 0
        ? Utils.num(egresos.laboral)
        : Utils.arr(empData).reduce((acc, emp) => acc + (Utils.num(emp.costo_total) || Utils.num(emp.recibo) + Utils.num(emp.negro)), 0);

    const reciboEfectivo = Utils.arr(empData).reduce((acc, emp) => acc + Utils.num(emp.recibo), 0);

    const sacEfectivo = Utils.num(egresos.provision_sac) > 0
        ? Utils.num(egresos.provision_sac)
        : laboralEfectivo / 12;

    const cargasEfectivo = Utils.num(egresos.provision_cargas) > 0
        ? Utils.num(egresos.provision_cargas)
        : reciboEfectivo * (parseFloat(cargasPct || 33) / 100);

    // Re-calculamos estructurales y otros basándonos en el mapeo de categorías
    const gastosEstructuralesReal = getAdj(egresos.estructural || 0);
    const proveedoresRestante = getAdj(egresos.otros || 0);

    const egresoTotal =
        getAdj(laboralEfectivo) +
        getAdj(sacEfectivo) +
        getAdj(cargasEfectivo) +
        gastosEstructuralesReal +
        getAdj(egresos.comisiones || 0) +
        Math.max(0, proveedoresRestante); // Asegurar que no sea negativo por desajustes

    const sueldosTotal = getAdj(laboralEfectivo) + getAdj(sacEfectivo) + getAdj(cargasEfectivo);

    const comprasBreakdown = useMemo(() => {
        let cmv = 0, tipoBC = 0, noApto = 0, sA = 0;
        const dynamicCats = {};

        Utils.arr(arcaData).forEach(item => {
            const cuit = item.doc_nro || item.cuit;
            const cat = categoriesMap[cuit] || '';
            const tipo = (item.tipo_comp || '').toUpperCase();
            
            if (cat === 'GASTO_FIJO' || item.rubro === 'Costos Estructurales') return;

            const total = Utils.num(item.total);
            const isBC = /(?:FACTURA|TIQUE|RECIBO|CREDITO|DEBITO|TIQUET)\s+[BC]\b/i.test(tipo) || tipo === 'B' || tipo === 'C' || tipo.endsWith(' B') || tipo.endsWith(' C');
            
            if (isBC) {
                tipoBC += total;
            } else if (cat === 'PROVEEDOR') {
                cmv += total;
            } else if (cat === 'NO_APTO') {
                noApto += total;
            } else if (cat && cat !== '') {
                dynamicCats[cat] = (dynamicCats[cat] || 0) + total;
            } else {
                sA += total;
            }
        });

        // Ajuste al remanente Sin Asignar
        const totalCalculado = cmv + tipoBC + noApto + sA + Object.values(dynamicCats).reduce((a,b) => a+b, 0);
        const totalLineal = Utils.num(egresos.otros || 0);
        if (Math.abs(totalLineal - totalCalculado) > 1) {
            sA += (totalLineal - totalCalculado);
        }

        const result = { 
            cmv: getAdj(cmv), 
            tipoBC: getAdj(tipoBC), 
            noApto: getAdj(noApto), 
            sA: getAdj(sA)
        };
        Object.entries(dynamicCats).forEach(([k, v]) => {
            result[k] = getAdj(v);
        });

        return result;
    }, [arcaData, categoriesMap, egresos.otros, viewMode, localAjustes]);

    const arcaGastosFijosBreakdown = useMemo(() => {
        const map = {};
        Utils.arr(arcaData)
            .filter(r => categoriesMap[r.doc_nro || r.cuit] === 'GASTO_FIJO' || r.rubro === 'Costos Estructurales')
            .forEach(r => {
                const label = r.sub_rubro || r.entidad || r.doc_nro || r.cuit || 'Gasto Fijo';
                map[label] = (map[label] || 0) + Math.abs(Utils.num(r.total));
            });
        return Object.entries(map)
            .map(([label, val]) => ({ label, val: getAdj(val) }))
            .sort((a, b) => b.val - a.val);
    }, [arcaData, categoriesMap, localAjustes, viewMode]);

    const arcaGastosFijos = useMemo(() => {
        return arcaGastosFijosBreakdown.reduce((acc, r) => acc + r.val, 0);
    }, [arcaGastosFijosBreakdown]);

    const proveedoresBreakdownData = useMemo(() => {
        const result = { cmv: [], tipoBC: [], noApto: [], sA: [] };
        Utils.arr(arcaData).forEach(item => {
            const cuit = item.doc_nro || item.cuit;
            const cat = categoriesMap[cuit] || '';
            const tipo = (item.tipo_comp || '').toUpperCase();
            if (cat === 'GASTO_FIJO' || item.rubro === 'Costos Estructurales') return;

            const total = Utils.num(item.total);
            const isBC = /(?:FACTURA|TIQUE|RECIBO|CREDITO|DEBITO|TIQUET)\s+[BC]\b/i.test(tipo) || tipo === 'B' || tipo === 'C' || tipo.endsWith(' B') || tipo.endsWith(' C');
            const label = item.entidad || cuit || 'Proveedor';

            if (isBC) {
                result.tipoBC.push({ label, val: total });
            } else if (cat === 'PROVEEDOR') {
                result.cmv.push({ label, val: total });
            } else if (cat === 'NO_APTO') {
                result.noApto.push({ label, val: total });
            } else if (cat && cat !== '') {
                if (!result[cat]) result[cat] = [];
                result[cat].push({ label, val: total });
            } else {
                result.sA.push({ label, val: total });
            }
        });
        
        // Agrupar por label y ordenar por valor para cada categoría
        const grouped = {};
        Object.entries(result).forEach(([catKey, items]) => {
            const map = {};
            items.forEach(i => { map[i.label] = (map[i.label] || 0) + i.val; });
            grouped[catKey] = Object.entries(map)
                .map(([label, val]) => ({ label, val: getAdj(val) }))
                .sort((a, b) => b.val - a.val);
        });

        return grouped;
    }, [arcaData, categoriesMap, localAjustes, viewMode]);


    // Mapeo amigable para las cards
    const CAT_LABELS = {
        'LIMPIEZA_MANTENIMIENTO': 'Limpieza y Mant.',
        'SERVICIOS_PROFESIONALES': 'Servicios Prof.',
        'EXCEPCIONALES': 'Gastos Excepcionales',
        'PERSONAL': 'Gastos Personales',
        'NO_APTO': 'Proveedores N/A',
        'sA': 'Proveedores S/A',
        'tipoBC': 'Proveedores Tipo B/C',
        'cmv': 'Proveedores CMV'
    };

    const dynamicCards = Object.entries(comprasBreakdown)
        .filter(([k]) => !['cmv', 'tipoBC', 'noApto', 'sA'].includes(k))
        .map(([k, v]) => ({
            key: k,
            value: v,
            label: CAT_LABELS[k] || k.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
        }));

    const expensesToSubtract = [
        { key: 'laboral', value: sueldosTotal, label: 'Sueldos y Cargas' },
        { key: 'estructural', value: gastosEstructuralesReal, label: 'Gastos Fijos Operativos' },
        { key: 'cmv', value: comprasBreakdown.cmv, label: 'Proveedores CMV' },
        { key: 'tipoBC', value: comprasBreakdown.tipoBC, label: 'Proveedores Tipo B/C' },
        ...dynamicCards,
        { key: 'noApto', value: comprasBreakdown.noApto, label: 'Proveedores N/A' },
        { key: 'sA', value: comprasBreakdown.sA, label: 'Proveedores S/A' },
        { key: 'comisiones', value: getAdj(egresos.comisiones || 0), label: 'Comisiones Bancarias/Apps' },
    ];

    const baseDineroFacturado = getAdj(
        (ivaCobradoBreakdown.totalAElec - ivaCobradoBreakdown.ivaA) + 
        (ivaCobradoBreakdown.totalBElec - ivaCobradoBreakdown.ivaB) + 
        ivaCobradoBreakdown.totalB
    );

    let resultadoAjustado = baseDineroFacturado;
    expensesToSubtract.forEach(exp => {
        if (activeExpenses[exp.key]) {
            resultadoAjustado -= exp.value;
        }
    });

    const resultadoAjustadoPositivo = resultadoAjustado >= 0;
    const margenAjustadoPct = baseDineroFacturado !== 0 ? ((resultadoAjustado / baseDineroFacturado) * 100).toFixed(1) : '0.0';

    // Solo mostrar skeleton si estamos cargando Y NO tenemos datos previos
    if (loading && !data) return (
        <div className="animate-fade-in space-y-6" style={{ marginTop: 32 }}>
            <div className="h-32 bg-slate-900/40 rounded-2xl border border-slate-800/40 skeleton mb-6" />
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, marginBottom: 16 }}>
                <ChartSkeleton />
                <CardSkeleton />
            </div>
        </div>
    );

    if (error) return (
        <div style={{ marginTop: 32, padding: 32, background: 'rgba(159,18,57,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 16, textAlign: 'center' }}>
            <p style={{ color: '#fda4af', fontWeight: 700 }}>⚠️ {error}</p>
        </div>
    );

    if (!data || (Utils.num(kpis.venta_bruta) === 0 && egresoTotal === 0)) return (
        <div className="animate-fade-in flex flex-col items-center justify-center min-h-[60vh] text-center px-4" style={{ paddingBottom: 40 }}>
            <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center text-4xl mb-6 border border-slate-700 shadow-inner">📂</div>
            <h2 className="text-xl font-bold text-slate-200 mb-2">No hay datos para este período todavía</h2>
            <p className="text-slate-500 max-w-md">Seleccioná otro mes arriba o cargá la información necesaria en la pestaña <strong>Carga de Datos</strong> dentro del menú de Datos.</p>
        </div>
    );

    // Helper: nota de "top 10" cuando la lista de proveedores viene truncada
    const truncNote = (key) => {
        const n = proveedoresBreakdownData[key]?.length || 0;
        return n > 10 ? `\n\n(Te mostramos los 10 proveedores más grandes de ${n} en total — el total de abajo sí suma a todos, no solo a los que ves en la lista.)` : '';
    };

    const infoData = {
        'resultado': {
            title: 'Resultado del Período (Interactivo)',
            explanation: 'Es la plata que te queda en el bolsillo después de pagar todo. Arrancás con lo que facturaste (sin contar el IVA, que no es tuyo) y le vas restando cada gasto que tildes en la grilla de abajo. Lo que sobra al final es tu ganancia real del mes — o tu pérdida, si el número da negativo.',
            breakdown: [
                { label: 'Ingresos Facturados (Base)', val: baseDineroFacturado, color: 'text-emerald-400' },
                ...expensesToSubtract.filter(exp => activeExpenses[exp.key]).map(exp => ({ label: exp.label, val: -exp.value })),
                { label: 'Resultado del Mes', val: resultadoAjustado, total: true, color: resultadoAjustadoPositivo ? 'text-emerald-400' : 'text-rose-400' }
            ]
        },
        'iva': {
            title: 'Tu IVA del mes',
            explanation: `El IVA no es plata tuya: es un impuesto que el Estado te pide que cobres por él y después se lo entregues. Cada vez que vendés, cobrás de más un ${(alicuotaIva * 100).toFixed(1).replace(/\.0$/, '')}% (se llama "débito fiscal") que le pertenece a AFIP. Cada vez que comprás con factura, vos también pagás ese IVA — y ese lo podés descontar de lo que debés (se llama "crédito fiscal"). La resta entre lo que cobraste y lo que pagaste es lo que realmente le tenés que girar a AFIP.\n\nSi el número final da positivo → tenés que pagar ese monto.\nSi da negativo → tenés saldo a favor (AFIP te "debe" a vos, y ese saldo se arrastra al mes que viene).`,
            breakdown: [
                { label: 'IVA Débito Fiscal (lo que cobraste)', val: Utils.num(kpis.iva_debito), color: 'text-emerald-400' },
                { label: 'IVA Crédito Fiscal (lo que pagaste)', val: -Utils.num(kpis.iva_credito || 0), color: 'text-rose-400' },
                { label: 'Posición bruta del mes (sin arrastre)', val: Utils.num(kpis.iva_posicion), total: true },
                ...(ivaSaldoFavorAnterior > 0 ? [
                    { label: 'Saldo a favor arrastrado de meses anteriores', val: -ivaSaldoFavorAnterior, color: 'text-emerald-400' },
                    { label: 'Posición final estimada', val: ivaPosicionConArrastre, total: true }
                ] : [])
            ]
        },
        'iva_limitaciones': {
            title: 'Limitaciones de esta estimación',
            explanation: 'Esta posición de IVA es una estimación orientativa, no un cálculo de DDJJ. No reemplaza la liquidación de tu contador. Cuatro cosas que no contempla:\n\n1. Períodos anteriores a tu primera carga en el sistema — el arrastre de saldo a favor solo ve dentro de los meses ya cargados acá.\n\n2. Percepciones de IVA (bancarias, de proveedores, aduaneras) — no se registran en esta herramienta.\n\n3. Alícuotas diferenciadas (10.5%, 27%) — el cálculo usa la alícuota general configurada, no discrimina por tipo de producto o servicio.\n\n4. IIBB (Ingresos Brutos) y otras retenciones/percepciones provinciales — quedan fuera del alcance, son un impuesto distinto al IVA.',
        },
        'ventas': {
            title: 'Ventas Netas',
            explanation: 'Es lo que realmente entra al bolsillo del local. Se toma el Total Facturado bruto (con IVA incluido) y se le resta el IVA Débito Fiscal, porque esa parte nunca fue tuya — es del Estado. Lo que queda es la base real sobre la que medimos si el negocio es rentable.',
            breakdown: [
                { label: 'Total Facturado (con IVA)', val: kpis.venta_bruta },
                { label: 'IVA Débito Fiscal', val: -kpis.iva_debito, color: 'text-rose-400' },
                { label: 'Venta Real Neta', val: kpis.ventas_netas_reales, total: true, color: 'text-emerald-400' }
            ]
        },
        'egresos_totales': {
            title: 'Total de Gastos del Mes',
            explanation: 'Todo lo que salió de la caja este mes: sueldos y cargas, gastos fijos como alquiler y servicios, mercadería y otros proveedores, y las comisiones que te cobran bancos y apps de delivery/pago. Es la suma de todos los gastos operativos, sin contar el IVA.',
            breakdown: [
                ...expensesToSubtract.map(exp => ({ label: exp.label, val: exp.value })),
                { label: 'Total de Gastos', val: egresoTotal, total: true }
            ]
        },
        'waterfall': {
            title: 'Qué es este gráfico',
            explanation: 'Se llama gráfico "cascada" porque cada barra empieza justo donde terminó la anterior — como el agua bajando de escalón en escalón. Arranca con tus ingresos (barra verde), le va restando cada gasto que tengas tildado abajo (barras rojas), y la última barra te muestra lo que sobra: el resultado del mes. Prendé o apagá gastos en la grilla de "Resultado del Mes" para ver cómo cambia.'
        },
        'laboral': {
            title: 'Sueldos y Cargas',
            explanation: 'Lo que te cuesta tener empleados en blanco: el sueldo que cobran, más la provisión de aguinaldo (SAC — un sueldo extra que la ley obliga a pagar en dos cuotas al año, acá lo prorrateamos mes a mes) y las cargas sociales (aportes que vos como empleador le pagás al Estado por cada empleado, además del sueldo).\n\n* SAC y Cargas Sociales son estimaciones (1/12 y % configurable). Las cargas reales varían por convenio, ART y sindicato. Consultá con tu contador para la liquidación definitiva.',
            breakdown: [
                { label: 'Sueldos Netos (Caja + Recibo)', val: getAdj(laboralEfectivo) },
                { label: 'Provisión SAC (estimada *)', val: getAdj(sacEfectivo) },
                { label: 'Cargas Sociales (estimadas *)', val: getAdj(cargasEfectivo) },
                { label: 'Costo Laboral Total', val: sueldosTotal, total: true }
            ]
        },
        'estructural': {
            title: 'Gastos Fijos Operativos',
            explanation: 'Son los gastos que tenés que pagar exista o no una sola venta ese mes: alquiler, luz, gas, internet. Se arman con las facturas de AFIP que marcaste como "Gasto Fijo" en Categorías, o que cargaste a mano.',
            breakdown: [
                ...arcaGastosFijosBreakdown,
                { label: 'Total Gastos Fijos', val: gastosEstructuralesReal, total: true }
            ]
        },
        'cmv': {
            title: 'Proveedores CMV',
            explanation: `Son los proveedores que te venden la mercadería que después revendés: café, insumos, bebidas. En la jerga contable esto se llama "Costo de Mercadería Vendida" (CMV). Como te facturan con Factura A, estas compras generan crédito fiscal de IVA — el IVA que pagás acá es el mismo que restás en la card de IVA.${truncNote('cmv')}`,
            breakdown: [...(proveedoresBreakdownData.cmv?.slice(0, 10) || []), { label: 'Total Proveedores CMV', val: comprasBreakdown.cmv, total: true }]
        },
        'tipoBC': {
            title: 'Proveedores Tipo B/C',
            explanation: `Proveedores que te facturan con Factura B o C — típicamente monotributistas. Estas facturas no discriminan IVA, así que son un gasto real del mes pero no te generan crédito fiscal para descontar de tu IVA.${truncNote('tipoBC')}`,
            breakdown: [...(proveedoresBreakdownData.tipoBC?.slice(0, 10) || []), { label: 'Total Proveedores Tipo B/C', val: comprasBreakdown.tipoBC, total: true }]
        },
        'EXCEPCIONALES': {
            title: 'Gastos Excepcionales',
            explanation: `Gastos que no se repiten todos los meses — una reparación grande, una compra puntual — y que separamos para que no te distorsionen la lectura de cómo viene un mes "normal" del negocio.${truncNote('EXCEPCIONALES')}`,
            breakdown: [...(proveedoresBreakdownData.EXCEPCIONALES?.slice(0, 10) || []), { label: 'Total Gastos Excepcionales', val: comprasBreakdown.EXCEPCIONALES || 0, total: true }]
        },
        'LIMPIEZA_MANTENIMIENTO': {
            title: 'Limpieza y Mantenimiento',
            explanation: `Insumos de limpieza y arreglos del local: lo que hace falta para mantenerlo funcionando y presentable.${truncNote('LIMPIEZA_MANTENIMIENTO')}`,
            breakdown: [...(proveedoresBreakdownData.LIMPIEZA_MANTENIMIENTO?.slice(0, 10) || []), { label: 'Total Limpieza y Mant.', val: comprasBreakdown.LIMPIEZA_MANTENIMIENTO || 0, total: true }]
        },
        'SERVICIOS_PROFESIONALES': {
            title: 'Servicios Profesionales',
            explanation: `Lo que le pagás a tu contador, abogado o cualquier consultor externo del negocio.${truncNote('SERVICIOS_PROFESIONALES')}`,
            breakdown: [...(proveedoresBreakdownData.SERVICIOS_PROFESIONALES?.slice(0, 10) || []), { label: 'Total Servicios Prof.', val: comprasBreakdown.SERVICIOS_PROFESIONALES || 0, total: true }]
        },
        'PERSONAL': {
            title: 'Gastos Personales',
            explanation: `Gastos de los dueños o socios que aparecen mezclados en las facturas del negocio pero que en realidad son gastos personales. Vale la pena separarlos para ver cuál es la rentabilidad real del local, sin ese ruido.${truncNote('PERSONAL')}`,
            breakdown: [...(proveedoresBreakdownData.PERSONAL?.slice(0, 10) || []), { label: 'Total Gastos Personales', val: comprasBreakdown.PERSONAL || 0, total: true }]
        },
        'noApto': {
            title: 'Proveedores N/A',
            explanation: `Facturas que el sistema detectó como proveedor pero que marcaste como "No Apto" en Categorías — no forman parte del giro principal del negocio, así que no las contamos como costo operativo.${truncNote('noApto')}`,
            breakdown: [...(proveedoresBreakdownData.noApto?.slice(0, 10) || []), { label: 'Total Proveedores N/A', val: comprasBreakdown.noApto, total: true }]
        },
        'sA': {
            title: 'Proveedores S/A',
            explanation: `Gastos que aparecen en ARCA pero todavía no categorizaste. Andá a la pestaña Categorías y asignales un rubro — así dejan de aparecer como "sin asignar" y el resto de las cards queda más preciso.${truncNote('sA')}`,
            breakdown: [...(proveedoresBreakdownData.sA?.slice(0, 10) || []), { label: 'Total Proveedores S/A', val: comprasBreakdown.sA, total: true }]
        },
        'comisiones': {
            title: 'Comisiones Bancarias/Apps',
            explanation: 'Lo que te cobran los bancos y las apps de delivery o pago por cada venta con tarjeta u otro medio electrónico. Es un cálculo estimado según los porcentajes que vos mismo definiste en la pestaña de Ajustes, aplicado sobre los medios de pago que reporta Maxirest.\n\n* Son aproximaciones. Las comisiones reales dependen de cada liquidación bancaria e incluyen retenciones de IVA/IIBB/Ganancias que acá no se contemplan.',
            breakdown: [
                { label: 'Tarjetas (Estimado)', val: getAdj(egresos.comisiones || 0) * 0.7 },
                { label: 'Apps / Otros (Estimado)', val: getAdj(egresos.comisiones || 0) * 0.3 },
                { label: 'Total Comisiones', val: getAdj(egresos.comisiones || 0), total: true }
            ]
        },
    };

    const ivaProveedoresVisible = ivaShowAll ? ivaGrouped : ivaGrouped.slice(0, 10);

    return (
        <div className="animate-fade-in" style={{ paddingBottom: 40,
            opacity: isRefreshing ? 0.7 : 1, // Atenuar sutilmente durante la sincronización en segundo plano
            transition: 'opacity 0.3s ease-in-out'
        }}>

            <InfoModal
                isOpen={!!infoModalKey}
                onClose={() => setInfoModalKey(null)}
                {...(infoData[infoModalKey] || {
                    title: CAT_LABELS[infoModalKey] || infoModalKey,
                    explanation: `Categoría personalizada que vos mismo creaste en la pestaña Categorías. Agrupa los proveedores de ARCA que le asignaste manualmente.${truncNote(infoModalKey)}`,
                    breakdown: proveedoresBreakdownData[infoModalKey]?.length
                        ? [...proveedoresBreakdownData[infoModalKey].slice(0, 10), { label: `Total ${CAT_LABELS[infoModalKey] || infoModalKey}`, val: comprasBreakdown[infoModalKey] ?? proveedoresBreakdownData[infoModalKey].reduce((a, r) => a + r.val, 0), total: true }]
                        : []
                })}
            />

            {/* Selector de Vista y MEP */}
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', background: 'var(--bg-surface)', padding: 4, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                        {['NOMINAL', 'DOLAR_MEP'].map(m => (
                            <button
                                key={m}
                                onClick={() => setViewMode(m)}
                                style={{
                                    padding: '8px 16px', borderRadius: 8, fontSize: 10, fontWeight: 900, border: 'none',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    background: viewMode === m ? '#3b82f6' : 'transparent',
                                    color: viewMode === m ? 'white' : 'var(--text-dim)',
                                    boxShadow: viewMode === m ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none',
                                    cursor: 'pointer', letterSpacing: '0.05em'
                                }}
                            >
                                {m === 'NOMINAL' ? 'Pesos actuales' : 'En dólares'}
                            </button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-surface)', padding: '6px 12px', borderRadius: 12, border: '1px solid rgba(139,92,246,0.2)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontSize: 8, fontWeight: 800, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Dólar MEP</span>
                                <span title="Cotización real del mercado (dolarito.ar o similar)" style={{ fontSize: 7, color: '#4c1d95', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)', padding: '1px 4px', borderRadius: 3, cursor: 'help', fontWeight: 800 }}>COTI</span>
                            </div>
                            <input
                                type="number"
                                value={localAjustes.mep}
                                onChange={(e) => setLocalAjustes(prev => ({ ...prev, mep: e.target.value }))}
                                style={{ width: 68, background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-mid)', color: '#8b5cf6', fontSize: 12, fontWeight: 800, outline: 'none', padding: '0 2px' }}
                            />
                        </div>
                        {parseFloat(data?.ajustes?.mep) !== parseFloat(localAjustes.mep) && (
                            <button
                                onClick={handleSaveConfig}
                                disabled={isSaving}
                                style={{
                                    padding: '6px 12px', borderRadius: 8, fontSize: 10, fontWeight: 800,
                                    background: '#10b981', color: 'white', border: 'none', cursor: 'pointer',
                                    transition: 'all 0.2s', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.2)',
                                    opacity: isSaving ? 0.6 : 1
                                }}
                            >
                                {isSaving ? '...' : 'Guardar'}
                            </button>
                        )}
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {faltantes.length > 0 && (
                        <span
                            title="Categorías sin datos cargados para este período"
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
                                border: '1px solid rgba(245,158,11,0.3)',
                                padding: '8px 12px', borderRadius: 12,
                                fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em'
                            }}
                        >
                            Faltan: {faltantes.join(', ')}
                        </span>
                    )}
                    <AlertsPanel
                        kpis={kpis}
                        egresos={{ ...egresos, laboral: laboralEfectivo }}
                        periodo={`${selectedYear}-${selectedMonth}`}
                        empData={empData}
                        arcaData={arcaData}
                        ventasData={ventasData}
                    />
                    <button
                        onClick={handleExportPDF}
                        disabled={isExporting}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${isExporting ? 'bg-slate-800 border-slate-700 text-slate-500' : 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20'}`}
                    >
                        {isExporting ? <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div> : <span>📄</span>}
                        {isExporting ? 'Exportando...' : 'Exportar P&L'}
                    </button>
                </div>
            </div>

            <div id="pnl-export-area" className="p-4" style={{ margin: '-16px' }}>

                {/* ── RESUMEN EJECUTIVO ────────────────────────────── */}
                <div style={{ marginBottom: 16, padding: '20px 24px', borderRadius: 16, background: isLight ? 'rgba(28,37,55,0.03)' : 'rgba(255,255,255,0.02)', border: `1px solid ${isLight ? 'rgba(28,37,55,0.08)' : 'rgba(255,255,255,0.05)'}` }}>
                    <p style={{ fontSize: 14, lineHeight: 1.7, color: isLight ? '#374151' : '#cbd5e1', margin: 0 }}>
                        Este mes facturaste <strong style={{ color: isLight ? '#059669' : '#4ade80' }}>{viewMode === 'DOLAR_MEP' ? 'u$s ' : '$'}{Utils.fmt(ventasNetas)}</strong> netos
                        <button onClick={() => setInfoModalKey('ventas')} title="¿Cómo se calcula?" style={{ width: 15, height: 15, borderRadius: '50%', border: '1px solid var(--border-subtle)', background: 'none', color: 'var(--text-faint)', fontSize: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', verticalAlign: 'middle', margin: '0 2px' }}>?</button>,
                        gastaste <strong style={{ color: isLight ? '#dc2626' : '#f87171' }}>{viewMode === 'DOLAR_MEP' ? 'u$s ' : '$'}{Utils.fmt(egresoTotal)}</strong>
                        <button onClick={() => setInfoModalKey('egresos_totales')} title="¿En qué se fue?" style={{ width: 15, height: 15, borderRadius: '50%', border: '1px solid var(--border-subtle)', background: 'none', color: 'var(--text-faint)', fontSize: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', verticalAlign: 'middle', margin: '0 2px' }}>?</button>{' '}y
                        te {utilidad >= 0 ? 'quedaron' : 'faltaron'} <strong style={{ color: utilidad >= 0 ? (isLight ? '#059669' : '#4ade80') : (isLight ? '#dc2626' : '#f87171') }}>{viewMode === 'DOLAR_MEP' ? 'u$s ' : '$'}{Utils.fmt(Math.abs(utilidad))}</strong>.
                        {' '}Margen operativo: <strong style={{ color: +margen > 15 ? '#10b981' : +margen > 5 ? '#f59e0b' : '#f43f5e' }}>{margen}%</strong>.
                    </p>
                    {prev && prev.v > 0 && (
                        <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
                            {[
                                { label: 'Ventas', delta: pctDelta(ventasNetas, getAdj(prev.v)) },
                                { label: 'Ticket', delta: pctDelta(getAdj(kpis.venta_bruta) / (Utils.num(kpis.cant_operaciones) || 1), getAdj(prev.ticket)) },
                                { label: 'Resultado', delta: pctDelta(utilidad, getAdj(prev.resultado_mgn)) },
                                { label: 'Operaciones', delta: pctDelta(Utils.num(kpis.cant_operaciones), prev.ops) },
                            ].filter(d => d.delta !== null).map(d => (
                                <span key={d.label} style={{ fontSize: 11, color: isLight ? '#6B7A90' : '#64748b' }}>
                                    {d.label}{' '}
                                    <strong style={{ color: +d.delta > 0 ? '#10b981' : +d.delta < 0 ? '#f43f5e' : (isLight ? '#6B7A90' : '#64748b') }}>
                                        {+d.delta > 0 ? '+' : ''}{d.delta}%
                                    </strong>
                                    {' '}vs mes ant.
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── IVA DEL MES ─────────────────────────────────── */}
                <div style={{ marginBottom: 16 }}>
                    <Card style={{ padding: 28, borderLeft: '4px solid #3b82f6', background: isLight ? 'linear-gradient(135deg, rgba(59,130,246,0.06) 0%, #F8F9FB 100%)' : 'linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(15,23,42,0.6) 100%)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <CardTitle title="Posición Fiscal IVA" onInfo={() => setInfoModalKey('iva')} />
                                <p className="text-4xl font-black tracking-tighter leading-none font-mono" style={{ color: ivaPosicionEstimada > 0 ? '#f43f5e' : '#10b981', fontVariantNumeric: 'tabular-nums', margin: 0 }}>
                                    {viewMode === 'DOLAR_MEP' ? 'u$s ' : ''}{Utils.fmt(getAdj(ivaPosicionEstimada))}
                                </p>
                                <p style={{ fontSize: 13, fontWeight: 700, marginTop: 10, color: ivaPosicionEstimada > 0 ? '#f43f5e' : '#10b981' }}>
                                    {ivaPosicionEstimada > 0 ? 'Monto estimado a pagar (VEP)' : 'Saldo a favor proyectado'}
                                </p>
                            </div>
                            <div style={{ textAlign: 'right', background: 'rgba(59,130,246,0.05)', padding: '12px 16px', borderRadius: 16, border: '1px solid rgba(59,130,246,0.1)' }}>
                                <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 8 }}>Ajustes de Auditoría</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, textAlign: 'left' }}>
                                        <span style={{ fontSize: 10, color: 'var(--text-dim)', flex: 1 }}>Retenciones Bancos/Tarj.</span>
                                        <span style={{ fontSize: 10, fontWeight: 700, color: '#10b981', flexShrink: 0, wordBreak: 'break-word', textAlign: 'right' }}>− {Utils.fmt(getAdj(Math.abs(egresos.retenciones)))}</span>
                                    </div>
                                    {ivaSaldoFavorAnterior > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, textAlign: 'left' }}>
                                            <span style={{ fontSize: 10, color: 'var(--text-dim)', flex: 1 }}>Saldo a favor arrastrado</span>
                                            <span style={{ fontSize: 10, fontWeight: 700, color: '#10b981', flexShrink: 0, wordBreak: 'break-word', textAlign: 'right' }}>− {Utils.fmt(getAdj(ivaSaldoFavorAnterior))}</span>
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, borderTop: '1px solid var(--border-subtle)', paddingTop: 6, marginTop: 2, textAlign: 'left' }}>
                                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', flex: 1 }}>Bruto del mes (sin arrastre)</span>
                                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0, wordBreak: 'break-word', textAlign: 'right' }}>{Utils.fmt(getAdj(ivaPosicionTeorica))}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 12, marginBottom: 6 }}>Estimación orientativa considerando pagos a cuenta del mes.</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                            <p style={{ fontSize: 10, color: 'var(--text-faint)', lineHeight: 1.5, fontStyle: 'italic', margin: 0 }}>* Arrastra saldo a favor de los meses ya cargados en el sistema. No contempla períodos anteriores a tu primera carga, percepciones, ni alícuotas diferenciadas (10.5%, 27%). Consultá con tu contador para la liquidación definitiva.</p>
                            <button
                                onClick={() => setInfoModalKey('iva_limitaciones')}
                                style={{
                                    fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em',
                                    color: '#3b82f6', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)',
                                    borderRadius: 8, padding: '4px 10px', cursor: 'pointer', flexShrink: 0
                                }}
                            >
                                Limitaciones
                            </button>
                        </div>

                        {/* Dos columnas: IVA cobrado | IVA pagado */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                            {/* IVA Cobrado */}
                            <div style={{ background: 'rgba(16,185,129,0.05)', borderRadius: 12, border: '1px solid rgba(16,185,129,0.14)', overflow: 'hidden' }}>
                                <div style={{ padding: '14px 18px' }}>
                                    <p className="section-label !mb-1">IVA Cobrado — Facturas Electrónicas</p>
                                    <p className="text-xl font-black font-mono" style={{ color: '#10b981', margin: 0 }}>{viewMode === 'DOLAR_MEP' ? 'u$s ' : ''}{Utils.fmt(getAdj(kpis.iva_debito))}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">Débito fiscal — IVA que cobrás a tus clientes</p>
                                    {(ivaCobradoBreakdown.ivaB > 0 || ivaCobradoBreakdown.ivaA > 0 || ivaCobradoBreakdown.totalB > 0) && (
                                        <button
                                            onClick={() => setIvaCobradoExpanded(v => !v)}
                                            style={{ marginTop: 8, fontSize: 10, fontWeight: 700, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                        >
                                            {ivaCobradoExpanded ? '▲ Ocultar detalle' : '▼ Ver detalle por factura'}
                                        </button>
                                    )}
                                </div>
                                {ivaCobradoExpanded && (
                                    <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '10px 18px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                            <span style={{ fontSize: 10, color: 'var(--text-dim)', flex: 1 }}>Total Factura B Electrónica</span>
                                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums', flexShrink: 0, wordBreak: 'break-word', textAlign: 'right' }}>{viewMode === 'DOLAR_MEP' ? 'u$s ' : ''}{Utils.fmt(getAdj(ivaCobradoBreakdown.totalBElec))}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingLeft: 12, marginBottom: 2, gap: 12 }}>
                                            <span style={{ fontSize: 9, color: 'var(--text-faint)', flex: 1 }}>{`↳ IVA contenido (${(alicuotaIva * 100).toFixed(1).replace(/\.0$/, '')}%)`}</span>
                                            <span style={{ fontSize: 9, fontWeight: 600, color: '#10b981', fontVariantNumeric: 'tabular-nums', flexShrink: 0, wordBreak: 'break-word', textAlign: 'right' }}>{viewMode === 'DOLAR_MEP' ? 'u$s ' : ''}{Utils.fmt(getAdj(ivaCobradoBreakdown.ivaB))}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                            <span style={{ fontSize: 10, color: 'var(--text-dim)', flex: 1 }}>IVA Factura A</span>
                                            <span style={{ fontSize: 10, fontWeight: 700, color: '#10b981', fontVariantNumeric: 'tabular-nums', flexShrink: 0, wordBreak: 'break-word', textAlign: 'right' }}>{viewMode === 'DOLAR_MEP' ? 'u$s ' : ''}{Utils.fmt(getAdj(ivaCobradoBreakdown.ivaA))}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderTop: '1px dashed var(--border-subtle)', paddingTop: 4, marginTop: 2, gap: 12 }}>
                                            <span style={{ fontSize: 10, color: 'var(--text-dim)', flex: 1 }}>Monto Factura B (No genera IVA)</span>
                                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums', flexShrink: 0, wordBreak: 'break-word', textAlign: 'right' }}>{viewMode === 'DOLAR_MEP' ? 'u$s ' : ''}{Utils.fmt(getAdj(ivaCobradoBreakdown.totalB))}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* IVA Pagado con dropdown de proveedores */}
                            <div style={{ background: 'rgba(244,63,94,0.04)', borderRadius: 12, border: '1px solid rgba(244,63,94,0.14)', overflow: 'hidden' }}>
                                <div style={{ padding: '14px 18px' }}>
                                    <p className="section-label !mb-1">IVA Pagado — Informe ARCA</p>
                                    <p className="text-xl font-black font-mono" style={{ color: '#f43f5e', margin: 0 }}>{viewMode === 'DOLAR_MEP' ? 'u$s ' : ''}{Utils.fmt(getAdj(kpis.iva_credito || 0))}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">Crédito fiscal (ARCA) — no incluye sueldos</p>
                                    {ivaGrouped.length > 0 && (
                                        <button
                                            onClick={() => setIvaProveedoresExpanded(v => !v)}
                                            style={{ marginTop: 8, fontSize: 10, fontWeight: 700, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                        >
                                            {ivaProveedoresExpanded ? '▲ Ocultar proveedores' : `▼ Ver proveedores (${ivaGrouped.length})`}
                                        </button>
                                    )}
                                </div>
                                {ivaProveedoresExpanded && ivaGrouped.length > 0 && (
                                    <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '10px 18px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {ivaProveedoresVisible.map(([entidad, total], i) => (
                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                                <span style={{ fontSize: 10, color: 'var(--text-dim)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entidad}</span>
                                                <span style={{ fontSize: 10, fontWeight: 700, color: '#f43f5e', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{Utils.fmt(total)}</span>
                                            </div>
                                        ))}
                                        {ivaGrouped.length > 10 && (
                                            <button
                                                onClick={() => setIvaShowAll(v => !v)}
                                                style={{ marginTop: 4, fontSize: 10, fontWeight: 700, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                                            >
                                                {ivaShowAll ? '▲ Mostrar menos' : `▼ Ver todos (${ivaGrouped.length})`}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>
                </div>

                {/* ── RESULTADO DEL MES ───────────────────────────── */}
                <div style={{ marginBottom: 16 }}>
                    <Card style={{
                        background: resultadoAjustadoPositivo
                        ? (isLight ? 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)' : 'linear-gradient(135deg, rgba(5,46,22,0.8) 0%, rgba(7,12,24,0.95) 100%)')
                        : (isLight ? 'linear-gradient(135deg, #fff1f2 0%, #fff5f5 100%)' : 'linear-gradient(135deg, rgba(45,10,10,0.8) 0%, rgba(7,12,24,0.95) 100%)'),
                        border: `1px solid ${resultadoAjustadoPositivo
                        ? (isLight ? 'rgba(16,185,129,0.35)' : 'rgba(74,222,128,0.2)')
                        : (isLight ? 'rgba(244,63,94,0.35)' : 'rgba(248,113,113,0.2)')}`,
                        padding: 0,
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
                                    }}>Resultado del Mes</p>
                                    <button onClick={() => setInfoModalKey('resultado')} className="w-5 h-5 rounded-full border border-current opacity-50 hover:opacity-100 flex items-center justify-center text-[10px] font-bold transition-all" style={{ color: resultadoAjustadoPositivo ? (isLight ? '#059669' : '#4ade80') : (isLight ? '#dc2626' : '#f87171') }}>?</button>
                                </div>
                                <p style={{
                                    fontSize: 32, fontWeight: 800, margin: '4px 0 0',
                                    color: resultadoAjustadoPositivo
                                        ? (isLight ? '#059669' : '#4ade80')
                                        : (isLight ? '#dc2626' : '#f87171'),
                                    fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px',
                                }}>{viewMode === 'DOLAR_MEP' ? 'u$s ' : ''}{Utils.fmt(resultadoAjustado)}</p>
                                <button
                                    onClick={() => setResultadoBaseExpanded(v => !v)}
                                    style={{ marginTop: 8, fontSize: 10, fontWeight: 700, color: isLight ? '#059669' : '#4ade80', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                >
                                    {resultadoBaseExpanded ? '▲ Ocultar ingresos base' : '▼ Ver ingresos base'}
                                </button>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <p style={{
                                    fontSize: 24, fontWeight: 700, margin: 0,
                                    color: +margenAjustadoPct > 15 ? '#10b981' : +margenAjustadoPct > 5 ? '#f59e0b' : '#f43f5e',
                                }}>
                                    {margenAjustadoPct}%
                                </p>
                                <p style={{ fontSize: 11, color: isLight ? '#6B7A90' : '#8B949E', marginTop: 2 }}>margen operativo</p>
                            </div>
                        </div>

                        {resultadoBaseExpanded && (
                            <div style={{ padding: '0 28px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {[
                                    { l: 'Factura A Electrónica', v: getAdj(ivaCobradoBreakdown.totalAElec) },
                                    { l: 'IVA Factura A (−)', v: getAdj(ivaCobradoBreakdown.ivaA), neg: true },
                                    { l: 'Factura B Electrónica', v: getAdj(ivaCobradoBreakdown.totalBElec) },
                                    { l: 'IVA Factura B (−)', v: getAdj(ivaCobradoBreakdown.ivaB), neg: true },
                                    { l: 'Factura B Manual', v: getAdj(ivaCobradoBreakdown.totalB) },
                                ].filter(r => r.v > 0).map((row, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                        <span style={{ fontSize: 11, color: isLight ? '#475569' : '#94a3b8', flex: 1 }}>{row.l}</span>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: row.neg ? (isLight ? '#dc2626' : '#f43f5e') : (isLight ? '#059669' : '#10b981'), fontVariantNumeric: 'tabular-nums', flexShrink: 0, wordBreak: 'break-word', textAlign: 'right' }}>
                                            {row.neg ? '− ' : ''}{viewMode === 'DOLAR_MEP' ? 'u$s ' : ''}{Utils.fmt(row.v)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Expense Toggles */}
                        <div style={{
                            borderTop: `1px solid ${isLight ? 'rgba(28,37,55,0.07)' : 'rgba(255,255,255,0.05)'}`,
                            padding: '20px 28px',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                            gap: 16,
                        }}>
                            {expensesToSubtract.map(exp => (
                                <div
                                    key={exp.key}
                                    onClick={() => toggleExpense(exp.key)}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 10,
                                        cursor: 'pointer',
                                        padding: '14px 16px',
                                        borderRadius: 14,
                                        background: activeExpenses[exp.key]
                                            ? (isLight ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.15)')
                                            : (isLight ? 'rgba(28,37,55,0.02)' : 'rgba(255,255,255,0.02)'),
                                        border: `1px solid ${activeExpenses[exp.key]
                                            ? (isLight ? 'rgba(59,130,246,0.3)' : 'rgba(59,130,246,0.4)')
                                            : (isLight ? 'rgba(28,37,55,0.06)' : 'rgba(255,255,255,0.04)')}`,
                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                        boxShadow: activeExpenses[exp.key] ? '0 4px 12px rgba(59, 130, 246, 0.08)' : 'none',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                        <div style={{ 
                                            width: 18, height: 18, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
                                            background: activeExpenses[exp.key] ? '#3b82f6' : (isLight ? 'rgba(28,37,55,0.1)' : 'rgba(255,255,255,0.1)'),
                                            color: '#fff', transition: 'all 0.2s'
                                        }}>
                                            {activeExpenses[exp.key] && <span style={{ fontSize: 10, fontWeight: 'bold' }}>✓</span>}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, flex: 1, minWidth: 0, paddingTop: 1 }}>
                                            <span style={{ fontSize: 12, lineHeight: 1.2, fontWeight: 600, color: activeExpenses[exp.key] ? (isLight ? '#2563eb' : '#60a5fa') : (isLight ? '#475569' : '#94A3B8'), flex: 1, wordBreak: 'break-word' }}>
                                                {exp.label}
                                            </span>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setInfoModalKey(exp.key); }}
                                                style={{
                                                    width: 16, height: 16, borderRadius: '50%', border: '1px solid var(--border-subtle)',
                                                    background: 'none', color: 'var(--text-faint)', fontSize: 9, cursor: 'pointer',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                                }}
                                            >?</button>
                                        </div>
                                    </div>
                                    <div style={{ paddingLeft: 26, display: 'flex', justifyContent: 'flex-end' }}>
                                        <span style={{ fontSize: 16, fontWeight: 800, color: activeExpenses[exp.key] ? (isLight ? '#1d4ed8' : '#93c5fd') : (isLight ? '#1C2537' : '#E2E8F0'), fontVariantNumeric: 'tabular-nums', wordBreak: 'break-word', textAlign: 'right' }}>
                                            {viewMode === 'DOLAR_MEP' ? 'u$s ' : ''}{Utils.fmt(exp.value)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                {/* ── GRÁFICO WATERFALL ───────────────────────────── */}
                <Card style={{ padding: '24px 28px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 24, height: 24, borderRadius: 6, background: isLight ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', fontSize: 12, fontWeight: 'bold' }}>📊</div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.2px' }}>Flujo de Utilidad del Mes (Waterfall)</p>
                                    <button onClick={() => setInfoModalKey('waterfall')} className="w-5 h-5 rounded-full border border-slate-700/50 text-slate-500 hover:text-blue-400 hover:border-blue-500/50 hover:bg-slate-800/50 flex items-center justify-center text-[10px] font-bold transition-all">?</button>
                                </div>
                                <p style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>Desglose de cómo los ingresos cubren los costos hasta llegar al resultado final. El gráfico se actualiza al apagar/encender gastos.</p>
                            </div>
                        </div>
                    </div>
                    <WaterfallChart 
                        base={baseDineroFacturado} 
                        expenses={expensesToSubtract.filter(e => activeExpenses[e.key])} 
                        prefix={viewMode === 'DOLAR_MEP' ? 'u$s ' : '$'} 
                    />
                </Card>

            </div> {/* Closes pnl-export-area */}
        </div>
    );
};

export default DashboardView;
