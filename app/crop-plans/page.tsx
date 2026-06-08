'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase, type CropPlan, type Worker, type Machine, STATUS_COLORS, fmtDate, daysUntil, isOverdue } from '@/lib/supabase';

const YEARS  = [2026,2025,2024,2023];
const STAGES = ['Planned','Plowing','Harrowing','Ridging','Ready','Planted','Harvested'];

// Progress bar component
function ProgressBar({ plan }: { plan: CropPlan }) {
  const stage =
    plan.status === 'Harvested' ? 'Harvested' :
    plan.status === 'Planted'   ? 'Planted'   :
    plan.status === 'Ready'     ? 'Ready'      :
    plan.status === 'Preparing' ? (plan.preparation_stage || 'Plowing') :
    'Planned';
  const idx = STAGES.indexOf(stage);
  const pct = Math.round(idx / (STAGES.length - 1) * 100);
  const bg =
    plan.status === 'Harvested' ? '#a16207' :
    plan.status === 'Planted'   ? '#1d4ed8' :
    plan.status === 'Ready'     ? '#15803d' : '#d97706';
  return (
    <div className="flex items-center gap-1.5 w-full">
      <div className="flex-1 h-1.5 bg-muted rounded overflow-hidden">
        <div className="h-full rounded transition-all" style={{width:`${pct}%`, background: bg}}/>
      </div>
      <span className="text-[9px] text-muted-foreground w-14 flex-shrink-0 text-right truncate">{stage}</span>
    </div>
  );
}

