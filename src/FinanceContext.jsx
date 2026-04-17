import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';

const FinanceContext = createContext();

const APP_VERSION = '1.2.5';

const validatePersistence = () => {
    const savedVersion = localStorage.getItem('app_version');
    if (savedVersion !== APP_VERSION) {
        const apiUrl = localStorage.getItem('gas_api_url');
        localStorage.clear();
        if (apiUrl) localStorage.setItem('gas_api_url', apiUrl);
        localStorage.setItem('app_version', APP_VERSION);
    }
};

const getInitialApiUrl = () => {
    const stored = localStorage.getItem('gas_api_url');
    if (stored) return stored;
    const param = new URLSearchParams(window.location.search).get('apiUrl');
    if (param) { localStorage.setItem('gas_api_url', param); return param; }
    const env = import.meta.env.VITE_API_URL;
    if (env) { localStorage.setItem('gas_api_url', env); return env; }
    return '';
};

// Compute the 9 visible period keys shown in the UI
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

export const FinanceProvider = ({ children }) => {
    validatePersistence();

    const [apiUrl, setApiUrl] = useState(getInitialApiUrl);

    const finalApiUrl = useMemo(() => {
        if (!apiUrl) return '';
        if (apiUrl.startsWith('AKfy')) return `https://script.google.com/macros/s/${apiUrl}/exec`;
        if (!apiUrl.startsWith('http')) return `https://${apiUrl}`;
        return apiUrl;
    }, [apiUrl]);

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

    const [selectedYear, setSelectedYear] = useState(() =>
        localStorage.getItem('selectedYear') || String(new Date().getFullYear())
    );
    const [selectedMonth, setSelectedMonth] = useState(() =>
        localStorage.getItem('selectedMonth') || String(new Date().getMonth() + 1).padStart(2, '0')
    );
    const [cargasPct, setCargasPct] = useState(() => localStorage.getItem('cfg_cargas_pct') || "33");
    const [viewMode, setViewMode] = useState('NOMINAL');
    const [localAjustes, setLocalAjustes] = useState({ ipc: 1, mep: 1000 });

    // In-memory cache — más rápido que localStorage para switching de meses
    const memCache = useRef({});
    // Hash del servidor conocido — para detectar cambios
    const lastKnownHash = useRef(localStorage.getItem('last_server_hash') || null);

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

    // ── Helpers ────────────────────────────────────────────────────────────────

    const getCacheKey = useCallback((year, month) => {
        return `cache_${btoa(apiUrl).substring(0, 8)}_${year}_${month}`;
    }, [apiUrl]);

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

    // ── Fetch de bajo nivel — sin tocar loading/error state ───────────────────
    // Retorna los datos del periodo. Usa memCache → localStorage → red, en ese orden.
    const fetchPeriodData = useCallback(async (year, month) => {
        const periodKey = `${year}-${month}`;

        // 1. Memoria (instantáneo)
        if (memCache.current[periodKey]) return memCache.current[periodKey];

        // 2. localStorage
        const cacheKey = getCacheKey(year, month);
        try {
            const raw = localStorage.getItem(cacheKey);
            if (raw) {
                const data = JSON.parse(raw);
                memCache.current[periodKey] = data;
                return data;
            }
        } catch (e) {
            localStorage.removeItem(cacheKey);
        }

        // 3. Red
        const start = `${year}-${month}-01`;
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        const end = `${year}-${month}-${lastDay}`;
        const url = `${finalApiUrl}?action=GET_COMPLETE_DATA&start=${start}&end=${end}&cargasPct=${cargasPct}`;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 45000);
        try {
            const res = await fetch(url, { signal: controller.signal }).then(r => r.json());
            clearTimeout(timer);

            if (res.status === 'ERROR' || !res.dashboard) return null;

            // Actualizar hash conocido
            if (res.stateHash) {
                lastKnownHash.current = res.stateHash;
                localStorage.setItem('last_server_hash', res.stateHash);
            }

            const data = {
                dash: res.dashboard,
                emp: res.employees || [],
                arca: res.arca || [],
                ventas: res.ventas || [],
                metadata: res.metadata,
                categoriesMap: res.categoriesMap,
                hash: res.stateHash
            };
            memCache.current[periodKey] = data;
            localStorage.setItem(cacheKey, JSON.stringify(data));
            return data;
        } catch (e) {
            clearTimeout(timer);
            if (e.name === 'AbortError') throw new Error('Timeout: el servidor tardó demasiado. Intentá de nuevo con ↻.');
            throw e;
        }
    }, [finalApiUrl, cargasPct, getCacheKey]);

    // ── fetchData — carga el periodo seleccionado en el estado UI ─────────────
    const fetchData = useCallback(async (force = false) => {
        if (!apiUrl) return;

        if (force) {
            // Invalidar caches del periodo actual
            const periodKey = `${selectedYear}-${selectedMonth}`;
            delete memCache.current[periodKey];
            localStorage.removeItem(getCacheKey(selectedYear, selectedMonth));
        }

        // Verificar si hay datos en cache antes de mostrar spinner
        const periodKey = `${selectedYear}-${selectedMonth}`;
        const hasCache = !force && (
            memCache.current[periodKey] ||
            localStorage.getItem(getCacheKey(selectedYear, selectedMonth))
        );

        if (!hasCache) {
            setLoading(true);
            setError(null);
        }

        try {
            const data = await fetchPeriodData(selectedYear, selectedMonth);
            if (!data) throw new Error('No se recibieron datos del tablero.');
            applyPeriodData(data);
            if (force) setNewDataAvailable(false);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, [apiUrl, selectedYear, selectedMonth, fetchPeriodData, applyPeriodData, getCacheKey]);

    // Auto-fetch al montar y cuando cambia el periodo seleccionado
    useEffect(() => {
        fetchData(false);
    }, [fetchData]);

    // ── Prefetch silencioso de todos los periodos visibles ────────────────────
    // Se llama una vez después de la carga inicial. Sin loading indicators.
    const prefetchVisiblePeriods = useCallback(async () => {
        if (!finalApiUrl) return;
        const periods = getVisiblePeriods();
        for (const { y, m } of periods) {
            if (y === selectedYear && m === selectedMonth) continue; // Ya cargado
            try {
                await fetchPeriodData(y, m); // Lee cache si existe, va a red si no
            } catch (e) { /* Silent — no bloquear por un periodo fallido */ }
            // Pausa entre requests para no saturar GAS
            await new Promise(r => setTimeout(r, 800));
        }
    }, [finalApiUrl, selectedYear, selectedMonth, fetchPeriodData]);

    // ── Hash check liviano — detecta cambios sin traer datos ─────────────────
    const checkHash = useCallback(async () => {
        if (!finalApiUrl) return;
        try {
            const res = await fetch(`${finalApiUrl}?action=GET_HASH`).then(r => r.json());
            if (!res.hash) return;
            if (lastKnownHash.current && res.hash !== lastKnownHash.current) {
                setNewDataAvailable(true);
            }
            // Inicializar referencia si no había hash previo
            if (!lastKnownHash.current) {
                lastKnownHash.current = res.hash;
                localStorage.setItem('last_server_hash', res.hash);
            }
        } catch (e) { /* Silent */ }
    }, [finalApiUrl]);

    // ── manualRefresh ─────────────────────────────────────────────────────────
    const manualRefresh = useCallback(async () => {
        setLoading(true);
        try {
            await fetchData(true);
        } catch (e) { /* Error manejado por fetchData */ }
    }, [fetchData]);

    // ── invalidateCache ───────────────────────────────────────────────────────
    const invalidateCache = useCallback((year, month) => {
        const periodKey = `${year}-${month}`;
        delete memCache.current[periodKey];
        localStorage.removeItem(getCacheKey(year, month));
    }, [getCacheKey]);

    // ── updateConfig ──────────────────────────────────────────────────────────
    const updateConfig = async (periodo, ipc, mep) => {
        if (!finalApiUrl) return;
        try {
            const res = await fetch(finalApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'CARGAR_DATOS',
                    origen: 'SAVE_CONFIG',
                    payload: { periodo, ipc: parseFloat(ipc), mep: parseFloat(mep) }
                })
            });
            const data = await res.json();
            if (data.status === 'OK') {
                setDashData(prev => ({ ...prev, ajustes: { ipc: parseFloat(ipc), mep: parseFloat(mep) } }));
                return true;
            }
        } catch (e) { console.error("Error guardando config:", e); }
        return false;
    };

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
        checkHash,
        prefetchVisiblePeriods,
        manualRefresh,
        invalidateCache,
    }), [
        apiUrl, dashData, empData, arcaData, ventasData,
        isRefreshing, loading, error,
        selectedYear, selectedMonth, cargasPct, viewMode,
        availablePeriods, localAjustes, categoriesMap,
        newDataAvailable,
        fetchData, checkHash, prefetchVisiblePeriods, manualRefresh, invalidateCache
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
