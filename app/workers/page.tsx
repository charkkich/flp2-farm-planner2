'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, type Worker } from '@/lib/supabase';

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [editW, setEditW] = useState<Worker|null>(null);
  const [form, setForm] = useState({worker_name:'',position:'',active:true});
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async()=>{
    const {data}=await supabase.from('workers').select('*').order('worker_name');
    setWorkers(data||[]);setLoading(false);
  },[]);
  useEffect(()=>{load();},[load]);

  async function save() {
    setSaving(true);
    if (editW) {
      await supabase.from('workers').update({worker_name:form.worker_name,position:form.position,active:form.active}).eq('id',editW.id);
    } else {
      await supabase.from('workers').insert({worker_name:form.worker_name,position:form.position,active:form.active});
    }
    setSaving(false);setEditW(null);setCreating(false);load();
  }

  if(loading) return <div className="p-4 animate-pulse space-y-2">{[...Array(5)].map((_,i)=><div key={i} className="h-10 bg-muted rounded"/>)}</div>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-base font-bold">Worker Management</h1><p className="text-[11px] text-muted-foreground">{workers.length} workers</p></div>
        <button onClick={()=>{setCreating(true);setEditW(null);setForm({worker_name:'',position:'',active:true});}}
          className="px-3 py-1.5 rounded bg-[#155d31] text-white text-[11px] font-medium">+ Add Worker</button>
      </div>

      {(creating||editW) && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="text-[12px] font-semibold">{editW?`Edit: ${editW.worker_name}`:'New Worker'}</div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[11px] text-muted-foreground block mb-1">Name</label>
              <input value={form.worker_name} onChange={e=>setForm(f=>({...f,worker_name:e.target.value}))}
                className="w-full h-8 px-2 rounded border border-border bg-background text-[11px] focus:outline-none"/></div>
            <div><label className="text-[11px] text-muted-foreground block mb-1">Position</label>
              <input value={form.position} onChange={e=>setForm(f=>({...f,position:e.target.value}))}
                className="w-full h-8 px-2 rounded border border-border bg-background text-[11px] focus:outline-none"/></div>
          </div>
          <label className="flex items-center gap-2 text-[11px] cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={e=>setForm(f=>({...f,active:e.target.checked}))} className="rounded"/>
            Active
          </label>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="px-4 py-1.5 rounded bg-[#155d31] text-white text-[11px] font-medium disabled:opacity-50">{saving?'Saving…':'Save'}</button>
            <button onClick={()=>{setEditW(null);setCreating(false);}} className="px-4 py-1.5 rounded border border-border text-[11px]">Cancel</button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="grid px-3 py-2 bg-muted/40 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase gap-2"
          style={{gridTemplateColumns:'1fr 150px 80px 80px'}}>
          <div>Name</div><div>Position</div><div>Status</div><div></div>
        </div>
        <div className="divide-y divide-border">
          {workers.map(w=>(
            <div key={w.id} className="grid px-3 py-2.5 items-center gap-2 text-[11px]"
              style={{gridTemplateColumns:'1fr 150px 80px 80px'}}>
              <div className="font-medium">{w.worker_name}</div>
              <div className="text-muted-foreground">{w.position||'—'}</div>
              <div><span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${w.active?'bg-[#dcfce7] text-[#15803d]':'bg-muted text-muted-foreground'}`}>{w.active?'Active':'Inactive'}</span></div>
              <div><button onClick={()=>{setEditW(w);setCreating(false);setForm({worker_name:w.worker_name,position:w.position||'',active:w.active});}}
                className="text-[10px] px-2 py-1 rounded border border-border hover:bg-muted">Edit</button></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
