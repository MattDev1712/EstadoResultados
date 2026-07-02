import React from 'react';
import { useFinance } from './FinanceContext';
import FileCard from './FileCard';

const CargaDatosView = ({ onDataReady, setShowStructModal, setShowRetentionsModal, defaultDate }) => {
    const { selectedYear, selectedMonth, configData } = useFinance();

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
                    <FileCard title="Sistema de Ventas (Maxirest PDF)" type="PDF" alicuotaIva={configData?.alicuota_iva ?? 0.21} onDataReady={(d) => onDataReady && onDataReady(d, 'MAXIREST')} />
                    <FileCard title="Facturas de AFIP/ARCA (CSV)" type="CSV" onDataReady={(d) => onDataReady && onDataReady(d, 'ARCA')} />
                    <FileCard title="Planilla de Sueldos (CSV)" type="CSV" parserMode="sueldos" defaultDate={defaultDate} onDataReady={(d) => onDataReady && onDataReady(d, 'SUELDOS')} />
                </div>

                <div className="border-t border-white/5 pt-8 relative z-10">
                    <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-black mb-4">Carga manual de gastos y ajustes</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { title: 'Gastos fijos del local', desc: 'Alquiler, luz, gas, expensas', color: 'border-blue-500/30', hover: 'hover:border-blue-500', action: () => setShowStructModal && setShowStructModal(true), icon: '🏢' },
                            { title: 'Retenciones del mes', desc: 'IVA/Ganancias en tarjetas y apps', color: 'border-amber-500/30', hover: 'hover:border-amber-500', action: () => setShowRetentionsModal && setShowRetentionsModal(true), icon: '🏧' },
                        ].map((card, i) => (
                            <div key={i} onClick={card.action} className={`p-5 rounded-[1.5rem] border ${card.color} bg-slate-900/60 backdrop-blur-sm ${card.hover} cursor-pointer transition-all duration-300 group hover:-translate-y-1 shadow-lg`}>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-2xl opacity-80">{card.icon}</span>
                                    <span className="text-[8px] font-black px-2 py-1 bg-slate-800 rounded-full text-slate-400 group-hover:bg-blue-500/20 group-hover:text-blue-300 transition-colors">+ AGREGAR</span>
                                </div>
                                <h3 className="font-bold text-slate-200 group-hover:text-white transition-colors text-sm">{card.title}</h3>
                                <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{card.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CargaDatosView;