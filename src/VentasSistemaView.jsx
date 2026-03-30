import React, { useMemo } from 'react';
import { formatters as Utils } from './formatters';
import { useFinance } from './FinanceContext';

const VentasSistemaView = ({ data: dataProp }) => {
    const { ventasData } = useFinance();
    const data = useMemo(() => Utils.arr(dataProp ?? ventasData), [dataProp, ventasData]);

    const stats = useMemo(() => {
        if (data.length === 0) return { total: 0, efvo: 0, tarj: 0, iva: 0, mixEfvo: 0, mixTarj: 0 };
        const total = data.reduce((acc, r) => acc + Utils.num(r.total), 0);
        const efvo = data.reduce((acc, r) => acc + Utils.num(r.efectivo), 0);
        const tarj = data.reduce((acc, r) => acc + Utils.num(r.tarjetas), 0);
        const iva = data.reduce((acc, r) => acc + Utils.num(r.iva), 0);
        
        return {
            total,
            efvo,
            tarj,
            iva,
            mixEfvo: total > 0 ? (efvo / (efvo + tarj)) * 100 : 0,
            mixTarj: total > 0 ? (tarj / (efvo + tarj)) * 100 : 0,
            taxPressure: total > 0 ? (iva / total) * 100 : 0
        };
    }, [data]);

    if (!data) return null;

    return (
        <div className="animate-fade-in space-y-6">
            {/* KPI Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="group-card !p-5 bg-gradient-to-br from-blue-500/5 to-transparent border-blue-500/20">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Venta Total (Sistema)</p>
                    <p className="text-2xl font-black text-white">{Utils.fmt(stats.total)}</p>
                    <p className="text-[10px] text-slate-500 mt-1">Bruto calculado de reportes</p>
                </div>

                <div className="group-card !p-5 border-emerald-500/20">
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Mix Efectivo</p>
                    <p className="text-2xl font-black text-emerald-400">{stats.mixEfvo.toFixed(1)}%</p>
                    <div className="w-full bg-slate-900 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div className="bg-emerald-500 h-full" style={{ width: `${stats.mixEfvo}%` }}></div>
                    </div>
                </div>

                <div className="group-card !p-5 border-blue-400/20">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Mix Tarjetas</p>
                    <p className="text-2xl font-black text-blue-400">{stats.mixTarj.toFixed(1)}%</p>
                    <div className="w-full bg-slate-900 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div className="bg-blue-500 h-full" style={{ width: `${stats.mixTarj}%` }}></div>
                    </div>
                </div>

                <div className="group-card !p-5 border-rose-500/20">
                    <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Carga IVA (21%)</p>
                    <p className="text-2xl font-black text-rose-400">{Utils.fmt(stats.iva)}</p>
                    <p className="text-[10px] text-slate-500 mt-1">PresiÃ³n fiscal: {stats.taxPressure.toFixed(1)}%</p>
                </div>
            </div>

            {/* Table Section con Overflow Fix */}
            <div className="bg-slate-800 rounded-3xl border border-slate-700/60 shadow-2xl overflow-hidden backdrop-blur-md">
                <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    <table className="w-full text-xs text-left min-w-[1000px]">
                        <thead className="bg-slate-900/80 text-slate-500 uppercase font-black tracking-widest border-b border-slate-700/50">
                            <tr>
                                <th className="px-6 py-5">Periodo</th>
                                <th className="px-6 py-5 text-right">Fact. Elect.</th>
                                <th className="px-6 py-5 text-right">Fact. B (Exenta)</th>
                                <th className="px-6 py-5 text-right">Neto 21%</th>
                                <th className="px-6 py-5 text-right">IVA 21%</th>
                                <th className="px-6 py-5 text-right text-emerald-500/80">Efectivo</th>
                                <th className="px-6 py-5 text-right text-blue-500/80">Tarjetas</th>
                                <th className="px-6 py-5 text-right">Otros</th>
                                <th className="px-6 py-5 text-right text-white bg-white/5 border-l border-white/10">Total Calculado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/40">
                            {data.length === 0 ? (
                                <tr><td colSpan="9" className="px-6 py-20 text-center text-slate-500 italic">No hay registros de sistema para este periodo.</td></tr>
                            ) : data.map((row, i) => (
                                <tr key={i} className="hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-5 font-bold text-slate-200 uppercase tracking-tighter">
                                        {new Date(row.fecha).toLocaleDateString('es-AR', {month: 'long', year: 'numeric'})}
                                    </td>
                                    <td className="px-6 py-5 text-right text-orange-400/60 font-mono">{Utils.fmt(Utils.num(row.val_factura_b_elec))}</td>
                                    <td className="px-6 py-5 text-right text-orange-400/60 font-mono">{Utils.fmt(Utils.num(row.val_factura_b))}</td>
                                    <td className="px-6 py-5 text-right text-slate-400 font-mono">{Utils.fmt(Utils.num(row.neto))}</td>
                                    <td className="px-6 py-5 text-right text-rose-400/60 font-mono">{Utils.fmt(Utils.num(row.iva))}</td>
                                    <td className="px-6 py-5 text-right text-emerald-400 font-bold font-mono">{Utils.fmt(Utils.num(row.efectivo))}</td>
                                    <td className="px-6 py-5 text-right text-blue-400 font-bold font-mono">{Utils.fmt(Utils.num(row.tarjetas))}</td>
                                    <td className="px-6 py-5 text-right text-slate-500 font-mono">{Utils.fmt(Utils.num(row.otros))}</td>
                                    <td className="px-6 py-5 text-right font-black text-white bg-white/[0.03] border-l border-white/10 font-mono shadow-inner">
                                        {Utils.fmt(Utils.num(row.total))}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <p className="px-4 text-[10px] text-slate-600 italic">
                * El Total Calculado surge de la suma de Efectivo, Tarjetas y Otros. Debe coincidir con (Neto + IVA).
            </p>
        </div>
    );
};

export default VentasSistemaView;
