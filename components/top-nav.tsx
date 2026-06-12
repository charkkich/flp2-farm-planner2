'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLang, useTheme } from '@/components/providers';
import { translations } from '@/lib/i18n';

export function TopNav() {
  const pathname = usePathname();
  const { lang, setLang } = useLang();
  const { theme, setTheme } = useTheme();
  const n = translations[lang].nav;

  const today = new Date().toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  const NAV = [
    { href: '/',            label: n.dashboard,   icon: '⊞' },
    { href: '/fields',      label: n.fields,      icon: '⊡' },
    { href: '/crop-plans',  label: n.cropPlans,   icon: '📋' },
    { href: '/planning',    label: n.planning,    icon: '📅' },
    { href: '/work-orders', label: n.workOrders,  icon: '🔧' },
    { href: '/workers',     label: n.workers,     icon: '👷' },
    { href: '/machines',    label: n.machines,    icon: '🚜' },
    { href: '/weather',     label: n.weather,     icon: '🌧' },
    { href: '/map',         label: n.map,         icon: '🗺' },
    { href: '/reports',     label: n.reports,     icon: '📊' },
  ];

  return (
    <header className="flex-shrink-0 border-b border-border bg-card">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-[#155d31]">
        <div className="w-7 h-7 rounded-md bg-white/20 flex items-center justify-center text-white text-sm font-bold select-none">
          🌱
        </div>
        <div>
          <div className="text-[13px] font-semibold text-white leading-tight">FLP2 Operation Center</div>
          <div className="text-[10px] text-white/70 leading-tight">Farm Lert Phan 2 · FOMS v2.0 · {today}</div>
        </div>
        {/* Controls */}
        <div className="ml-auto flex items-center gap-2">
          {/* Language toggle */}
          <button
            onClick={() => setLang(lang === 'en' ? 'th' : 'en')}
            className="h-6 px-2 rounded text-[10px] font-semibold bg-white/15 hover:bg-white/25 text-white transition-colors border border-white/20"
            title="Toggle language"
          >
            {lang === 'en' ? 'TH' : 'EN'}
          </button>
          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="h-6 w-6 rounded flex items-center justify-center bg-white/15 hover:bg-white/25 text-white transition-colors border border-white/20 text-[13px]"
            title="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <span className="text-[10px] text-white/60">LIVE</span>
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
        </div>
      </div>

      {/* Tab nav — scrollable on mobile */}
      <nav className="flex bg-card overflow-x-auto">
        {NAV.map(({ href, label, icon }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link key={href} href={href}
              className={[
                'flex-shrink-0 flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px] font-medium transition-colors border-b-2',
                isActive
                  ? 'text-[#155d31] border-[#155d31]'
                  : 'text-muted-foreground border-transparent hover:text-foreground',
              ].join(' ')}>
              <span className="text-base leading-none">{icon}</span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
