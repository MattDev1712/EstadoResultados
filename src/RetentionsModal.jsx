import React, { useState } from 'react';

/**
 * Modal para cargar retenciones bancarias del mes.
 * Las retenciones de IVA y Ganancias que realizan los bancos/apps
 * sobre los pagos acreditados no aparecen en ARCA — deben cargarse manualmente.
 */
const RetentionsModal = ({ isOpen, onClose, onConfirm, defaultDate }) => {
    const [fields, setFields] = useState([
        { label: 'Retención IVA — Tarjetas', value: '' },
        { label: 'Retención Ganancias — Tarjetas', value: '' },
        { label: 'Retención IVA — Apps Delivery', value: '' },
        { label: 'Retención Ganancias — Apps Delivery', value: '' },
        { label: 'Otras Retenciones', value: '' },
    ]);
    const [customDate, setCustomDate] = useState(defaultDate || '');

    const total = fields.reduce((sum, f) => sum + (parseFloat(f.value) || 0), 0);

    const handleConfirm = () => {
        const data = fields
            .filter(f => f.value && parseFloat(f.value) > 0)
            .map(f => {
                const importe = Math.abs(parseFloat(f.value));
                return {
                    fecha: customDate || defaultDate,
                    tipo_movimiento: 'EGRESO',
                    origen_dato: 'MANUAL',
                    rubro: 'Retenciones',
                    sub_rubro: f.label,
                    importe_total: -importe,
                    importe_neto: -importe,
                    importe_iva: 0,
                    metodo_pago: 'Retención Bancaria',
                    observaciones: 'Retención bancaria — carga manual'
                };
            });
        if (data.length > 0) onConfirm(data, 'MANUAL_COSTS');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-800 border border-slate-700 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-fade-in">

                {/* Header */}
                <div className="p-6 border-b border-slate-700 flex justify-between items-center"
                    style={{ background: 'linear-gradient(135deg, rgba(244,63,94,0.08) 0%, rgba(15,23,42,0.4) 100%)' }}>
                    <div>
                        <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Retenciones Bancarias</p>
                        <h2 className="text-xl font-bold text-white tracking-tight">Retenciones del Mes</h2>
                        <p className="text-[11px] text-slate-500 mt-1">Los montos que el banco retiene sobre lo acreditado.</p>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700">✕</button>
                </div>

                {/* Fecha */}
                <div className="px-6 pt-5 pb-2 flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fecha de Imputación</span>
                    <input type="date" value={customDate} onChange={e => setCustomDate(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono outline-none focus:ring-2 focus:ring-rose-500/40 transition" />
                </div>

                {/* Campos */}
                <div className="px-6 pb-4 space-y-3">
                    {fields.map((f, idx) => (
                        <div key={idx} className="flex items-center gap-3 group">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.12em] w-48 shrink-0 group-hover:text-slate-400 transition-colors leading-tight">
                                {f.label}
                            </span>
                            <div className="flex-1 flex items-baseline gap-1 bg-slate-900/60 px-3 py-2 rounded-xl border border-slate-700/60 focus-within:border-rose-500/50 transition-all">
                                <span className="text-rose-700 font-mono text-xs">$</span>
                                <input type="number" min="0" value={f.value}
                                    onChange={e => { const n = [...fields]; n[idx].value = e.target.value; setFields(n); }}
                                    placeholder="0.00"
                                    className="bg-transparent border-none outline-none text-slate-200 w-full font-mono text-sm placeholder:text-slate-700" />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Total */}
                {total > 0 && (
                    <div className="mx-6 mb-4 p-3 rounded-xl flex justify-between items-center"
                        style={{ background: 'rgba(244,63,94,0.05)', border: '1px solid rgba(244,63,94,0.2)' }}>
                        <span className="text-xs font-black text-rose-400 uppercase tracking-widest">Total Retenciones</span>
                        <span className="text-lg font-black text-rose-300 font-mono tracking-tight">
                            ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                )}

                {/* Info */}
                <div className="mx-6 mb-4 p-3 rounded-xl" style={{ background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.1)' }}>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                        💡 Encontrás estos montos en el <strong className="text-slate-400">extracto bancario</strong> o en 
                        los comprobantes de retención que emiten las procesadoras de tarjetas y las apps de delivery.
                    </p>
                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-900/50 border-t border-slate-700 flex gap-4">
                    <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-400 text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-all">
                        Cancelar
                    </button>
                    <button onClick={handleConfirm} disabled={total === 0}
                        className="flex-1 py-3 rounded-xl text-white text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background: total > 0 ? '#f43f5e' : '#374151', boxShadow: total > 0 ? '0 4px 14px rgba(244,63,94,0.25)' : 'none' }}>
                        Registrar Retenciones
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RetentionsModal;
