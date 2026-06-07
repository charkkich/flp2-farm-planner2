'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, type Machine } from '@/lib/supabase';

export default function MachinesPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [editM, setEditM] = useState<Machine|null>(null);
  const [form, setForm] = useState({machine_code:'',machine_name:'',machine_type:'',active:true});
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async()=>{
    const {data}=await supabase.from('machines').select('*').order('machine_code');
    setMachines(data||[]);setLoading(false);
  },[]);
  useEffect(()=>{load();},[load]);

  async function save() {
    setSaving(true);
    if (editM) {
      await supabase.from('machines').update({machine_code:form.machine_code,machine_name:form.machine_name,machine_type:form.machine_type,active:form.active}).eq('id',editM.id);
    } else {
      await supabase.from('machines').insert({machine_code:form.machine_code,machine_name:form.machine_name,machine_type:form.machine_type,active:form.active});
    }
    setSaving(false);setEditM(null);setCreating(false);load();
  }

  if(loading) return <div className="p-4 animate-pulse space-y-2">{[...Array(5)].map((_,i)=><div key={i} className="h-10 bg-muted rounded"/>)}</div>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-base font-bold">Machine Management</h1><p className="text-[11px] text-muted-foreground">{machines.length} machines · RT120 / ZT120 / EDI110 / KWM95</p></div>
        <button onClick={()=>{setCreating(true);setEditM(null);setForm({machine_code:'',machine_name:'',machine_type:'',active:true});}}
          className="px-3 py-1.5 rounded bg-[#155d31] text-white text-[11px] font-medium">+ Add Machine</button>
      </div>

      {(creating||editM) && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="text-[12px] font-semibold">{editM?`Edit: ${editM.machine_code}`:'New Machine'}</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[['Code','machine_code'],['Name','machine_name'],['Type','machine_type']].map(([l,k])=>(
              <div key={k}><label className="text-[11px] text-muted-foreground block mb-1">{l}</label>
                <input value={(form as any)[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}
                  className="w-full h-8 px-2 rounded border border-border bg-background text-[11px] focus:outline-none"/></div>
            ))}
          </div>
          <label className="flex items-center gap-2 text-[11px] cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={e=>setForm(f=>({...f,active:e.target.checked}))} className="rounded"/>Active
          </label>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="px-4 py-1.5 rounded bg-[#155d31] text-white text-[11px] font-medium disabled:opacity-50">{saving?'Saving…':'Save'}</button>
            <button onClick={()=>{setEditM(null);setCreating(false);}} className="px-4 py-1.5 rounded border border-border text-[11px]">Cancel</button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="grid px-3 py-2 bg-muted/40 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase gap-2"
          style={{gridTemplateColumns:'100px 1fr 120px 80px 80px'}}>
          <div>Code</div><div>Name</div><div>Type</div><div>Status</div><div></div>
        </div>
        <div className="divide-y divide-border">
          {machines.map(m=>(
            <div key={m.id} className="grid px-3 py-2.5 items-center gap-2 text-[11px]"
              style={{gridTemplateColumns:'100px 1fr 120px 80px 80px'}}>
              <div className="font-mono font-semibold">{m.machine_code}</div>
              <div>{m.machine_name||'—'}</div>
              <div className="text-muted-foreground">{m.machine_type||'—'}</div>
              <div><span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${m.active?'bg-[#dcfce7] text-[#15803d]':'bg-muted text-muted-foreground'}`}>{m.active?'Active':'Inactive'}</span></div>
              <div><button onClick={()=>{setEditM(m);setCreating(false);setForm({machine_code:m.machine_code,machine_name:m.machine_name||'',machine_type:m.machine_type||'',active:m.active});}}
                className="text-[10px] px-2 py-1 rounded border border-border hover:bg-muted">Edit</button></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
