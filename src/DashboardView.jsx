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

    if (!chartData) return <div style={{ height: 210, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: '#64748b', fontSize: 11 }}>Sin datos históricos</p></div>;
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
            if (Utils.num(kpis.margen_contribuccion) / ventasNetas < 0.50) {
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

const DashboardView = ({ onDataReady, setShowStructModal, defaultDate, setDefaultDate }) => {
    const {
        dashData: data, empData, arcaData, ventasData,
        loading, error, viewMode, setViewMode,
        localAjustes, setLocalAjustes, updateConfig,
        selectedYear, selectedMonth, cargasPct
    } = useFinance();
    const [infoModalKey, setInfoModalKey] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [ivaShowAll, setIvaShowAll] = useState(false);
    const [ventasExpanded, setVentasExpanded] = useState(false);
    const [comprasExpanded, setComprasExpanded] = useState(false);

    const ivaGrouped = useMemo(() => {
        const map = {};
        Utils.arr(arcaData).filter(r => Utils.num(r.iva) !== 0).forEach(item => {
            const key = item.entidad || 'Proveedor';
            if (!map[key]) map[key] = 0;
            map[key] += Math.abs(Utils.num(item.iva));
        });
        return Object.entries(map).sort((a, b) => b[1] - a[1]);
    }, [arcaData]);

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
                scale: 2, backgroundColor: '#070c18', logging: false, useCORS: true
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

    const egresoTotal =
        getAdj(laboralEfectivo) +
        getAdj(sacEfectivo) +
        getAdj(cargasEfectivo) +
        getAdj(egresos.estructural || 0) +
        getAdj(egresos.comisiones || 0) +
        getAdj(egresos.otros || 0);

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
        'iva': {
            title: 'Tu IVA del mes',
            explanation: 'Cada vez que vendés, cobrás IVA (21%) que le pertenece al Estado. Cada vez que comprás con factura, pagás IVA que podés descontar. La diferencia es lo que le debés (o te debe) AFIP.\n\nSi el número es positivo → tenés que pagar ese monto a AFIP.\nSi es negativo → tenés saldo a favor (AFIP te "debe" a vos).\n\nImportante: los sueldos y cargas sociales NO generan crédito fiscal de IVA.',
            breakdown: [
                { label: 'IVA Débito Fiscal (ventas)', val: Utils.num(kpis.iva_debito), color: 'text-emerald-400' },
                { label: 'IVA Crédito Fiscal (compras con factura)', val: -Utils.num(kpis.iva_credito || 0), color: 'text-rose-400' },
                { label: 'Posición neta del mes', val: Utils.num(kpis.iva_posicion), total: true }
            ]
        },
        'evolucion': {
            title: 'Cómo evolucionó el negocio',
            explanation: 'Muestra mes a mes cómo fueron tus ventas y gastos. En modo "Ajustado por inflación", los meses pasados se actualizan a pesos de hoy para que la comparación sea justa.'
        },
    };

    const ivaProveedoresVisible = ivaShowAll ? ivaGrouped : ivaGrouped.slice(0, 10);

    return (
        <div className="animate-fade-in" style={{ paddingBottom: 40 }}>

            <InfoModal
                isOpen={!!infoModalKey}
                onClose={() => setInfoModalKey(null)}
                {...(infoData[infoModalKey] || {})}
            />

            {/* Selector de Vista y MEP */}
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', padding: 4, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
                        {['NOMINAL', 'DOLAR_MEP'].map(m => (
                            <button
                                key={m}
                                onClick={() => setViewMode(m)}
                                style={{
                                    padding: '8px 16px', borderRadius: 8, fontSize: 10, fontWeight: 900, border: 'none',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    background: viewMode === m ? '#3b82f6' : 'transparent',
                                    color: viewMode === m ? 'white' : '#64748b',
                                    boxShadow: viewMode === m ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none',
                                    cursor: 'pointer', letterSpacing: '0.05em'
                                }}
                            >
                                {m === 'NOMINAL' ? 'Pesos actuales' : 'En dólares'}
                            </button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(15,23,42,0.3)', padding: '6px 12px', borderRadius: 12, border: '1px solid rgba(139,92,246,0.2)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontSize: 8, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Dólar MEP</span>
                                <span title="Cotización real del mercado (dolarito.ar o similar)" style={{ fontSize: 7, color: '#4c1d95', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)', padding: '1px 4px', borderRadius: 3, cursor: 'help', fontWeight: 800 }}>COTI</span>
                            </div>
                            <input
                                type="number"
                                value={localAjustes.mep}
                                onChange={(e) => setLocalAjustes(prev => ({ ...prev, mep: e.target.value }))}
                                style={{ width: 68, background: 'transparent', border: 'none', borderBottom: '1px solid #334155', color: '#8b5cf6', fontSize: 12, fontWeight: 800, outline: 'none', padding: '0 2px' }}
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

                {/* ── IVA DEL MES ─────────────────────────────────── */}
                <div style={{ marginBottom: 16 }}>
                    <Card style={{ padding: 28, borderLeft: '4px solid #3b82f6', background: 'linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(15,23,42,0.6) 100%)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 24 }}>

                            {/* Posición neta */}
                            <div style={{ flex: 1, minWidth: 200 }}>
                                <CardTitle title="IVA del mes" onInfo={() => setInfoModalKey('iva')} />
                                <p className="text-4xl font-black tracking-tighter leading-none font-mono" style={{ color: getAdj(kpis.iva_posicion) > 0 ? '#f43f5e' : '#10b981', fontVariantNumeric: 'tabular-nums', margin: 0 }}>
                                    {viewMode === 'DOLAR_MEP' ? 'u$s ' : ''}{Utils.fmt(getAdj(kpis.iva_posicion))}
                                </p>
                                <p style={{ fontSize: 14, fontWeight: 700, marginTop: 10, color: getAdj(kpis.iva_posicion) > 0 ? '#fda4af' : '#6ee7b7' }}>
                                    {getAdj(kpis.iva_posicion) > 0 ? '⚠️ Tenés que pagar este monto a AFIP' : '✅ Tenés saldo a favor en AFIP'}
                                </p>
                                <p style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>IVA cobrado a clientes − IVA pagado en compras con factura</p>
                            </div>

                            {/* Columna derecha: cobrado + pagado */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 260, flex: 1 }}>

                                {/* IVA Cobrado */}
                                <div style={{ background: 'rgba(16,185,129,0.05)', borderRadius: 12, padding: '14px 18px', border: '1px solid rgba(16,185,129,0.14)' }}>
                                    <p className="section-label !mb-1">IVA Cobrado — total ventas × 21%</p>
                                    <p className="text-xl font-black font-mono" style={{ color: '#10b981', margin: 0 }}>{viewMode === 'DOLAR_MEP' ? 'u$s ' : ''}{Utils.fmt(getAdj(kpis.iva_debito))}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">Débito fiscal — IVA que cobrás a tus clientes</p>
                                </div>

                                {/* IVA Pagado con lista de proveedores */}
                                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '14px 18px', border: '1px solid rgba(255,255,255,0.04)' }}>
                                    <p className="section-label !mb-1">IVA Pagado — proveedores con factura</p>
                                    <p className="text-xl font-black font-mono" style={{ color: '#f43f5e', margin: 0 }}>{viewMode === 'DOLAR_MEP' ? 'u$s ' : ''}{Utils.fmt(getAdj(kpis.iva_credito || 0))}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">Crédito fiscal (ARCA) — no incluye sueldos</p>
                                    {ivaGrouped.length > 0 && (
                                        <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {ivaProveedoresVisible.map(([entidad, total], i) => (
                                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                                    <span style={{ fontSize: 10, color: '#64748b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entidad}</span>
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
                        </div>
                    </Card>
                </div>

                {/* ── RESULTADO DEL MES ───────────────────────────── */}
                <div style={{ marginBottom: 16 }}>
                    <Card style={{ padding: 28, borderLeft: '4px solid #10b981', background: 'linear-gradient(135deg, rgba(16,185,129,0.04) 0%, rgba(15,23,42,0.6) 100%)' }}>
                        <CardTitle title="Resultado del mes" onInfo={() => setInfoModalKey('resultado')} />

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>

                            {/* Columna Ventas */}
                            <div style={{ background: 'rgba(16,185,129,0.04)', borderRadius: 14, border: '1px solid rgba(16,185,129,0.12)', overflow: 'hidden' }}>
                                <button
                                    onClick={() => setVentasExpanded(v => !v)}
                                    style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer' }}
                                >
                                    <div style={{ textAlign: 'left' }}>
                                        <p style={{ fontSize: 9, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.15em', margin: 0 }}>Ventas</p>
                                        <p className="text-2xl font-black font-mono" style={{ color: '#10b981', fontVariantNumeric: 'tabular-nums', margin: '4px 0 0' }}>
                                            {viewMode === 'DOLAR_MEP' ? 'u$s ' : ''}{Utils.fmt(ventasNetas)}
                                        </p>
                                    </div>
                                    <span style={{ fontSize: 12, color: '#475569' }}>{ventasExpanded ? '▲' : '▼'}</span>
                                </button>
                                {ventasExpanded && (
                                    <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                        {[
                                            { l: 'Venta bruta (sistema)', v: getAdj(kpis.venta_bruta) },
                                            { l: 'IVA cobrado (−)', v: -getAdj(kpis.iva_debito), neg: true },
                                            { l: 'Venta neta s/IVA', v: ventasNetas, bold: true },
                                        ].map((row, i) => (
                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: i === 0 ? 12 : 0 }}>
                                                <span style={{ fontSize: 11, color: row.bold ? '#94a3b8' : '#64748b', fontWeight: row.bold ? 700 : 400 }}>{row.l}</span>
                                                <span style={{ fontSize: 12, fontWeight: row.bold ? 800 : 600, color: row.neg ? '#f43f5e' : '#10b981', fontVariantNumeric: 'tabular-nums' }}>
                                                    {viewMode === 'DOLAR_MEP' ? 'u$s ' : ''}{Utils.fmt(row.v)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Columna Compras */}
                            <div style={{ background: 'rgba(244,63,94,0.03)', borderRadius: 14, border: '1px solid rgba(244,63,94,0.1)', overflow: 'hidden' }}>
                                <button
                                    onClick={() => setComprasExpanded(v => !v)}
                                    style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer' }}
                                >
                                    <div style={{ textAlign: 'left' }}>
                                        <p style={{ fontSize: 9, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.15em', margin: 0 }}>Compras y gastos</p>
                                        <p className="text-2xl font-black font-mono" style={{ color: '#f43f5e', fontVariantNumeric: 'tabular-nums', margin: '4px 0 0' }}>
                                            {viewMode === 'DOLAR_MEP' ? 'u$s ' : ''}{Utils.fmt(egresoTotal)}
                                        </p>
                                    </div>
                                    <span style={{ fontSize: 12, color: '#475569' }}>{comprasExpanded ? '▲' : '▼'}</span>
                                </button>
                                {comprasExpanded && (
                                    <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                        {[
                                            { l: 'Sueldos y cargas', v: getAdj(laboralEfectivo) + getAdj(sacEfectivo) + getAdj(cargasEfectivo) },
                                            { l: 'Gastos fijos operativos', v: getAdj(egresos.estructural || 0) },
                                            { l: 'Proveedores (compras)', v: getAdj(egresos.otros || 0) },
                                            { l: 'Comisiones bancos/apps', v: getAdj(egresos.comisiones || 0) },
                                        ].filter(r => r.v > 0).map((row, i) => (
                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: i === 0 ? 12 : 0 }}>
                                                <span style={{ fontSize: 11, color: '#64748b' }}>{row.l}</span>
                                                <span style={{ fontSize: 12, fontWeight: 600, color: '#f43f5e', fontVariantNumeric: 'tabular-nums' }}>
                                                    {viewMode === 'DOLAR_MEP' ? 'u$s ' : ''}{Utils.fmt(row.v)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Resultado neto */}
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                            <div>
                                <p style={{ fontSize: 9, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.15em', margin: '0 0 4px' }}>Resultado neto</p>
                                <p className="text-4xl font-black font-mono tracking-tighter" style={{ color: utilidad >= 0 ? '#10b981' : '#f43f5e', fontVariantNumeric: 'tabular-nums', margin: 0 }}>
                                    {viewMode === 'DOLAR_MEP' ? 'u$s ' : ''}{Utils.fmt(utilidad)}
                                </p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ fontSize: 9, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.15em', margin: '0 0 4px' }}>Margen operativo</p>
                                <p className="text-3xl font-black" style={{ color: +margen > 15 ? '#10b981' : +margen > 5 ? '#f59e0b' : '#f43f5e', margin: 0 }}>{margen}%</p>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* ── GRÁFICO EVOLUCIÓN ───────────────────────────── */}
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
                </Card>

            </div> {/* Closes pnl-export-area */}

            {/* ACTION HUB */}
            <div className="mt-8">
                {renderActionHub()}
            </div>

        </div>
    );
};

export default DashboardView;
