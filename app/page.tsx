'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase, type CropPlan, type Worker, type Machine, type WorkOrder, isOverdue, daysUntil, fmtDate } from '@/lib/supabase';
import { useLang } from '@/components/providers';
import { translations } from '@/lib/i18n';

export default function Dashboard() {
  const { lang } = useLang();
  const t  = translations[lang];
  const d  = t.dashboard;

  const [plans,       setPlans]       = useState<CropPlan[]>([]);
  const [workers,     setWorkers]     = useState<Worker[]>([]);
  const [machines,    setMachines]    = useState<Machine[]>([]);
  const [workOrders,  setWorkOrders]  = useState<WorkOrder[]>([]);
  const [weather,     setWeather]     = useState<{date:string;rain:number;mm:number}[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [year,        setYear]        = useState(2026);

  useEffect(() => {
    Promise.all([
      supabase.from('crop_plans').select('*').eq('year', year),
      supabase.from('workers').select('*').eq('is_active', true),
      supabase.from('machines').select('*').eq('is_active', true),
      supabase.from('work_orders').select('*'),
      fetch('https://api.open-meteo.com/v1/forecast?latitude=18.992&longitude=98.972&daily=precipitation_probability_max,precipitation_sum&timezone=Asia%2FBangkok&forecast_days=14')
        .then(r => r.json()).catch(() => null),
    ]).then(([{ data: cp }, { data: w }, { data: m }, { data: wo }, wx]) => {
      setPlans(cp || []);
      setWorkers(w || []);
      setMachines(m || []);
      setWorkOrders(wo || []);
      if (wx?.daily) {
        setWeather(wx.daily.time.map((dt: string, i: number) => ({
          date: dt,
          rain: wx.daily.precipitation_probability_max[i] || 0,
          mm:   wx.daily.precipitation_sum[i] || 0,
        })));
      }
      setLoading(false);
    });
  }, [year]);

  // KPI
  const kpi = useMemo(() => {
    const active    = plans.filter(p => p.status !== 'Harvested');
    const total     = active.length;
    const preparing = active.filter(p => p.status === 'Preparing').length;
    const ready     = active.filter(p => p.status === 'Ready').length;
    const delayed   = active.filter(p => isOverdue(p)).length;
    const onTime    = total > 0 ? Math.round((total - delayed) / total * 100) : 100;
    return { total, preparing, ready, delayed, onTime };
  }, [plans]);

  // Priority tasks
  const priorityTasks = useMemo(() => {
    return plans
      .filter(p => !['Planted','Harvested'].includes(p.status))
      .map(p => ({ ...p, dl: daysUntil(p.required_ready_date), ov: isOverdue(p) }))
      .sort((a, b) => {
        if (a.ov && !b.ov) return -1;
        if (!a.ov && b.ov) return 1;
        return (a.dl ?? 999) - (b.dl ?? 999);
      })
      .slice(0, 20);
  }, [plans]);

  // Pipeline
  const pipeline = useMemo(() => {
    const list = ['Planned','Preparing','Ready','Planted','Harvested'] as const;
    return list.map(s => ({
      s, n: plans.filter(p => p.status === s).length,
      pct: plans.length ? Math.round(plans.filter(p=>p.status===s).length / plans.length * 100) : 0,
    }));
  }, [plans]);

  // Upcoming planting 14 days
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

  // Worker KPI from work_orders
  const workerKPI = useMemo(() => {
    const map: Record<string, { name: string; completed: number; onTime: number; late: number }> = {};
    workers.forEach(w => {
      map[w.id] = { name: w.worker_name, completed: 0, onTime: 0, late: 0 };
    });
    workOrders
      .filter(o => o.status === 'Completed' && o.assigned_worker_id)
      .forEach(o => {
        const wid = o.assigned_worker_id!;
        if (!map[wid]) map[wid] = { name: wid, completed: 0, onTime: 0, late: 0 };
        map[wid].completed++;
        const isOT = !o.planned_date || !o.actual_date ||
          new Date(o.actual_date + 'T00:00:00') <= new Date(o.planned_date + 'T00:00:00');
        if (isOT) map[wid].onTime++;
        else map[wid].late++;
      });
    return Object.entries(map)
      .filter(([, v]) => v.completed > 0)
      .map(([id, v]) => ({
        id, ...v,
        pct: v.completed > 0 ? Math.round(v.onTime / v.completed * 100) : 0,
      }))
      .sort((a, b) => b.pct - a.pct || b.completed - a.completed)
      .slice(0, 5);
  }, [workers, workOrders]);

  // Machine KPI from work_orders
  const machineKPI = useMemo(() => {
    const map: Record<string, { name: string; total: number; completed: number }> = {};
    machines.forEach(m => {
      map[m.id] = { name: m.machine_name || m.machine_code, total: 0, completed: 0 };
    });
    workOrders
      .filter(o => o.assigned_machine_id && o.status !== 'Cancelled')
      .forEach(o => {
        const mid = o.assigned_machine_id!;
        if (!map[mid]) map[mid] = { name: mid, total: 0, completed: 0 };
        map[mid].total++;
        if (o.status === 'Completed') map[mid].completed++;
      });
    return Object.entries(map)
      .filter(([, v]) => v.total > 0)
      .map(([id, v]) => ({
        id, ...v,
        pct: v.total > 0 ? Math.round(v.completed / v.total * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [machines, workOrders]);

  // Delayed fields
  const delayedFields = useMemo(() => {
    return plans
      .filter(p => isOverdue(p))
      .map(p => ({ ...p, daysLate: Math.abs(daysUntil(p.required_ready_date) ?? 0) }))
      .sort((a, b) => b.daysLate - a.daysLate)
      .slice(0, 10);
  }, [plans]);

  const rainyDays = weather.filter(w => w.rain > 70);

  const PIPE_COLOR: Record<string, string> = {
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
          <h1 className="text-base font-bold">{d.title}</h1>
          <p className="text-[11px] text-muted-foreground">
            FLP2 Farm · {new Date().toLocaleDateString(lang==='th'?'th-TH':'en-GB',{dateStyle:'full'})}
            · {workers.length} {d.workers} · {machines.length} {d.machines}
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

      {/* ── Section A: KPI cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: d.totalCP,   value: kpi.total,       color: 'text-foreground',  bg: 'bg-card' },
          { label: d.preparing, value: kpi.preparing,   color: 'text-amber-600',   bg: 'bg-amber-50/60' },
          { label: d.ready,     value: kpi.ready,       color: 'text-green-700',   bg: 'bg-green-50/60' },
          { label: d.delayed,   value: kpi.delayed,     color: kpi.delayed>0?'text-red-600':'text-green-700', bg: kpi.delayed>0?'bg-red-50/60':'bg-card' },
          { label: d.onTimePct, value: `${kpi.onTime}%`,color: kpi.onTime>=90?'text-green-700':'text-amber-600', bg:'bg-card' },
        ].map(k => (
          <div key={k.label} className={`${k.bg} border border-border rounded-lg p-3`}>
            <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── Section B + right column ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* B: Priority Tasks */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <span className="text-[12px] font-semibold">🎯 {d.priorityTasks}</span>
            <span className="text-[10px] text-muted-foreground">{priorityTasks.length} {d.activeJobs}</span>
          </div>
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-muted/80">
                <tr className="text-[10px] text-muted-foreground uppercase">
                  <th className="px-3 py-1.5 text-left">{t.fields.code}</th>
                  <th className="px-3 py-1.5 text-left">{t.fields.cpNo}</th>
                  <th className="px-3 py-1.5 text-left">{t.fields.currentCrop}</th>
                  <th className="px-3 py-1.5 text-left">{t.fields.readyDate}</th>
                  <th className="px-3 py-1.5 text-center">{d.urgency}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {priorityTasks.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-muted-foreground text-[11px]">✓ No active tasks</td></tr>
                ) : priorityTasks.map((p: any) => {
                  const col  = p.ov ? '#dc2626' : p.dl!=null&&p.dl<=3 ? '#d97706' : '#15803d';
                  const bbg  = p.ov ? '#fee2e2'  : p.dl!=null&&p.dl<=3 ? '#fef3c7' : '#dcfce7';
                  const badge = p.ov ? `${Math.abs(p.dl)}${d.daysLate}` : p.dl!=null&&p.dl<=3 ? `${p.dl}${d.daysLeft}` : `${p.dl}${d.daysLeft}`;
                  return (
                    <tr key={p.id} className={`hover:bg-muted/20 ${p.ov?'bg-red-50/40':''}`}>
                      <td className="px-3 py-1.5 font-mono font-semibold">{p.field_code||'—'}</td>
                      <td className="px-3 py-1.5 text-muted-foreground text-[10px]">{p.cp_no||'—'}</td>
                      <td className="px-3 py-1.5 truncate max-w-[90px]">{p.crop_name||'—'}</td>
                      <td className="px-3 py-1.5">{fmtDate(p.required_ready_date)}</td>
                      <td className="px-3 py-1.5 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold" style={{background:bbg,color:col}}>
                          {badge}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column: Pipeline + Weather */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-lg p-3">
            <div className="text-[12px] font-semibold mb-3">📊 {d.pipeline}</div>
            <div className="space-y-2">
              {pipeline.map(({s,n,pct}) => (
                <div key={s}>
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span className="text-muted-foreground">{lang==='th'?(t.status as any)[s]||s:s}</span>
                    <span className="font-medium">{n} <span className="text-muted-foreground">({pct}%)</span></span>
                  </div>
                  <div className="h-2 bg-muted rounded overflow-hidden">
                    <div className="h-full rounded transition-all" style={{width:`${pct}%`, background: PIPE_COLOR[s]}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-3">
            <div className="text-[12px] font-semibold mb-2">🌤 {d.weather}</div>
            {weather.length === 0 ? (
              <div className="text-[11px] text-muted-foreground text-center py-2">{t.common.loading}</div>
            ) : rainyDays.length === 0 ? (
              <div className="text-[11px] text-green-600 font-medium text-center py-2">{d.noHeavyRain}</div>
            ) : (
              <div className="space-y-1">
                {rainyDays.map(w => (
                  <div key={w.date} className="flex justify-between items-center text-[10px] bg-blue-50 dark:bg-blue-950/30 rounded px-2 py-1">
                    <span className="font-semibold text-blue-700 dark:text-blue-400">{fmtDate(w.date)}</span>
                    <span className="text-blue-600 dark:text-blue-400">{w.rain}% · {w.mm.toFixed(1)}mm</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Section D: Upcoming planting ────────────────────────────────────── */}
      {upcoming.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-border">
            <span className="text-[12px] font-semibold">📅 {d.upcoming}</span>
          </div>
          <div className="divide-y divide-border">
            {upcoming.map(([date, items]) => (
              <div key={date} className="flex gap-4 px-3 py-2 items-start">
                <div className="flex-shrink-0 w-20">
                  <div className="text-[11px] font-semibold">{fmtDate(date)}</div>
                  <div className="text-[9px] text-muted-foreground">{items.length} fields</div>
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

      {/* ── Section E+F: Worker KPI + Machine KPI ───────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Worker KPI */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-border">
            <span className="text-[12px] font-semibold">👷 {d.workerKPI}</span>
          </div>
          {workerKPI.length === 0 ? (
            <div className="py-8 text-center text-[11px] text-muted-foreground">
              {lang==='th'?'ยังไม่มีข้อมูลงาน':'No work order data yet'}
            </div>
          ) : (
            <div className="divide-y divide-border text-[11px]">
              {workerKPI.map((w, i) => (
                <div key={w.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="w-5 text-center font-bold text-[13px] text-muted-foreground">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{w.name}</div>
                    <div className="text-[10px] text-muted-foreground">{w.completed} {d.completedJobs}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold" style={{color: w.pct >= 90 ? '#15803d' : w.pct >= 70 ? '#d97706' : '#dc2626'}}>
                      {w.pct}%
                    </div>
                    <div className="text-[9px] text-muted-foreground">{d.onTime}</div>
                  </div>
                  <div className="w-16">
                    <div className="h-1.5 bg-muted rounded overflow-hidden">
                      <div className="h-full rounded" style={{
                        width:`${w.pct}%`,
                        background: w.pct >= 90 ? '#22c55e' : w.pct >= 70 ? '#f59e0b' : '#ef4444'
                      }}/>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Machine KPI */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-border">
            <span className="text-[12px] font-semibold">🚜 {d.machineKPI}</span>
          </div>
          {machineKPI.length === 0 ? (
            <div className="py-8 text-center text-[11px] text-muted-foreground">
              {lang==='th'?'ยังไม่มีข้อมูลงาน':'No work order data yet'}
            </div>
          ) : (
            <div className="divide-y divide-border text-[11px]">
              {machineKPI.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{m.name}</div>
                    <div className="text-[10px] text-muted-foreground">{m.completed}/{m.total} {d.jobs}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold" style={{color: m.pct >= 80 ? '#15803d' : m.pct >= 50 ? '#d97706' : '#dc2626'}}>
                      {m.pct}%
                    </div>
                    <div className="text-[9px] text-muted-foreground">{d.utilization}</div>
                  </div>
                  <div className="w-16">
                    <div className="h-1.5 bg-muted rounded overflow-hidden">
                      <div className="h-full rounded" style={{
                        width:`${m.pct}%`,
                        background: m.pct >= 80 ? '#22c55e' : m.pct >= 50 ? '#f59e0b' : '#ef4444',
                      }}/>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Section G: Delayed Fields ────────────────────────────────────────── */}
      {delayedFields.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex items-center gap-2">
            <span className="text-[12px] font-semibold text-red-600">⚠ {d.delayedFields}</span>
            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">{delayedFields.length}</span>
          </div>
          <div className="flex flex-wrap gap-2 p-3">
            {delayedFields.map(p => (
              <div key={p.id} className="px-3 py-2 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900 text-[11px]">
                <div className="font-mono font-bold text-red-700 dark:text-red-400">{p.field_code}</div>
                <div className="text-muted-foreground text-[10px]">{p.crop_name}</div>
                <div className="text-red-600 font-semibold text-[10px]">{p.daysLate}{d.daysLate}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
