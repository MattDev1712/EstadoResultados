import React, { useState, useEffect, useCallback } from 'react';
import { useFinance } from './FinanceContext';
import { formatters as Utils } from './formatters';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const S = {
  card: {
    background: '#0b1121',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '14px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  sectionDivider: {
    padding: '5px 20px',
    background: 'rgba(255,255,255,0.03)',
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '1.2px',
    color: '#475569',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.03)',
  },
  rowLabel: { fontSize: 13, color: '#94a3b8' },
  rowLabelBold: { fontSize: 13, color: '#e2e8f0', fontWeight: 600 },
  rowValue: { fontSize: 14, fontWeight: 600, color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' },
};

const ManualBadge = () => (
  <span style={{
    fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
    color: '#f59e0b', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)',
    borderRadius: 4, padding: '1px 5px', marginRight: 6,
  }}>manual</span>
);

const PctInput = ({ value, onChange }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <ManualBadge />
    <input
      type="number"
      value={value}
      min={0} max={100} step={0.1}
      onChange={e => onChange(e.target.value)}
      style={{
        width: 64, background: '#070c18', border: '1px solid #334155',
        borderRadius: 7, color: '#fbbf24', fontSize: 14, fontWeight: 700,
        padding: '4px 8px', textAlign: 'right', outline: 'none',
        MozAppearance: 'textfield',
      }}
    />
    <span style={{ fontSize: 12, color: '#64748b' }}>%</span>
  </div>
);

const CurrencyInput = ({ value, onChange, placeholder = '$0' }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <ManualBadge />
    <input
      type="number"
      value={value}
      min={0} step={1000}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: 130, background: '#070c18', border: '1px solid #334155',
        borderRadius: 7, color: '#e2e8f0', fontSize: 13, fontWeight: 600,
        padding: '4px 10px', textAlign: 'right', outline: 'none',
        MozAppearance: 'textfield',
      }}
    />
  </div>
);

const CardHeader = ({ icon, label, iconBg, iconColor }) => (
  <div style={S.cardHeader}>
    <div style={{
      width: 28, height: 28, borderRadius: 8, background: iconBg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, color: iconColor, fontWeight: 700,
    }}>{icon}</div>
    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b' }}>
      {label}
    </span>
  </div>
);

const Row = ({ label, bold, value, valueColor, right }) => (
  <div style={{ ...S.row, ...(bold ? { background: 'rgba(255,255,255,0.02)' } : {}) }}>
    <span style={bold ? S.rowLabelBold : S.rowLabel}>{label}</span>
    {right || <span style={{ ...S.rowValue, color: valueColor || '#e2e8f0' }}>{value}</span>}
  </div>
);

