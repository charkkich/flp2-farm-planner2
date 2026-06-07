'use client';

import { useEffect, useState, useMemo } from 'react';

interface CropPlan {
  cpNo: string;
  timestamp: string;
  crop: string;
  plot: string;
  transplantPlan: string;
  landPrep: string;
  transplantActual: string;
  removalActual: string;
  areaSqm: number;
  seedlingTray: string;
  seedlingQty: number;
  year: number;
  month: number;
}

function parseCSVLine(line: string): string[] {
  const cols: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; continue; }
    if (c === ',' && !inQ) { cols.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  cols.push(cur.trim());
  return cols;
}

function parseDate(s: string): string {
  if (!s) return '';
  s = s.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[-\s\/]([A-Za-z]+)[-\s\/](\d{4})/);
  if (!m) return s;
  const months: Record<string, string> = {
    jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
    jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12',
  };
  const mo = months[m[2].toLowerCase().slice(0,3)];
  if (!mo) return s;
  return `${m[3]}-${mo}-${m[1].padStart(2,'0')}`;
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

function rowStatus(r: CropPlan): { label: string; color: string; bg: string; order: number } {
  const today = new Date(); today.setHours(0,0,0,0);
  const lp = r.landPrep ? new Date(r.landPrep) : null;
  const tp = r.transplantPlan ? new Date(r.transplantPlan) : null;

  // ล่าช้า: วันปลูกแผนผ่านมาแล้ว แต่ยังไม่ได้ปลูก
  if (tp && tp < today && !lp)
    return { label: 'ล่าช้า', color: '#dc2626', bg: '#fee2e2', order: 0 };
  if (tp && tp < today && lp && lp <= today)
    return { label: 'ล่าช้า', color: '#dc2626', bg: '#fee2e2', order: 0 };
  // รอปลูก: ไถเสร็จแล้ว รอลงกล้า
  if (lp && lp <= today)
    return { label: 'รอปลูก', color: '#d97706', bg: '#fef3c7', order: 1 };
  // รอเตรียมดิน: มีวันไถในอนาคต
  if (lp)
    return { label: 'รอเตรียมดิน', color: '#0284c7', bg: '#e0f2fe', order: 2 };
  // วางแผน: ยังไม่มีวันไถ
  return { label: 'วางแผน', color: '#8b5cf6', bg: '#ede9fe', order: 3 };
}

// วันที่ใช้เรียงลำดับ: ไถก่อน > ปลูกแผน > ไม่มี
function sortDate(r: CropPlan): string {
  if (r.landPrep) return r.landPrep;
  if (r.transplantPlan) return r.transplantPlan;
  return '9999-99-99';
}

const YEARS = [2026, 2025, 2024, 2023];

