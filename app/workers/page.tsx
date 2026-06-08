'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, type Worker } from '@/lib/supabase';

export default function WorkersPage() {
  const [workers,  setWorkers]  = useState<Worker[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [editW,    setEditW]    = useState<Worker|null>(null);
  const [creating, setCreating] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [form, setForm] = useState({ worker_code:'', worker_name:'', position:'', is_active: true });

  const load = useCallback(async () => {
    const { data } = await supabase.from('workers').select('*').order('worker_name');
    setWorkers(data||[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true);
    const payload = {
      worker_code:  form.worker_code.trim() || null,
      worker_name:  form.worker_name.trim(),
      position:     form.position.trim() || null,
      is_active:    form.is_active,
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

  const active   = workers.filter(w => w.is_active !== false);
  const inactive = workers.filter(w => w.is_active === false);

  if (loading) return (
    <div className="p-4 animate-pulse space-y-2">
      {[...Array(6)].map((_,i)=><div key={i} className="h-10 bg-muted rounded"/>)}
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-base font-bold">Workers</h1>
          <p className="text-[11px] text-muted-foreground">{active.length} active · {inactive.length} inactive</p>
        </div>
        <button
          onClick={() => { setCreating(true); setEditW(null); setForm({worker_code:'',worker_name:'',position:'',is_active:true}); }}
          className="px-3 py-1.5 rounded bg-[#155d31] text-white text-[11px] font-medium">
          + Add Worker
        </button>
      </div>

      {/* Form */}
      {(creating || editW) && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="text-[12px] font-semibold">{editW ? `Edit: ${editW.worker_name}` : 'New Worker'}</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Code</label>
              <input value={form.worker_code} onChange={e=>setForm(f=>({...f,worker_code:e.target.value}))}
                placeholder="e.g. W001"
                className="w-full h-8 px-2 rounded border border-border bg-background text-[11px] focus:outline-none focus:ring-1 focus:ring-[#155d31]"/>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Name *</label>
              <input value={form.worker_name} onChange={e=>setForm(f=>({...f,worker_name:e.target.value}))}
                className="w-full h-8 px-2 rounded border border-border bg-background text-[11px] focus:outline-none focus:ring-1 focus:ring-[#155d31]"/>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Position</label>
              <input value={form.position} onChange={e=>setForm(f=>({...f,position:e.target.value}))}
                placeholder="e.g. Field Operator"
                className="w-full h-8 px-2 rounded border border-border bg-background text-[11px] focus:outline-none focus:ring-1 focus:ring-[#155d31]"/>
            </div>
          </div>
          <label className="flex items-center gap-2 text-[11px] cursor-pointer select-none">
            <input type="checkbox" checked={form.is_active} onChange={e=>setForm(f=>({...f,is_active:e.target.checked}))} className="rounded"/>
            Active
          </label>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving || !form.worker_name.trim()}
              className="px-4 py-1.5 rounded bg-[#155d31] text-white text-[11px] font-medium disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => { setEditW(null); setCreating(false); }}
              className="px-4 py-1.5 rounded border border-border text-[11px]">Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden text-[11px]">
        <div className="grid px-3 py-2 bg-muted/40 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wide gap-2"
          style={{gridTemplateColumns:'80px 1fr 160px 70px 80px'}}>
          <div>Code</div>
          <div>Name</div>
          <div>Position</div>
          <div>Status</div>
          <div></div>
        </div>
        <div className="divide-y divide-border">
          {workers.length === 0 ? (
            <div className="py-10 text-center text-[12px] text-muted-foreground">No workers yet — add one above</div>
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
                    {isAct ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(w)}
                    className="text-[10px] px-2 py-1 rounded border border-border hover:bg-muted">Edit</button>
                  {isAct && (
                    <button onClick={() => deactivate(w)}
                      className="text-[10px] px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50">Del</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
