import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const ConfigView = () => {
    const [config, setConfig] = useState({
        LOCAL_NOMBRE: '',
        LOCAL_CUIT: '',
        OBJETIVO_MARGEN: '',
        OBJETIVO_VENTAS: '',
        COMISION_TARJETAS: '',
        COMISION_OTROS: '',
        COMISION_EFECTIVO: '',
        PCT_CARGAS_SOCIALES: '',
        KW_ESTRUCTURAL: '',
        KW_CMV: '',
        ALICUOTA_IVA: '0.21'
    });
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState(null);   // { type: 'ok'|'error', text: string }

    useEffect(() => {
        if (!saveMsg) return;
        const t = setTimeout(() => setSaveMsg(null), 4000);
        return () => clearTimeout(t);
    }, [saveMsg]);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const { data, error } = await supabase
                    .from('config_negocio')
                    .select('*')
                    .eq('id', 1)
                    .single();
                if (!error && data) {
                    setConfig(prev => ({
                        ...prev,
                        LOCAL_NOMBRE: data.local_nombre || '',
                        LOCAL_CUIT: data.local_cuit || '',
                        OBJETIVO_MARGEN: data.objetivo_margen ?? '',
                        OBJETIVO_VENTAS: data.objetivo_ventas ?? '',
                        COMISION_TARJETAS: data.comision_tarjetas ?? '',
                        COMISION_OTROS: data.comision_otros ?? '',
                        COMISION_EFECTIVO: data.comision_efectivo ?? '',
                        PCT_CARGAS_SOCIALES: data.pct_cargas_sociales ?? '',
                        KW_ESTRUCTURAL: data.kw_estructural || '',
                        KW_CMV: data.kw_cmv || '',
                        ALICUOTA_IVA: data.alicuota_iva ?? '0.21',
                    }));
                }
            } catch (err) {
                console.error("Error al cargar config:", err);
            }
        };
        fetchConfig();
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const { error } = await supabase
                .from('config_negocio')
                .update({
                    local_nombre: config.LOCAL_NOMBRE,
                    local_cuit: config.LOCAL_CUIT,
                    objetivo_margen: parseFloat(config.OBJETIVO_MARGEN) || null,
                    objetivo_ventas: parseFloat(config.OBJETIVO_VENTAS) || null,
                    comision_tarjetas: parseFloat(config.COMISION_TARJETAS) || null,
                    comision_otros: parseFloat(config.COMISION_OTROS) || null,
                    comision_efectivo: parseFloat(config.COMISION_EFECTIVO) || null,
                    pct_cargas_sociales: parseFloat(config.PCT_CARGAS_SOCIALES) || null,
                    kw_estructural: config.KW_ESTRUCTURAL,
                    kw_cmv: config.KW_CMV,
                    alicuota_iva: parseFloat(config.ALICUOTA_IVA) || 0.21,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', 1);

            if (!error) {
                setSaveMsg({ type: 'ok', text: 'Configuracion guardada con exito.' });
            } else {
                setSaveMsg({ type: 'error', text: 'Error: ' + error.message });
            }
        } catch (err) {
            setSaveMsg({ type: 'error', text: 'Error: ' + err.message });
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setConfig(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="max-w-2xl mx-auto animate-fade-in">
            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
                <div className="p-8 border-b border-slate-700 bg-slate-900/50">
                    <h2 className="text-xl font-bold text-white mb-1">Configuración del Negocio</h2>
                    <p className="text-sm text-slate-400">Datos globales y objetivos estratégicos.</p>
                </div>

                <form onSubmit={handleSave} className="p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nombre Comercial</label>
                            <input 
                                name="LOCAL_NOMBRE" 
                                value={config.LOCAL_NOMBRE} 
                                onChange={handleChange}
                                placeholder="Ej: Mi Cafetería"
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">CUIT Empresa</label>
                            <input 
                                name="LOCAL_CUIT" 
                                value={config.LOCAL_CUIT} 
                                onChange={handleChange}
                                placeholder="30-XXXXXXXX-X"
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                            />
                        </div>
                    </div>

                    <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-700/50">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-emerald-500/70 uppercase tracking-widest">Objetivo de Margen (Decimal)</label>
                            <p className="text-[9px] text-slate-500">Ej: 0.15 para 15%</p>
                            <input 
                                name="OBJETIVO_MARGEN" 
                                type="number"
                                step="0.01"
                                value={config.OBJETIVO_MARGEN} 
                                onChange={handleChange}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-emerald-200 font-mono focus:ring-2 focus:ring-emerald-500 outline-none transition"
                            />
                        </div>
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Comisiones por Cobro (Decimal: 0.018 = 1.8%)</label>
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <p className="text-[9px] text-slate-500 mb-1">Tarjetas</p>
                                    <input name="COMISION_TARJETAS" type="number" step="0.001" value={config.COMISION_TARJETAS} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono" />
                                </div>
                                <div>
                                    <p className="text-[9px] text-slate-500 mb-1">Otros</p>
                                    <input name="COMISION_OTROS" type="number" step="0.001" value={config.COMISION_OTROS} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono" />
                                </div>
                                <div>
                                    <p className="text-[9px] text-slate-500 mb-1">Efectivo</p>
                                    <input name="COMISION_EFECTIVO" type="number" step="0.001" value={config.COMISION_EFECTIVO} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-700/50">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-orange-400/70 uppercase tracking-widest">Alícuota IVA Ventas (Decimal: 0.21 = 21%)</label>
                            <p className="text-[9px] text-slate-500">21% general — 10.5% alimentos — 27% servicios</p>
                            <input name="ALICUOTA_IVA" type="number" step="0.005" min="0" max="0.27" value={config.ALICUOTA_IVA} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-orange-200 font-mono focus:ring-2 focus:ring-orange-500 outline-none transition" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-violet-400/70 uppercase tracking-widest">Provisión Cargas Sociales (Decimal: 0.33 = 33%)</label>
                            <input name="PCT_CARGAS_SOCIALES" type="number" step="0.01" value={config.PCT_CARGAS_SOCIALES} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-violet-200 font-mono" />
                        </div>
                        
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Auto-Categorización (Palabras separadas por coma)</label>
                            <div className="space-y-3">
                                <div>
                                    <p className="text-[9px] text-slate-500 mb-1 italic">Si el proveedor contiene estas palabras, será "Gasto Fijo/Estructural":</p>
                                    <input name="KW_ESTRUCTURAL" value={config.KW_ESTRUCTURAL} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white" />
                                </div>
                                <div>
                                    <p className="text-[9px] text-slate-500 mb-1 italic">Si el proveedor contiene estas palabras, será "CMV/Materia Prima":</p>
                                    <input name="KW_CMV" value={config.KW_CMV} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-700/40">
                        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                            <span>📊 Coeficientes de Ajuste (IPC / MEP)</span>
                        </h3>
                        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-200/70 leading-relaxed space-y-1">
                            <p>Los coeficientes <span className="font-bold text-amber-300">IPC</span> y <span className="font-bold text-violet-300">Dólar MEP</span> se configuran por período directamente en el <span className="font-bold text-white">Dashboard</span>, en el panel superior derecho.</p>
                            <p className="text-slate-500">Los valores iniciales son estimaciones. Para que la vista "Real IPC" sea confiable, actualizá el coeficiente de cada mes con el dato real publicado por <span className="font-bold text-slate-400">INDEC</span> (indec.gob.ar → IPC Nivel General). El factor es: <span className="font-mono text-slate-300">inflación acumulada desde ese mes hasta hoy</span>.</p>
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-6">
                        <button
                            type="button"
                            onClick={() => {
                                localStorage.clear();
                                window.location.reload();
                            }}
                            className="bg-red-900/30 hover:bg-red-800/40 text-red-400 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition border border-red-700/30"
                        >
                            Limpiar caché
                        </button>
                        <div className="flex items-center gap-3">
                            {saveMsg && (
                                <span className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${saveMsg.type === 'ok' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-red-500/10 border-red-500/25 text-red-400'}`}>
                                    {saveMsg.type === 'ok' ? '✓' : '✗'} {saveMsg.text}
                                </span>
                            )}
                            <button
                                type="submit"
                                disabled={saving}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-emerald-900/40 transition disabled:opacity-50"
                            >
                                {saving ? 'Guardando...' : 'Guardar Configuración'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ConfigView;
