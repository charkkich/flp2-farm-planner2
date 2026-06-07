'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/',           label: 'แดชบอร์ด', icon: '⊞' },
  { href: '/map',        label: 'แผนที่',    icon: '⊠' },
  { href: '/crop-plans', label: 'วางแผน', icon: '⊟' },
  { href: '/fields',     label: 'แปลง',     icon: '⊡' },
  { href: '/weather',    label: 'อากาศ',    icon: '☁' },
];

export function TopNav() {
  const pathname = usePathname();
  const today = new Date().toLocaleDateString('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <header className="flex-shrink-0 border-b border-border bg-card">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-[#1a6b3c]">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white text-base font-bold select-none">
          🌱
        </div>
        <div>
          <div className="text-sm font-semibold text-white leading-tight">FLP2 Operation Center</div>
          <div className="text-[11px] text-white/70 leading-tight">Farm Lert Phan 2 · {today}</div>
        </div>
        {/* Live dot */}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[10px] text-white/60">LIVE</span>
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
        </div>
      </div>

      {/* Tab navigation */}
      <nav className="flex bg-card">
        {NAV.map(({ href, label }) => {
          const isActive = href === '/'
            ? pathname === '/'
            : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors border-b-2',
                isActive
                  ? 'text-[#1a6b3c] border-[#1a6b3c]'
                  : 'text-muted-foreground border-transparent hover:text-foreground',
              ].join(' ')}
            >
              <span className="text-base leading-none">{label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
