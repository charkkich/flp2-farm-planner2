'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase, type Machine, type PreparationTask } from '@/lib/supabase';

const MACHINE_ICONS: Record<string, string> = {
  'Rotary Tiller': '⚙',
  'Zero Tiller': '🔧',
  'Ridger': '〰',
  'Tractor': '🚜',
};

export default function MachinesPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [tasks, setTasks] = useState<PreparationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [editM, setEditM] = useState<Machine|null>(null);
  const [form, setForm] = useState({machine_code:'',machine_name:'',machine_type:'',active:true});
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<'list'|'utilization'>('list');

  const load = useCallback(async()=>{
    const [{ data: m }, { data: t }] = await Promise.all([
      supabase.from('machines').select('*').order('machine_code'),
      supabase.from('preparation_tasks').select('*'),
    ]);
    setMachines(m||[]);
    setTasks(t||[]);
    setLoading(false);
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

  const utilization = useMemo(()=>{
    return machines.map(m=>{
      const mt = tasks.filter(t=>t.assigned_machine_id===m.id);
      const completed = mt.filter(t=>t.status==='Completed').length;
      const active = mt.filter(t=>['In Progress','Pending'].includes(t.status)).length;
      const total = mt.length;
      return {...m, completed, active, total};
    });
  },[machines, tasks]);

  // Task type breakdown
  const taskTypeBreakdown = useMemo(()=>{
    const types = ['Plowing','Harrowing','Ridging','Ready Inspection'];
    return types.map(tt=>({
      type:tt,
      count: tasks.filter(t=>t.task_type===tt).length,
      completed: tasks.filter(t=>t.task_type===tt&&t.status==='Completed').length,
    }));
  },[tasks]);

  if(loading) return <div className="p-4 animate-pulse space-y-2">{[...Array(5)].map((_,i)=><div key={i} className="h-10 bg-muted rounded"/>)}</div>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-base font-bold">Machine Management</h1>
          <p className="text-[11px] text-muted-foreground">{machines.length} machines · {tasks.length} total tasks</p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1 border border-border rounded overflow-hidden text-[11px]">
            <button onClick={()=>setTab('list')} className={['px-3 py-1.5',tab==='list'?'bg-[#155d31] text-white':'text-muted-foreground'].join(' ')}>List</button>
            <button onClick={()=>setTab('utilization')} className={['px-3 py-1.5',tab==='utilization'?'bg-[#155d31] text-white':'text-muted-foreground'].join(' ')}>Utilization</button>
          </div>
          <button onClick={()=>{setCreating(true);setEditM(null);setForm({machine_code:'',machine_name:'',machine_type:'',active:true});}}
            className="px-3 py-1.5 rounded bg-[#155d31] text-white text-[11px] font-medium">+ Add</button>
        </div>
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

      {tab==='list'&&(
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="grid px-3 py-2 bg-muted/40 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase gap-2"
            style={{gridTemplateColumns:'100px 1fr 120px 60px 80px 80px'}}>
            <div>Code</div><div>Name</div><div>Type</div><div>Tasks</div><div>Status</div><div></div>
          </div>
          <div className="divide-y divide-border">
            {machines.map(m=>{
              const mt = tasks.filter(t=>t.assigned_machine_id===m.id&&!['Completed','Skipped'].includes(t.status));
              const icon = MACHINE_ICONS[m.machine_type||''] || '🔩';
              return (
                <div key={m.id} className="grid px-3 py-2.5 items-center gap-2 text-[11px]"
                  style={{gridTemplateColumns:'100px 1fr 120px 60px 80px 80px'}}>
                  <div className="font-mono font-semibold">{m.machine_code}</div>
                  <div className="flex items-center gap-1.5"><span>{icon}</span><span>{m.machine_name||'—'}</span></div>
                  <div className="text-muted-foreground">{m.machine_type||'—'}</div>
                  <div className="text-center">
                    {mt.length > 0
                      ? <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-sky-100 text-sky-700">{mt.length}</span>
                      : <span className="text-muted-foreground">—</span>}
                  </div>
                  <div><span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${m.active?'bg-[#dcfce7] text-[#15803d]':'bg-muted text-muted-foreground'}`}>{m.active?'Active':'Inactive'}</span></div>
                  <div><button onClick={()=>{setEditM(m);setCreating(false);setForm({machine_code:m.machine_code,machine_name:m.machine_name||'',machine_type:m.machine_type||'',active:m.active});}}
                    className="text-[10px] px-2 py-1 rounded border border-border hover:bg-muted">Edit</button></div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab==='utilization'&&(
        <div className="space-y-4">
          {/* Machine cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {utilization.map(m=>{
              const icon = MACHINE_ICONS[m.machine_type||''] || '🔩';
              const pct = m.total ? Math.round(m.completed/m.total*100) : 0;
              return (
                <div key={m.id} className="bg-card border border-border rounded-lg p-3 space-y-2">
                  <div className="text-2xl text-center">{icon}</div>
                  <div className="text-center">
                    <div className="font-mono font-bold text-[13px]">{m.machine_code}</div>
                    <div className="text-[10px] text-muted-foreground">{m.machine_type||'—'}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Completed</span>
                      <span className="font-medium">{m.completed}/{m.total}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded overflow-hidden">
                      <div className="h-full bg-[#155d31] rounded" style={{width:`${pct}%`}}/>
                    </div>
                    <div className="text-center text-[10px] text-muted-foreground">{pct}%</div>
                  </div>
                  {m.active>0&&<div className="text-center text-[10px] text-sky-600 font-medium">{m.active} active</div>}
                </div>
              );
            })}
          </div>

          {/* Task type breakdown */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-border text-[11px] font-semibold">Task Type Summary</div>
            <div className="p-3 space-y-2">
              {taskTypeBreakdown.filter(t=>t.count>0).map(t=>{
                const pct = t.count ? Math.round(t.completed/t.count*100) : 0;
                return (
                  <div key={t.type} className="flex items-center gap-2">
                    <div className="w-28 text-[11px]">{t.type}</div>
                    <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                      <div className="h-full bg-[#155d31] rounded" style={{width:`${pct}%`}}/>
                    </div>
                    <div className="w-20 text-right text-[10px] text-muted-foreground">{t.completed}/{t.count} ({pct}%)</div>
                  </div>
                );
              })}
              {taskTypeBreakdown.every(t=>t.count===0)&&(
                <div className="text-center text-[11px] text-muted-foreground py-4">No preparation tasks yet</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
