import React, { useState, useEffect, useMemo } from 'react';
import { useFinance } from './FinanceContext';
import { formatters as Utils } from './formatters';

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

// Toma la data cruda de un período (fetchPeriodData) y arma el mismo ledger
// que usa "Expectativa de Margen": Sueldos + Gastos Fijos + Excepcionales vs.
// margen de contribución (Mix % x Venta Neta, MGN % sobre ese mix).
const computePeriodRow = (data) => {
    const n = Utils.num;
    const kpis = data?.dash?.kpis || {};
    const egresos = data?.dash?.egresos || {};
    const manual = data?.dash?.estado_result_manual || {};
    const emp = data?.emp || [];
    const arca = data?.arca || [];
    const ventas = data?.ventas || [];

    const isEmpty = n(kpis.venta_bruta) === 0 && emp.length === 0 && arca.length === 0 && ventas.length === 0;
    if (isEmpty) return { isEmpty: true };

    const ventaBruta = n(kpis.venta_bruta);
    const ivaDebito = n(kpis.iva_debito);
    const ventaNeta = n(kpis.ventas_netas_reales);
    const cantOps = n(kpis.cant_operaciones);
    const ticketProm = cantOps > 0 ? ventaBruta / cantOps : 0;

    const mixCafePct = n(manual.mix_cafe);
    const mixProductoPct = n(manual.mix_producto);
    const mgnCafePct = n(manual.mgn_cafe);
    const mgnProductoPct = n(manual.mgn_producto);

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
    const excepcionales = n(manual.excepcionales);

    const totalGastos = sueldosTotal + operaciones + excepcionales;
    const resultado = margenCafePesos + margenProductoPesos - totalGastos;

    const pctOf = (v) => totalGastos > 0 ? (v / totalGastos) * 100 : 0;

    return {
        isEmpty: false,
        ventaBruta, ivaDebito, ventaNeta, cantOps, ticketProm,
        ventaCafe, mixCafePct, margenCafePesos, mgnCafePct,
        ventaProducto, mixProductoPct, margenProductoPesos, mgnProductoPct,
        operaciones, operacionesPct: pctOf(operaciones),
        sueldosTotal, sueldosPct: pctOf(sueldosTotal),
        cantEmpleados, promedioEmp,
        excepcionales, excepcionalesPct: pctOf(excepcionales),
        totalGastos, resultado,
    };
};

