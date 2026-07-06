import React, { useState, useEffect } from 'react';
import { useFinance } from './FinanceContext';
import { formatters as Utils } from './formatters';
import { PctInput } from './components/Inputs';
import { supabase } from './supabaseClient';

// Últimos N meses (más viejo -> más nuevo), relativo a hoy
const getLastMonths = (n) => {
    const now = new Date();
    const periods = [];
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        periods.push({
            y: String(d.getFullYear()),
            m: String(d.getMonth() + 1).padStart(2, '0'),
            label: d.toLocaleDateString('es-AR', { month: 'long' }).replace(/^\p{L}/u, c => c.toUpperCase()),
            yearShort: d.toLocaleDateString('es-AR', { year: '2-digit' }),
        });
    }
    return periods;
};

// Toma la data cruda de un período (fetchPeriodData) + el borrador de Mix/MGN editado en pantalla
// y arma el mismo ledger que usa "Expectativa de Margen": Sueldos + Gastos Fijos + Excepcionales
// vs. margen de contribución (Mix % x Venta Neta, MGN % sobre ese mix).
const computePeriodRow = (raw, draft) => {
    const n = Utils.num;
    const kpis = raw?.dash?.kpis || {};
    const egresos = raw?.dash?.egresos || {};
    const manualStored = raw?.dash?.estado_result_manual || {};
    const emp = raw?.emp || [];
    const arca = raw?.arca || [];
    const ventas = raw?.ventas || [];

    const isEmpty = n(kpis.venta_bruta) === 0 && emp.length === 0 && arca.length === 0 && ventas.length === 0;
    if (isEmpty) return { isEmpty: true };

    const ventaBruta = n(kpis.venta_bruta);
    const ivaDebito = n(kpis.iva_debito);
    const ventaNeta = n(kpis.ventas_netas_reales);
    const cantOps = n(kpis.cant_operaciones);
    const ticketProm = cantOps > 0 ? ventaBruta / cantOps : 0;

    const mixCafePct = n(draft ? draft.mix_cafe : manualStored.mix_cafe);
    const mgnCafePct = n(draft ? draft.mgn_cafe : manualStored.mgn_cafe);
    const mgnProductoPct = n(draft ? draft.mgn_producto : manualStored.mgn_producto);
    const mixProductoPct = Number((100 - Math.min(100, Math.max(0, mixCafePct))).toFixed(1));

    const ventaCafe = (mixCafePct / 100) * ventaNeta;
    const ventaProducto = (mixProductoPct / 100) * ventaNeta;
    const margenCafePesos = (mgnCafePct / 100) * ventaCafe;
    const margenProductoPesos = (mgnProductoPct / 100) * ventaProducto;

    const laboralEfectivo = n(egresos.laboral) > 0
        ? n(egresos.laboral)
        : emp.reduce((acc, e) => acc + n(e.recibo) + n(e.negro), 0);
    const sueldosTotal = laboralEfectivo + n(egresos.provision_sac) + n(egresos.provision_cargas);
    const cantEmpleados = emp.length;
    const promedioEmp = cantEmpleados > 0 ? laboralEfectivo / cantEmpleados : 0;
    const operaciones = n(egresos.estructural);
    const excepcionales = n(manualStored.excepcionales);

    const totalGastos = sueldosTotal + operaciones + excepcionales;
    const resultado = margenCafePesos + margenProductoPesos - totalGastos;

    const pctOf = (v) => totalGastos > 0 ? (v / totalGastos) * 100 : 0;

    const sinEmpleados = emp.length === 0;
    const sinGastosFijos = arca.length === 0;

    return {
        isEmpty: false,
        ventaBruta, ivaDebito, ventaNeta, cantOps, ticketProm,
        ventaCafe, mixCafePct, margenCafePesos, mgnCafePct,
        ventaProducto, mixProductoPct, margenProductoPesos, mgnProductoPct,
        operaciones, operacionesPct: pctOf(operaciones), sinGastosFijos,
        sueldosTotal, sueldosPct: pctOf(sueldosTotal), sinEmpleados,
        cantEmpleados, promedioEmp,
        excepcionales, excepcionalesPct: pctOf(excepcionales),
        totalGastos, resultado,
        incompleto: sinEmpleados || sinGastosFijos,
    };
};

