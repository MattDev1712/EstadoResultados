import React, { useMemo } from 'react';
import { useFinance } from './FinanceContext';
import { formatters as Utils } from './formatters';
import ChartComponent from './ChartComponent';

const EmployeesView = () => {
    const { empData: employees, dashData, cargasPct, setCargasPct } = useFinance();

    // Cálculos de incidencia basados en ventas netas del dashboard
    const canales = dashData?.analisis_ventas?.mix_canales || {};
    const ventasNetas = Object.values(canales).reduce((a, b) => a + Utils.num(b), 0);

    // Memorización de totales de nómina
    const totals = useMemo(() => Utils.arr(employees).reduce((acc, emp) => {
        acc.costo += Utils.num(emp.costo_total);
        acc.recibo += Utils.num(emp.recibo);
        acc.negro += Utils.num(emp.negro);
        return acc;
    }, { costo: 0, recibo: 0, negro: 0 }), [employees]);

    const montoCargas = totals.recibo * (Utils.num(cargasPct) / 100);
    const totalRealConCargas = totals.costo + montoCargas;

    const chartDataComposicion = useMemo(() => ({
        labels: ['Sueldo registrado (Blanco)', 'Pago en mano (Informal)'],
        datasets: [{
            data: [totals.recibo, totals.negro],
            backgroundColor: ['#10b981', '#f43f5e'],
            borderWidth: 0,
            hoverOffset: 15
        }]
    }), [totals.recibo, totals.negro]);

    const cakeOptions = useMemo(() => ({
        plugins: {
            legend: { display: false },
            datalabels: {
                color: '#fff',
                font: { weight: 'bold', size: 11 },
                formatter: (value, ctx) => {
                    const sum = ctx.dataset.data.reduce((a, b) => a + b, 0);
                    const percentage = (value * 100 / sum).toFixed(1);
                    return percentage > 1 ? `${ctx.chart.data.labels[ctx.dataIndex]}\n${percentage}%` : '';
                },
                textAlign: 'center',
                textShadowColor: 'rgba(0, 0, 0, 0.9)',
                textShadowBlur: 6,
                padding: 8
            }
        },
        maintainAspectRatio: false
    }), []);

    if (!employees || employees.length === 0) {
        return <div className="mt-8 p-12 text-center text-slate-500 border border-dashed border-slate-700 rounded-3xl">No hay datos de nómina para este periodo.</div>;
    }

    return (
        <div className="animate-fade-in mt-4">
            {/* Fila Destacada: Costo Total Estimado */}
            <div className="w-full mb-6">
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-8 rounded-[2.5rem] border border-slate-700 shadow-2xl relative overflow-hidden group">
                    <div className="absolute -right-10 -top-10 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-all duration-700"></div>
                    <p className="section-label !mb-3">Lo que realmente cuesta el equipo (Sueldos + Impuestos Est.)</p>
                    <div className="flex flex-col md:flex-row md:items-baseline gap-2 md:gap-6">
                        <h2 className="text-4xl font-black text-white font-mono tracking-tighter leading-none">
                            {Utils.fmt(totalRealConCargas)}
                        </h2>
                        <div className="flex items-center gap-2 text-slate-500 text-xs font-medium border-l border-slate-700 md:pl-6">
                            <span className="bg-slate-700 px-2 py-0.5 rounded text-[10px] text-slate-300">ESTIMADO</span>
                            <span>Incluye {Utils.fmt(montoCargas)} de impuestos al sueldo (proyectado)</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
                    <p className="section-label !mb-2">Cantidad de personas</p>
                    <h2 className="text-2xl font-black text-blue-400 truncate">{Utils.arr(employees).length} <span className="text-xs text-slate-600 font-bold uppercase tracking-tighter ml-1">Personas</span></h2>
                </div>
                
                <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
                    <p className="section-label !mb-2">% Pago en blanco</p>
                    <h2 className="text-2xl font-black text-slate-100 truncate">{Utils.num(totals.costo) > 0 ? Utils.pct(Utils.num(totals.recibo), Utils.num(totals.costo)) : 0}%</h2>
                </div>
                
                <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
                    <p className="section-label !mb-2">% Costo sobre ventas</p>
                    <h2 className="text-2xl font-black text-rose-400 truncate">{Utils.num(ventasNetas) > 0 ? Utils.pct(Utils.num(totals.costo), Utils.num(ventasNetas)) : 0}%</h2>
                </div>

                <div className="bg-slate-800 p-6 rounded-2xl border border-blue-500/30 shadow-xl bg-blue-500/[0.02]">
                    <p className="section-label !text-blue-400/70 !mb-2">Impuestos al sueldo (%)</p>
                    <div className="flex items-center gap-2">
                        <input 
                            type="number"
                            value={cargasPct}
                            onChange={(e) => setCargasPct(e.target.value)}
                            className="bg-slate-900/50 border border-slate-700 rounded-lg w-20 px-3 py-1 text-xl font-black text-white outline-none focus:border-blue-500 transition-all"
                        />
                        <span className="text-2xl font-bold text-slate-600">%</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2">Sobre {Utils.fmt(totals.recibo)} (Blanco)</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="lg:col-span-1">
                    <ChartComponent 
                        type="pie" 
                        title="Cómo se reparte el pago" 
                        data={chartDataComposicion}
                        options={cakeOptions}
                    />
                </div>
                
                <div className="lg:col-span-2 bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl flex flex-col justify-center">
                    <h3 className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-8">Análisis de Composición</h3>
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <span className="text-emerald-500 font-bold text-sm">Sueldo registrado (Blanco)</span>
                            <span className="text-2xl font-mono font-black text-white">{Utils.fmt(Utils.num(totals.recibo))}</span>
                        </div>
                        <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-full" style={{ width: `${Utils.pct(Utils.num(totals.recibo), Utils.num(totals.costo))}%` }}></div>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-rose-500 font-bold text-sm">Pago en mano (Informal)</span>
                            <span className="text-2xl font-mono font-black text-white">{Utils.fmt(Utils.num(totals.negro))}</span>
                        </div>
                        <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                            <div className="bg-rose-500 h-full" style={{ width: `${Utils.pct(Utils.num(totals.negro), Utils.num(totals.costo))}%` }}></div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] font-bold">
                        <tr>
                            <th className="px-6 py-4">Empleado / Tarea</th>
                            <th className="px-6 py-4">DNI / CUIL</th>
                            <th className="px-6 py-4 text-center">Horas</th>
                            <th className="px-6 py-4 text-right">Sueldo Blanco</th>
                            <th className="px-6 py-4 text-right">Sueldo Manual</th>
                            <th className="px-6 py-4 text-right">Costo Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {Utils.arr(employees).map((emp, i) => (
                            <tr key={i} className="hover:bg-slate-700/50 transition border-slate-700">
                                <td className="px-6 py-4 font-bold text-slate-200">
                                    {emp.nombre}<br/>
                                    <span className="text-[10px] text-slate-500 font-normal">{emp.tarea}</span>
                                </td>
                                <td className="px-6 py-4 font-mono text-slate-400">{emp.dni}</td>
                                <td className="px-6 py-4 text-center text-slate-300">{emp.total_hs}h</td>
                                <td className="px-6 py-4 text-right text-emerald-500/80 font-mono">{Utils.fmt(Utils.num(emp.recibo))}</td>
                                <td className="px-6 py-4 text-right text-rose-500/80 font-mono">{Utils.fmt(Utils.num(emp.negro))}</td>
                                <td className="px-6 py-4 text-right font-black text-white bg-slate-900/20 font-mono">{Utils.fmt(Utils.num(emp.costo_total))}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default EmployeesView;