import React, { useMemo } from 'react';
import { formatters as Utils } from './formatters';
import { useFinance } from './FinanceContext';

const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function fmtPeriodo(fechaRaw) {
    const d = new Date(fechaRaw);
    if (isNaN(d)) return '—';
    return `${MONTHS_ES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const KpiCard = ({ label, value, sub, color = 'slate', bar, barColor }) => {
    const colors = {
        blue:    { title: 'text-blue-400',    border: 'border-blue-500/20',    bg: 'from-blue-500/5' },
        emerald: { title: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'from-emerald-500/5' },
        violet:  { title: 'text-violet-400',  border: 'border-violet-500/20',  bg: 'from-violet-500/5' },
        rose:    { title: 'text-rose-400',    border: 'border-rose-500/20',    bg: 'from-rose-500/5' },
        amber:   { title: 'text-amber-400',   border: 'border-amber-500/20',   bg: 'from-amber-500/5' },
        slate:   { title: 'text-[var(--text-secondary)]', border: 'border-[var(--border-mid)]/30', bg: 'from-[var(--bg-surface)]' },
    };
    const c = colors[color] ?? colors.slate;
    return (
        <div className={`group-card !p-5 bg-gradient-to-br ${c.bg} to-transparent ${c.border}`}>
            <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${c.title}`}>{label}</p>
            <p className={`text-2xl font-black ${c.title}`}>{value}</p>
            {bar !== undefined && (
                <div className="w-full bg-slate-900 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className={`${barColor ?? 'bg-slate-500'} h-full rounded-full transition-all`} style={{ width: `${Math.min(bar, 100)}%` }} />
                </div>
            )}
            {sub && <p className="text-[10px] text-slate-500 mt-1.5">{sub}</p>}
        </div>
    );
};