// Tag chico para marcar que ese renglón no tiene fuente de datos cargada este período
// (distinto de "$0 real" — acá directamente no hay Empleados o Compras/Costos cargados).
const SinDatosTag = () => (
    <span className="text-[8px] font-black uppercase tracking-wide text-amber-500 bg-amber-500/10 border border-amber-500/25 rounded px-1.5 py-0.5">
        Sin datos
    </span>
);

const Cell = ({ row, field, pctField, isInt, isEmpty, warnField }) => {
    if (isEmpty) return <td className="px-4 py-2.5 text-center text-[var(--text-dim)] text-sm">—</td>;
    if (warnField && row[warnField]) {
        return (
            <td className="px-4 py-2.5 text-center">
                <div className="flex flex-col items-center gap-1">
                    <SinDatosTag />
                    <div className="text-[10px] font-bold text-[var(--text-dim)] tabular-nums">
                        {isInt ? Math.round(row[field]).toLocaleString('es-AR') : Utils.fmt(row[field])}
                    </div>
                </div>
            </td>
        );
    }
    const val = row[field];
    return (
        <td className="px-4 py-2.5 text-center">
            <div className="text-sm font-bold text-[var(--text-primary)] tabular-nums">
                {isInt ? Math.round(val).toLocaleString('es-AR') : Utils.fmt(val)}
            </div>
            {pctField !== undefined && (
                <div className="text-[10px] font-bold text-[var(--text-dim)] tabular-nums mt-0.5">
                    {row[pctField].toFixed(1)}%
                </div>
            )}
        </td>
    );
};

const SectionHeader = ({ label, colSpan }) => (
    <tr>
        <td colSpan={colSpan} className="px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-amber-500 bg-amber-500/10 border-y border-amber-500/20">
            {label}
        </td>
    </tr>
);

const DataRow = ({ label, periods, field, pctField, isInt, tone, warnField }) => (
    <tr className={`border-b border-[var(--border-card)] ${tone === 'ventas' ? 'bg-emerald-500/[0.04]' : tone === 'gastos' ? 'bg-white/[0.02]' : ''}`}>
        <td className="sticky left-0 z-10 px-4 py-2.5 text-xs font-bold text-[var(--text-muted)] bg-[var(--bg-card)] border-r border-[var(--border-card)] whitespace-nowrap">
            {label}
        </td>
        {periods.map(p => (
            <Cell key={p.periodId} row={p.row} field={field} pctField={pctField} isInt={isInt} isEmpty={p.row.isEmpty} warnField={warnField} />
        ))}
    </tr>
);

// Fila con input editable de % (Mix Cafetería / MGN Cafetería / MGN Producto)
// Jerarquía: el resultado en pesos es el dato principal (arriba, grande);
// el % es el control de edición (abajo, chico y apagado).
const EditableRow = ({ label, periods, draftField, valueField, drafts, onDraftChange }) => (
    <tr className="bg-emerald-500/[0.04] border-b border-[var(--border-card)]">
        <td className="sticky left-0 z-10 px-4 py-2.5 text-xs font-bold text-[var(--text-muted)] bg-[var(--bg-card)] border-r border-[var(--border-card)] whitespace-nowrap">
            {label}
        </td>
        {periods.map(p => (
            <td key={p.periodId} className="px-3 py-2.5 text-center">
                {p.row.isEmpty ? (
                    <span className="text-[var(--text-dim)] text-sm">—</span>
                ) : (
                    <div className="flex flex-col items-center gap-1">
                        <div className="text-sm font-bold text-[var(--text-primary)] tabular-nums">
                            {Utils.fmt(p.row[valueField])}
                        </div>
                        <PctInput
                            compact
                            value={drafts[p.periodId]?.[draftField] ?? ''}
                            onChange={onDraftChange(p.periodId, draftField)}
                        />
                    </div>
                )}
            </td>
        ))}
    </tr>
);

