import React, { useState } from 'react';

const RetentionsModal = ({ isOpen, onClose, onConfirm, defaultDate }) => {
    const [fields, setFields] = useState([
        { label: 'Retenciones IVA (Tarjetas)', value: '' },
        { label: 'Retenciones IVA (PedidosYa/Rappi)', value: '' },
        { label: 'Retenciones IVA (Bancos)', value: '' },
        { label: 'Percepciones IVA (Facturas compra)', value: '' }
    ]);

    const addCustomField = () => {
        setFields([...fields, { label: 'Otras Retenciones', value: '' }]);
    };

    const handleConfirm = () => {
        const data = fields
            .filter(f => f.value && parseFloat(f.value) !== 0)
            .map(f => {
                const total = Math.abs(parseFloat(f.value));
                return {
                    fecha: defaultDate,
                    tipo_movimiento: 'EGRESO',
                    origen_dato: 'MANUAL',
                    rubro: 'Retenciones',
                    sub_rubro: f.label,
                    importe_total: -total,
                    importe_neto: -total, // En retenciones el neto es igual al total
                    importe_iva: 0,
                    metodo_pago: 'Retención',
                    observaciones: 'Carga manual de retenciones impositivas'
                };
            });
        if (data.length > 0) onConfirm(data, 'MANUAL_COSTS');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md animate-fade-in" onClick={onClose}>
            <div className="bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-card)] w-full max-w-md rounded-[2.5rem] shadow-[0_0_50px_rgba(0,0,0,0.6)] overflow-hidden animate-pop-in pointer-events-auto flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-7 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-sm font-black ring-1 ring-amber-500/30">🏧</span>
                        Retenciones del Mes
                    </h2>
                    <button onClick={onClose} className="text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-all w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/5 active:scale-90">✕</button>
                </div>
                <div className="p-8 max-h-[60vh] overflow-y-auto space-y-4 scrollbar-hide">
                    <p className="text-xs text-slate-400 mb-2">Ingresá los montos de retenciones de IVA que figuran en tus liquidaciones para ajustar la posición fiscal real.</p>
                    {fields.map((field, idx) => (
                        <div key={idx} className="flex flex-col gap-2 p-5 bg-slate-900/60 rounded-3xl border border-white/5 shadow-inner group transition-all hover:bg-slate-900/80">
                            <input 
                                className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] px-1 bg-transparent border-none outline-none"
                                value={field.label}
                                onChange={(e) => {
                                    const newFields = [...fields];
                                    newFields[idx].label = e.target.value;
                                    setFields(newFields);
                                }}
                            />
                            <div className="flex items-baseline gap-2 pt-1">
                                <span className="text-amber-500/50 font-mono text-sm">$</span>
                                <input type="number" placeholder="0.00" value={field.value} onChange={(e) => { const newFields = [...fields]; newFields[idx].value = e.target.value; setFields(newFields); }} className="bg-transparent border-none outline-none text-slate-100 text-2xl font-black font-mono tracking-tighter w-full placeholder:text-slate-800" />
                            </div>
                        </div>
                    ))}
                    <button onClick={addCustomField} className="w-full py-4 rounded-2xl border border-dashed border-slate-700 text-slate-500 hover:text-amber-400 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all text-[10px] font-black uppercase tracking-widest">+ Agregar otra retención</button>
                </div>
                <div className="p-8 bg-white/5 border-t border-white/5 flex gap-4">
                    <button onClick={onClose} className="flex-1 py-4 rounded-2xl border border-slate-700 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all">Cancelar</button>
                    <button onClick={handleConfirm} className="flex-1 py-4 rounded-2xl bg-amber-600 text-white hover:bg-amber-500 transition-all text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-900/40">Guardar Ajustes</button>
                </div>
            </div>
        </div>
    );
};

export default RetentionsModal;