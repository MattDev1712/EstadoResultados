import React, { useState } from 'react';

const StructuralCostsModal = ({ isOpen, onClose, onConfirm, defaultDate }) => {
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
                const neto = total / 1.21;
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-800 border border-slate-700 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-fade-in">
                <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900/30">
                    <h2 className="text-xl font-bold text-white tracking-tight">Costos Estructurales</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors text-xl">✕</button>
                </div>
                <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                    {fields.map((field, idx) => (
                        <div key={idx} className="flex items-center gap-4 group">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] w-32 group-hover:text-slate-400 transition-colors">{field.label}</span>
                            <div className="flex-1 flex items-baseline gap-1 bg-slate-900/50 p-2.5 rounded-xl border border-slate-700/50 focus-within:border-blue-500/50 transition-all">
                                <span className="text-slate-600 font-mono text-xs">$</span>
                                <input 
                                    type="number" 
                                    value={field.value}
                                    onChange={(e) => {
                                        const newFields = [...fields];
                                        newFields[idx].value = e.target.value;
                                        setFields(newFields);
                                    }}
                                    placeholder="0.00"
                                    className="bg-transparent border-none outline-none text-slate-200 w-full font-mono text-sm placeholder:text-slate-700"
                                />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-6 bg-slate-900/50 border-t border-slate-700 flex gap-4">
                    <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-400 text-xs font-bold uppercase tracking-widest">Cancelar</button>
                    <button onClick={handleConfirm} className="flex-1 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-all text-xs font-bold uppercase tracking-widest shadow-lg shadow-blue-900/20">Cargar Datos</button>
                </div>
            </div>
        </div>
    );
};

export default StructuralCostsModal;