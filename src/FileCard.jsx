import React, { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx';
import { Parsers } from './parsers';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const FileCard = ({ title, type, parserMode, onDataReady, isLoading, defaultDate }) => {
    const [dragActive, setDragActive] = useState(false);
    const [fileName, setFileName] = useState('');
    const [stats, setStats] = useState(null);
    const [simpleMode, setSimpleMode] = useState(false);
    const [simpleTotal, setSimpleTotal] = useState('');
    const [simpleCantidad, setSimpleCantidad] = useState('');
    const [simplePctNegro, setSimplePctNegro] = useState('0');

    const handleFiles = async (files) => {
        if (!files || files.length === 0) return;
        const file = files[0];
        setFileName(file.name);
        setStats(null);

        let content = '';
        let parsedData = [];

        try {
            if (type === 'PDF' && file.type === 'application/pdf') {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                let fullText = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();

                    // Orden espacial para reconstruir el texto del PDF
                    const ROW_THRESHOLD = 3; 
                    const sorted = [...textContent.items].sort((a, b) => {
                        const yDiff = b.transform[5] - a.transform[5];
                        if (Math.abs(yDiff) > ROW_THRESHOLD) return yDiff;
                        return a.transform[4] - b.transform[4];
                    });

                    const pageLines = [];
                    let lineBuf = [];
                    let lastY = null;
                    for (const item of sorted) {
                        if (!item.str.trim()) continue;
                        const y = item.transform[5];
                        if (lastY !== null && Math.abs(y - lastY) > ROW_THRESHOLD) {
                            pageLines.push(lineBuf.join(' '));
                            lineBuf = [];
                        }
                        lineBuf.push(item.str.trim());
                        lastY = y;
                    }
                    if (lineBuf.length) pageLines.push(lineBuf.join(' '));
                    fullText += pageLines.join('\n') + '\n';
                }
                content = fullText;
                parsedData = Parsers.maxirest(content);

            } else if (type === 'CSV') {
                const name = file.name.toLowerCase();
                const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls');
                const isCsv = name.endsWith('.csv') || file.type.includes('csv') || file.type.includes('text');

                if (parserMode === 'sueldos' && isExcel) {
                    const buffer = await file.arrayBuffer();
                    const wb = XLSX.read(buffer, { type: 'array' });
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
                    parsedData = Parsers.sueldos(rows, defaultDate);
                } else if (parserMode === 'sueldos' && isCsv) {
                    content = await file.text();
                    const rows = content.split('\n').map(line =>
                        line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.trim().replace(/^"|"$/g, '') || null)
                    );
                    parsedData = Parsers.sueldos(rows, defaultDate);
                } else if (!parserMode && isCsv) {
                    content = await file.text();
                    parsedData = Parsers.arca(content);
                } else {
                    setStats('Formato de archivo incorrecto.');
                    return;
                }
            } else {
                setStats('Formato de archivo incorrecto.');
                return;
            }

            setStats(`Se detectaron ${parsedData.length} registros.`);
            onDataReady(parsedData);

        } catch (err) {
            console.error(err);
            setStats(`Error: ${err.message || 'No se pudo procesar el archivo.'}`);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragActive(false);
        handleFiles(e.dataTransfer.files);
    };

    const handleSimpleSubmit = () => {
        const total = parseFloat(simpleTotal.replace(/\./g, '').replace(',', '.')) || 0;
        const cantidad = parseInt(simpleCantidad) || 1;
        if (total <= 0) { setStats('Ingresá un monto válido.'); return; }
        const pctNegro = Math.min(100, Math.max(0, parseFloat(simplePctNegro) || 0));
        const porEmpleado = Math.round(total / cantidad);
        const negroEmpleado = Math.round(porEmpleado * pctNegro / 100);
        const reciboEmpleado = porEmpleado - negroEmpleado;
        const periodDate = defaultDate || new Date().toISOString().split('T')[0];
        const records = Array.from({ length: cantidad }, (_, i) => ({
            fecha_periodo: periodDate,
            nombre: `Empleado ${i + 1}`,
            tarea: '',
            dni: `SIMPLE${String(i + 1).padStart(3, '0')}`,
            legajo: '',
            jornada: '',
            total_hs: 0,
            recibo: reciboEmpleado,
            negro: negroEmpleado,
            costo_total: porEmpleado
        }));
        setStats(`${cantidad} registro${cantidad > 1 ? 's' : ''} generado${cantidad > 1 ? 's' : ''}.`);
        onDataReady(records);
    };

    return (
        <div 
            className={`p-6 rounded-xl border-2 transition-all ${dragActive ? 'border-blue-500 bg-slate-700' : 'border-slate-700 bg-slate-800'} shadow-lg`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-slate-200">{title}</h3>
                {parserMode === 'sueldos' ? (
                    <div className="flex rounded overflow-hidden border border-slate-600 text-xs font-semibold">
                        <button
                            onClick={() => { setSimpleMode(false); setStats(null); }}
                            className={`px-2 py-1 transition ${!simpleMode ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                        >Archivo</button>
                        <button
                            onClick={() => { setSimpleMode(true); setStats(null); setFileName(''); }}
                            className={`px-2 py-1 transition ${simpleMode ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                        >Carga Simple</button>
                    </div>
                ) : (
                    <span className="text-xs font-semibold px-2 py-1 bg-slate-700 rounded text-slate-300">{type}</span>
                )}
            </div>

            {parserMode === 'sueldos' && simpleMode ? (
                <div className="py-4 space-y-3">
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">Total pagado a empleados ($)</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            placeholder="ej: 1500000"
                            value={simpleTotal}
                            onChange={(e) => setSimpleTotal(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-slate-200 text-sm outline-none focus:border-violet-500 transition font-mono"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">Cantidad de empleados</label>
                        <input
                            type="number"
                            min="1"
                            placeholder="ej: 5"
                            value={simpleCantidad}
                            onChange={(e) => setSimpleCantidad(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-slate-200 text-sm outline-none focus:border-violet-500 transition font-mono"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">% pagado en mano (informal)</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="5"
                                value={simplePctNegro}
                                onChange={(e) => setSimplePctNegro(e.target.value)}
                                className="flex-1 accent-violet-500"
                            />
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={simplePctNegro}
                                onChange={(e) => setSimplePctNegro(e.target.value)}
                                className="w-16 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-200 text-sm outline-none focus:border-violet-500 transition font-mono text-center"
                            />
                            <span className="text-slate-400 text-sm">%</span>
                        </div>
                        {(() => {
                            const total = parseFloat(simpleTotal.replace(/\./g, '').replace(',', '.')) || 0;
                            const pct = Math.min(100, Math.max(0, parseFloat(simplePctNegro) || 0));
                            if (total <= 0) return null;
                            const negro = Math.round(total * pct / 100);
                            const blanco = total - negro;
                            return (
                                <div className="flex gap-3 mt-2 text-[11px] font-mono">
                                    <span className="text-emerald-400">Blanco: ${blanco.toLocaleString('es-AR')}</span>
                                    <span className="text-slate-500">|</span>
                                    <span className="text-rose-400">En mano: ${negro.toLocaleString('es-AR')}</span>
                                </div>
                            );
                        })()}
                    </div>
                    {stats && <p className="text-xs text-green-500 font-bold">{stats}</p>}
                    <button
                        onClick={handleSimpleSubmit}
                        className="w-full mt-2 py-2 px-4 bg-violet-600 hover:bg-violet-500 rounded text-sm font-semibold text-white transition"
                    >
                        Confirmar y previsualizar
                    </button>
                </div>
            ) : (
                <>
                    <div className="text-center py-8 text-slate-500">
                        {isLoading ? (
                            <span className="animate-pulse">Procesando...</span>
                        ) : (
                            fileName ? (
                                <div>
                                    <p className="text-blue-600 font-medium break-all">{fileName}</p>
                                    {stats && <p className="text-xs mt-2 text-green-600 font-bold">{stats}</p>}
                                </div>
                            ) : (
                                <p className="text-slate-400">Arrastra tu archivo aquí</p>
                            )
                        )}
                    </div>
                    <input
                        type="file"
                        className="hidden"
                        id={`file-${title.replace(/\s+/g, '-')}`}
                        accept={type === 'PDF' ? '.pdf' : parserMode === 'sueldos' ? '.csv,.xls,.xlsx' : '.csv'}
                        onChange={(e) => handleFiles(e.target.files)}
                    />
                    <label
                        htmlFor={`file-${title.replace(/\s+/g, '-')}`}
                        className="block w-full text-center mt-4 py-2 px-4 bg-slate-700 border border-slate-600 rounded hover:bg-slate-600 cursor-pointer text-sm font-medium text-slate-300 transition"
                    >
                        Seleccionar Archivo
                    </label>
                </>
            )}
        </div>
    );
};

export default FileCard;