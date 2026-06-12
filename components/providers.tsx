'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { Lang } from '@/lib/i18n';

type Theme = 'dark' | 'light';

// ── Language context ─────────────────────────────────────────────────────────
interface LangCtx { lang: Lang; setLang: (l: Lang) => void }
const LangContext = createContext<LangCtx>({ lang: 'en', setLang: () => {} });
export const useLang = () => useContext(LangContext);

// ── Theme context ────────────────────────────────────────────────────────────
interface ThemeCtx { theme: Theme; setTheme: (t: Theme) => void }
const ThemeContext = createContext<ThemeCtx>({ theme: 'dark', setTheme: () => {} });
export const useTheme = () => useContext(ThemeContext);

// ── Combined provider ────────────────────────────────────────────────────────
export function Providers({ children }: { children: React.ReactNode }) {
  const [lang,  setLangState]  = useState<Lang>('en');
  const [theme, setThemeState] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedLang  = (localStorage.getItem('foms-lang')  as Lang  | null) ?? 'en';
    const savedTheme = (localStorage.getItem('foms-theme') as Theme | null) ?? 'dark';
    setLangState(savedLang);
    setThemeState(savedTheme);
    applyTheme(savedTheme);
    setMounted(true);
  }, []);

  function applyTheme(t: Theme) {
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem('foms-lang', l);
  }

  function setTheme(t: Theme) {
    setThemeState(t);
    localStorage.setItem('foms-theme', t);
    applyTheme(t);
  }

  if (!mounted) return <>{children}</>;

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <LangContext.Provider value={{ lang, setLang }}>
        {children}
      </LangContext.Provider>
    </ThemeContext.Provider>
  );
}