export default function CropPlansPage() {
  const [plans,    setPlans]    = useState<CropPlan[]>([]);
  const [workers,  setWorkers]  = useState<Worker[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [year,     setYear]     = useState(2026);
  const [cropF,    setCropF]    = useState('all');
  const [fieldF,   setFieldF]   = useState('');
  const [statusF,  setStatusF]  = useState('all');
  const [editP,    setEditP]    = useState<CropPlan|null>(null);
  const [creating, setCreating] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [form, setForm] = useState({
    cp_no:'', crop_name:'', field_code:'', plant_date:'',
    status:'Planned', preparation_stage:'',
    assigned_worker_id:'', assigned_machine_id:'',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: cp }, { data: w }, { data: m }] = await Promise.all([
      supabase.from('crop_plans').select('*').order('required_ready_date', { ascending: true, nullsFirst: false }),
      supabase.from('workers').select('*').eq('is_active', true).order('worker_name'),
      supabase.from('machines').select('*').eq('is_active', true).order('machine_code'),
    ]);
    setPlans(cp||[]);
    setWorkers(w||[]);
    setMachines(m||[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const crops  = useMemo(() => Array.from(new Set(plans.map(p=>p.crop_name).filter((c): c is string => c !== null))).sort(), [plans]);

  const filtered = useMemo(() => {
    return plans
      .filter(p => {
        if (p.year !== year) return false;
        if (cropF !== 'all' && p.crop_name !== cropF) return false;
        if (fieldF && !p.field_code?.toLowerCase().includes(fieldF.toLowerCase())) return false;
        const ov  = isOverdue(p);
        const eff = ov ? 'Overdue' : p.status;
        if (statusF !== 'all' && eff !== statusF) return false;
        return true;
      })
      .map(p => ({ ...p, _ov: isOverdue(p) }))
      .sort((a, b) => {
        if (a._ov && !b._ov) return -1;
        if (!a._ov && b._ov) return 1;
        return (a.required_ready_date||'9999').localeCompare(b.required_ready_date||'9999');
      });
  }, [plans, year, cropF, fieldF, statusF]);

  const kpi = useMemo(() => {
    const y = plans.filter(p => p.year === year);
    return {
      total:     y.length,
      preparing: y.filter(p=>p.status==='Preparing').length,
      ready:     y.filter(p=>p.status==='Ready').length,
      planted:   y.filter(p=>p.status==='Planted').length,
      overdue:   y.filter(p=>isOverdue(p)).length,
    };
  }, [plans, year]);

  async function save() {
    setSaving(true);
    const pd = form.plant_date || null;
    const rrd = pd ? (() => {
      const d = new Date(pd + 'T00:00:00');
      d.setDate(d.getDate() - 14);
      return d.toISOString().split('T')[0];
    })() : null;

    const payload: Record<string, unknown> = {
      cp_no:                form.cp_no || null,
      crop_name:            form.crop_name || null,
      field_code:           form.field_code || null,
      plant_date:           pd,
      planned_plant_date:   pd,
      required_ready_date:  rrd,
      status:               form.status,
      preparation_stage:    form.status === 'Preparing' ? (form.preparation_stage||null) : null,
      assigned_worker_id:   form.assigned_worker_id  || null,
      assigned_machine_id:  form.assigned_machine_id || null,
    };
    if (!editP) payload.year = year;

    if (editP) {
      await supabase.from('crop_plans').update(payload).eq('id', editP.id);
    } else {
      await supabase.from('crop_plans').insert(payload);
    }
    setSaving(false); setEditP(null); setCreating(false); load();
  }

  function openEdit(p: CropPlan) {
    setEditP(p); setCreating(false);
    setForm({
      cp_no:               p.cp_no||'',
      crop_name:           p.crop_name||'',
      field_code:          p.field_code||'',
      plant_date:          p.plant_date||p.planned_plant_date||'',
      status:              p.status,
      preparation_stage:   p.preparation_stage||'',
      assigned_worker_id:  p.assigned_worker_id||'',
      assigned_machine_id: p.assigned_machine_id||'',
    });
  }

  if (loading) return (
    <div className="p-4 animate-pulse space-y-2">
      {[...Array(10)].map((_,i)=><div key={i} className="h-10 bg-muted rounded"/>)}
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-base font-bold">Crop Plans</h1>
          <p className="text-[11px] text-muted-foreground">{filtered.length} shown</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="flex gap-1">
            {YEARS.map(y => (
              <button key={y} onClick={() => setYear(y)}
                className={['px-2.5 py-1 rounded text-[11px] border',
                  y===year?'bg-[#155d31] text-white border-[#155d31]':'border-border text-muted-foreground'].join(' ')}>
                {y}
              </button>
            ))}
          </div>
          <button
            onClick={() => { setCreating(true); setEditP(null); setForm({cp_no:'',crop_name:'',field_code:'',plant_date:'',status:'Planned',preparation_stage:'',assigned_worker_id:'',assigned_machine_id:''}); }}
            className="px-3 py-1.5 rounded bg-[#155d31] text-white text-[11px] font-medium">
            + Add CP
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-5 gap-2">
        {[
          {l:'Total',    v:kpi.total,     c:'text-foreground'},
          {l:'Preparing',v:kpi.preparing, c:'text-amber-600'},
          {l:'Ready',    v:kpi.ready,     c:'text-green-700'},
          {l:'Planted',  v:kpi.planted,   c:'text-blue-600'},
          {l:'Overdue',  v:kpi.overdue,   c:'text-red-600'},
        ].map(k => (
          <div key={k.l} className="bg-card border border-border rounded-lg px-3 py-2">
            <div className={`text-xl font-bold ${k.c}`}>{k.v}</div>
            <div className="text-[10px] text-muted-foreground">{k.l}</div>
          </div>
        ))}
      </div>

      {/* Form */}
      {(creating || editP) && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="text-[12px] font-semibold">{editP ? `Edit: ${editP.cp_no||'CP'}` : 'New Crop Plan'}</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {([['CP No','cp_no','text'],['Crop Name','crop_name','text'],['Field Code','field_code','text'],['Plant Date','plant_date','date']] as [string,string,string][]).map(([l,k,t]) => (
              <div key={k}>
                <label className="text-[11px] text-muted-foreground block mb-1">{l}</label>
                <input type={t} value={(form as any)[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}
                  className="w-full h-8 px-2 rounded border border-border bg-background text-[11px] focus:outline-none focus:ring-1 focus:ring-[#155d31]"/>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Status</label>
              <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}
                className="w-full h-8 px-2 rounded border border-border bg-background text-[11px]">
                {['Planned','Preparing','Ready','Planted','Harvested'].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            {form.status === 'Preparing' && (
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">Stage</label>
                <select value={form.preparation_stage} onChange={e=>setForm(f=>({...f,preparation_stage:e.target.value}))}
                  className="w-full h-8 px-2 rounded border border-border bg-background text-[11px]">
                  <option value="">Select stage…</option>
                  {['Plowing','Harrowing','Ridging'].map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Assign Worker</label>
              <select value={form.assigned_worker_id} onChange={e=>setForm(f=>({...f,assigned_worker_id:e.target.value}))}
                className="w-full h-8 px-2 rounded border border-border bg-background text-[11px]">
                <option value="">— None —</option>
                {workers.map(w=><option key={w.id} value={w.id}>{w.worker_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Assign Machine</label>
              <select value={form.assigned_machine_id} onChange={e=>setForm(f=>({...f,assigned_machine_id:e.target.value}))}
                className="w-full h-8 px-2 rounded border border-border bg-background text-[11px]">
                <option value="">— None —</option>
                {machines.map(m=><option key={m.id} value={m.id}>{m.machine_code}{m.machine_name?` · ${m.machine_name}`:''}</option>)}
              </select>
            </div>
          </div>
          {form.plant_date && (
            <p className="text-[10px] text-muted-foreground">
              Required ready date: <strong>
                {(() => {
                  const d = new Date(form.plant_date + 'T00:00:00');
                  d.setDate(d.getDate()-14);
                  return fmtDate(d.toISOString().split('T')[0]);
                })()}
              </strong> (plant date − 14 days)
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="px-4 py-1.5 rounded bg-[#155d31] text-white text-[11px] font-medium disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => { setEditP(null); setCreating(false); }}
              className="px-4 py-1.5 rounded border border-border text-[11px]">Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <input placeholder="Field…" value={fieldF} onChange={e=>setFieldF(e.target.value)}
          className="h-7 px-2 rounded border border-border bg-card text-[11px] w-28 focus:outline-none"/>
        <select value={cropF} onChange={e=>setCropF(e.target.value)}
          className="h-7 px-2 rounded border border-border bg-card text-[11px]">
          <option value="all">All Crops</option>
          {crops.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        {['all','Planned','Preparing','Ready','Planted','Harvested','Overdue'].map(s => (
          <button key={s} onClick={()=>setStatusF(s)}
            className={['px-2 py-1 rounded text-[10px] border',
              statusF===s?'bg-[#155d31] text-white border-[#155d31]':'border-border text-muted-foreground'].join(' ')}>
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden text-[11px]">
        <div className="hidden lg:grid px-3 py-2 bg-muted/40 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wide gap-2"
          style={{gridTemplateColumns:'100px 80px 140px 100px 110px 80px 170px 50px'}}>
          <div>CP No</div><div>Field</div><div>Crop</div>
          <div>Plant Date</div><div>Ready Date</div><div>Status</div>
          <div>Progress</div><div></div>
        </div>
        <div className="divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-[12px] text-muted-foreground">No plans found</div>
          ) : (filtered as any[]).map(p => {
            const sc  = STATUS_COLORS[p.status as keyof typeof STATUS_COLORS] || STATUS_COLORS['Planned'];
            const dl  = daysUntil(p.required_ready_date);
            const ov  = p._ov;
            const effSt = ov ? 'Overdue' : p.status;
            return (
              <div key={p.id}
                className={`grid px-3 py-2 items-center gap-2 hover:bg-muted/20 ${ov?'bg-red-50/30':''}`}
                style={{gridTemplateColumns:'100px 80px 140px 100px 110px 80px 170px 50px'}}>
                <div className="font-mono text-[10px] font-medium">{p.cp_no||'—'}</div>
                <div className="font-mono">{p.field_code||'—'}</div>
                <div className="truncate">{p.crop_name||'—'}</div>
                <div className="text-[10px]">{fmtDate(p.plant_date||p.planned_plant_date)}</div>
                <div className="text-[10px]">
                  <div>{fmtDate(p.required_ready_date)}</div>
                  {dl !== null && !['Planted','Harvested','Ready'].includes(p.status) && (
                    <div className={`text-[9px] font-medium ${ov?'text-red-600':dl<=3?'text-amber-600':'text-muted-foreground'}`}>
                      {ov ? `${Math.abs(dl)}d late` : `${dl}d left`}
                    </div>
                  )}
                  {['Planted','Harvested'].includes(p.status) && (
                    <div className="text-[9px] text-blue-600 font-medium">Completed</div>
                  )}
                </div>
                <div>
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold"
                    style={{background: ov?'#fee2e2':sc.bg, color: ov?'#dc2626':sc.text}}>
                    {effSt}
                  </span>
                </div>
                <div><ProgressBar plan={p}/></div>
                <div>
                  <button onClick={() => openEdit(p)}
                    className="text-[10px] px-2 py-1 rounded border border-border hover:bg-muted">Edit</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
