import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { formatters as Utils } from './formatters';
import { useFinance } from './FinanceContext';
import CategoriesView from './CategoriesView';
import { CAT_CONFIG } from './catConfig';
import { supabase } from './supabaseClient';

// ─── Constantes ────────────────────────────────────────────────────────────────

const NC_NAMES = new Set([
    'Nota de Crédito A', 'Nota de Crédito B', 'Nota de Crédito C', 'Nota de Crédito M'
]);

const COMMON_RATES = [2.5, 5, 10.5, 21, 27];

const inferIvaPct = (neto, iva) => {
    const absIva  = Math.abs(Utils.num(iva));
    const absNeto = Math.abs(Utils.num(neto));
    if (absIva === 0) return 0;
    if (absNeto === 0) return null;
    const approx = absIva / absNeto * 100;
    return COMMON_RATES.reduce((best, r) =>
        Math.abs(r - approx) < Math.abs(best - approx) ? r : best
    );
};

const ivaBadgeClass = (pct) => {
    if (pct === 21)   return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    if (pct === 10.5) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    if (pct === 0)    return 'bg-slate-600/30 text-slate-500 border-slate-600/30';
    return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
};

const ivaBadgeLabel = (pct) => pct === 0 ? 'Exento' : `${pct}%`;

export { CAT_CONFIG } from './catConfig';

// ─── Tabla agrupada por proveedor ───────────────────────────────────────────────

