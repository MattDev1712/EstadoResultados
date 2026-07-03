import React, { useState, useEffect, useCallback } from 'react';
import { useFinance } from './FinanceContext';
import { supabase } from './supabaseClient';
import FileCard from './FileCard';

const FILE_HELP = {
    ventas: {
        title: '¿Qué es este archivo?',
        body: `Es el resumen mensual que exporta tu sistema de ventas (Maxirest): cuánto facturaste en el mes y con qué medio de pago (efectivo, tarjeta, etc.).\n\n¿Dónde lo consigo? Dentro de Maxirest buscá la opción para exportar o imprimir el cierre del mes en PDF. Si no la encontrás, preguntale a quien te instaló o te da soporte del sistema.\n\n¿Qué hace la herramienta con él? Lee el PDF automáticamente y separa cuánto facturaste con Factura A, Factura B y por cada medio de pago — de ahí sale el IVA que cobraste ese mes.`
    },
    compras: {
        title: '¿Qué es este archivo?',
        body: `Es el listado de las facturas que te hicieron tus proveedores, registrado en tu cuenta de ARCA (el ex-AFIP). Ahí figura el IVA que vos pagaste al comprar — eso es tu "crédito fiscal", la parte que se descuenta del IVA que cobraste vendiendo.\n\n¿Dónde lo consigo? Entrá a tu cuenta de ARCA con tu Clave Fiscal, buscá el servicio de comprobantes ("Mis Comprobantes" o similar) y exportá el listado de comprobantes recibidos del período en CSV.\n\nSi tenés contador, es probable que él ya tenga ese acceso y te lo pueda pasar directamente.`
    },
    empleados: {
        title: '¿Qué es este archivo?',
        body: `Es el detalle de lo que le pagaste a tus empleados este mes: sueldo en blanco (el del recibo) y, si corresponde, lo pagado en mano.\n\n¿Dónde lo consigo? Te lo pasa quien te liquida los sueldos — tu contador o estudio contable — normalmente en Excel o CSV.\n\n¿No tenés el archivo a mano? Usá el botón "Carga Simple" arriba a la derecha de esta card: cargás el total pagado y la cantidad de empleados, y la herramienta calcula el resto.`
    },
};

const TABLES = [
    { key: 'ventas', label: 'Ventas (Maxirest)', dateCol: 'fecha' },
    { key: 'compras', label: 'Compras (ARCA)', dateCol: 'fecha' },
    { key: 'empleados', label: 'Sueldos', dateCol: 'fecha_periodo' },
    { key: 'costos_manuales', label: 'Costos Manuales', dateCol: 'fecha' },
];