export default function CropPlansPage() {
  const [all, setAll] = useState<CropPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(2026);
  const [search, setSearch] = useState('');
  const [cropFilter, setCropFilter] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/Crop plan.csv');
        const text = await res.text();
        const lines = text.split('\n');
        const records: CropPlan[] = [];
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('CP.')) continue;
          const c = parseCSVLine(trimmed);
          if (c.length < 17) continue;
          const yr = parseInt(c[16]);
          if (!yr || yr < 2020) continue;
          records.push({
            cpNo:             c[0],
            timestamp:        c[1],
            crop:             c[2],
            plot:             c[3],
            transplantPlan:   parseDate(c[4]),
            landPrep:         parseDate(c[6]),
            transplantActual: parseDate(c[7]),
            removalActual:    parseDate(c[9]),
            areaSqm:          parseFloat(c[10].replace(/,/g, '')) || 0,
            seedlingTray:     c[19] || '',
            seedlingQty:      parseInt(c[20]) || 0,
            year:             yr,
            month:            parseInt(c[17]) || 0,
          });
        }
        setAll(records);
      } catch (e) {
        console.error('CSV load error', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const crops = useMemo(() => {
    const s = new Set(
      all.filter(r => r.year === year && !r.transplantActual && !r.removalActual)
         .map(r => r.crop)
    );
    return ['all', ...Array.from(s).sort()];
  }, [all, year]);

  // เฉพาะแปลงที่ยังไม่ได้ปลูก (ไม่มี transplantActual และไม่มี removalActual)
  const filtered = useMemo(() => {
    return all
      .filter(r => {
        if (r.year !== year) return false;
        if (r.transplantActual || r.removalActual) return false; // ซ่อนแปลงที่ปลูกแล้ว
        if (cropFilter !== 'all' && r.crop !== cropFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          return r.cpNo.toLowerCase().includes(q) ||
                 r.plot.toLowerCase().includes(q) ||
                 r.crop.toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        const sa = rowStatus(a).order;
        const sb = rowStatus(b).order;
        if (sa !== sb) return sa - sb; // ล่าช้า > รอปลูก > รอเตรียมดิน > วางแผน
        return sortDate(a) < sortDate(b) ? -1 : 1;
      });
  }, [all, year, cropFilter, search]);

  const kpi = useMemo(() => {
    const yr = all.filter(r => r.year === year);
    const pending = yr.filter(r => !r.transplantActual && !r.removalActual);
    const today = new Date(); today.setHours(0,0,0,0);
    return {
      total:    yr.length,
      late:     pending.filter(r => {
        const tp = r.transplantPlan ? new Date(r.transplantPlan) : null;
        return tp && tp < today;
      }).length,
      readyPlant: pending.filter(r => {
        const lp = r.landPrep ? new Date(r.landPrep) : null;
        const tp = r.transplantPlan ? new Date(r.transplantPlan) : null;
        return lp && lp <= today && !(tp && tp < today);
      }).length,
      waitPrep: pending.filter(r => {
        const lp = r.landPrep ? new Date(r.landPrep) : null;
        return lp && lp > today;
      }).length,
      noPrep:   pending.filter(r => !r.landPrep).length,
    };
  }, [all, year]);

  if (loading) {
    return (
      <div className="p-6 animate-pulse space-y-4">
        <div className="h-6 w-48 bg-muted rounded" />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-lg" />)}
        </div>
        <div className="h-96 bg-muted rounded-lg" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold">ลำดับการเตรียมดิน</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            แสดงเฉพาะแปลงที่ยังไม่ได้ปลูก · เรียงตาม ล่าช้า → รอปลูก → รอไถ → วางแผน
          </p>
        </div>
        <div className="flex gap-1">
          {YEARS.map(y => (
            <button key={y} onClick={() => { setYear(y); setCropFilter('all'); setSearch(''); }}
              className={['px-3 py-1.5 rounded text-xs font-medium border transition-colors',
                y === year ? 'bg-[#1a6b3c] text-white border-[#1a6b3c]'
                           : 'border-border text-muted-foreground hover:text-foreground'].join(' ')}>
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'ล่าช้า',        val: kpi.late,       color: 'text-red-500' },
          { label: 'รอปลูก',        val: kpi.readyPlant, color: 'text-amber-500' },
          { label: 'รอเตรียมดิน',   val: kpi.waitPrep,   color: 'text-sky-500' },
          { label: 'ยังไม่กำหนด',   val: kpi.noPrep,     color: 'text-purple-400' },
        ].map(k => (
          <div key={k.label} className="bg-card border border-border rounded-lg px-3 py-2 text-center">
            <div className={`text-xl font-semibold ${k.color}`}>{k.val}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input type="text" placeholder="ค้นหา CP No. / แปลง / พืช…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="h-8 px-3 rounded border border-border bg-card text-xs w-52 focus:outline-none focus:ring-1 focus:ring-[#1a6b3c]" />
        <select value={cropFilter} onChange={e => setCropFilter(e.target.value)}
          className="h-8 px-2 rounded border border-border bg-card text-xs focus:outline-none">
          {crops.map(c => <option key={c} value={c}>{c === 'all' ? 'พืชทุกชนิด' : c}</option>)}
        </select>
        <div className="text-[11px] text-muted-foreground ml-auto">
          {filtered.length} แปลงที่รอดำเนินการ จาก {kpi.total} รายการปี {year}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        {/* Header */}
        <div className="hidden md:grid gap-2 px-3 py-2 bg-muted/40 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wide"
          style={{ gridTemplateColumns: '40px 150px 70px 130px 130px 100px' }}>
          <div>#</div>
          <div>CP No. / พืช</div>
          <div>แปลง</div>
          <div>ไถดิน</div>
          <div>ปลูก (แผน)</div>
          <div>สถานะ</div>
        </div>

        <div className="divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">ไม่พบข้อมูล</div>
          ) : filtered.map((r, idx) => {
            const st = rowStatus(r);
            const isOpen = expanded === r.cpNo;
            return (
              <div key={r.cpNo}>
                {/* Desktop row */}
                <div
                  className="hidden md:grid gap-2 px-3 py-2.5 items-center cursor-pointer hover:bg-muted/30 text-xs"
                  style={{ gridTemplateColumns: '40px 150px 70px 130px 130px 100px' }}
                  onClick={() => setExpanded(isOpen ? null : r.cpNo)}
                >
                  <div className="text-muted-foreground font-mono text-[10px]">{idx + 1}</div>
                  <div>
                    <div className="font-semibold">{r.cpNo}</div>
                    <div className="text-muted-foreground text-[10px]">{r.crop}</div>
                  </div>
                  <div>
                    <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">{r.plot}</span>
                  </div>
                  <div className={r.landPrep ? 'font-medium' : 'text-muted-foreground'}>
                    {r.landPrep ? fmtDate(r.landPrep) : '—'}
                  </div>
                  <div className={r.transplantPlan ? '' : 'text-muted-foreground'}>
                    {r.transplantPlan ? fmtDate(r.transplantPlan) : '—'}
                  </div>
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium"
                      style={{ background: st.bg, color: st.color }}>{st.label}</span>
                  </div>
                </div>

                {/* Mobile card */}
                <div className="md:hidden px-3 py-2.5 cursor-pointer active:bg-muted/30"
                  onClick={() => setExpanded(isOpen ? null : r.cpNo)}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] text-muted-foreground mr-1.5">#{idx + 1}</span>
                      <span className="font-semibold text-xs">{r.cpNo}</span>
                      <span className="ml-2 text-[10px] text-muted-foreground">{r.crop}</span>
                    </div>
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0"
                      style={{ background: st.bg, color: st.color }}>{st.label}</span>
                  </div>
                  <div className="flex gap-3 mt-1 flex-wrap text-[10px] text-muted-foreground">
                    <span>แปลง <strong className="text-foreground font-mono">{r.plot}</strong></span>
                    {r.landPrep && <span>ไถ {fmtDate(r.landPrep)}</span>}
                    {r.transplantPlan && <span>ปลูก {fmtDate(r.transplantPlan)}</span>}
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="px-4 py-3 bg-muted/20 border-t border-border text-xs grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-2.5">
                    {[
                      ['CP No.',       r.cpNo],
                      ['พืช',          r.crop],
                      ['แปลง',         r.plot],
                      ['พื้นที่',      r.areaSqm ? `${r.areaSqm.toLocaleString()} m²` : '—'],
                      ['วันไถดิน',     fmtDate(r.landPrep)],
                      ['ปลูก (แผน)',   fmtDate(r.transplantPlan)],
                      ['ถาดกล้า',      r.seedlingTray || '—'],
                      ['จำนวนถาด',     r.seedlingQty ? String(r.seedlingQty) : '—'],
                    ].map(([lbl, val]) => (
                      <div key={lbl}>
                        <div className="text-[10px] text-muted-foreground">{lbl}</div>
                        <div className="font-medium mt-0.5">{val}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
