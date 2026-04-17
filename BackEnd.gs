/**
 * ============================================================================
 * CONFIGURACIÓN Y CONSTANTES
 * ============================================================================
 */
const SS_ID = '184sV1QTGpcGmPJIbTLsl5SBC7UV2fYc85SR_-euMHdo';
const SHEET_NAME = 'Movimientos';
const PROVIDERS_SHEET_NAME = 'Proveedores';
const EMPLOYEES_SHEET_NAME = 'Empleados';

const MAXIREST_SHEET_NAME = 'Resumen Maxirest';
const CONFIG_SHEET_NAME = 'Config';
const BUSINESS_CONFIG_SHEET_NAME = 'Empresa';
const AUDIT_LOG_SHEET_NAME = 'AuditLog';
const ESTADO_RESULT_MANUAL_SHEET_NAME = 'EstadoResultManual';

/**
 * CONFIGURACIÓN FINANCIERA PROFESIONAL
 */
// Variables globales para caché de sesión (se sincronizan con la hoja 'Config')
let CONST_IPC = {
  '2025-10': 1.65, '2025-11': 1.50, '2025-12': 1.35,
  '2026-01': 1.20, '2026-02': 1.10, '2026-03': 1.00
};

let CONST_MEP = {
  '2025-10': 1150, '2025-11': 1200, '2025-12': 1250,
  '2026-01': 1300, '2026-02': 1350, '2026-03': 1400
};

/**
 * ============================================================================
 * MODELO DE DATOS PRINCIPAL
 * ============================================================================
 */

/**
 * Representa una transacción financiera única (Venta, Compra o Gasto).
 * Esta clase normaliza los datos antes de que toquen la hoja de cálculo.
 */
class Movimiento {

  /**
   * Crea una instancia de Movimiento.
   * @param {Object} config - Objeto de configuración con los datos crudos.
   */
  constructor(config) {
    // 1. Identidad y Tiempo
    this.uuid = config.uuid || Utilities.getUuid(); // ID único nativo de GAS
    
    // Normalización de fechas para evitar corrimiento por Timezone (UTC vs Local)
    if (config.fecha instanceof Date) {
      this.fecha = config.fecha;
    } else {
      // Si viene como string YYYY-MM-DD, forzamos mediodía para evitar saltos de día
      const dateStr = String(config.fecha).includes('T') ? config.fecha : config.fecha + 'T12:00:00';
      this.fecha = new Date(dateStr);
    }
    this.periodo_fiscal = this._calcularPeriodoFiscal(this.fecha);

    // 2. Clasificación
    this.tipo_movimiento = config.tipo_movimiento || 'PENDIENTE'; // 'INGRESO' o 'EGRESO'
    this.origen_dato = config.origen_dato || 'MANUAL'; 
    this.rubro = config.rubro || 'Sin Clasificar';
    this.sub_rubro = config.sub_rubro || '';

    // 3. Entidad
    this.entidad_nombre = config.entidad_nombre || 'Consumidor Final';
    this.entidad_cuit = config.entidad_cuit || '';
    this.comprobante_tipo = config.comprobante_tipo || '';
    this.comprobante_numero = config.comprobante_numero || '';

    // 4. Valores Económicos (Fiscalidad - Devengado)
    // Utilizamos parseFloat para asegurar que sean números.
    // NOTA: Si es EGRESO, los mappers deben enviar estos valores en NEGATIVO.
    this.importe_neto = parseFloat(config.importe_neto || 0);
    this.importe_iva = parseFloat(config.importe_iva || 0);
    this.otros_tributos = parseFloat(config.otros_tributos || 0);

    // 5. Valores Financieros (Cash Flow - Percibido)
    // Si viene el total, lo usamos (para respetar redondeos de origen). Si no, sumamos.
    this.importe_total = config.importe_total !== undefined 
      ? parseFloat(config.importe_total) 
      : (this.importe_neto + this.importe_iva + this.otros_tributos);
      
    this.metodo_pago = config.metodo_pago || 'Efectivo';
    this.observaciones = config.observaciones || '';
  }

