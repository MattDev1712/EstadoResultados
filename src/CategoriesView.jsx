import React, { useState, useEffect, useCallback } from 'react';
import { useFinance } from './FinanceContext';

const CATEGORIES = ['CMV', 'Estructural', 'Honorarios', 'IIBB', 'Otros'];

const CATEGORY_COLORS = {
    'CMV':          '#f59e0b',
    'Estructural':  '#06b6d4',
    'Honorarios':   '#8b5cf6',
    'IIBB':         '#f97316',
    'Otros':        '#64748b',
};

/**
 * Pantalla para asignar una categoría de gasto a cada CUIT de proveedor.
 * La clasificación por CUIT tiene prioridad sobre los keywords del nombre.
 * Así, si un proveedor cambia de razón social, la categoría se mantiene.
 */
const CategoriesView = () => {
    const { apiUrl } = useFinance();
    const finalApiUrl = apiUrl?.startsWith('https://') ? apiUrl : apiUrl ? `https://script.google.com/macros/s/${apiUrl}/exec` : '';

    const [providers, setProviders] = useState([]);
    const [catMap, setCatMap] = useState({});    // { cuit: categoria }
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [filter, setFilter] = useState('');

    // Cargar proveedores con CUIT y mapa actual de categorías
    const fetchData = useCallback(async () => {
        if (!finalApiUrl) return;
        setLoading(true);
        try {
            const [provRes, catRes] = await Promise.all([
                fetch(`${finalApiUrl}?action=GET_PROVIDERS`),
                fetch(`${finalApiUrl}?action=GET_CATEGORIES_MAP`),
            ]);
            const provData = await provRes.json();
            const catData  = await catRes.json();

            // provData: [{nombre, alias, cuit}]
            // catData: [{cuit, categoria}] o {}
            setProviders(Array.isArray(provData) ? provData : []);

            const map = {};
            if (Array.isArray(catData)) {
                catData.forEach(({ cuit, categoria }) => { if (cuit) map[cuit] = categoria; });
            } else if (catData && typeof catData === 'object') {
                Object.entries(catData).forEach(([cuit, categoria]) => { map[cuit] = categoria; });
            }
            setCatMap(map);
        } catch (e) {
            console.error('Error cargando datos de categorías:', e);
        } finally {
            setLoading(false);
        }
    }, [finalApiUrl]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleCategoryChange = (cuit, categoria) => {
        setCatMap(prev => ({ ...prev, [cuit]: categoria }));
        setSaved(false);
    };

    const handleSave = async () => {
        if (!finalApiUrl) return;
        setSaving(true);
        try {
            const payload = Object.entries(catMap)
                .filter(([cuit, cat]) => cuit && cat)
                .map(([cuit, categoria]) => ({ cuit, categoria }));

            const res = await fetch(finalApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'CARGAR_DATOS', origen: 'SAVE_CATEGORIES', payload }),
            });
            const data = await res.json();
            if (data.status === 'OK') setSaved(true);
        } catch (e) {
            console.error('Error guardando categorías:', e);
        } finally {
            setSaving(false);
        }
    };

    const filtered = providers.filter(p =>
        !filter ||
        (p.nombre || '').toLowerCase().includes(filter.toLowerCase()) ||
        (p.cuit || '').includes(filter)
    );

    const unclassified = providers.filter(p => p.cuit && !catMap[p.cuit]).length;

    if (!finalApiUrl) return (
        <div style={{ padding: 40, textAlign: 'center', color: '#475569' }}>
            <p>Configurá primero el ID de despliegue en la pantalla de Carga.</p>
        </div>
    );

    return (
        <div className="animate-fade-in" style={{ paddingBottom: 40 }}>

            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.2em', color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                    Clasificación de Proveedores
                </p>
                <h2 style={{ fontSize: 22, fontWeight: 900, color: '#f1f5f9', letterSpacing: '-0.03em', marginBottom: 8 }}>
                    Categorías por CUIT
                </h2>
                <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.7 }}>
                    Asigná una categoría a cada proveedor usando su CUIT. Esta clasificación tiene <strong style={{ color: '#e2e8f0' }}>prioridad permanente</strong> sobre el nombre —
                    si el proveedor cambia razón social, la categoría se mantiene.
                </p>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
                {CATEGORIES.map(cat => {
                    const count = Object.values(catMap).filter(c => c === cat).length;
                    return (
                        <div key={cat} style={{
                            background: '#0b1121', border: `1px solid ${CATEGORY_COLORS[cat]}25`,
                            borderLeft: `3px solid ${CATEGORY_COLORS[cat]}`,
                            borderRadius: 12, padding: '12px 14px'
                        }}>
                            <p style={{ fontSize: 20, fontWeight: 900, color: CATEGORY_COLORS[cat], margin: '0 0 2px', lineHeight: 1 }}>{count}</p>
                            <p style={{ fontSize: 10, color: '#475569', margin: 0, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{cat}</p>
                        </div>
                    );
                })}
            </div>

            {/* Alerta si hay sin clasificar */}
            {unclassified > 0 && (
                <div style={{
                    marginBottom: 16, padding: '12px 16px', borderRadius: 12,
                    background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
                    display: 'flex', alignItems: 'center', gap: 10
                }}>
                    <span style={{ fontSize: 16 }}>⚠️</span>
                    <p style={{ fontSize: 12, color: '#fcd34d', margin: 0 }}>
                        <strong>{unclassified}</strong> {unclassified === 1 ? 'proveedor sin categoría asignada' : 'proveedores sin categoría asignada'}.
                        Sus egresos están cayendo en "Otros" y pueden afectar la precisión del resultado.
                    </p>
                </div>
            )}

            {/* Barra de búsqueda + guardar */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
                <input
                    type="text"
                    placeholder="Buscar por nombre o CUIT..."
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    style={{
                        flex: 1, background: '#0b1121', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 10, padding: '10px 14px', color: '#e2e8f0', fontSize: 12,
                        outline: 'none'
                    }}
                />
                <button
                    onClick={handleSave}
                    disabled={saving || saved}
                    style={{
                        padding: '10px 20px', borderRadius: 10, fontSize: 11, fontWeight: 900,
                        border: 'none', cursor: saving || saved ? 'default' : 'pointer',
                        background: saved ? '#10b981' : '#3b82f6',
                        color: 'white', transition: 'all 0.2s', letterSpacing: '0.05em',
                        opacity: saving ? 0.7 : 1,
                        boxShadow: saved ? '0 4px 12px rgba(16,185,129,0.3)' : '0 4px 12px rgba(59,130,246,0.3)'
                    }}
                >
                    {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar cambios'}
                </button>
            </div>

            {/* Tabla */}
            <div style={{ background: '#0b1121', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden' }}>
                {/* Header */}
                <div style={{
                    display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr',
                    padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)',
                    background: 'rgba(255,255,255,0.02)'
                }}>
                    {['Proveedor / Razón Social', 'CUIT', 'Categoría de Gasto'].map(h => (
                        <span key={h} style={{ fontSize: 9, fontWeight: 900, color: '#334155', letterSpacing: '0.18em', textTransform: 'uppercase' }}>{h}</span>
                    ))}
                </div>

                {loading ? (
                    <div style={{ padding: 40, textAlign: 'center', color: '#334155' }}>
                        <div style={{ width: 28, height: 28, border: '2px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
                        <p style={{ fontSize: 11 }}>Cargando proveedores...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: '#334155', fontSize: 12 }}>
                        {providers.length === 0 ? 'No hay proveedores registrados aún. Cargá comprobantes ARCA primero.' : 'Ningún proveedor coincide con la búsqueda.'}
                    </div>
                ) : filtered.map((prov, i) => {
                    const currentCat = catMap[prov.cuit] || '';
                    return (
                        <div
                            key={prov.cuit || i}
                            style={{
                                display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr',
                                padding: '12px 20px', alignItems: 'center',
                                borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                                background: currentCat ? 'transparent' : 'rgba(245,158,11,0.02)',
                                transition: 'background 0.15s'
                            }}
                        >
                            {/* Nombre */}
                            <div>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>
                                    {prov.alias || prov.nombre}
                                </span>
                                {prov.alias && prov.nombre !== prov.alias && (
                                    <span style={{ fontSize: 10, color: '#475569', display: 'block' }}>{prov.nombre}</span>
                                )}
                            </div>

                            {/* CUIT */}
                            <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748b' }}>
                                {prov.cuit || <span style={{ color: '#334155', fontStyle: 'italic' }}>Sin CUIT</span>}
                            </span>

                            {/* Selector de categoría */}
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {prov.cuit ? CATEGORIES.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => handleCategoryChange(prov.cuit, currentCat === cat ? '' : cat)}
                                        style={{
                                            padding: '3px 9px', borderRadius: 6, fontSize: 9, fontWeight: 900,
                                            border: `1px solid ${currentCat === cat ? CATEGORY_COLORS[cat] : 'rgba(255,255,255,0.07)'}`,
                                            background: currentCat === cat ? `${CATEGORY_COLORS[cat]}20` : 'transparent',
                                            color: currentCat === cat ? CATEGORY_COLORS[cat] : '#334155',
                                            cursor: 'pointer', transition: 'all 0.15s', letterSpacing: '0.08em',
                                            textTransform: 'uppercase'
                                        }}
                                    >
                                        {cat}
                                    </button>
                                )) : (
                                    <span style={{ fontSize: 10, color: '#334155', fontStyle: 'italic' }}>
                                        Solo disponible para comprobantes ARCA
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <p style={{ fontSize: 10, color: '#334155', marginTop: 14, textAlign: 'center' }}>
                Los cambios se guardan en tu Google Sheets y aplican al próximo cálculo del Dashboard.
            </p>
        </div>
    );
};

export default CategoriesView;
