/**
 * Lógica de parseo para diferentes fuentes de datos (Maxirest, ARCA, Sueldos).
 * Estos métodos transforman texto crudo (extraído de PDFs o CSVs) en objetos estructurados.
 */

export const Parsers = {
    /**
     * Intenta extraer fechas y montos de un texto crudo de Maxirest.
     * Lógica ajustada para Resumen Mensual (PDF).
     */
    maxirest: (text) => {
        const cleanNumber = (str) => {
            if (!str) return 0;
            let clean = str.replace(/\s+/g, '');
            const hasCommaDecimal = clean.match(/,\d{2}$/);
            if (hasCommaDecimal) {
                clean = clean.replace(/\./g, '').replace(',', '.');
            } else {
                clean = clean.replace(/,/g, '');
            }
            return parseFloat(clean) || 0;
        };

        const MONEY_RE = /(-?\d[\d,.]*[.,]\d{2})(?!\s*%)/;

        const extractAmount = (label, excludePattern, startOfLine) => {
            const esc = label.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const anchor = startOfLine ? '^' : '^[^\\n]*';
            const lineRe = new RegExp(`${anchor}${esc}[^\\n]*$`, 'gim');
            const excludeRe = excludePattern ? new RegExp(excludePattern, 'i') : null;
            let m;
            while ((m = lineRe.exec(text)) !== null) {
                if (excludeRe && excludeRe.test(m[0])) continue;
                const moneyM = m[0].match(MONEY_RE);
                return moneyM ? cleanNumber(moneyM[1]) : 0;
            }
            return 0;
        };

        const extractLineData = (label, excludePattern, startOfLine) => {
            const esc = label.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const anchor = startOfLine ? '^' : '^[^\\n]*';
            const lineRe = new RegExp(`${anchor}${esc}[^\\n]*$`, 'gim');
            const excludeRe = excludePattern ? new RegExp(excludePattern, 'i') : null;
            let m;
            while ((m = lineRe.exec(text)) !== null) {
                if (excludeRe && excludeRe.test(m[0])) continue;
                const lineStr = m[0];
                const moneyM  = lineStr.match(MONEY_RE);
                const importe = moneyM ? cleanNumber(moneyM[1]) : 0;

                let rest = moneyM ? lineStr.replace(moneyM[0], '') : lineStr;
                rest = rest.replace(/\d[\d,.]*%/g, ''); 
                const intMatches = rest.match(/\b\d[\d,]*\b(?!\.\d)/g) || [];
                const ints = intMatches
                    .map(n => parseInt(n.replace(/,/g, ''), 10))
                    .filter(n => !isNaN(n) && n > 0);
                const cantidad = ints.length > 0 ? ints[ints.length - 1] : 0;

                return { importe, cantidad };
            }
            return { importe: 0, cantidad: 0 };
        };

        const dateRangeRegex = /Fecha:?\s*\d{2}\/\d{2}\/\d{2,4}\s+al\s+(\d{2}\/\d{2}\/\d{2,4})/i;
        const dateSingleRegex = /Fecha:?\s*(\d{2}\/\d{2}\/\d{2,4})/i;

        let isoDate = null;
        const rangeMatch = text.match(dateRangeRegex);
        const singleMatch = text.match(dateSingleRegex);

        if (rangeMatch) {
            const [d, m, y] = rangeMatch[1].split('/');
            isoDate = `${y.length === 2 ? '20' + y : y}-${m}-${d}`;
        } else if (singleMatch) {
            const [d, m, y] = singleMatch[1].split('/');
            isoDate = `${y.length === 2 ? '20' + y : y}-${m}-${d}`;
        }

        if (!isoDate) {
            throw new Error("No se encontró una fecha válida en el PDF.");
        }

        const totalData     = extractLineData('TOTAL', null, true);
        const factBElecData = extractLineData('Factura B ELECTR', null, true);
        const factBData     = extractLineData('Factura B', 'ELECTR', true);

        // Calculate IVA from Factura B Electrónica (divide by 1.21)
        const calcIva = factBElecData.importe - (factBElecData.importe / 1.21);
        const calcNeto = (factBElecData.importe / 1.21) + factBData.importe;

        const rawData = {
            fecha: isoDate,
            val_total: totalData.importe,
            val_cantidad: totalData.cantidad,
            
            val_efectivo: extractLineData('Efectivo').importe,
            val_efectivo_cantidad: extractLineData('Efectivo').cantidad,
            val_tarjetas: extractLineData('Tarjetas').importe,
            val_tarjetas_cantidad: extractLineData('Tarjetas').cantidad,
            val_otros: extractLineData('Otros').importe,
            val_otros_cantidad: extractLineData('Otros').cantidad,

            val_factura_b_elec: factBElecData.importe,
            val_factura_b_elec_cantidad: factBElecData.cantidad,
            val_factura_b: factBData.importe,
            val_factura_b_cantidad: factBData.cantidad,

            val_turno_am: extractLineData('Turno AM').importe,
            val_turno_am_cantidad: extractLineData('Turno AM').cantidad,
            val_turno_pm: extractLineData('Turno PM').importe,
            val_turno_pm_cantidad: extractLineData('Turno PM').cantidad,

            val_mostrador: extractLineData('Mostrador').importe,
            val_mostrador_cantidad: extractLineData('Mostrador').cantidad,
            val_salon: extractLineData('Salon').importe,
            val_salon_cantidad: extractLineData('Salon').cantidad,
            val_exterior: extractLineData('Exterior').importe,
            val_exterior_cantidad: extractLineData('Exterior').cantidad,
            val_producto: extractLineData('PRODUCTO').importe,
            val_producto_cantidad: extractLineData('PRODUCTO').cantidad,
            val_stock: extractLineData('STOCK').importe,
            val_stock_cantidad: extractLineData('STOCK').cantidad,

            val_neto_acf: calcNeto,
            val_iva_acf: calcIva,
            val_anulaciones: extractLineData('Anulaciones').importe,
        };

        let calcTotal = calcNeto + calcIva;

        const obsParts = [];
        if (rawData.val_cantidad) obsParts.push(`Q:${rawData.val_cantidad}`);
        if (rawData.val_efectivo || rawData.val_tarjetas || rawData.val_otros) 
            obsParts.push(`Efvo:$${rawData.val_efectivo}/Tarj:$${rawData.val_tarjetas}/Otros:$${rawData.val_otros}`);

        return [{
            ...rawData,
            otros: rawData.val_otros,
            neto: calcNeto,
            iva: calcIva,
            total: calcTotal,
            categoria: 'Venta Mensual',
            comprobante: 'Z Mensual',
            medio_pago: 'MIXTO', 
            observaciones: obsParts.join('. ') || 'Importación Maxirest'
        }];
    },

    /**
     * Parsea CSV de ARCA / Mis Comprobantes
     */
    arca: (text) => {
        const lines = text.split('\n');
        const records = [];
        const splitRe = /;(?=(?:(?:[^"]*"){2})*[^"]*$)/;

        const cleanArcaNum = (val) => {
            if (!val) return 0;
            let clean = val.replace(/"/g, '').trim();
            clean = clean.replace(/\./g, '').replace(',', '.');
            return parseFloat(clean) || 0;
        };

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const cols = line.split(splitRe).map(c => c.trim().replace(/^"|"$/g, ''));
            if (cols.length < 5) continue;

            let isoDate = cols[0];
            if (isoDate.includes('/')) {
                const [d, m, y] = isoDate.split('/');
                isoDate = `${y}-${m}-${d}`;
            } else if (isoDate.length === 8) {
                isoDate = `${isoDate.substring(0,4)}-${isoDate.substring(4,6)}-${isoDate.substring(6,8)}`;
            }

            // Detectar Notas de Crédito / Débito para invertir el signo
            const tipoUpper = cols[1].toUpperCase();
            const isNC = tipoUpper.includes('CREDITO') || tipoUpper.includes('CRÉDITO') || /\bNC\b/.test(tipoUpper);
            const signoNC = isNC ? -1 : 1;

            records.push({
                fecha: isoDate,
                tipo_comp: cols[1],
                nro_comp: `${cols[2]}-${cols[3]}`,
                cuit: cols[7],
                entidad: cols[8] || 'S/D',
                neto:  cleanArcaNum(cols[24]) * signoNC,
                iva:   cleanArcaNum(cols[28]) * signoNC,
                total: cleanArcaNum(cols[29]) * signoNC,
                rubro: 'Compras'
            });
        }
        return records;
    },

    /**
     * Parsea CSV de Sueldos (Planilla Mensual)
     */
    sueldos: (text, dateRef) => {
        const lines = text.split('\n');
        const records = [];
        
        const cleanUSNum = (val) => {
            if (!val) return 0;
            let clean = val.replace(/["\s$]/g, '').replace(/,/g, '');
            return parseFloat(clean) || 0;
        };
        
        const cleanHrs = (val) => {
            if (!val) return 0;
            let clean = val.replace(/["\sA-Za-z]/g, ''); 
            return parseFloat(clean) || 0;
        };

        const periodDate = dateRef || new Date().toISOString().split('T')[0];

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.trim());
            if (cols.length < 5) continue;

            const nombre = cols[1];
            const costoTotal = cleanUSNum(cols[11]); 
            const recibo = cleanUSNum(cols[12]);

            if (!nombre || (costoTotal === 0 && recibo === 0)) continue;

            records.push({
                fecha_periodo: periodDate, 
                nombre: nombre,
                tarea: cols[2],
                dni: cols[4] || '0',
                total_hs: cleanHrs(cols[9]),
                recibo: recibo,
                negro: cleanUSNum(cols[14]),
                costo_total: costoTotal
            });
        }
        return records;
    }
};