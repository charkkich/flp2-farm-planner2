'use client';

import { useEffect, useState, useMemo } from 'react';

interface CropPlan {
  cpNo: string;
  timestamp: string;
  crop: string;
  plot: string;
  transplantPlan: string;
  removalPlan: string;
  landPrep: string;
  transplantActual: string;
  removalRequest: string;
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
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

function rowStatus(r: CropPlan): { label: string; color: string; bg: string } {
  const today = new Date();
  const lp = r.landPrep ? new Date(r.landPrep) : null;
  const tp = r.transplantPlan ? new Date(r.transplantPlan) : null;
  const ta = r.transplantActual ? new Date(r.transplantActual) : null;
  const ra = r.removalActual ? new Date(r.removalActual) : null;

  if (ra) return { label: 'เสร็จสิ้น',      color: '#64748b', bg: '#f1f5f9' };
  if (ta) return { label: 'ปลูกแล้ว',       color: '#16a34a', bg: '#dcfce7' };
  if (lp && lp <= today) return { label: 'รอปลูก',  color: '#d97706', bg: '#fef3c7' };
  if (tp && tp < today)  return { label: 'ล่าช้า',  color: '#dc2626', bg: '#fee2e2' };
  if (lp)                return { label: 'รอเตรียมดิน', color: '#0284c7', bg: '#e0f2fe' };
  return                        { label: 'วางแผน',  color: '#8b5cf6', bg: '#ede9fe' };
}

const YEARS = [2026, 2025, 2024, 2023];

export default function CropPlansPage() {
  const [all, setAll] = useState<CropPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(2026);
  const [search, setSearch] = useState('');
  const [cropFilter, setCropFilter] = useState('all');
  const [sortKey, setSortKey] = useState<'landPrep' | 'transplantPlan' | 'cpNo'>('landPrep');
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
            removalPlan:      parseDate(c[5]),
            landPrep:         parseDate(c[6]),
            transplantActual: parseDate(c[7]),
            removalRequest:   parseDate(c[8]),
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
    const s = new Set(all.filter(r => r.year === year).map(r => r.crop));
    return ['all', ...Array.from(s).sort()];
  }, [all, year]);

  const filtered = useMemo(() => {
    return all
      .filter(r => {
        if (r.year !== year) return false;
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
        if (sortKey === 'cpNo') return a.cpNo.localeCompare(b.cpNo);
        const da = a[sortKey] || '9999-99-99';
        const db = b[sortKey] || '9999-99-99';
        return da < db ? -1 : da > db ? 1 : 0;
      });
  }, [all, year, cropFilter, search, sortKey]);

  const kpi = useMemo(() => {
    const yr = all.filter(r => r.year === year);
    return {
      total:   yr.length,
      waiting: yr.filter(r => r.landPrep && !r.transplantActual && !r.removalActual).length,
      planted: yr.filter(r => r.transplantActual && !r.removalActual).length,
      done:    yr.filter(r => !!r.removalActual).length,
      pending: yr.filter(r => !r.landPrep).length,
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
          <h1 className="text-lg font-bold">แผนการปลูก</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            ข้อมูลจาก Crop Plan CSV · เรียงตามวันเตรียมดิน · ใช้ CP No. เป็นหลัก
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
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { label: 'ทั้งหมด',       val: kpi.total,   color: 'text-foreground' },
          { label: 'ยังไม่เตรียม',  val: kpi.pending, color: 'text-sky-500' },
          { label: 'รอปลูก',        val: kpi.waiting, color: 'text-amber-500' },
          { label: 'ปลูกแล้ว',      val: kpi.planted, color: 'text-[#16a34a]' },
          { label: 'เสร็จสิ้น',     val: kpi.done,    color: 'text-slate-400' },
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
        <div className="flex gap-1 ml-auto">
          {([
            { k: 'landPrep' as const,       label: 'เตรียมดิน' },
            { k: 'transplantPlan' as const,  label: 'วันปลูก' },
            { k: 'cpNo' as const,            label: 'CP No.' },
          ]).map(({ k, label }) => (
            <button key={k} onClick={() => setSortKey(k)}
              className={['px-2.5 py-1 rounded text-[10px] border transition-colors',
                sortKey === k ? 'bg-[#1a6b3c] text-white border-[#1a6b3c]'
                              : 'border-border text-muted-foreground hover:text-foreground'].join(' ')}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="text-[11px] text-muted-foreground">
        แสดง {filtered.length} รายการ จาก {all.filter(r => r.year === year).length} รายการปี {year}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        {/* Header */}
        <div className="hidden md:grid gap-2 px-3 py-2 bg-muted/40 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wide"
          style={{ gridTemplateColumns: '150px 80px 140px 120px 120px 120px 120px 110px' }}>
          <div>CP No. / พืช</div><div>แปลง</div><div>เตรียมดิน</div>
          <div>ปลูก (แผน)</div><div>ปลูก (จริง)</div>
          <div>เก็บ (แผน)</div><div>เก็บ (จริง)</div><div>สถานะ</div>
        </div>

        <div className="divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">ไม่พบข้อมูล</div>
          ) : filtered.map(r => {
            const st = rowStatus(r);
            const isOpen = expanded === r.cpNo;
            return (
              <div key={r.cpNo}>
                {/* Desktop row */}
                <div
                  className="hidden md:grid gap-2 px-3 py-2.5 items-center cursor-pointer hover:bg-muted/30 text-xs"
                  style={{ gridTemplateColumns: '150px 80px 140px 120px 120px 120px 120px 110px' }}
                  onClick={() => setExpanded(isOpen ? null : r.cpNo)}
                >
                  <div>
                    <div className="font-semibold">{r.cpNo}</div>
                    <div className="text-muted-foreground text-[10px]">{r.crop}</div>
                  </div>
                  <div>
                    <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">{r.plot}</span>
                  </div>
                  <div className={r.landPrep ? 'text-foreground' : 'text-muted-foreground'}>
                    {r.landPrep ? fmtDate(r.landPrep) : '—'}
                  </div>
                  <div className={r.transplantPlan ? '' : 'text-muted-foreground'}>
                    {r.transplantPlan ? fmtDate(r.transplantPlan) : '—'}
                  </div>
                  <div className={r.transplantActual ? 'text-[#16a34a] font-medium' : 'text-muted-foreground'}>
                    {r.transplantActual ? fmtDate(r.transplantActual) : '—'}
                  </div>
                  <div className={r.removalPlan ? '' : 'text-muted-foreground'}>
                    {r.removalPlan ? fmtDate(r.removalPlan) : '—'}
                  </div>
                  <div className={r.removalActual ? 'text-muted-foreground' : ''}>
                    {r.removalActual ? fmtDate(r.removalActual) : '—'}
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
                      <span className="font-semibold text-xs">{r.cpNo}</span>
                      <span className="ml-2 text-[10px] text-muted-foreground">{r.crop}</span>
                    </div>
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0"
                      style={{ background: st.bg, color: st.color }}>{st.label}</span>
                  </div>
                  <div className="flex gap-2 mt-1 flex-wrap text-[10px] text-muted-foreground">
                    <span>แปลง <strong className="text-foreground">{r.plot}</strong></span>
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
                      ['ส่งคำขอ',      r.timestamp],
                      ['เตรียมดิน',    fmtDate(r.landPrep)],
                      ['ปลูก (แผน)',   fmtDate(r.transplantPlan)],
                      ['ปลูก (จริง)',  fmtDate(r.transplantActual)],
                      ['เก็บ (แผน)',   fmtDate(r.removalPlan)],
                      ['เก็บ (จริง)',  fmtDate(r.removalActual)],
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