  /**
   * Calcula el periodo fiscal (YYYY-MM) basado en la fecha.
   * @param {Date} fecha 
   * @return {string}
   */
  _calcularPeriodoFiscal(fecha) {
    if (!fecha || isNaN(fecha.getTime())) return 'ERROR_FECHA';
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Devuelve un array ordenado listo para insertar en Google Sheets con appendRow().
   * El orden coincide con las columnas definidas en el diseño.
   * @return {Array}
   */
  toRowArray() {
    return [
      this.uuid,
      this.fecha,              
      this.periodo_fiscal,
      this.tipo_movimiento,
      this.origen_dato,
      this.rubro,
      this.sub_rubro,
      this.entidad_nombre,
      this.entidad_cuit,
      this.comprobante_tipo,
      this.comprobante_numero,
      this.importe_neto,       // Importante para sumar Ganancia neta
      this.importe_iva,        // Importante para Posición de IVA
      this.otros_tributos,
      this.importe_total,      // Importante para Arqueo de Caja
      this.metodo_pago,
      this.observaciones
    ];
  }
}

/**
 * ============================================================================
 * MAPPER DE VENTAS (MAXIREST) — Resumen Mensual
 * ============================================================================
 *
 * El PDF de Maxirest es un RESUMEN OPERATIVO (no transacciones individuales).
 * Se guarda en la hoja "Resumen Maxirest" con una fila por período, preservando
 * todos los ejes de análisis: fiscal, turnos, medios de pago, canales, cantidades.
 *
 * Esquema de la hoja (orden de columnas):
 *  [0]  UUID                  → ID determinístico MX-{periodo} para deduplicar
 *  [1]  Fecha                 → Fecha de cierre del resumen
 *  [2]  Periodo Fiscal        → YYYY-MM
 *  [3]  Total Sistema         → Cierre bruto Maxirest (referencial)
 *  [4]  Total Calculado       → Neto ACF + IVA ACF (valor fiscal utilizado)
 *  [5]  Cantidad Total        → Operaciones totales del período
 *  [6]  Neto ACF 21%          → Base imponible para P&L
 *  [7]  IVA ACF 21%           → Débito fiscal
 *  [8]  Anulaciones           → Comprobantes anulados (importe)
 *  [9]  Turno AM              → Facturación turno mañana
 *  [10] Ops Turno AM
 *  [11] Turno PM              → Facturación turno tarde/noche
 *  [12] Ops Turno PM
 *  [13] Efectivo
 *  [14] Ops Efectivo
 *  [15] Tarjetas
 *  [16] Ops Tarjetas
 *  [17] Otros                 → Otros medios de pago (QR, transferencia, etc.)
 *  [18] Ops Otros
 *  [19] Factura B Electrónica
 *  [20] Ops Factura B Elec
 *  [21] Factura B
 *  [22] Ops Factura B
 *  [23] PRODUCTO              → Canal mostrador / take away de producto elaborado
 *  [24] Ops PRODUCTO
 *  [25] Mostrador
 *  [26] Ops Mostrador
 *  [27] Exterior
 *  [28] Ops Exterior
 *  [29] Salon
 *  [30] Ops Salon
 *  [31] STOCK                 → Venta de mercadería stock
 *  [32] Ops STOCK
 */

const MAXIREST_HEADERS = [
  'UUID', 'Fecha', 'Periodo Fiscal',
  'Total Sistema', 'Total Calculado', 'Cantidad Total',
  'Neto ACF 21%', 'IVA ACF 21%', 'Anulaciones',
  'Turno AM', 'Ops Turno AM',
  'Turno PM', 'Ops Turno PM',
  'Efectivo', 'Ops Efectivo',
  'Tarjetas', 'Ops Tarjetas',
  'Otros', 'Ops Otros',
  'Factura B Electronica', 'Ops Factura B Electronica',
  'Factura B', 'Ops Factura B',
  'PRODUCTO', 'Ops PRODUCTO',
  'Mostrador', 'Ops Mostrador',
  'Exterior', 'Ops Exterior',
  'Salon', 'Ops Salon',
  'STOCK', 'Ops STOCK'
];

const MaxirestResumenMapper = {
  /**
   * Convierte el rawData del frontend en una fila lista para la hoja Resumen Maxirest.
   * @param {Object} rawData — objeto con todos los val_* campos del parser.
   * @return {Object} { uuid, row[] }
   */
  mapResumen: (rawData) => {
    const fecha = rawData.fecha instanceof Date ? rawData.fecha : new Date(rawData.fecha + 'T12:00:00');
    const year  = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const periodo = `${year}-${month}`;

    // UUID determinístico: impide cargar el mismo período dos veces.
    const uuid = `MX-RESUMEN-${periodo}`;

    const n = (v) => parseFloat(v || 0);

    const row = [
      uuid,
      fecha,
      periodo,
      n(rawData.val_total),
      n(rawData.total),           // Total Calculado = neto + iva
      n(rawData.val_cantidad),
      n(rawData.val_neto_acf),
      n(rawData.val_iva_acf),
      n(rawData.val_anulaciones),
      n(rawData.val_turno_am),    n(rawData.val_turno_am_cantidad),
      n(rawData.val_turno_pm),    n(rawData.val_turno_pm_cantidad),
      n(rawData.val_efectivo),    n(rawData.val_efectivo_cantidad),
      n(rawData.val_tarjetas),    n(rawData.val_tarjetas_cantidad),
      n(rawData.val_otros),       n(rawData.val_otros_cantidad),
      n(rawData.val_factura_b_elec),  n(rawData.val_factura_b_elec_cantidad),
      n(rawData.val_factura_b),       n(rawData.val_factura_b_cantidad),
      n(rawData.val_producto),        n(rawData.val_producto_cantidad),
      n(rawData.val_mostrador),       n(rawData.val_mostrador_cantidad),
      n(rawData.val_exterior),        n(rawData.val_exterior_cantidad),
      n(rawData.val_salon),           n(rawData.val_salon_cantidad),
      n(rawData.val_stock),           n(rawData.val_stock_cantidad)
    ];

    return { uuid, row };
  }
};

/**
 * ============================================================================
 * MAPPER DE COMPRAS (ARCA / AFIP)
 * ============================================================================
 */
const ArcaMapper = {
  /**
   * Transforma una fila del CSV de "Mis Comprobantes" en un objeto Movimiento.
   * Invierte el signo a NEGATIVO para que la suma simple dé la ganancia real.
   */
  mapCompra: (data) => {
    // Los CSV de AFIP suelen traer importes positivos. 
    // Los convertimos a negativo para nuestra base de datos.
    const signo = -1; 
    
    const uniqueId = `ARCA-${data.cuit}-${data.tipo_comp}-${data.nro_comp}`.replace(/\s+/g, '');
    
    return new Movimiento({
      uuid: uniqueId, // Sobrescribimos el UUID aleatorio por defecto
      fecha: data.fecha,
      tipo_movimiento: 'EGRESO',
      origen_dato: 'ARCA_CSV',
      rubro: data.rubro || 'Compras',
      sub_rubro: 'Sin Asignar',
      
      entidad_nombre: data.entidad,
      entidad_cuit: data.cuit,
      comprobante_tipo: data.tipo_comp,
      comprobante_numero: data.nro_comp,

      // El frontend ya envía NC con signo negativo; se aplica signo=-1 para
      // convertir el positivo de facturas en egreso. Las NC quedan positivas (reducen egreso).
      importe_neto: parseFloat(data.neto || 0) * signo,
      importe_iva: parseFloat(data.iva || 0) * signo,
      otros_tributos: parseFloat(data.otros_tributos || 0) * signo,
      importe_total: parseFloat(data.total || 0) * signo,

      metodo_pago: 'A Pagar / Cta Cte',
      observaciones: 'Imp. Mis Comprobantes'
    });
  }
};

/**
 * ============================================================================
 * MAPPER DE SUELDOS (NÓMINA)
 * ============================================================================
 */
const SueldosMapper = {
  mapEmpleado: (data) => {
    // Generar ID único para evitar duplicar el mismo sueldo en el mismo mes
    // ID: EMP-{PERIODO}-{DNI}
    // La fecha viene del selector global del frontend
    let fecha = new Date();
    if (data.fecha_periodo) {
      fecha = new Date(data.fecha_periodo + 'T12:00:00');
    }
    
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const periodo = `${year}-${month}`;
    
    const dni = data.dni ? data.dni.replace(/\./g, '') : 'SINDNI';
    const uuid = `EMP-${periodo}-${dni}`;

    const n = (v) => parseFloat(v || 0);

    return {
      uuid,
      row: [
        uuid,
        fecha, // Fecha del periodo (para filtrado)
        periodo,
        data.legajo || '',
        data.nombre,
        data.tarea,
        dni,
        data.jornada || '',
        n(data.total_hs),    // Mapeado desde 'total_hs' del front
        0,                   // Valor Hora (calculable si se desea)
        n(data.costo_total), // Mapeado desde 'costo_total' del front
        n(data.recibo),
        n(data.negro)
      ]
    };
  }
};

const EMPLOYEES_HEADERS = [
  'UUID', 'Fecha Periodo', 'Periodo Fiscal', 'N° Legajo', 'Apellido y Nombre', 'Tareas', 'DNI', 'Jornada Arca', 'Total Hs', 'Valor Hora', 'Valor Total', 'Recibo', 'Negro'
];

/**
 * ============================================================================
 * REPOSITORIO (Persistencia en Google Sheets)
 * ============================================================================
 */

/**
 * Guarda un array de objetos Movimiento en la hoja de cálculo.
 * Realiza una validación de duplicados basada en UUID antes de escribir.
 * 
 * @param {Movimiento[]} movimientosArray - Array de instancias de la clase Movimiento.
 * @return {Object} Reporte de la operación { insertados, omitidos, total_procesados }.
 */
function saveMovimientos(movimientosArray) {
  // 1. Validaciones básicas
  if (!movimientosArray || !Array.isArray(movimientosArray) || movimientosArray.length === 0) {
    console.warn('saveMovimientos: No se recibieron datos para guardar.');
    return { status: 'NO_DATA', insertados: 0, omitidos: 0, total_procesados: 0 };
  }

  const ss = SpreadsheetApp.openById(SS_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);

  // 2. Inicialización de hoja si no existe (Seguridad)
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    _crearEncabezados(sheet);
  }

