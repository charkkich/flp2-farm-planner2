'use client';

import { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase, type CropPlan, STATUS_COLORS, RISK_COLORS, getRiskLevel, fmtDateShort, daysUntil, getPlanRowColor, getPlanPriority } from '@/lib/supabase';

const YEARS = [2026,2025,2024,2023];
const STATUS_OPTS = ['all','Planned','Preparing','Ready','Planted','Overdue'];

function PlanningInner() {
  const searchParams = useSearchParams();
  const [plans, setPlans] = useState<CropPlan[]>([]);
  const [weather, setWeather] = useState<{[date:string]:number}>({});
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(2026);
  const [statusFilter, setStatusFilter] = useState(searchParams?.get('status')||'all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string|null>(null);

  const load = useCallback(async () => {
    const [{ data: cp }, wxRes] = await Promise.all([
      supabase.from('crop_plans').select('*').order('required_ready_date',{nullsLast:true}),
      fetch('https://api.open-meteo.com/v1/forecast?latitude=18.7&longitude=98.9&daily=precipitation_probability_max&timezone=Asia%2FBangkok&forecast_days=14').then(r=>r.json()).catch(()=>null),
    ]);
    setPlans(cp||[]);
    if (wxRes?.daily) {
      const wx: {[d:string]:number} = {};
      (wxRes.daily.time as string[]).forEach((dt:string,i:number)=>{
        wx[dt] = wxRes.daily.precipitation_probability_max[i]??0;
      });
      setWeather(wx);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const today = useMemo(()=>{ const d=new Date();d.setHours(0,0,0,0);return d; },[]);

  const filtered = useMemo(()=>plans
    .map(p=>{
      if (!['Ready','Planted','Harvested'].includes(p.status)&&p.required_ready_date&&new Date(p.required_ready_date+'T00:00:00')<today)
        return {...p,status:'Overdue' as const};
      return p;
    })
    .filter(p=>{
      if (p.year!==year) return false;
      if (p.status==='Harvested') return false;
      if (statusFilter!=='all'&&p.status!==statusFilter) return false;
      if (search) {
        const q=search.toLowerCase();
        return (p.cp_no||'').toLowerCase().includes(q)||(p.field_code||'').toLowerCase().includes(q)||(p.crop_name||'').toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a,b)=>{
      const pa=a.status==='Overdue'?0:a.status==='Preparing'?1:a.status==='Planned'?2:3;
      const pb=b.status==='Overdue'?0:b.status==='Preparing'?1:b.status==='Planned'?2:3;
      if(pa!==pb) return pa-pb;
      return (a.required_ready_date||'9999')<(b.required_ready_date||'9999')?-1:1;
    }),
  [plans,year,statusFilter,search,today]);

  // Rain risk for a plan's plant date
  function rainRisk(p: CropPlan): number {
    if (!p.planned_plant_date) return 0;
    const d = new Date(p.planned_plant_date+'T00:00:00');
    // Check 3 days around plant date
    let maxProb = 0;
    for (let i=-1;i<=1;i++){
      const dd = new Date(d);dd.setDate(d.getDate()+i);
      const key = dd.toISOString().split('T')[0];
      if (weather[key]>maxProb) maxProb=weather[key];
    }
    return maxProb;
  }

  if (loading) return (
    <div className="p-4 animate-pulse space-y-3">
      <div className="h-8 w-48 bg-muted rounded"/><div className="space-y-1">{[...Array(10)].map((_,i)=><div key={i} className="h-12 bg-muted rounded"/>)}</div>
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-base font-bold">Preparation Planning</h1>
          <p className="text-[11px] text-muted-foreground">
            {filtered.length} plans · 
            <span className="text-red-500 mx-1">{filtered.filter(p=>p.status==='Overdue').length} overdue</span>·
            <span className="text-amber-500 mx-1">{filtered.filter(p=>{ const dl=daysUntil(p.required_ready_date); return dl!==null&&dl>=0&&dl<=7&&p.status!=='Ready'; }).length} at risk</span>
          </p>
        </div>
        <div className="flex gap-1">
          {YEARS.map(y=>(
            <button key={y} onClick={()=>{setYear(y);setStatusFilter('all');}}
              className={['px-2.5 py-1 rounded text-[11px] font-medium border',y===year?'bg-[#155d31] text-white border-[#155d31]':'border-border text-muted-foreground'].join(' ')}>
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-3 text-[10px] flex-wrap">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border-l-2 border-red-500"/><span className="text-red-600">Overdue</span></span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-50 border-l-2 border-yellow-400"/><span className="text-amber-600">At Risk (≤7 days)</span></span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-transparent border-l-2 border-green-600"/><span className="text-muted-foreground">On Schedule</span></span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input type="text" placeholder="Search field / CP / crop…" value={search}
          onChange={e=>setSearch(e.target.value)}
          className="h-7 px-2.5 rounded border border-border bg-card text-[11px] w-52 focus:outline-none focus:ring-1 focus:ring-[#155d31]"/>
        <div className="flex gap-1 flex-wrap">
          {STATUS_OPTS.map(s=>{
            const cnt = s==='all'?filtered.length:filtered.filter(p=>p.status===s).length;
            return (
              <button key={s} onClick={()=>setStatusFilter(s)}
                className={['px-2 py-1 rounded text-[10px] border',statusFilter===s?'bg-[#155d31] text-white border-[#155d31]':'border-border text-muted-foreground'].join(' ')}>
                {s==='all'?'All':s} ({cnt})
              </button>
            );
          })}
        </div>
      </div>

      {/* Planning table */}
      <div className="rounded-lg border border-border overflow-hidden text-[11px]">
        <div className="hidden lg:grid px-3 py-2 bg-muted/40 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wide gap-2"
          style={{gridTemplateColumns:'80px 110px 130px 100px 100px 80px 70px 80px 70px'}}>
          <div>Field</div><div>CP No</div><div>Crop</div><div>Plant Date</div>
          <div>Ready Date</div><div>Days Left</div><div>Status</div>
          <div>Rain Risk</div><div>Priority</div>
        </div>
        <div className="divide-y divide-border">
          {filtered.length===0
            ? <div className="py-10 text-center text-muted-foreground">No plans</div>
            : filtered.map(p=>{
              const rowBg = getPlanRowColor(p);
              const st = STATUS_COLORS[p.status]||STATUS_COLORS['Planned'];
              const dl = daysUntil(p.required_ready_date);
              const rr = rainRisk(p);
              const rl = getRiskLevel(rr);
              const rStyle = RISK_COLORS[rl];
              const prio = getPlanPriority(p);
              const prioStyle = prio==='High'?{bg:'#fee2e2',text:'#dc2626'}:prio==='Medium'?{bg:'#fef3c7',text:'#d97706'}:{bg:'#dcfce7',text:'#15803d'};
              const isOpen=expanded===p.id;
              return (
                <div key={p.id}>
                  {/* Desktop */}
                  <div className="hidden lg:grid px-3 py-2 items-center gap-2 cursor-pointer hover:opacity-90"
                    style={{gridTemplateColumns:'80px 110px 130px 100px 100px 80px 70px 80px 70px',background:rowBg||undefined}}
                    onClick={()=>setExpanded(isOpen?null:p.id)}>
                    <div className="font-mono font-semibold">{p.field_code}</div>
                    <div className="text-muted-foreground text-[10px]">{p.cp_no}</div>
                    <div className="truncate">{p.crop_name}</div>
                    <div>{fmtDateShort(p.planned_plant_date)}</div>
                    <div>{fmtDateShort(p.required_ready_date)}</div>
                    <div className={dl!==null&&dl<0?'text-red-500 font-semibold':dl!==null&&dl<=7?'text-amber-500 font-medium':''}>
                      {dl!==null?(dl===0?'Today':dl>0?`${dl}d`:`${-dl}d OV`):'—'}
                    </div>
                    <div><span className="px-1.5 py-0.5 rounded-full text-[10px]" style={{background:st.bg,color:st.text}}>{p.status}</span></div>
                    <div>{rr>0?<span className="px-1.5 py-0.5 rounded-full text-[10px]" style={{background:rStyle.bg,color:rStyle.text}}>{rr}%</span>:<span className="text-muted-foreground">—</span>}</div>
                    <div><span className="px-1.5 py-0.5 rounded-full text-[10px]" style={{background:prioStyle.bg,color:prioStyle.text}}>{prio}</span></div>
                  </div>
                  {/* Mobile */}
                  <div className="lg:hidden px-3 py-2 cursor-pointer" style={{background:rowBg||undefined}}
                    onClick={()=>setExpanded(isOpen?null:p.id)}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-[12px]">{p.field_code}</span>
                      <span className="flex-1 text-[10px] truncate text-muted-foreground">{p.crop_name}</span>
                      <span className="px-1.5 py-0.5 rounded-full text-[10px]" style={{background:st.bg,color:st.text}}>{p.status}</span>
                    </div>
                    <div className="flex gap-3 text-[10px] text-muted-foreground mt-0.5 flex-wrap">
                      <span>{p.cp_no}</span>
                      {p.planned_plant_date&&<span>🌱 {fmtDateShort(p.planned_plant_date)}</span>}
                      {p.required_ready_date&&<span>⏰ Ready {fmtDateShort(p.required_ready_date)}</span>}
                      {rr>0&&<span style={{color:rStyle.text}}>🌧 {rr}%</span>}
                    </div>
                  </div>
                  {isOpen&&(
                    <div className="px-4 py-3 border-t border-border bg-card/50 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-[11px]">
                      {[
                        ['Field',p.field_code||'—'],['CP No',p.cp_no],['Crop',p.crop_name||'—'],
                        ['Area',p.area_m2?`${p.area_m2.toLocaleString()} m²`:'—'],
                        ['Plant Date',fmtDateShort(p.planned_plant_date)],
                        ['Required Ready',fmtDateShort(p.required_ready_date)],
                        ['Land Prep',fmtDateShort(p.land_prep_date)],
                        ['Status',p.status],
                        ['Rain Risk',rr>0?`${rr}% (${rl})`:'Low'],
                        ['Priority',prio],
                      ].map(([l,v])=>(
                        <div key={l}><div className="text-[10px] text-muted-foreground">{l}</div><div className="font-medium mt-0.5">{v}</div></div>
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

export default function PlanningPage() {
  return (
    <Suspense fallback={<div className="p-4 animate-pulse"><div className="h-8 w-48 bg-muted rounded"/></div>}>
      <PlanningInner />
    </Suspense>
  );
}
