import React, { useState, useEffect, useMemo } from 'react';
import { useFinance } from './FinanceContext';
import { CAT_CONFIG } from './catConfig';

const CATEGORIES = [
    { id: 'PROVEEDOR',  label: 'CMV',       ...CAT_CONFIG.PROVEEDOR  },
    { id: 'GASTO_FIJO', label: 'Gasto Fijo',...CAT_CONFIG.GASTO_FIJO },
    { id: 'NO_APTO',    label: 'No Apto',   ...CAT_CONFIG.NO_APTO    },
];

const CategoriesView = ({ initialProviders, onProvidersChange }) => {
    const { apiUrl, categoriesMap: contextCategoriesMap, fetchCategoriesMap } = useFinance();
    const [providers, setProviders] = useState(initialProviders || []);
    const [categoriesMap, setCategoriesMap] = useState(contextCategoriesMap);
    const [filter, setFilter] = useState('');
    const [saveMsg, setSaveMsg] = useState(null);
    const [saving, setSaving] = useState(false);

    // Sincronizar providers si el padre los tiene
    useEffect(() => {
        if (initialProviders && initialProviders.length > 0) {
            setProviders(initialProviders);
        }
    }, [initialProviders]);

    // Fetch propio solo si el padre no pasó providers
    useEffect(() => {
        if (initialProviders && initialProviders.length > 0) return;
        if (!apiUrl) return;
        fetch(`${apiUrl}?action=GET_PROVIDERS`)
            .then(r => r.json())
            .then(list => {
                if (Array.isArray(list)) {
                    setProviders(list);
                    onProvidersChange?.(list);
                }
            })
            .catch(e => console.warn('CategoriesView fetchProviders:', e));
    }, [apiUrl]); // eslint-disable-line react-hooks/exhaustive-deps

    // Sincronizar categoriesMap del context
    useEffect(() => {
        setCategoriesMap(contextCategoriesMap);
    }, [contextCategoriesMap]);

    useEffect(() => {
        if (!saveMsg) return;
        const t = setTimeout(() => setSaveMsg(null), 4000);
        return () => clearTimeout(t);
    }, [saveMsg]);

    const handleCategoryChange = (cuit, categoria) => {
        setCategoriesMap(prev => ({ ...prev, [cuit]: categoria }));
    };

    const saveCategories = async () => {
        setSaving(true);
        const payload = Object.entries(categoriesMap).map(([cuit, categoria]) => ({ cuit, categoria }));
        try {
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'CARGAR_DATOS', origen: 'SAVE_CATEGORIES', payload })
            }).then(r => r.json());
            if (res.status === 'OK') {
                setSaveMsg({ type: 'ok', text: 'Guardado.' });
                fetchCategoriesMap();
            } else {
                setSaveMsg({ type: 'error', text: 'Error al guardar.' });
            }
        } catch (e) {
            setSaveMsg({ type: 'error', text: 'Error: ' + e.message });
        } finally {
            setSaving(false);
        }
    };

    const filteredProviders = useMemo(() =>
        providers.filter(p =>
            p.nombre.toLowerCase().includes(filter.toLowerCase()) ||
            p.cuit.includes(filter)
        ), [providers, filter]);

    return (
        <div className="animate-fade-in space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-base font-bold text-[var(--text-primary)]">Categorización de Proveedores</h2>
                    <p className="text-xs text-[var(--text-dim)] mt-0.5">Asigná cada proveedor a una categoría para el análisis del P&L.</p>
                </div>
                <div className="flex items-center gap-3">
                    {saveMsg && (
                        <span className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${
                            saveMsg.type === 'ok'
                                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                                : 'bg-red-500/10 border-red-500/25 text-red-400'
                        }`}>
                            {saveMsg.type === 'ok' ? '✓' : '✗'} {saveMsg.text}
                        </span>
                    )}
                    <button
                        onClick={saveCategories}
                        disabled={saving}
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all disabled:opacity-60"
                    >
                        {saving ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                </div>
            </div>

            {/* Búsqueda */}
            <input
                type="text"
                placeholder="Buscar por nombre o CUIT..."
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-mid)] rounded-xl px-4 py-2 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-blue-500 transition"
                value={filter}
                onChange={e => setFilter(e.target.value)}
            />

            {/* Leyenda */}
            <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">
                <span>Categorías:</span>
                {CATEGORIES.map(cat => (
                    <span key={cat.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg border"
                        style={{ color: cat.color, background: cat.bg, borderColor: cat.color + '40' }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: cat.color }} />
                        {cat.label}
                    </span>
                ))}
            </div>

            {/* Tabla compacta */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2.5 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">
                    <span>Proveedor</span>
                    <span className="text-center w-64">Categoría</span>
                    <span className="text-right w-20">Limpiar</span>
                </div>

                {filteredProviders.length === 0 ? (
                    <div className="py-12 text-center text-[var(--text-dim)] text-sm">
                        {providers.length === 0 ? 'Cargando proveedores...' : 'Sin coincidencias.'}
                    </div>
                ) : filteredProviders.map((p, i) => {
                    const currentCat = categoriesMap[p.cuit] || '';
                    const catCfg = currentCat ? CAT_CONFIG[currentCat] : null;

                    return (
                        <div
                            key={p.cuit}
                            className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2.5 items-center border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-surface)]/50 transition"
                            style={catCfg ? { borderLeft: `3px solid ${catCfg.color}40` } : { borderLeft: '3px solid transparent' }}
                        >
                            {/* Nombre + CUIT */}
                            <div className="min-w-0">
                                <span className="font-semibold text-sm text-[var(--text-primary)] block truncate" title={p.nombre}>
                                    {p.alias || p.nombre}
                                </span>
                                <span className="text-[10px] text-[var(--text-faint)] font-mono">{p.cuit}</span>
                            </div>

                            {/* Selector de categoría */}
                            <div className="flex items-center gap-1.5 w-64">
                                {CATEGORIES.map(cat => {
                                    const active = currentCat === cat.id;
                                    return (
                                        <button
                                            key={cat.id}
                                            onClick={() => handleCategoryChange(p.cuit, cat.id)}
                                            className="flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all"
                                            style={{
                                                color:       active ? 'white' : cat.color,
                                                background:  active ? cat.color : cat.bg,
                                                borderColor: cat.color + (active ? 'ff' : '60'),
                                            }}
                                        >
                                            {cat.label}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Quitar */}
                            <div className="text-right w-20">
                                {currentCat && (
                                    <button
                                        onClick={() => handleCategoryChange(p.cuit, '')}
                                        className="text-[10px] text-[var(--text-faint)] hover:text-[var(--text-dim)] transition font-bold uppercase tracking-wider"
                                    >
                                        Quitar
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default CategoriesView;
