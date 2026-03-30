import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useFinance } from './FinanceContext';
import { formatters as Utils } from './formatters';
import { Chart, registerables } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { CardSkeleton, ChartSkeleton } from './Skeleton';

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
                const [y, m] = k.split('-');
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in p-4" onClick={onClose}>
            <div className="bg-[#0b1121] border border-slate-700 w-full max-w-lg rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                    <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-black text-center leading-none mt-0 pt-0">?</span>
                        {title}
                    </h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800">✕</button>
                </div>
                <div className="p-6 overflow-y-auto">
                    <div className="mb-6">
                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Explicación Simple</p>
                        <p className="text-sm text-slate-300 leading-relaxed">{explanation}</p>
                    </div>
                    {breakdown && breakdown.length > 0 && (
                        <div>
                            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-3">Desglose de Datos</p>
                            <div className="bg-slate-900/40 rounded-xl border border-slate-800 overflow-hidden">
                                {breakdown.map((row, i) => (
                                    <div key={i} className={`flex justify-between items-center px-4 py-3 ${i < breakdown.length - 1 ? 'border-b border-slate-800' : ''} ${row.total ? 'bg-slate-800/60 font-bold' : ''}`}>
                                        <span className={`text-xs ${row.total ? 'text-white' : 'text-slate-400'}`}>{row.label}</span>
                                        <span className={`text-sm font-mono tracking-tight ${row.color || 'text-slate-200'} ${row.total ? 'text-white' : ''}`}>{Utils.fmt(row.val)}</span>
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

const AlertsPanel = ({ kpis, egresos, periodo }) => {
    const [dismissed, setDismissed] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem(`alerts_dismissed_${periodo}`) || '[]');
        } catch (e) { return []; }
    });

    // Reset dismissed when period changes
    useEffect(() => {
        try {
            setDismissed(JSON.parse(localStorage.getItem(`alerts_dismissed_${periodo}`) || '[]'));
        } catch (e) { setDismissed([]); }
    }, [periodo]);

    const alerts = useMemo(() => {
        const list = [];
        const ventasNetas = Utils.num(kpis.ventas_netas_reales);
        if (ventasNetas === 0) return [];

        // 🔴 Crítica: utilidad_neta < 0
        if (Utils.num(kpis.utilidad_neta) < 0) {
            list.push({ id: 'loss', type: 'critical', msg: 'Este mes el negocio perdió dinero.' });
        }

        // 🔴 Crítica: margen_contribuccion / ventas_netas_reales < 0.50
        if (Utils.num(kpis.margen_contribuccion) / ventasNetas < 0.50) {
            list.push({ id: 'low_margin', type: 'critical', msg: 'Tu margen bruto cayó debajo del 50%. Revisá precios o recetas.' });
        }

        // 🟡 Advertencia: ventas_netas_reales < break_even_mensual
        if (ventasNetas < Utils.num(kpis.break_even_mensual)) {
            list.push({ id: 'breakeven', type: 'warning', msg: 'No alcanzaste el punto de equilibrio este mes.' });
        }

        // 🟡 Advertencia: egresos.laboral / ventas_netas_reales > 0.35
        if (Utils.num(egresos.laboral) / ventasNetas > 0.35) {
            list.push({ id: 'labor_cost', type: 'warning', msg: 'El costo de nómina supera el 35% de las ventas.' });
        }

        // 🟡 Advertencia: egresos.cmv / ventas_netas_reales > 0.40
        if (Utils.num(egresos.cmv) / ventasNetas > 0.40) {
            list.push({ id: 'cmv_cost', type: 'warning', msg: 'El CMV supera el 40% de las ventas. Revisá tus proveedores o precios.' });
        }

        // 🔵 Info: egresos.iibb === 0
        if (Utils.num(egresos.iibb) === 0) {
            list.push({ id: 'iibb_missing', type: 'info', msg: 'No registraste el pago de Ingresos Brutos este mes.' });
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
        <div className="mb-6 flex flex-col gap-3">
            {alerts.map(alert => (
                <div 
                    key={alert.id}
                    className={`flex items-center justify-between p-4 rounded-xl border animate-slide-up ${
                        alert.type === 'critical' ? 'bg-rose-500/10 border-rose-500/30' :
                        alert.type === 'warning' ? 'bg-amber-500/10 border-amber-500/30' :
                        'bg-blue-500/10 border-blue-500/30'
                    }`}
                >
                    <div className="flex items-center gap-3">
                        <span className="text-lg leading-none">
                            {alert.type === 'critical' ? '🔴' : alert.type === 'warning' ? '🟡' : '🔵'}
                        </span>
                        <span className={`text-sm font-medium ${
                            alert.type === 'critical' ? 'text-rose-200' :
                            alert.type === 'warning' ? 'text-amber-200' :
                            'text-blue-200'
                        }`}>
                            {alert.msg}
                        </span>
                    </div>
                    <button 
                        onClick={() => handleDismiss(alert.id)}
                        className="text-slate-500 hover:text-white transition-colors p-1"
                    >
                        ✕
                    </button>
                </div>
            ))}
        </div>
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
            <p style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.1em', margin: '0 0 4px' }}>Comparativa Interanual</p>
            <p style={{ fontSize: 11, color: '#334155', margin: 0 }}>Datos históricos insuficientes (12 meses+ requeridos)</p>
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
            <p style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.1em', marginBottom: 16 }}>Comparativa vs Año Anterior</p>
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

const DashboardView = () => {
    const { dashData: data, loading, error, viewMode, setViewMode, localAjustes, setLocalAjustes, updateConfig, selectedYear, selectedMonth } = useFinance();
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
        .filter(([k]) => k !== 'retenciones') // retenciones no van en % composición visual
        .reduce((a, [, b]) => a + getAdj(b), 0);

    const egresoComposicion = [
        { label: 'CMV (Mercadería)', val: getAdj(egresos.cmv), color: '#f59e0b', key: 'cmv' },
        { label: 'Nómina', val: getAdj(egresos.laboral), color: '#8b5cf6', key: 'laboral' },
        { label: 'Estructurales', val: getAdj(egresos.estructural), color: '#06b6d4', key: 'estructural' },
        { label: 'Comisiones', val: getAdj(egresos.comisiones), color: '#f43f5e', key: 'comisiones' },
        { label: 'Ingresos Brutos', val: getAdj(egresos.iibb || 0), color: '#f97316', key: 'iibb' },
        { label: 'Amortizaciones', val: getAdj(egresos.amortizaciones || 0), color: '#a78bfa', key: 'amort' },
        { label: 'Otros / Honorarios', val: getAdj(egresos.otros) + getAdj(egresos.honorarios), color: '#64748b', key: 'otros' },
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

    if (!data || (Utils.num(kpis.utilidad_neta) === 0 && egresoTotal === 0)) return (
        <div style={{ marginTop: 32, padding: 64, background: 'rgba(15,23,42,0.2)', border: '1px dashed rgba(71,85,105,0.5)', borderRadius: 32, textAlign: 'center' }} className="animate-fade-in">
            <div style={{ fontSize: 48, marginBottom: 16 }}>📂</div>
            <p style={{ color: '#475569', fontSize: 13 }}>No se encontraron registros para el periodo seleccionado.</p>
        </div>
    );

    const mixPagosEntries = Object.entries(mixPagos);

    const infoData = {
        'resultado': {
            title: 'Resultado del Período',
            explanation: 'Ganancia neta final después de todos los costos (CMV, Laboral, Estructural, Comisiones). Es lo que realmente queda "en el bolsillo" del negocio.',
            breakdown: [
                { label: 'Ventas Netas (Reales)', val: ventasNetas, color: 'text-emerald-400' },
                { label: 'Total Egresos (inc. CMV)', val: -egresoTotal, color: 'text-rose-400' },
                { label: 'Resultado Final', val: utilidad, total: true, color: utilidad >= 0 ? 'text-emerald-400' : 'text-rose-400' }
            ]
        },
        'margen': {
            title: 'Margen de Contribución',
            explanation: 'Es el dinero que queda disponible para cubrir costos fijos después de pagar la mercadería (CMV) y las comisiones bancarias. Es el indicador más importante de la eficiencia de tu receta y precios.',
            breakdown: [
                { label: 'Ventas Netas', val: ventasNetas },
                { label: 'CMV (Costo Mercadería)', val: -Utils.num(egresos.cmv), color: 'text-rose-400' },
                { label: 'Comisiones Ventas', val: -Utils.num(egresos.comisiones), color: 'text-rose-400' },
                { label: 'Margen Bruto', val: Utils.num(kpis.margen_contribuccion), total: true, color: 'text-emerald-400' }
            ]
        },
        'breakeven': {
            title: 'Punto de Equilibrio (Break-even)',
            explanation: 'Es el monto de ventas exacto que necesitas para que el resultado sea CERO. Ni ganas ni pierdes. Superar este número es empezar a tener ganancias reales.',
            breakdown: [
                { label: 'Costos Fijos Totales', val: Utils.num(egresos.laboral) + Utils.num(egresos.estructural) + Utils.num(egresos.honorarios) + Utils.num(egresos.iibb || 0) + Utils.num(egresos.amortizaciones || 0) },
                { label: '↳ incl. Amortizaciones', val: Utils.num(egresos.amortizaciones || 0), color: 'text-violet-400' },
                { label: 'Ventas Actuales (Netas)', val: ventasNetas },
                { label: 'Objetivo de Equilibrio', val: Utils.num(kpis.break_even_mensual), total: true, color: 'text-blue-400' }
            ]
        },
        'iva': {
            title: 'Posición Fiscal IVA',
            explanation: 'Diferencia entre el IVA cobrado y el pagado. Refleja la obligación tributaria del período.',
            breakdown: [
                { label: 'Posición Mensual', val: Utils.num(kpis.iva_posicion), total: true }
            ]
        },
        'evolucion': {
            title: 'Evolución Mensual',
            explanation: 'Histórico de ingresos vs egresos. En modo Real, los valores pasados se ajustan por IPC a moneda de hoy para una comparación justa.'
        },
        'mix': {
            title: 'Mix Medios de Pago',
            explanation: 'Origen de las ventas. Ayuda a visualizar el impacto de las comisiones bancarias y de apps.'
        },
        'composicion': {
            title: 'Composición de Egresos',
            explanation: 'Desglose porcentual de dónde se va el capital. El CMV y la Nómina suelen ser los rubros más pesados.'
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
                            {m.replace('_', ' ')}
                        </button>
                    ))}
                </div>

                {/* Panel de Ajustes del Periodo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(15, 23, 42, 0.3)', padding: '6px 12px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ fontSize: 8, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Coef. IPC</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={localAjustes.ipc}
                                    onChange={(e) => setLocalAjustes(prev => ({ ...prev, ipc: e.target.value }))}
                                    style={{ width: 50, background: 'transparent', border: 'none', borderBottom: '1px solid #334155', color: '#f59e0b', fontSize: 12, fontWeight: 800, outline: 'none', padding: '0 2px' }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ fontSize: 8, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Dólar MEP</span>
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

            {/* Alerta: egresos sin clasificar */}
            {egresoTotal > 0 && (getAdj(egresos.otros) + getAdj(egresos.honorarios)) / egresoTotal > 0.2 && (
                <div style={{
                    marginBottom: 16, padding: '12px 18px', borderRadius: 12,
                    background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 16 }}>⚠️</span>
                        <div>
                            <p style={{ fontSize: 12, fontWeight: 800, color: '#fcd34d', margin: '0 0 2px' }}>Egresos sin clasificar detectados</p>
                            <p style={{ fontSize: 11, color: '#92400e', margin: 0 }}>
                                El {((getAdj(egresos.otros) + getAdj(egresos.honorarios)) / egresoTotal * 100).toFixed(0)}% de tus gastos están en "Otros".
                                Asigná categorías por CUIT para mejorar la precisión del resultado.
                            </p>
                        </div>
                    </div>
                    <a
                        href="#categorias"
                        onClick={(e) => { e.preventDefault(); }}
                        style={{
                            fontSize: 10, fontWeight: 900, color: '#f59e0b', background: 'rgba(245,158,11,0.1)',
                            border: '1px solid rgba(245,158,11,0.3)', padding: '6px 12px',
                            borderRadius: 8, textDecoration: 'none', whiteSpace: 'nowrap',
                            letterSpacing: '0.08em', textTransform: 'uppercase'
                        }}
                    >
                        Ir a Categorías →
                    </a>
                </div>
            )}

            {/* Panel de Inteligencia Financiera */}
            <AlertsPanel kpis={kpis} egresos={egresos} periodo={`${selectedYear}-${selectedMonth}`} />

            <div id="pnl-export-area" className="p-4" style={{ margin: '-16px' }}>
                {/* ROW 1: 3 HERO CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 16, marginBottom: 16 }}>

                {/* Utilidad Neta */}
                <Card style={{ padding: 24, background: 'rgba(16,185,129,0.03)', borderColor: 'rgba(16,185,129,0.1)' }}>
                    <CardTitle title="Resultado del Período" onInfo={() => setInfoModalKey('resultado')} />
                    <p style={{ fontSize: 36, fontWeight: 900, color: utilidad >= 0 ? '#10b981' : '#f43f5e', letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                        {viewMode === 'DOLAR_MEP' ? 'u$s ' : ''}{Utils.fmt(utilidad)}
                    </p>
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 18, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: '#64748b' }}>Margen Operativo</span>
                            <span style={{ fontSize: 12, fontWeight: 800, color: +margen > 15 ? '#10b981' : +margen > 5 ? '#f59e0b' : '#f43f5e' }}>{margen}%</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: '#64748b' }}>Ratio CMV / Ventas</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>{ventasNetas > 0 ? ((Utils.num(egresos.cmv) / ventasNetas) * 100).toFixed(1) : 0}%</span>
                        </div>
                    </div>
                </Card>

                {/* Margen de Contribución */}
                <Card style={{ padding: 24, background: 'rgba(59,130,246,0.02)' }}>
                    <CardTitle title="Margen Bruto" onInfo={() => setInfoModalKey('margen')} />
                    <p style={{ fontSize: 30, fontWeight: 900, color: '#3b82f6', letterSpacing: '-0.04em', lineHeight: 1 }}>
                        {ventasNetas > 0 ? ((Utils.num(kpis.margen_contribuccion) / ventasNetas) * 100).toFixed(1) : 0}%
                    </p>
                    <p style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>Disponible tras CMV y Comisiones</p>
                    <div style={{ marginTop: 20 }}>
                        <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 99 }}>
                            <div style={{ height: '100%', width: `${ventasNetas > 0 ? (Utils.num(kpis.margen_contribuccion) / ventasNetas) * 100 : 0}%`, background: '#3b82f6', borderRadius: 99 }}></div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                            <span style={{ fontSize: 10, color: '#64748b' }}>CMV: {ventasNetas > 0 ? ((Utils.num(egresos.cmv) / ventasNetas) * 100).toFixed(0) : 0}%</span>
                            <span style={{ fontSize: 10, color: '#64748b' }}>Comis: {ventasNetas > 0 ? ((Utils.num(egresos.comisiones) / ventasNetas) * 100).toFixed(1) : 0}%</span>
                        </div>
                    </div>
                </Card>

                {/* Posición IVA */}
                <Card style={{ padding: 24, borderLeft: '3px solid #64748b' }}>
                    <CardTitle title="Posición Fiscal IVA" onInfo={() => setInfoModalKey('iva')} />
                    <p style={{ fontSize: 24, fontWeight: 900, color: getAdj(kpis.iva_posicion) > 0 ? '#f43f5e' : '#10b981', letterSpacing: '-0.02em', lineHeight: 1 }}>
                        {viewMode === 'DOLAR_MEP' ? 'u$s ' : ''}{Utils.fmt(getAdj(kpis.iva_posicion))}
                    </p>
                    <p style={{ fontSize: 10, color: '#475569', marginTop: 14, fontWeight: 600 }}>
                        {getAdj(kpis.iva_posicion) > 0 ? 'IVA A PAGAR ESTE MES' : 'SALDO A FAVOR AFIP'}
                    </p>
                </Card>

                {/* Punto de Equilibrio */}
                <Card style={{ padding: 24 }}>
                    <CardTitle title="Punto de Equilibrio" onInfo={() => setInfoModalKey('breakeven')} />
                    <p style={{ fontSize: 24, fontWeight: 900, color: ventasNetas >= getAdj(kpis.break_even_mensual) ? '#10b981' : '#f59e0b', letterSpacing: '-0.02em', lineHeight: 1 }}>
                        {ventasNetas >= getAdj(kpis.break_even_mensual) ? 'LOGRADO' : 'EN PROGRESO'}
                    </p>
                    <div style={{ marginTop: 22 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: 10, color: '#64748b' }}>Progreso: {getAdj(kpis.break_even_mensual) > 0 ? Math.min(100, (ventasNetas / getAdj(kpis.break_even_mensual)) * 100).toFixed(0) : 0}%</span>
                            <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>{viewMode === 'DOLAR_MEP' ? 'u$s ' : ''}{Utils.fmt(getAdj(kpis.break_even_mensual))}</span>
                        </div>
                        <div style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${getAdj(kpis.break_even_mensual) > 0 ? Math.min(100, (ventasNetas / getAdj(kpis.break_even_mensual)) * 100) : 0}%`, background: ventasNetas >= getAdj(kpis.break_even_mensual) ? '#10b981' : '#3b82f6' }}></div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* ROW 2: 4 KPI CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                {[
                    { label: 'Ventas Netas', key: 'netos', val: Utils.fmt(ventasNetas), sub: 'Libre de IVA y Comis.', color: '#10b981' },
                    { label: 'Costo CMV', key: 'cmv', val: Utils.fmt(getAdj(egresos.cmv)), sub: `${ventasNetas !== 0 ? ((getAdj(egresos.cmv) / ventasNetas) * 100).toFixed(1) : 0}% s/ ventas`, color: '#f59e0b' },
                    { label: 'Costo Laboral', key: 'laboral', val: Utils.fmt(getAdj(egresos.laboral)), sub: `${ventasNetas !== 0 ? ((getAdj(egresos.laboral) / ventasNetas) * 100).toFixed(1) : 0}% s/ ventas`, color: '#8b5cf6' },
                    { label: 'Posición IVA', key: 'iva', val: Utils.fmt(getAdj(kpis.iva_posicion)), sub: getAdj(kpis.iva_posicion) > 0 ? 'A Pagar' : 'A Favor', color: '#64748b' },
                ].map((k, i) => (
                    <Card key={i} style={{ padding: '14px 18px' }}>
                        <CardTitle title={k.label} onInfo={() => setInfoModalKey(k.key)} />
                        <p style={{ fontSize: 18, fontWeight: 900, color: k.color, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', marginTop: -12 }}>
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
                            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: '#475569', textTransform: 'uppercase', margin: 0 }}>Evolución Mensual</p>
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
                        <CardTitle title="Mix Medios de Pago" onInfo={() => setInfoModalKey('mix')} />
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
                        <CardTitle title="Composición de Egresos" onInfo={() => setInfoModalKey('composicion')} />
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
            </div>
        </div>
    );
};

export default DashboardView;
