import React, { useState, useEffect, useCallback } from 'react';
import { useFinance } from './FinanceContext';
import { formatters as Utils } from './formatters';

/**
 * Gestión de Activos Fijos y cálculo de amortización mensual.
 * La amortización = valor_original / vida_util_meses por cada mes activo.
 */
const AssetsView = () => {
    const { apiUrl } = useFinance();
    const finalApiUrl = apiUrl?.startsWith('https://') ? apiUrl : apiUrl ? `https://script.google.com/macros/s/${apiUrl}/exec` : '';

    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ nombre: '', fecha_compra: new Date().toISOString().split('T')[0], valor: '', vida_util: '', notas: '' });

    const fetchAssets = useCallback(async () => {
        if (!finalApiUrl) return;
        setLoading(true);
        try {
            const res = await fetch(`${finalApiUrl}?action=GET_ASSETS`);
            const data = await res.json();
            setAssets(Array.isArray(data) ? data : []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [finalApiUrl]);

    useEffect(() => { fetchAssets(); }, [fetchAssets]);

    const totalAmortMensual = assets.reduce((sum, a) => {
        const v = parseFloat(a.valor) || 0;
        const vida = parseInt(a.vida_util) || 1;
        return sum + v / vida;
    }, 0);

    const handleSave = async () => {
        if (!form.nombre || !form.valor || !form.vida_util) return;
        setSaving(true);
        try {
            const res = await fetch(finalApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'CARGAR_DATOS',
                    origen: 'SAVE_ASSET',
                    payload: [{ ...form, valor: parseFloat(form.valor), vida_util: parseInt(form.vida_util) }]
                })
            });
            const data = await res.json();
            if (data.status === 'OK') {
                setShowForm(false);
                setForm({ nombre: '', fecha_compra: new Date().toISOString().split('T')[0], valor: '', vida_util: '', notas: '' });
                fetchAssets();
            }
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    const handleDelete = async (uuid) => {
        if (!window.confirm('¿Eliminar este activo?')) return;
        try {
            await fetch(finalApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'CARGAR_DATOS', origen: 'DELETE_ASSET', payload: [{ uuid }] })
            });
            fetchAssets();
        } catch (e) { console.error(e); }
    };

    const inputStyle = {
        background: '#0b1121', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
        padding: '9px 12px', color: '#e2e8f0', fontSize: 12, outline: 'none', width: '100%',
        fontFamily: 'inherit'
    };

    return (
        <div className="animate-fade-in" style={{ paddingBottom: 40 }}>

            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.2em', color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>Fase 2</p>
                <h2 style={{ fontSize: 22, fontWeight: 900, color: '#f1f5f9', letterSpacing: '-0.03em', marginBottom: 8 }}>Activos Fijos y Amortizaciones</h2>
                <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.7 }}>
                    Registrá tus equipos y mobiliario. Cada mes el sistema calcula automáticamente cuánto de ese activo "consumiste" (amortización)
                    y lo resta del resultado como egreso real.
                </p>
            </div>

            {/* KPI total */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
                <div style={{ background: '#0b1121', border: '1px solid rgba(139,92,246,0.2)', borderLeft: '3px solid #8b5cf6', borderRadius: 14, padding: '16px 20px' }}>
                    <p style={{ fontSize: 10, fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 6 }}>Amortización Mensual Total</p>
                    <p style={{ fontSize: 26, fontWeight: 900, color: '#8b5cf6', letterSpacing: '-0.04em', margin: 0 }}>{Utils.fmt(totalAmortMensual)}</p>
                    <p style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>Impacta en el resultado cada mes</p>
                </div>
                <div style={{ background: '#0b1121', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '16px 20px' }}>
                    <p style={{ fontSize: 10, fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 6 }}>Activos registrados</p>
                    <p style={{ fontSize: 26, fontWeight: 900, color: '#e2e8f0', letterSpacing: '-0.04em', margin: 0 }}>{assets.length}</p>
                </div>
                <div style={{ background: '#0b1121', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '16px 20px' }}>
                    <p style={{ fontSize: 10, fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 6 }}>Amortización Anual</p>
                    <p style={{ fontSize: 26, fontWeight: 900, color: '#64748b', letterSpacing: '-0.04em', margin: 0 }}>{Utils.fmt(totalAmortMensual * 12)}</p>
                </div>
            </div>

            {/* Botón agregar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                <button
                    onClick={() => setShowForm(!showForm)}
                    style={{
                        padding: '9px 18px', borderRadius: 10, fontSize: 11, fontWeight: 900,
                        background: showForm ? 'rgba(255,255,255,0.05)' : '#8b5cf6',
                        color: showForm ? '#64748b' : 'white', border: 'none', cursor: 'pointer',
                        boxShadow: showForm ? 'none' : '0 4px 12px rgba(139,92,246,0.3)',
                        letterSpacing: '0.05em', transition: 'all 0.2s'
                    }}
                >
                    {showForm ? '✕ Cancelar' : '+ Agregar Activo'}
                </button>
            </div>

            {/* Formulario */}
            {showForm && (
                <div style={{
                    background: '#0b1121', border: '1px solid rgba(139,92,246,0.2)',
                    borderRadius: 16, padding: '24px', marginBottom: 16
                }}>
                    <p style={{ fontSize: 11, fontWeight: 900, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 18 }}>Nuevo Activo Fijo</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <div>
                            <label style={{ fontSize: 9, fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>Nombre del Activo</label>
                            <input style={inputStyle} placeholder="Ej: Máquina La Marzocco" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} />
                        </div>
                        <div>
                            <label style={{ fontSize: 9, fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>Fecha de Compra</label>
                            <input type="date" style={inputStyle} value={form.fecha_compra} onChange={e => setForm(p => ({ ...p, fecha_compra: e.target.value }))} />
                        </div>
                        <div>
                            <label style={{ fontSize: 9, fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>Valor Original ($)</label>
                            <input type="number" style={inputStyle} placeholder="6000000" value={form.valor} onChange={e => setForm(p => ({ ...p, valor: e.target.value }))} />
                        </div>
                        <div>
                            <label style={{ fontSize: 9, fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>Vida Útil (meses)</label>
                            <input type="number" style={inputStyle} placeholder="60" value={form.vida_util} onChange={e => setForm(p => ({ ...p, vida_util: e.target.value }))} />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
                        <input style={inputStyle} placeholder="Notas (opcional)" value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} />
                        {form.valor && form.vida_util && (
                            <div style={{ textAlign: 'right', minWidth: 160 }}>
                                <p style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Amortización mensual</p>
                                <p style={{ fontSize: 18, fontWeight: 900, color: '#8b5cf6', margin: 0 }}>
                                    {Utils.fmt((parseFloat(form.valor) || 0) / (parseInt(form.vida_util) || 1))}
                                </p>
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                        <button
                            onClick={handleSave}
                            disabled={saving || !form.nombre || !form.valor || !form.vida_util}
                            style={{
                                padding: '10px 22px', borderRadius: 10, fontSize: 11, fontWeight: 900,
                                background: '#8b5cf6', color: 'white', border: 'none', cursor: 'pointer',
                                opacity: (saving || !form.nombre || !form.valor || !form.vida_util) ? 0.5 : 1,
                                boxShadow: '0 4px 12px rgba(139,92,246,0.3)'
                            }}
                        >
                            {saving ? 'Guardando...' : 'Guardar Activo'}
                        </button>
                    </div>
                </div>
            )}

            {/* Tabla de activos */}
            <div style={{ background: '#0b1121', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
                    {['Activo', 'Comprado', 'Valor Original', 'Vida Útil', 'Amort. Mensual', ''].map(h => (
                        <span key={h} style={{ fontSize: 9, fontWeight: 900, color: '#334155', letterSpacing: '0.18em', textTransform: 'uppercase' }}>{h}</span>
                    ))}
                </div>
                {loading ? (
                    <div style={{ padding: 40, textAlign: 'center', color: '#334155', fontSize: 12 }}>Cargando activos...</div>
                ) : assets.length === 0 ? (
                    <div style={{ padding: 48, textAlign: 'center' }}>
                        <p style={{ fontSize: 32, marginBottom: 12 }}>🏭</p>
                        <p style={{ fontSize: 12, color: '#334155' }}>No hay activos registrados. Agregá tu primera máquina o equipo.</p>
                    </div>
                ) : assets.map((a, i) => {
                    const amortM = (parseFloat(a.valor) || 0) / (parseInt(a.vida_util) || 1);
                    const fechaCompra = a.fecha_compra ? new Date(a.fecha_compra + 'T12:00:00').toLocaleDateString('es-AR') : '—';
                    return (
                        <div key={a.uuid || i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', padding: '14px 20px', alignItems: 'center', borderBottom: i < assets.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                            <div>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{a.nombre}</span>
                                {a.notas && <span style={{ fontSize: 10, color: '#475569', display: 'block' }}>{a.notas}</span>}
                            </div>
                            <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{fechaCompra}</span>
                            <span style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>{Utils.fmt(parseFloat(a.valor) || 0)}</span>
                            <span style={{ fontSize: 12, color: '#64748b' }}>{a.vida_util} meses</span>
                            <span style={{ fontSize: 13, fontWeight: 800, color: '#8b5cf6', fontFamily: 'monospace' }}>{Utils.fmt(amortM)}</span>
                            <button onClick={() => handleDelete(a.uuid)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#334155', fontSize: 14, padding: '4px 8px', borderRadius: 6, transition: 'all 0.15s' }}
                                onMouseEnter={e => e.target.style.color = '#f43f5e'} onMouseLeave={e => e.target.style.color = '#334155'}>✕</button>
                        </div>
                    );
                })}
            </div>

            <p style={{ fontSize: 10, color: '#334155', marginTop: 14, textAlign: 'center' }}>
                Las amortizaciones se calculan automáticamente y aparecen en el Dashboard cada mes que el activo está en uso.
            </p>
        </div>
    );
};

export default AssetsView;
