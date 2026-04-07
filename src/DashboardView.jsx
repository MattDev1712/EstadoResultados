import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useFinance } from './FinanceContext';
import { formatters as Utils } from './formatters';
import { Chart, registerables } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { CardSkeleton, ChartSkeleton } from './Skeleton';
import FileCard from './FileCard';

Chart.register(...registerables, ChartDataLabels);

const STRUCTURAL_KEYWORDS = ['alquiler', 'luz', 'gas', 'expensas', 'servicios', 'internet', 'abl', 'tasa'];
const HONORARIOS_KEYWORDS = ['honorarios', 'profesional', 'contador', 'abogado', 'asesor', 'estudio'];
const MIX_COLORS = ['#3b82f6', '#10b981', '#64748b', '#f59e0b'];

const fmtM = v => {
    const n = Math.abs(parseFloat(v) || 0);
    return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(0) + 'K' : n.toFixed(0);
};

const Card = ({ children, style = {} }) => (
    <div style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', background: '#0b1121', ...style }}>
        {children}
    </div>
);

const EvolutionChart = ({ historial, mode = 'NOMINAL' }) => {
    const canvasRef = useRef(null);
    const chartRef = useRef(null);

    const chartData = useMemo(() => {
        if (!historial) return null;
        const sorted = Object.entries(historial).sort((a, b) => a[0].localeCompare(b[0]));
        return {
            labels: sorted.map(([k]) => {
                const parts = k.split('-');
                const y = parts[0] || '0000';
                const m = parts[1] || '01';
                return new Date(+y, +m - 1, 1).toLocaleDateString('es-AR', { month: 'short' }).replace('.', '').toUpperCase();
            }),
            ingresos: sorted.map(([, v]) => {
                if (mode === 'REAL_IPC') return Utils.num(v.vr);
                if (mode === 'DOLAR_MEP') return Utils.num(v.v) / Utils.num(v.mep);
                return Utils.num(v.v);
            }),
            egresos: sorted.map(([, v]) => {
                if (mode === 'REAL_IPC') return Utils.num(v.gr);
                if (mode === 'DOLAR_MEP') return Utils.num(v.g) / Utils.num(v.mep);
                return Utils.num(v.g);
            }),
        };
    }, [historial, mode]);

    const resultData = useMemo(() => {
        if (!chartData) return [];
        return chartData.ingresos.map((ing, i) => ing - chartData.egresos[i]);
    }, [chartData]);

    useEffect(() => {
        if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
        if (!canvasRef.current || !chartData) return;
        const prefix = mode === 'DOLAR_MEP' ? 'u$s ' : '$';
        chartRef.current = new Chart(canvasRef.current.getContext('2d'), {
            data: {
                labels: chartData.labels,
                datasets: [
                    { type: 'bar', label: 'Ingresos', data: chartData.ingresos, backgroundColor: 'rgba(16,185,129,0.18)', borderColor: 'rgba(16,185,129,0.6)', borderWidth: 1.5, borderRadius: 7, borderSkipped: false, order: 2 },
                    { type: 'bar', label: 'Egresos', data: chartData.egresos, backgroundColor: 'rgba(244,63,94,0.15)', borderColor: 'rgba(244,63,94,0.55)', borderWidth: 1.5, borderRadius: 7, borderSkipped: false, order: 3 },
                    { type: 'line', label: 'Resultado', data: resultData, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.07)', borderWidth: 2.5, pointRadius: 5, pointBackgroundColor: '#3b82f6', pointBorderColor: '#070c18', pointBorderWidth: 2.5, fill: true, tension: 0.35, order: 1 },
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                animation: { duration: 500, easing: 'easeOutQuart' },
                plugins: {
                    legend: { display: false },
                    datalabels: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(7,12,24,0.97)', titleColor: '#f1f5f9', bodyColor: '#94a3b8',
                        borderColor: 'rgba(255,255,255,0.07)', borderWidth: 1, padding: 14, cornerRadius: 10,
                        callbacks: { label: ctx => `  ${ctx.dataset.label}:  ${prefix}${fmtM(ctx.raw)}` }
                    }
                },
                scales: {
                    x: { grid: { display: false }, border: { display: false }, ticks: { color: '#475569', font: { size: 10, weight: '600' } } },
                    y: { grid: { color: 'rgba(255,255,255,0.035)' }, border: { display: false }, ticks: { color: '#475569', font: { size: 10 }, callback: v => prefix + fmtM(v) } }
                }
            }
        });
        return () => { if (chartRef.current) chartRef.current.destroy(); };
    }, [chartData, resultData, mode]);

    if (!chartData) return <div style={{ height: 210, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: '#334155', fontSize: 11 }}>Sin datos históricos</p></div>;
    return <div style={{ height: 210 }}><canvas ref={canvasRef}></canvas></div>;
};

