import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeType, ThemeMode } from '../types';
import { Themes, ThemeColors, SETTINGS_STORAGE_KEY } from '../constants';

interface ThemeContextType {
  /** The resolved theme actually applied (light/dark/blue/green/purple/red) */
  theme: ThemeType;
  /** The accent color theme chosen by the user (independent of dark/light) */
  accentTheme: ThemeType;
  /** Whether dark mode is on, off, or following system */
  themeMode: ThemeMode;
  /** Whether dark mode is currently active (resolved) */
  isDarkMode: boolean;
  colors: ThemeColors;
  /** Set the accent color theme (light/blue/green/purple/red - dark handled separately) */
  setAccentTheme: (t: ThemeType) => void;
  /** Set dark mode: 'system' = follow device, or force on/off */
  setThemeMode: (m: ThemeMode) => void;
  /** Manually toggle dark mode on/off (sets mode to 'manual') */
  setDarkModeManual: (enabled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  accentTheme: 'light',
  themeMode: 'system',
  isDarkMode: false,
  colors: Themes.light,
  setAccentTheme: () => {},
  setThemeMode: () => {},
  setDarkModeManual: () => {},
});

interface StoredThemeSettings {
  accentTheme?: ThemeType;
  themeMode?: ThemeMode;
  manualDarkMode?: boolean;
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null

  const [accentTheme, setAccentThemeState] = useState<ThemeType>('light');
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [manualDarkMode, setManualDarkMode] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load saved theme preferences on startup
  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_STORAGE_KEY).then(raw => {
      if (raw) {
        try {
          const s: StoredThemeSettings = JSON.parse(raw);
          if (s.accentTheme && s.accentTheme !== 'dark') setAccentThemeState(s.accentTheme);
          if (s.themeMode) setThemeModeState(s.themeMode);
          if (typeof s.manualDarkMode === 'boolean') setManualDarkMode(s.manualDarkMode);
        } catch {}
      }
      setLoaded(true);
    });
  }, []);

  const persist = async (updates: StoredThemeSettings) => {
    const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    const existing = raw ? JSON.parse(raw) : {};
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...existing, ...updates }));
  };

  const setAccentTheme = (t: ThemeType) => {
    // 'dark' is not a selectable accent - it is derived from dark mode state
    const accent = t === 'dark' ? 'light' : t;
    setAccentThemeState(accent);
    persist({ accentTheme: accent });
  };

  const setThemeMode = (m: ThemeMode) => {
    setThemeModeState(m);
    persist({ themeMode: m });
  };

  const setDarkModeManual = (enabled: boolean) => {
    setManualDarkMode(enabled);
    setThemeModeState('manual');
    persist({ themeMode: 'manual', manualDarkMode: enabled });
  };

  // Resolve whether dark mode is active right now
  const isDarkMode = themeMode === 'system'
    ? systemScheme === 'dark'
    : manualDarkMode;

  // Resolve the final theme key used to look up colors.
  // Dark mode always uses the 'dark' palette (teal-on-dark, matching the logo),
  // regardless of which accent theme is selected, to keep a consistent dark UI.
  const theme: ThemeType = isDarkMode ? 'dark' : accentTheme;

  const colors = Themes[theme] || Themes.light;

  return (
    <ThemeContext.Provider value={{
      theme, accentTheme, themeMode, isDarkMode, colors,
      setAccentTheme, setThemeMode, setDarkModeManual,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
