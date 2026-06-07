'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { fetchCropPlans, getPlotStatus, fmtDateTh, daysUntil, type CropPlan } from '@/lib/farmData';

const STS_COLOR: Record<string, string> = {
  'ล่าช้า':'#dc2626','รอปลูก':'#d97706','รอเตรียมดิน':'#0284c7','วางแผน':'#8b5cf6',
};

function sortDate(r: CropPlan) {
  return r.landPrep || r.transplantPlan || '9999-99-99';
}

// Steps remaining: 0=done, 1=ปลูกได้เลย, 2=รอปลูก, 3=รอเตรียมดิน, 4=ยังไม่กำหนด
function stepsRemaining(r: CropPlan, today: Date): number {
  const lp = r.landPrep ? new Date(r.landPrep+'T00:00:00') : null;
  if (!lp) return 4;
  if (lp > today) return 3;
  return 2; // landPrep done, still need to plant
}

const STEP_COLORS = ['#155d31','#155d31','#d97706','#0284c7','#8b5cf6'];

const YEARS = [2026,2025,2024,2023];

export default function PlanningPage() {
  const [all, setAll] = useState<CropPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(2026);
  const [search, setSearch] = useState('');
  const [cropFilter, setCropFilter] = useState('all');
  const [expanded, setExpanded] = useState<string|null>(null);
  const ganttRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetchCropPlans().then(d => { setAll(d); setLoading(false); });
  }, []);

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  const crops = useMemo(() => {
    const s = new Set(all.filter(r=>r.year===year&&!r.transplantActual&&!r.removalActual).map(r=>r.crop));
    return ['all',...Array.from(s).sort()];
  }, [all, year]);

  const queue = useMemo(() => all
    .filter(r => {
      if (r.year !== year) return false;
      if (r.transplantActual || r.removalActual) return false;
      if (cropFilter !== 'all' && r.crop !== cropFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return r.cpNo.toLowerCase().includes(q)||r.plot.toLowerCase().includes(q)||r.crop.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      const sa = getPlotStatus(a);
      const sb = getPlotStatus(b);
      const order: Record<string,number> = { 'ล่าช้า':0,'รอปลูก':1,'รอเตรียมดิน':2,'วางแผน':3 };
      const oa = order[sa.label] ?? 9;
      const ob = order[sb.label] ?? 9;
      if (oa !== ob) return oa - ob;
      return sortDate(a) < sortDate(b) ? -1 : 1;
    }),
  [all, year, cropFilter, search, today]);

  const kpi = useMemo(() => {
    const yr = all.filter(r=>r.year===year);
    const pending = yr.filter(r=>!r.transplantActual&&!r.removalActual);
    return {
      late:      pending.filter(r=>{ const tp=r.transplantPlan?new Date(r.transplantPlan+'T00:00:00'):null; return tp&&tp<today; }).length,
      readyPlant:pending.filter(r=>{ const lp=r.landPrep?new Date(r.landPrep+'T00:00:00'):null; const tp=r.transplantPlan?new Date(r.transplantPlan+'T00:00:00'):null; return lp&&lp<=today&&!(tp&&tp<today); }).length,
      waitPrep:  pending.filter(r=>{ const lp=r.landPrep?new Date(r.landPrep+'T00:00:00'):null; return lp&&lp>today; }).length,
      noPrep:    pending.filter(r=>!r.landPrep).length,
    };
  }, [all, year, today]);

  // Draw Gantt
  useEffect(() => {
    const canvas = ganttRef.current;
    if (!canvas || !queue.length) return;
    const items = queue.slice(0, 8);
    const ROWS = items.length;
    const DAYS = 14;
    const ROW_H = 20;
    const LABEL_W = 52;
    const COL_W = 22;
    const HEAD_H = 28;
    const W = LABEL_W + DAYS * COL_W;
    const H = HEAD_H + ROWS * ROW_H + 4;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0,0,W,H);

    // Dark bg
    ctx.fillStyle = 'rgba(0,0,0,0.03)';
    ctx.fillRect(0,0,W,H);

    const days = Array.from({length:DAYS},(_,i)=>{ const d=new Date(today); d.setDate(today.getDate()+i); return d; });
    const DAY_TH_SHORT = ['อา','จ','อ','พ','พฤ','ศ','ส'];

    // Header
    days.forEach((d,i) => {
      const x = LABEL_W + i*COL_W;
      const isWeekend = d.getDay()===0||d.getDay()===6;
      ctx.fillStyle = isWeekend ? 'rgba(239,68,68,0.07)' : 'rgba(0,0,0,0.02)';
      ctx.fillRect(x, 0, COL_W, H);
      ctx.fillStyle = isWeekend ? '#ef4444' : '#888';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(DAY_TH_SHORT[d.getDay()], x+COL_W/2, 11);
      ctx.font = '9px sans-serif';
      ctx.fillStyle = i===0 ? '#155d31' : '#666';
      ctx.fillText(String(d.getDate()), x+COL_W/2, 23);
    });

    // Grid lines
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 0.5;
    days.forEach((_,i) => {
      const x = LABEL_W + i*COL_W;
      ctx.beginPath(); ctx.moveTo(x,HEAD_H); ctx.lineTo(x,H); ctx.stroke();
    });

    // Today line
    ctx.strokeStyle = '#155d31';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3,2]);
    ctx.beginPath(); ctx.moveTo(LABEL_W,HEAD_H); ctx.lineTo(LABEL_W,H); ctx.stroke();
    ctx.setLineDash([]);

    // Rows
    items.forEach((r, ri) => {
      const y = HEAD_H + ri * ROW_H;
      const st = getPlotStatus(r);
      const sl = stepsRemaining(r, today);
      const col = st.label === 'ล่าช้า' ? '#dc2626' : st.label === 'รอปลูก' ? '#d97706' : st.label === 'รอเตรียมดิน' ? '#0284c7' : '#8b5cf6';

      // Label
      ctx.fillStyle = '#222';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(r.plot.slice(0,6), 2, y+ROW_H*0.67);

      // Plant date marker
      if (r.transplantPlan) {
        const pd = new Date(r.transplantPlan+'T00:00:00');
        const di = Math.round((pd.getTime()-today.getTime())/86400000);
        if (di >= 0 && di < DAYS) {
          const px = LABEL_W + di*COL_W;
          ctx.fillStyle = '#155d31';
          ctx.fillRect(px+1, y+3, COL_W-2, ROW_H-6);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 7px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('P', px+COL_W/2, y+ROW_H*0.63);
        }
      }

      // Land prep marker
      if (r.landPrep) {
        const lpd = new Date(r.landPrep+'T00:00:00');
        const di = Math.round((lpd.getTime()-today.getTime())/86400000);
        if (di >= 0 && di < DAYS) {
          const px = LABEL_W + di*COL_W;
          ctx.fillStyle = '#0284c7';
          ctx.fillRect(px+1, y+ROW_H/2-3, COL_W-2, 6);
        }
      }

      // Progress bar (days until transplant as activity span)
      if (r.transplantPlan) {
        const pd = new Date(r.transplantPlan+'T00:00:00');
        const dl = Math.max(0, Math.round((pd.getTime()-today.getTime())/86400000));
        if (dl > 0 && dl < DAYS) {
          ctx.globalAlpha = 0.2;
          ctx.fillStyle = col;
          ctx.fillRect(LABEL_W+1, y+4, dl*COL_W-2, ROW_H-8);
          ctx.globalAlpha = 1;
        }
      }
    });
  }, [queue, today]);

  if (loading) return (
    <div className="p-4 animate-pulse space-y-3">
      <div className="grid grid-cols-4 gap-2">{[...Array(4)].map((_,i)=><div key={i} className="h-14 bg-muted rounded-lg"/>)}</div>
      <div className="h-64 bg-muted rounded-lg"/>
    </div>
  );

  return (
    <div className="p-3 lg:p-4 space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-base font-bold">คิวไถดิน — ลำดับการเตรียมแปลง</h1>
          <p className="text-[10px] text-muted-foreground mt-0.5">เฉพาะแปลงที่ยังไม่ได้ปลูก เรียงตามความเร่งด่วน</p>
        </div>
        <div className="flex gap-1">
          {YEARS.map(y => (
            <button key={y} onClick={() => { setYear(y); setCropFilter('all'); setSearch(''); }}
              className={['px-2.5 py-1 rounded text-[11px] font-medium border transition-colors',
                y===year?'bg-[#155d31] text-white border-[#155d31]':'border-border text-muted-foreground hover:text-foreground'].join(' ')}>
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { l:'ล่าช้า',       v:kpi.late,       c:'text-red-500' },
          { l:'รอปลูก',       v:kpi.readyPlant, c:'text-amber-500' },
          { l:'รอเตรียมดิน',  v:kpi.waitPrep,   c:'text-sky-500' },
          { l:'ยังไม่กำหนด',  v:kpi.noPrep,     c:'text-purple-400' },
        ].map(k => (
          <div key={k.l} className="bg-card border border-border rounded-lg px-3 py-2 text-center">
            <div className={`text-xl font-medium ${k.c}`}>{k.v}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{k.l}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input type="text" placeholder="ค้นหา CP / แปลง / พืช…" value={search}
          onChange={e=>setSearch(e.target.value)}
          className="h-7 px-2.5 rounded border border-border bg-card text-[11px] w-44 focus:outline-none focus:ring-1 focus:ring-[#155d31]"/>
        <select value={cropFilter} onChange={e=>setCropFilter(e.target.value)}
          className="h-7 px-2 rounded border border-border bg-card text-[11px] focus:outline-none">
          {crops.map(c=><option key={c} value={c}>{c==='all'?'พืชทุกชนิด':c}</option>)}
        </select>
        <span className="text-[10px] text-muted-foreground ml-auto">{queue.length} แปลงรอดำเนินการ</span>
      </div>

      {/* Gantt 14 days */}
      {queue.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-3 overflow-x-auto">
          <div className="text-[11px] font-medium text-muted-foreground mb-2">📅 Gantt Chart 14 วัน (P=วันปลูกแผน)</div>
          <canvas ref={ganttRef} className="rounded" style={{ imageRendering:'pixelated', maxWidth:'100%' }}/>
          <div className="flex gap-3 mt-2 text-[10px] text-muted-foreground flex-wrap">
            <span><span className="inline-block w-3 h-2.5 rounded-sm bg-[#155d31] mr-1 align-middle"/>วันปลูก (P)</span>
            <span><span className="inline-block w-3 h-2.5 rounded-sm bg-[#0284c7] mr-1 align-middle"/>วันไถดิน</span>
          </div>
        </div>
      )}

      {/* Queue list */}
      <div className="space-y-1.5">
        {queue.length === 0
          ? <div className="py-10 text-center text-muted-foreground text-sm">ไม่พบข้อมูล</div>
          : queue.map((r, idx) => {
            const st = getPlotStatus(r);
            const sl = stepsRemaining(r, today);
            const col = STS_COLOR[st.label] || '#888';
            const tp = r.transplantPlan ? new Date(r.transplantPlan+'T00:00:00') : null;
            const dl = tp ? Math.round((tp.getTime()-today.getTime())/86400000) : null;
            const urg = dl !== null && dl < 0 ? 'เกินกำหนด' : dl === 0 ? 'วันนี้!' : dl !== null && dl <= 2 ? 'เร่งด่วน' : dl !== null && dl <= 5 ? 'ต้องรีบ' : 'ตามแผน';
            const urgCol = dl !== null && dl < 0 ? '#dc2626' : dl !== null && dl <= 2 ? '#dc2626' : dl !== null && dl <= 5 ? '#a0560a' : '#155d31';
            const isOpen = expanded === r.cpNo;
            return (
              <div key={r.cpNo} className="rounded-lg border bg-card overflow-hidden"
                style={{ borderLeftWidth:3, borderLeftColor:col }}>
                <div className="flex items-center gap-2.5 px-3 py-2 cursor-pointer"
                  onClick={() => setExpanded(isOpen ? null : r.cpNo)}>
                  <div className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                    style={{ background: col+'1a', color: col }}>{idx+1}</div>
                  <div className="font-medium text-[12px] w-24 flex-shrink-0">{r.plot}</div>
                  <div className="text-[10px] text-muted-foreground flex-1 min-w-0 truncate">{r.crop} · {r.cpNo}</div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: st.bg, color: st.color }}>{st.label}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 hidden sm:inline"
                    style={{ background: urgCol+'18', color: urgCol }}>{urg}</span>
                </div>
                <div className="px-3 pb-2 text-[10px] text-muted-foreground flex gap-3 flex-wrap">
                  {r.landPrep && <span>ไถ {fmtDateTh(r.landPrep)}</span>}
                  {r.transplantPlan && <span>ปลูกแผน {fmtDateTh(r.transplantPlan)} {dl!==null?`(${dl>0?'อีก '+dl+' วัน':dl===0?'วันนี้!':'เกิน '+(Math.abs(dl))+' วัน'})`:''}</span>}
                  <span>ต้องทำอีก {sl} ขั้น</span>
                </div>
                {/* Progress dots */}
                <div className="px-3 pb-2 flex gap-1">
                  {Array.from({length:4},(_,i)=>(
                    <div key={i} className="flex-1 h-1 rounded-full"
                      style={{ background: i < (4-sl) ? STEP_COLORS[i] : 'var(--border)' }}/>
                  ))}
                </div>
                {isOpen && (
                  <div className="px-3 py-2.5 border-t border-border bg-muted/20 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-[11px]">
                    {[['CP No.',r.cpNo],['พืช',r.crop],['แปลง',r.plot],
                      ['พื้นที่',r.areaSqm?`${r.areaSqm.toLocaleString()} m²`:'—'],
                      ['วันไถดิน',fmtDateTh(r.landPrep)],['ปลูก (แผน)',fmtDateTh(r.transplantPlan)],
                      ['ถาดกล้า',r.seedlingTray||'—'],['จำนวนถาด',r.seedlingQty?String(r.seedlingQty):'—'],
                    ].map(([lbl,val])=>(
                      <div key={lbl}><div className="text-[10px] text-muted-foreground">{lbl}</div><div className="font-medium mt-0.5">{val}</div></div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
