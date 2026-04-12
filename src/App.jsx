import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useFinance } from './FinanceContext';
import { formatters as Utils } from './formatters'; // Asumo que tienes un archivo formatters.js con Utils

// Componentes de Vista
import DashboardView from './DashboardView';
import EmployeesView from './EmployeesView';
import ArcaView, { StructuralCostsView, RetentionsView } from './ArcaView';
import VentasSistemaView from './VentasSistemaView';
import GuideView from './GuideView';
import CategoriesView from './CategoriesView';
import ConfigView from './ConfigView';
import AuditView from './AuditView';
import { CardSkeleton, TableSkeleton } from './Skeleton';
import MarginExpectationView from './MarginExpectationView';
import RetentionsModal from './RetentionsModal';

// Componentes Comunes
import FileCard from './FileCard';
import StructuralCostsModal from './StructuralCostsModal';
import NavDropdown from './components/NavDropdown';

const App = () => {
    const {
        apiUrl, setApiUrl, refreshAll, loading, setLoading,
        selectedYear, setSelectedYear,
        selectedMonth, setSelectedMonth,
        availablePeriods, cargasPct, setCargasPct,
        dashData, empData, arcaData, ventasData,
        fetchData, fetchMetadata
    } = useFinance();

    // --- Lógica de Sincronización Automática (Tiempo Real) ---
    // Esto permite que si otro usuario carga datos en otro lugar del mundo,
    // la información se actualice aquí automáticamente sin tocar el botón de refresco.
    useEffect(() => {
        if (!apiUrl) return;

        // Polling cada 30 segundos para chequear cambios en Sheets
        const interval = setInterval(() => {
            // Solo disparamos si no estamos ya cargando algo para evitar colisiones
            if (!loading) {
                refreshAll(); 
            }
        }, 30000); 

        return () => clearInterval(interval);
    }, [apiUrl, loading, refreshAll]);

    // Generar botones de periodos (últimos 9 meses)
    const periodButtons = useMemo(() => {
        const periods = [];
        const now = new Date();
        for (let i = 8; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const y = String(d.getFullYear());
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const periodId = `${y}-${m}`;

            const meta = (availablePeriods || []).find(ap => ap.id === periodId);

            periods.push({
                y,
                m,
                label: d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', ''),
                yearShort: d.toLocaleDateString('es-AR', { year: '2-digit' }),
                isComplete: meta?.isComplete || false,
                score: meta?.score || 0
            });
        }
        return periods;
    }, [availablePeriods]);

    const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') !== 'light');

    useEffect(() => {
        document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }, [isDark]);

    const [activeTab, setActiveTab] = useState('iva_dashboard');
    const [showStructModal, setShowStructModal] = useState(false);
    const [showRetentionsModal, setShowRetentionsModal] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [previewOrigen, setPreviewOrigen] = useState(null);
    const [defaultDate, setDefaultDate] = useState(new Date().toISOString().split('T')[0]);
    const [logs, setLogs] = useState([]);
    const [showLogs, setShowLogs] = useState(false);

    const TAB_TITLES = {
        iva_dashboard: 'Situación IVA',
        margin_dashboard: 'Expectativa de Margen',
        empleados: 'Mi Equipo',
        arca: 'Mis Compras',
        ventas: 'Mis Ventas',
        estructurales: 'Gastos Fijos',
        retenciones: 'Retenciones Impositivas',
        config: 'Ajustes del Sistema',
        audit: 'Registro de Cambios',
        guia: 'Ayuda y Guía',
        categorias: 'Categorización de Gastos'
    };

    const addLog = (msg) => {
        const time = new Date().toLocaleTimeString();
        setLogs(prev => [`[${time}] ${msg}`, ...prev]);
    };

    useEffect(() => {
        fetchMetadata();
    }, [activeTab, fetchMetadata, selectedYear, selectedMonth]);

    useEffect(() => {
        if (selectedYear && selectedMonth) {
            setDefaultDate(`${selectedYear}-${selectedMonth}-01`);
        }
    }, [selectedYear, selectedMonth]);


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
                // Sincronización total inmediata tras el guardado
                fetchMetadata();
                fetchData(true);
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

    const renderPreviewModal = () => {
        if (!previewData) return null;
        return (
            <div className="fixed inset-0 z-[100] flex justify-center items-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-[var(--bg-card)] rounded-xl shadow-2xl border border-[var(--border-card)] w-full max-w-6xl max-h-[90vh] flex flex-col animate-fade-in relative z-[101]">
                <div className="p-6 border-b border-[var(--border-card)] flex justify-between items-center bg-[var(--bg-surface)] flex-shrink-0">
                        <div>
                        <h2 className="text-xl font-bold text-[var(--text-primary)]">Verificar y Editar Datos</h2>
                        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mt-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-400" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                            <span>Haz clic en los valores para corregir antes de guardar.</span>
                        </div>
                    </div>
                    <span className="bg-blue-900 text-blue-200 text-xs font-bold px-3 py-1 rounded uppercase">{previewOrigen}</span>
                </div>

                {/* VISTA ESPECIAL PARA MAXIREST */}
                {previewOrigen === 'MAXIREST' ? (
                    <div className="p-8 space-y-8 bg-[var(--bg-page)]/50">

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
                                <p className="text-[var(--text-dim)] text-[10px] mt-2 italic">Este es el valor final que impactará en tu Dashboard.</p>
                            </div>

                            <div className="w-px h-12 bg-[var(--border-subtle)] hidden md:block"></div>

                            <div className="flex flex-col items-end">
                                <span className="section-label text-[var(--text-dim)]">Fecha del Cierre</span>
                                <input
                                    type="date"
                                    value={previewData[0]['fecha']}
                                    onChange={(e) => handleCellEdit(0, 'fecha', e.target.value)}
                                    className="bg-[var(--bg-surface)] border border-[var(--border-mid)] rounded-lg px-4 py-2 mt-1 text-[var(--text-primary)] font-mono focus:ring-2 focus:ring-emerald-500 outline-none transition"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* 2. BLOQUE FISCAL */}
                            <div className="group-card border-t-2 border-t-orange-500/30">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-xs font-black text-orange-400 uppercase tracking-widest">Configuración Fiscal</h3>
                                    <div className="tooltip-trigger">
                                        <span className="w-5 h-5 rounded-full border border-[var(--border-mid)] text-[var(--text-dim)] flex items-center justify-center text-[10px] font-bold cursor-help">?</span>
                                        <div className="tooltip-box">Solo la Factura B Electrónica genera IVA (21%). La Factura B manual se considera exenta. El Neto se calcula proporcionalmente.</div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <StatCard label="Factura B Electrónica" valueKey="val_factura_b_elec" qtyKey="val_factura_b_elec_cantidad" index={0} accent="#fb923c" size="large" />
                                    <StatCard label="Factura B (Exenta)" valueKey="val_factura_b" qtyKey="val_factura_b_cantidad" index={0} accent="#f97316" size="large" />

                                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
                                        <div className="p-3 rounded-lg bg-[var(--bg-surface)]">
                                            <span className="text-[9px] font-bold text-[var(--text-faint)] uppercase block mb-1">Neto Derivado</span>
                                            <span className="sub-val text-[var(--text-secondary)]">{Utils.fmt(previewData[0].neto)}</span>
                                        </div>
                                        <div className="p-3 rounded-lg bg-[var(--bg-surface)]">
                                            <span className="text-[9px] font-bold text-[var(--text-faint)] uppercase block mb-1">IVA Derivado</span>
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
                                <p className="text-[9px] text-[var(--text-faint)] mt-6 italic text-center">La suma de estos medios debe coincidir con el total bruto del sistema.</p>
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
                    <div className="overflow-x-auto overflow-y-auto flex-1 p-0">

                        {/* Herramienta de Corrección Masiva (Solo visible en tablas genéricas) */}
                        <div className="px-4 py-3 bg-[var(--bg-card)] border-b border-[var(--border-card)] flex items-center justify-between sticky left-0">
                            <span className="text-xs text-[var(--text-dim)] uppercase font-bold tracking-wider">Vista Previa de Registros</span>
                            <div className="flex items-center gap-3">
                                <label className="text-xs text-[var(--text-muted)]">¿Fecha incorrecta? Corregir todos:</label>
                                <input
                                    type="date"
                                    className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                                    onChange={(e) => applyDateToAll(e.target.value)}
                                    title="Cambia la fecha de todos los registros listados abajo"
                                />
                            </div>
                        </div>

                        <table className="w-full text-sm text-left text-[var(--text-secondary)]">
                            <thead className="text-xs text-[var(--text-muted)] uppercase bg-[var(--bg-page)] sticky top-0 shadow-md">
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
                                    <tr key={index} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] transition">
                                        {Object.keys(row).map((key) => {
                                            const isNumeric = typeof row[key] === 'number';
                                            const isLargeText = key === 'observaciones' || key === 'vendedor_nombre';

                                            return (
                                                <td key={key} className={`px-2 py-2 whitespace-nowrap ${isLargeText ? 'min-w-[300px]' : 'min-w-[120px]'}`}>
                                                    <input
                                                        type={key.includes('fecha') ? 'date' : typeof row[key] === 'number' ? 'number' : 'text'}
                                                        value={row[key]}
                                                        onChange={(e) => handleCellEdit(index, key, e.target.value)}
                                                        className={`bg-transparent border-b border-[var(--border-mid)]/30 hover:border-blue-500 focus:border-blue-500 focus:bg-[var(--bg-surface)] rounded-t px-2 py-1.5 w-full outline-none transition text-[var(--text-primary)] ${isNumeric ? 'text-right font-mono' : 'text-left'}`}
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

                <div className="p-6 bg-[var(--bg-surface)] border-t border-[var(--border-card)] flex justify-end gap-4 flex-shrink-0">
                    <button
                        onClick={() => setPreviewData(null)}
                        className="px-6 py-2.5 rounded-lg border border-[var(--border-mid)] text-[var(--text-secondary)] hover:bg-[var(--bg-page)] transition font-medium"
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
            </div>
        );
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'iva_dashboard':
            case 'dashboard': return (loading && !dashData) ? (
                <div className="animate-fade-in space-y-6">
                    <div className="h-32 bg-slate-800/20 rounded-2xl skeleton" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <CardSkeleton />
                        <CardSkeleton />
                        <CardSkeleton />
                    </div>
                </div>
            ) : <DashboardView 
                    onDataReady={handleDataReady} 
                    setShowStructModal={setShowStructModal} 
                    setShowRetentionsModal={setShowRetentionsModal}
                    defaultDate={defaultDate}
                    setDefaultDate={setDefaultDate}
                />;
            case 'margin_dashboard': return <MarginExpectationView />;
            case 'empleados': return (loading && empData.length === 0) ? <TableSkeleton /> : <EmployeesView />;
            case 'arca': return (loading && arcaData.length === 0) ? <TableSkeleton /> : <ArcaView />;
            case 'ventas': return (loading && ventasData.length === 0) ? <TableSkeleton /> : <VentasSistemaView />;

            case 'estructurales': return (loading && arcaData.length === 0) ? <TableSkeleton /> : <StructuralCostsView />;
            case 'retenciones': return (loading && arcaData.length === 0) ? <TableSkeleton /> : <RetentionsView />;
            case 'config': return <ConfigView />;
            case 'categorias': return <CategoriesView />;
            case 'audit': return <AuditView />;
            case 'guia': return <GuideView />;
            default: return <DashboardView 
                    onDataReady={handleDataReady} 
                    setShowStructModal={setShowStructModal} 
                    defaultDate={defaultDate}
                    setDefaultDate={setDefaultDate}
                />;
        }
    };


    return (
        <div className="max-w-6xl mx-auto py-6 px-4">

            {/* Cabecera Centrada y Refinada */}
            <header className="flex flex-col items-center mb-8 animate-fade-in text-center">
                <div className="mb-6">
                    <p className="text-[10px] font-black tracking-[0.3em] uppercase mb-1" style={{ color: 'var(--text-dim)' }}>
                        Sistema de Gestión Administrativa
                    </p>
                    <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
                        {TAB_TITLES[activeTab] || 'Panel de Control'}
                    </h1>
                </div>

                {/* Selector de Meses Centrado */}
                <div className="flex items-center gap-2 p-2 bg-[var(--bg-surface)] backdrop-blur-xl rounded-2xl border border-[var(--border-card)] shadow-lg no-scrollbar overflow-x-auto max-w-full">
                    {periodButtons.map(p => {
                        const isSelected = selectedMonth === p.m && String(selectedYear) === p.y;
                        const score = p.score;

                        const scoreColors = [
                            'border-slate-800 text-slate-500 hover:bg-slate-800/50',
                            'border-rose-900/20 text-rose-400/80 bg-rose-500/5 hover:bg-rose-500/10',
                            'border-orange-900/20 text-orange-400/80 bg-orange-500/5 hover:bg-orange-500/10',
                            'border-lime-900/20 text-lime-400/80 bg-lime-500/5 hover:bg-lime-500/10',
                            'border-emerald-900/20 text-emerald-400/80 bg-emerald-500/5 hover:bg-emerald-500/10',
                        ];

                        return (
                            <button
                                key={`${p.y}-${p.m}`}
                                onClick={() => { setSelectedYear(p.y); setSelectedMonth(p.m); }}
                                className={`
                                    flex flex-col items-center justify-center min-w-[68px] h-14 rounded-xl transition-all duration-300 relative group border
                                    ${isSelected
                                        ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-900/40 z-10 scale-105'
                                        : scoreColors[score]
                                    }
                                `}
                            >
                                <span className="text-xs font-black uppercase tracking-tight">{p.label}</span>
                                <span className={`text-[9px] font-bold opacity-50 ${isSelected ? 'text-white' : ''}`}>{p.yearShort}</span>

                                {score > 0 && !isSelected && (
                                    <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-950 ${score === 4 ? 'bg-emerald-500' : score === 3 ? 'bg-lime-500' : 'bg-orange-500'}`} />
                                )}
                            </button>
                        );
                    })}
                </div>
            </header>

            {/* NAVEGACIÓN POR DESPLEGABLES (CENTRADA) */}
            <nav className="flex flex-wrap items-center justify-center gap-3 mb-12 animate-fade-in">
                <NavDropdown 
                    title="Tableros" icon="📊" activeTab={activeTab} setActiveTab={setActiveTab}
                    items={[
                        { id: 'iva_dashboard', label: 'Situación IVA', icon: '📊' },
                        { id: 'margin_dashboard', label: 'Expectativa Margen', icon: '📈' },
                    ]}
                />

                <NavDropdown 
                    title="Datos" icon="👥" activeTab={activeTab} setActiveTab={setActiveTab}
                    items={[
                        { id: 'empleados', label: 'Mi Equipo', icon: '👥' },
                        { id: 'arca', label: 'Mis Compras', icon: '🧾' },
                        { id: 'ventas', label: 'Mis Ventas', icon: '💰' },
                        { id: 'retenciones', label: 'Retenciones', icon: '🏧' },
                        { id: 'estructurales', label: 'Gastos Fijos', icon: '🏢' },
                        { id: 'categorias', label: 'Categorías', icon: '🏷️' },
                    ]}
                />

                <NavDropdown 
                    title="Admin" icon="⚙️" activeTab={activeTab} setActiveTab={setActiveTab}
                    items={[
                        { id: 'audit', label: 'Registro de Cambios', icon: '📋' },
                        { id: 'config', label: 'Ajustes de Sistema', icon: '⚙️' },
                        { id: 'guia', label: 'Guía de Ayuda', icon: '📖' },
                    ]}
                />

                <div className="w-px h-6 bg-white/10 mx-2 hidden sm:block"></div>

                <button
                    onClick={() => setIsDark(v => !v)}
                    title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                    className="flex items-center justify-center w-9 h-9 rounded-xl transition-all border border-slate-700/30 text-slate-400 hover:bg-slate-700 hover:text-white"
                >
                    {isDark ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                        </svg>
                    )}
                </button>

                <button
                    onClick={() => refreshAll()}
                    disabled={loading}
                    className={`flex items-center justify-center w-9 h-9 rounded-xl transition-all border ${
                        loading 
                        ? 'bg-blue-600/20 text-blue-400 border-blue-500/30' 
                        : 'bg-blue-600/10 text-blue-400 border-blue-500/30 hover:bg-blue-600 hover:text-white'
                    }`}
                >
                    {loading ? (
                        <svg className="animate-spin h-3.5 w-3.5 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : '↻'}
                </button>
            </nav>

            <main>{renderTabContent()}</main>

            {/* PREVIEW MODAL */}
            {renderPreviewModal()}

            {/* Consola de Logs — colapsable */}
            <div className="mt-8">
                <button
                    onClick={() => setShowLogs(v => !v)}
                    className="flex items-center gap-2 text-[10px] text-slate-600 hover:text-slate-400 transition font-bold uppercase tracking-widest"
                >
                    <span className={`transition-transform ${showLogs ? 'rotate-90' : ''}`}>▶</span>
                    {showLogs ? 'Ocultar detalle técnico' : 'Ver detalle técnico'}
                    {logs.some(l => l.includes('❌')) && (
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    )}
                </button>
                {showLogs && (
                    <div className="bg-black/50 rounded-lg p-4 text-sm font-mono h-48 overflow-y-auto shadow-inner mt-2 border border-slate-800 animate-fade-in">
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
                )}
            </div>

            <StructuralCostsModal
                isOpen={showStructModal}
                onClose={() => setShowStructModal(false)}
                onConfirm={(data) => sendToBackend(data, 'MANUAL_COSTS')}
                defaultDate={defaultDate}
            />
            <RetentionsModal
                isOpen={showRetentionsModal}
                onClose={() => setShowRetentionsModal(false)}
                onConfirm={(data) => sendToBackend(data, 'MANUAL_COSTS')}
                defaultDate={defaultDate}
            />
        </div>
    );
};

export default App;