const Cell = ({ row, field, pctField, isInt, isEmpty }) => {
    if (isEmpty) return <td className="px-4 py-2.5 text-center text-[var(--text-dim)] text-sm">—</td>;
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

const DataRow = ({ label, periods, field, pctField, isInt, tone }) => (
    <tr className={tone === 'ventas' ? 'bg-emerald-500/[0.04]' : tone === 'gastos' ? 'bg-white/[0.02]' : ''}>
        <td className="sticky left-0 z-10 px-4 py-2.5 text-xs font-bold text-[var(--text-muted)] bg-[var(--bg-card)] border-r border-[var(--border-card)] whitespace-nowrap">
            {label}
        </td>
        {periods.map(p => (
            <Cell key={p.periodId} row={p.row} field={field} pctField={pctField} isInt={isInt} isEmpty={p.row.isEmpty} />
        ))}
    </tr>
);

const HistoricalOverviewView = () => {
    const { fetchPeriodData } = useFinance();
    const [periods, setPeriods] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const months = getLastMonths(6);
            const results = await Promise.all(months.map(async (p) => {
                try {
                    const data = await fetchPeriodData(p.y, p.m);
                    return { ...p, periodId: `${p.y}-${p.m}`, row: computePeriodRow(data) };
                } catch {
                    return { ...p, periodId: `${p.y}-${p.m}`, row: { isEmpty: true } };
                }
            }));
            if (!cancelled) setPeriods(results);
        })();
        return () => { cancelled = true; };
    }, [fetchPeriodData]);

    const colCount = (periods?.length || 6) + 1;

    if (!periods) {
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
                <p className="text-xs text-[var(--text-dim)] mt-1">Últimos 6 meses de un vistazo. Los meses sin datos cargados quedan vacíos.</p>
            </div>

            <div className="rounded-2xl border border-[var(--border-card)] overflow-x-auto no-scrollbar">
                <table className="w-full border-collapse min-w-[720px]">
                    <thead>
                        <tr>
                            <td className="sticky left-0 z-10 px-4 py-3 text-xs font-black uppercase tracking-wide text-[var(--text-primary)] bg-blue-500/15 border-r border-[var(--border-card)] whitespace-nowrap">
                                Estado Resultados
                            </td>
                            {periods.map(p => (
                                <td key={p.periodId} className="px-4 py-3 text-center text-xs font-black uppercase tracking-wide text-[var(--text-primary)] bg-blue-500/15">
                                    {p.label}
                                    <span className="ml-1 font-bold opacity-60 normal-case">'{p.yearShort}</span>
                                </td>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        <SectionHeader label="Ventas" colSpan={colCount} />
                        <DataRow label="Venta Sistema" periods={periods} field="ventaBruta" tone="ventas" />
                        <DataRow label="IVA" periods={periods} field="ivaDebito" tone="ventas" />
                        <DataRow label="Venta S/IVA" periods={periods} field="ventaNeta" tone="ventas" />
                        <DataRow label="Cant. Operaciones" periods={periods} field="cantOps" isInt tone="ventas" />
                        <DataRow label="Ticket Promedio" periods={periods} field="ticketProm" tone="ventas" />
                        <DataRow label="Mix Cafetería" periods={periods} field="ventaCafe" pctField="mixCafePct" tone="ventas" />
                        <DataRow label="MGN Cafetería" periods={periods} field="margenCafePesos" pctField="mgnCafePct" tone="ventas" />
                        <DataRow label="Mix Producto" periods={periods} field="ventaProducto" pctField="mixProductoPct" tone="ventas" />
                        <DataRow label="MGN Producto" periods={periods} field="margenProductoPesos" pctField="mgnProductoPct" tone="ventas" />

                        <SectionHeader label="Gastos" colSpan={colCount} />
                        <DataRow label="Gastos Fijos (Estructura)" periods={periods} field="operaciones" pctField="operacionesPct" tone="gastos" />
                        <DataRow label="Sueldos (c/SAC y Cargas)" periods={periods} field="sueldosTotal" pctField="sueldosPct" tone="gastos" />
                        <DataRow label="Cant. Empleados" periods={periods} field="cantEmpleados" isInt tone="gastos" />
                        <DataRow label="Promedio por Empleado" periods={periods} field="promedioEmp" tone="gastos" />
                        <DataRow label="Gastos Excepcionales" periods={periods} field="excepcionales" pctField="excepcionalesPct" tone="gastos" />

                        <tr className="bg-emerald-500/10">
                            <td className="sticky left-0 z-10 px-4 py-3 text-xs font-black uppercase tracking-wide text-[var(--text-primary)] bg-[var(--bg-card)] border-r border-[var(--border-card)] whitespace-nowrap">
                                Totales
                            </td>
                            {periods.map(p => (
                                <td key={p.periodId} className="px-4 py-3 text-center">
                                    {p.row.isEmpty
                                        ? <span className="text-[var(--text-dim)] text-sm">—</span>
                                        : <span className="text-sm font-black text-[var(--text-primary)] tabular-nums">{Utils.fmt(p.row.totalGastos)}</span>}
                                </td>
                            ))}
                        </tr>

                        <tr className="bg-blue-500/15">
                            <td className="sticky left-0 z-10 px-4 py-3.5 text-xs font-black uppercase tracking-wide text-[var(--text-primary)] bg-[var(--bg-card)] border-r border-[var(--border-card)] whitespace-nowrap">
                                Resultado
                            </td>
                            {periods.map(p => (
                                <td key={p.periodId} className="px-4 py-3.5 text-center">
                                    {p.row.isEmpty
                                        ? <span className="text-[var(--text-dim)] text-sm">—</span>
                                        : <span className={`text-sm font-black tabular-nums ${p.row.resultado >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{Utils.fmt(p.row.resultado)}</span>}
                                </td>
                            ))}
                        </tr>
                    </tbody>
                </table>
            </div>

            <p className="text-[10px] text-[var(--text-dim)] mt-3 leading-relaxed">
                Mismo cálculo que "Expectativa de Margen": Resultado = Margen Cafetería + Margen Producto − (Sueldos + Gastos Fijos + Excepcionales).
                No incluye compras a proveedores por separado porque ya están descontadas dentro del margen (MGN %).
            </p>
        </div>
    );
};

export default HistoricalOverviewView;
