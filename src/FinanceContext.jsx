import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from './supabaseClient';

const FinanceContext = createContext();

const APP_VERSION = '2.0.0'; // Supabase migration

const validatePersistence = () => {
    const savedVersion = localStorage.getItem('app_version');
    if (savedVersion !== APP_VERSION) {
        localStorage.clear();
        localStorage.setItem('app_version', APP_VERSION);
    }
};

const getVisiblePeriods = () => {
    const now = new Date();
    const periods = [];
    for (let i = 8; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        periods.push({
            y: String(d.getFullYear()),
            m: String(d.getMonth() + 1).padStart(2, '0')
        });
    }
    return periods;
};

// Fecha del primer y ultimo dia del mes
const monthRange = (year, month) => {
    const y = parseInt(year);
    const m = parseInt(month);
    const start = `${year}-${month}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const end = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    return { start, end };
};

// Computar KPIs desde datos crudos
const computeDashboard = (ventas, compras, empleados, costosManuales, categorias, config, ajuste) => {
    const num = (v) => {
        if (v === undefined || v === null || v === '') return 0;
        const n = parseFloat(v);
        return Number.isFinite(n) ? n : 0;
    };

    // --- KPIs de ventas ---
    let venta_bruta = 0, iva_debito = 0, ventas_netas = 0, cant_operaciones = 0;
    let mix_canales = {};

    ventas.forEach(v => {
        venta_bruta += num(v.total);
        iva_debito += num(v.iva);
        ventas_netas += num(v.neto);
        cant_operaciones += num(v.val_cantidad);

        // Mix canales
        if (num(v.val_mostrador)) mix_canales.mostrador = (mix_canales.mostrador || 0) + num(v.val_mostrador);
        if (num(v.val_salon)) mix_canales.salon = (mix_canales.salon || 0) + num(v.val_salon);
        if (num(v.val_exterior)) mix_canales.exterior = (mix_canales.exterior || 0) + num(v.val_exterior);
        if (num(v.val_producto)) mix_canales.producto = (mix_canales.producto || 0) + num(v.val_producto);
    });

    // --- IVA credito (compras) ---
    let iva_credito = 0;
    let total_compras = 0;
    let total_compras_estructural = 0;

    const catMap = {};
    categorias.forEach(c => { catMap[c.cuit] = c.categoria; });

    compras.forEach(c => {
        iva_credito += Math.abs(num(c.iva));
        const cat = catMap[c.cuit] || '';
        if (cat === 'GASTO_FIJO' || c.rubro === 'Costos Estructurales') {
            total_compras_estructural += Math.abs(num(c.total));
        } else {
            total_compras += Math.abs(num(c.total));
        }
    });

    // --- Egresos laborales ---
    let laboral = 0, recibo_total = 0;
    empleados.forEach(e => {
        laboral += num(e.costo_total) || (num(e.recibo) + num(e.negro));
        recibo_total += num(e.recibo);
    });

    // --- Costos manuales ---
    let estructural_manual = 0, retenciones = 0, iva_credito_manual = 0;
    costosManuales.forEach(cm => {
        if (cm.rubro === 'Costos Estructurales') {
            estructural_manual += Math.abs(num(cm.importe_total));
        } else if (cm.rubro === 'Retenciones') {
            retenciones += Math.abs(num(cm.importe_total));
        }
        // IVA de costos manuales suma al crédito fiscal
        iva_credito_manual += Math.abs(num(cm.importe_iva));
    });
    iva_credito += iva_credito_manual;

    // --- Comisiones ---
    const comTarj = num(config?.comision_tarjetas) || 0;
    const comOtros = num(config?.comision_otros) || 0;
    const comEfvo = num(config?.comision_efectivo) || 0;
    let comisiones = 0;
    ventas.forEach(v => {
        comisiones += num(v.val_tarjetas) * comTarj;
        comisiones += num(v.val_otros) * comOtros;
        comisiones += num(v.val_efectivo) * comEfvo;
    });

    // --- Provisiones ---
    const cargasPct = num(config?.pct_cargas_sociales) || 0.33;
    const provision_sac = laboral / 12;
    const provision_cargas = recibo_total * cargasPct;

    const estructural = estructural_manual + total_compras_estructural;
    const total_egresos = laboral + provision_sac + provision_cargas + estructural + comisiones + total_compras;
    const utilidad_neta = ventas_netas - total_egresos;
    const break_even_mensual = total_egresos; // punto de equilibrio simplificado: ventas = egresos totales

    // --- Mix pagos ---
    let efvo = 0, tarj = 0, otros = 0;
    ventas.forEach(v => {
        efvo += num(v.val_efectivo);
        tarj += num(v.val_tarjetas);
        otros += num(v.val_otros);
    });

    return {
        kpis: {
            venta_bruta,
            ventas_netas_reales: ventas_netas,
            iva_debito,
            iva_credito,
            iva_posicion: iva_debito - iva_credito,
            utilidad_neta,
            break_even_mensual,
            cant_operaciones,
        },
        egresos: {
            laboral,
            otros: total_compras,
            estructural,
            comisiones,
            retenciones,
            provision_sac,
            provision_cargas,
        },
        mix_pagos: { efectivo: efvo, tarjetas: tarj, otros },
        ajustes: {
            ipc: num(ajuste?.ipc) || 1,
            mep: num(ajuste?.mep) || 1000,
        },
        analisis_ventas: { mix_canales },
        estado_result_manual: ajuste ? {
            mix_cafe: num(ajuste.mix_cafe),
            mix_producto: num(ajuste.mix_producto),
            mgn_cafe: num(ajuste.mgn_cafe),
            mgn_producto: num(ajuste.mgn_producto),
            excepcionales: num(ajuste.excepcionales),
        } : null,
    };
};

export const FinanceProvider = ({ children }) => {
    validatePersistence();

    const [dashData, setDashData]       = useState(null);
    const [empData, setEmpData]         = useState([]);
    const [arcaData, setArcaData]       = useState([]);
    const [ventasData, setVentasData]   = useState([]);
    const [loading, setLoading]         = useState(false);
    const [categoriesMap, setCategoriesMap] = useState({});
    const [isRefreshing, setIsRefreshing]   = useState(false);
    const [error, setError]             = useState(null);
    const [availablePeriods, setAvailablePeriods] = useState([]);
    const [newDataAvailable, setNewDataAvailable] = useState(false);
    const [configData, setConfigData]   = useState(null);

    // Mantenemos apiUrl como string no-vacio para que los guards de App.jsx no bloqueen
    const apiUrl = 'supabase';
    const setApiUrl = () => {};
    const finalApiUrl = 'supabase';

    const [selectedYear, setSelectedYear] = useState(() =>
        localStorage.getItem('selectedYear') || String(new Date().getFullYear())
    );
    const [selectedMonth, setSelectedMonth] = useState(() =>
        localStorage.getItem('selectedMonth') || String(new Date().getMonth() + 1).padStart(2, '0')
    );
    const [cargasPct, setCargasPct] = useState(() => localStorage.getItem('cfg_cargas_pct') || "33");
    const [viewMode, setViewMode] = useState('NOMINAL');
    const [localAjustes, setLocalAjustes] = useState({ ipc: 1, mep: 1000 });

    const memCache = useRef({});

    useEffect(() => {
        localStorage.setItem('selectedYear', selectedYear);
        localStorage.setItem('selectedMonth', selectedMonth);
    }, [selectedYear, selectedMonth]);

    useEffect(() => {
        localStorage.setItem('cfg_cargas_pct', cargasPct);
    }, [cargasPct]);

    useEffect(() => {
        if (dashData?.ajustes) setLocalAjustes(dashData.ajustes);
    }, [dashData]);

    // Cargar config del negocio una vez
    useEffect(() => {
        (async () => {
            const { data } = await supabase.from('config_negocio').select('*').eq('id', 1).single();
            if (data) setConfigData(data);
        })();
    }, []);

    // ── Helpers ──────────────────────────────────────────────────────────────────

    const applyPeriodData = useCallback((data) => {
        setDashData(data.dash);
        setEmpData(data.emp || []);
        setArcaData(data.arca || []);
        setVentasData(data.ventas || []);
        if (data.metadata?.periods) setAvailablePeriods(data.metadata.periods);
        if (data.categoriesMap) {
            const catMap = {};
            data.categoriesMap.forEach(i => { catMap[i.cuit] = i.categoria; });
            setCategoriesMap(catMap);
        }
    }, []);

    // ── Fetch de un periodo desde Supabase ──────────────────────────────────────
    const fetchPeriodData = useCallback(async (year, month) => {
        const periodKey = `${year}-${month}`;

        // Cache en memoria
        if (memCache.current[periodKey]) return memCache.current[periodKey];

        const { start, end } = monthRange(year, month);
        const periodoStr = `${year}-${month}`;

        // Queries en paralelo
        const [
            ventasRes,
            comprasRes,
            empleadosRes,
            costosRes,
            categoriasRes,
            ajusteRes,
        ] = await Promise.all([
            supabase.from('ventas').select('*').gte('fecha', start).lte('fecha', end),
            supabase.from('compras').select('*').gte('fecha', start).lte('fecha', end),
            supabase.from('empleados_dec').select('*').gte('fecha_periodo', start).lte('fecha_periodo', end),
            supabase.from('costos_manuales').select('*').gte('fecha', start).lte('fecha', end),
            supabase.from('categorias').select('*'),
            supabase.from('ajustes_periodo').select('*').eq('periodo', periodoStr).maybeSingle(),
        ]);

        // Chequear errores
        const anyError = [ventasRes, comprasRes, empleadosRes, costosRes, categoriasRes].find(r => r.error);
        if (anyError?.error) throw new Error(anyError.error.message);

        const ventas = ventasRes.data || [];
        const compras = comprasRes.data || [];
        const empleados = empleadosRes.data || [];
        const costosManuales = costosRes.data || [];
        const categorias = categoriasRes.data || [];
        const ajuste = ajusteRes.data;

        // Juntar compras + costos manuales para arcaData (las vistas los consumen unificados)
        const arcaCombined = [
            ...compras,
            ...costosManuales.map(cm => ({
                fecha: cm.fecha,
                tipo_comp: cm.metodo_pago || 'Manual',
                nro_comp: 'Manual',
                cuit: '',
                entidad: cm.sub_rubro || cm.rubro,
                neto: cm.importe_neto,
                iva: cm.importe_iva,
                total: cm.importe_total,
                rubro: cm.rubro,
                sub_rubro: cm.sub_rubro,
                origen_dato: cm.origen_dato,
                importe_neto: cm.importe_neto,
                importe_iva: cm.importe_iva,
                importe_total: cm.importe_total,
                metodo_pago: cm.metodo_pago,
            }))
        ];

        const dash = computeDashboard(ventas, compras, empleados, costosManuales, categorias, configData, ajuste);

        const data = {
            dash,
            emp: empleados,
            arca: arcaCombined,
            ventas,
            categoriesMap: categorias,
        };

        memCache.current[periodKey] = data;
        return data;
    }, [configData]);

    // ── Computar metadata de periodos (score por completitud) ────────────────────
    const computePeriodsMetadata = useCallback(async () => {
        const periods = getVisiblePeriods();
        const results = [];

        for (const { y, m } of periods) {
            const { start, end } = monthRange(y, m);
            const periodoId = `${y}-${m}`;

            // Queries livianas — solo count
            const [ventasCount, comprasCount, empCount, costosCount] = await Promise.all([
                supabase.from('ventas').select('id', { count: 'exact', head: true }).gte('fecha', start).lte('fecha', end),
                supabase.from('compras').select('id', { count: 'exact', head: true }).gte('fecha', start).lte('fecha', end),
                supabase.from('empleados').select('id', { count: 'exact', head: true }).gte('fecha_periodo', start).lte('fecha_periodo', end),
                supabase.from('costos_manuales').select('id', { count: 'exact', head: true }).gte('fecha', start).lte('fecha', end),
            ]);

            const hasVentas = (ventasCount.count || 0) > 0;
            const hasCompras = (comprasCount.count || 0) > 0;
            const hasEmp = (empCount.count || 0) > 0;
            const hasCostos = (costosCount.count || 0) > 0;

            const score = [hasVentas, hasCompras, hasEmp, hasCostos].filter(Boolean).length;

            results.push({
                id: periodoId,
                isComplete: score === 4,
                score,
                hasVentas, hasCompras, hasEmp, hasCostos,
            });
        }

        return results;
    }, []);

    // ── Computar historial para graficos (y arrastre de saldo a favor de IVA) ────
    const computeHistorial = useCallback(async () => {
        const periods = getVisiblePeriods(); // ordenados de mas viejo a mas nuevo
        const historial = {};
        let saldoFavorArrastrado = 0; // saldo a favor que entra a cada periodo, acumulado desde el mas viejo visible

        for (const { y, m } of periods) {
            try {
                const data = await fetchPeriodData(y, m);
                if (!data?.dash) continue;

                const kpis = data.dash.kpis;
                const empCount = (data.emp || []).length;
                const laboral = data.dash.egresos.laboral;

                const posicionNeta = kpis.iva_posicion - saldoFavorArrastrado;

                historial[`${y}-${m}`] = {
                    v: kpis.ventas_netas_reales,
                    ticket: kpis.cant_operaciones > 0 ? kpis.venta_bruta / kpis.cant_operaciones : 0,
                    sueldo_prom: empCount > 0 ? laboral / empCount : 0,
                    resultado_mgn: kpis.utilidad_neta,
                    ops: kpis.cant_operaciones,
                    emp: empCount,
                    iva_saldo_favor_entrante: saldoFavorArrastrado,
                    iva_posicion_neta: posicionNeta,
                };

                // Si este mes queda con saldo a favor (posicion neta negativa), se arrastra al que sigue.
                // Si queda a pagar, se asume pagado: no hay arrastre hacia el proximo mes.
                saldoFavorArrastrado = posicionNeta < 0 ? -posicionNeta : 0;
            } catch { /* silencioso */ }
        }

        return historial;
    }, [fetchPeriodData]);

    // ── fetchData — carga el periodo seleccionado ────────────────────────────────
    const fetchData = useCallback(async (force = false) => {
        if (force) {
            const periodKey = `${selectedYear}-${selectedMonth}`;
            delete memCache.current[periodKey];
        }

        const periodKey = `${selectedYear}-${selectedMonth}`;
        const hasCache = !force && memCache.current[periodKey];

        if (!hasCache) {
            setLoading(true);
            setError(null);
        }

        try {
            const data = await fetchPeriodData(selectedYear, selectedMonth);
            if (!data) throw new Error('No se recibieron datos.');
            applyPeriodData(data);
            if (force) setNewDataAvailable(false);

            // Computar historial y metadata en background
            computeHistorial().then(historial => {
                setDashData(prev => {
                    if (!prev) return prev;
                    const periodKey = `${selectedYear}-${selectedMonth}`;
                    const propio = historial[periodKey];
                    return {
                        ...prev,
                        historial,
                        kpis: propio ? {
                            ...prev.kpis,
                            iva_saldo_favor_anterior: propio.iva_saldo_favor_entrante,
                            iva_posicion_neta: propio.iva_posicion_neta,
                        } : prev.kpis,
                    };
                });
            });
            computePeriodsMetadata().then(periods => {
                setAvailablePeriods(periods);
            });
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, [selectedYear, selectedMonth, fetchPeriodData, applyPeriodData, computeHistorial, computePeriodsMetadata]);

    // Auto-fetch al montar y cuando cambia el periodo
    useEffect(() => {
        fetchData(false);
    }, [fetchData]);

    // ── Prefetch silencioso (ya no necesario, historial lo cubre) ────────────────
    const prefetchVisiblePeriods = useCallback(async () => {}, []);

    // ── Hash check (reemplazado por Supabase realtime en futuro) ─────────────────
    const checkHash = useCallback(async () => {}, []);

    // ── manualRefresh ──────────────────────────────────────────────────────────
    const manualRefresh = useCallback(async () => {
        // Limpiar todo el cache
        memCache.current = {};
        setLoading(true);
        try {
            await fetchData(true);
        } catch (e) { /* manejado por fetchData */ }
    }, [fetchData]);

    // ── invalidateCache ───────────────────────────────────────────────────────
    const invalidateCache = useCallback((year, month) => {
        const periodKey = `${year}-${month}`;
        delete memCache.current[periodKey];
    }, []);

    // ── updateConfig (IPC/MEP por periodo) ──────────────────────────────────────
    const updateConfig = async (periodo, ipc, mep) => {
        try {
            const { error } = await supabase
                .from('ajustes_periodo')
                .upsert({ periodo, ipc: parseFloat(ipc), mep: parseFloat(mep) }, { onConflict: 'periodo' });

            if (!error) {
                setDashData(prev => prev ? { ...prev, ajustes: { ipc: parseFloat(ipc), mep: parseFloat(mep) } } : prev);
                return true;
            }
        } catch (e) { console.error("Error guardando config:", e); }
        return false;
    };

    // ── fetchCategoriesMap (usado por CategoriesView) ───────────────────────────
    const fetchCategoriesMap = useCallback(async () => {
        const { data } = await supabase.from('categorias').select('*');
        if (data) {
            const catMap = {};
            data.forEach(i => { catMap[i.cuit] = i.categoria; });
            setCategoriesMap(catMap);
        }
    }, []);

    const value = useMemo(() => ({
        apiUrl, setApiUrl, finalApiUrl,
        dashData, setDashData, empData, arcaData, ventasData,
        isRefreshing,
        categoriesMap,
        loading, setLoading, error,
        selectedYear, setSelectedYear,
        selectedMonth, setSelectedMonth,
        cargasPct, setCargasPct,
        viewMode, setViewMode,
        availablePeriods,
        localAjustes, setLocalAjustes,
        newDataAvailable, setNewDataAvailable,
        updateConfig,
        fetchData,
        fetchPeriodData,
        checkHash,
        prefetchVisiblePeriods,
        manualRefresh,
        invalidateCache,
        fetchCategoriesMap,
        configData,
    }), [
        dashData, empData, arcaData, ventasData,
        isRefreshing, loading, error,
        selectedYear, selectedMonth, cargasPct, viewMode,
        availablePeriods, localAjustes, categoriesMap,
        newDataAvailable, configData,
        fetchData, fetchPeriodData, checkHash, prefetchVisiblePeriods, manualRefresh, invalidateCache, fetchCategoriesMap
    ]);

    return (
        <FinanceContext.Provider value={value}>
            {children}
        </FinanceContext.Provider>
    );
};

export const useFinance = () => {
    const context = useContext(FinanceContext);
    if (!context) throw new Error('useFinance debe usarse dentro de un FinanceProvider');
    return context;
};
