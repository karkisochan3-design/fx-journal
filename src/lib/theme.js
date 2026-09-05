export const PALETTE = {
  dark: {
    text: '#e8eef8',
    dim: '#9aa8bd',
    faint: '#63718a',
    grid: 'rgba(255,255,255,0.06)',
    border: '#212c40',
    surface: '#101623',
    surface2: '#151d2c',
    accent: '#5b8cff',
    accentSoft: 'rgba(91,140,255,0.18)',
    win: '#2fd07a',
    winSoft: 'rgba(47,208,122,0.16)',
    loss: '#ff5f6b',
    lossSoft: 'rgba(255,95,107,0.16)',
    warn: '#f5b544',
    violet: '#8b5cf6',
    cyan: '#22d3ee',
  },
  light: {
    text: '#0f172a',
    dim: '#55627a',
    faint: '#8b96ab',
    grid: 'rgba(16,24,40,0.07)',
    border: '#e3e8f0',
    surface: '#ffffff',
    surface2: '#f7f9fc',
    accent: '#2f6bff',
    accentSoft: 'rgba(47,107,255,0.14)',
    win: '#0f9d58',
    winSoft: 'rgba(15,157,88,0.14)',
    loss: '#e0384a',
    lossSoft: 'rgba(224,56,74,0.13)',
    warn: '#c9820c',
    violet: '#7c3aed',
    cyan: '#0891b2',
  },
};

export const palette = (theme) => PALETTE[theme] || PALETTE.dark;

export const SERIES = ['#5b8cff', '#2fd07a', '#f5b544', '#8b5cf6', '#22d3ee', '#ff5f6b', '#a78bfa', '#34d399'];
