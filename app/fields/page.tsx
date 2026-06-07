'use client';

import { useEffect, useState, useMemo } from 'react';
import { fetchCropPlans, getPlotStatus, fmtDateTh, type CropPlan } from '@/lib/farmData';

const STS_LIST = ['ล่าช้า','รอปลูก','รอเตรียมดิน','วางแผน','ปลูกแล้ว','เสร็จสิ้น'];
const STS_COLOR: Record<string,string> = {
  'ล่าช้า':'#dc2626','รอปลูก':'#d97706','รอเตรียมดิน':'#0284c7','วางแผน':'#8b5cf6',
  'ปลูกแล้ว':'#16a34a','เสร็จสิ้น':'#64748b',
};
const STS_BG: Record<string,string> = {
  'ล่าช้า':'#fee2e2','รอปลูก':'#fef3c7','รอเตรียมดิน':'#e0f2fe','วางแผน':'#ede9fe',
  'ปลูกแล้ว':'#dcfce7','เสร็จสิ้น':'#f1f5f9',
};

const YEARS = [2026,2025,2024,2023];

export default function FieldsPage() {
  const [all, setAll] = useState<CropPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(2026);
  const [search, setSearch] = useState('');
  const [stsFilter, setStsFilter] = useState('all');
  const [cropFilter, setCropFilter] = useState('all');
  const [editCode, setEditCode] = useState<string|null>(null);
  const [showCount, setShowCount] = useState(80);

  useEffect(() => {
    fetchCropPlans().then(d => { setAll(d); setLoading(false); });
  }, []);

  const yr = useMemo(() => all.filter(r => r.year === year), [all, year]);

  const crops = useMemo(() => {
    const s = new Set(yr.map(r => r.crop));
    return ['all',...Array.from(s).sort()];
  }, [yr]);

  // Count per status
  const stsCounts = useMemo(() => {
    const c: Record<string,number> = { all: yr.length };
    yr.forEach(r => { const st = getPlotStatus(r).label; c[st] = (c[st]||0)+1; });
    return c;
  }, [yr]);

  const filtered = useMemo(() => {
    return yr.filter(r => {
      const st = getPlotStatus(r).label;
      if (stsFilter !== 'all' && st !== stsFilter) return false;
      if (cropFilter !== 'all' && r.crop !== cropFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return r.cpNo.toLowerCase().includes(q)||r.plot.toLowerCase().includes(q)||r.crop.toLowerCase().includes(q);
      }
      return true;
    }).sort((a,b) => {
      const oa = STS_LIST.indexOf(getPlotStatus(a).label);
      const ob = STS_LIST.indexOf(getPlotStatus(b).label);
      if (oa !== ob) return oa - ob;
      return (a.landPrep||a.transplantPlan||'9') < (b.landPrep||b.transplantPlan||'9') ? -1 : 1;
    });
  }, [yr, stsFilter, cropFilter, search]);

  const editItem = editCode ? all.find(r => r.cpNo === editCode) : null;

  if (loading) return (
    <div className="p-4 animate-pulse space-y-3">
      <div className="flex gap-2">{[...Array(6)].map((_,i)=><div key={i} className="h-7 w-20 bg-muted rounded-full"/>)}</div>
      <div className="space-y-1.5">{[...Array(8)].map((_,i)=><div key={i} className="h-12 bg-muted rounded-lg"/>)}</div>
    </div>
  );

  return (
    <div className="p-3 lg:p-4 space-y-3">

      {/* Year + search */}
      <div className="flex items-center gap-2 flex-wrap">
        <input type="text" placeholder="ค้นหา แปลง / CP / พืช…" value={search}
          onChange={e=>{ setSearch(e.target.value); setShowCount(80); }}
          className="h-7 px-2.5 rounded border border-border bg-card text-[11px] w-48 focus:outline-none focus:ring-1 focus:ring-[#155d31]"/>
        <select value={cropFilter} onChange={e=>setCropFilter(e.target.value)}
          className="h-7 px-2 rounded border border-border bg-card text-[11px] focus:outline-none">
          {crops.map(c=><option key={c} value={c}>{c==='all'?'พืชทุกชนิด':c}</option>)}
        </select>
        <div className="flex gap-1 ml-auto">
          {YEARS.map(y=>(
            <button key={y} onClick={()=>{ setYear(y); setStsFilter('all'); setSearch(''); setShowCount(80); }}
              className={['px-2.5 py-1 rounded text-[11px] font-medium border transition-colors',
                y===year?'bg-[#155d31] text-white border-[#155d31]':'border-border text-muted-foreground hover:text-foreground'].join(' ')}>
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Status filter chips */}
      <div className="flex gap-1.5 flex-wrap">
        <button onClick={()=>{ setStsFilter('all'); setShowCount(80); }}
          className={['text-[10px] px-2.5 py-1 rounded-full border transition-colors',
            stsFilter==='all'?'bg-[#e6f3ec] border-[#155d31] text-[#155d31] font-medium':'border-border text-muted-foreground'].join(' ')}>
          ทั้งหมด ({stsCounts.all||0})
        </button>
        {STS_LIST.map(s => stsCounts[s] ? (
          <button key={s} onClick={()=>{ setStsFilter(s); setShowCount(80); }}
            className={['text-[10px] px-2.5 py-1 rounded-full border transition-colors',
              stsFilter===s?'font-medium':'border-border text-muted-foreground'].join(' ')}
            style={stsFilter===s?{background:STS_BG[s],borderColor:STS_COLOR[s],color:STS_COLOR[s]}:{}}>
            {s} ({stsCounts[s]})
          </button>
        ) : null)}
      </div>

      {/* Edit panel */}
      {editItem && (
        <div className="rounded-lg border border-border bg-card p-3 space-y-2">
          <div className="text-[12px] font-semibold">รายละเอียด: {editItem.plot} ({editItem.cpNo})</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
            {[
              ['พืช', editItem.crop],
              ['พื้นที่', editItem.areaSqm ? `${editItem.areaSqm.toLocaleString()} m²` : '—'],
              ['วันไถดิน', fmtDateTh(editItem.landPrep)],
              ['ปลูก (แผน)', fmtDateTh(editItem.transplantPlan)],
              ['ปลูก (จริง)', fmtDateTh(editItem.transplantActual)],
              ['เก็บเกี่ยว', fmtDateTh(editItem.removalActual)],
              ['ถาดกล้า', editItem.seedlingTray || '—'],
              ['จำนวนถาด', editItem.seedlingQty ? String(editItem.seedlingQty) : '—'],
            ].map(([l,v])=>(
              <div key={l}><div className="text-[10px] text-muted-foreground">{l}</div><div className="font-medium mt-0.5">{v}</div></div>
            ))}
          </div>
          <button onClick={()=>setEditCode(null)}
            className="mt-1 w-full py-1.5 text-[11px] rounded border border-[#155d31] text-[#155d31] bg-[#e6f3ec] cursor-pointer">
            ปิด
          </button>
        </div>
      )}

      {/* Count */}
      <div className="text-[10px] text-muted-foreground">{filtered.length} รายการ จาก {yr.length} ปี {year}</div>

      {/* Field list */}
      <div className="space-y-1">
        {filtered.length === 0
          ? <div className="py-10 text-center text-muted-foreground text-sm">ไม่พบแปลง</div>
          : filtered.slice(0, showCount).map(r => {
            const st = getPlotStatus(r);
            const col = STS_COLOR[st.label] || '#888';
            const bg  = STS_BG[st.label] || '#f5f5f5';
            return (
              <div key={r.cpNo}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg border bg-card cursor-pointer hover:bg-muted/30 transition-colors"
                style={{ borderLeftWidth:3, borderLeftColor:col }}
                onClick={()=>setEditCode(editCode===r.cpNo?null:r.cpNo)}>
                <div className="font-mono text-[12px] font-semibold w-14 flex-shrink-0" style={{ color:col }}>{r.plot}</div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background:bg, color:col }}>{st.label}</span>
                  <span className="ml-2 text-[10px] text-muted-foreground">{r.crop}</span>
                  {r.transplantPlan && !r.transplantActual && (
                    <span className="ml-2 text-[10px] text-muted-foreground">ปลูก {fmtDateTh(r.transplantPlan)}</span>
                  )}
                  {r.transplantActual && (
                    <span className="ml-2 text-[10px] text-muted-foreground">ปลูกแล้ว {fmtDateTh(r.transplantActual)}</span>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">{r.cpNo.slice(-7)}</span>
                <span className="text-muted-foreground/50 text-base">›</span>
              </div>
            );
          })}
        {filtered.length > showCount && (
          <button onClick={()=>setShowCount(c=>c+80)}
            className="w-full py-2 text-[11px] text-[#155d31] border border-[#155d31] rounded-lg bg-[#e6f3ec] mt-1">
            แสดงเพิ่มเติม ({filtered.length - showCount} รายการ)
          </button>
        )}
      </div>
    </div>
  );
}
