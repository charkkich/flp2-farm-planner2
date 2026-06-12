'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase, type Worker, type WorkOrder } from '@/lib/supabase';
import { useLang } from '@/components/providers';
import { translations } from '@/lib/i18n';

export default function WorkersPage() {
  const { lang } = useLang();
  const t = translations[lang];
  const wt = t.workers;
  const cm = t.common;

  const [workers,    setWorkers]    = useState<Worker[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [tab,        setTab]        = useState<'list'|'kpi'>('list');
  const [editW,      setEditW]      = useState<Worker|null>(null);
  const [creating,   setCreating]   = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [form, setForm] = useState({ worker_code:'', worker_name:'', position:'', is_active: true });

  const load = useCallback(async () => {
    const [{ data: w }, { data: wo }] = await Promise.all([
      supabase.from('workers').select('*').order('worker_name'),
      supabase.from('work_orders').select('*').not('status','eq','Cancelled'),
    ]);
    setWorkers(w||[]);
    setWorkOrders(wo||[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true);
    const payload = {
      worker_code: form.worker_code.trim() || null,
      worker_name: form.worker_name.trim(),
      position:    form.position.trim() || null,
      is_active:   form.is_active,
    };
    if (editW) {
      await supabase.from('workers').update(payload).eq('id', editW.id);
    } else {
      await supabase.from('workers').insert(payload);
    }
    setSaving(false); setEditW(null); setCreating(false); load();
  }

  async function deactivate(w: Worker) {
    await supabase.from('workers').update({ is_active: false }).eq('id', w.id);
    load();
  }

  function openEdit(w: Worker) {
    setEditW(w); setCreating(false);
    setForm({ worker_code: w.worker_code||'', worker_name: w.worker_name, position: w.position||'', is_active: w.is_active !== false });
  }

  // Worker KPI
  const workerKPI = useMemo(() => {
    const map: Record<string, { name: string; code: string; position: string; completed: number; onTime: number; late: number; inProgress: number }> = {};
    workers.forEach(w => {
      map[w.id] = { name: w.worker_name, code: w.worker_code||'', position: w.position||'—', completed:0, onTime:0, late:0, inProgress:0 };
    });
    workOrders.forEach(o => {
      const wid = o.assigned_worker_id;
      if (!wid) return;
      if (!map[wid]) map[wid] = { name:wid, code:'', position:'—', completed:0, onTime:0, late:0, inProgress:0 };
      if (o.status === 'In Progress') map[wid].inProgress++;
      if (o.status === 'Completed') {
        map[wid].completed++;
        const isOT = !o.planned_date || !o.actual_date ||
          new Date(o.actual_date+'T00:00:00') <= new Date(o.planned_date+'T00:00:00');
        if (isOT) map[wid].onTime++; else map[wid].late++;
      }
    });
    return Object.values(map)
      .map(v => ({ ...v, pct: v.completed > 0 ? Math.round(v.onTime/v.completed*100) : null, total: v.completed+v.inProgress }))
      .sort((a,b) => (b.pct??-1) - (a.pct??-1) || b.total - a.total);
  }, [workers, workOrders]);

  const active   = workers.filter(w => w.is_active !== false);
  const inactive = workers.filter(w => w.is_active === false);

  if (loading) return (
    <div className="p-4 animate-pulse space-y-2">
      {[...Array(6)].map((_,i) => <div key={i} className="h-10 bg-muted rounded"/>)}
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-base font-bold">{wt.title}</h1>
          <p className="text-[11px] text-muted-foreground">{active.length} {cm.active} · {inactive.length} {cm.inactive}</p>
        </div>
        <div className="flex gap-2">
          {/* Tab toggle */}
          <div className="flex gap-1 border border-border rounded-lg p-0.5 bg-muted/30">
            {(['list','kpi'] as const).map(tb => (
              <button key={tb} onClick={() => setTab(tb)}
                className={['px-3 py-1 rounded text-[11px] font-medium transition-colors',
                  tab===tb?'bg-[#155d31] text-white':'text-muted-foreground hover:text-foreground'].join(' ')}>
                {tb==='list' ? wt.listTab : wt.kpiTab}
              </button>
            ))}
          </div>
          {tab === 'list' && (
            <button
              onClick={() => { setCreating(true); setEditW(null); setForm({worker_code:'',worker_name:'',position:'',is_active:true}); }}
              className="px-3 py-1.5 rounded bg-[#155d31] text-white text-[11px] font-medium">
              + {cm.add}
            </button>
          )}
        </div>
      </div>

      {tab === 'list' && (
        <>
          {/* Form */}
          {(creating || editW) && (
            <div className="bg-card border border-border rounded-lg p-4 space-y-3">
              <div className="text-[12px] font-semibold">{editW ? `${cm.edit}: ${editW.worker_name}` : `${cm.add} Worker`}</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">{wt.code}</label>
                  <input value={form.worker_code} onChange={e=>setForm(f=>({...f,worker_code:e.target.value}))}
                    placeholder="e.g. W001"
                    className="w-full h-8 px-2 rounded border border-border bg-background text-[11px] focus:outline-none focus:ring-1 focus:ring-[#155d31]"/>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">{wt.name} *</label>
                  <input value={form.worker_name} onChange={e=>setForm(f=>({...f,worker_name:e.target.value}))}
                    className="w-full h-8 px-2 rounded border border-border bg-background text-[11px] focus:outline-none focus:ring-1 focus:ring-[#155d31]"/>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">{wt.position}</label>
                  <input value={form.position} onChange={e=>setForm(f=>({...f,position:e.target.value}))}
                    placeholder="e.g. Field Operator"
                    className="w-full h-8 px-2 rounded border border-border bg-background text-[11px] focus:outline-none focus:ring-1 focus:ring-[#155d31]"/>
                </div>
              </div>
              <label className="flex items-center gap-2 text-[11px] cursor-pointer select-none">
                <input type="checkbox" checked={form.is_active} onChange={e=>setForm(f=>({...f,is_active:e.target.checked}))} className="rounded"/>
                {cm.active}
              </label>
              <div className="flex gap-2">
                <button onClick={save} disabled={saving || !form.worker_name.trim()}
                  className="px-4 py-1.5 rounded bg-[#155d31] text-white text-[11px] font-medium disabled:opacity-50">
                  {saving ? cm.saving : cm.save}
                </button>
                <button onClick={() => { setEditW(null); setCreating(false); }}
                  className="px-4 py-1.5 rounded border border-border text-[11px]">{cm.cancel}</button>
              </div>
            </div>
          )}

          {/* Workers table */}
          <div className="rounded-lg border border-border overflow-hidden text-[11px]">
            <div className="grid px-3 py-2 bg-muted/40 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wide gap-2"
              style={{gridTemplateColumns:'80px 1fr 160px 70px 80px'}}>
              <div>{wt.code}</div><div>{wt.name}</div><div>{wt.position}</div><div>{t.common.status}</div><div/>
            </div>
            <div className="divide-y divide-border">
              {workers.length === 0 ? (
                <div className="py-10 text-center text-[12px] text-muted-foreground">{cm.noData}</div>
              ) : workers.map(w => {
                const isAct = w.is_active !== false;
                return (
                  <div key={w.id}
                    className={`grid px-3 py-2.5 items-center gap-2 hover:bg-muted/20 ${!isAct?'opacity-50':''}`}
                    style={{gridTemplateColumns:'80px 1fr 160px 70px 80px'}}>
                    <div className="font-mono text-muted-foreground">{w.worker_code||'—'}</div>
                    <div className="font-medium">{w.worker_name}</div>
                    <div className="text-muted-foreground">{w.position||'—'}</div>
                    <div>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${isAct?'bg-[#dcfce7] text-[#15803d]':'bg-muted text-muted-foreground'}`}>
                        {isAct ? cm.active : cm.inactive}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(w)} className="text-[10px] px-2 py-1 rounded border border-border hover:bg-muted">{cm.edit}</button>
                      {isAct && (
                        <button onClick={() => deactivate(w)} className="text-[10px] px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50">{cm.delete}</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {tab === 'kpi' && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: wt.completedJobs, value: workerKPI.reduce((s,w)=>s+w.completed,0), color:'text-green-700' },
              { label: wt.onTime,        value: workerKPI.reduce((s,w)=>s+w.onTime,0),    color:'text-blue-600' },
              { label: wt.late,          value: workerKPI.reduce((s,w)=>s+w.late,0),       color:'text-red-600' },
              { label: 'In Progress',    value: workerKPI.reduce((s,w)=>s+w.inProgress,0), color:'text-amber-600' },
            ].map(k => (
              <div key={k.label} className="bg-card border border-border rounded-lg p-3">
                <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{k.label}</div>
              </div>
            ))}
          </div>

          {/* KPI Ranking table */}
          {workerKPI.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-[12px]">{wt.noJobs}</div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden text-[11px]">
              <div className="grid px-3 py-2 bg-muted/40 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wide gap-2"
                style={{gridTemplateColumns:'36px 70px 1fr 110px 70px 70px 70px 90px'}}>
                <div>{wt.ranking}</div>
                <div>{wt.code}</div>
                <div>{wt.name}</div>
                <div>{wt.position}</div>
                <div className="text-center">{wt.completedJobs}</div>
                <div className="text-center">{wt.onTime}</div>
                <div className="text-center">{wt.late}</div>
                <div className="text-center">{wt.onTimePct}</div>
              </div>
              <div className="divide-y divide-border">
                {workerKPI.map((w, i) => {
                  const pct = w.pct;
                  const pctColor = pct === null ? '#94a3b8' : pct >= 90 ? '#15803d' : pct >= 70 ? '#d97706' : '#dc2626';
                  const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}`;
                  return (
                    <div key={w.name}
                      className="grid px-3 py-2.5 items-center gap-2 hover:bg-muted/20"
                      style={{gridTemplateColumns:'36px 70px 1fr 110px 70px 70px 70px 90px'}}>
                      <div className="text-center text-[13px]">{medal}</div>
                      <div className="font-mono text-muted-foreground text-[10px]">{w.code||'—'}</div>
                      <div className="font-medium">{w.name}</div>
                      <div className="text-muted-foreground">{w.position}</div>
                      <div className="text-center font-semibold text-green-700">{w.completed}</div>
                      <div className="text-center text-blue-600">{w.onTime}</div>
                      <div className="text-center text-red-500">{w.late}</div>
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-1.5 bg-muted rounded overflow-hidden">
                          <div className="h-full rounded" style={{width:`${pct??0}%`, background:pctColor}}/>
                        </div>
                        <span className="text-[10px] font-bold w-8 text-right" style={{color:pctColor}}>
                          {pct !== null ? `${pct}%` : '—'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
