'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase, type Worker, type PreparationTask } from '@/lib/supabase';

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [tasks, setTasks] = useState<PreparationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [editW, setEditW] = useState<Worker|null>(null);
  const [form, setForm] = useState({worker_name:'',position:'',active:true});
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<'list'|'workload'>('list');

  const load = useCallback(async()=>{
    const [{ data: w }, { data: t }] = await Promise.all([
      supabase.from('workers').select('*').order('worker_name'),
      supabase.from('preparation_tasks').select('*').neq('status','Completed').neq('status','Skipped'),
    ]);
    setWorkers(w||[]);
    setTasks(t||[]);
    setLoading(false);
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

  const workload = useMemo(() => {
    return workers.map(w => {
      const wTasks = tasks.filter(t=>t.assigned_worker_id===w.id);
      const pending = wTasks.filter(t=>t.status==='Pending').length;
      const inProgress = wTasks.filter(t=>t.status==='In Progress').length;
      const overdue = wTasks.filter(t=>t.status==='Overdue').length;
      const score = overdue*3 + inProgress*2 + pending;
      return {...w, pending, inProgress, overdue, total:wTasks.length, score};
    }).sort((a,b)=>b.score-a.score);
  }, [workers, tasks]);

  const maxScore = Math.max(...workload.map(w=>w.score), 1);

  if(loading) return <div className="p-4 animate-pulse space-y-2">{[...Array(5)].map((_,i)=><div key={i} className="h-10 bg-muted rounded"/>)}</div>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="text-base font-bold">Worker Management</h1>
          <p className="text-[11px] text-muted-foreground">{workers.length} workers · {tasks.length} active tasks</p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1 border border-border rounded overflow-hidden text-[11px]">
            <button onClick={()=>setTab('list')} className={['px-3 py-1.5',tab==='list'?'bg-[#155d31] text-white':'text-muted-foreground'].join(' ')}>List</button>
            <button onClick={()=>setTab('workload')} className={['px-3 py-1.5',tab==='workload'?'bg-[#155d31] text-white':'text-muted-foreground'].join(' ')}>Workload</button>
          </div>
          <button onClick={()=>{setCreating(true);setEditW(null);setForm({worker_name:'',position:'',active:true});}}
            className="px-3 py-1.5 rounded bg-[#155d31] text-white text-[11px] font-medium">+ Add</button>
        </div>
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
            <input type="checkbox" checked={form.active} onChange={e=>setForm(f=>({...f,active:e.target.checked}))} className="rounded"/>Active
          </label>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="px-4 py-1.5 rounded bg-[#155d31] text-white text-[11px] font-medium disabled:opacity-50">{saving?'Saving…':'Save'}</button>
            <button onClick={()=>{setEditW(null);setCreating(false);}} className="px-4 py-1.5 rounded border border-border text-[11px]">Cancel</button>
          </div>
        </div>
      )}

      {tab==='list'&&(
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="grid px-3 py-2 bg-muted/40 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase gap-2"
            style={{gridTemplateColumns:'1fr 150px 80px 70px 80px'}}>
            <div>Name</div><div>Position</div><div>Status</div><div>Tasks</div><div></div>
          </div>
          <div className="divide-y divide-border">
            {workers.map(w=>{
              const wTasks = tasks.filter(t=>t.assigned_worker_id===w.id);
              return (
                <div key={w.id} className="grid px-3 py-2.5 items-center gap-2 text-[11px]"
                  style={{gridTemplateColumns:'1fr 150px 80px 70px 80px'}}>
                  <div className="font-medium">{w.worker_name}</div>
                  <div className="text-muted-foreground">{w.position||'—'}</div>
                  <div><span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${w.active?'bg-[#dcfce7] text-[#15803d]':'bg-muted text-muted-foreground'}`}>{w.active?'Active':'Inactive'}</span></div>
                  <div className="text-center">
                    {wTasks.length > 0
                      ? <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-sky-100 text-sky-700">{wTasks.length}</span>
                      : <span className="text-muted-foreground">—</span>}
                  </div>
                  <div><button onClick={()=>{setEditW(w);setCreating(false);setForm({worker_name:w.worker_name,position:w.position||'',active:w.active});}}
                    className="text-[10px] px-2 py-1 rounded border border-border hover:bg-muted">Edit</button></div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab==='workload'&&(
        <div className="space-y-3">
          <div className="text-[11px] text-muted-foreground">Workload score = Overdue×3 + InProgress×2 + Pending×1</div>
          {workload.map(w=>(
            <div key={w.id} className="bg-card border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#155d31] flex items-center justify-center text-white text-[10px] font-bold">
                    {w.worker_name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                  </div>
                  <div>
                    <div className="text-[12px] font-semibold">{w.worker_name}</div>
                    <div className="text-[10px] text-muted-foreground">{w.position||'Field Operator'}</div>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {w.overdue>0&&<span className="px-2 py-0.5 rounded-full text-[10px] bg-red-100 text-red-700">⚠ {w.overdue} overdue</span>}
                  {w.inProgress>0&&<span className="px-2 py-0.5 rounded-full text-[10px] bg-sky-100 text-sky-700">⚡ {w.inProgress} active</span>}
                  {w.pending>0&&<span className="px-2 py-0.5 rounded-full text-[10px] bg-muted text-muted-foreground">{w.pending} pending</span>}
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Workload</span><span>Score: {w.score}</span>
                </div>
                <div className="h-2 bg-muted rounded overflow-hidden">
                  <div className="h-full rounded transition-all"
                    style={{
                      width:`${Math.round(w.score/maxScore*100)}%`,
                      background:w.score===0?'#22c55e':w.overdue>0?'#dc2626':w.score>5?'#f59e0b':'#0369a1'
                    }}/>
                </div>
              </div>
              {w.total===0&&<div className="text-[10px] text-muted-foreground text-center py-1">No active tasks assigned</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
