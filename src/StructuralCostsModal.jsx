import React, { useState } from 'react';

const StructuralCostsModal = ({ isOpen, onClose, onConfirm, defaultDate, alicuotaIva = 0.21 }) => {
    const [fields, setFields] = useState([
        { label: 'Alquiler Local', value: '' },
        { label: 'Luz', value: '' },
        { label: 'Servicios', value: '' },
        { label: 'Expensas', value: '' }
    ]);

    const addAlquilerField = () => {
        const alquilerCount = fields.filter(f => f.label.toLowerCase().includes('alquiler')).length;
        const nextLabel = `Alquiler ${alquilerCount + 1}`;
        setFields([...fields, { label: nextLabel, value: '' }]);
    };

    const handleConfirm = () => {
        const data = fields
            .filter(f => f.value && parseFloat(f.value) !== 0)
            .map(f => {
                const total = Math.abs(parseFloat(f.value));
                const neto = total / (1 + alicuotaIva);
                const iva = total - neto;
                return {
                    fecha: defaultDate,
                    tipo_movimiento: 'EGRESO',
                    origen_dato: 'MANUAL',
                    rubro: 'Costos Estructurales',
                    sub_rubro: f.label,
                    importe_total: -total,
                    importe_neto: -neto,
                    importe_iva: -iva,
                    metodo_pago: 'Transferencia/Débito',
                    observaciones: 'Carga manual'
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
                        <span className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-black ring-1 ring-blue-500/30">🏢</span>
                        Gastos Fijos Local
                    </h2>
                    <button onClick={onClose} className="text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-all w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/5 active:scale-90">✕</button>
                </div>
                <div className="p-8 max-h-[60vh] overflow-y-auto space-y-4 scrollbar-hide">
                    {fields.map((field, idx) => (
                        <div key={idx} className="flex flex-col gap-2 p-5 bg-slate-900/60 rounded-3xl border border-white/5 shadow-inner group transition-all hover:bg-slate-900/80">
                            <label className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] px-1">{field.label}</label>
                            <div className="flex items-baseline gap-2 pt-1">
                                <span className="text-blue-500/50 font-mono text-sm">$</span>
                                <input 
                                    type="number"
                                    placeholder="0.00"
                                    value={field.value}
                                    onChange={(e) => {
                                        const newFields = [...fields];
                                        newFields[idx].value = e.target.value;
                                        setFields(newFields);
                                    }}
                                    className="bg-transparent border-none outline-none text-slate-100 text-2xl font-black font-mono tracking-tighter w-full placeholder:text-slate-800"
                                />
                            </div>
                        </div>
                    ))}
                    <button onClick={addAlquilerField} className="w-full py-4 rounded-2xl border border-dashed border-slate-700 text-slate-500 hover:text-blue-400 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-[10px] font-black uppercase tracking-widest">+ Agregar otro Alquiler / Gasto</button>
                </div>
                <div className="p-8 bg-white/5 border-t border-white/5 flex gap-4">
                    <button onClick={onClose} className="flex-1 py-4 rounded-2xl border border-slate-700 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all">Cancelar</button>
                    <button onClick={handleConfirm} className="flex-1 py-4 rounded-2xl bg-blue-600 text-white hover:bg-blue-500 transition-all text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-900/40">Guardar Gastos</button>
                </div>
            </div>
        </div>
    );
};

export default StructuralCostsModal;