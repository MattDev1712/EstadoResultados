// Tokens de diseño — resuelven vía CSS variables (soporta dark/light toggle)
// Para cambiar los valores de cada tema, ver index.css (:root y [data-theme="light"])

export const colors = {
  // Fondos
  bgCard:    'var(--bg-card)',
  bgPage:    'var(--bg-page)',
  bgSurface: 'var(--bg-surface)',

  // Bordes
  borderCard:   'var(--border-card)',
  borderSubtle: 'var(--border-subtle)',
  borderMid:    'var(--border-mid)',

  // Textos
  textPrimary:   'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  textMuted:     'var(--text-muted)',
  textDim:       'var(--text-dim)',
  textFaint:     'var(--text-faint)',
  textOnColor:   '#ffffff', // Siempre blanco para botones o estados con fondo saturado

  // Semánticos (no cambian con el tema)
  green:  '#10b981',
  red:    '#f43f5e',
  blue:   '#3b82f6',
  yellow: '#fbbf24',
};

export const cardBase = {
  background:   'var(--bg-card)',
  border:       '1px solid var(--border-card)',
  borderRadius: 16,
  overflow:     'hidden',
};
