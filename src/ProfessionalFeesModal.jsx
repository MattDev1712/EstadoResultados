import React, { useState } from 'react';

const ProfessionalFeesModal = ({ isOpen, onClose, onConfirm, defaultDate }) => {
    const [fields, setFields] = useState([{ name: '', value: '' }]);

    const addField = () => setFields([...fields, { name: '', value: '' }]);
    
    const handleConfirm = () => {
        const data = fields
            .filter(f => f.name && f.value && parseFloat(f.value) !== 0)
            .map(f => {
                const total = Math.abs(parseFloat(f.value));
                return {
                    fecha: defaultDate,
                    tipo_movimiento: 'EGRESO',
                    origen_dato: 'MANUAL',
                    rubro: 'Honorarios Profesionales',
                    sub_rubro: f.name,
                    importe_total: -total,
                    importe_neto: -total,
                    importe_iva: 0,
                    metodo_pago: 'Efectivo/Transferencia',
                    observaciones: 'Carga manual de Honorarios'
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
                    <h2 className="text-xl font-bold text-white tracking-tight">Honorarios Profesionales</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors text-xl">✕</button>
                </div>
                <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                    {fields.map((field, idx) => (
                        <div key={idx} className="flex flex-col gap-2 p-4 bg-slate-900/50 rounded-2xl border border-slate-700/50">
                            <input 
                                type="text"
                                placeholder="Nombre del Profesional"
                                value={field.name}
                                onChange={(e) => {
                                    const n = [...fields]; n[idx].name = e.target.value; setFields(n);
                                }}
                                className="bg-transparent border-b border-slate-700 outline-none text-slate-200 text-xs font-bold uppercase tracking-wider py-1 focus:border-blue-500 transition-all"
                            />
                        </div>
                    ))}
                </div>
                <div className="p-6 bg-slate-900/50 border-t border-slate-700 flex gap-4">
                    <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-400 text-xs font-bold uppercase tracking-widest">Cancelar</button>
                    <button onClick={handleConfirm} className="flex-1 py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 transition-all text-xs font-bold uppercase tracking-widest">Guardar</button>
                </div>
            </div>
        </div>
    );
};

export default ProfessionalFeesModal;