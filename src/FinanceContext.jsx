import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';

const FinanceContext = createContext();

// Incrementa esto cada vez que hagas un deploy importante
const APP_VERSION = '1.2.5'; 

const validatePersistence = () => {
    const savedVersion = localStorage.getItem('app_version');
    if (savedVersion !== APP_VERSION) {
        // Guardamos solo lo vital (la URL de la API) para no molestar al usuario
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

export const FinanceProvider = ({ children }) => {
    // Ejecutar validación de versión antes de inicializar estados
    validatePersistence();

    const [apiUrl, setApiUrl] = useState(getInitialApiUrl);
    
    const finalApiUrl = useMemo(() => {
        if (!apiUrl) return '';
        if (apiUrl.startsWith('AKfy')) {
            return `https://script.google.com/macros/s/${apiUrl}/exec`;
        }
        if (!apiUrl.startsWith('http')) {
            return `https://${apiUrl}`;
        }
        return apiUrl;
    }, [apiUrl]);

    const [dashData, setDashData] = useState(null);
    const [empData, setEmpData] = useState([]);
    const [arcaData, setArcaData] = useState([]);
    const [ventasData, setVentasData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [categoriesMap, setCategoriesMap] = useState({});
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [selectedYear, setSelectedYear] = useState(() => 
        localStorage.getItem('selectedYear') || String(new Date().getFullYear())
    );
    const [selectedMonth, setSelectedMonth] = useState(() => 
        localStorage.getItem('selectedMonth') || String(new Date().getMonth() + 1).padStart(2, '0')
    );
    const isFirstLoad = useRef(true);
    const [cargasPct, setCargasPct] = useState(() => localStorage.getItem('cfg_cargas_pct') || "33");
    const [viewMode, setViewMode] = useState('NOMINAL'); // 'NOMINAL', 'REAL_IPC', 'DOLAR_MEP'
    const [availablePeriods, setAvailablePeriods] = useState([]);

    // Estado local para los ajustes del periodo actual (IPC y MEP)
    const [localAjustes, setLocalAjustes] = useState({ ipc: 1, mep: 1000 });

    // Guardar cambios en localStorage
    useEffect(() => {
        localStorage.setItem('selectedYear', selectedYear);
        localStorage.setItem('selectedMonth', selectedMonth);
    }, [selectedYear, selectedMonth]);

    // Sincronizar ajustes locales cuando cambian los datos del dashboard
    useEffect(() => {
        if (dashData?.ajustes) {
            setLocalAjustes(dashData.ajustes);
        }
    }, [dashData]);

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
                // Actualizar metadatos locales para reflejar el cambio inmediato
                setDashData(prev => ({
                    ...prev,
                    ajustes: { ipc: parseFloat(ipc), mep: parseFloat(mep) }
                }));
                return true;
            }
        } catch (e) {
            console.error("Error guardando config:", e);
        }
        return false;
    };

    // Cargar metadatos (periodos disponibles)
    const fetchMetadata = useCallback(async () => {
        if (!finalApiUrl) return;
        try {
            const res = await fetch(`${finalApiUrl}?action=GET_METADATA`);
            const meta = await res.json();
            if (meta.periods) {
                setAvailablePeriods(meta.periods);
            }
        } catch (e) {
            console.warn("Error cargando metadatos:", e);
        }
    }, [apiUrl]);

    // Persistir configuración de cargas sociales
    useEffect(() => {
        localStorage.setItem('cfg_cargas_pct', cargasPct);
    }, [cargasPct]);

    const fetchData = useCallback(async (force = false, silent = false) => {
        if (!apiUrl) return;

        const urlHash = btoa(apiUrl).substring(0, 8);
        const cacheKey = `cache_${urlHash}_${selectedYear}_${selectedMonth}`;
        const cached = localStorage.getItem(cacheKey);
        let localHash = null;
        let cachedData = null;

        if (cached) {
            try {
                cachedData = JSON.parse(cached);
                localHash = cachedData.hash || null;

                // UX: Si tenemos cache y no estamos forzando, lo mostramos ya mismo
                // Esto elimina la latencia visual al cambiar de mes
                if (!force) {
                    setDashData(cachedData.dash);
                    setEmpData(cachedData.emp || []);
                    setArcaData(cachedData.arca || []);
                    setVentasData(cachedData.ventas || []);
                }
            } catch (e) {
                localStorage.removeItem(cacheKey);
            }
        }

        // Solo mostramos el loader principal si NO hay cache o si estamos forzando (↻)
        const isBackgroundCheck = !!cachedData && !force;
        setLoading(!silent && !isBackgroundCheck);
        setIsRefreshing(silent || isBackgroundCheck);

        setError(null);
        try {
            const start = `${selectedYear}-${selectedMonth}-01`;
            const lastDay = new Date(selectedYear, parseInt(selectedMonth), 0).getDate();
            const end = `${selectedYear}-${selectedMonth}-${lastDay}`;
            
            // Intentamos una carga optimizada pasando el hash que tenemos guardado
            const fetchUrl = `${finalApiUrl}?action=GET_COMPLETE_DATA&start=${start}&end=${end}&cargasPct=${cargasPct}${(!force && localHash) ? `&localHash=${localHash}` : ''}`;

            const [dataRes, catRes] = await Promise.all([
                fetch(fetchUrl).then(r => r.json()),
                fetch(`${finalApiUrl}?action=GET_CATEGORIES_MAP`).then(r => r.json())
            ]);
            
            if (dataRes.status === 'ERROR') throw new Error(dataRes.message || "Error desconocido en el servidor");
            if (dataRes.error) throw new Error(dataRes.error);

            const catMap = {};
            (catRes || []).forEach(item => { catMap[item.cuit] = item.categoria; });
            setCategoriesMap(catMap);

            // Si el servidor dice que los datos no han cambiado, terminamos 
            // (El estado ya fue poblado con el cache al inicio de la función)
            if (dataRes.status === 'NOT_MODIFIED') return;
            
            if (!dataRes.dashboard) throw new Error("No se recibieron datos del tablero (dashboard).");

            const result = dataRes;

            setDashData(result.dashboard);
            setEmpData(result.employees || []);
            setArcaData(result.arca || []);
            setVentasData(result.ventas || []);

            localStorage.setItem(cacheKey, JSON.stringify({
                dash: result.dashboard,
                emp: result.employees,
                arca: result.arca,
                ventas: result.ventas,
                hash: result.stateHash // Guardamos el nuevo hash enviado por el servidor
            }));
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false); // Siempre resetear loading
            setIsRefreshing(false); // Siempre resetear isRefreshing
        }
    }, [finalApiUrl, selectedYear, selectedMonth, cargasPct]);

    // Auto-fetch al montar y cuando cambian dependencias
    useEffect(() => {
        fetchData(false, false); // No forzar, no silencioso (usa loading)
    }, [fetchData]);

    const invalidateCache = useCallback((year, month) => {
        const urlHash = btoa(apiUrl).substring(0, 8);
        localStorage.removeItem(`cache_${urlHash}_${year}_${month}`);
    }, [apiUrl]);

    // Función para polling automático (silencioso)
    const pollForUpdates = useCallback(async () => {
        try {
            setError(null);
            await fetchData(false, true); // No forzar, pero silencioso (usa isRefreshing)
            await fetchMetadata(); 
        } catch (e) {
            setError("Error al sincronizar con Google Sheets. Intente nuevamente.");
            console.error(e);
        }
    }, [fetchData, fetchMetadata]);

    // Función para refresco manual (forzado y con spinner principal)
    const manualRefresh = useCallback(async () => {
        setLoading(true); // Activa el spinner principal
        try {
            await fetchData(true, false); // Forzar, no silencioso (usa loading)
            await fetchMetadata();
        } catch (e) { /* El error ya es manejado por fetchData */ }
    }, [fetchData, fetchMetadata]);

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
        updateConfig,
        fetchData,
        fetchMetadata,
        pollForUpdates, // Exponer la función de polling
        manualRefresh,  // Exponer la función de refresco manual
        invalidateCache,
    }), [apiUrl, dashData, empData, arcaData, ventasData, isRefreshing, loading, error, selectedYear, selectedMonth, cargasPct, viewMode, availablePeriods, localAjustes, fetchData, fetchMetadata, pollForUpdates, manualRefresh, invalidateCache]);

    return (
        <FinanceContext.Provider value={value}>
            {children}
        </FinanceContext.Provider>
    );
};

export const useFinance = () => {
    const context = useContext(FinanceContext);
    if (!context) {
        throw new Error('useFinance debe usarse dentro de un FinanceProvider');
    }
    return context;
};