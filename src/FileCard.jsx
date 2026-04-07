import React, { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx';
import { Parsers } from './parsers';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const FileCard = ({ title, type, parserMode, onDataReady, isLoading, defaultDate }) => {
    const [dragActive, setDragActive] = useState(false);
    const [fileName, setFileName] = useState('');
    const [stats, setStats] = useState(null);

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

    return (
        <div 
            className={`p-6 rounded-xl border-2 transition-all ${dragActive ? 'border-blue-500 bg-slate-700' : 'border-slate-700 bg-slate-800'} shadow-lg`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-slate-200">{title}</h3>
                <span className="text-xs font-semibold px-2 py-1 bg-slate-700 rounded text-slate-300">
                    {parserMode === 'sueldos' ? 'XLS / CSV' : type}
                </span>
            </div>
            
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
        </div>
    );
};

export default FileCard;