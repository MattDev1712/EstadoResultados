/**
 * Utilidades de formateo financiero y validación de datos.
 */
export const formatters = {
    // Formateo de moneda ARS
    fmt: (val, dec = 0) => {
        const num = parseFloat(val);
        if (isNaN(num)) return dec === 0 ? '$ 0' : '$ 0,00';
        return new Intl.NumberFormat('es-AR', { 
            style: 'currency', 
            currency: 'ARS', 
            maximumFractionDigits: dec 
        }).format(num);
    },
    // Porcentaje seguro
    pct: (val, total) => total > 0 ? ((val / total) * 100).toFixed(1) : "0",
    // Acceso seguro a números (evita NaNs en cálculos)
    num: (val) => {
        if (val === undefined || val === null || val === '') return 0;
        const n = parseFloat(val);
        if (!Number.isFinite(n)) {
            console.warn("Fallo de integridad: Valor no numérico detectado ->", val);
            return 0;
        }
        return isNaN(n) ? 0 : n;
    },
    // Acceso seguro a arrays
    arr: (arr) => Array.isArray(arr) ? arr : []
};