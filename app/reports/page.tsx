'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase, type CropPlan, type Field, type Worker, type Machine, type WorkOrder, fmtDate, isOverdue } from '@/lib/supabase';
import { useLang } from '@/components/providers';
import { translations } from '@/lib/i18n';

const COLORS: Record<string,string> = {
  Planned:'#94a3b8', Preparing:'#f59e0b', Ready:'#22c55e',
  Planted:'#3b82f6', Harvested:'#a16207', Empty:'#e2e8f0', Overdue:'#ef4444',
};

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex-1 h-2 bg-muted rounded overflow-hidden">
      <div className="h-full rounded transition-all" style={{width:`${pct}%`, background: color}}/>
    </div>
  );
}

function downloadCSV(filename: string, rows: string[][], header: string[]) {
  const lines = [header, ...rows].map(r => r.map(c => `"${(c||'').replace(/"/g,'""')}"`).join(','));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  a.click(); URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { lang } = useLang();
  const t = translations[lang];
  const r = t.reports;

  const [plans,      setPlans]      = useState<CropPlan[]>([]);
  const [fields,     setFields]     = useState<Field[]>([]);
  const [workers,    setWorkers]    = useState<Worker[]>([]);
  const [machines,   setMachines]   = useState<Machine[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [year,       setYear]       = useState(2026);

  useEffect(() => {
    Promise.all([
      supabase.from('crop_plans').select('*'),
      supabase.from('fields').select('*').eq('is_active', true),
      supabase.from('workers').select('*').eq('is_active', true),
      supabase.from('machines').select('*').eq('is_active', true),
      supabase.from('work_orders').select('*'),
    ]).then(([{data:cp},{data:f},{data:w},{data:m},{data:wo}]) => {
      setPlans(cp||[]);
      setFields(f||[]);
      setWorkers(w||[]);
      setMachines(m||[]);
      setWorkOrders(wo||[]);
      setLoading(false);
    });
  }, []);

  const yPlans = useMemo(() => plans.filter(p => p.year === year), [plans, year]);

  const fieldStatusSummary = useMemo(() => {
    const counts: Record<string,number> = {};
    fields.forEach(f => {
      const fp = plans.filter(p => p.field_code === f.field_code && p.status !== 'Harvested');
      const st = fp.length > 0 ? (isOverdue(fp[0]) ? 'Overdue' : fp[0].status) : 'Empty';
      counts[st] = (counts[st]||0) + 1;
    });
    return Object.entries(counts).sort(([a],[b]) => a.localeCompare(b));
  }, [fields, plans]);

  const cpSummary = useMemo(() => {
    const statuses = ['Planned','Preparing','Ready','Planted','Harvested'] as const;
    return statuses.map(s => ({ status: s, count: yPlans.filter(p => p.status === s).length }));
  }, [yPlans]);

  const delayed = useMemo(() =>
    yPlans
      .filter(p => isOverdue(p))
      .sort((a,b) => (a.required_ready_date||'').localeCompare(b.required_ready_date||'')),
  [yPlans]);

  // Worker KPI from work_orders
  const workerKPI = useMemo(() => {
    const map: Record<string,{name:string;code:string;completed:number;onTime:number;late:number}> = {};
    workers.forEach(w => { map[w.id] = {name:w.worker_name, code:w.worker_code||'',completed:0,onTime:0,late:0}; });
    workOrders.filter(o => o.status==='Completed' && o.assigned_worker_id).forEach(o => {
      const wid = o.assigned_worker_id!;
      if (!map[wid]) map[wid] = {name:wid,code:'',completed:0,onTime:0,late:0};
      map[wid].completed++;
      const isOT = !o.planned_date || !o.actual_date ||
        new Date(o.actual_date+'T00:00:00') <= new Date(o.planned_date+'T00:00:00');
      if (isOT) map[wid].onTime++; else map[wid].late++;
    });
    return Object.values(map)
      .filter(v => v.completed > 0)
      .map(v => ({ ...v, pct: Math.round(v.onTime/v.completed*100) }))
      .sort((a,b) => b.pct - a.pct);
  }, [workers, workOrders]);

  // Machine utilization
  const machineUtil = useMemo(() => {
    const map: Record<string,{name:string;code:string;total:number;completed:number}> = {};
    machines.forEach(m => { map[m.id] = {name:m.machine_name||m.machine_code,code:m.machine_code,total:0,completed:0}; });
    workOrders.filter(o => o.assigned_machine_id && o.status!=='Cancelled').forEach(o => {
      const mid = o.assigned_machine_id!;
      if (!map[mid]) map[mid] = {name:mid,code:'',total:0,completed:0};
      map[mid].total++;
      if (o.status==='Completed') map[mid].completed++;
    });
    return Object.values(map)
      .map(v => ({ ...v, pct: v.total>0 ? Math.round(v.completed/v.total*100):0 }))
      .sort((a,b) => b.total - a.total);
  }, [machines, workOrders]);

  const totalFields = fields.length || 1;
  const totalCP     = yPlans.length || 1;

  // CSV exports
  function exportFieldStatus() {
    downloadCSV(`field_status_${year}.csv`,
      fieldStatusSummary.map(([s,n]) => [s, String(n), `${Math.round(n/totalFields*100)}%`]),
      ['Status', 'Count', 'Percentage']);
  }
  function exportDelayed() {
    downloadCSV(`delayed_fields_${year}.csv`,
      delayed.map(p => {
        const dl = Math.abs(Math.round((new Date().setHours(0,0,0,0) - new Date(p.required_ready_date!+'T00:00:00').getTime())/86400000));
        return [p.field_code||'', p.cp_no||'', p.crop_name||'', p.required_ready_date||'', String(dl)];
      }),
      ['Field', 'CP No', 'Crop', 'Ready Date', 'Days Late']);
  }
  function exportWorkerKPI() {
    downloadCSV(`worker_kpi.csv`,
      workerKPI.map(w => [w.code, w.name, String(w.completed), String(w.onTime), String(w.late), `${w.pct}%`]),
      ['Code', 'Name', 'Completed', 'On Time', 'Late', 'On-Time %']);
  }
  function exportMachineUtil() {
    downloadCSV(`machine_utilization.csv`,
      machineUtil.map(m => [m.code, m.name, String(m.total), String(m.completed), `${m.pct}%`]),
      ['Code', 'Name', 'Total Jobs', 'Completed', 'Utilization %']);
  }
  function exportAllCSV() {
    exportFieldStatus(); exportDelayed(); exportWorkerKPI(); exportMachineUtil();
  }

  if (loading) return (
    <div className="p-4 animate-pulse space-y-4">
      {[...Array(4)].map((_,i)=><div key={i} className="h-40 bg-muted rounded-lg"/>)}
    </div>
  );

  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-base font-bold">{r.title}</h1>
          <p className="text-[11px] text-muted-foreground">{fields.length} fields · {yPlans.length} crop plans ({year})</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportAllCSV}
            className="h-8 px-3 rounded bg-[#155d31] text-white text-[11px] font-medium hover:bg-[#0f4424]">
            ⬇ {r.exportAll}
          </button>
          <div className="flex gap-1">
            {[2026,2025,2024,2023].map(y => (
              <button key={y} onClick={() => setYear(y)}
                className={['px-2.5 py-1 rounded text-[11px] border',
                  y===year?'bg-[#155d31] text-white border-[#155d31]':'border-border text-muted-foreground'].join(' ')}>
                {y}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Field Status Summary */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[12px] font-semibold">{r.fieldSummary}</div>
            <button onClick={exportFieldStatus} className="text-[10px] text-muted-foreground hover:text-foreground border border-border rounded px-2 py-0.5">
              CSV ↓
            </button>
          </div>
          <div className="space-y-2">
            {fieldStatusSummary.map(([status, count]) => (
              <div key={status} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background: COLORS[status]||'#94a3b8'}}/>
                <div className="w-20 text-[11px]">{(t.status as any)[status] || status}</div>
                <Bar pct={Math.round(count/totalFields*100)} color={COLORS[status]||'#94a3b8'}/>
                <div className="text-[11px] font-semibold w-8 text-right">{count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Crop Plan Summary */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-[12px] font-semibold mb-3">{r.cpSummary} — {year}</div>
          <div className="space-y-2">
            {cpSummary.map(({status, count}) => (
              <div key={status} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background: COLORS[status]}}/>
                <div className="w-20 text-[11px]">{(t.status as any)[status] || status}</div>
                <Bar pct={Math.round(count/totalCP*100)} color={COLORS[status]}/>
                <div className="text-[11px] font-semibold w-8 text-right">{count}</div>
              </div>
            ))}
            <div className="pt-2 border-t border-border flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-red-500"/>
              <div className="w-20 text-[11px]">{t.status.Overdue}</div>
              <Bar pct={Math.round(delayed.length/totalCP*100)} color="#ef4444"/>
              <div className="text-[11px] font-bold text-red-600 w-8 text-right">{delayed.length}</div>
            </div>
          </div>
        </div>

        {/* 3. Delayed Fields */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[12px] font-semibold flex items-center gap-2">
              <span className="text-red-600">⚠ {r.delayed}</span>
              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">{delayed.length}</span>
            </div>
            <button onClick={exportDelayed} className="text-[10px] text-muted-foreground hover:text-foreground border border-border rounded px-2 py-0.5">
              CSV ↓
            </button>
          </div>
          {delayed.length === 0 ? (
            <div className="text-[11px] text-green-600 font-medium text-center py-6">✓ No delayed fields</div>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {delayed.map(p => {
                const dl = Math.abs(Math.round(
                  (new Date().setHours(0,0,0,0) - new Date(p.required_ready_date!+'T00:00:00').getTime()) / 86400000
                ));
                return (
                  <div key={p.id} className="flex items-center gap-2 text-[11px] bg-red-50/60 rounded px-2 py-1.5">
                    <span className="font-mono font-bold w-16">{p.field_code}</span>
                    <span className="flex-1 text-muted-foreground truncate">{p.crop_name}</span>
                    <span className="text-red-600 font-semibold text-[10px]">{dl}{r.daysLate}</span>
                    <span className="text-[9px] text-muted-foreground">{fmtDate(p.required_ready_date)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. Worker Performance */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[12px] font-semibold">👷 {r.workerPerf}</div>
            <button onClick={exportWorkerKPI} className="text-[10px] text-muted-foreground hover:text-foreground border border-border rounded px-2 py-0.5">
              CSV ↓
            </button>
          </div>
          {workerKPI.length === 0 ? (
            <div className="text-[11px] text-muted-foreground text-center py-6">No work order data yet</div>
          ) : (
            <div className="space-y-2">
              {workerKPI.map((w, i) => (
                <div key={w.name} className="flex items-center gap-2 text-[11px]">
                  <span className="w-5 text-center text-muted-foreground text-[10px]">{i+1}</span>
                  <span className="flex-1 truncate font-medium">{w.name}</span>
                  <span className="text-muted-foreground text-[10px]">{w.completed}j</span>
                  <div className="w-20">
                    <div className="flex justify-between text-[9px] mb-0.5">
                      <span/>
                      <span style={{color: w.pct>=90?'#15803d':w.pct>=70?'#d97706':'#dc2626'}}>{w.pct}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded overflow-hidden">
                      <div className="h-full rounded" style={{
                        width:`${w.pct}%`,
                        background: w.pct>=90?'#22c55e':w.pct>=70?'#f59e0b':'#ef4444'
                      }}/>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 5. Machine Utilization */}
        <div className="bg-card border border-border rounded-lg p-4 md:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[12px] font-semibold">🚜 {r.machineUtil}</div>
            <button onClick={exportMachineUtil} className="text-[10px] text-muted-foreground hover:text-foreground border border-border rounded px-2 py-0.5">
              CSV ↓
            </button>
          </div>
          {machineUtil.filter(m => m.total > 0).length === 0 ? (
            <div className="text-[11px] text-muted-foreground text-center py-4">No work order data yet</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {machineUtil.filter(m => m.total > 0).map(m => (
                <div key={m.name} className="border border-border rounded-lg p-2.5 text-center">
                  <div className="text-[11px] font-semibold truncate">{m.name}</div>
                  <div className="text-2xl font-bold mt-1" style={{color: m.pct>=80?'#15803d':m.pct>=50?'#d97706':'#dc2626'}}>
                    {m.pct}%
                  </div>
                  <div className="text-[10px] text-muted-foreground">{m.completed}/{m.total} jobs</div>
                  <div className="mt-1.5 h-1.5 bg-muted rounded overflow-hidden">
                    <div className="h-full rounded" style={{
                      width:`${m.pct}%`,
                      background: m.pct>=80?'#22c55e':m.pct>=50?'#f59e0b':'#ef4444'
                    }}/>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-[#155d31]">{workers.length}</div>
              <div className="text-[10px] text-muted-foreground">Active Workers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[#155d31]">{machines.length}</div>
              <div className="text-[10px] text-muted-foreground">Active Machines</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
