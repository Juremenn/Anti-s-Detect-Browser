import { useEffect, useState } from 'react';
import { ResolvedTheme, ThemeMode } from '../types';

const STORAGE_KEY = 'anti_detect_theme_mode_v2';

export function useTheme() {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
    return 'light';
  });

  const [systemDark, setSystemDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
    } else {
      mediaQuery.addListener(handler);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handler);
      } else {
        mediaQuery.removeListener(handler);
      }
    };
  }, []);

  const resolvedTheme: ResolvedTheme =
    themeMode === 'system' ? (systemDark ? 'dark' : 'light') : themeMode;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, themeMode);
    document.documentElement.setAttribute('data-theme', resolvedTheme);
  }, [themeMode, resolvedTheme]);

  function setThemeMode(mode: ThemeMode) {
    setThemeModeState(mode);
  }

  function toggleTheme() {
    setThemeModeState((prev) => {
      const currentResolved = prev === 'system' ? (systemDark ? 'dark' : 'light') : prev;
      return currentResolved === 'dark' ? 'light' : 'dark';
    });
  }

  return {
    themeMode,
    resolvedTheme,
    setThemeMode,
    toggleTheme,
  };
}
