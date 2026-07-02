import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const AuditView = () => {
    const [audit, setAudit] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAudit = async () => {
            try {
                const { data, error } = await supabase
                    .from('audit_log')
                    .select('*')
                    .order('ts', { ascending: false })
                    .limit(100);

                if (!error && Array.isArray(data)) {
                    setAudit(data);
                }
            } catch (err) {
                console.error("Error al cargar auditoria:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchAudit();
    }, []);

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-20 animate-pulse">
            <div className="w-8 h-8 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-black uppercase text-[10px] tracking-widest">Cargando Trazabilidad...</p>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
                <div className="p-8 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-white mb-1">Historial de Cargas y Cambios</h2>
                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em]">Registro de Auditoria de Datos</p>
                    </div>
                    <div className="bg-slate-900 px-4 py-2 rounded-xl border border-white/5">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">Eventos: {audit.length}</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-900/80 text-[10px] text-slate-500 uppercase font-black tracking-widest border-b border-white/5">
                            <tr>
                                <th className="px-6 py-5">Fecha y Hora</th>
                                <th className="px-6 py-5">Accion Ejecutada</th>
                                <th className="px-6 py-5 text-right">Cant.</th>
                                <th className="px-6 py-5">Periodo</th>
                                <th className="px-6 py-5">Autor</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {audit.map((row, i) => (
                                <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="px-6 py-4 text-slate-400 font-mono text-[11px]">
                                        {new Date(row.ts).toLocaleString('es-AR', {
                                            day: '2-digit', month: '2-digit', year: '2-digit',
                                            hour: '2-digit', minute: '2-digit'
                                        })}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-1.5 h-1.5 rounded-full ${
                                                row.action.includes('MAXIREST') ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]' :
                                                row.action.includes('ARCA') ? 'bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.5)]' :
                                                row.action.includes('CONFIG') ? 'bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.5)]' :
                                                'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
                                            }`}></span>
                                            <span className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors">
                                                {row.action.replace('_', ' ')}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-400 group-hover:text-blue-400 transition-colors">
                                        {row.count}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-[10px] font-black px-2 py-1 bg-slate-900 rounded-md border border-white/5 text-slate-500">
                                            {row.period}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-[10px] text-slate-600 font-bold uppercase group-hover:text-slate-400 transition-colors">
                                        {row.user}
                                    </td>
                                </tr>
                            ))}
                            {audit.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-2 opacity-20">
                                            <span className="text-3xl">📋</span>
                                            <p className="text-xs font-bold uppercase tracking-widest">Sin registros historicos</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AuditView;
