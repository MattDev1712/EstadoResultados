import React, { useState, useEffect, useMemo } from 'react';
import { useFinance } from './FinanceContext';
import { formatters as Utils } from './formatters';
import Card from './components/Card';

const CategoriesView = () => {
    const { apiUrl, loading, setLoading, categoriesMap: contextCategoriesMap, fetchCategoriesMap } = useFinance();
    const [providers, setProviders] = useState([]);
    const [categoriesMap, setCategoriesMap] = useState(contextCategoriesMap);
    const [filter, setFilter] = useState('');
    const [saveMsg, setSaveMsg] = useState(null); // { type: 'ok'|'error', text: string }
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!saveMsg) return;
        const t = setTimeout(() => setSaveMsg(null), 4000);
        return () => clearTimeout(t);
    }, [saveMsg]);

    const CATEGORIES = [
        { id: 'PROVEEDOR', label: 'Proveedor (CMV)', color: '#10b981' },
        { id: 'GASTO_FIJO', label: 'Gasto Fijo (Estructural)', color: '#3b82f6' },
        { id: 'NO_APTO', label: 'Gasto No Apto (Personal)', color: '#f43f5e' },
    ];

    // Sincronizar con el mapa del context (ej: al cambiar de período)
    useEffect(() => {
        setCategoriesMap(contextCategoriesMap);
    }, [contextCategoriesMap]);

    useEffect(() => {
        const loadProviders = async () => {
            setLoading(true);
            try {
                const pRes = await fetch(`${apiUrl}?action=GET_PROVIDERS`).then(r => r.json());
                setProviders(pRes);
            } catch (e) {
                console.error("Error loading providers:", e);
            } finally {
                setLoading(false);
            }
        };
        if (apiUrl) loadProviders();
    }, [apiUrl]);

    const handleCategoryChange = (cuit, categoria) => {
        setCategoriesMap(prev => ({ ...prev, [cuit]: categoria }));
    };

    const saveCategories = async () => {
        setSaving(true);
        const payload = Object.entries(categoriesMap).map(([cuit, categoria]) => ({ cuit, categoria }));
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'CARGAR_DATOS', origen: 'SAVE_CATEGORIES', payload })
            });
            const res = await response.json();
            if (res.status === 'OK') {
                setSaveMsg({ type: 'ok', text: 'Categorías guardadas correctamente.' });
                fetchCategoriesMap();
            } else {
                setSaveMsg({ type: 'error', text: 'Error al guardar.' });
            }
        } catch (e) {
            setSaveMsg({ type: 'error', text: 'Error al guardar: ' + e.message });
        } finally {
            setSaving(false);
        }
    };

    const filteredProviders = useMemo(() => {
        return providers.filter(p => 
            p.nombre.toLowerCase().includes(filter.toLowerCase()) || 
            p.cuit.includes(filter)
        );
    }, [providers, filter]);

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-[var(--text-primary)]">Categorización de Proveedores</h2>
                    <p className="text-sm text-[var(--text-dim)]">Asigna cada proveedor a una categoría para el análisis del P&L.</p>
                </div>
                <div className="flex items-center gap-3">
                    {saveMsg && (
                        <span className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${saveMsg.type === 'ok' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-red-500/10 border-red-500/25 text-red-400'}`}>
                            {saveMsg.type === 'ok' ? '✓' : '✗'} {saveMsg.text}
                        </span>
                    )}
                    <button
                        onClick={saveCategories}
                        disabled={saving}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg transition-all"
                    >
                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </div>

            <Card className="p-4">
                <input
                    type="text"
                    placeholder="Buscar por nombre o CUIT..."
                    className="w-full bg-[var(--bg-surface)] border border-[var(--border-mid)] rounded-xl px-4 py-2 text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-blue-500 transition"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                />
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProviders.map(p => {
                    const currentCat = categoriesMap[p.cuit] || '';
                    return (
                        <div key={p.cuit} className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-card)] flex flex-col gap-3">
                            <div>
                                <p className="text-xs font-black text-[var(--text-dim)] uppercase tracking-widest">{p.cuit}</p>
                                <h3 className="font-bold text-[var(--text-primary)] truncate" title={p.nombre}>{p.alias || p.nombre}</h3>
                            </div>
                            <div className="flex flex-col gap-2">
                                {CATEGORIES.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => handleCategoryChange(p.cuit, cat.id)}
                                        className={`flex items-center gap-3 px-3 py-2 rounded-xl border transition-all text-xs font-bold ${
                                            currentCat === cat.id 
                                            ? 'border-transparent text-white shadow-md shadow-black/20' 
                                            : 'border-[var(--border-mid)] text-[var(--text-dim)] hover:bg-[var(--bg-surface)]'
                                        }`}
                                        style={{ backgroundColor: currentCat === cat.id ? cat.color : 'transparent' }}
                                    >
                                        <span className={`w-2 h-2 rounded-full ${currentCat === cat.id ? 'bg-white' : ''}`} style={{ backgroundColor: currentCat === cat.id ? 'white' : cat.color }} />
                                        {cat.label}
                                    </button>
                                ))}
                                <button
                                    onClick={() => handleCategoryChange(p.cuit, '')}
                                    className={`text-[10px] uppercase tracking-widest font-bold mt-1 text-center ${!currentCat ? 'text-blue-400' : 'text-[var(--text-faint)] hover:text-[var(--text-dim)]'}`}
                                >
                                    {currentCat ? 'Quitar Categoría' : 'Sin Categorizar'}
                                </button>
                            </div>
                        </div>
                    );
                })}
                {filteredProviders.length === 0 && (
                    <div className="col-span-full py-12 text-center text-[var(--text-dim)]">
                        No se encontraron proveedores que coincidan con la búsqueda.
                    </div>
                )}
            </div>
        </div>
    );
};

export default CategoriesView;