const CargaDatosView = ({ onDataReady, setShowStructModal, setShowRetentionsModal, defaultDate }) => {
    const { selectedYear, selectedMonth, configData, fetchData, invalidateCache } = useFinance();
    const [periodCounts, setPeriodCounts] = useState({});
    const [deleteTarget, setDeleteTarget] = useState(null); // { key, label, dateCol, count }
    const [deleting, setDeleting] = useState(false);
    const [manualHelp, setManualHelp] = useState(null); // { title, body }

    const y = parseInt(selectedYear);
    const m = parseInt(selectedMonth);
    const start = `${selectedYear}-${selectedMonth}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const end = `${selectedYear}-${selectedMonth}-${String(lastDay).padStart(2, '0')}`;

    const loadCounts = useCallback(async () => {
        const counts = {};
        await Promise.all(TABLES.map(async (t) => {
            const { count } = await supabase
                .from(t.key)
                .select('id', { count: 'exact', head: true })
                .gte(t.dateCol, start)
                .lte(t.dateCol, end);
            counts[t.key] = count || 0;
        }));
        setPeriodCounts(counts);
    }, [start, end]);

    useEffect(() => { loadCounts(); }, [loadCounts]);

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        const { error } = await supabase
            .from(deleteTarget.key)
            .delete()
            .gte(deleteTarget.dateCol, start)
            .lte(deleteTarget.dateCol, end);

        if (!error) {
            invalidateCache(selectedYear, selectedMonth);
            fetchData(true);
            loadCounts();
        }
        setDeleting(false);
        setDeleteTarget(null);
    };

    const totalRecords = Object.values(periodCounts).reduce((a, b) => a + b, 0);

    return (
        <div className="animate-fade-in py-4">
            <div className="mb-8 p-8 rounded-[2.5rem] bg-slate-900/40 border border-slate-800 relative overflow-hidden shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-emerald-500/10 pointer-events-none"></div>
                
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10 mb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest border border-emerald-500/30">
                                Importación de Datos
                            </span>
                        </div>
                        <h2 className="text-3xl font-black text-white tracking-tight">Carga de archivos</h2>
                        <p className="text-slate-400 mt-1">Arrastrá los reportes de tus sistemas para procesar el mes</p>
                    </div>

                    <div className="flex flex-col items-end bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-3xl min-w-[200px]">
                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1">Período de Destino</span>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-black text-white uppercase tracking-tighter">
                                {new Date(selectedYear, parseInt(selectedMonth) - 1).toLocaleDateString('es-AR', { month: 'long' })}
                            </span>
                            <span className="text-2xl font-light text-slate-500">{selectedYear}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1 italic">Los datos se imputarán a este mes</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 relative z-10">
                    <FileCard title="Sistema de Ventas (Maxirest PDF)" type="PDF" alicuotaIva={configData?.alicuota_iva ?? 0.21} onDataReady={(d) => onDataReady && onDataReady(d, 'MAXIREST')} help={FILE_HELP.ventas} />
                    <FileCard title="Facturas de AFIP/ARCA (CSV)" type="CSV" onDataReady={(d) => onDataReady && onDataReady(d, 'ARCA')} help={FILE_HELP.compras} />
                    <FileCard title="Planilla de Sueldos (CSV)" type="CSV" parserMode="sueldos" defaultDate={defaultDate} onDataReady={(d) => onDataReady && onDataReady(d, 'SUELDOS')} help={FILE_HELP.empleados} />
                </div>

                <div className="border-t border-white/5 pt-8 relative z-10">
                    <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-black mb-4">Carga manual de gastos y ajustes</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            {
                                title: 'Gastos fijos del local', desc: 'Alquiler, luz, gas, expensas', color: 'border-blue-500/30', hover: 'hover:border-blue-500', action: () => setShowStructModal && setShowStructModal(true), icon: '🏢',
                                help: 'Los gastos fijos son los que pagás todos los meses exista o no una sola venta: alquiler, luz, gas, expensas, internet.\n\nSi ya tenés la factura cargada en "Facturas de AFIP/ARCA" y la marcaste como "Gasto Fijo" en Categorías, no hace falta cargarla acá de nuevo — esto es para sumar gastos que no tienen factura de ARCA o que preferís cargar a mano.'
                            },
                            {
                                title: 'Retenciones del mes', desc: 'IVA/Ganancias en tarjetas y apps', color: 'border-amber-500/30', hover: 'hover:border-amber-500', action: () => setShowRetentionsModal && setShowRetentionsModal(true), icon: '🏧',
                                help: 'Cuando cobrás con tarjeta o por apps de delivery, el banco o la app a veces te retiene una parte de IVA o Ganancias antes de depositarte el resto. Esa plata retenida ya es un pago a cuenta de tus impuestos.\n\nCargala acá para que la herramienta la reste de lo que le debés a AFIP este mes — si no la cargás, el sistema te va a mostrar un monto a pagar más alto del real.\n\n¿Dónde lo consigo? Lo ves en la liquidación o resumen que te manda el banco o la app junto con el depósito.'
                            },
                        ].map((card, i) => (
                            <div key={i} className={`p-5 rounded-[1.5rem] border ${card.color} bg-slate-900/60 backdrop-blur-sm ${card.hover} transition-all duration-300 group hover:-translate-y-1 shadow-lg`}>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-2xl opacity-80">{card.icon}</span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setManualHelp({ title: card.title, body: card.help })}
                                            title="¿Qué es esto?"
                                            className="w-5 h-5 rounded-full border border-slate-600 text-slate-400 hover:text-blue-400 hover:border-blue-500/50 flex items-center justify-center text-[10px] font-bold transition-all flex-shrink-0"
                                        >?</button>
                                        <span onClick={card.action} className="cursor-pointer text-[8px] font-black px-2 py-1 bg-slate-800 rounded-full text-slate-400 group-hover:bg-blue-500/20 group-hover:text-blue-300 transition-colors">+ AGREGAR</span>
                                    </div>
                                </div>
                                <div onClick={card.action} className="cursor-pointer">
                                    <h3 className="font-bold text-slate-200 group-hover:text-white transition-colors text-sm">{card.title}</h3>
                                    <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{card.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* BORRAR DATOS DEL PERIODO */}
                {totalRecords > 0 && (
                    <div className="border-t border-white/5 pt-8 mt-8 relative z-10">
                        <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-black mb-4">Datos cargados en este periodo</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {TABLES.map(t => {
                                const count = periodCounts[t.key] || 0;
                                if (count === 0) return null;
                                return (
                                    <div key={t.key} className="flex items-center justify-between p-4 rounded-xl bg-slate-900/60 border border-slate-700/30">
                                        <div>
                                            <p className="text-xs font-bold text-slate-300">{t.label}</p>
                                            <p className="text-[10px] text-slate-500 mt-0.5">{count} registros</p>
                                        </div>
                                        <button
                                            onClick={() => setDeleteTarget({ ...t, count })}
                                            className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg border border-red-500/20 text-red-400/70 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/40 transition-all"
                                        >
                                            Borrar
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL CONFIRMACION DE BORRADO */}
            {deleteTarget && (
                <div className="fixed inset-0 z-[110] flex justify-center items-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl border border-red-500/30 w-full max-w-md animate-fade-in">
                        <div className="p-6 border-b border-red-500/20 bg-red-500/5">
                            <div className="flex items-center gap-3">
                                <span className="w-10 h-10 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-lg font-black ring-1 ring-red-500/30">!</span>
                                <div>
                                    <h3 className="text-lg font-bold text-[var(--text-primary)]">Confirmar borrado</h3>
                                    <p className="text-sm text-red-400 mt-1">
                                        Se van a eliminar <strong>{deleteTarget.count}</strong> registros de <strong>{deleteTarget.label}</strong> del periodo {selectedMonth}/{selectedYear}.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-[var(--text-muted)] mb-6">
                                Esta accion no se puede deshacer. Los datos se eliminan de la base de datos y el dashboard se recalcula automaticamente.
                            </p>
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    className="w-full px-4 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {deleting ? 'Borrando...' : `Eliminar ${deleteTarget.count} registros`}
                                </button>
                                <button
                                    onClick={() => setDeleteTarget(null)}
                                    disabled={deleting}
                                    className="w-full px-4 py-3 rounded-xl border border-[var(--border-mid)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] font-medium transition"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE AYUDA (cards manuales) */}
            {manualHelp && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/40 backdrop-blur-md p-4" onClick={() => setManualHelp(null)}>
                    <div className="bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-card)] w-full max-w-md rounded-[2rem] shadow-[0_0_50px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                            <h3 className="text-lg font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-3">
                                <span className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-black ring-1 ring-blue-500/30">?</span>
                                {manualHelp.title}
                            </h3>
                            <button onClick={() => setManualHelp(null)} className="text-[var(--text-dim)] hover:text-[var(--text-primary)] w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/5 active:scale-90 transition-all">✕</button>
                        </div>
                        <div className="p-6 overflow-y-auto scrollbar-hide text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                            {manualHelp.body}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CargaDatosView;