/**
 * Lógica de parseo para diferentes fuentes de datos (Maxirest, ARCA, Sueldos).
 * Estos métodos transforman texto crudo (extraído de PDFs o CSVs) en objetos estructurados.
 */

export const Parsers = {
    /**
     * Intenta extraer fechas y montos de un texto crudo de Maxirest.
     * Lógica ajustada para Resumen Mensual (PDF).
     */
    maxirest: (text, alicuota = 0.21) => {
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
        const factAElecData = extractLineData('Factura A', null, true);
        const factBData     = extractLineData('Factura B', 'ELECTR', true);

        // Calculamos el IVA solo de las facturas electrónicas (A y B)
        // El reporte de Maxirest suele mostrar el bruto (Neto + IVA)
        const divisor = 1 + alicuota;
        const ivaB = factBElecData.importe - (factBElecData.importe / divisor);
        const ivaA = factAElecData.importe - (factAElecData.importe / divisor);
        const calcIva = ivaB + ivaA;

        const netoB = (factBElecData.importe / divisor) + factBData.importe;
        const netoA = factAElecData.importe / divisor;
        const calcNeto = netoB + netoA;

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
            val_factura_a_elec: factAElecData.importe,
            val_factura_a_elec_cantidad: factAElecData.cantidad,
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

        // Códigos numéricos AFIP de Notas de Crédito (reducen el gasto → signo negativo)
        const NC_TYPES = new Set(['3', '8', '13', '21', '53']);

        // Mapa de código AFIP → nombre legible
        const TIPO_COMP_NAMES = {
            '1': 'Factura A', '2': 'Nota de Débito A', '3': 'Nota de Crédito A',
            '6': 'Factura B', '7': 'Nota de Débito B', '8': 'Nota de Crédito B',
            '11': 'Factura C', '12': 'Nota de Débito C', '13': 'Nota de Crédito C',
            '51': 'Factura M', '52': 'Nota de Débito M', '53': 'Nota de Crédito M',
        };

        const cleanArcaNum = (val) => {
            if (!val) return 0;
            let clean = val.replace(/"/g, '').trim();
            if (!clean) return 0;
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

            // Bug 2 fix: detectar NC por código numérico AFIP
            const tipoCode = cols[1].trim();
            const isNC = NC_TYPES.has(tipoCode);
            const signo = isNC ? -1 : 1;

            // Bug 3 fix: sumar neto gravado + no gravado + exentas; capturar otros tributos
            const netoGravado   = cleanArcaNum(cols[24]);
            const netoNoGravado = cleanArcaNum(cols[25]);
            const exentas       = cleanArcaNum(cols[26]);
            const otrosTributos = cleanArcaNum(cols[27]);
            const totalIva      = cleanArcaNum(cols[28]);
            const total         = cleanArcaNum(cols[29]);

            const netoTotal = netoGravado + netoNoGravado + exentas;

            // Bug 1 fix: Factura C (monotributista) → ARCA no desglosa, todo va al total
            const netoFinal = (netoTotal === 0 && totalIva === 0 && total > 0)
                ? total
                : netoTotal;

            // Inferir tasa de IVA desde netoGravado (antes de mezclar con no gravado)
            const ivaPct = netoGravado > 0
                ? Math.round(totalIva / netoGravado * 100 * 10) / 10
                : 0;

            records.push({
                fecha:          isoDate,
                tipo_comp:      TIPO_COMP_NAMES[tipoCode] || `Tipo ${tipoCode}`,
                nro_comp:       `${cols[2]}-${cols[3]}`,
                cuit:           cols[7],
                entidad:        cols[8] || 'S/D',
                neto:           netoFinal      * signo,
                iva:            totalIva       * signo,
                otros_tributos: otrosTributos  * signo,
                total:          total          * signo,
                iva_pct:        ivaPct,
                rubro:          'Compras'
            });
        }
        return records;
    },

    /**
     * Parsea una planilla de sueldos desde una matriz de filas (array de arrays).
     * Detecta la fila de cabecera automáticamente y mapea columnas por nombre.
     * Acepta XLS, XLSX y CSV (la conversión a matriz la hace el caller).
     */
    sueldos: (rows, dateRef) => {
        const SYNONYMS = {
            nombre:      ['nombre', 'apellido', 'apellido y nombre', 'empleado', 'apellidos y nombres'],
            tarea:       ['tarea', 'cargo', 'categoria', 'categoría', 'puesto', 'función', 'funcion', 'rol'],
            dni:         ['dni', 'cuil', 'documento', 'nro. doc', 'nro doc', 'n° doc', 'n°doc'],
            legajo:      ['legajo', 'nro legajo', 'n° legajo', 'leg'],
            jornada:     ['jornada', 'modalidad', 'tipo jornada'],
            total_hs:    ['horas', 'hs', 'total hs', 'total horas', 'horas trabajadas', 'hs trabajadas'],
            recibo:      ['recibo', 'blanco', 'en blanco', 'formal', 'importe recibo', 'sueldo recibo'],
            negro:       ['negro', 'informal', 'a cuenta', 'extraoficial', 'no registrado'],
            costo_total: ['total', 'costo total', 'total a pagar', 'bruto', 'total bruto', 'importe total', 'total mes']
        };

        const normalize = (str) =>
            String(str ?? '').toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .trim();

        const cleanNum = (val) => {
            if (val === null || val === undefined || val === '') return 0;
            if (typeof val === 'number') return val;
            return parseFloat(String(val).replace(/["\s$]/g, '').replace(/,/g, '')) || 0;
        };

        // 1. Detectar fila de cabecera: la que tenga más matches con los sinónimos conocidos
        const allKeywords = Object.values(SYNONYMS).flat();
        let headerRowIdx = 0;
        let bestScore = 0;

        for (let i = 0; i < Math.min(rows.length, 15); i++) {
            const row = rows[i];
            if (!row) continue;
            const score = row.filter(cell => allKeywords.includes(normalize(cell))).length;
            if (score > bestScore) {
                bestScore = score;
                headerRowIdx = i;
            }
        }

        // 2. Construir mapa campo → índice de columna
        const headers = (rows[headerRowIdx] || []).map(normalize);
        const colIdx = {};

        for (const [field, variants] of Object.entries(SYNONYMS)) {
            const idx = headers.findIndex(h => variants.includes(h));
            if (idx !== -1) colIdx[field] = idx;
        }

        // 3. Parsear filas de datos
        const periodDate = dateRef || new Date().toISOString().split('T')[0];
        const records = [];

        for (let i = headerRowIdx + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.every(c => c === null || c === undefined || c === '')) continue;

            const get = (field) => (colIdx[field] !== undefined ? row[colIdx[field]] : undefined);

            const nombre = String(get('nombre') ?? '').trim();
            const costoTotal = cleanNum(get('costo_total'));
            const recibo = cleanNum(get('recibo'));

            if (!nombre || (costoTotal === 0 && recibo === 0)) continue;

            records.push({
                fecha_periodo: periodDate,
                nombre,
                tarea:      String(get('tarea') ?? '').trim(),
                dni:        String(get('dni') ?? '0').replace(/\./g, '').trim(),
                legajo:     String(get('legajo') ?? '').trim(),
                jornada:    String(get('jornada') ?? '').trim(),
                total_hs:   cleanNum(get('total_hs')),
                recibo,
                negro:      cleanNum(get('negro')),
                costo_total: costoTotal
            });
        }

        return records;
    }
};