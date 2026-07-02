import React, { useState, useEffect, useMemo } from 'react';
import { useFinance } from './FinanceContext';
import { CAT_CONFIG } from './catConfig';
import { supabase } from './supabaseClient';

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
    const [activeTab, setActiveTab] = useState(''); // '' es 'Sin Asignar'
    const [saveMsg, setSaveMsg] = useState(null);
    const [saving, setSaving] = useState(false);

    // Sincronizar providers si el padre los tiene
    useEffect(() => {
        if (initialProviders && initialProviders.length > 0) {
            setProviders(initialProviders);
        }
    }, [initialProviders]);

    // Fetch propio solo si el padre no paso providers
    useEffect(() => {
        if (initialProviders && initialProviders.length > 0) return;
        (async () => {
            try {
                const { data: categorias } = await supabase.from('categorias').select('*');
                if (Array.isArray(categorias)) {
                    const list = categorias.map(c => ({
                        cuit: c.cuit,
                        nombre: c.alias || c.cuit,
                        alias: c.alias || '',
                    }));
                    setProviders(list);
                    onProvidersChange?.(list);
                }
            } catch (e) { console.warn('CategoriesView fetchProviders:', e); }
        })();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        try {
            const upserts = Object.entries(categoriesMap)
                .filter(([, cat]) => cat)
                .map(([cuit, categoria]) => ({ cuit, categoria }));

            const { error } = await supabase
                .from('categorias')
                .upsert(upserts, { onConflict: 'cuit' });

            if (!error) {
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

    const TABS = [
        { id: '', label: 'Sin Asignar', color: '#64748b', bg: '#f1f5f9' },
        ...CATEGORIES
    ];

    const tabsData = useMemo(() => {
        return TABS.map(tab => {
            const count = providers.filter(p => (categoriesMap[p.cuit] || '') === tab.id).length;
            return { ...tab, count };
        });
    }, [providers, categoriesMap]);

    const filteredProviders = useMemo(() => {
        return providers.filter(p => {
            const matchesFilter = p.nombre.toLowerCase().includes(filter.toLowerCase()) || p.cuit.includes(filter);
            const pCat = categoriesMap[p.cuit] || '';
            const matchesTab = pCat === activeTab;
            return matchesFilter && matchesTab;
        });
    }, [providers, filter, categoriesMap, activeTab]);

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
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-mid)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-blue-500 transition shadow-sm"
                value={filter}
                onChange={e => setFilter(e.target.value)}
            />

            {/* Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-subtle)] pb-4">
                {tabsData.map(tab => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                                isActive 
                                ? 'bg-[var(--bg-card)] border-[var(--border-mid)] text-[var(--text-primary)] shadow-sm' 
                                : 'bg-transparent border-transparent text-[var(--text-dim)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]'
                            }`}
                        >
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full" style={{ background: isActive ? tab.color : 'currentColor', opacity: isActive ? 1 : 0.6 }} />
                                {tab.label}
                            </div>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] ${isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-dim)]'}`}>
                                {tab.count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Tabla compacta */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl overflow-hidden shadow-sm">
                {/* Header */}
                <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2.5 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">
                    <span>Proveedor</span>
                    <span className="text-center w-64">Categoría</span>
                    <span className="text-right w-20">Acción</span>
                </div>

                {filteredProviders.length === 0 ? (
                    <div className="py-12 text-center text-[var(--text-dim)] text-sm">
                        {providers.length === 0 ? 'Cargando proveedores...' : 'No hay proveedores en esta pestaña.'}
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
                                            className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                                                active ? 'opacity-100 shadow-sm scale-[1.02]' : 'opacity-75 hover:opacity-100 hover:scale-[1.02]'
                                            }`}
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
                                        className="text-[10px] text-[var(--text-faint)] hover:text-red-400 transition font-bold uppercase tracking-wider px-2 py-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg hover:border-red-400/30"
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
