'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase, type CropPlan, type Field, type Worker, type Machine, fmtDate, isOverdue } from '@/lib/supabase';

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

export default function ReportsPage() {
  const [plans,    setPlans]    = useState<CropPlan[]>([]);
  const [fields,   setFields]   = useState<Field[]>([]);
  const [workers,  setWorkers]  = useState<Worker[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [year,     setYear]     = useState(2026);

  useEffect(() => {
    Promise.all([
      supabase.from('crop_plans').select('*'),
      supabase.from('fields').select('*').eq('is_active', true),
      supabase.from('workers').select('*'),
      supabase.from('machines').select('*'),
    ]).then(([{data:cp},{data:f},{data:w},{data:m}]) => {
      setPlans(cp||[]);
      setFields(f||[]);
      setWorkers(w||[]);
      setMachines(m||[]);
      setLoading(false);
    });
  }, []);

  const yPlans = useMemo(() => plans.filter(p => p.year === year), [plans, year]);

  // 1. Field status summary (from crop_plans)
  const fieldStatusSummary = useMemo(() => {
    const counts: Record<string,number> = {};
    fields.forEach(f => {
      const fp = plans.filter(p => p.field_code === f.field_code && p.status !== 'Harvested');
      const st = fp.length > 0 ? (isOverdue(fp[0]) ? 'Overdue' : fp[0].status) : 'Empty';
      counts[st] = (counts[st]||0) + 1;
    });
    return Object.entries(counts).sort(([a],[b]) => a.localeCompare(b));
  }, [fields, plans]);

  // 2. Crop plan summary by status
  const cpSummary = useMemo(() => {
    const statuses = ['Planned','Preparing','Ready','Planted','Harvested'] as const;
    return statuses.map(s => ({
      status: s,
      count: yPlans.filter(p => p.status === s).length,
    }));
  }, [yPlans]);

  // 3. Delayed plans (overdue)
  const delayed = useMemo(() =>
    yPlans
      .filter(p => isOverdue(p))
      .sort((a,b) => (a.required_ready_date||'').localeCompare(b.required_ready_date||'')),
  [yPlans]);

  // 4. Machine utilization
  const machineUtil = useMemo(() => {
    const statusCount: Record<string,number> = { Available:0, Working:0, Maintenance:0 };
    machines.filter(m=>m.is_active!==false).forEach(m => {
      const s = m.status || 'Available';
      statusCount[s] = (statusCount[s]||0) + 1;
    });
    return statusCount;
  }, [machines]);

  const totalFields = fields.length || 1;
  const totalCP     = yPlans.length || 1;

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
          <h1 className="text-base font-bold">Reports</h1>
          <p className="text-[11px] text-muted-foreground">Summary view · {fields.length} fields · {yPlans.length} crop plans ({year})</p>
        </div>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Field Status Summary */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-[12px] font-semibold mb-3">Field Status Summary</div>
          <div className="space-y-2">
            {fieldStatusSummary.map(([status, count]) => (
              <div key={status} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background: COLORS[status]||'#94a3b8'}}/>
                <div className="w-20 text-[11px]">{status}</div>
                <Bar pct={Math.round(count/totalFields*100)} color={COLORS[status]||'#94a3b8'}/>
                <div className="text-[11px] font-semibold w-8 text-right">{count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Crop Plan Summary */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-[12px] font-semibold mb-3">Crop Plan Summary — {year}</div>
          <div className="space-y-2">
            {cpSummary.map(({status, count}) => (
              <div key={status} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background: COLORS[status]}}/>
                <div className="w-20 text-[11px]">{status}</div>
                <Bar pct={Math.round(count/totalCP*100)} color={COLORS[status]}/>
                <div className="text-[11px] font-semibold w-8 text-right">{count}</div>
              </div>
            ))}
            <div className="pt-2 border-t border-border flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-red-500"/>
              <div className="w-20 text-[11px]">Overdue</div>
              <Bar pct={Math.round(delayed.length/totalCP*100)} color="#ef4444"/>
              <div className="text-[11px] font-bold text-red-600 w-8 text-right">{delayed.length}</div>
            </div>
          </div>
        </div>

        {/* 3. Delayed Fields */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-[12px] font-semibold mb-3 flex items-center gap-2">
            <span className="text-red-600">⚠ Delayed Fields</span>
            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">{delayed.length}</span>
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
                    <span className="text-red-600 font-semibold text-[10px]">{dl}d late</span>
                    <span className="text-[9px] text-muted-foreground">{fmtDate(p.required_ready_date)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. Machine & Worker Summary */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-[12px] font-semibold mb-3">Machine & Worker Summary</div>
          <div className="space-y-1 mb-4">
            {Object.entries(machineUtil).map(([s, n]) => {
              const col = s==='Available'?'#22c55e':s==='Working'?'#3b82f6':'#f59e0b';
              return (
                <div key={s} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background:col}}/>
                  <div className="w-24 text-[11px]">{s}</div>
                  <Bar pct={machines.length ? Math.round(n/machines.length*100) : 0} color={col}/>
                  <div className="text-[11px] font-semibold w-6 text-right">{n}</div>
                </div>
              );
            })}
          </div>
          <div className="pt-3 border-t border-border grid grid-cols-2 gap-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-[#155d31]">{workers.filter(w=>w.is_active!==false).length}</div>
              <div className="text-[10px] text-muted-foreground">Active Workers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[#155d31]">{machines.filter(m=>m.is_active!==false).length}</div>
              <div className="text-[10px] text-muted-foreground">Active Machines</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
