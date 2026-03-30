import React, { useMemo } from 'react';
import { formatters as Utils } from './formatters';
import { useFinance } from './FinanceContext';

/**
 * Componente de tabla genérica para comprobantes.
 * Utilizado por la vista principal de ARCA, Honorarios y Estructurales.
 */
const ArcaView = ({ data: dataProp }) => {
    const { arcaData } = useFinance();
    const data = dataProp ?? arcaData;
    const totals = useMemo(() => Utils.arr(data).reduce((acc, curr) => {
        acc.neto += Utils.num(curr.neto);
        acc.iva += Utils.num(curr.iva);
        acc.total += Utils.num(curr.total);
        return acc;
    }, { neto: 0, iva: 0, total: 0 }), [data]);

    if (!data) return null;

    return (
        <div className="animate-fade-in mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
                    <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-2">Total Neto</p>
                    <h2 className="text-3xl font-extrabold text-slate-200">{Utils.fmt(Math.abs(totals.neto))}</h2>
                </div>
                <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
                    <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-2">IVA Acumulado</p>
                    <h2 className="text-3xl font-extrabold text-emerald-400">{Utils.fmt(Math.abs(totals.iva))}</h2>
                </div>
                <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
                    <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-2">Comprobantes</p>
                    <h2 className="text-3xl font-extrabold text-blue-400">{Utils.arr(data).length}</h2>
                </div>
            </div>

            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
                <table className="w-full text-xs text-left">
                    <thead className="bg-slate-900 text-slate-400 uppercase font-bold">
                        <tr>
                            <th className="px-6 py-4">Fecha</th>
                            <th className="px-6 py-4">Entidad / CUIT</th>
                            <th className="px-6 py-4">Detalle</th>
                            <th className="px-6 py-4 text-right">Neto</th>
                            <th className="px-6 py-4 text-right">IVA</th>
                            <th className="px-6 py-4 text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {Utils.arr(data).length === 0 ? (
                            <tr><td colSpan="6" className="px-6 py-10 text-center text-slate-500 italic">No hay registros para este periodo.</td></tr>
                        ) : Utils.arr(data).map((row, i) => {
                            const dateObj = row.fecha ? new Date(row.fecha) : null;
                            const dateStr = dateObj && !isNaN(dateObj) ? dateObj.toLocaleDateString() : 'S/D';
                            return (
                                <tr key={i} className="hover:bg-slate-700/30 transition">
                                    <td className="px-6 py-4 text-slate-400 font-mono">{dateStr}</td>
                                    <td className="px-6 py-4 font-bold text-slate-200">
                                        {row.entidad}<br/>
                                        <span className="text-[10px] font-normal text-slate-500 font-mono">{row.cuit}</span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-400">
                                        {row.tipo_comp}<br/>
                                        <span className="font-mono">{row.nro_comp}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right text-slate-300 font-mono">{Utils.fmt(Math.abs(Utils.num(row.neto)))}</td>
                                    <td className="px-6 py-4 text-right text-emerald-500/70 font-mono">{Utils.fmt(Math.abs(Utils.num(row.iva)))}</td>
                                    <td className="px-6 py-4 text-right font-bold text-white font-mono">{Utils.fmt(Math.abs(Utils.num(row.total)))}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export const ProfessionalFeesView = ({ data: dataProp }) => {
    const { arcaData } = useFinance();
    const data = dataProp ?? arcaData;
    const filtered = useMemo(() => Utils.arr(data)
        .filter(row => row.rubro === 'Honorarios Profesionales')
        .map(row => ({
            ...row,
            entidad: (row.entidad && row.entidad !== 'Consumidor Final') ? row.entidad : (row.sub_rubro || 'Profesional'),
            tipo_comp: row.tipo_comp || row.metodo_pago || 'Honorarios',
            nro_comp: row.nro_comp || 'Carga Manual',
            neto: row.neto ?? row.importe_neto,
            iva: row.iva ?? row.importe_iva,
            total: row.total ?? row.importe_total
        })), [data]);
    return <ArcaView data={filtered} />;
};

export const StructuralCostsView = ({ data: dataProp }) => {
    const { arcaData } = useFinance();
    const data = dataProp ?? arcaData;
    const filtered = useMemo(() => Utils.arr(data)
        .filter(row => row.rubro === 'Costos Estructurales')
        .map(row => ({
            ...row,
            entidad: (row.entidad && row.entidad !== 'Consumidor Final') ? row.entidad : (row.sub_rubro || 'Gasto Estructural'),
            tipo_comp: row.tipo_comp || row.metodo_pago || 'Servicio/Gasto',
            nro_comp: row.nro_comp || 'Carga Manual',
            neto: row.neto ?? row.importe_neto,
            iva: row.iva ?? row.importe_iva,
            total: row.total ?? row.importe_total
        })), [data]);
    return <ArcaView data={filtered} />;
};

export default ArcaView;