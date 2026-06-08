'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase, type CropPlan, isOverdue, daysUntil, fmtDate } from '@/lib/supabase';

export default function Dashboard() {
  const [plans, setPlans]   = useState<CropPlan[]>([]);
  const [weather, setWeather] = useState<{date:string;rain:number;mm:number}[]>([]);
  const [workerCount, setWorkerCount]   = useState(0);
  const [machineCount, setMachineCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(2026);

  useEffect(() => {
    Promise.all([
      supabase.from('crop_plans').select('*').eq('year', year),
      supabase.from('workers').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('machines').select('id', { count: 'exact', head: true }).eq('is_active', true),
      fetch('https://api.open-meteo.com/v1/forecast?latitude=18.992&longitude=98.972&daily=precipitation_probability_max,precipitation_sum&timezone=Asia%2FBangkok&forecast_days=14')
        .then(r => r.json()).catch(() => null),
    ]).then(([{ data: cp }, wRes, mRes, wx]) => {
      setPlans(cp || []);
      setWorkerCount((wRes as any).count || 0);
      setMachineCount((mRes as any).count || 0);
      if (wx?.daily) {
        setWeather(wx.daily.time.map((d: string, i: number) => ({
          date: d,
          rain: wx.daily.precipitation_probability_max[i] || 0,
          mm:   wx.daily.precipitation_sum[i] || 0,
        })));
      }
      setLoading(false);
    });
  }, [year]);

  const kpi = useMemo(() => {
    const active = plans.filter(p => p.status !== 'Harvested');
    const total     = active.length;
    const preparing = active.filter(p => p.status === 'Preparing').length;
    const ready     = active.filter(p => p.status === 'Ready').length;
    const delayed   = active.filter(p => isOverdue(p)).length;
    const onTime    = total > 0 ? Math.round((total - delayed) / total * 100) : 100;
    return { total, preparing, ready, delayed, onTime };
  }, [plans]);

  const priorityTasks = useMemo(() => {
    return plans
      .filter(p => !['Planted', 'Harvested'].includes(p.status))
      .map(p => ({ ...p, dl: daysUntil(p.required_ready_date), ov: isOverdue(p) }))
      .sort((a, b) => {
        if (a.ov && !b.ov) return -1;
        if (!a.ov && b.ov) return 1;
        return (a.dl ?? 999) - (b.dl ?? 999);
      })
      .slice(0, 25);
  }, [plans]);

  const pipeline = useMemo(() => {
    const list = ['Planned','Preparing','Ready','Planted','Harvested'] as const;
    return list.map(s => ({
      s, n: plans.filter(p => p.status === s).length,
      pct: plans.length ? Math.round(plans.filter(p=>p.status===s).length / plans.length * 100) : 0,
    }));
  }, [plans]);

  const upcoming = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const d14   = new Date(today); d14.setDate(today.getDate() + 14);
    const items = plans.filter(p => {
      if (['Planted','Harvested'].includes(p.status)) return false;
      const pd = p.plant_date || p.planned_plant_date;
      if (!pd) return false;
      const dt = new Date(pd + 'T00:00:00');
      return dt >= today && dt <= d14;
    });
    const grouped: Record<string, CropPlan[]> = {};
    items.forEach(p => {
      const k = (p.plant_date || p.planned_plant_date)!;
      if (!grouped[k]) grouped[k] = [];
      grouped[k].push(p);
    });
    return Object.entries(grouped).sort(([a],[b]) => a.localeCompare(b));
  }, [plans]);

  const rainyDays = weather.filter(w => w.rain > 70);

  const PIPE_COLOR: Record<string,string> = {
    Planned:'#94a3b8', Preparing:'#f59e0b', Ready:'#22c55e', Planted:'#3b82f6', Harvested:'#a16207',
  };

  if (loading) return (
    <div className="p-4 animate-pulse space-y-4">
      <div className="grid grid-cols-5 gap-3">{[...Array(5)].map((_,i)=><div key={i} className="h-20 bg-muted rounded-lg"/>)}</div>
      <div className="grid grid-cols-3 gap-4"><div className="col-span-2 h-64 bg-muted rounded-lg"/><div className="h-64 bg-muted rounded-lg"/></div>
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-base font-bold">Operations Center</h1>
          <p className="text-[11px] text-muted-foreground">
            FLP2 Farm · {new Date().toLocaleDateString('th-TH',{dateStyle:'full'})} · {workerCount} workers · {machineCount} machines
          </p>
        </div>
        <div className="flex gap-1">
          {[2026,2025,2024,2023].map(y => (
            <button key={y} onClick={() => setYear(y)}
              className={['px-2.5 py-1 rounded text-[11px] font-medium border',
                y===year?'bg-[#155d31] text-white border-[#155d31]':'border-border text-muted-foreground'].join(' ')}>
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Section A – Executive KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label:'Total CP',   value: kpi.total,         color:'text-foreground',  bg:'bg-card' },
          { label:'Preparing',  value: kpi.preparing,     color:'text-amber-600',   bg:'bg-amber-50/60' },
          { label:'Ready',      value: kpi.ready,         color:'text-green-700',   bg:'bg-green-50/60' },
          { label:'Delayed',    value: kpi.delayed,       color:kpi.delayed>0?'text-red-600':'text-green-700', bg:kpi.delayed>0?'bg-red-50/60':'bg-card' },
          { label:'On-Time %',  value:`${kpi.onTime}%`,   color:kpi.onTime>=90?'text-green-700':'text-amber-600', bg:'bg-card' },
        ].map(k => (
          <div key={k.label} className={`${k.bg} border border-border rounded-lg p-3`}>
            <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Section B – Priority Tasks */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <span className="text-[12px] font-semibold">🎯 Today's Priority Tasks</span>
            <span className="text-[10px] text-muted-foreground">{priorityTasks.length} active</span>
          </div>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-muted/80">
                <tr className="text-[10px] text-muted-foreground uppercase">
                  <th className="px-3 py-1.5 text-left">Field</th>
                  <th className="px-3 py-1.5 text-left">CP No</th>
                  <th className="px-3 py-1.5 text-left">Crop</th>
                  <th className="px-3 py-1.5 text-left">Ready Date</th>
                  <th className="px-3 py-1.5 text-center">Days Left</th>
                  <th className="px-3 py-1.5 text-center">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {priorityTasks.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground text-[11px]">✓ No active tasks</td></tr>
                ) : priorityTasks.map((p: any) => {
                  const col  = p.ov ? '#dc2626' : p.dl!=null&&p.dl<=3 ? '#d97706' : '#15803d';
                  const badge = p.ov ? 'Overdue' : p.dl!=null&&p.dl<=3 ? 'Urgent' : 'OK';
                  const bbg  = p.ov ? '#fee2e2'  : p.dl!=null&&p.dl<=3 ? '#fef3c7' : '#dcfce7';
                  return (
                    <tr key={p.id} className={`hover:bg-muted/20 ${p.ov?'bg-red-50/40':''}`}>
                      <td className="px-3 py-1.5 font-mono font-semibold">{p.field_code||'—'}</td>
                      <td className="px-3 py-1.5 text-muted-foreground text-[10px]">{p.cp_no||'—'}</td>
                      <td className="px-3 py-1.5">{p.crop_name||'—'}</td>
                      <td className="px-3 py-1.5">{fmtDate(p.required_ready_date)}</td>
                      <td className="px-3 py-1.5 text-center font-semibold" style={{color:col}}>
                        {p.dl!=null ? (p.dl<0 ? `${Math.abs(p.dl)}d late` : `${p.dl}d`) : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                          style={{background:bbg, color:col}}>{badge}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Section C – Pipeline */}
          <div className="bg-card border border-border rounded-lg p-3">
            <div className="text-[12px] font-semibold mb-3">📊 Preparation Pipeline</div>
            <div className="space-y-2">
              {pipeline.map(({s,n,pct}) => (
                <div key={s}>
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span className="text-muted-foreground">{s}</span>
                    <span className="font-medium">{n} <span className="text-muted-foreground">({pct}%)</span></span>
                  </div>
                  <div className="h-2 bg-muted rounded overflow-hidden">
                    <div className="h-full rounded transition-all" style={{width:`${pct}%`, background: PIPE_COLOR[s]}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section E – Weather (compact) */}
          <div className="bg-card border border-border rounded-lg p-3">
            <div className="text-[12px] font-semibold mb-2">🌤 Weather (14 days)</div>
            {weather.length === 0 ? (
              <div className="text-[11px] text-muted-foreground text-center py-2">Loading…</div>
            ) : rainyDays.length === 0 ? (
              <div className="text-[11px] text-green-600 font-medium text-center py-2">☀️ No heavy rain expected</div>
            ) : (
              <div className="space-y-1">
                {rainyDays.map(w => (
                  <div key={w.date} className="flex justify-between items-center text-[10px] bg-blue-50 rounded px-2 py-1">
                    <span className="font-semibold text-blue-700">{fmtDate(w.date)}</span>
                    <span className="text-blue-600">{w.rain}% · {w.mm.toFixed(1)}mm</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section D – Upcoming Planting */}
      {upcoming.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-border">
            <span className="text-[12px] font-semibold">📅 Upcoming Planting — Next 14 Days</span>
          </div>
          <div className="divide-y divide-border">
            {upcoming.map(([date, items]) => (
              <div key={date} className="flex gap-4 px-3 py-2 items-start">
                <div className="flex-shrink-0 w-20">
                  <div className="text-[11px] font-semibold">{fmtDate(date)}</div>
                  <div className="text-[9px] text-muted-foreground">{items.length} field{items.length>1?'s':''}</div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {items.map(p => (
                    <span key={p.id} className="px-2 py-0.5 bg-muted rounded text-[10px]">
                      <span className="font-mono font-semibold">{p.field_code}</span>
                      {p.crop_name && <span className="text-muted-foreground ml-1">· {p.crop_name}</span>}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