// --- MODAL DE INFORMACIÓN ---
const InfoModal = ({ isOpen, onClose, title, explanation, breakdown }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 backdrop-blur-md animate-fade-in p-4" onClick={onClose}>
            <div className="bg-[#0b1121]/90 backdrop-blur-xl border border-slate-700/50 w-full max-w-lg rounded-[2.5rem] shadow-[0_0_50px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col max-h-[90vh] animate-pop-in pointer-events-auto" onClick={e => e.stopPropagation()}>
                <div className="p-7 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-black ring-1 ring-blue-500/30">?</span>
                        {title}
                    </h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-all w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/5 active:scale-90">✕</button>
                </div>
                <div className="p-8 overflow-y-auto scrollbar-hide">
                    <div className="mb-8">
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-3">Explicación Simple</p>
                        <p className="text-base text-slate-300 leading-relaxed font-medium">{explanation}</p>
                    </div>
                    {breakdown && breakdown.length > 0 && (
                        <div>
                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-4">Desglose de Datos</p>
                            <div className="bg-slate-900/60 rounded-3xl border border-white/5 overflow-hidden shadow-inner">
                                {breakdown.map((row, i) => (
                                    <div key={i} className={`flex justify-between items-center px-6 py-4 ${i < breakdown.length - 1 ? 'border-b border-white/5' : ''} ${row.total ? 'bg-white/5 font-bold' : ''}`}>
                                        <span className={`text-xs uppercase tracking-wider ${row.total ? 'text-white font-black' : 'text-slate-400'}`}>{row.label}</span>
                                        <span className={`text-base font-mono tracking-tighter ${row.color || 'text-slate-200'} ${row.total ? 'text-white' : ''}`}>{Utils.fmt(row.val)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const CardTitle = ({ title, onInfo }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: '#475569', textTransform: 'uppercase', margin: 0 }}>{title}</p>
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

    // Reset dismissed when period changes
    useEffect(() => {
        try {
            setDismissed(JSON.parse(localStorage.getItem(`alerts_dismissed_${periodo}`) || '[]'));
        } catch (e) { setDismissed([]); }
    }, [periodo]);

    const alerts = useMemo(() => {
        const list = [];
        const ventasNetas = Utils.num(kpis.ventas_netas_reales);

        // 🟡 Faltas de Carga (Prioridad 1)
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

        // --- ALERTAS ANALÍTICAS (Solo si hay ventas cargadas) ---
        if (ventasNetas > 0) {
            // 🔴 Crítica: utilidad_neta < 0
            if (Utils.num(kpis.utilidad_neta) < 0) {
                list.push({ id: 'loss', type: 'critical', msg: 'Este mes los gastos superaron a las ventas. El negocio está en pérdida operativa.' });
            }

            // 🔴 Crítica: margen_contribuccion / ventas_netas_reales < 0.50
            if (Utils.num(kpis.margen_contribuccion) / ventasNetas < 0.50) {
                list.push({ id: 'low_margin', type: 'critical', msg: 'Menos del 50% de tus ventas quedan disponibles después de las comisiones. Revisá los medios de pago.' });
            }

            // 🟡 Advertencia: ventas_netas_reales < break_even_mensual
            if (ventasNetas < Utils.num(kpis.break_even_mensual)) {
                list.push({ id: 'breakeven', type: 'warning', msg: 'Las ventas de este mes no alcanzan para cubrir todos los gastos fijos.' });
            }

            // 🟡 Advertencia: egresos.laboral / ventas_netas_reales > 0.35
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
            <div className="mb-6 flex justify-end">
                <button
                    onClick={() => setShowModal(true)}
                    className="flex justify-center items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg"
                >
                    <span className="text-sm border border-amber-500/50 rounded-full w-5 h-5 flex justify-center items-center bg-amber-500 text-slate-900 leading-none pb-[1px]">{alerts.length}</span>
                    <span>{alerts.length === 1 ? '1 aviso importante' : `${alerts.length} avisos importantes`} — tocá para ver</span>
                </button>
            </div>

            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 backdrop-blur-md animate-fade-in p-4" onClick={() => setShowModal(false)}>
                    <div className="bg-[#0b1121]/90 backdrop-blur-xl border border-slate-700/50 w-full max-w-lg rounded-[2.5rem] shadow-[0_0_50px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col max-h-[90vh] animate-pop-in pointer-events-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-7 border-b border-white/5 flex justify-between items-center bg-white/5">
                            <h3 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-3">
                                <span className="text-2xl animate-pulse">⚠️</span> Avisos del mes
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white transition-all w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/5 active:scale-90">✕</button>
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

const YoYComparison = ({ historial, currentPeriod, mode }) => {
    const yoyData = useMemo(() => {
        if (!historial || !currentPeriod) return null;
        
        const [year, month] = currentPeriod.split('-');
        const lastYearPeriod = `${parseInt(year) - 1}-${month}`;
        
        const current = historial[currentPeriod];
        const lastYear = historial[lastYearPeriod];
        
        if (!current || !lastYear) return null;
        
        const getVentas = (v) => {
            if (mode === 'REAL_IPC') return Utils.num(v.vr);
            if (mode === 'DOLAR_MEP') return Utils.num(v.v) / Utils.num(v.mep);
            return Utils.num(v.v);
        };

        const getGastos = (v) => {
            if (!v) return 0;
            if (mode === 'REAL_IPC') return Utils.num(v.gr);
            if (mode === 'DOLAR_MEP') return Utils.num(v.g) / Utils.num(v.mep);
            return Utils.num(v.g);
        };

        const v1 = getVentas(current);
        const v0 = getVentas(lastYear);
        const r1 = v1 - getGastos(current);
        const r0 = v0 - getGastos(lastYear);
        const cmv1 = v1 > 0 ? (getGastos(current) / v1) * 100 : 0;
        const cmv0 = v0 > 0 ? (getGastos(lastYear) / v0) * 100 : 0;

        return {
            ventas: { val: v1, prev: v0, pct: v0 > 0 ? ((v1 / v0) - 1) * 100 : 0 },
            resultado: { val: r1, prev: r0, pct: Math.abs(r0) > 0 ? ((r1 - r0) / Math.abs(r0)) * 100 : 0 },
            cmv: { val: cmv1, prev: cmv0, diff: cmv1 - cmv0 }
        };
    }, [historial, currentPeriod, mode]);

    if (!yoyData) return (
        <div style={{ marginTop: 24, padding: 16, background: 'rgba(30,41,59,0.2)', borderRadius: 12, border: '1px dashed rgba(71,85,105,0.4)', textAlign: 'center' }}>
            <p style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.1em', margin: '0 0 4px' }}>Comparativa vs. año anterior</p>
            <p style={{ fontSize: 11, color: '#334155', margin: 0 }}>Necesitás al menos 12 meses de datos para ver la comparativa</p>
        </div>
    );

    const Badge = ({ val, isInverse = false }) => {
        const isPositive = val > 0;
        const color = isInverse ? (isPositive ? '#f43f5e' : '#10b981') : (isPositive ? '#10b981' : '#f43f5e');
        const sign = isPositive ? '+' : '';
        return (
            <span style={{ fontSize: 10, fontWeight: 900, color, marginLeft: 8 }}>
                {sign}{val.toFixed(1)}%
            </span>
        );
    };

    return (
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <p style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.1em', marginBottom: 16 }}>Cómo me fue vs. el mismo mes del año pasado</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                    { label: 'Ventas', val: yoyData.ventas.val, pct: yoyData.ventas.pct },
                    { label: 'Resultado', val: yoyData.resultado.val, pct: yoyData.resultado.pct },
                    { label: 'CMV%', val: yoyData.cmv.val, pct: yoyData.cmv.diff, isCmv: true }
                ].map((item, i) => (
                    <div key={i} style={{ background: 'rgba(15,23,42,0.4)', padding: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                        <p style={{ fontSize: 9, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{item.label}</p>
                        <div style={{ display: 'flex', alignItems: 'baseline' }}>
                            <span style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0' }}>
                                {item.isCmv ? `${item.val.toFixed(1)}%` : (mode === 'DOLAR_MEP' ? 'u$s ' : '') + Utils.fmt(item.val)}
                            </span>
                            <Badge val={item.pct} isInverse={item.isCmv} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const DashboardView = ({ onDataReady, setShowStructModal, defaultDate, setDefaultDate }) => {
    const { 
        dashData: data, empData, arcaData, ventasData, 
        loading, error, viewMode, setViewMode, 
        localAjustes, setLocalAjustes, updateConfig, 
        selectedYear, selectedMonth 
    } = useFinance();
    const [infoModalKey, setInfoModalKey] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const { kpis, egresos, historial, mixPagos } = useMemo(() => ({
        kpis: data?.kpis || {},
        egresos: data?.egresos || {},
        historial: data?.historial || {},
        mixPagos: data?.mix_pagos || {}
    }), [data]);

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
                scale: 2,
                backgroundColor: '#070c18',
                logging: false,
                useCORS: true
            });
            
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const imgProps = pdf.getImageProperties(imgData);
            const pdfImgHeight = (imgProps.height * (pdfWidth - 20)) / imgProps.width;

            // Simple styling for PDF header
            pdf.setFillColor(15, 23, 42); // slate-900
            pdf.rect(0, 0, pdfWidth, 40, 'F');
            
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(22);
            pdf.text("Estado Result", 15, 20);
            
            pdf.setFontSize(10);
            pdf.setTextColor(148, 163, 184); // slate-400
            pdf.text(`Reporte de P&L · ${selectedMonth}/${selectedYear}`, 15, 28);
            pdf.text(`Modo: ${viewMode}`, pdfWidth - 40, 28);

            pdf.addImage(imgData, 'PNG', 10, 45, pdfWidth - 20, pdfImgHeight);
            
            // Footer
            const pageHeight = pdf.internal.pageSize.getHeight();
            pdf.setFontSize(8);
            pdf.setTextColor(100, 116, 139); // slate-500
            pdf.text("Generado con Estado Result — Solo para uso de gestión interna. No reemplaza estados contables oficiales.", 15, pageHeight - 10);
            
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

    const egresoTotal = Object.entries(egresos)
        .filter(([k]) => k !== 'retenciones' && k !== 'amortizaciones') // retenciones y amortizaciones no van en % composición visual
        .reduce((a, [, b]) => a + getAdj(b), 0);

    const egresoComposicion = [
        { label: 'Nómina', val: getAdj(egresos.laboral), color: '#8b5cf6', key: 'laboral' },
        { label: 'Prov. SAC', val: getAdj(egresos.provision_sac || 0), color: '#7c3aed', key: 'sac' },
        { label: 'Cargas Soc. Est.', val: getAdj(egresos.provision_cargas || 0), color: '#a78bfa', key: 'cargas' },
        { label: 'Estructurales', val: getAdj(egresos.estructural), color: '#06b6d4', key: 'estructural' },
        { label: 'Comisiones', val: getAdj(egresos.comisiones), color: '#f43f5e', key: 'comisiones' },
        { label: 'Otros', val: getAdj(egresos.otros), color: '#64748b', key: 'otros' },
    ];

    if (loading) return (
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

    const renderActionHub = () => (
        <div className="mb-8 mt-4 p-6 rounded-[2rem] bg-slate-900/40 border border-slate-800 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-emerald-500/5 pointer-events-none"></div>
            <div className="flex justify-between items-center mb-2 relative z-10">
                <div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-1">Cargar información del mes</h3>
                    <p className="text-sm text-slate-400">Subí los archivos del mes {selectedMonth}/{selectedYear} para ver el resultado actualizado</p>
                </div>
            </div>

            <p className="text-xs text-slate-600 mb-4 relative z-10">Arrastrá o hacé clic en cada bloque para seleccionar el archivo</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 relative z-10">
                <FileCard title="Sistema de Ventas (Maxirest PDF)" type="PDF" onDataReady={(d) => onDataReady && onDataReady(d, 'MAXIREST')} />
                <FileCard title="Facturas de AFIP/ARCA (CSV)" type="CSV" onDataReady={(d) => onDataReady && onDataReady(d, 'ARCA')} />
                <FileCard title="Planilla de Sueldos (CSV)" type="CSV" parserMode="sueldos" defaultDate={defaultDate} onDataReady={(d) => onDataReady && onDataReady(d, 'SUELDOS')} />
            </div>

            <p className="text-[10px] text-slate-600 uppercase tracking-widest font-bold mb-3 relative z-10">Carga manual de gastos</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
                {[
                    { title: 'Gastos fijos del local', desc: 'Alquiler, luz, gas, expensas', color: 'border-blue-500/30', hover: 'hover:border-blue-500', action: () => setShowStructModal && setShowStructModal(true), icon: '🏢' },
                ].map((card, i) => (
                    <div key={i} onClick={card.action} className={`p-4 rounded-xl border ${card.color} bg-slate-900/60 backdrop-blur-sm ${card.hover} cursor-pointer transition-all duration-300 group hover:-translate-y-1`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xl opacity-80">{card.icon}</span>
                            <span className="text-[8px] font-black px-1.5 py-0.5 bg-slate-800 rounded text-slate-400">+ AGREGAR</span>
                        </div>
                        <h3 className="font-bold text-slate-200 group-hover:text-white transition-colors text-sm">{card.title}</h3>
                        <p className="text-[10px] text-slate-500 mt-1">{card.desc}</p>
                    </div>
                ))}
            </div>
        </div>
    );

    if (!data || (Utils.num(kpis.utilidad_neta) === 0 && egresoTotal === 0)) return (
        <div className="animate-fade-in" style={{ paddingBottom: 40 }}>
            {renderActionHub()}
            <div style={{ marginTop: 32, padding: 64, background: 'rgba(15,23,42,0.2)', border: '1px dashed rgba(71,85,105,0.5)', borderRadius: 32, textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📂</div>
                <p style={{ color: '#94a3b8', fontSize: 15, fontWeight: 700, marginBottom: 8 }}>No hay datos para este mes todavía</p>
                <p style={{ color: '#475569', fontSize: 12 }}>Subí los archivos usando la sección de arriba para ver tu posición IVA y el resto de los indicadores.</p>
            </div>
        </div>
    );

    const mixPagosEntries = Object.entries(mixPagos);

    const infoData = {
        'resultado': {
            title: 'Resultado del Período',
            explanation: 'Es la diferencia entre lo que ingresó (ventas netas) y lo que salió (todos los gastos). Si es positivo, el negocio tuvo excedente ese mes; si es negativo, los gastos superaron los ingresos.',
            breakdown: [
                { label: 'Ventas Netas (sin IVA)', val: ventasNetas, color: 'text-emerald-400' },
                { label: 'Total Gastos', val: -egresoTotal, color: 'text-rose-400' },
                { label: 'Resultado Final', val: utilidad, total: true, color: utilidad >= 0 ? 'text-emerald-400' : 'text-rose-400' }
            ]
        },
        'margen': {
            title: '¿Cuánto me queda de cada venta?',
            explanation: 'De cada $100 que vendés, este porcentaje queda disponible después de descontar las comisiones bancarias y de apps. Cuanto más alto, mejor.',
            breakdown: [
                { label: 'Ventas Netas', val: ventasNetas },
                { label: 'Comisiones Bancos/Apps', val: -Utils.num(egresos.comisiones), color: 'text-rose-400' },
                { label: 'Disponible', val: Utils.num(kpis.margen_contribuccion), total: true, color: 'text-emerald-400' }
            ]
        },
        'breakeven': {
            title: '¿Cuánto necesito vender para no perder?',
            explanation: 'Es el monto exacto de ventas que necesitás en el mes para que los ingresos igualen a los gastos. Si vendés más que esto, empezás a tener excedente.',
            breakdown: [
                { label: 'Costo de empleados', val: Utils.num(egresos.laboral) + Utils.num(egresos.provision_sac || 0) + Utils.num(egresos.provision_cargas || 0) },
                { label: 'Gastos fijos (alquiler, luz, etc.)', val: Utils.num(egresos.estructural) },
                { label: 'Ventas necesarias para equilibrar', val: Utils.num(kpis.break_even_mensual), total: true, color: 'text-blue-400' }
            ]
        },
        'iva': {
            title: 'Tu IVA del mes',
            explanation: 'Cada vez que vendés, cobrás IVA (21%) que le pertenece al Estado. Cada vez que comprás con factura, pagás IVA que podés descontar. La diferencia es lo que le debés (o te debe) AFIP.\n\nSi el número es positivo → tenés que pagar ese monto a AFIP.\nSi es negativo → tenés saldo a favor (AFIP te "debe" a vos).',
            breakdown: [
                { label: 'Posición neta del mes', val: Utils.num(kpis.iva_posicion), total: true }
            ]
        },
        'evolucion': {
            title: 'Cómo evolucionó el negocio',
            explanation: 'Muestra mes a mes cómo fueron tus ventas y gastos. En modo "Ajustado por inflación", los meses pasados se actualizan a pesos de hoy para que la comparación sea justa.'
        },
        'mix': {
            title: 'Cómo te pagaron tus clientes',
            explanation: 'Muestra qué porcentaje de tus ventas fueron en efectivo, tarjeta o apps. Importante: las tarjetas y apps cobran una comisión, así que no todo ese dinero llega a tu bolsillo.'
        },
        'composicion': {
            title: 'En qué se va el dinero',
            explanation: 'Desglose de todos tus gastos del mes. Te ayuda a ver rápidamente cuál es el rubro que más pesa en tu estructura de costos.'
        }
    };

    return (
        <div className="animate-fade-in" style={{ paddingBottom: 40 }}>

            {/* Modal Compartido */}
            <InfoModal
                isOpen={!!infoModalKey}
                onClose={() => setInfoModalKey(null)}
                {...(infoData[infoModalKey] || {})}
            />

            {/* Selector de Vista y Ajustes Dinámicos */}
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', padding: 4, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
                    {['NOMINAL', 'REAL_IPC', 'DOLAR_MEP'].map(m => (
                        <button
                            key={m}
                            onClick={() => setViewMode(m)}
                            style={{
                                padding: '8px 16px', borderRadius: 8, fontSize: 10, fontWeight: 900, border: 'none', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                background: viewMode === m ? '#3b82f6' : 'transparent',
                                color: viewMode === m ? 'white' : '#64748b',
                                boxShadow: viewMode === m ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none',
                                cursor: 'pointer',
                                letterSpacing: '0.05em'
                            }}
                        >
                            {m === 'NOMINAL' ? 'Pesos actuales' : m === 'REAL_IPC' ? 'Ajustado por inflación' : 'En dólares'}
                        </button>
                    ))}
                </div>

                {/* Panel de Ajustes del Periodo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(15, 23, 42, 0.3)', padding: '6px 12px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <div style={{ fontSize: 8, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                        Coef. inflación (INDEC)
                                    </div>
                                    <span title="Actualizá con el dato real publicado por INDEC (indec.gob.ar)" style={{ fontSize: 7, color: '#92400e', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.25)', padding: '1px 4px', borderRadius: 3, cursor: 'help', fontWeight: 800 }}>INDEC</span>
                                </div>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={localAjustes.ipc}
                                    onChange={(e) => setLocalAjustes(prev => ({ ...prev, ipc: e.target.value }))}
                                    style={{ width: 50, background: 'transparent', border: 'none', borderBottom: '1px solid #334155', color: '#f59e0b', fontSize: 12, fontWeight: 800, outline: 'none', padding: '0 2px' }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ fontSize: 8, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Dólar MEP</span>
                                    <span title="Cotización real del mercado (dolarito.ar o similar)" style={{ fontSize: 7, color: '#4c1d95', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)', padding: '1px 4px', borderRadius: 3, cursor: 'help', fontWeight: 800 }}>COTI</span>
                                </div>
                                <input
                                    type="number"
                                    value={localAjustes.mep}
                                    onChange={(e) => setLocalAjustes(prev => ({ ...prev, mep: e.target.value }))}
                                    style={{ width: 60, background: 'transparent', border: 'none', borderBottom: '1px solid #334155', color: '#8b5cf6', fontSize: 12, fontWeight: 800, outline: 'none', padding: '0 2px' }}
                                />
                            </div>
                        </div>

                        {/* Botón Guardar (Solo aparece si hay cambios vs backend) */}
                        {(parseFloat(data?.ajustes?.ipc) !== parseFloat(localAjustes.ipc) || parseFloat(data?.ajustes?.mep) !== parseFloat(localAjustes.mep)) && (
                            <button
                                onClick={handleSaveConfig}
                                disabled={isSaving}
                                style={{
                                    padding: '8px 14px', borderRadius: 10, fontSize: 10, fontWeight: 800,
                                    background: '#10b981', color: 'white', border: 'none', cursor: 'pointer',
                                    transition: 'all 0.2s', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.2)',
                                    opacity: isSaving ? 0.6 : 1
                                }}
                            >
                                {isSaving ? '...' : 'Guardar Coef.'}
                            </button>
                        )}
                    </div>

                    {/* Botón Exportar PDF */}
                    <button
                        onClick={handleExportPDF}
                        disabled={isExporting}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                            isExporting 
                            ? 'bg-slate-800 border-slate-700 text-slate-500' 
                            : 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20'
                        }`}
                    >
                        {isExporting ? (
                            <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <span>📄</span>
                        )}
                        {isExporting ? 'Exportando...' : 'Exportar P&L'}
                    </button>
                </div>
            </div>



            {/* Panel de Inteligencia Financiera */}
            <AlertsPanel 
                kpis={kpis} 
                egresos={egresos} 
                periodo={`${selectedYear}-${selectedMonth}`} 
                empData={empData}
                arcaData={arcaData}
                ventasData={ventasData}
            />

            <div id="pnl-export-area" className="p-4" style={{ margin: '-16px' }}>
                {/* IVA HERO — Primera card, ancho completo */}
                <div style={{ marginBottom: 16 }}>
                    <Card style={{ padding: 28, borderLeft: '4px solid #3b82f6', background: 'linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(15,23,42,0.6) 100%)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                            <div style={{ flex: 1 }}>
                                <CardTitle title="Tu IVA del mes" onInfo={() => setInfoModalKey('iva')} />
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 4 }}>
                                    <p className="text-4xl font-black tracking-tighter leading-none font-mono" style={{ color: getAdj(kpis.iva_posicion) > 0 ? '#f43f5e' : '#10b981', fontVariantNumeric: 'tabular-nums', margin: 0 }}>
                                        {viewMode === 'DOLAR_MEP' ? 'u$s ' : ''}{Utils.fmt(getAdj(kpis.iva_posicion))}
                                    </p>
                                </div>
                                <p style={{ fontSize: 14, fontWeight: 700, marginTop: 10, color: getAdj(kpis.iva_posicion) > 0 ? '#fda4af' : '#6ee7b7' }}>
                                    {getAdj(kpis.iva_posicion) > 0
                                        ? '⚠️ Tenés que pagar este monto a AFIP'
                                        : '✅ Tenés saldo a favor en AFIP'}
                                </p>
                                <p style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
                                    IVA cobrado a clientes − IVA pagado en compras con factura
                                </p>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 200 }}>
                                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '14px 18px', border: '1px solid rgba(59,130,246,0.12)' }}>
                                    <p className="section-label !mb-1.5">Tus ventas del mes</p>
                                    <p className="text-xl font-black font-mono" style={{ color: '#10b981', margin: 0 }}>{viewMode === 'DOLAR_MEP' ? 'u$s ' : ''}{Utils.fmt(ventasNetas)}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">Sin IVA, sin comisiones bancarias</p>
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '14px 18px', border: '1px solid rgba(255,255,255,0.04)' }}>
                                    <p className="section-label !mb-1.5">Tus gastos del mes</p>
                                    <p className="text-xl font-black font-mono" style={{ color: '#f43f5e', margin: 0 }}>{viewMode === 'DOLAR_MEP' ? 'u$s ' : ''}{Utils.fmt(egresoTotal)}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">Empleados, alquiler, impuestos, etc.</p>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* ROW 2: 3 CARDS DE CONTEXTO */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>

                {/* Margen */}
                <Card style={{ padding: 24, background: 'rgba(59,130,246,0.02)' }}>
                    <CardTitle title="¿Cuánto queda de cada venta?" onInfo={() => setInfoModalKey('margen')} />
                    <p className="text-3xl font-black tracking-tighter leading-none" style={{ color: '#3b82f6' }}>
                        {ventasNetas > 0 ? ((Utils.num(kpis.margen_contribuccion) / ventasNetas) * 100).toFixed(1) : 0}%
                    </p>
                    <p style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>Después de descontar comisiones de bancos y apps</p>
                    <div style={{ marginTop: 16 }}>
                        <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 99 }}>
                            <div style={{ height: '100%', width: `${ventasNetas > 0 ? (Utils.num(kpis.margen_contribuccion) / ventasNetas) * 100 : 0}%`, background: '#3b82f6', borderRadius: 99 }}></div>
                        </div>
                    </div>
                </Card>

                {/* Resultado del Periodo */}
                <Card style={{ padding: 24, background: 'rgba(16,185,129,0.03)', borderColor: 'rgba(16,185,129,0.1)' }}>
                    <CardTitle title="Resultado del mes" onInfo={() => setInfoModalKey('resultado')} />
                    <p className="text-2xl font-black font-mono tracking-tight leading-none" style={{ color: utilidad >= 0 ? '#10b981' : '#f43f5e', fontVariantNumeric: 'tabular-nums' }}>
                        {viewMode === 'DOLAR_MEP' ? 'u$s ' : ''}{Utils.fmt(utilidad)}
                    </p>
                    <p style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>Ventas menos todos los gastos del mes</p>
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 16, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: '#64748b' }}>Margen operativo</span>
                            <span style={{ fontSize: 12, fontWeight: 800, color: +margen > 15 ? '#10b981' : +margen > 5 ? '#f59e0b' : '#f43f5e' }}>{margen}%</span>
                        </div>
                    </div>
                </Card>

                {/* Punto de Equilibrio */}
                <Card style={{ padding: 24 }}>
                    <CardTitle title="¿Alcancé el mínimo para no perder?" onInfo={() => setInfoModalKey('breakeven')} />
                    <p className="text-xl font-black text-white leading-tight" style={{ color: ventasNetas >= getAdj(kpis.break_even_mensual) ? '#10b981' : '#f59e0b' }}>
                        {ventasNetas >= getAdj(kpis.break_even_mensual) ? '✅ Sí, superé el mínimo' : '⚠️ Aún no alcancé'}
                    </p>
                    <p style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>Necesitás vender al menos {viewMode === 'DOLAR_MEP' ? 'u$s ' : ''}{Utils.fmt(getAdj(kpis.break_even_mensual))}</p>
                    <div style={{ marginTop: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: 10, color: '#64748b' }}>Progreso: {getAdj(kpis.break_even_mensual) > 0 ? Math.min(100, (ventasNetas / getAdj(kpis.break_even_mensual)) * 100).toFixed(0) : 0}%</span>
                        </div>
                        <div style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${getAdj(kpis.break_even_mensual) > 0 ? Math.min(100, (ventasNetas / getAdj(kpis.break_even_mensual)) * 100) : 0}%`, background: ventasNetas >= getAdj(kpis.break_even_mensual) ? '#10b981' : '#3b82f6' }}></div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* ROW 3: 3 KPI CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
                {[
                    { label: 'Mis ventas del mes (sin IVA)', key: 'netos', val: Utils.fmt(ventasNetas), sub: 'Lo que facturé después de quitarle el IVA y las comisiones', color: '#10b981' },
                    { label: 'Pagué a empleados', key: 'laboral', val: Utils.fmt(getAdj(egresos.laboral)), sub: `Representa el ${ventasNetas !== 0 ? ((getAdj(egresos.laboral) / ventasNetas) * 100).toFixed(1) : 0}% de mis ventas`, color: '#8b5cf6' },
                ].map((k, i) => (
                    <Card key={i} style={{ padding: '14px 18px' }}>
                        <CardTitle title={k.label} onInfo={() => setInfoModalKey(k.key)} />
                        <p className="text-lg font-black font-mono tracking-tight" style={{ color: k.color, fontVariantNumeric: 'tabular-nums', marginTop: -8 }}>
                            {viewMode === 'DOLAR_MEP' ? 'u$s ' : ''}{k.val}
                        </p>
                        <p style={{ fontSize: 10, color: '#334155', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{k.sub}</p>
                    </Card>
                ))}
            </div>

            {/* ROW 3: CHART + PANELS */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>

                {/* Evolución */}
                <Card style={{ padding: 22 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: '#475569', textTransform: 'uppercase', margin: 0 }}>Cómo evolucionó el negocio</p>
                            <button onClick={() => setInfoModalKey('evolucion')} className="w-5 h-5 rounded-full border border-slate-700/50 text-slate-500 hover:text-blue-400 hover:border-blue-500/50 hover:bg-slate-800/50 flex items-center justify-center text-[10px] font-bold transition-all">?</button>
                        </div>
                        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                            {[
                                { c: 'rgba(16,185,129,0.55)', label: 'Ingresos', line: false },
                                { c: 'rgba(244,63,94,0.45)', label: 'Egresos', line: false },
                                { c: '#3b82f6', label: 'Resultado', line: true },
                            ].map(l => (
                                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {l.line
                                        ? <div style={{ width: 18, height: 2, background: l.c, borderRadius: 2 }}></div>
                                        : <div style={{ width: 10, height: 10, background: l.c, borderRadius: 3 }}></div>
                                    }
                                    <span style={{ fontSize: 10, color: '#64748b' }}>{l.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <EvolutionChart historial={historial} mode={viewMode} />
                    
                    {/* Año a Año (YoY) */}
                    <YoYComparison historial={historial} currentPeriod={`${selectedYear}-${selectedMonth}`} mode={viewMode} />
                </Card>

                {/* Right column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                    {/* Mix pagos */}
                    <Card style={{ padding: 20, flex: 1 }}>
                        <CardTitle title="Cómo te pagaron los clientes" onInfo={() => setInfoModalKey('mix')} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                            {mixPagosEntries.length > 0 ? mixPagosEntries.map(([metodo, monto], i) => (
                                <div key={metodo}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>{metodo}</span>
                                        <div style={{ textAlign: 'right' }}>
                                            <span style={{ fontSize: 12, fontWeight: 800, color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>
                                                {viewMode === 'DOLAR_MEP' ? 'u$s ' : ''}{Utils.fmt(getAdj(monto))}
                                            </span>
                                            <span style={{ fontSize: 10, color: '#475569', marginLeft: 6 }}>{ventasNetas !== 0 ? ((getAdj(monto) / ventasNetas) * 100).toFixed(1) : '0'}%</span>
                                        </div>
                                    </div>
                                    <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${ventasNetas > 0 ? Math.min(100, (Utils.num(monto) / ventasNetas) * 100) : 0}%`, background: MIX_COLORS[i % MIX_COLORS.length], borderRadius: 99, opacity: 0.85, transition: 'width 0.7s ease' }}></div>
                                    </div>
                                </div>
                            )) : (
                                <p style={{ fontSize: 11, color: '#334155' }}>Sin datos de medios de pago.</p>
                            )}
                        </div>

                        {/* Margen por canal */}
                        {ventasNetas > 0 && (
                            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <p style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.1em', marginBottom: 12 }}>Margen estimado por canal</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {[
                                        { l: 'Mostrador (Efectivo)', m: (getAdj(kpis.margen_contribuccion) + getAdj(egresos.comisiones)) / (ventasNetas + getAdj(egresos.comisiones)), c: '#10b981' },
                                        { l: 'Tarjetas (Salón)', m: ((getAdj(kpis.margen_contribuccion) + getAdj(egresos.comisiones)) / (ventasNetas + getAdj(egresos.comisiones))) - 0.018, c: '#3b82f6' },
                                        { l: 'Apps (Delivery)', m: ((getAdj(kpis.margen_contribuccion) + getAdj(egresos.comisiones)) / (ventasNetas + getAdj(egresos.comisiones))) - 0.25, c: '#f43f5e' }
                                    ].map(canal => (
                                        <div key={canal.l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: 10, color: '#64748b' }}>{canal.l}</span>
                                            <span style={{ fontSize: 11, fontWeight: 800, color: canal.m > 0.1 ? canal.c : '#f43f5e' }}>{(canal.m * 100).toFixed(1)}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </Card>

                    {/* Composición egresos */}
                    <Card style={{ padding: 20, flex: 1 }}>
                        <CardTitle title="En qué se va el dinero" onInfo={() => setInfoModalKey('composicion')} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {egresoComposicion.map(item => (
                                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ width: 3, height: 28, background: item.color, borderRadius: 99, flexShrink: 0 }}></div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: 10, color: '#64748b' }}>{item.label}</span>
                                            <div style={{ textAlign: 'right' }}>
                                                <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>{Utils.fmt(item.val)}</span>
                                                <span style={{ fontSize: 9, color: '#334155', marginLeft: 5 }}>{egresoTotal > 0 ? ((item.val / egresoTotal) * 100).toFixed(1) : '0'}%</span>
                                            </div>
                                        </div>
                                        <div style={{ height: 2, background: 'rgba(255,255,255,0.04)', borderRadius: 99, overflow: 'hidden', marginTop: 4 }}>
                                            <div style={{ height: '100%', width: `${egresoTotal > 0 ? Math.min(100, (item.val / egresoTotal) * 100) : 0}%`, background: item.color, borderRadius: 99, opacity: 0.6, transition: 'width 0.7s ease' }}></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>

                </div>
            </div>
            </div> {/* Closes pnl-export-area */}
            
            {/* ACTION HUB (Cargas Integradas al Mes) movido a abajo de todo */}
            <div className="mt-8">
                {renderActionHub()}
            </div>

        </div> /* Closes animate-fade-in */
    );
};

export default DashboardView;