  // 3. Obtener UUIDs existentes para evitar duplicados (Lectura Batch)
  const lastRow = sheet.getLastRow();
  const existingUuids = new Set();

  // Si hay datos (más allá del encabezado), leemos la Columna A (UUIDs)
  if (lastRow >= 2) {
    const uuidData = sheet.getRange(2, 1, lastRow - 1, 1).getValues(); 
    for (let i = 0; i < uuidData.length; i++) {
      existingUuids.add(uuidData[i][0]); 
    }
  }

  // 4. Filtrado: Solo mantenemos los que NO están en el Set
  const nuevosMovimientos = movimientosArray.filter(mov => {
    return mov.uuid && !existingUuids.has(mov.uuid);
  });

  const countInsertar = nuevosMovimientos.length;
  const countOmitidos = movimientosArray.length - countInsertar;

  // 5. Escritura en Bloque (Batch Write)
  if (countInsertar > 0) {
    const filasParaEscribir = nuevosMovimientos.map(mov => mov.toRowArray());
    const startRow = lastRow + 1;
    const numRows = filasParaEscribir.length;
    const numCols = filasParaEscribir[0].length;

    sheet.getRange(startRow, 1, numRows, numCols).setValues(filasParaEscribir);
    
    console.log(`✅ Éxito: Se insertaron ${countInsertar} filas nuevas.`);
  } else {
    console.log(`ℹ️ Info: No hay datos nuevos. Todos los UUIDs ya existían.`);
  }

  return {
    status: 'OK',
    insertados: countInsertar,
    omitidos: countOmitidos,
    total_procesados: movimientosArray.length
  };
}

/**
 * ============================================================================
 * REPOSITORIO MAXIREST — Hoja "Resumen Maxirest"
 * ============================================================================
 *
 * Guarda resúmenes mensuales de Maxirest.
 * Deduplicación por UUID = MX-RESUMEN-{periodo}.
 * Si el mismo período se sube de nuevo, se SOBREESCRIBE la fila existente
 * (para permitir correcciones sin duplicar).
 *
 * @param {Array<{uuid, row[]}>} resumenesArray — salida de MaxirestResumenMapper.mapResumen()
 * @return {Object} { status, insertados, actualizados, total_procesados }
 */