const ArcaTable = ({ data, aliasMap = {}, isNC = false, categoriesMap = {} }) => {
    const [expanded, setExpanded] = useState(new Set());

    const grouped = useMemo(() => {
        const map = {};
        Utils.arr(data).forEach(r => {
            const key = r.cuit || r.entidad || 'S/D';
            if (!map[key]) {
                map[key] = {
                    cuit:     r.cuit || '',
                    entidad:  r.entidad || 'S/D',
                    neto:  0, iva: 0, total: 0,
                    facturas: [],
                };
            }
            const alias = aliasMap[r.entidad] || aliasMap[r.cuit];
            if (alias) map[key].alias = alias;

            const neto  = Utils.num(r.neto  ?? r.importe_neto);
            const iva   = Utils.num(r.iva   ?? r.importe_iva);
            const total = Utils.num(r.total ?? r.importe_total);
            map[key].neto  += neto;
            map[key].iva   += iva;
            map[key].total += total;
            map[key].facturas.push({
                fecha:     r.fecha,
                tipo_comp: r.tipo_comp,
                nro_comp:  r.nro_comp,
                neto, iva, total,
                iva_pct:   r.iva_pct,
            });
        });
        return Object.values(map).sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
    }, [data, aliasMap]);

    const totals = useMemo(() => grouped.reduce((acc, g) => {
        acc.neto  += g.neto;
        acc.iva   += g.iva;
        acc.total += g.total;
        return acc;
    }, { neto: 0, iva: 0, total: 0 }), [grouped]);

    const toggle = (key) => setExpanded(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
    });

    return (
        <div>
            {/* Totales */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                    { label: 'Monto sin IVA', val: totals.neto, color: 'text-slate-200' },
                    { label: 'IVA',           val: totals.iva,  color: isNC ? 'text-rose-400' : 'text-emerald-400' },
                    { label: 'Total',         val: totals.total, color: isNC ? 'text-rose-300' : 'text-white' },
                ].map(({ label, val, color }) => (
                    <div key={label} className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                        <p className="section-label !mb-1.5">{label}</p>
                        <h2 className={`text-2xl font-black mt-1 ${color}`}>{Utils.fmt(Math.abs(val))}</h2>
                    </div>
                ))}
            </div>

            {/* Lista agrupada */}
            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
                {/* Header */}
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 bg-slate-900 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                    <span>Proveedor</span>
                    <span className="text-right">Sin IVA</span>
                    <span className="text-right">IVA</span>
                    <span className="text-right w-28">Total</span>
                </div>

                {grouped.length === 0 ? (
                    <div className="px-6 py-10 text-center text-slate-500 italic text-xs">
                        Sin registros para este período.
                    </div>
                ) : grouped.map((g) => {
                    const key   = g.cuit || g.entidad;
                    const open  = expanded.has(key);
                    const cat   = categoriesMap[g.cuit];
                    const catCfg = cat ? CAT_CONFIG[cat] : null;
                    const displayName = g.alias || g.entidad;

                    return (
                        <div key={key} className="border-t border-slate-700">
                            {/* Fila de proveedor */}
                            <button
                                onClick={() => toggle(key)}
                                className="w-full grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3.5 text-left hover:bg-slate-700/30 transition items-center"
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="text-slate-400 text-[10px] shrink-0">{open ? '▼' : '▶'}</span>
                                    <div className="min-w-0">
                                        <span className="font-bold text-slate-200 block truncate">{displayName}</span>
                                        {g.alias && (
                                            <span className="text-[10px] text-slate-500 block truncate">{g.entidad}</span>
                                        )}
                                        <span className="text-[10px] text-slate-600 font-mono">{g.cuit}</span>
                                    </div>
                                    {catCfg && (
                                        <span
                                            className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded border"
                                            style={{ color: catCfg.color, background: catCfg.bg, borderColor: catCfg.color + '50' }}
                                        >
                                            {catCfg.label}
                                        </span>
                                    )}
                                    <span className="shrink-0 text-[10px] text-slate-600 ml-1">{g.facturas.length} fact.</span>
                                </div>
                                <span className="text-right font-mono text-slate-300 text-xs">{Utils.fmt(Math.abs(g.neto))}</span>
                                <span className={`text-right font-mono text-xs ${isNC ? 'text-rose-400/70' : 'text-emerald-500/70'}`}>{Utils.fmt(Math.abs(g.iva))}</span>
                                <span className={`text-right font-bold font-mono text-xs w-28 ${isNC ? 'text-rose-300' : 'text-white'}`}>{Utils.fmt(Math.abs(g.total))}</span>
                            </button>

                            {/* Detalle de facturas */}
                            {open && (
                                <div className="bg-slate-900/50 border-t border-slate-700/50">
                                    {g.facturas.map((f, i) => {
                                        const ivaPct = f.iva_pct != null ? f.iva_pct : inferIvaPct(f.neto, f.iva);
                                        const dateStr = f.fecha ? new Date(f.fecha).toLocaleDateString('es-AR') : 'S/D';
                                        return (
                                            <div
                                                key={i}
                                                className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-3 px-8 py-2.5 text-[11px] items-center border-b border-slate-700/30 last:border-0"
                                            >
                                                <span className="text-slate-600">↳</span>
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="text-slate-400 font-mono whitespace-nowrap">{dateStr}</span>
                                                    <span className="text-slate-500">{f.tipo_comp}</span>
                                                    {f.nro_comp && <span className="text-slate-600 font-mono text-[10px]">{f.nro_comp}</span>}
                                                    {ivaPct !== null && (
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${ivaBadgeClass(ivaPct)}`}>
                                                            {ivaBadgeLabel(ivaPct)}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-right font-mono text-slate-400">{Utils.fmt(Math.abs(f.neto))}</span>
                                                <span className={`text-right font-mono ${isNC ? 'text-rose-400/60' : 'text-emerald-500/60'}`}>{Utils.fmt(Math.abs(f.iva))}</span>
                                                <span className={`text-right font-bold font-mono w-28 ${isNC ? 'text-rose-300/80' : 'text-slate-200'}`}>{Utils.fmt(Math.abs(f.total))}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ─── Tab Proveedores ────────────────────────────────────────────────────────────

const ProvidersTab = ({ arcaData, providers, categoriesMap = {}, onSaveAlias }) => {
    const [editingCuit, setEditingCuit] = useState(null);
    const [aliasInput, setAliasInput]   = useState('');
    const [localAliases, setLocalAliases] = useState({});

    useEffect(() => {
        const map = {};
        providers.forEach(p => { if (p.alias) map[p.nombre] = p.alias; });
        setLocalAliases(map);
    }, [providers]);

    const grouped = useMemo(() => {
        const map = {};
        Utils.arr(arcaData).forEach(r => {
            const key = r.cuit || r.entidad || 'S/D';
            if (!map[key]) {
                map[key] = { cuit: r.cuit || '', nombres: new Set(), total: 0, neto: 0, iva: 0, ivaRates: {}, esNC: false };
            }
            map[key].nombres.add(r.entidad || 'S/D');
            const isNC = NC_NAMES.has(r.tipo_comp);
            const signo = isNC ? -1 : 1;
            map[key].total += Math.abs(Utils.num(r.total ?? r.importe_total)) * signo;
            map[key].neto  += Math.abs(Utils.num(r.neto  ?? r.importe_neto))  * signo;
            map[key].iva   += Math.abs(Utils.num(r.iva   ?? r.importe_iva))   * signo;
            if (!isNC) {
                const rate = r.iva_pct != null ? r.iva_pct : inferIvaPct(r.neto ?? r.importe_neto, r.iva ?? r.importe_iva);
                if (rate !== null && rate > 0) map[key].ivaRates[rate] = (map[key].ivaRates[rate] || 0) + 1;
            }
        });
        return Object.values(map).sort((a, b) => b.total - a.total);
    }, [arcaData]);

    const getAlias = (nombres) => [...nombres].map(n => localAliases[n]).find(a => a) || null;
    const getDisplayName = (cuit, nombres) => getAlias(nombres) || [...nombres][0] || cuit;
    const getDominantRate = (ivaRates) => {
        const entries = Object.entries(ivaRates);
        if (entries.length === 0) return null;
        return parseFloat(entries.sort((a, b) => b[1] - a[1])[0][0]);
    };

    const handleEdit = (cuit, nombres) => { setEditingCuit(cuit); setAliasInput(getAlias(nombres) || ''); };
    const handleSave = async (nombres) => {
        const updated = { ...localAliases };
        [...nombres].forEach(n => { if (aliasInput.trim()) updated[n] = aliasInput.trim(); else delete updated[n]; });
        setLocalAliases(updated);
        setEditingCuit(null);
        await onSaveAlias(updated);
    };
    const handleKeyDown = (e, nombres) => {
        if (e.key === 'Enter')  handleSave(nombres);
        if (e.key === 'Escape') setEditingCuit(null);
    };

    return (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
            <table className="w-full text-xs text-left">
                <thead className="bg-slate-900 text-slate-400 uppercase font-bold">
                    <tr>
                        <th className="px-5 py-4">Proveedor</th>
                        <th className="px-5 py-4">CUIT</th>
                        <th className="px-5 py-4 text-center">Categoría</th>
                        <th className="px-5 py-4 text-center">IVA %</th>
                        <th className="px-5 py-4 text-right">Sin IVA</th>
                        <th className="px-5 py-4 text-right">Total gastado</th>
                        <th className="px-5 py-4 w-24"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                    {grouped.length === 0 ? (
                        <tr><td colSpan="7" className="px-6 py-10 text-center text-slate-500 italic">Sin datos de proveedores.</td></tr>
                    ) : grouped.map((prov) => {
                        const alias        = getAlias(prov.nombres);
                        const displayName  = getDisplayName(prov.cuit, prov.nombres);
                        const dominantRate = getDominantRate(prov.ivaRates);
                        const isEditing    = editingCuit === prov.cuit;
                        const cat          = categoriesMap[prov.cuit];
                        const catCfg       = cat ? CAT_CONFIG[cat] : null;

                        return (
                            <tr key={prov.cuit || displayName} className="hover:bg-slate-700/30 transition">
                                <td className="px-5 py-3">
                                    {isEditing ? (
                                        <div className="flex gap-2 items-center">
                                            <input autoFocus value={aliasInput} onChange={e => setAliasInput(e.target.value)}
                                                onKeyDown={e => handleKeyDown(e, prov.nombres)}
                                                placeholder="Alias del proveedor..."
                                                className="bg-slate-900 border border-blue-500 rounded px-2 py-1 text-white outline-none text-xs w-44" />
                                            <button onClick={() => handleSave(prov.nombres)} className="text-emerald-400 hover:text-emerald-300 font-bold px-1">✓</button>
                                            <button onClick={() => setEditingCuit(null)} className="text-slate-500 hover:text-slate-300 px-1">✕</button>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="font-bold text-slate-200 block">{displayName}</span>
                                            {alias && [...prov.nombres].map(n => (
                                                <span key={n} className="text-[10px] text-slate-500 block">{n}</span>
                                            ))}
                                        </>
                                    )}
                                </td>
                                <td className="px-5 py-3 font-mono text-slate-400">{prov.cuit}</td>
                                <td className="px-5 py-3 text-center">
                                    {catCfg ? (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded border"
                                            style={{ color: catCfg.color, background: catCfg.bg, borderColor: catCfg.color + '50' }}>
                                            {catCfg.label}
                                        </span>
                                    ) : <span className="text-[10px] text-slate-600">—</span>}
                                </td>
                                <td className="px-5 py-3 text-center">
                                    {dominantRate !== null ? (
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${ivaBadgeClass(dominantRate)}`}>
                                            {ivaBadgeLabel(dominantRate)}
                                        </span>
                                    ) : <span className="text-[10px] text-slate-600">—</span>}
                                </td>
                                <td className="px-5 py-3 text-right font-mono text-slate-300">{Utils.fmt(prov.neto)}</td>
                                <td className="px-5 py-3 text-right font-bold text-white font-mono">{Utils.fmt(prov.total)}</td>
                                <td className="px-5 py-3 text-right">
                                    {!isEditing && (
                                        <button onClick={() => handleEdit(prov.cuit, prov.nombres)}
                                            className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-blue-400 transition">
                                            {alias ? 'editar' : '+ alias'}
                                        </button>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

// ─── Vista principal con tabs ───────────────────────────────────────────────────

// ─── Export CSV ─────────────────────────────────────────────────────────────

const CSV_COLUMNS = [
    { key: 'fecha', label: 'Fecha' },
    { key: 'tipo_comp', label: 'Tipo Comprobante' },
    { key: 'nro_comp', label: 'Nro Comprobante' },
    { key: 'cuit', label: 'CUIT' },
    { key: 'entidad', label: 'Proveedor' },
    { key: 'neto', label: 'Neto' },
    { key: 'iva', label: 'IVA' },
    { key: 'total', label: 'Total' },
    { key: 'rubro', label: 'Rubro' },
];

const exportComprasCSV = (rows, periodo) => {
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [
        CSV_COLUMNS.map(c => escape(c.label)).join(','),
        ...rows.map(r => CSV_COLUMNS.map(c => escape(r[c.key])).join(',')),
    ];
    const csv = '﻿' + lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compras_${periodo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};

const ArcaView = ({ data: dataProp }) => {
    const { arcaData, apiUrl, categoriesMap, selectedYear, selectedMonth } = useFinance();
    const data = dataProp ?? arcaData;

    const [activeTab, setActiveTab] = useState('a');
    const [providers, setProviders] = useState([]);

    const aliasMap = useMemo(() => {
        const map = {};
        providers.forEach(p => {
            if (p.alias) {
                map[p.nombre] = p.alias;
                if (p.cuit) map[String(p.cuit)] = p.alias;
            }
        });
        return map;
    }, [providers]);

    const fetchProviders = useCallback(async () => {
        try {
            // Derivar proveedores unicos de compras + categorias/aliases
            const { data: categorias } = await supabase.from('categorias').select('*');
            const aliasMap = {};
            (categorias || []).forEach(c => { if (c.alias) aliasMap[c.cuit] = c.alias; });

            // Obtener CUITs unicos de arcaData
            const cuitsSet = new Set();
            Utils.arr(data).forEach(r => { if (r.cuit) cuitsSet.add(r.cuit); });

            const list = [...cuitsSet].map(cuit => {
                const item = Utils.arr(data).find(r => r.cuit === cuit);
                return {
                    cuit,
                    nombre: item?.entidad || cuit,
                    alias: aliasMap[cuit] || '',
                };
            });
            setProviders(list);
        } catch (e) { console.warn('fetchProviders:', e); }
    }, [data]);

    useEffect(() => { fetchProviders(); }, [fetchProviders]);

    const saveAliases = useCallback(async (aliasesMap) => {
        try {
            // Actualizar alias en la tabla categorias
            for (const [nombre, alias] of Object.entries(aliasesMap)) {
                // Buscar el CUIT asociado a este nombre en los datos
                const item = Utils.arr(data).find(r => r.entidad === nombre);
                if (item?.cuit) {
                    await supabase
                        .from('categorias')
                        .upsert({ cuit: item.cuit, alias: alias || null, categoria: categoriesMap[item.cuit] || '' }, { onConflict: 'cuit' });
                }
            }
            fetchProviders();
        } catch (e) { console.warn('saveAliases:', e); }
    }, [data, categoriesMap, fetchProviders]);

    const facturasA = useMemo(() =>
        Utils.arr(data).filter(r => r.tipo_comp === 'Factura A' || r.tipo_comp === '1'), [data]);

    const otros = useMemo(() =>
        Utils.arr(data).filter(r =>
            !NC_NAMES.has(r.tipo_comp) && r.tipo_comp !== 'Factura A' && r.tipo_comp !== '1'
        ), [data]);

    const nc = useMemo(() =>
        Utils.arr(data).filter(r => NC_NAMES.has(r.tipo_comp)), [data]);

    if (dataProp !== undefined) {
        return (
            <div className="animate-fade-in mt-4">
                <ArcaTable data={data} aliasMap={aliasMap} categoriesMap={categoriesMap} />
            </div>
        );
    }

    const TABS = [
        { key: 'a',    label: 'Facturas con IVA', count: facturasA.length },
        { key: 'otros',label: 'Otros gastos',      count: otros.length    },
        { key: 'nc',   label: 'Devoluciones',      count: nc.length       },
        { key: 'prov', label: 'Proveedores',        count: null            },
        { key: 'cat',  label: '🏷️ Categorías',     count: null            },
    ];

    return (
        <div className="animate-fade-in mt-4">
            {/* Tab bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="flex flex-wrap gap-1 bg-slate-900 p-1 rounded-xl border border-slate-700 w-fit">
                {TABS.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setActiveTab(t.key)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                            activeTab === t.key
                                ? 'bg-blue-600 text-white shadow'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                    >
                        {t.label}
                        {t.key === 'nc' && nc.length > 0 && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${activeTab === 'nc' ? 'bg-rose-800' : 'bg-rose-900/60 text-rose-400'}`}>
                                {nc.length}
                            </span>
                        )}
                        {t.key !== 'nc' && t.count !== null && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${activeTab === t.key ? 'bg-blue-800' : 'bg-slate-700'}`}>
                                {t.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>
            <button
                onClick={() => exportComprasCSV(data, `${selectedYear}_${selectedMonth}`)}
                disabled={data.length === 0}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
                ⬇ Exportar CSV ({data.length})
            </button>
            </div>

            {/* Contenido */}
            {activeTab === 'cat' ? (
                <CategoriesView initialProviders={providers} onProvidersChange={setProviders} />
            ) : activeTab === 'prov' ? (
                <ProvidersTab arcaData={data} providers={providers} categoriesMap={categoriesMap} onSaveAlias={saveAliases} />
            ) : activeTab === 'nc' ? (
                <ArcaTable data={nc} aliasMap={aliasMap} categoriesMap={categoriesMap} isNC={true} />
            ) : activeTab === 'otros' ? (
                <ArcaTable data={otros} aliasMap={aliasMap} categoriesMap={categoriesMap} />
            ) : (
                <ArcaTable data={facturasA} aliasMap={aliasMap} categoriesMap={categoriesMap} />
            )}
        </div>
    );
};

// ─── Vistas derivadas ───────────────────────────────────────────────────────────

export const StructuralCostsView = ({ data: dataProp }) => {
    const { arcaData } = useFinance();
    const raw = dataProp ?? arcaData;
    const filtered = useMemo(() => Utils.arr(raw)
        .filter(row => row.rubro === 'Costos Estructurales')
        .map(row => ({
            ...row,
            entidad:   (row.entidad && row.entidad !== 'Consumidor Final') ? row.entidad : (row.sub_rubro || 'Gasto Estructural'),
            tipo_comp: row.tipo_comp || row.metodo_pago || 'Servicio/Gasto',
            nro_comp:  row.nro_comp || 'Carga Manual',
            neto:      row.neto  ?? row.importe_neto,
            iva:       row.iva   ?? row.importe_iva,
            total:     row.total ?? row.importe_total
        })), [raw]);
    return <ArcaView data={filtered} />;
};

export const RetentionsView = ({ data: dataProp }) => {
    const { arcaData } = useFinance();
    const raw = dataProp ?? arcaData;
    const filtered = useMemo(() => Utils.arr(raw)
        .filter(row => row.rubro === 'Retenciones')
        .map(row => ({
            ...row,
            entidad:   (row.entidad && row.entidad !== 'Consumidor Final') ? row.entidad : (row.sub_rubro || 'Retención'),
            tipo_comp: row.tipo_comp || 'Certificado',
            nro_comp:  row.nro_comp || 'Manual',
            neto:      row.neto  ?? row.importe_neto,
            iva:       row.iva   ?? row.importe_iva,
            total:     row.total ?? row.importe_total
        })), [raw]);
    return <ArcaView data={filtered} />;
};

export default ArcaView;
