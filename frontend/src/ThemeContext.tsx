import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

export type ThemeName = 'dark' | 'synthwave' | 'pixel' | 'crt' | 'neon';

export interface Theme {
  name: ThemeName;
  displayName: string;
  colors: {
    // Background colors
    bgPrimary: string;
    bgSecondary: string;
    bgTertiary: string;
    
    // Sidebar colors
    sidebarGradient: string;
    sidebarText: string;
    sidebarHover: string;
    sidebarActive: string;
    
    // Text colors
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
    
    // Accent colors
    accentPrimary: string;
    accentSecondary: string;
    accentGradient: string;
    
    // Button colors
    btnPrimaryBg: string;
    btnPrimaryHover: string;
    btnSecondaryBg: string;
    btnSecondaryHover: string;
    
    // Border colors
    borderLight: string;
    borderMedium: string;
    
    // Card colors
    cardBg: string;
    cardShadow: string;
  };
}

export const themes: Record<ThemeName, Theme> = {
  dark: {
    name: 'dark',
    displayName: 'Retro Dark',
    colors: {
      bgPrimary: '#0a0e27',
      bgSecondary: '#151932',
      bgTertiary: '#1a1f3a',
      sidebarGradient: 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)',
      sidebarText: 'rgba(255, 255, 255, 0.9)',
      sidebarHover: 'rgba(255, 255, 255, 0.15)',
      sidebarActive: 'rgba(255, 255, 255, 0.25)',
      textPrimary: '#e2e8f0',
      textSecondary: '#94a3b8',
      textTertiary: '#64748b',
      accentPrimary: '#667eea',
      accentSecondary: '#764ba2',
      accentGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      btnPrimaryBg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      btnPrimaryHover: 'linear-gradient(135deg, #7e8ff5 0%, #8d5bb3 100%)',
      btnSecondaryBg: '#2d3748',
      btnSecondaryHover: '#4a5568',
      borderLight: '#2d3748',
      borderMedium: '#4a5568',
      cardBg: '#1a1f3a',
      cardShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
    },
  },
  synthwave: {
    name: 'synthwave',
    displayName: 'Synthwave',
    colors: {
      bgPrimary: '#1a0a2e',
      bgSecondary: '#16213e',
      bgTertiary: '#0f0e17',
      sidebarGradient: 'linear-gradient(180deg, #ff006e 0%, #8338ec 50%, #3a86ff 100%)',
      sidebarText: 'rgba(255, 255, 255, 0.95)',
      sidebarHover: 'rgba(255, 255, 255, 0.15)',
      sidebarActive: 'rgba(255, 255, 255, 0.25)',
      textPrimary: '#fffffe',
      textSecondary: '#ff006e',
      textTertiary: '#94a1b2',
      accentPrimary: '#ff006e',
      accentSecondary: '#8338ec',
      accentGradient: 'linear-gradient(135deg, #ff006e 0%, #8338ec 50%, #3a86ff 100%)',
      btnPrimaryBg: 'linear-gradient(135deg, #ff006e 0%, #8338ec 100%)',
      btnPrimaryHover: 'linear-gradient(135deg, #ff3385 0%, #9b4dff 100%)',
      btnSecondaryBg: '#2e294e',
      btnSecondaryHover: '#3d3659',
      borderLight: '#2e294e',
      borderMedium: '#3d3659',
      cardBg: '#16213e',
      cardShadow: '0 4px 20px rgba(255, 0, 110, 0.3)',
    },
  },
  pixel: {
    name: 'pixel',
    displayName: '8-Bit Pixel',
    colors: {
      bgPrimary: '#0f380f',
      bgSecondary: '#306230',
      bgTertiary: '#0f380f',
      sidebarGradient: 'linear-gradient(180deg, #9bbc0f 0%, #8bac0f 100%)',
      sidebarText: '#0f380f',
      sidebarHover: 'rgba(15, 56, 15, 0.15)',
      sidebarActive: 'rgba(15, 56, 15, 0.25)',
      textPrimary: '#9bbc0f',
      textSecondary: '#8bac0f',
      textTertiary: '#679267',
      accentPrimary: '#9bbc0f',
      accentSecondary: '#8bac0f',
      accentGradient: 'linear-gradient(135deg, #9bbc0f 0%, #8bac0f 100%)',
      btnPrimaryBg: '#9bbc0f',
      btnPrimaryHover: '#acd234',
      btnSecondaryBg: '#306230',
      btnSecondaryHover: '#3a7c3a',
      borderLight: '#306230',
      borderMedium: '#679267',
      cardBg: '#1a4d1a',
      cardShadow: '0 4px 6px rgba(0, 0, 0, 0.5)',
    },
  },
  crt: {
    name: 'crt',
    displayName: 'CRT Glow',
    colors: {
      bgPrimary: '#000000',
      bgSecondary: '#0a0a0a',
      bgTertiary: '#1a1a1a',
      sidebarGradient: 'linear-gradient(180deg, #00ff41 0%, #00d4aa 100%)',
      sidebarText: '#000000',
      sidebarHover: 'rgba(0, 0, 0, 0.15)',
      sidebarActive: 'rgba(0, 0, 0, 0.25)',
      textPrimary: '#00ff41',
      textSecondary: '#00d4aa',
      textTertiary: '#00aa55',
      accentPrimary: '#00ff41',
      accentSecondary: '#00d4aa',
      accentGradient: 'linear-gradient(135deg, #00ff41 0%, #00d4aa 100%)',
      btnPrimaryBg: 'linear-gradient(135deg, #00ff41 0%, #00d4aa 100%)',
      btnPrimaryHover: 'linear-gradient(135deg, #33ff66 0%, #33e4bb 100%)',
      btnSecondaryBg: '#1a1a1a',
      btnSecondaryHover: '#2a2a2a',
      borderLight: '#1a1a1a',
      borderMedium: '#2a2a2a',
      cardBg: '#0a0a0a',
      cardShadow: '0 0 20px rgba(0, 255, 65, 0.3)',
    },
  },
  neon: {
    name: 'neon',
    displayName: 'Neon Arcade',
    colors: {
      bgPrimary: '#120458',
      bgSecondary: '#1c0b5e',
      bgTertiary: '#2a1575',
      sidebarGradient: 'linear-gradient(180deg, #ea00d9 0%, #0abdc6 100%)',
      sidebarText: 'rgba(255, 255, 255, 0.95)',
      sidebarHover: 'rgba(255, 255, 255, 0.15)',
      sidebarActive: 'rgba(255, 255, 255, 0.25)',
      textPrimary: '#f0f0f0',
      textSecondary: '#ea00d9',
      textTertiary: '#a29bfe',
      accentPrimary: '#ea00d9',
      accentSecondary: '#0abdc6',
      accentGradient: 'linear-gradient(135deg, #ea00d9 0%, #0abdc6 100%)',
      btnPrimaryBg: 'linear-gradient(135deg, #ea00d9 0%, #0abdc6 100%)',
      btnPrimaryHover: 'linear-gradient(135deg, #ff33e6 0%, #33cdd6 100%)',
      btnSecondaryBg: '#2a1575',
      btnSecondaryHover: '#3d1f9e',
      borderLight: '#2a1575',
      borderMedium: '#3d1f9e',
      cardBg: '#1c0b5e',
      cardShadow: '0 0 30px rgba(234, 0, 217, 0.3)',
    },
  },
};

interface ThemeContextType {
  theme: Theme;
  themeName: ThemeName;
  setTheme: (themeName: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>(() => {
    const saved = localStorage.getItem('mastablasta-theme');
    return (saved as ThemeName) || 'dark';
  });

  const theme = themes[themeName];

  useEffect(() => {
    localStorage.setItem('mastablasta-theme', themeName);
    
    // Apply theme CSS variables to root
    const root = document.documentElement;
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });
  }, [themeName, theme]);

  const setTheme = (newTheme: ThemeName) => {
    setThemeName(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, themeName, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
