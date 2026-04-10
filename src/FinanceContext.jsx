import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const FinanceContext = createContext();

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
    const [error, setError] = useState(null);
    const [selectedYear, setSelectedYear] = useState(() => 
        localStorage.getItem('selectedYear') || String(new Date().getFullYear())
    );
    const [selectedMonth, setSelectedMonth] = useState(() => 
        localStorage.getItem('selectedMonth') || String(new Date().getMonth() + 1).padStart(2, '0')
    );
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

    const fetchData = useCallback(async (force = false) => {
        if (!apiUrl) return;

        const urlHash = btoa(apiUrl).substring(0, 8);
        const cacheKey = `cache_${urlHash}_${selectedYear}_${selectedMonth}`;

        if (!force) {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    setDashData(parsed.dash);
                    setEmpData(parsed.emp || []);
                    setArcaData(parsed.arca);
                    setVentasData(parsed.ventas);
                    setLoading(false);
                    return;
                } catch (e) {
                    localStorage.removeItem(cacheKey);
                }
            }
        }

        setLoading(true);
        setError(null);
        try {
            const start = `${selectedYear}-${selectedMonth}-01`;
            const lastDay = new Date(selectedYear, parseInt(selectedMonth), 0).getDate();
            const end = `${selectedYear}-${selectedMonth}-${lastDay}`;
            
            const response = await fetch(`${finalApiUrl}?action=GET_COMPLETE_DATA&start=${start}&end=${end}&cargasPct=${cargasPct}`);
            const result = await response.json();
            
            if (result.status === 'ERROR') throw new Error(result.message || "Error desconocido en el servidor");
            if (result.error) throw new Error(result.error);
            if (!result.dashboard) throw new Error("No se recibieron datos del tablero (dashboard).");

            setDashData(result.dashboard);
            setEmpData(result.employees || []);
            setArcaData(result.arca || []);
            setVentasData(result.ventas || []);

            localStorage.setItem(cacheKey, JSON.stringify({
                dash: result.dashboard,
                emp: result.employees,
                arca: result.arca,
                ventas: result.ventas
            }));
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [finalApiUrl, selectedYear, selectedMonth, cargasPct]);

    // Auto-fetch al montar y cada vez que cambia período o URL
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const invalidateCache = useCallback((year, month) => {
        const urlHash = btoa(apiUrl).substring(0, 8);
        localStorage.removeItem(`cache_${urlHash}_${year}_${month}`);
    }, [apiUrl]);

    // Función robusta para refrescar todo secuencialmente
    const refreshAll = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            await fetchData(true); // Forzar descarga de datos omitiendo caché
            await fetchMetadata(); // Actualizar lista de periodos
        } catch (e) {
            setError("Error al sincronizar con Google Sheets. Intente nuevamente.");
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [fetchData, fetchMetadata]);

    const value = useMemo(() => ({
        apiUrl, setApiUrl, finalApiUrl,
        dashData, setDashData, empData, arcaData, ventasData,
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
        refreshAll,
        invalidateCache,
    }), [apiUrl, dashData, empData, arcaData, ventasData, loading, error, selectedYear, selectedMonth, cargasPct, viewMode, availablePeriods, localAjustes, fetchData, fetchMetadata, refreshAll, invalidateCache]);

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