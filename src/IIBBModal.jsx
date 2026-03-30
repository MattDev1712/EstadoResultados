import React, { useState } from 'react';

/**
 * Modal para cargar el pago mensual de Ingresos Brutos.
 * Crea un egreso con rubro = 'IIBB' que el backend acumula en una categoría propia.
 */
const IIBBModal = ({ isOpen, onClose, onConfirm, defaultDate }) => {
    const [jurisdicciones, setJurisdicciones] = useState([
        { label: 'IIBB Local', value: '' },
        { label: 'IIBB Convenio Multilateral', value: '' },
    ]);
    const [customDate, setCustomDate] = useState(defaultDate || '');

    const total = jurisdicciones.reduce((sum, j) => sum + (parseFloat(j.value) || 0), 0);

    const handleConfirm = () => {
        const data = jurisdicciones
            .filter(j => j.value && parseFloat(j.value) > 0)
            .map(j => {
                const importe = Math.abs(parseFloat(j.value));
                return {
                    fecha: customDate || defaultDate,
                    tipo_movimiento: 'EGRESO',
                    origen_dato: 'MANUAL',
                    rubro: 'IIBB',
                    sub_rubro: j.label,
                    importe_total: -importe,
                    importe_neto: -importe,
                    importe_iva: 0,
                    metodo_pago: 'Transferencia/Débito',
                    observaciones: 'Pago Ingresos Brutos — carga manual'
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
                    style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.08) 0%, rgba(15,23,42,0.4) 100%)' }}>
                    <div>
                        <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1">Impuesto Provincial</p>
                        <h2 className="text-xl font-bold text-white tracking-tight">Ingresos Brutos</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700">✕</button>
                </div>

                {/* Fecha */}
                <div className="px-6 pt-5 pb-2 flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fecha de Pago</span>
                    <input
                        type="date"
                        value={customDate}
                        onChange={(e) => setCustomDate(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono outline-none focus:ring-2 focus:ring-orange-500/40 transition"
                    />
                </div>

                {/* Jurisdicciones */}
                <div className="px-6 pb-4 space-y-3">
                    {jurisdicciones.map((j, idx) => (
                        <div key={idx} className="flex items-center gap-3 group">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] w-40 shrink-0 group-hover:text-slate-400 transition-colors">
                                {j.label}
                            </span>
                            <div className="flex-1 flex items-baseline gap-1 bg-slate-900/60 px-3 py-2 rounded-xl border border-slate-700/60 focus-within:border-orange-500/50 transition-all">
                                <span className="text-orange-600 font-mono text-xs">$</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={j.value}
                                    onChange={(e) => {
                                        const n = [...jurisdicciones];
                                        n[idx].value = e.target.value;
                                        setJurisdicciones(n);
                                    }}
                                    placeholder="0.00"
                                    className="bg-transparent border-none outline-none text-slate-200 w-full font-mono text-sm placeholder:text-slate-700"
                                />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Total */}
                {total > 0 && (
                    <div className="mx-6 mb-4 p-3 rounded-xl bg-orange-500/5 border border-orange-500/20 flex justify-between items-center">
                        <span className="text-xs font-black text-orange-400 uppercase tracking-widest">Total IIBB a imputar</span>
                        <span className="text-lg font-black text-orange-300 font-mono tracking-tight">
                            ${total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                )}

                {/* Footer */}
                <div className="p-6 bg-slate-900/50 border-t border-slate-700 flex gap-4">
                    <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-400 text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-all">
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={total === 0}
                        className="flex-1 py-3 rounded-xl text-white text-xs font-bold uppercase tracking-widest transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background: total > 0 ? '#f97316' : '#374151', boxShadow: total > 0 ? '0 4px 14px rgba(249,115,22,0.25)' : 'none' }}
                    >
                        Registrar Pago
                    </button>
                </div>
            </div>
        </div>
    );
};

export default IIBBModal;
