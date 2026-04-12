import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { formatters as Utils } from './formatters';
import { useFinance } from './FinanceContext';
import CategoriesView from './CategoriesView';

// ─── Constantes ────────────────────────────────────────────────────────────────

const NC_NAMES = new Set([
    'Nota de Crédito A', 'Nota de Crédito B', 'Nota de Crédito C', 'Nota de Crédito M'
]);

const COMMON_RATES = [2.5, 5, 10.5, 21, 27];

// Para datos ya guardados (sin iva_pct original), snappea al rate estándar más cercano
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

// ─── Tabla genérica ─────────────────────────────────────────────────────────────

const ArcaTable = ({ data, aliasMap = {}, isNC = false }) => {
    const totals = useMemo(() => Utils.arr(data).reduce((acc, r) => {
        acc.neto  += Utils.num(r.neto  ?? r.importe_neto);
        acc.iva   += Utils.num(r.iva   ?? r.importe_iva);
        acc.total += Utils.num(r.total ?? r.importe_total);
        return acc;
    }, { neto: 0, iva: 0, total: 0 }), [data]);

    return (
        <div>
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                    <p className="section-label !mb-1.5">Monto sin IVA</p>
                    <h2 className="text-2xl font-black text-slate-200 mt-1">{Utils.fmt(Math.abs(totals.neto))}</h2>
                </div>
                <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                    <p className="section-label !mb-1.5">IVA</p>
                    <h2 className={`text-2xl font-black mt-1 ${isNC ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {Utils.fmt(Math.abs(totals.iva))}
                    </h2>
                </div>
                <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                    <p className="section-label !mb-1.5">Total</p>
                    <h2 className={`text-2xl font-black mt-1 ${isNC ? 'text-rose-300' : 'text-white'}`}>
                        {Utils.fmt(Math.abs(totals.total))}
                        {isNC && <span className="text-xs font-normal text-slate-500 ml-2">a favor</span>}
                    </h2>
                </div>
            </div>

            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
                <table className="w-full text-xs text-left">
                    <thead className="bg-slate-900 text-slate-400 uppercase font-bold">
                        <tr>
                            <th className="px-4 py-3">Fecha</th>
                            <th className="px-4 py-3">Proveedor</th>
                            <th className="px-4 py-3">Comprobante</th>
                            <th className="px-4 py-3">IVA %</th>
                            <th className="px-4 py-3 text-right">Sin IVA</th>
                            <th className="px-4 py-3 text-right">IVA</th>
                            <th className="px-4 py-3 text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {Utils.arr(data).length === 0 ? (
                            <tr>
                                <td colSpan="7" className="px-6 py-10 text-center text-slate-500 italic">
                                    Sin registros para este período.
                                </td>
                            </tr>
                        ) : Utils.arr(data).map((row, i) => {
                            const neto  = row.neto  ?? row.importe_neto;
                            const iva   = row.iva   ?? row.importe_iva;
                            const total = row.total ?? row.importe_total;

                            const ivaPct = row.iva_pct != null
                                ? row.iva_pct
                                : inferIvaPct(neto, iva);

                            const alias = aliasMap[row.entidad] || aliasMap[row.cuit];
                            const displayName = alias || row.entidad;
                            const dateStr = row.fecha
                                ? new Date(row.fecha).toLocaleDateString('es-AR')
                                : 'S/D';

                            return (
                                <tr key={i} className={`hover:bg-slate-700/30 transition ${isNC ? 'bg-rose-950/10' : ''}`}>
                                    <td className="px-4 py-3 text-slate-400 font-mono whitespace-nowrap">{dateStr}</td>
                                    <td className="px-4 py-3">
                                        <span className="font-bold text-slate-200 block">{displayName}</span>
                                        {alias && (
                                            <span className="text-[10px] text-slate-500 block">{row.entidad}</span>
                                        )}
                                        <span className="text-[10px] text-slate-600 font-mono block">{row.cuit}</span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-400">
                                        <span className="block">{row.tipo_comp}</span>
                                        <span className="font-mono text-slate-500">{row.nro_comp}</span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {ivaPct !== null && (
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${ivaBadgeClass(ivaPct)}`}>
                                                {ivaBadgeLabel(ivaPct)}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right text-slate-300 font-mono">
                                        {Utils.fmt(Math.abs(Utils.num(neto)))}
                                    </td>
                                    <td className={`px-4 py-3 text-right font-mono ${isNC ? 'text-rose-400/70' : 'text-emerald-500/70'}`}>
                                        {Utils.fmt(Math.abs(Utils.num(iva)))}
                                    </td>
                                    <td className={`px-4 py-3 text-right font-bold font-mono ${isNC ? 'text-rose-300' : 'text-white'}`}>
                                        {Utils.fmt(Math.abs(Utils.num(total)))}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ─── Tab Proveedores ────────────────────────────────────────────────────────────

const ProvidersTab = ({ arcaData, providers, onSaveAlias }) => {
    const [editingCuit, setEditingCuit] = useState(null);
    const [aliasInput, setAliasInput]   = useState('');

    // Mapa nombre → alias (desde el backend, editable localmente)
    const [localAliases, setLocalAliases] = useState({});

    useEffect(() => {
        const map = {};
        providers.forEach(p => { if (p.alias) map[p.nombre] = p.alias; });
        setLocalAliases(map);
    }, [providers]);

    // Agrupar arcaData por CUIT (excluye NC del total de compras)
    const grouped = useMemo(() => {
        const map = {};
        Utils.arr(arcaData).forEach(r => {
            const key = r.cuit || r.entidad || 'S/D';
            if (!map[key]) {
                map[key] = {
                    cuit:      r.cuit || '',
                    nombres:   new Set(),
                    total:     0,
                    neto:      0,
                    iva:       0,
                    ivaRates:  {},   // { rate: count }
                    esNC:      false
                };
            }
            map[key].nombres.add(r.entidad || 'S/D');

            const isNC = NC_NAMES.has(r.tipo_comp);
            const signo = isNC ? -1 : 1;   // NC reduce el total del proveedor

            map[key].total += Math.abs(Utils.num(r.total ?? r.importe_total)) * signo;
            map[key].neto  += Math.abs(Utils.num(r.neto  ?? r.importe_neto))  * signo;
            map[key].iva   += Math.abs(Utils.num(r.iva   ?? r.importe_iva))   * signo;

            if (!isNC) {
                const rate = r.iva_pct != null
                    ? r.iva_pct
                    : inferIvaPct(r.neto ?? r.importe_neto, r.iva ?? r.importe_iva);
                if (rate !== null && rate > 0) {
                    map[key].ivaRates[rate] = (map[key].ivaRates[rate] || 0) + 1;
                }
            }
        });
        return Object.values(map).sort((a, b) => b.total - a.total);
    }, [arcaData]);

    const getAlias = (nombres) =>
        [...nombres].map(n => localAliases[n]).find(a => a) || null;

    const getDisplayName = (cuit, nombres) =>
        getAlias(nombres) || [...nombres][0] || cuit;

    const getDominantRate = (ivaRates) => {
        const entries = Object.entries(ivaRates);
        if (entries.length === 0) return null;
        return parseFloat(entries.sort((a, b) => b[1] - a[1])[0][0]);
    };

    const handleEdit = (cuit, nombres) => {
        setEditingCuit(cuit);
        setAliasInput(getAlias(nombres) || '');
    };

    const handleSave = async (nombres) => {
        const updated = { ...localAliases };
        [...nombres].forEach(n => {
            if (aliasInput.trim()) updated[n] = aliasInput.trim();
            else delete updated[n];
        });
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
                        <th className="px-5 py-4 text-center">¿Cuánto IVA paga?</th>
                        <th className="px-5 py-4 text-right">Monto sin IVA</th>
                        <th className="px-5 py-4 text-right">Total gastado</th>
                        <th className="px-5 py-4 w-24"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                    {grouped.length === 0 ? (
                        <tr>
                            <td colSpan="6" className="px-6 py-10 text-center text-slate-500 italic">
                                Sin datos de proveedores.
                            </td>
                        </tr>
                    ) : grouped.map((prov) => {
                        const alias        = getAlias(prov.nombres);
                        const displayName  = getDisplayName(prov.cuit, prov.nombres);
                        const dominantRate = getDominantRate(prov.ivaRates);
                        const isEditing    = editingCuit === prov.cuit;

                        return (
                            <tr key={prov.cuit || displayName} className="hover:bg-slate-700/30 transition">
                                <td className="px-5 py-3">
                                    {isEditing ? (
                                        <div className="flex gap-2 items-center">
                                            <input
                                                autoFocus
                                                value={aliasInput}
                                                onChange={e => setAliasInput(e.target.value)}
                                                onKeyDown={e => handleKeyDown(e, prov.nombres)}
                                                placeholder="Alias del proveedor..."
                                                className="bg-slate-900 border border-blue-500 rounded px-2 py-1 text-white outline-none text-xs w-44"
                                            />
                                            <button
                                                onClick={() => handleSave(prov.nombres)}
                                                className="text-emerald-400 hover:text-emerald-300 font-bold px-1"
                                            >✓</button>
                                            <button
                                                onClick={() => setEditingCuit(null)}
                                                className="text-slate-500 hover:text-slate-300 px-1"
                                            >✕</button>
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
                                    {dominantRate !== null ? (
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${ivaBadgeClass(dominantRate)}`}>
                                            {ivaBadgeLabel(dominantRate)}
                                        </span>
                                    ) : (
                                        <span className="text-[10px] text-slate-600">—</span>
                                    )}
                                </td>
                                <td className="px-5 py-3 text-right font-mono text-slate-300">
                                    {Utils.fmt(prov.neto)}
                                </td>
                                <td className="px-5 py-3 text-right font-bold text-white font-mono">
                                    {Utils.fmt(prov.total)}
                                </td>
                                <td className="px-5 py-3 text-right">
                                    {!isEditing && (
                                        <button
                                            onClick={() => handleEdit(prov.cuit, prov.nombres)}
                                            className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-blue-400 transition"
                                        >
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

const ArcaView = ({ data: dataProp }) => {
    const { arcaData, apiUrl } = useFinance();
    const data = dataProp ?? arcaData;

    const [activeTab, setActiveTab] = useState('a');
    const [providers, setProviders] = useState([]);

    // Mapa nombre/cuit → alias para mostrar en las tablas
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
        if (!apiUrl) return;
        try {
            const res  = await fetch(`${apiUrl}?action=GET_PROVIDERS`);
            const list = await res.json();
            if (Array.isArray(list)) setProviders(list);
        } catch (e) { console.warn('fetchProviders:', e); }
    }, [apiUrl]);

    useEffect(() => { fetchProviders(); }, [fetchProviders]);

    const saveAliases = useCallback(async (aliasesMap) => {
        if (!apiUrl) return;
        const payload = Object.entries(aliasesMap).map(([nombre, alias]) => ({ nombre, alias }));
        try {
            await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'CARGAR_DATOS', origen: 'SAVE_ALIASES', payload })
            });
            fetchProviders();
        } catch (e) { console.warn('saveAliases:', e); }
    }, [apiUrl, fetchProviders]);

    // Segmentar datos
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
                <ArcaTable data={data} aliasMap={aliasMap} />
            </div>
        );
    }

    const TABS = [
        { key: 'a',    label: 'Facturas con IVA',    count: facturasA.length },
        { key: 'otros',label: 'Otros gastos',       count: otros.length    },
        { key: 'nc',   label: 'Devoluciones',        count: nc.length       },
        { key: 'prov', label: 'Proveedores',          count: null            },
        { key: 'cat',  label: '🏷️ Categorías',       count: null            },
    ];

    const ncBadge = nc.length > 0
        ? <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-rose-800/60 text-rose-300">{nc.length}</span>
        : null;

    return (
        <div className="animate-fade-in mt-4">
            {/* Tab bar */}
            <div className="flex flex-wrap gap-1 mb-6 bg-slate-900 p-1 rounded-xl border border-slate-700 w-fit">
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

            {/* Contenido */}
            {activeTab === 'cat' ? (
                <CategoriesView />
            ) : activeTab === 'prov' ? (
                <ProvidersTab
                    arcaData={data}
                    providers={providers}
                    onSaveAlias={saveAliases}
                />
            ) : activeTab === 'nc' ? (
                <ArcaTable data={nc} aliasMap={aliasMap} isNC={true} />
            ) : activeTab === 'otros' ? (
                <ArcaTable data={otros} aliasMap={aliasMap} />
            ) : (
                <ArcaTable data={facturasA} aliasMap={aliasMap} />
            )}
        </div>
    );
};

// ─── Vistas derivadas (sin cambios en su interfaz) ──────────────────────────────



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
