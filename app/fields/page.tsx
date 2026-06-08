'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase, type Field, type CropPlan, type Worker, type Machine, FIELD_STATUS_COLORS, fmtDate, isOverdue } from '@/lib/supabase';

const STATUS_OPTS = ['Planned','Preparing','Ready','Planted','Harvested'];
const FILTER_OPTS = ['all','Planned','Preparing','Ready','Planted','Harvested','Overdue','Empty'];

export default function FieldsPage() {
  const [fields,   setFields]   = useState<Field[]>([]);
  const [plans,    setPlans]    = useState<CropPlan[]>([]);
  const [workers,  setWorkers]  = useState<Worker[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [editF,    setEditF]    = useState<Field|null>(null);
  const [creating, setCreating] = useState(false);
  const [delConfirm, setDelConfirm] = useState<Field|null>(null);
  const [form, setForm] = useState({ field_code:'', area_m2:'', status:'Planned', notes:'' });
  const [saving, setSaving]   = useState(false);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('all');

  const load = useCallback(async () => {
    const [{ data: f }, { data: cp }, { data: w }, { data: m }] = await Promise.all([
      supabase.from('fields').select('*').eq('is_active', true).order('field_code'),
      supabase.from('crop_plans').select('*').not('status','eq','Harvested').order('required_ready_date', { ascending: true, nullsFirst: false }),
      supabase.from('workers').select('*').eq('is_active', true).order('worker_name'),
      supabase.from('machines').select('*').eq('is_active', true).order('machine_code'),
    ]);
    setFields(f||[]);
    setPlans(cp||[]);
    setWorkers(w||[]);
    setMachines(m||[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Current plan per field
  const planMap = useMemo(() => {
    const m: Record<string, CropPlan & { _overdue: boolean }> = {};
    fields.forEach(f => {
      const fp = plans.filter(p => p.field_code === f.field_code);
      if (fp.length > 0) {
        const active = fp.find(p => !['Planted','Harvested'].includes(p.status)) || fp[0];
        m[f.field_code] = { ...active, _overdue: isOverdue(active) };
      }
    });
    return m;
  }, [fields, plans]);

  const filtered = useMemo(() => {
    return fields.filter(f => {
      if (search && !f.field_code.toLowerCase().includes(search.toLowerCase())) return false;
      if (filter === 'all') return true;
      const p = planMap[f.field_code];
      const st = p?._overdue ? 'Overdue' : (p?.status || 'Empty');
      return st === filter;
    });
  }, [fields, search, filter, planMap]);

  async function save() {
    setSaving(true);
    const payload = {
      field_code: form.field_code.trim(),
      area_m2:    form.area_m2 ? Number(form.area_m2) : null,
      status:     form.status,
      notes:      form.notes || null,
    };
    if (editF) {
      await supabase.from('fields').update(payload).eq('id', editF.id);
    } else {
      await supabase.from('fields').insert({ ...payload, is_active: true });
    }
    setSaving(false); setEditF(null); setCreating(false); load();
  }

  async function softDelete(f: Field) {
    await supabase.from('fields').update({ is_active: false }).eq('id', f.id);
    setDelConfirm(null); load();
  }

  function openEdit(f: Field) {
    setEditF(f); setCreating(false);
    setForm({ field_code: f.field_code, area_m2: String(f.area_m2||''), status: f.status||'Planned', notes: f.notes||'' });
  }

  const statusCounts = useMemo(() => {
    const c: Record<string,number> = {};
    fields.forEach(f => {
      const p = planMap[f.field_code];
      const st = p?._overdue ? 'Overdue' : (p?.status || 'Empty');
      c[st] = (c[st]||0)+1;
    });
    return c;
  }, [fields, planMap]);

  if (loading) return (
    <div className="p-4 animate-pulse space-y-2">
      {[...Array(8)].map((_,i)=><div key={i} className="h-10 bg-muted rounded"/>)}
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-base font-bold">Fields</h1>
          <p className="text-[11px] text-muted-foreground">{fields.length} active fields · {filtered.length} shown</p>
        </div>
        <button
          onClick={() => { setCreating(true); setEditF(null); setForm({field_code:'',area_m2:'',status:'Planned',notes:''}); }}
          className="px-3 py-1.5 rounded bg-[#155d31] text-white text-[11px] font-medium">
          + Add Field
        </button>
      </div>

      {/* Form */}
      {(creating || editF) && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="text-[12px] font-semibold">{editF ? `Edit: ${editF.field_code}` : 'New Field'}</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Field Code *</label>
              <input value={form.field_code} onChange={e=>setForm(f=>({...f,field_code:e.target.value}))}
                placeholder="e.g. T001"
                className="w-full h-8 px-2 rounded border border-border bg-background text-[11px] focus:outline-none focus:ring-1 focus:ring-[#155d31]"/>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Area (m²)</label>
              <input type="number" value={form.area_m2} onChange={e=>setForm(f=>({...f,area_m2:e.target.value}))}
                className="w-full h-8 px-2 rounded border border-border bg-background text-[11px] focus:outline-none"/>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Status</label>
              <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}
                className="w-full h-8 px-2 rounded border border-border bg-background text-[11px]">
                {STATUS_OPTS.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Notes</label>
              <input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
                className="w-full h-8 px-2 rounded border border-border bg-background text-[11px] focus:outline-none"/>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving||!form.field_code.trim()}
              className="px-4 py-1.5 rounded bg-[#155d31] text-white text-[11px] font-medium disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => { setEditF(null); setCreating(false); }}
              className="px-4 py-1.5 rounded border border-border text-[11px]">Cancel</button>
          </div>
        </div>
      )}

      {/* Delete confirm dialog */}
      {delConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-6 max-w-sm w-full space-y-4 shadow-xl">
            <div className="text-[13px] font-semibold">Remove Field</div>
            <p className="text-[12px] text-muted-foreground">
              Are you sure you want to remove field <strong className="text-foreground">{delConfirm.field_code}</strong>?
            </p>
            <div className="flex gap-2">
              <button onClick={() => softDelete(delConfirm)}
                className="flex-1 py-2 rounded bg-red-600 text-white text-[11px] font-medium hover:bg-red-700">
                Remove
              </button>
              <button onClick={() => setDelConfirm(null)}
                className="flex-1 py-2 rounded border border-border text-[11px]">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Status filter chips */}
      <div className="flex gap-2 flex-wrap items-center">
        <input placeholder="Search field…" value={search} onChange={e=>setSearch(e.target.value)}
          className="h-7 px-2.5 rounded border border-border bg-card text-[11px] w-32 focus:outline-none"/>
        {FILTER_OPTS.map(s => {
          const cnt = s === 'all' ? fields.length : (statusCounts[s]||0);
          return (
            <button key={s} onClick={() => setFilter(s)}
              className={['px-2 py-1 rounded text-[10px] border transition-colors',
                filter===s ? 'bg-[#155d31] text-white border-[#155d31]' : 'border-border text-muted-foreground hover:bg-muted/40'
              ].join(' ')}>
              {s==='all'?'All':s} {cnt>0&&`(${cnt})`}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden text-[11px]">
        {/* Desktop header */}
        <div className="hidden lg:grid px-3 py-2 bg-muted/40 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wide gap-2"
          style={{gridTemplateColumns:'90px 70px 140px 110px 80px 110px 110px 100px 72px'}}>
          <div>Field</div>
          <div>Area</div>
          <div>Current Crop</div>
          <div>CP No</div>
          <div>Status</div>
          <div>Ready Date</div>
          <div>Worker</div>
          <div>Machine</div>
          <div></div>
        </div>

        <div className="divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-[12px] text-muted-foreground">No fields found</div>
          ) : filtered.map(f => {
            const p  = planMap[f.field_code];
            const st = p?._overdue ? 'Overdue' : (p?.status || 'Empty');
            const sc = FIELD_STATUS_COLORS[st] || FIELD_STATUS_COLORS['Empty'];
            const worker  = workers.find(w  => w.id  === p?.assigned_worker_id);
            const machine = machines.find(m => m.id  === p?.assigned_machine_id);
            return (
              <div key={f.id}
                className="grid px-3 py-2.5 items-center gap-2 hover:bg-muted/20 transition-colors"
                style={{gridTemplateColumns:'90px 70px 140px 110px 80px 110px 110px 100px 72px'}}>
                {/* Mobile fallback — hidden on lg */}
                <div className="lg:contents">
                  <div className="font-mono font-bold text-[12px]">{f.field_code}</div>
                  <div className="text-muted-foreground text-[10px]">
                    {f.area_m2 ? `${(f.area_m2/10000).toFixed(2)} ha` : '—'}
                  </div>
                  <div className="truncate">{p?.crop_name || '—'}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{p?.cp_no || '—'}</div>
                  <div>
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                      style={{background: sc.bg, color: sc.text}}>{st}</span>
                  </div>
                  <div className="text-[10px]">{p ? fmtDate(p.required_ready_date) : '—'}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{worker?.worker_name || '—'}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{machine?.machine_code || '—'}</div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(f)}
                      className="text-[10px] px-2 py-1 rounded border border-border hover:bg-muted">Edit</button>
                    <button onClick={() => setDelConfirm(f)}
                      className="text-[10px] px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50">Del</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
