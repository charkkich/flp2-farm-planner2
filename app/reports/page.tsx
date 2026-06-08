'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase, type CropPlan } from '@/lib/supabase';

const MONTH_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

export default function ReportsPage() {
  const [plans, setPlans] = useState<CropPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview'|'crops'|'calendar'|'accuracy'>('overview');
  const [year, setYear] = useState(2025);

  useEffect(() => {
    supabase.from('crop_plans').select('*').then(({ data }) => {
      setPlans(data || []);
      setLoading(false);
    });
  }, []);

  // ---- KPIs ----
  const kpi = useMemo(() => {
    const all = plans.filter(p => p.year === year);
    const harvested = all.filter(p => p.status === 'Harvested').length;
    const totalArea = all.reduce((s, p) => s + (p.area_m2 || 0), 0);
    const harvestedArea = all.filter(p=>p.status==='Harvested').reduce((s,p)=>s+(p.area_m2||0),0);

    // Plan vs actual accuracy
    const withActual = all.filter(p => p.planned_plant_date && p.actual_plant_date);
    const diffs = withActual.map(p => {
      const pl = new Date(p.planned_plant_date!+'T00:00:00');
      const ac = new Date(p.actual_plant_date!+'T00:00:00');
      return Math.round((ac.getTime()-pl.getTime())/86400000);
    });
    const avgDiff = diffs.length ? Math.round(diffs.reduce((s,d)=>s+d,0)/diffs.length) : 0;
    const onTime = diffs.filter(d=>Math.abs(d)<=3).length;
    const early = diffs.filter(d=>d<-3).length;
    const late = diffs.filter(d=>d>3).length;

    return { total: all.length, harvested, totalArea: Math.round(totalArea), harvestedArea: Math.round(harvestedArea),
      completionRate: all.length ? Math.round(harvested/all.length*100) : 0,
      avgDiff, onTime, early, late, withActual: withActual.length };
  }, [plans, year]);

  // ---- Crop breakdown ----
  const cropBreakdown = useMemo(() => {
    const all = plans.filter(p => p.year === year);
    const map: Record<string, {count:number;area:number}> = {};
    all.forEach(p => {
      const crops = (p.crop_name||'Unknown').split(',').map(c=>c.trim());
      crops.forEach(crop => {
        if (!map[crop]) map[crop] = {count:0,area:0};
        map[crop].count++;
        map[crop].area += (p.area_m2||0) / crops.length;
      });
    });
    return Object.entries(map)
      .map(([name,v])=>({name,count:v.count,area:Math.round(v.area)}))
      .sort((a,b)=>b.area-a.area)
      .slice(0,12);
  }, [plans, year]);

  // ---- Monthly calendar (planting count per month) ----
  const monthlyPlanned = useMemo(() => {
    return Array.from({length:12},(_,i)=>{
      const cnt = plans.filter(p=>p.year===year && p.planned_plant_date && new Date(p.planned_plant_date+'T00:00:00').getMonth()===i).length;
      return {month:i,count:cnt};
    });
  }, [plans, year]);

  // ---- Year comparison ----
  const yearSummary = useMemo(() => {
    return [2023,2024,2025,2026].map(y => {
      const all = plans.filter(p=>p.year===y);
      const harvested = all.filter(p=>p.status==='Harvested').length;
      const area = Math.round(all.reduce((s,p)=>s+(p.area_m2||0),0));
      return {year:y, count:all.length, harvested, area};
    });
  }, [plans]);

  // ---- Accuracy histogram ----
  const accuracyBuckets = useMemo(()=>{
    const all = plans.filter(p=>p.year===year&&p.planned_plant_date&&p.actual_plant_date);
    const buckets:{label:string;count:number;color:string}[] = [
      {label:'≤-7d',count:0,color:'#3b82f6'},
      {label:'-6 to -4',count:0,color:'#60a5fa'},
      {label:'-3 to 0',count:0,color:'#22c55e'},
      {label:'+1 to +3',count:0,color:'#84cc16'},
      {label:'+4 to +7',count:0,color:'#f59e0b'},
      {label:'≥+8d',count:0,color:'#ef4444'},
    ];
    all.forEach(p=>{
      const d = Math.round((new Date(p.actual_plant_date!+'T00:00:00').getTime()-new Date(p.planned_plant_date!+'T00:00:00').getTime())/86400000);
      if(d<=-7) buckets[0].count++;
      else if(d<=-4) buckets[1].count++;
      else if(d<=0) buckets[2].count++;
      else if(d<=3) buckets[3].count++;
      else if(d<=7) buckets[4].count++;
      else buckets[5].count++;
    });
    return buckets;
  },[plans,year]);

  const maxMonthly = Math.max(...monthlyPlanned.map(m=>m.count),1);
  const maxCropArea = Math.max(...cropBreakdown.map(c=>c.area),1);
  const maxAccuracy = Math.max(...accuracyBuckets.map(b=>b.count),1);

  const YEAR_COLORS: Record<number,string> = {2023:'#94a3b8',2024:'#60a5fa',2025:'#22c55e',2026:'#f59e0b'};

  if (loading) return (
    <div className="p-4 animate-pulse space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[...Array(4)].map((_,i)=><div key={i} className="h-16 bg-muted rounded-lg"/>)}</div>
      <div className="h-48 bg-muted rounded-lg"/>
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-base font-bold">Reports & KPI</h1>
          <p className="text-[11px] text-muted-foreground">Farm Lert Phan 2 · {plans.length.toLocaleString()} total records</p>
        </div>
        <div className="flex gap-1">
          {[2023,2024,2025,2026].map(y=>(
            <button key={y} onClick={()=>setYear(y)}
              className={['px-2.5 py-1 rounded text-[11px] font-medium border',y===year?'bg-[#155d31] text-white border-[#155d31]':'border-border text-muted-foreground'].join(' ')}>
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {l:'Total Plans',v:kpi.total,c:'text-foreground'},
          {l:'Harvested',v:kpi.harvested,c:'text-muted-foreground'},
          {l:'Completion',v:`${kpi.completionRate}%`,c:'text-[#155d31]'},
          {l:'Total Area',v:`${(kpi.totalArea/10000).toFixed(1)} ha`,c:'text-sky-500'},
        ].map(k=>(
          <div key={k.l} className="bg-card border border-border rounded-lg px-3 py-2.5 text-center">
            <div className={`text-xl font-semibold ${k.c}`}>{k.v}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{k.l}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {([['overview','📊 Overview'],['crops','🌿 Crops'],['calendar','📅 Calendar'],['accuracy','🎯 Accuracy']] as const).map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            className={['px-3 py-2 text-[11px] font-medium border-b-2 -mb-px transition-colors',
              tab===k?'border-[#155d31] text-[#155d31]':'border-transparent text-muted-foreground hover:text-foreground'].join(' ')}>
            {l}
          </button>
        ))}
      </div>

      {/* TAB: Overview */}
      {tab==='overview'&&(
        <div className="space-y-4">
          {/* Year comparison */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-border text-[11px] font-semibold">Year Over Year Comparison</div>
            <div className="p-3 space-y-2">
              {yearSummary.map(y=>{
                const maxCount = Math.max(...yearSummary.map(s=>s.count),1);
                return (
                  <div key={y.year} className="flex items-center gap-2">
                    <div className="w-10 text-[11px] font-medium">{y.year}</div>
                    <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                      <div className="h-full rounded flex items-center px-2"
                        style={{width:`${Math.round(y.count/maxCount*100)}%`,background:YEAR_COLORS[y.year]}}>
                        <span className="text-[9px] font-medium text-white/90 truncate">{y.count} plans</span>
                      </div>
                    </div>
                    <div className="w-20 text-right text-[10px] text-muted-foreground">
                      {y.harvested}/{y.count}
                    </div>
                    <div className="w-20 text-right text-[10px] text-muted-foreground">
                      {(y.area/10000).toFixed(1)} ha
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Plan vs Actual summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {l:'Avg Deviation',v:`${kpi.avgDiff>0?'+':''}${kpi.avgDiff}d`,c:Math.abs(kpi.avgDiff)<=3?'text-[#155d31]':'text-amber-500'},
              {l:'On Time (±3d)',v:`${kpi.withActual?Math.round(kpi.onTime/kpi.withActual*100):0}%`,c:'text-[#155d31]'},
              {l:'Early (>3d)',v:kpi.early,c:'text-sky-500'},
              {l:'Late (>3d)',v:kpi.late,c:'text-red-500'},
            ].map(k=>(
              <div key={k.l} className="bg-card border border-border rounded-lg px-3 py-2.5 text-center">
                <div className={`text-xl font-semibold ${k.c}`}>{k.v}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{k.l}</div>
              </div>
            ))}
          </div>

          {/* Status breakdown */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-border text-[11px] font-semibold">Status Breakdown — {year}</div>
            <div className="p-3">
              {(() => {
                const all = plans.filter(p=>p.year===year);
                const groups = [
                  {s:'Harvested',c:'#475569',bg:'#f1f5f9'},
                  {s:'Planted',c:'#065f46',bg:'#d1fae5'},
                  {s:'Ready',c:'#15803d',bg:'#dcfce7'},
                  {s:'Preparing',c:'#0369a1',bg:'#e0f2fe'},
                  {s:'Planned',c:'#7c3aed',bg:'#ede9fe'},
                ];
                return groups.map(g=>{
                  const cnt = all.filter(p=>p.status===g.s).length;
                  const pct = all.length ? Math.round(cnt/all.length*100) : 0;
                  return (
                    <div key={g.s} className="flex items-center gap-2 mb-1.5">
                      <div className="w-20 text-[10px]" style={{color:g.c}}>{g.s}</div>
                      <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                        <div className="h-full rounded" style={{width:`${pct}%`,background:g.bg,border:`1px solid ${g.c}33`}}/>
                      </div>
                      <div className="w-14 text-right text-[10px] text-muted-foreground">{cnt} ({pct}%)</div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* TAB: Crops */}
      {tab==='crops'&&(
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-border text-[11px] font-semibold">Top Crops by Area — {year}</div>
          <div className="p-3 space-y-2">
            {cropBreakdown.map((c,i)=>(
              <div key={c.name} className="flex items-center gap-2">
                <div className="w-4 text-[10px] text-muted-foreground">{i+1}</div>
                <div className="w-36 text-[11px] truncate">{c.name}</div>
                <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                  <div className="h-full rounded flex items-center px-1.5"
                    style={{width:`${Math.round(c.area/maxCropArea*100)}%`,background:'#155d3133',border:'0.5px solid #155d31'}}>
                    <span className="text-[9px] text-[#155d31] font-medium truncate">{c.area.toLocaleString()} m²</span>
                  </div>
                </div>
                <div className="w-12 text-right text-[10px] text-muted-foreground">{c.count}×</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: Calendar */}
      {tab==='calendar'&&(
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-border text-[11px] font-semibold">Monthly Planting Count — {year}</div>
            <div className="p-3 space-y-1.5">
              {monthlyPlanned.map(m=>(
                <div key={m.month} className="flex items-center gap-2">
                  <div className="w-10 text-[11px] text-muted-foreground">{MONTH_TH[m.month]}</div>
                  <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                    {m.count>0&&<div className="h-full rounded flex items-center px-1.5"
                      style={{width:`${Math.round(m.count/maxMonthly*100)}%`,background:'#0369a1',}}>
                      <span className="text-[9px] text-white font-medium">{m.count}</span>
                    </div>}
                  </div>
                  <div className="w-10 text-right text-[10px] text-muted-foreground">{m.count}</div>
                </div>
              ))}
            </div>
          </div>

          {/* All-years heatmap */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-border text-[11px] font-semibold">Multi-Year Monthly Heatmap</div>
            <div className="p-3 overflow-x-auto">
              <table className="text-[10px] w-full">
                <thead>
                  <tr>
                    <th className="text-left pr-2 text-muted-foreground font-normal w-12">Year</th>
                    {MONTH_TH.map(m=><th key={m} className="text-center text-muted-foreground font-normal px-0.5 w-8">{m}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[2023,2024,2025,2026].map(y=>(
                    <tr key={y}>
                      <td className="pr-2 font-medium py-1" style={{color:YEAR_COLORS[y]}}>{y}</td>
                      {Array.from({length:12},(_,i)=>{
                        const cnt = plans.filter(p=>p.year===y&&p.planned_plant_date&&new Date(p.planned_plant_date+'T00:00:00').getMonth()===i).length;
                        const intensity = Math.min(1, cnt/30);
                        return (
                          <td key={i} className="px-0.5 py-1 text-center">
                            <div className="w-7 h-6 rounded text-center flex items-center justify-center text-[9px] font-medium mx-auto"
                              style={{background:cnt>0?`rgba(21,93,49,${0.1+intensity*0.8})`:'transparent',color:cnt>0?'white':'transparent'}}>
                              {cnt||''}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: Accuracy */}
      {tab==='accuracy'&&(
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-border text-[11px] font-semibold">
              Planting Date Accuracy — {year}
              <span className="text-muted-foreground font-normal ml-1">({kpi.withActual} records with actual date)</span>
            </div>
            <div className="p-3 space-y-2">
              {accuracyBuckets.map(b=>(
                <div key={b.label} className="flex items-center gap-2">
                  <div className="w-16 text-[11px] text-center font-mono">{b.label}</div>
                  <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                    {b.count>0&&<div className="h-full rounded flex items-center px-1.5"
                      style={{width:`${Math.round(b.count/maxAccuracy*100)}%`,background:b.color}}>
                      <span className="text-[10px] text-white font-medium">{b.count}</span>
                    </div>}
                  </div>
                  <div className="w-16 text-right text-[10px] text-muted-foreground">
                    {kpi.withActual?Math.round(b.count/kpi.withActual*100):0}%
                  </div>
                </div>
              ))}
            </div>
            <div className="px-3 pb-3 text-[10px] text-muted-foreground">
              Negative = planted early | Positive = planted late | ±3 days = On Time
            </div>
          </div>

          {/* Top late fields */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-border text-[11px] font-semibold">Most Delayed Plans ({year})</div>
            <div className="divide-y divide-border">
              {plans
                .filter(p=>p.year===year&&p.planned_plant_date&&p.actual_plant_date)
                .map(p=>({...p,diff:Math.round((new Date(p.actual_plant_date!+'T00:00:00').getTime()-new Date(p.planned_plant_date!+'T00:00:00').getTime())/86400000)}))
                .sort((a,b)=>b.diff-a.diff)
                .slice(0,8)
                .map(p=>(
                  <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 text-[11px]">
                    <span className="font-mono w-16 font-semibold">{p.field_code}</span>
                    <span className="flex-1 truncate text-muted-foreground">{p.crop_name}</span>
                    <span className="font-mono tabular-nums" style={{color:(p as any).diff>0?'#dc2626':'#15803d'}}>
                      {(p as any).diff>0?'+':''}{(p as any).diff}d
                    </span>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