const HistoricalOverviewView = () => {
    const { fetchPeriodData, invalidateCache } = useFinance();
    const [periods, setPeriods] = useState(null);
    const [drafts, setDrafts] = useState({});
    const [saveStatus, setSaveStatus] = useState({}); // { [periodId]: 'saving' | 'ok' | 'error' }

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const months = getLastMonths(6);
            const results = await Promise.all(months.map(async (p) => {
                const periodId = `${p.y}-${p.m}`;
                try {
                    const raw = await fetchPeriodData(p.y, p.m);
                    return { ...p, periodId, raw };
                } catch {
                    return { ...p, periodId, raw: null };
                }
            }));
            if (cancelled) return;
            setPeriods(results);
            setDrafts(prev => {
                const next = { ...prev };
                results.forEach(p => {
                    if (next[p.periodId]) return; // no pisar ediciones ya en curso
                    const m = p.raw?.dash?.estado_result_manual || {};
                    next[p.periodId] = {
                        mix_cafe: m.mix_cafe ?? '',
                        mgn_cafe: m.mgn_cafe ?? '',
                        mgn_producto: m.mgn_producto ?? '',
                    };
                });
                return next;
            });
        })();
        return () => { cancelled = true; };
    }, [fetchPeriodData]);

    const onDraftChange = (periodId, field) => (val) => {
        setDrafts(prev => ({ ...prev, [periodId]: { ...prev[periodId], [field]: val } }));
        setSaveStatus(prev => ({ ...prev, [periodId]: null }));
    };

    const handleSave = async (period) => {
        const draft = drafts[period.periodId] || {};
        setSaveStatus(prev => ({ ...prev, [period.periodId]: 'saving' }));

        const mixCafeNum = Utils.num(draft.mix_cafe);
        const mixProductoNum = Number((100 - Math.min(100, Math.max(0, mixCafeNum))).toFixed(1));
        const payload = {
            periodo: period.periodId,
            mix_cafe: mixCafeNum,
            mix_producto: mixProductoNum,
            mgn_cafe: Utils.num(draft.mgn_cafe),
            mgn_producto: Utils.num(draft.mgn_producto),
            excepcionales: Utils.num(period.raw?.dash?.estado_result_manual?.excepcionales),
        };

        const { error } = await supabase.from('ajustes_periodo').upsert(payload, { onConflict: 'periodo' });

        if (error) {
            setSaveStatus(prev => ({ ...prev, [period.periodId]: 'error' }));
            return;
        }

        invalidateCache(period.y, period.m);
        setPeriods(prev => prev.map(p => p.periodId === period.periodId
            ? { ...p, raw: { ...p.raw, dash: { ...p.raw.dash, estado_result_manual: { ...p.raw.dash.estado_result_manual, ...payload } } } }
            : p));
        setSaveStatus(prev => ({ ...prev, [period.periodId]: 'ok' }));
        setTimeout(() => setSaveStatus(prev => ({ ...prev, [period.periodId]: null })), 2500);
    };

    const rows = periods?.map(p => ({ ...p, row: computePeriodRow(p.raw, drafts[p.periodId]) })) || null;
    const colCount = (rows?.length || 6) + 1;

    if (!rows) {
        return (
            <div className="animate-fade-in mt-8 space-y-3">
                <div className="h-10 bg-slate-800/20 rounded-xl skeleton" />
                <div className="h-64 bg-slate-800/20 rounded-2xl skeleton" />
            </div>
        );
    }

    return (
        <div className="animate-fade-in mt-6">
            <div className="mb-4">
                <h2 className="text-xl font-bold text-[var(--text-primary)]">Vista Histórica General</h2>
                <p className="text-xs text-[var(--text-dim)] mt-1">Últimos 6 meses de un vistazo. Los meses sin datos cargados quedan vacíos. Mix y MGN se editan acá mismo — Mix Producto se completa solo (100% − Mix Cafetería).</p>
            </div>

            <div className="rounded-2xl border border-[var(--border-card)] overflow-x-auto no-scrollbar">
                <table className="w-full border-collapse min-w-[720px]">
                    <thead>
                        <tr>
                            <td className="sticky left-0 z-10 px-4 py-3 text-xs font-black uppercase tracking-wide text-[var(--text-primary)] bg-blue-500/15 border-r border-[var(--border-card)] whitespace-nowrap">
                                Estado Resultados
                            </td>
                            {rows.map(p => (
                                <td key={p.periodId} className="px-4 py-3 text-center text-xs font-black uppercase tracking-wide text-[var(--text-primary)] bg-blue-500/15">
                                    {p.label}
                                    <span className="ml-1 font-bold opacity-60 normal-case">'{p.yearShort}</span>
                                </td>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        <SectionHeader label="Ventas" colSpan={colCount} />
                        <DataRow label="Venta Sistema" periods={rows} field="ventaBruta" tone="ventas" />
                        <DataRow label="IVA" periods={rows} field="ivaDebito" tone="ventas" />
                        <DataRow label="Venta S/IVA" periods={rows} field="ventaNeta" tone="ventas" />
                        <DataRow label="Cant. Operaciones" periods={rows} field="cantOps" isInt tone="ventas" />
                        <DataRow label="Ticket Promedio" periods={rows} field="ticketProm" tone="ventas" />

                        <EditableRow label="Mix Cafetería" periods={rows} draftField="mix_cafe" valueField="ventaCafe" drafts={drafts} onDraftChange={onDraftChange} />
                        <EditableRow label="MGN Cafetería" periods={rows} draftField="mgn_cafe" valueField="margenCafePesos" drafts={drafts} onDraftChange={onDraftChange} />

                        <tr className="bg-emerald-500/[0.04] border-b border-[var(--border-card)]">
                            <td className="sticky left-0 z-10 px-4 py-2.5 text-xs font-bold text-[var(--text-muted)] bg-[var(--bg-card)] border-r border-[var(--border-card)] whitespace-nowrap">
                                Mix Producto
                            </td>
                            {rows.map(p => (
                                <td key={p.periodId} className="px-4 py-2.5 text-center">
                                    {p.row.isEmpty ? (
                                        <span className="text-[var(--text-dim)] text-sm">—</span>
                                    ) : (
                                        <div className="flex flex-col items-center gap-1">
                                            <div className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{Utils.fmt(p.row.ventaProducto)}</div>
                                            <div className="flex items-center gap-1">
                                                <span className="text-[8px] font-black uppercase tracking-wide text-blue-400/70 bg-blue-500/10 border border-blue-500/20 rounded px-1">auto</span>
                                                <span className="text-[10px] font-bold text-[var(--text-dim)] tabular-nums">{p.row.mixProductoPct.toFixed(1)}%</span>
                                            </div>
                                        </div>
                                    )}
                                </td>
                            ))}
                        </tr>

                        <EditableRow label="MGN Producto" periods={rows} draftField="mgn_producto" valueField="margenProductoPesos" drafts={drafts} onDraftChange={onDraftChange} />

                        <tr className="border-b border-[var(--border-card)]">
                            <td className="sticky left-0 z-10 px-4 py-2 text-[10px] font-bold text-[var(--text-dim)] bg-[var(--bg-card)] border-r border-[var(--border-card)] whitespace-nowrap">
                                Guardar Mix / MGN
                            </td>
                            {rows.map(p => (
                                <td key={p.periodId} className="px-3 py-2 text-center">
                                    {!p.row.isEmpty && (
                                        <button
                                            onClick={() => handleSave(p)}
                                            disabled={saveStatus[p.periodId] === 'saving'}
                                            className="px-3 py-1 rounded-lg text-[10px] font-bold border border-blue-500/30 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-all disabled:opacity-50"
                                        >
                                            {saveStatus[p.periodId] === 'saving' ? '...' :
                                             saveStatus[p.periodId] === 'ok' ? '✓ Guardado' :
                                             saveStatus[p.periodId] === 'error' ? '✗ Error' : 'Guardar'}
                                        </button>
                                    )}
                                </td>
                            ))}
                        </tr>

                        <SectionHeader label="Gastos" colSpan={colCount} />
                        <DataRow label="Gastos Fijos (Estructura)" periods={rows} field="operaciones" pctField="operacionesPct" tone="gastos" warnField="sinGastosFijos" />
                        <DataRow label="Sueldos (c/SAC y Cargas)" periods={rows} field="sueldosTotal" pctField="sueldosPct" tone="gastos" warnField="sinEmpleados" />
                        <DataRow label="Cant. Empleados" periods={rows} field="cantEmpleados" isInt tone="gastos" />
                        <DataRow label="Promedio por Empleado" periods={rows} field="promedioEmp" tone="gastos" />
                        <DataRow label="Gastos Excepcionales" periods={rows} field="excepcionales" pctField="excepcionalesPct" tone="gastos" />

                        <tr className="bg-emerald-500/10 border-b border-[var(--border-card)]">
                            <td className="sticky left-0 z-10 px-4 py-3 text-xs font-black uppercase tracking-wide text-[var(--text-primary)] bg-[var(--bg-card)] border-r border-[var(--border-card)] whitespace-nowrap">
                                Totales
                            </td>
                            {rows.map(p => (
                                <td key={p.periodId} className="px-4 py-3 text-center">
                                    {p.row.isEmpty ? (
                                        <span className="text-[var(--text-dim)] text-sm">—</span>
                                    ) : (
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-sm font-black text-[var(--text-primary)] tabular-nums">{Utils.fmt(p.row.totalGastos)}</span>
                                            {p.row.incompleto && (
                                                <span title="Todavía falta cargar Sueldos y/o Compras/Costos este período — el total no incluye esos gastos." className="text-[8px] font-black uppercase tracking-wide text-amber-500 bg-amber-500/10 border border-amber-500/25 rounded px-1.5 py-0.5 cursor-help">
                                                    Incompleto
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </td>
                            ))}
                        </tr>

                        <tr className="bg-blue-500/15">
                            <td className="sticky left-0 z-10 px-4 py-3.5 text-xs font-black uppercase tracking-wide text-[var(--text-primary)] bg-[var(--bg-card)] border-r border-[var(--border-card)] whitespace-nowrap">
                                Resultado
                            </td>
                            {rows.map(p => (
                                <td key={p.periodId} className="px-4 py-3.5 text-center">
                                    {p.row.isEmpty ? (
                                        <span className="text-[var(--text-dim)] text-sm">—</span>
                                    ) : (
                                        <div className="flex flex-col items-center gap-1">
                                            <span className={`text-sm font-black tabular-nums ${p.row.resultado >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{Utils.fmt(p.row.resultado)}</span>
                                            {p.row.incompleto && (
                                                <span title="Todavía falta cargar Sueldos y/o Compras/Costos este período — el resultado no es definitivo." className="text-[8px] font-black uppercase tracking-wide text-amber-500 bg-amber-500/10 border border-amber-500/25 rounded px-1.5 py-0.5 cursor-help">
                                                    Incompleto
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </td>
                            ))}
                        </tr>
                    </tbody>
                </table>
            </div>

            <p className="text-[10px] text-[var(--text-dim)] mt-3 leading-relaxed">
                Mismo cálculo que "Expectativa de Margen": Resultado = Margen Cafetería + Margen Producto − (Sueldos + Gastos Fijos + Excepcionales).
                No incluye compras a proveedores por separado porque ya están descontadas dentro del margen (MGN %).
                Los cambios de Mix/MGN se guardan en el mismo período que usa "Expectativa de Margen" — si lo editás acá, se refleja allá también.
            </p>
        </div>
    );
};

export default HistoricalOverviewView;
