import React from 'react';

export const PctInput = ({ value, onChange }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <input
      type="number"
      value={value}
      min={0} max={100} step={0.1}
      onChange={e => onChange(e.target.value)}
      style={{
        width: 64, background: 'var(--bg-page)', border: '1px solid var(--border-mid)',
        borderRadius: 7, color: 'var(--text-primary)', fontSize: 14, fontWeight: 700,
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
        width: 130, background: 'var(--bg-page)', border: '1px solid var(--border-mid)',
        borderRadius: 7, color: 'var(--text-primary)', fontSize: 13, fontWeight: 600,
        padding: '4px 10px', textAlign: 'right', outline: 'none',
        MozAppearance: 'textfield',
      }}
    />
  </div>
);