export default function MarginExpectationView() {
  const {
    dashData, empData, loading, error,
    selectedYear, selectedMonth,
    apiUrl,
  } = useFinance();

  const [manual, setManual] = useState({ mix_cafe: '', mix_producto: '', mgn_cafe: '', mgn_producto: '', excepcionales: '' });
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'ok' | 'error'

  // Cargar campos manuales cuando llegan del backend
  useEffect(() => {
    if (dashData?.estado_result_manual) {
      const m = dashData.estado_result_manual;
      setManual({
        mix_cafe: m.mix_cafe ?? '',
        mix_producto: m.mix_producto ?? '',
        mgn_cafe: m.mgn_cafe ?? '',
        mgn_producto: m.mgn_producto ?? '',
        excepcionales: m.excepcionales ?? '',
      });
    } else {
      setManual({ mix_cafe: '', mix_producto: '', mgn_cafe: '', mgn_producto: '', excepcionales: '' });
    }
  }, [dashData?.estado_result_manual, selectedYear, selectedMonth]);

  const setField = useCallback((field) => (val) => {
    setManual(prev => ({ ...prev, [field]: val }));
    setSaveStatus(null);
  }, []);

  const setMixCafe = useCallback((val) => {
    const num = parseFloat(val);
    const producto = isNaN(num) ? '' : (100 - Math.min(100, Math.max(0, num))).toFixed(1);
    setManual(prev => ({ ...prev, mix_cafe: val, mix_producto: producto }));
    setSaveStatus(null);
  }, []);

  const handleSave = async () => {
    if (!apiUrl) return;
    setSaving(true);
    setSaveStatus(null);
    try {
      const finalUrl = apiUrl.startsWith('AKfy')
        ? `https://script.google.com/macros/s/${apiUrl}/exec`
        : apiUrl.startsWith('http') ? apiUrl : `https://${apiUrl}`;
      const res = await fetch(finalUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'CARGAR_DATOS',
          origen: 'SAVE_ESTADO_RESULT',
          payload: {
            periodo: `${selectedYear}-${selectedMonth}`,
            mix_cafe: parseFloat(manual.mix_cafe) || 0,
            mix_producto: parseFloat(manual.mix_producto) || 0,
            mgn_cafe: parseFloat(manual.mgn_cafe) || 0,
            mgn_producto: parseFloat(manual.mgn_producto) || 0,
            excepcionales: parseFloat(manual.excepcionales) || 0,
          }
        })
      });
      const data = await res.json();
      setSaveStatus(data.status === 'OK' ? 'ok' : 'error');
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="animate-fade-in mt-6" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {[1,2,3,4].map(i => (
        <div key={i} style={{ ...S.card, height: 280, opacity: 0.4 }} className="animate-pulse" />
      ))}
    </div>
  );

  if (error || !dashData) return (
    <div className="animate-fade-in mt-8 text-center" style={{ color: '#64748b', paddingTop: 60 }}>
      <p style={{ fontSize: 15 }}>Sin datos para el período seleccionado.</p>
    </div>
  );

  const { kpis, egresos } = dashData;
  const n = Utils.num;

  const ventaBruta = n(kpis.venta_bruta);
  const ivaDébito = n(kpis.iva_debito);
  const ventaNeta = n(kpis.ventas_netas_reales);
  const cantOps = n(kpis.cant_operaciones);
  const ticketProm = n(kpis.ticket_promedio);

  const mixCafePct = parseFloat(manual.mix_cafe) || 0;
  const mixProductoPct = parseFloat(manual.mix_producto) || 0;
  const mgnCafePct = parseFloat(manual.mgn_cafe) || 0;
  const mgnProductoPct = parseFloat(manual.mgn_producto) || 0;

  const ventaCafe = (mixCafePct / 100) * ventaNeta;
  const ventaProducto = (mixProductoPct / 100) * ventaNeta;
  const margenCafePesos = (mgnCafePct / 100) * ventaCafe;
  const margenProductoPesos = (mgnProductoPct / 100) * ventaProducto;

  const laboralEfectivo = n(egresos.laboral) > 0
    ? n(egresos.laboral)
    : (empData || []).reduce((acc, emp) => acc + n(emp.recibo) + n(emp.negro), 0);
  const sueldosTotal = laboralEfectivo + n(egresos.provision_sac) + n(egresos.provision_cargas);
  const cantEmpleados = (empData || []).length;
  const promedioEmp = cantEmpleados > 0 ? laboralEfectivo / cantEmpleados : 0;
  const operaciones = n(egresos.estructural);
  const excepcionales = parseFloat(manual.excepcionales) || 0;

  const totalGastos = sueldosTotal + operaciones + excepcionales;
  const resultado = ventaNeta - totalGastos;
  const margenPct = ventaNeta > 0 ? ((resultado / ventaNeta) * 100).toFixed(1) : '0.0';
  const resultadoPositivo = resultado >= 0;

  const mesNombre = MESES[parseInt(selectedMonth) - 1];
  const periodoLabel = `${mesNombre} ${selectedYear}`;

  return (
    <div className="animate-fade-in mt-6" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.3px', margin: 0 }}>
            Estado de Resultado
          </h2>
          <p style={{ fontSize: 12, color: '#475569', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            {periodoLabel}
          </p>
        </div>
        {saveStatus === 'ok' && (
          <span style={{
            fontSize: 12, fontWeight: 600, color: '#4ade80',
            background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)',
            borderRadius: 8, padding: '6px 14px',
          }}>
            ✓ Guardado
          </span>
        )}
        {saveStatus === 'error' && (
          <span style={{
            fontSize: 12, fontWeight: 600, color: '#f87171',
            background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)',
            borderRadius: 8, padding: '6px 14px',
          }}>
            ✗ Error al guardar
          </span>
        )}
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'Venta Sistema', value: Utils.fmt(ventaBruta), sub: 'Bruta c/IVA' },
          { label: 'Cant. Operaciones', value: cantOps.toLocaleString('es-AR'), sub: 'Tickets del período' },
          { label: 'Ticket Promedio', value: Utils.fmt(ticketProm), sub: 'Por operación' },
        ].map(({ label, value, sub }) => (
          <div key={label} style={S.card}>
            <div style={{ padding: '16px 18px' }}>
              <p style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 }}>{label}</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: '#f8fafc', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
              <p style={{ fontSize: 11, color: '#334155', marginTop: 2 }}>{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Grid: Ventas + Gastos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* ── VENTAS ── */}
        <div style={S.card}>
          <CardHeader icon="↑" label="Ventas" iconBg="rgba(16,185,129,0.1)" iconColor="#10b981" />

          <Row label="IVA cobrado" value={Utils.fmt(ivaDébito)} />
          <Row label="Venta Neta S/IVA" bold value={Utils.fmt(ventaNeta)} valueColor="#10b981" />

          <div style={S.sectionDivider}>Mix de producto</div>

          <Row
            label="Mix Cafetería"
            right={
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                <PctInput value={manual.mix_cafe} onChange={setMixCafe} />
                {ventaCafe > 0 && <span style={{ fontSize: 11, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{Utils.fmt(ventaCafe)}</span>}
              </div>
            }
          />
          <Row
            label="Mix Producto"
            right={
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#60a5fa', background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 4, padding: '1px 5px' }}>auto</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#fbbf24', fontVariantNumeric: 'tabular-nums' }}>{mixProductoPct.toFixed(1)}</span>
                  <span style={{ fontSize: 12, color: '#64748b' }}>%</span>
                </div>
                {ventaProducto > 0 && <span style={{ fontSize: 11, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{Utils.fmt(ventaProducto)}</span>}
              </div>
            }
          />

          <div style={S.sectionDivider}>Margen de contribución</div>

          <Row
            label="MGN Cafetería"
            right={
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                <PctInput value={manual.mgn_cafe} onChange={setField('mgn_cafe')} />
                {margenCafePesos > 0 && <span style={{ fontSize: 11, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{Utils.fmt(margenCafePesos)}</span>}
              </div>
            }
          />
          <Row
            label="MGN Producto"
            right={
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                <PctInput value={manual.mgn_producto} onChange={setField('mgn_producto')} />
                {margenProductoPesos > 0 && <span style={{ fontSize: 11, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{Utils.fmt(margenProductoPesos)}</span>}
              </div>
            }
          />
        </div>

        {/* ── GASTOS ── */}
        <div style={S.card}>
          <CardHeader icon="↓" label="Gastos" iconBg="rgba(244,63,94,0.1)" iconColor="#f43f5e" />

          <div style={S.sectionDivider}>Laboral</div>

          <Row label="Sueldos (incl. prov. SAC y cargas)" bold value={Utils.fmt(sueldosTotal)} />
          <Row label="Cant. empleados" value={cantEmpleados.toString()} />
          <Row label="Promedio por empleado" value={Utils.fmt(promedioEmp)} />

          <div style={S.sectionDivider}>Operaciones</div>

          <Row label="Gastos fijos operativos" bold value={Utils.fmt(operaciones)} />

          <div style={S.sectionDivider}>Otros</div>

          {/* Bancos — placeholder futuro */}
          <div style={{ ...S.row, opacity: 0.4 }}>
            <span style={S.rowLabel}>
              Bancos{' '}
              <span style={{
                fontSize: 9, fontWeight: 700, color: '#60a5fa',
                background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)',
                borderRadius: 4, padding: '1px 5px', marginLeft: 6,
              }}>próximo</span>
            </span>
            <span style={{ ...S.rowValue, color: '#334155' }}>— — —</span>
          </div>

          <Row
            label="Excepcionales"
            right={<CurrencyInput value={manual.excepcionales} onChange={setField('excepcionales')} />}
          />

          <div style={S.sectionDivider}>Total</div>

          <Row label="Total Gastos" bold value={Utils.fmt(totalGastos)} valueColor="#f43f5e" />
        </div>
      </div>

      {/* Resultado */}
      <div style={{
        borderRadius: 16,
        background: resultadoPositivo
          ? 'linear-gradient(135deg, rgba(5,46,22,0.8) 0%, rgba(7,12,24,0.95) 100%)'
          : 'linear-gradient(135deg, rgba(45,10,10,0.8) 0%, rgba(7,12,24,0.95) 100%)',
        border: `1px solid ${resultadoPositivo ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
        padding: '24px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <p style={{
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px',
            color: resultadoPositivo ? '#6ee7b7' : '#fca5a5', margin: 0,
          }}>Resultado del período</p>
          <p style={{
            fontSize: 32, fontWeight: 800, margin: '4px 0 0',
            color: resultadoPositivo ? '#4ade80' : '#f87171',
            fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px',
          }}>{Utils.fmt(resultado)}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 24, fontWeight: 700, color: resultadoPositivo ? '#4ade80' : '#f87171', margin: 0 }}>
            {margenPct}%
          </p>
          <p style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>sobre venta neta</p>
        </div>
      </div>

      {/* Save bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: 8 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: saving ? '#1e3a8a' : '#2563eb',
            color: '#fff', border: 'none', borderRadius: 10,
            padding: '11px 26px', fontSize: 14, fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
            opacity: saving ? 0.7 : 1,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          {saving ? 'Guardando...' : 'Guardar período'}
        </button>
      </div>

    </div>
  );
}
