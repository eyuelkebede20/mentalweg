import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ColorPreset {
  id: string;
  name: string;
  hex: string;
  description: string;
}

export const COLOR_PRESETS: ColorPreset[] = [
  { id: 'eucalyptus', name: 'Clinical Sage', hex: '#24574a', description: 'Restrained, calming herbal green' },
  { id: 'teal', name: 'Deep Teal', hex: '#135d66', description: 'Balanced ocean teal' },
  { id: 'sapphire', name: 'Midnight Indigo', hex: '#274c77', description: 'Deep, dependable clinical blue' },
  { id: 'terracotta', name: 'Terracotta', hex: '#8a4f3d', description: 'Warm earthen clay' },
  { id: 'plum', name: 'Mulberry Plum', hex: '#693b58', description: 'Quiet, thoughtful amethyst' },
  { id: 'slate', name: 'Nordic Slate', hex: '#3f4e4f', description: 'Neutral graphite slate' },
];

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  resolvedTheme: 'light' | 'dark';
  accentColor: string;
  setAccentColor: (hex: string) => void;
  presets: ColorPreset[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Helper to convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return { r, g, b };
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return { r, g, b };
  }
  return null;
}

// Helper to calculate relative luminance
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Generate harmonized color palette tokens
function applyAccentPalette(hex: string, isDark: boolean) {
  const rgb = hexToRgb(hex);
  if (!rgb) return;
  const { r, g, b } = rgb;
  const root = document.documentElement;

  if (isDark) {
    // In dark mode: ensure accent is sufficiently bright against dark backgrounds
    const lum = getLuminance(r, g, b);
    let displayHex = hex;
    // If the color is too dark, lighten it for dark mode visibility
    if (lum < 0.15) {
      const lr = Math.min(255, Math.round(r * 1.5 + 40));
      const lg = Math.min(255, Math.round(g * 1.5 + 40));
      const lb = Math.min(255, Math.round(b * 1.5 + 40));
      displayHex = `rgb(${lr}, ${lg}, ${lb})`;
    }

    root.style.setProperty('--acc', displayHex);
    root.style.setProperty('--acc-hover', `rgba(${r}, ${g}, ${b}, 0.85)`);
    root.style.setProperty('--accbg', `rgba(${r}, ${g}, ${b}, 0.22)`);
    root.style.setProperty('--acct', '#e8f5f0');
    root.style.setProperty('--acc-glow', `rgba(${r}, ${g}, ${b}, 0.35)`);
  } else {
    // In light mode: ensure accent is sufficiently deep against light surfaces
    root.style.setProperty('--acc', hex);
    root.style.setProperty('--acc-hover', `rgba(${r}, ${g}, ${b}, 0.88)`);
    root.style.setProperty('--accbg', `rgba(${r}, ${g}, ${b}, 0.12)`);
    root.style.setProperty('--acct', `rgb(${Math.max(0, Math.round(r * 0.5))}, ${Math.max(0, Math.round(g * 0.5))}, ${Math.max(0, Math.round(b * 0.5))})`);
    root.style.setProperty('--acc-glow', `rgba(${r}, ${g}, ${b}, 0.2)`);
  }

  // FullCalendar integration variables
  root.style.setProperty('--fc-button-active-bg-color', 'var(--acc)');
  root.style.setProperty('--fc-button-active-border-color', 'var(--acc)');
  root.style.setProperty('--fc-event-border-color', 'var(--acc)');
  root.style.setProperty('--fc-event-bg-color', 'var(--accbg)');
  root.style.setProperty('--fc-event-text-color', 'var(--acct)');
  root.style.setProperty('--fc-today-bg-color', `rgba(${r}, ${g}, ${b}, 0.05)`);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem('mw_admin_theme') as ThemeMode) || 'system';
  });

  const [accentColor, setAccentColorState] = useState<string>(() => {
    return localStorage.getItem('mw_admin_accent') || '#24574a';
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  // Resolve system preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateResolved = () => {
      let active: 'light' | 'dark' = 'light';
      if (theme === 'dark') {
        active = 'dark';
      } else if (theme === 'light') {
        active = 'light';
      } else {
        active = mediaQuery.matches ? 'dark' : 'light';
      }
      setResolvedTheme(active);
      document.documentElement.setAttribute('data-theme', active);
      applyAccentPalette(accentColor, active === 'dark');
    };

    updateResolved();
    mediaQuery.addEventListener('change', updateResolved);
    return () => mediaQuery.removeEventListener('change', updateResolved);
  }, [theme, accentColor]);

  // Initial fetch from backend settings to ensure sync
  useEffect(() => {
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(data => {
        if (data && data.accentColor) {
          setAccentColorState(data.accentColor);
          localStorage.setItem('mw_admin_accent', data.accentColor);
        }
      })
      .catch(() => {});
  }, []);

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    localStorage.setItem('mw_admin_theme', mode);
  };

  const setAccentColor = (hex: string) => {
    setAccentColorState(hex);
    localStorage.setItem('mw_admin_accent', hex);
    applyAccentPalette(hex, resolvedTheme === 'dark');
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        resolvedTheme,
        accentColor,
        setAccentColor,
        presets: COLOR_PRESETS,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