const VentasSistemaView = ({ data: dataProp }) => {
    const { ventasData } = useFinance();
    const data = useMemo(() => Utils.arr(dataProp ?? ventasData), [dataProp, ventasData]);

    const stats = useMemo(() => {
        if (data.length === 0) return null;

        const total    = data.reduce((a, r) => a + Utils.num(r.total),            0);
        const neto     = data.reduce((a, r) => a + Utils.num(r.neto),             0);
        const iva      = data.reduce((a, r) => a + Utils.num(r.iva),              0);
        const efvo     = data.reduce((a, r) => a + Utils.num(r.efectivo),         0);
        const tarj     = data.reduce((a, r) => a + Utils.num(r.tarjetas),         0);
        const otros    = data.reduce((a, r) => a + Utils.num(r.otros),            0);
        const bElec    = data.reduce((a, r) => a + Utils.num(r.val_factura_b_elec), 0);
        const bManual  = data.reduce((a, r) => a + Utils.num(r.val_factura_b),    0);

        const cobrado  = efvo + tarj + otros;
        const mixEfvo  = cobrado > 0 ? (efvo  / cobrado) * 100 : 0;
        const mixTarj  = cobrado > 0 ? (tarj  / cobrado) * 100 : 0;
        const mixOtros = cobrado > 0 ? (otros / cobrado) * 100 : 0;
        const presion  = total  > 0  ? (iva   / total)   * 100 : 0;
        const pctBElec = total  > 0  ? (bElec / total)   * 100 : 0;

        return { total, neto, iva, efvo, tarj, otros, bElec, bManual, cobrado, mixEfvo, mixTarj, mixOtros, presion, pctBElec };
    }, [data]);

    /* ── empty state ────────────────────────────────────── */
    if (data.length === 0) {
        return (
            <div className="animate-fade-in flex flex-col items-center justify-center py-32 text-center space-y-3">
                <div className="text-5xl opacity-20">📊</div>
                <p className="text-slate-400 font-semibold">Sin registros de ventas para este período</p>
                <p className="text-slate-600 text-sm">Cargá el reporte Maxirest desde la pestaña <span className="text-slate-400 font-bold">Carga</span></p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in space-y-6">

            {/* ── KPIs principales ──────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    label="Ventas Totales (con IVA)"
                    value={Utils.fmt(stats.total)}
                    sub={`${data.length} carga${data.length !== 1 ? 's' : ''} de datos`}
                    color="blue"
                />
                <KpiCard
                    label="Ventas sin impuestos"
                    value={Utils.fmt(stats.neto)}
                    sub={`IVA del total: ${Utils.fmt(stats.iva)}`}
                    color="violet"
                />
                <KpiCard
                    label="Efectivo"
                    value={Utils.fmt(stats.efvo)}
                    bar={stats.mixEfvo}
                    barColor="bg-emerald-500"
                    sub={`${stats.mixEfvo.toFixed(1)}% del total cobrado`}
                    color="emerald"
                />
                <KpiCard
                    label="Tarjetas + Otros"
                    value={Utils.fmt(stats.tarj + stats.otros)}
                    bar={stats.mixTarj + stats.mixOtros}
                    barColor="bg-blue-500"
                    sub={`% de IVA en ventas: ${stats.presion.toFixed(1)}%`}
                    color="rose"
                />
            </div>

            {/* ── Composición facturación ───────────────────── */}
            <div className="group-card !p-5 space-y-3">
                <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">¿Cómo se facturó?</p>
                    <p className="text-[10px] text-slate-600">Con factura fiscal vs. Ticket manual manual (Sin IVA)</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex-1 h-3 bg-slate-900 rounded-full overflow-hidden flex">
                        <div className="bg-amber-500 h-full transition-all" style={{ width: `${stats.pctBElec}%` }} title={`Fact. B Electrónica: ${Utils.fmt(stats.bElec)}`} />
                        <div className="bg-slate-600 h-full transition-all" style={{ width: `${100 - stats.pctBElec}%` }} title={`Fact. B Manual: ${Utils.fmt(stats.bManual)}`} />
                    </div>
                </div>
                <div className="flex gap-6 text-[11px]">
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
                        <span className="text-slate-400">Facturas registradas</span>
                        <span className="text-amber-400 font-bold">{Utils.fmt(stats.bElec)}</span>
                        <span className="text-slate-600">({stats.pctBElec.toFixed(1)}%)</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-slate-600 inline-block" />
                        <span className="text-slate-400">Tickets manuales (Sin IVA)</span>
                        <span className="text-slate-300 font-bold">{Utils.fmt(stats.bManual)}</span>
                        <span className="text-slate-600">({(100 - stats.pctBElec).toFixed(1)}%)</span>
                    </span>
                </div>
            </div>

            {/* ── Tabla de detalle ──────────────────────────── */}
            <div className="bg-[var(--bg-card)] rounded-3xl border border-[var(--border-card)] shadow-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
                    <div>
                        <p className="font-bold text-[var(--text-primary)] text-sm">Detalle por Período</p>
                        <p className="text-[10px] text-[var(--text-dim)] mt-0.5">Todos los registros Maxirest del período seleccionado</p>
                    </div>
                    <span className="text-[10px] bg-[var(--bg-surface)] text-[var(--text-muted)] px-3 py-1 rounded-full font-mono">{data.length} reg.</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left min-w-[960px] text-[var(--text-secondary)]">
                        <thead className="bg-[var(--bg-page)] text-[var(--text-muted)] uppercase text-[10px] font-black tracking-widest">
                            <tr>
                                <th className="px-5 py-4 sticky left-0 bg-[var(--bg-page)]">Fecha</th>
                                <th className="px-5 py-4 text-right text-amber-500/80">Venta con Factura</th>
                                <th className="px-5 py-4 text-right">Venta Manual (Sin IVA)</th>
                                <th className="px-5 py-4 text-right text-violet-500/80">Venta sin IVA</th>
                                <th className="px-5 py-4 text-right text-rose-500/80">IVA Pagado</th>
                                <th className="px-5 py-4 text-right text-emerald-500/80">Efectivo</th>
                                <th className="px-5 py-4 text-right text-blue-500/80">Tarjetas</th>
                                <th className="px-5 py-4 text-right">Otros</th>
                                <th className="px-5 py-4 text-right text-white bg-white/5 border-l border-white/10">Total Recaudado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-subtle)]">
                            {data.map((row, i) => {
                                const rowTotal = Utils.num(row.efectivo) + Utils.num(row.tarjetas) + Utils.num(row.otros);
                                return (
                                    <tr key={i} className="hover:bg-white/[0.03] transition-colors">
                                        <td className="px-5 py-4 font-bold text-[var(--text-primary)] capitalize sticky left-0 bg-[var(--bg-card)]">
                                            {fmtPeriodo(row.fecha)}
                                        </td>
                                        <td className="px-5 py-4 text-right text-amber-400/80 font-mono">{Utils.fmt(Utils.num(row.val_factura_b_elec))}</td>
                                        <td className="px-5 py-4 text-right text-slate-500 font-mono">{Utils.fmt(Utils.num(row.val_factura_b))}</td>
                                        <td className="px-5 py-4 text-right text-violet-400/80 font-mono">{Utils.fmt(Utils.num(row.neto))}</td>
                                        <td className="px-5 py-4 text-right text-rose-400/70 font-mono">{Utils.fmt(Utils.num(row.iva))}</td>
                                        <td className="px-5 py-4 text-right text-emerald-400 font-bold font-mono">{Utils.fmt(Utils.num(row.efectivo))}</td>
                                        <td className="px-5 py-4 text-right text-blue-400 font-bold font-mono">{Utils.fmt(Utils.num(row.tarjetas))}</td>
                                        <td className="px-5 py-4 text-right text-[var(--text-muted)] font-mono">{Utils.fmt(Utils.num(row.otros))}</td>
                                        <td className="px-5 py-4 text-right font-black text-[var(--text-primary)] bg-[var(--bg-surface)] border-l border-[var(--border-card)] font-mono">
                                            {Utils.fmt(rowTotal || Utils.num(row.total))}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        {data.length > 1 && (
                            <tfoot className="bg-slate-900/60 border-t-2 border-slate-600/60 text-[11px] font-black">
                                <tr>
                                    <td className="px-5 py-4 text-slate-300 uppercase tracking-widest sticky left-0 bg-slate-900/80">Total</td>
                                    <td className="px-5 py-4 text-right text-amber-400 font-mono">{Utils.fmt(stats.bElec)}</td>
                                    <td className="px-5 py-4 text-right text-slate-400 font-mono">{Utils.fmt(stats.bManual)}</td>
                                    <td className="px-5 py-4 text-right text-violet-400 font-mono">{Utils.fmt(stats.neto)}</td>
                                    <td className="px-5 py-4 text-right text-rose-400 font-mono">{Utils.fmt(stats.iva)}</td>
                                    <td className="px-5 py-4 text-right text-emerald-400 font-mono">{Utils.fmt(stats.efvo)}</td>
                                    <td className="px-5 py-4 text-right text-blue-400 font-mono">{Utils.fmt(stats.tarj)}</td>
                                    <td className="px-5 py-4 text-right text-slate-300 font-mono">{Utils.fmt(stats.otros)}</td>
                                    <td className="px-5 py-4 text-right text-white bg-white/[0.05] border-l border-white/10 font-mono">{Utils.fmt(stats.total)}</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            <p className="px-2 text-[10px] text-slate-600 italic">
                * El Total Recaudado surge de Efectivo + Tarjetas + Otros. La "Venta sin IVA" se calcula separando el impuesto de las ventas facturadas sumado a las ventas manuales.
            </p>
        </div>
    );
};

export default VentasSistemaView;