function saveResumenMaxirest(resumenesArray) {
  if (!resumenesArray || resumenesArray.length === 0) {
    return { status: 'NO_DATA', insertados: 0, actualizados: 0, total_procesados: 0 };
  }

  const ss = SpreadsheetApp.openById(SS_ID);
  let sheet = ss.getSheetByName(MAXIREST_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(MAXIREST_SHEET_NAME);
    // Encabezados con formato
    sheet.getRange(1, 1, 1, MAXIREST_HEADERS.length).setValues([MAXIREST_HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, MAXIREST_HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#0f172a')
      .setFontColor('#60a5fa');
    // Formato moneda para columnas de importe (columnas pares a partir de col 4)
    const importeCols = [4,5,7,8,9,10,12,14,16,18,20,22,24,26,28,30,32];
    importeCols.forEach(col => {
      sheet.getRange(2, col, 1000, 1).setNumberFormat('$#,##0.00');
    });
  }

  // Construir mapa UUID → número de fila existente
  const lastRow = sheet.getLastRow();
  const uuidToRow = {};
  if (lastRow > 1) {
    const uuids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    uuids.forEach(([uuid], i) => {
      if (uuid) uuidToRow[uuid] = i + 2; // fila en Sheet (1-indexed, +1 por header)
    });
  }

  let insertados = 0;
  let actualizados = 0;

  resumenesArray.forEach(({ uuid, row }) => {
    if (uuidToRow[uuid]) {
      // Sobreescribir fila existente (corrección del mismo período)
      sheet.getRange(uuidToRow[uuid], 1, 1, row.length).setValues([row]);
      actualizados++;
    } else {
      // Nueva fila
      const nextRow = sheet.getLastRow() + 1;
      sheet.getRange(nextRow, 1, 1, row.length).setValues([row]);
      insertados++;
    }
  });

  console.log(`Resumen Maxirest: ${insertados} insertados, ${actualizados} actualizados.`);
  return {
    status: 'OK',
    insertados,
    actualizados,
    total_procesados: resumenesArray.length
  };
}

function saveSueldos(payloadArray) {
  if (!payloadArray || payloadArray.length === 0) return { status: 'NO_DATA' };

  const ss = SpreadsheetApp.openById(SS_ID);
  let sheet = ss.getSheetByName(EMPLOYEES_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(EMPLOYEES_SHEET_NAME);
    sheet.getRange(1, 1, 1, EMPLOYEES_HEADERS.length).setValues([EMPLOYEES_HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, EMPLOYEES_HEADERS.length).setFontWeight('bold').setBackground('#0f172a').setFontColor('#e2e8f0');
  }

  // Mapeo UUID -> Fila para UPSERT
  const lastRow = sheet.getLastRow();
  const uuidToRow = {};
  if (lastRow > 1) {
    const uuids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    uuids.forEach(([uuid], i) => { if(uuid) uuidToRow[uuid] = i + 2; });
  }

  let insertados = 0;
  let actualizados = 0;

  payloadArray.forEach(({ uuid, row }) => {
    if (uuidToRow[uuid]) {
      sheet.getRange(uuidToRow[uuid], 1, 1, row.length).setValues([row]);
      actualizados++;
    } else {
      sheet.appendRow(row);
      insertados++;
    }
  });

  return {
    status: 'OK', insertados, actualizados, total_procesados: payloadArray.length, message: `Nómina: ${insertados} nuevos, ${actualizados} actualizados.`
  };
}

/**
 * ============================================================================
 * GESTIÓN DE ALIAS DE PROVEEDORES
 * ============================================================================
 */

/**
 * Obtiene un mapa de { "Nombre Original": "Alias" } para normalizar reportes.
 */
function _getProviderAliasMap() {
  const ss = SpreadsheetApp.openById(SS_ID);
  let sheet = ss.getSheetByName(PROVIDERS_SHEET_NAME);
  const map = {};
  
  if (!sheet || sheet.getLastRow() < 2) return map;
  
  // Asumimos Col A = Nombre Real, Col B = Alias
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  data.forEach(([realName, alias]) => {
    if (realName && alias) {
      map[realName.trim()] = alias.trim();
    }
  });
  
  return map;
}

/**
 * Obtiene la lista única de proveedores desde Movimientos, incluyendo CUIT y alias.
 */
function getProvidersList() {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sheetMov = ss.getSheetByName(SHEET_NAME);
  const aliasMap = _getProviderAliasMap();
  const uniqueProviders = {}; // { nombre: cuit }

  // Escanear movimientos: Col H (nombre) y Col I (cuit)
  if (sheetMov && sheetMov.getLastRow() > 1) {
    const data = sheetMov.getRange(2, 8, sheetMov.getLastRow() - 1, 2).getValues();
    data.forEach(([nombre, cuit]) => {
      if (nombre && nombre !== 'Consumidor Final') {
        if (!uniqueProviders[nombre]) uniqueProviders[nombre] = cuit || '';
      }
    });
  }

  return Object.entries(uniqueProviders)
    .map(([nombre, cuit]) => ({
      nombre,
      cuit: String(cuit).trim(),
      alias: aliasMap[nombre] || ''
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

function saveProviderAliases(payload) {
  // payload es array de { nombre, alias }
  const ss = SpreadsheetApp.openById(SS_ID);
  let sheet = ss.getSheetByName(PROVIDERS_SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(PROVIDERS_SHEET_NAME);
    sheet.getRange(1, 1, 1, 2).setValues([['Nombre Original', 'Alias']]).setFontWeight('bold');
  }

  // Sobreescribimos todo para simplificar (o podríamos hacer upsert)
  // Limpiar datos viejos
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).clearContent();
  }

  if (payload && payload.length > 0) {
    // Filtramos solo los que tienen alias
    const rows = payload
      .filter(p => p.alias && p.alias.trim() !== '')
      .map(p => [p.nombre, p.alias]);
    
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, 2).setValues(rows);
    }
  }

  return { status: 'OK', message: 'Alias guardados correctamente' };
}

/**
 * ============================================================================
 * CATEGORÍAS POR CUIT — Clasificación permanente de proveedores
 * ============================================================================
 */
const CATEGORIES_SHEET_NAME = 'Categorias';

/**
 * Devuelve un mapa { CUIT: Categoria } desde la hoja Categorias.
 */
function _getCuitCategoryMap(ss) {
  const sheet = ss.getSheetByName(CATEGORIES_SHEET_NAME);
  const map = {};
  if (!sheet || sheet.getLastRow() < 2) return map;
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  data.forEach(([cuit, categoria]) => {
    if (cuit && categoria) map[String(cuit).trim()] = String(categoria).trim();
  });
  return map;
}

/**
 * Devuelve el mapa de categorías como array para el frontend.
 */
function getCategoriesMap() {
  const ss = SpreadsheetApp.openById(SS_ID);
  const map = _getCuitCategoryMap(ss);
  return Object.entries(map).map(([cuit, categoria]) => ({ cuit, categoria }));
}

/**
 * Guarda (sobreescribe) el mapa CUIT → Categoría en la hoja Categorias.
 * @param {Array<{cuit, categoria}>} payload
 */
function saveCuitCategories(payload) {
  if (!payload || payload.length === 0) return { status: 'NO_DATA' };
  const ss = SpreadsheetApp.openById(SS_ID);
  let sheet = ss.getSheetByName(CATEGORIES_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(CATEGORIES_SHEET_NAME);
    sheet.getRange(1, 1, 1, 2).setValues([['CUIT', 'Categoria']]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 2).setBackground('#0f172a').setFontColor('#60a5fa');
  }

  // Limpiar y reescribir todo
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).clearContent();

  const rows = payload.filter(p => p.cuit && p.categoria).map(p => [p.cuit, p.categoria]);
  if (rows.length > 0) sheet.getRange(2, 1, rows.length, 2).setValues(rows);

  return { status: 'OK', message: `${rows.length} categorías guardadas.` };
}




function _crearEncabezados(sheet) {
  const headers = [
    'UUID', 'Fecha', 'Periodo Fiscal', 'Tipo Movimiento', 'Origen Dato', 'Rubro', 'Sub Rubro',
    'Entidad Nombre', 'Entidad CUIT', 'Comp. Tipo', 'Comp. Número',
    'Imp. Neto', 'Imp. IVA', 'Otros Tributos', 'Imp. Total', 'Método Pago', 'Observaciones'
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#EFEFEF');
}

/**
 * ============================================================================
 * REPORTING / DASHBOARD (Cálculo de KPIs)
 * ============================================================================
 */

/**
 * Genera un resumen financiero para un rango de fechas.
 * 
 * @param {string} startDate - Fecha inicio 'YYYY-MM-DD'.
 * @param {string} endDate - Fecha fin 'YYYY-MM-DD'.
 * @return {Object} JSON con KPIs calculados (Utilidad, IVA, Ticket Promedio, Mix Pagos).
 */
function getFinancialSummary(startDate, endDate, cargasPct = 33) {
  if (!startDate || !endDate) throw new Error("Rango de fechas inválido.");

  const _round = (num) => Math.round(((parseFloat(num) || 0) + Number.EPSILON) * 100) / 100;
  const ss = SpreadsheetApp.openById(SS_ID);
  
  // Sincronizar configuración dinámica antes de procesar
  _syncConfigFromSheet(ss);
  const busConfig = _getBusinessConfig(ss);
  const catMap = _getCuitCategoryMap(ss);
  const erMap = _getAllEstadoResultManual();
  
  // Usar configuración de la hoja 'Empresa' — sin fallback: si no está configurado, no se calculan comisiones
  const commTarj = parseFloat(busConfig.COMISION_TARJETAS || 0);
  const commApps = parseFloat(busConfig.COMISION_APPS || 0);
  const commOtros = parseFloat(busConfig.COMISION_OTROS || 0);
  const commEfvo = parseFloat(busConfig.COMISION_EFECTIVO || 0);
  const pctCargas = parseFloat(busConfig.PCT_CARGAS_SOCIALES || 0.33);
  
  
  // Acumuladores Nominales
  let utilidadNeta = 0;
  let totalComisiones = 0;
  let debitoFiscal = 0;
  let creditoFiscal = 0;
  let totalVentasBruto = 0;
  let totalVentasNeto = 0;
  let cantidadVentas = 0;
  
  // Categorización de Egresos
  let egresoLaboral = 0;
  let egresoEstructural = 0;
  let egresoOtros = 0;
  let totalRecibo = 0;

  const historyMap = {}; 
  const proveedoresMap = {};
  const mixPagos = {};
  const aliasMap = _getProviderAliasMap();

  const sParts = String(startDate).split('-'), eParts = String(endDate).split('-');
  if (sParts.length < 3 || eParts.length < 3) throw new Error("Formato de fecha inválido. Se espera YYYY-MM-DD.");

  const startObj = new Date(parseInt(sParts[0]), parseInt(sParts[1]) - 1, parseInt(sParts[2]), 0, 0, 0);
  const endObj = new Date(parseInt(eParts[0]), parseInt(eParts[1]) - 1, parseInt(eParts[2]), 23, 59, 59);
  
  if (isNaN(startObj.getTime()) || isNaN(endObj.getTime())) throw new Error("Fecha inválida.");
  
  // Extendemos a 13 meses para permitir comparativa interanual (YoY)
  const historyStart = new Date(startObj.getFullYear(), startObj.getMonth() - 13, 1, 0, 0, 0);

  // 1. PROCESAR MOVIMIENTOS (EGRESOS / MANUALES)
  const sheetMov = ss.getSheetByName(SHEET_NAME);
  if (sheetMov && sheetMov.getLastRow() >= 2) {
    const data = sheetMov.getRange(2, 1, sheetMov.getLastRow() - 1, 17).getValues();
    data.forEach(row => {
      const rowDate = new Date(row[1]);
      if (isNaN(rowDate.getTime())) return; // Saltar filas con fechas corruptas
      const tipo = row[3], neto = parseFloat(row[11] || 0), iva = parseFloat(row[12] || 0), otrosTrib = parseFloat(row[13] || 0), total = parseFloat(row[14] || 0);
      const k = `${rowDate.getFullYear()}-${String(rowDate.getMonth() + 1).padStart(2, '0')}`;
      
      const cuitRow = String(row[8] || '').trim();
      const categoria = catMap[cuitRow];

      // Ignorar si es NO_APTO
      if (categoria === 'NO_APTO') return;

      // Historial
      if (rowDate >= historyStart && rowDate <= endObj) {
        if (!historyMap[k]) historyMap[k] = { ventas: 0, gastos: 0, ventas_real: 0, gastos_real: 0, mep: CONST_MEP[k] || 1400, recibo: 0 };
        const ipc = CONST_IPC[k] || 1.0;
        if (tipo === 'INGRESO') {
          historyMap[k].ventas += neto;
          historyMap[k].ventas_real += (neto * ipc);
        } else if (categoria !== 'CMV') {
          historyMap[k].gastos += (-neto - otrosTrib);
          historyMap[k].gastos_real += ((-neto - otrosTrib) * ipc);
        }
      }

      // KPI Actual
      if (rowDate < startObj || rowDate > endObj) return;

      if (tipo === 'INGRESO') {
        utilidadNeta += neto;
      } else if (tipo === 'EGRESO') {
        const efectivoNeto  = -neto;
        const efectivoOtros = -otrosTrib;
        const efectivoIva   = -iva;

        // CMV: solo IVA Crédito — márgenes ya contemplan el costo de mercaderías
        if (categoria === 'CMV') {
          creditoFiscal += efectivoIva;
        } else {
          utilidadNeta += neto + otrosTrib;
          creditoFiscal += efectivoIva;

          if (categoria === 'GASTO_FIJO') {
            egresoEstructural += efectivoNeto + efectivoOtros;
          } else {
            egresoOtros += efectivoNeto + efectivoOtros;
          }
        }

        let entidad = String(row[7] || 'Varios');
        if (aliasMap[entidad]) entidad = aliasMap[entidad];
        if (!proveedoresMap[entidad]) proveedoresMap[entidad] = 0;
        proveedoresMap[entidad] += Math.abs(total);
      }
    });
  }

  // 2. PROCESAR SUELDOS
  const sheetSueldos = ss.getSheetByName(EMPLOYEES_SHEET_NAME);
  if (sheetSueldos && sheetSueldos.getLastRow() > 1) {
    const dataS = sheetSueldos.getRange(2, 1, sheetSueldos.getLastRow() - 1, 12).getValues();
    dataS.forEach(row => {
      const rowDate = new Date(row[1]), costo = parseFloat(row[10] || 0), recibo = parseFloat(row[11] || 0);
      const k = `${rowDate.getFullYear()}-${String(rowDate.getMonth() + 1).padStart(2, '0')}`;
      if (rowDate >= historyStart && rowDate <= endObj) {
        if (!historyMap[k]) historyMap[k] = { ventas: 0, gastos: 0, ventas_real: 0, gastos_real: 0, mep: CONST_MEP[k] || 1400, recibo: 0 };
        historyMap[k].gastos += costo;
        historyMap[k].recibo += recibo;
        historyMap[k].gastos_real += (costo * (CONST_IPC[k] || 1.0));
        historyMap[k].emp_count = (historyMap[k].emp_count || 0) + 1;
      }
      if (rowDate >= startObj && rowDate <= endObj) {
        egresoLaboral += costo;
        totalRecibo += recibo;
      }
    });
  }

  // 3. PROCESAR VENTAS MAXIREST
  const sheetMaxi = ss.getSheetByName(MAXIREST_SHEET_NAME);
  if (sheetMaxi && sheetMaxi.getLastRow() > 1) {
    const dataM = sheetMaxi.getRange(2, 1, sheetMaxi.getLastRow() - 1, 33).getValues();
    dataM.forEach(row => {
      const rowDate = new Date(row[1]), neto = parseFloat(row[6] || 0), iva = parseFloat(row[7] || 0), total = parseFloat(row[4] || 0);
      const k = `${rowDate.getFullYear()}-${String(rowDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (rowDate >= historyStart && rowDate <= endObj) {
        if (!historyMap[k]) historyMap[k] = { ventas: 0, gastos: 0, ventas_real: 0, gastos_real: 0, mep: CONST_MEP[k] || 1400 };
        historyMap[k].ventas += neto;
        historyMap[k].ventas_real += (neto * (CONST_IPC[k] || 1.0));
        historyMap[k].ops = (historyMap[k].ops || 0) + parseFloat(row[5] || 0);
      }

      if (rowDate < startObj || rowDate > endObj) return;
      
      totalVentasBruto += total;
      totalVentasNeto += neto;
      debitoFiscal += iva;
      cantidadVentas += parseFloat(row[5] || 0);

      // Cálculo de Comisiones por Medio de Pago
      const efvo = parseFloat(row[13] || 0), tarj = parseFloat(row[15] || 0), otros = parseFloat(row[17] || 0);
      totalComisiones += (tarj * commTarj) + (otros * commOtros) + (efvo * commEfvo);
      
      if (efvo > 0) mixPagos['Efectivo'] = (mixPagos['Efectivo'] || 0) + efvo;
      if (tarj > 0) mixPagos['Tarjetas'] = (mixPagos['Tarjetas'] || 0) + tarj;
      if (otros > 0) mixPagos['Otros'] = (mixPagos['Otros'] || 0) + otros;
    });
  }

  // Ajustes Finales
  // Provisión SAC: 1/12 del costo laboral mensual. Impacta el resultado porque el SAC se devenga todos los meses.
  const provisionSAC = egresoLaboral / 12;
  const provisionCargas = totalRecibo * pctCargas;
  const resFinal = totalVentasNeto - (egresoLaboral + egresoEstructural + egresoOtros + provisionSAC + provisionCargas) - totalComisiones;
  const breakEven = (egresoLaboral + egresoEstructural + provisionSAC + provisionCargas) / (totalVentasNeto > 0 ? (totalVentasNeto - totalComisiones) / totalVentasNeto : 1);

  // Obtener coeficientes para el periodo actual
  const currentPeriod = `${startObj.getFullYear()}-${String(startObj.getMonth() + 1).padStart(2, '0')}`;
  const currentIPC = CONST_IPC[currentPeriod] || 1.0;
  const currentMEP = CONST_MEP[currentPeriod] || 1400;

  return {
    periodo: `${startDate} al ${endDate}`,
    ajustes: {
      ipc: currentIPC,
      mep: currentMEP
    },
    config: busConfig, // Enviamos la config para que el front calcule alertas
    kpis: {
      utilidad_neta: _round(resFinal),
      ventas_netas_reales: _round(totalVentasNeto),
      venta_bruta: _round(totalVentasBruto),
      iva_debito: _round(debitoFiscal),
      iva_credito: _round(creditoFiscal),
      cant_operaciones: cantidadVentas,
      iva_posicion: _round(debitoFiscal - creditoFiscal),
      ticket_promedio: _round(cantidadVentas > 0 ? totalVentasNeto / cantidadVentas : 0),
      break_even_mensual: _round(breakEven),
    },
    egresos: {
      laboral: _round(egresoLaboral),
      provision_sac: _round(provisionSAC),
      provision_cargas: _round(provisionCargas),
      estructural: _round(egresoEstructural),
      otros: _round(egresoOtros),
      comisiones: _round(totalComisiones)
    },
    historial: Object.keys(historyMap).sort().reduce((obj, key) => {
      const h = historyMap[key];
      const ops = h.ops || 0;
      const emp = h.emp_count || 0;
      const sueldo_prom = emp > 0 ? _round((h.recibo || 0) / emp) : 0;
      const m = erMap[key];
      const resultado_mgn = m
        ? _round((m.mix_cafe / 100) * h.ventas * (m.mgn_cafe / 100) + (m.mix_producto / 100) * h.ventas * (m.mgn_producto / 100))
        : null;
      obj[key] = {
        v: _round(h.ventas),
        g: _round(h.gastos + ((h.recibo || 0) * (parseFloat(cargasPct) / 100))),
        vr: _round(h.ventas_real),
        gr: _round(h.gastos_real + ((h.recibo || 0) * (parseFloat(cargasPct) / 100) * (CONST_IPC[key] || 1.0))),
        mep: h.mep,
        ops,
        ticket: ops > 0 ? _round(h.ventas / ops) : 0,
        emp,
        sueldo_prom,
        resultado_mgn,
      };
      return obj;
    }, {}),
    mix_pagos: mixPagos,
    top_proveedores: Object.entries(proveedoresMap).sort((a,b) => b[1]-a[1]).slice(0,5).map(([n,t]) => ({n, t: _round(t)}))
  };
}

/**
 * ============================================================================
 * CONFIGURACIÓN DE EMPRESA Y AUDITORÍA
 * ============================================================================
 */

function _getBusinessConfig(ss) {
  const sheet = ss.getSheetByName(BUSINESS_CONFIG_SHEET_NAME) || ss.insertSheet(BUSINESS_CONFIG_SHEET_NAME);
  if (sheet.getLastRow() < 1) {
    sheet.appendRow(['Clave', 'Valor']);
    sheet.appendRow(['LOCAL_NOMBRE', 'Mi Negocio']);
    sheet.appendRow(['LOCAL_CUIT', '']);
    sheet.appendRow(['IIBB_ALICUOTA', '3.5']);
    sheet.appendRow(['OBJETIVO_MARGEN', '60']);
    sheet.appendRow(['COMISION_TARJETAS', '1.8']);
    sheet.appendRow(['COMISION_APPS', '25']);
    sheet.appendRow(['COMISION_OTROS', '5']);
    sheet.appendRow(['COMISION_EFECTIVO', '0']);
    sheet.appendRow(['OBJETIVO_VENTAS', '0']);
    sheet.appendRow(['PCT_CARGAS_SOCIALES', '33']);
  }
  const data = sheet.getDataRange().getValues();
  const config = {};
  data.slice(1).forEach(r => { if(r[0]) config[r[0]] = r[1]; });
  return config;
}

function _saveBusinessConfig(payload) {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName(BUSINESS_CONFIG_SHEET_NAME) || ss.insertSheet(BUSINESS_CONFIG_SHEET_NAME);
  sheet.clear();
  sheet.appendRow(['Clave', 'Valor']);
  Object.keys(payload).forEach(key => {
    sheet.appendRow([key, payload[key]]);
  });
  _logAudit(ss, 'CONFIG_EMPRESA', 1, 'GLOBAL');
  _updateStateHash();
  return { status: 'OK' };
}

function _logAudit(ss, origen, registros, periodo) {
  const sheet = ss.getSheetByName(AUDIT_LOG_SHEET_NAME) || ss.insertSheet(AUDIT_LOG_SHEET_NAME);
  if (sheet.getLastRow() < 1) {
    sheet.appendRow(['Timestamp', 'Origen/Acción', 'Registros', 'Periodo', 'User']);
  }
  sheet.appendRow([new Date(), origen, registros, periodo, 'Admin App']);
}

function getAuditLog() {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName(AUDIT_LOG_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getRange(2, 1, Math.min(sheet.getLastRow() - 1, 100), 5).getValues();
  return data.map(r => ({
    ts: r[0],
    action: r[1],
    count: r[2],
    period: r[3],
    user: r[4]
  })).reverse();
}


/**
 * ============================================================================
 * ESTADO DE RESULTADO — CAMPOS MANUALES
 * ============================================================================
 */

function _getEstadoResultManual(periodo) {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName(ESTADO_RESULT_MANUAL_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return null;
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getValues();
  const row = data.find(r => r[0] === periodo);
  if (!row) return null;
  return {
    mix_cafe: row[1],
    mix_producto: row[2],
    mgn_cafe: row[3],
    mgn_producto: row[4],
    excepcionales: row[5]
  };
}

function _updateStateHash() {
  const newHash = Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty('STATE_HASH', newHash);
  return newHash;
}

function _getAllEstadoResultManual() {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName(ESTADO_RESULT_MANUAL_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return {};
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getValues();
  return data.reduce((map, r) => {
    if (r[0]) map[r[0]] = { mix_cafe: r[1], mix_producto: r[2], mgn_cafe: r[3], mgn_producto: r[4], excepcionales: r[5] };
    return map;
  }, {});
}

function _saveEstadoResultManual(payload) {
  const { periodo, mix_cafe, mix_producto, mgn_cafe, mgn_producto, excepcionales } = payload;
  if (!periodo) throw new Error('Periodo requerido');
  const ss = SpreadsheetApp.openById(SS_ID);
  let sheet = ss.getSheetByName(ESTADO_RESULT_MANUAL_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(ESTADO_RESULT_MANUAL_SHEET_NAME);
    sheet.appendRow(['periodo', 'mix_cafe', 'mix_producto', 'mgn_cafe', 'mgn_producto', 'excepcionales', 'updated_at']);
  }
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const periodos = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < periodos.length; i++) {
      if (periodos[i][0] === periodo) {
        sheet.getRange(i + 2, 1, 1, 7).setValues([[periodo, mix_cafe, mix_producto, mgn_cafe, mgn_producto, excepcionales, new Date()]]);
        return { status: 'OK', action: 'updated' };
      }
    }
  }
  sheet.appendRow([periodo, mix_cafe, mix_producto, mgn_cafe, mgn_producto, excepcionales, new Date()]);
  _updateStateHash();
  return { status: 'OK', action: 'inserted' };
}

/**
 * ============================================================================
 * API CONTROLLER (doPost)
 * ============================================================================
 */

/**
 * Recibe peticiones POST (JSON) para insertar datos masivamente.
 * Endpoint para integraciones externas.
 */
function doPost(e) {
  try {
    // 1. Parsear el body del request
    // Verificamos que existan datos en postData
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("No se recibió contenido en la petición (postData vacío).");
    }

    const requestBody = JSON.parse(e.postData.contents);
    const { action, origen, payload } = requestBody;

    // 2. Validar acción
    if (action !== 'CARGAR_DATOS') {
      throw new Error(`Acción '${action}' no válida. Se espera 'CARGAR_DATOS'.`);
    }

    let resultado;

    // 3. Switch por origen (Router de Mappers)
    switch (origen) {
      case 'Resumen Maxirest':
      case 'MAXIREST_RESUMEN':
        resultado = saveResumenMaxirest(payload.map(item => MaxirestResumenMapper.mapResumen(item)));
        _logAudit(SpreadsheetApp.openById(SS_ID), 'CARGA_MAXIREST', payload.length, payload[0]?.fecha || 'N/A');
        break;
      case 'ARCA':
        resultado = saveMovimientos(payload.map(item => ArcaMapper.mapCompra(item)));
        _logAudit(SpreadsheetApp.openById(SS_ID), 'CARGA_ARCA', payload.length, 'MIX');
        break;
      case 'MANUAL_COSTS':
        resultado = saveMovimientos(payload.map(item => new Movimiento(item)));
        _logAudit(SpreadsheetApp.openById(SS_ID), 'CARGA_MANUAL', payload.length, payload[0]?.fecha_periodo || 'N/A');
        break;
      case 'SAVE_ALIASES':
        resultado = saveProviderAliases(payload);
        break;
      case 'SAVE_CATEGORIES':
        resultado = saveCuitCategories(payload);
        break;
      case 'SUELDOS':
        resultado = saveSueldos(payload.map(item => SueldosMapper.mapEmpleado(item)));
        _logAudit(SpreadsheetApp.openById(SS_ID), 'CARGA_SUELDOS', payload.length, payload[0]?.fecha_periodo || 'N/A');
        break;
      case 'SAVE_CONFIG':
        resultado = _saveConfigToSheet(payload);
        break;
      case 'SAVE_BUSINESS_CONFIG':
        resultado = _saveBusinessConfig(payload);
        break;
      case 'SAVE_ESTADO_RESULT':
        resultado = _saveEstadoResultManual(payload);
        break;
      default:
        throw new Error(`Origen '${origen}' no soportado.`);
    }

    _updateStateHash(); // Forzar cambio de hash al cargar datos

    // 4. Retornar respuesta exitosa
    return ContentService.createTextOutput(JSON.stringify(resultado)).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'ERROR', message: error.message })).setMimeType(ContentService.MimeType.JSON);
  }
}


/**
 * ============================================================================
 * HELPERS AUXILIARES
 * ============================================================================
 */

/**
 * Obtiene metadatos de las fechas disponibles (Min y Max) para validar rangos en Front.
 * @return {Object} { minDate: 'YYYY-MM-DD', maxDate: 'YYYY-MM-DD' }
 */
function getDataMetadata() {
  const ss = SpreadsheetApp.openById(SS_ID);
  const periodsMap = {}; // { "YYYY-MM": { v, a, e, g } }

  const scan = (sheetName, type) => {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return;
    
    const numCols = sheet.getLastColumn();
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, numCols).getValues();
    
    data.forEach(row => {
      let dateVal = row[1]; // Fecha suele estar en Col B (index 1)
      if (!(dateVal instanceof Date)) {
        if (typeof dateVal === 'string' && dateVal.includes('-')) {
          dateVal = new Date(dateVal + 'T12:00:00');
        } else {
          return;
        }
      }
      
      const y = dateVal.getFullYear();
      const m = String(dateVal.getMonth() + 1).padStart(2, '0');
      const p = `${y}-${m}`;
      
      if (!periodsMap[p]) periodsMap[p] = { v: false, a: false, e: false, g: false };
      
      if (type === 'ventas') periodsMap[p].v = true;
      if (type === 'empleados') periodsMap[p].e = true;
      if (type === 'movimientos') {
        const tipo = row[3];   // Col D: Tipo Movimiento
        const rubro = String(row[5] || ''); // Col F: Rubro
        if (tipo === 'EGRESO') {
          if (rubro === 'Costos Estructurales') {
            periodsMap[p].g = true;
          } else {
            periodsMap[p].a = true;
          }
        }
      }
    });
  };

  scan(MAXIREST_SHEET_NAME, 'ventas');
  scan(EMPLOYEES_SHEET_NAME, 'empleados');
  scan(SHEET_NAME, 'movimientos');

  const sortedPeriods = Object.keys(periodsMap).sort().reverse().map(p => {
    const meta = periodsMap[p];
    const score = (meta.v ? 1 : 0) + (meta.a ? 1 : 0) + (meta.e ? 1 : 0) + (meta.g ? 1 : 0);
    return {
      id: p,
      ...meta,
      score,
      isComplete: score === 4
    };
  });

  return {
    periods: sortedPeriods
  };
}


function getEmployeesByPeriod(startStr, endStr) {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName(EMPLOYEES_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const start = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T23:59:59');

  // Leer todo y filtrar (para sets de datos pequeños/medianos está bien)
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 13).getValues();
  
  // Mapeamos array a objeto legible para frontend
  return data.filter(row => {
    const d = new Date(row[1]); // Columna Fecha
    return d >= start && d <= end;
  }).map(row => ({
    nombre: row[4], 
    tarea: row[5], 
    dni: row[6],
    total_hs: row[8], 
    costo_total: row[10],
    recibo: row[11], 
    negro: row[12]
  }));
}

function getArcaData(startStr, endStr) {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const start = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T23:59:59');
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 17).getValues();
  return data.filter(row => {
    const d = new Date(row[1]);
    const tipo = row[3];
    return d >= start && d <= end && tipo === 'EGRESO';
  }).map(row => ({
    fecha: row[1], rubro: row[5], sub_rubro: row[6], entidad: row[7], cuit: row[8], 
    tipo_comp: row[9], nro_comp: row[10], neto: row[11], iva: row[12], total: row[14], metodo: row[15]
  }));
}

function getMaxirestRawData(startStr, endStr) {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName(MAXIREST_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const start = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T23:59:59');
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 33).getValues();
  return data.filter(row => {
    const d = new Date(row[1]);
    return d >= start && d <= end;
  }).map(row => ({
    fecha: row[1], 
    total: row[4], 
    neto: row[6], 
    iva: row[7], 
    efectivo: row[13], 
    tarjetas: row[15],
    otros: row[17],
    val_factura_b_elec: row[19], // Columna T (Factura B Electrónica)
    val_factura_b: row[21]       // Columna V (Factura B Manual/Exenta)
  }));
}

/**
 * ============================================================================
 * API GET (Reportes)
 * ============================================================================
 */

/**
 * Maneja peticiones GET. Útil para consultar reportes desde el Frontend.
 * Url: .../exec?action=GET_DASHBOARD&period=2026-01
 */
function doGet(e) {
  try {
    const action = e.parameter.action;
    const serverHash = PropertiesService.getScriptProperties().getProperty('STATE_HASH') || 'initial';
    
    if (action === 'GET_HASH') {
      return ContentService.createTextOutput(JSON.stringify({ hash: serverHash })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'GET_METADATA') {
      const meta = getDataMetadata();
      return ContentService.createTextOutput(JSON.stringify(meta)).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'GET_COMPLETE_DATA') {
      // Lógica de Caché Inteligente (Hash)
      const localHash = e.parameter.localHash;
      if (localHash && localHash === serverHash) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'NOT_MODIFIED' }))
                             .setMimeType(ContentService.MimeType.JSON);
      }

      const start = e.parameter.start;
      const end = e.parameter.end;
      const cPct = e.parameter.cargasPct || 33;

      const dashboard = getFinancialSummary(start, end, cPct);
      const employees = getEmployeesByPeriod(start, end);
      const arca = getArcaData(start, end);
      const ventas = getMaxirestRawData(start, end);
      dashboard.estado_result_manual = _getEstadoResultManual(start.substring(0, 7));

      const consolidatedData = {
        dashboard: dashboard,
        employees: employees,
        arca: arca,
        ventas: ventas,
        stateHash: serverHash,
        metadata: getDataMetadata(),
        categoriesMap: getCategoriesMap()
      };
      return ContentService.createTextOutput(JSON.stringify(consolidatedData)).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'GET_PROVIDERS') {
      const providers = getProvidersList();
      return ContentService.createTextOutput(JSON.stringify(providers)).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'GET_CATEGORIES_MAP') {
      const catMap = getCategoriesMap();
      return ContentService.createTextOutput(JSON.stringify(catMap)).setMimeType(ContentService.MimeType.JSON);
    }


    if (action === 'GET_EMPLOYEES') {
      const data = getEmployeesByPeriod(e.parameter.start, e.parameter.end);
      return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'GET_ARCA') {
      const data = getArcaData(e.parameter.start, e.parameter.end);
      return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'GET_MAXIREST_RAW') {
      const data = getMaxirestRawData(e.parameter.start, e.parameter.end);
      return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'GET_BUSINESS_CONFIG') {
      const ss = SpreadsheetApp.openById(SS_ID);
      const data = _getBusinessConfig(ss);
      return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'GET_AUDIT') {
      const data = getAuditLog();
      return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'ERROR', message: 'Parámetros inválidos' })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'ERROR', message: error.message })).setMimeType(ContentService.MimeType.JSON);
  }
}
/**
 * Sincroniza las variables globales CONST_IPC y CONST_MEP con la hoja 'Config'.
 * Estructura de la hoja: Col A (Periodo YYYY-MM), Col B (IPC), Col C (MEP)
 */
function _syncConfigFromSheet(ss) {
  const sheet = ss.getSheetByName(CONFIG_SHEET_NAME);
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  
  const data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  data.forEach(row => {
    const k = String(row[0]).trim();
    if (k && k.includes('-')) {
      CONST_IPC[k] = parseFloat(row[1]) || (CONST_IPC[k] || 1.0);
      CONST_MEP[k] = parseFloat(row[2]) || (CONST_MEP[k] || 1000);
    }
  });
}

/**
 * Guarda los valores de IPC/MEP enviados desde el frontend.
 */
function _saveConfigToSheet(payload) {
  const { periodo, ipc, mep } = payload;
  if (!periodo) throw new Error("Periodo inválido para guardar configuración.");
  
  const ss = SpreadsheetApp.openById(SS_ID);
  let sheet = ss.getSheetByName(CONFIG_SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG_SHEET_NAME);
    sheet.getRange(1, 1, 1, 3).setValues([['Periodo (YYYY-MM)', 'IPC Factor', 'MEP Cotiz']]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#EFEFEF');
  }
  
  const lastRow = sheet.getLastRow();
  let periods = [];
  if (lastRow > 1) {
    periods = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().map(p => String(p).trim());
  }
  
  const rowIndex = periods.indexOf(periodo);
  if (rowIndex !== -1) {
    // Actualizar fila existente
    sheet.getRange(rowIndex + 2, 2, 1, 2).setValues([[ipc, mep]]);
  } else {
    // Insertar nueva fila
    sheet.appendRow([periodo, ipc, mep]);
    _updateStateHash();
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).sort({ column: 1, ascending: false });
  }
  
  return { status: 'OK', message: 'Configuración guardada correctamente' };
}
