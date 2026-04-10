import React, { useState, useEffect } from 'react';
import { useFinance } from './FinanceContext';

const ConfigView = () => {
    const { apiUrl, setApiUrl, finalApiUrl } = useFinance();
    const [urlInput, setUrlInput] = useState(apiUrl);
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
        KW_CMV: ''
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchConfig = async () => {
            if (!finalApiUrl) return;
            try {
                const res = await fetch(`${finalApiUrl}?action=GET_BUSINESS_CONFIG`);
                const data = await res.json();
                if (data && typeof data === 'object') {
                    setConfig(prev => ({ ...prev, ...data }));
                }
            } catch (err) {
                console.error("Error al cargar config:", err);
            }
        };
        fetchConfig();
    }, [apiUrl]);

    const handleCopyShareLink = () => {
        if (!apiUrl) return alert("Primero vinculá la URL del backend.");
        const base = window.location.origin + window.location.pathname;
        const link = `${base}?apiUrl=${encodeURIComponent(apiUrl)}`;
        navigator.clipboard.writeText(link).then(() => alert("✅ Link copiado. Compartilo y el backend se configura automáticamente."));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!finalApiUrl) return alert("API no configurada");
        setSaving(true);
        try {
            const res = await fetch(finalApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'CARGAR_DATOS', origen: 'SAVE_BUSINESS_CONFIG', payload: config })
            });
            const data = await res.json();
            if (data.status === 'OK') {
                alert("✅ Configuración guardada con éxito en Google Sheets.");
            } else {
                alert("❌ Error: " + (data.message || "Desconocido"));
            }
        } catch (err) {
            alert("❌ Error de red: " + err.message);
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

                    <div className="pt-6 grid grid-cols-1 gap-6 border-t border-slate-700/50">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-violet-400">Provisión Cargas Sociales (Decimal: 0.33 = 33%)</label>
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

                    <div className="pt-6 border-t border-slate-700/40">
                        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                            <span>🔌 Conexión Técnica</span>
                            <span className="text-[9px] font-normal text-slate-400 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded uppercase tracking-tighter">Avanzado</span>
                        </h3>
                        <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-700/30">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">URL de Despliegue (AppScript)</label>
                                <div className="flex gap-3">
                                    <input
                                        type="text"
                                        value={urlInput}
                                        onChange={(e) => setUrlInput(e.target.value)}
                                        placeholder="https://script.google.com/macros/s/.../exec"
                                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-mono text-blue-300 focus:ring-1 focus:ring-blue-500 outline-none transition"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            localStorage.setItem('gas_api_url', urlInput);
                                            setApiUrl(urlInput);
                                            alert("✅ URL de Despliegue actualizada correctamente.");
                                        }}
                                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition border border-slate-700"
                                    >
                                        Vincular
                                    </button>
                                    {apiUrl && (
                                        <button
                                            type="button"
                                            onClick={handleCopyShareLink}
                                            className="bg-blue-900/40 hover:bg-blue-800/50 text-blue-300 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition border border-blue-700/40"
                                        >
                                            Copiar link
                                        </button>
                                    )}
                                </div>
                                {(() => {
                                    const match = apiUrl?.match(/\/macros\/s\/([^/]+)\/exec/);
                                    const id = match?.[1];
                                    if (!id) return null;
                                    return (
                                        <div className="flex items-center gap-2 px-1 mt-2">
                                            <span className="text-[9px] text-slate-500 uppercase tracking-widest">ID activo:</span>
                                            <span className="font-mono text-[11px]">
                                                <span className="text-blue-400 font-bold">{id.slice(0, 4)}</span>
                                                <span className="text-slate-500">{id.slice(4, -4)}</span>
                                                <span className="text-blue-400 font-bold">{id.slice(-4)}</span>
                                            </span>
                                        </div>
                                    );
                                })()}
                                <p className="text-[9px] text-slate-500 leading-relaxed italic px-1 mt-1">Pegá la URL completa que termina en <span className="text-slate-400 font-mono">/exec</span>. Usá <span className="text-blue-400">Copiar link</span> para compartir la app — el receptor se conecta automáticamente sin configuración.</p>
                            </div>
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
                        <button
                            type="submit"
                            disabled={saving}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-emerald-900/40 transition disabled:opacity-50"
                        >
                            {saving ? 'Guardando...' : 'Guardar Configuración'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ConfigView;
