import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useFinance } from './FinanceContext';
import { formatters as Utils } from './formatters'; // Asumo que tienes un archivo formatters.js con Utils

// Componentes de Vista
import DashboardView from './DashboardView';
import EmployeesView from './EmployeesView';
import ArcaView, { ProfessionalFeesView, StructuralCostsView } from './ArcaView';
import VentasSistemaView from './VentasSistemaView';
import GuideView from './GuideView';
import CategoriesView from './CategoriesView';
import ConfigView from './ConfigView';
import AuditView from './AuditView';
import { TableSkeleton } from './Skeleton';

// Componentes Comunes
import FileCard from './FileCard';
import StructuralCostsModal from './StructuralCostsModal';
import ProfessionalFeesModal from './ProfessionalFeesModal';
import IIBBModal from './IIBBModal';
import RetentionsModal from './RetentionsModal';
import AssetsView from './AssetsView';

const App = () => {
    const {
        apiUrl, setApiUrl, fetchData, fetchMetadata, loading, setLoading,
        selectedYear, setSelectedYear,
        selectedMonth, setSelectedMonth,
        availablePeriods, cargasPct, setCargasPct
    } = useFinance();

    // Generar botones de periodos (últimos 9 meses)
    const periodButtons = useMemo(() => {
        const periods = [];
        const now = new Date();
        for (let i = 8; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            periods.push({
                y: String(d.getFullYear()),
                m: String(d.getMonth() + 1).padStart(2, '0'),
                label: d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', ''),
                yearShort: d.toLocaleDateString('es-AR', { year: '2-digit' })
            });
        }
        return periods;
    }, []);

    const [activeTab, setActiveTab] = useState('carga');
    const [showProfModal, setShowProfModal] = useState(false);
    const [showStructModal, setShowStructModal] = useState(false);
    const [showIIBBModal, setShowIIBBModal] = useState(false);
    const [showRetModal, setShowRetModal] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [previewOrigen, setPreviewOrigen] = useState(null);
    const [defaultDate, setDefaultDate] = useState(new Date().toISOString().split('T')[0]);
    const [logs, setLogs] = useState([]);

    const addLog = (msg) => {
        const time = new Date().toLocaleTimeString();
        setLogs(prev => [`[${time}] ${msg}`, ...prev]);
    };

    useEffect(() => {
        if (activeTab !== 'carga') {
            fetchMetadata();
        }
    }, [activeTab, fetchMetadata]);


    const handleDataReady = (data, origen) => {
        setPreviewData(data);
        setPreviewOrigen(origen);
    };

    const sendToBackend = async (data, origen) => {
        if (!apiUrl) return alert("Configura la URL");
        setLoading(true);
        addLog(`Enviando ${data.length} registros de ${origen}...`);
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'CARGAR_DATOS', origen, payload: data })
            });
            const res = await response.json();
            if (res.status === 'OK') {
                addLog(`✅ Éxito: ${res.insertados} insertados, ${res.omitidos ?? 0} duplicados omitidos.`);
                // Forzar una recarga completa de datos y metadatos
                fetchData(true);
                setActiveTab('dashboard');
                setPreviewData(null);
            } else {
                addLog(`❌ El servidor respondió con error: ${res.message || res.status}`);
            }
        } catch (e) {
            addLog(`❌ Error: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    // --- Lógica de Previsualización y Edición ---
    const handleCellEdit = useCallback((index, key, value) => {
        // Validación de seguridad para evitar NaNs en el estado
        const parsed = parseFloat(value);
        const numValue = value === '' || isNaN(parsed) ? 0 : parsed;

        const updatedData = previewData.map((r, i) => {
            if (i !== index) return r;
            const updated = {
                ...r,
                [key]: (typeof r[key] === 'number') ? numValue : value
            };

            // LOGICA ESPECIFICA MAXIREST: Recalcular totales al editar componentes
            if (previewOrigen === 'MAXIREST' && key.startsWith('val_')) {
                // 1. Recalculo Fiscal (Basado en Factura B Electrónica y Factura B)
                // Si el usuario edita las facturas, recálculamos el neto y el iva ACF
                const fBElec = parseFloat(updated.val_factura_b_elec) || 0;
                const fB = parseFloat(updated.val_factura_b) || 0;

                updated.val_iva_acf = fBElec - (fBElec / 1.21);
                updated.val_neto_acf = (fBElec / 1.21) + fB;

                updated.neto = updated.val_neto_acf;
                updated.iva = updated.val_iva_acf;
                updated.total = updated.neto + updated.iva;

                // 2. Recalculo Observaciones (String dinámico)
                const obsParts = [];
                if (updated.val_cantidad) obsParts.push(`Q:${updated.val_cantidad}`);
                if (updated.val_turno_am || updated.val_turno_pm) obsParts.push(`AM:$${updated.val_turno_am}/PM:$${updated.val_turno_pm}`);
                if (updated.val_efectivo || updated.val_tarjetas || updated.val_otros) obsParts.push(`Efvo:$${updated.val_efectivo}/Tarj:$${updated.val_tarjetas}`);
                if (updated.val_mostrador || updated.val_salon) obsParts.push(`Most:$${updated.val_mostrador}/Sal:$${updated.val_salon}`);
                if (updated.val_anulaciones) obsParts.push(`Anul:$${updated.val_anulaciones}`);

                updated.observaciones = obsParts.join('. ');
            }

            return updated;
        });
        setPreviewData(updatedData);
    }, [previewData, previewOrigen]);

    // Función para corrección masiva de fecha en la tabla de previsualización
    const applyDateToAll = useCallback((newDate) => {
        if (!previewData) return;
        // Detectar nombre del campo según origen
        let dateField = 'fecha';
        if (previewOrigen === 'SUELDOS') dateField = 'fecha_periodo';

        const updated = previewData.map(r => ({ ...r, [dateField]: newDate }));
        setPreviewData(updated);
    }, [previewData, previewOrigen]);

    const confirmUpload = () => {
        // REDIRECCION: Si el origen es MAXIREST, lo enviamos como 'MAXIREST_RESUMEN'
        // para asegurar que se guarde en la hoja principal que lee el Dashboard,
        // evitando que se cree una hoja separada 'Resumen Maxirest'.
        const origenFinal = previewOrigen === 'MAXIREST' ? 'MAXIREST_RESUMEN' : previewOrigen;

        sendToBackend(previewData, origenFinal);
        setPreviewData(null);
        setPreviewOrigen(null);
    };

    // Componente auxiliar para mostrar y editar estadísticas (Maxirest)
    const StatCard = ({ label, valueKey, qtyKey, index, accent = '#64748b', size = 'normal' }) => {
        const val = previewData[index][valueKey];
        const qty = qtyKey !== undefined ? previewData[index][qtyKey] : undefined;
        return (
            <div className={`flex flex-col gap-1.5 p-3 rounded-xl bg-slate-800/30 border border-white/5`}>
                <span className="section-label" style={{ color: accent, marginBottom: 4 }}>{label}</span>
                <div className="flex items-baseline gap-1">
                    <span className="text-slate-500 text-xs font-mono">$</span>
                    <input
                        type="number"
                        value={val}
                        onChange={(e) => handleCellEdit(index, valueKey, e.target.value)}
                        className={`${size === 'large' ? 'highlight-val' : 'sub-val'} bg-transparent border-none outline-none text-slate-100 w-full transition-colors tracking-tighter font-mono`}
                    />
                </div>
                {qtyKey !== undefined && (
                    <div className="flex items-center justify-end gap-1.5 mt-1 pt-1 border-t border-white/5">
                        <span className="text-slate-600 text-[9px] uppercase font-bold">Cant</span>
                        <input
                            type="number"
                            value={qty}
                            onChange={(e) => handleCellEdit(index, qtyKey, e.target.value)}
                            className="qty-input !w-12 !py-0.5"
                        />
                    </div>
                )}
            </div>
        );
    };

    // Componente auxiliar para editar la fecha (Maxirest)
    const DateField = ({ index }) => (
        <div className="stat-card flex items-center justify-between">
            <span className="section-label text-slate-500" style={{ marginBottom: 0 }}>Fecha del Cierre</span>
            <input
                type="date"
                value={previewData[index]['fecha']}
                onChange={(e) => handleCellEdit(index, 'fecha', e.target.value)}
                className="bg-transparent border-b border-slate-700/40 focus:border-blue-400 outline-none text-slate-200 text-sm font-mono py-1 transition"
            />
        </div>
    );

    const renderTabContent = () => {
        if (previewData) return (
            <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 overflow-hidden mb-8 animate-fade-in">
                <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                    <div>
                        <h2 className="text-xl font-bold text-white">Verificar y Editar Datos</h2>
                        <div className="flex items-center gap-2 text-sm text-slate-400 mt-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-400" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                            <span>Haz clic en los valores para corregir antes de guardar.</span>
                        </div>
                    </div>
                    <span className="bg-blue-900 text-blue-200 text-xs font-bold px-3 py-1 rounded uppercase">{previewOrigen}</span>
                </div>

                {/* VISTA ESPECIAL PARA MAXIREST */}
                {previewOrigen === 'MAXIREST' ? (
                    <div className="p-8 space-y-8 bg-slate-900/20">

                        {/* 1. HEADER: CONTROL TOTAL Y FECHA */}
                        <div className="group-card border-l-4 border-l-emerald-500 flex flex-col md:flex-row justify-between items-center gap-6">
                            <div className="flex-1">
                                <span className="section-label text-emerald-400">Total Neto + IVA a Imputar</span>
                                <div className="flex items-baseline gap-2 mt-1">
                                    <span className="text-emerald-500/50 text-2xl font-mono">$</span>
                                    <span className="highlight-val text-emerald-400">
                                        {Utils.fmt(previewData[0].total, 2)}
                                    </span>
                                    <span className="badge-calc">Calculado</span>
                                </div>
                                <p className="text-slate-500 text-[10px] mt-2 italic">Este es el valor final que impactará en tu Dashboard.</p>
                            </div>

                            <div className="w-px h-12 bg-slate-800 hidden md:block"></div>

                            <div className="flex flex-col items-end">
                                <span className="section-label text-slate-500">Fecha del Cierre</span>
                                <input
                                    type="date"
                                    value={previewData[0]['fecha']}
                                    onChange={(e) => handleCellEdit(0, 'fecha', e.target.value)}
                                    className="bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 mt-1 text-slate-200 font-mono focus:ring-2 focus:ring-emerald-500 outline-none transition"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* 2. BLOQUE FISCAL */}
                            <div className="group-card border-t-2 border-t-orange-500/30">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-xs font-black text-orange-400 uppercase tracking-widest">Configuración Fiscal</h3>
                                    <div className="tooltip-trigger">
                                        <span className="w-5 h-5 rounded-full border border-slate-700 text-slate-500 flex items-center justify-center text-[10px] font-bold cursor-help">?</span>
                                        <div className="tooltip-box">Solo la Factura B Electrónica genera IVA (21%). La Factura B manual se considera exenta. El Neto se calcula proporcionalmente.</div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <StatCard label="Factura B Electrónica" valueKey="val_factura_b_elec" qtyKey="val_factura_b_elec_cantidad" index={0} accent="#fb923c" size="large" />
                                    <StatCard label="Factura B (Exenta)" valueKey="val_factura_b" qtyKey="val_factura_b_cantidad" index={0} accent="#f97316" size="large" />

                                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
                                        <div className="p-3 rounded-lg bg-slate-800/20">
                                            <span className="text-[9px] font-bold text-slate-600 uppercase block mb-1">Neto Derivado</span>
                                            <span className="sub-val text-slate-300">{Utils.fmt(previewData[0].neto)}</span>
                                        </div>
                                        <div className="p-3 rounded-lg bg-slate-800/20">
                                            <span className="text-[9px] font-bold text-slate-600 uppercase block mb-1">IVA Derivado</span>
                                            <span className="sub-val text-rose-400">{Utils.fmt(previewData[0].iva)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 3. BLOQUE DE TESORERÍA (PAGOS) */}
                            <div className="group-card border-t-2 border-t-violet-500/30">
                                <h3 className="text-xs font-black text-violet-400 uppercase tracking-widest mb-6">Arqueo de Caja (Medios de Pago)</h3>
                                <div className="grid grid-cols-1 gap-4">
                                    <StatCard label="Efectivo" valueKey="val_efectivo" qtyKey="val_efectivo_cantidad" index={0} accent="#a78bfa" size="large" />
                                    <div className="grid grid-cols-2 gap-4">
                                        <StatCard label="Tarjetas" valueKey="val_tarjetas" qtyKey="val_tarjetas_cantidad" index={0} accent="#c084fc" />
                                        <StatCard label="Otros" valueKey="val_otros" qtyKey="val_otros_cantidad" index={0} accent="#e879f9" />
                                    </div>
                                </div>
                                <p className="text-[9px] text-slate-600 mt-6 italic text-center">La suma de estos medios debe coincidir con el total bruto del sistema.</p>
                            </div>
                        </div>

                        {/* 4. BLOQUE OPERATIVO: TURNOS Y CANALES */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="group-card !p-5">
                                <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4">Turnos</h3>
                                <div className="space-y-3">
                                    <StatCard label="Turno AM" valueKey="val_turno_am" qtyKey="val_turno_am_cantidad" index={0} accent="#60a5fa" />
                                    <StatCard label="Turno PM" valueKey="val_turno_pm" qtyKey="val_turno_pm_cantidad" index={0} accent="#60a5fa" />
                                </div>
                            </div>

                            <div className="group-card !p-5 md:col-span-2">
                                <h3 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-4">Canales de Venta / Gestión</h3>
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                    <StatCard label="Salón" valueKey="val_salon" qtyKey="val_salon_cantidad" index={0} accent="#22d3ee" />
                                    <StatCard label="Mostrador" valueKey="val_mostrador" qtyKey="val_mostrador_cantidad" index={0} accent="#22d3ee" />
                                    <StatCard label="Exterior" valueKey="val_exterior" qtyKey="val_exterior_cantidad" index={0} accent="#22d3ee" />
                                    <StatCard label="Producto" valueKey="val_producto" qtyKey="val_producto_cantidad" index={0} accent="#22d3ee" />
                                    <StatCard label="Anulaciones" valueKey="val_anulaciones" index={0} accent="#f43f5e" />
                                </div>
                            </div>
                        </div>

                    </div>
                ) : (
                    /* VISTA TABLA GENERICA (PARA ARCA / CSV) */
                    <div className="overflow-x-auto max-h-[500px] p-0">

                        {/* Herramienta de Corrección Masiva (Solo visible en tablas genéricas) */}
                        <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between sticky left-0">
                            <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Vista Previa de Registros</span>
                            <div className="flex items-center gap-3">
                                <label className="text-xs text-slate-400">¿Fecha incorrecta? Corregir todos:</label>
                                <input
                                    type="date"
                                    className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                                    onChange={(e) => applyDateToAll(e.target.value)}
                                    title="Cambia la fecha de todos los registros listados abajo"
                                />
                            </div>
                        </div>

                        <table className="w-full text-sm text-left text-slate-300">
                            <thead className="text-xs text-slate-400 uppercase bg-slate-900 sticky top-0 shadow-md">
                                <tr>
                                    {previewData.length > 0 && Object.keys(previewData[0]).map((key) => {
                                        // Alineación derecha para columnas numéricas
                                        const isNumericCol = typeof previewData[0][key] === 'number';
                                        return (
                                            <th key={key} className={`px-4 py-3 whitespace-nowrap ${isNumericCol ? 'text-right' : 'text-left'}`}>
                                                {key.replace(/_/g, ' ')}
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {previewData.map((row, index) => (
                                    <tr key={index} className="border-b border-slate-700 hover:bg-slate-700/50 transition">
                                        {Object.keys(row).map((key) => {
                                            const isNumeric = typeof row[key] === 'number';
                                            const isLargeText = key === 'observaciones' || key === 'vendedor_nombre';

                                            return (
                                                <td key={key} className={`px-2 py-2 whitespace-nowrap ${isLargeText ? 'min-w-[300px]' : 'min-w-[120px]'}`}>
                                                    <input
                                                        type={key.includes('fecha') ? 'date' : typeof row[key] === 'number' ? 'number' : 'text'}
                                                        value={row[key]}
                                                        onChange={(e) => handleCellEdit(index, key, e.target.value)}
                                                        className={`bg-transparent border-b border-slate-700/50 hover:border-blue-500 focus:border-blue-500 focus:bg-slate-800 rounded-t px-2 py-1.5 w-full outline-none transition text-slate-200 ${isNumeric ? 'text-right font-mono' : 'text-left'}`}
                                                    />
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="p-6 bg-slate-900/50 border-t border-slate-700 flex justify-end gap-4">
                    <button
                        onClick={() => setPreviewData(null)}
                        className="px-6 py-2.5 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white transition font-medium"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={confirmUpload}
                        className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-900/20 transition flex items-center gap-2"
                    >
                        <span>Confirmar y Guardar</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                    </button>
                </div>
            </div>
        );

        switch (activeTab) {
            case 'dashboard': return loading ? (
                <div className="animate-fade-in space-y-6">
                    <div className="h-32 bg-slate-800/20 rounded-2xl skeleton" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <CardSkeleton />
                        <CardSkeleton />
                        <CardSkeleton />
                    </div>
                </div>
            ) : <DashboardView />;
            case 'empleados': return loading ? <TableSkeleton /> : <EmployeesView />;
            case 'arca': return loading ? <TableSkeleton /> : <ArcaView />;
            case 'ventas': return loading ? <TableSkeleton /> : <VentasSistemaView />;
            case 'honorarios': return loading ? <TableSkeleton /> : <ProfessionalFeesView />;
            case 'estructurales': return loading ? <TableSkeleton /> : <StructuralCostsView />;
            case 'categorias': return <CategoriesView />;
            case 'activos': return <AssetsView />;
            case 'config': return <ConfigView />;
            case 'audit': return <AuditView />;
            case 'guia': return <GuideView />;
            case 'carga': return (
                <div className="space-y-8 animate-fade-in">
                    {/* Hero Section de Carga */}
                    <div className="group-card border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                                <h2 className="text-xl font-bold text-white mb-1">Centro de Importación</h2>
                                <p className="text-sm text-slate-400">Carga PDFs, CSVs o registra datos manuales para el periodo seleccionado.</p>
                            </div>
                            <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50 flex flex-col gap-2 min-w-[240px]">
                                <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Fecha para Cargas Manuales</label>
                                <input
                                    type="date"
                                    value={defaultDate}
                                    onChange={(e) => setDefaultDate(e.target.value)}
                                    className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white font-mono outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Importadores Automáticos */}
                        <div className="md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
                            <FileCard title="Maxirest PDF" type="PDF" onDataReady={(d) => handleDataReady(d, 'MAXIREST')} />
                            <FileCard title="ARCA CSV" type="CSV" onDataReady={(d) => handleDataReady(d, 'ARCA')} />
                            <FileCard title="Sueldos CSV" type="CSV" parserMode="sueldos" defaultDate={defaultDate} onDataReady={(d) => handleDataReady(d, 'SUELDOS')} />
                        </div>

                        {/* Formularios Manuales */}
                        <div className="md:col-span-2 lg:col-span-3">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="h-px flex-1 bg-slate-800"></div>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[.3em]">Cargas Manuales Directas</span>
                                <div className="h-px flex-1 bg-slate-800"></div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {[
                                    { title: 'Honorarios', desc: 'Contadores, Asesores.', color: 'border-indigo-500/30', hover: 'hover:border-indigo-500', action: () => setShowProfModal(true), icon: '💼' },
                                    { title: 'Estructurales', desc: 'Alquiler, Luz, Gas.', color: 'border-blue-500/30', hover: 'hover:border-blue-500', action: () => setShowStructModal(true), icon: '🔧' },
                                    { title: 'Ingresos Brutos', desc: 'IIBB Locales, Convenio.', color: 'border-orange-500/30', hover: 'hover:border-orange-500', action: () => setShowIIBBModal(true), icon: '🏦' },
                                    { title: 'Retenciones', desc: 'IVA, Ganancias Banco.', color: 'border-rose-500/30', hover: 'hover:border-rose-500', action: () => setShowRetModal(true), icon: '🏧' }
                                ].map((card, i) => (
                                    <div
                                        key={i}
                                        onClick={card.action}
                                        className={`p-5 rounded-2xl border ${card.color} bg-slate-900/40 backdrop-blur-sm ${card.hover} cursor-pointer transition-all duration-300 group hover:translate-y--1`}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-2xl opacity-80">{card.icon}</span>
                                            <span className="text-[8px] font-black px-1.5 py-0.5 bg-slate-800 rounded text-slate-400">MANUAL</span>
                                        </div>
                                        <h3 className="font-bold text-slate-100 group-hover:text-white transition-colors">{card.title}</h3>
                                        <p className="text-slate-500 text-[10px] mt-1 pr-2">{card.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            );
            default: return <DashboardView />;
        }
    };

    return (
        <div className="max-w-6xl mx-auto py-8 px-6">

            {/* Cabecera Estilo "Executive Pulse" para TODAS las pestañas */}
            <header className="flex flex-wrap items-center justify-between mb-8 animate-fade-in gap-4">
                <div>
                    <p className="text-[10px] font-bold text-slate-500 tracking-[0.2em] uppercase mb-1">Estado Result · Inteligencia Financiera</p>
                    <h1 className="text-3xl font-extrabold text-white tracking-tight">
                        {activeTab === 'dashboard' ? 'Executive Pulse' : activeTab === 'carga' ? 'Gestión de Carga' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                    </h1>
                </div>

                {/* Botones de Períodos integrados a la derecha */}
                <div className="flex items-center gap-2 bg-slate-900/50 p-1.5 rounded-2xl border border-slate-800">
                    {periodButtons.map(p => {
                        const isSelected = selectedMonth === p.m && String(selectedYear) === p.y;
                        return (
                            <button
                                key={`${p.y}-${p.m}`}
                                onClick={() => { setSelectedYear(p.y); setSelectedMonth(p.m); }}
                                className={`flex flex-col items-center justify-center min-w-[56px] h-10 rounded-xl transition-all duration-300 relative group ${isSelected ? 'bg-blue-600 shadow-lg text-white' : 'hover:bg-slate-800 text-slate-500'
                                    }`}
                            >
                                <span className={`text-[9px] font-black uppercase tracking-tighter ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                                    {p.label}
                                </span>
                                <span className={`text-[8px] font-bold opacity-60 ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                                    {p.yearShort}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </header>

            {/* NAVEGACIÓN PROFESIONAL AGRUPADA */}
            <div className="flex flex-col gap-6 mb-10 animate-fade-in sm:px-4">
                <div className="flex flex-wrap items-center justify-center gap-6 md:gap-8 bg-slate-900/60 backdrop-blur-xl p-6 rounded-[2rem] border border-slate-800/50 shadow-2xl relative overflow-hidden group">
                    {/* Brillo de fondo sutil */}
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-emerald-500/5 pointer-events-none" />

                    {[
                        {
                            title: 'Principal',
                            color: 'text-blue-400',
                            items: [
                                { id: 'dashboard', label: 'Dashboard', icon: '📊' },
                                { id: 'carga', label: 'Carga', icon: '📥' },
                            ]
                        },
                        {
                            title: 'Operativo',
                            color: 'text-emerald-400',
                            items: [
                                { id: 'empleados', label: 'Nómina', icon: '👥' },
                                { id: 'arca', label: 'ARCA', icon: '🧾' },
                                { id: 'ventas', label: 'Ventas', icon: '💰' },
                            ]
                        },
                        {
                            title: 'Gastos',
                            color: 'text-violet-400',
                            items: [
                                { id: 'honorarios', label: 'Honorarios', icon: '💼' },
                                { id: 'estructurales', label: 'Estruct.', icon: '🔧' },
                                { id: 'activos', label: 'Activos', icon: '🏧' },
                            ]
                        },
                        {
                            title: 'Sistema',
                            color: 'text-slate-400',
                            items: [
                                { id: 'categorias', label: 'Categorías', icon: '🏷️' },
                                { id: 'audit', label: 'Historial', icon: '📋' },
                                { id: 'config', label: 'Config', icon: '⚙️' },
                                { id: 'guia', label: 'Ayuda', icon: '📖' },
                            ]
                        }
                    ].map((group, idx) => (
                        <div key={idx} className="flex flex-col gap-2.5">
                            <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${group.color} opacity-40 px-3`}>
                                {group.title}
                            </span>
                            <div className="flex flex-wrap gap-1.5 bg-white/5 p-1.5 rounded-2xl border border-white/5">
                                {group.items.map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => {
                                            setActiveTab(tab.id);
                                            if (tab.id === 'carga') setPreviewData(null);
                                        }}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold transition-all duration-300 ${activeTab === tab.id
                                            ? 'bg-white/10 text-white shadow-lg shadow-white/5 ring-1 ring-white/20'
                                            : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                            }`}
                                    >
                                        <span className="text-sm opacity-80">{tab.icon}</span>
                                        <span>{tab.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* Botón de Refresh flotante / final */}
                    <div className="flex flex-col gap-2.5 ml-auto">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 opacity-40 text-right pr-3">Data</span>
                        <button
                            onClick={() => fetchData(true)}
                            disabled={loading}
                            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[11px] font-bold transition-all border border-blue-500/30 ${loading ? 'bg-blue-600/20 text-blue-400 cursor-not-allowed' : 'bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white shadow-lg shadow-blue-900/20'}`}
                        >
                            {loading ? (
                                <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                <span className="text-base">↻</span>
                            )}
                            <span>{loading ? 'Sincro...' : 'Actualizar'}</span>
                        </button>
                    </div>
                </div>
            </div>

            <main>{renderTabContent()}</main>

            {/* Consola de Logs */}
            <div className="bg-black/50 rounded-lg p-4 text-sm font-mono h-48 overflow-y-auto shadow-inner mt-8 border border-slate-800">
                <p className="text-slate-500 mb-2 border-b border-slate-700 pb-1 text-[10px] uppercase font-black tracking-widest">System Logs</p>
                {logs.length === 0 && <span className="text-slate-600 italic">Esperando acciones...</span>}
                {logs.map((log, i) => (
                    <div
                        key={i}
                        className={`mb-1 ${log.includes('❌') ? 'text-red-400' : log.includes('✅') ? 'text-green-400' : 'text-slate-300'}`}
                    >
                        {log}
                    </div>
                ))}
            </div>

            {/* Modales */}
            <ProfessionalFeesModal
                isOpen={showProfModal}
                onClose={() => setShowProfModal(false)}
                onConfirm={(data) => sendToBackend(data, 'MANUAL_COSTS')}
                defaultDate={defaultDate}
            />
            <StructuralCostsModal
                isOpen={showStructModal}
                onClose={() => setShowStructModal(false)}
                onConfirm={(data) => sendToBackend(data, 'MANUAL_COSTS')}
                defaultDate={defaultDate}
            />
            <IIBBModal
                isOpen={showIIBBModal}
                onClose={() => setShowIIBBModal(false)}
                onConfirm={(data) => sendToBackend(data, 'MANUAL_COSTS')}
                defaultDate={defaultDate}
            />
            <RetentionsModal
                isOpen={showRetModal}
                onClose={() => setShowRetModal(false)}
                onConfirm={(data) => sendToBackend(data, 'MANUAL_COSTS')}
                defaultDate={defaultDate}
            />
        </div>
    );
};

export default App;
