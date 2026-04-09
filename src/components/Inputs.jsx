import React from 'react';

export const PctInput = ({ value, onChange }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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

export const CurrencyInput = ({ value, onChange, placeholder = '$0' }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
