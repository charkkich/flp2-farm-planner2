'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase, type Machine, type Attachment, type MachineAssignment, type WorkOrder } from '@/lib/supabase';
import { useLang } from '@/components/providers';
import { translations } from '@/lib/i18n';

const MACHINE_STATUS = ['Available','Working','Maintenance'] as const;
const STATUS_STYLE: Record<string,{bg:string;text:string}> = {
  Available:   { bg:'#dcfce7', text:'#15803d' },
  Working:     { bg:'#dbeafe', text:'#1d4ed8' },
  Maintenance: { bg:'#fef3c7', text:'#d97706' },
};

export default function MachinesPage() {
  const { lang } = useLang();
  const t = translations[lang];
  const mt = t.machines;
  const cm = t.common;

  const [machines,    setMachines]    = useState<Machine[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [assignments, setAssignments] = useState<MachineAssignment[]>([]);
  const [workOrders,  setWorkOrders]  = useState<WorkOrder[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [tab,         setTab]         = useState<'machines'|'attachments'|'kpi'>('machines');

  // Machine form
  const [editM,    setEditM]    = useState<Machine|null>(null);
  const [creating, setCreating] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [mForm, setMForm] = useState({ machine_code:'', machine_name:'', machine_type:'', status:'Available', is_active:true });

  // Attachment form
  const [editA,     setEditA]     = useState<Attachment|null>(null);
  const [creatingA, setCreatingA] = useState(false);
  const [aForm, setAForm] = useState({ attachment_code:'', attachment_name:'', attachment_type:'' });

  // Change attachment modal
  const [changeTarget, setChangeTarget]   = useState<Machine|null>(null);
  const [selectedAtt,  setSelectedAtt]    = useState('');

  const load = useCallback(async () => {
    const [{ data: m }, { data: a }, { data: ma }, { data: wo }] = await Promise.all([
      supabase.from('machines').select('*').order('machine_code'),
      supabase.from('attachments').select('*').eq('is_active', true).order('attachment_code'),
      supabase.from('machine_assignments').select('*').is('released_date', null),
      supabase.from('work_orders').select('*').not('status','eq','Cancelled'),
    ]);
    setMachines(m||[]);
    setAttachments(a||[]);
    setAssignments(ma||[]);
    setWorkOrders(wo||[]);
    setLoading(false);
  }, []);

  // Machine KPI
  const machineKPI = useMemo(() => {
    const map: Record<string,{name:string;code:string;total:number;completed:number;inProgress:number;attCount:Record<string,number>}> = {};
    machines.forEach(m => {
      map[m.id] = { name: m.machine_name||m.machine_code, code: m.machine_code, total:0, completed:0, inProgress:0, attCount:{} };
    });
    workOrders.forEach(o => {
      const mid = o.assigned_machine_id;
      if (!mid) return;
      if (!map[mid]) map[mid] = { name:mid, code:'', total:0, completed:0, inProgress:0, attCount:{} };
      map[mid].total++;
      if (o.status==='Completed')   map[mid].completed++;
      if (o.status==='In Progress') map[mid].inProgress++;
      if (o.assigned_attachment_id) {
        map[mid].attCount[o.assigned_attachment_id] = (map[mid].attCount[o.assigned_attachment_id]||0)+1;
      }
    });
    return Object.entries(map).map(([id,v]) => {
      const topAttId = Object.entries(v.attCount).sort((a,b)=>b[1]-a[1])[0]?.[0];
      const topAtt   = topAttId ? (attachments.find(a=>a.id===topAttId)?.attachment_name||topAttId) : '—';
      return { id, ...v, pct: v.total>0?Math.round(v.completed/v.total*100):0, mostUsed: topAtt };
    }).sort((a,b) => b.total - a.total);
  }, [machines, workOrders, attachments]);

  useEffect(() => { load(); }, [load]);

  // Current attachment per machine (active assignment)
  const currentAtt = useMemo(() => {
    const map: Record<string, Attachment> = {};
    assignments.forEach(ma => {
      const att = attachments.find(a => a.id === ma.attachment_id);
      if (att) map[ma.machine_id] = att;
    });
    return map;
  }, [assignments, attachments]);

  async function saveMachine() {
    setSaving(true);
    const payload = {
      machine_code: mForm.machine_code.trim(),
      machine_name: mForm.machine_name.trim() || null,
      machine_type: mForm.machine_type.trim() || null,
      status:       mForm.status,
      is_active:    mForm.is_active,
    };
    if (editM) {
      await supabase.from('machines').update(payload).eq('id', editM.id);
    } else {
      await supabase.from('machines').insert(payload);
    }
    setSaving(false); setEditM(null); setCreating(false); load();
  }

  async function saveAttachment() {
    setSaving(true);
    const payload = {
      attachment_code: aForm.attachment_code.trim(),
      attachment_name: aForm.attachment_name.trim(),
      attachment_type: aForm.attachment_type.trim() || null,
    };
    if (editA) {
      await supabase.from('attachments').update(payload).eq('id', editA.id);
    } else {
      await supabase.from('attachments').insert({ ...payload, is_active: true });
    }
    setSaving(false); setEditA(null); setCreatingA(false); load();
  }

  async function applyAttachment() {
    if (!changeTarget) return;
    // Release current assignment
    await supabase
      .from('machine_assignments')
      .update({ released_date: new Date().toISOString().split('T')[0] })
      .eq('machine_id', changeTarget.id)
      .is('released_date', null);

    if (selectedAtt) {
      // Assign new
      await supabase.from('machine_assignments').insert({
        machine_id:    changeTarget.id,
        attachment_id: selectedAtt,
        assigned_date: new Date().toISOString().split('T')[0],
      });
      await supabase.from('machines').update({ status: 'Working' }).eq('id', changeTarget.id);
    } else {
      await supabase.from('machines').update({ status: 'Available' }).eq('id', changeTarget.id);
    }
    setChangeTarget(null); setSelectedAtt(''); load();
  }

  function openEditMachine(m: Machine) {
    setEditM(m); setCreating(false);
    setMForm({ machine_code: m.machine_code, machine_name: m.machine_name||'', machine_type: m.machine_type||'', status: m.status||'Available', is_active: m.is_active !== false });
  }

  function openEditAttachment(a: Attachment) {
    setEditA(a); setCreatingA(false);
    setAForm({ attachment_code: a.attachment_code, attachment_name: a.attachment_name, attachment_type: a.attachment_type||'' });
  }

  const activeMachines = machines.filter(m => m.is_active !== false);

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
          <h1 className="text-base font-bold">{mt.title}</h1>
          <p className="text-[11px] text-muted-foreground">{activeMachines.length} machines · {attachments.length} attachments</p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1 border border-border rounded-lg p-0.5 bg-muted/30">
            {(['machines','attachments','kpi'] as const).map(tb => (
              <button key={tb} onClick={()=>setTab(tb)}
                className={['px-3 py-1 rounded text-[11px] font-medium transition-colors',
                  tab===tb?'bg-[#155d31] text-white':'text-muted-foreground hover:text-foreground'].join(' ')}>
                {tb==='machines'?mt.listTab:tb==='attachments'?mt.attachTab:mt.kpiTab}
              </button>
            ))}
          </div>
          {(tab==='machines'||tab==='attachments') && (
            <button onClick={() => {
              if (tab === 'machines') { setCreating(true); setEditM(null); setMForm({machine_code:'',machine_name:'',machine_type:'',status:'Available',is_active:true}); }
              else { setCreatingA(true); setEditA(null); setAForm({attachment_code:'',attachment_name:'',attachment_type:''}); }
            }} className="px-3 py-1.5 rounded bg-[#155d31] text-white text-[11px] font-medium">+ {cm.add}</button>
          )}
        </div>
      </div>

      {/* Change Attachment Modal */}
      {changeTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-6 max-w-sm w-full space-y-4 shadow-xl">
            <div className="text-[13px] font-semibold">Change Attachment</div>
            <div className="text-[11px] text-muted-foreground">Machine: <strong className="text-foreground">{changeTarget.machine_code}</strong></div>
            <div>
              <div className="text-[11px] text-muted-foreground mb-1.5">
                Current: <span className="font-medium text-foreground">{currentAtt[changeTarget.id]?.attachment_name || '— None —'}</span>
              </div>
              <select value={selectedAtt} onChange={e=>setSelectedAtt(e.target.value)}
                className="w-full h-9 px-3 rounded border border-border bg-background text-[12px] focus:outline-none">
                <option value="">— Remove attachment —</option>
                {attachments.map(a => (
                  <option key={a.id} value={a.id}>{a.attachment_code} · {a.attachment_name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={applyAttachment}
                className="flex-1 py-2 rounded bg-[#155d31] text-white text-[11px] font-medium">Apply</button>
              <button onClick={() => { setChangeTarget(null); setSelectedAtt(''); }}
                className="flex-1 py-2 rounded border border-border text-[11px]">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Machine Form */}
      {tab === 'machines' && (creating || editM) && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="text-[12px] font-semibold">{editM ? `Edit: ${editM.machine_code}` : 'New Machine'}</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Code *</label>
              <input value={mForm.machine_code} onChange={e=>setMForm(f=>({...f,machine_code:e.target.value}))}
                placeholder="e.g. T001"
                className="w-full h-8 px-2 rounded border border-border bg-background text-[11px] focus:outline-none focus:ring-1 focus:ring-[#155d31]"/>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Name</label>
              <input value={mForm.machine_name} onChange={e=>setMForm(f=>({...f,machine_name:e.target.value}))}
                placeholder="e.g. Kubota RT120"
                className="w-full h-8 px-2 rounded border border-border bg-background text-[11px] focus:outline-none"/>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Type</label>
              <input value={mForm.machine_type} onChange={e=>setMForm(f=>({...f,machine_type:e.target.value}))}
                placeholder="e.g. Tractor"
                className="w-full h-8 px-2 rounded border border-border bg-background text-[11px] focus:outline-none"/>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Status</label>
              <select value={mForm.status} onChange={e=>setMForm(f=>({...f,status:e.target.value}))}
                className="w-full h-8 px-2 rounded border border-border bg-background text-[11px]">
                {MACHINE_STATUS.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={saveMachine} disabled={saving || !mForm.machine_code.trim()}
              className="px-4 py-1.5 rounded bg-[#155d31] text-white text-[11px] font-medium disabled:opacity-50">
              {saving ? cm.saving : cm.save}
            </button>
            <button onClick={() => { setEditM(null); setCreating(false); }}
              className="px-4 py-1.5 rounded border border-border text-[11px]">{cm.cancel}</button>
          </div>
        </div>
      )}

      {/* Attachment Form */}
      {tab === 'attachments' && (creatingA || editA) && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="text-[12px] font-semibold">{editA ? `Edit: ${editA.attachment_code}` : 'New Attachment'}</div>
          <div className="grid grid-cols-3 gap-3">
            {([['Code','attachment_code'],['Name','attachment_name'],['Type','attachment_type']] as [string,string][]).map(([l,k]) => (
              <div key={k}>
                <label className="text-[11px] text-muted-foreground block mb-1">{l}</label>
                <input value={(aForm as any)[k]} onChange={e=>setAForm(f=>({...f,[k]:e.target.value}))}
                  className="w-full h-8 px-2 rounded border border-border bg-background text-[11px] focus:outline-none focus:ring-1 focus:ring-[#155d31]"/>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={saveAttachment} disabled={saving}
              className="px-4 py-1.5 rounded bg-[#155d31] text-white text-[11px] font-medium disabled:opacity-50">
              {saving ? cm.saving : cm.save}
            </button>
            <button onClick={() => { setEditA(null); setCreatingA(false); }}
              className="px-4 py-1.5 rounded border border-border text-[11px]">{cm.cancel}</button>
          </div>
        </div>
      )}

      {/* KPI Tab */}
      {tab === 'kpi' && (
        <div className="space-y-4">
          {/* Summary row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: mt.totalJobs, value: machineKPI.reduce((s,m)=>s+m.total,0),     color:'text-foreground' },
              { label: mt.completed, value: machineKPI.reduce((s,m)=>s+m.completed,0), color:'text-green-700' },
              { label: 'In Progress', value: machineKPI.reduce((s,m)=>s+m.inProgress,0),color:'text-amber-600' },
              { label: cm.active,    value: activeMachines.length,                       color:'text-blue-600' },
            ].map(k => (
              <div key={k.label} className="bg-card border border-border rounded-lg p-3">
                <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{k.label}</div>
              </div>
            ))}
          </div>

          {machineKPI.filter(m=>m.total>0).length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-[12px]">No work order data yet</div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden text-[11px]">
              <div className="grid px-3 py-2 bg-muted/40 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wide gap-2"
                style={{gridTemplateColumns:'90px 1fr 70px 70px 70px 1fr 110px'}}>
                <div>{mt.code}</div>
                <div>{mt.name}</div>
                <div className="text-center">{mt.totalJobs}</div>
                <div className="text-center">{mt.completed}</div>
                <div className="text-center">In Prog.</div>
                <div>{mt.mostUsed}</div>
                <div>{mt.utilization}</div>
              </div>
              <div className="divide-y divide-border">
                {machineKPI.map(m => {
                  const pctColor = m.pct>=80?'#15803d':m.pct>=50?'#d97706':'#dc2626';
                  return (
                    <div key={m.id} className="grid px-3 py-2.5 items-center gap-2 hover:bg-muted/20"
                      style={{gridTemplateColumns:'90px 1fr 70px 70px 70px 1fr 110px'}}>
                      <div className="font-mono font-bold">{m.code}</div>
                      <div className="truncate">{m.name}</div>
                      <div className="text-center font-semibold">{m.total}</div>
                      <div className="text-center text-green-700 font-semibold">{m.completed}</div>
                      <div className="text-center text-amber-600">{m.inProgress}</div>
                      <div className="truncate text-muted-foreground text-[10px]">{m.mostUsed}</div>
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-1.5 bg-muted rounded overflow-hidden">
                          <div className="h-full rounded" style={{width:`${m.pct}%`,background:pctColor}}/>
                        </div>
                        <span className="text-[10px] font-bold w-8 text-right" style={{color:pctColor}}>
                          {m.total>0?`${m.pct}%`:'—'}
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

      {/* Machines Tab */}
      {tab === 'machines' && (
        <div className="rounded-lg border border-border overflow-hidden text-[11px]">
          <div className="grid px-3 py-2 bg-muted/40 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wide gap-2"
            style={{gridTemplateColumns:'90px 1fr 130px 150px 80px 100px'}}>
            <div>Code</div><div>Name</div><div>Type</div><div>Attachment</div><div>Status</div><div></div>
          </div>
          <div className="divide-y divide-border">
            {activeMachines.length === 0 ? (
              <div className="py-8 text-center text-[12px] text-muted-foreground">No machines yet</div>
            ) : activeMachines.map(m => {
              const att = currentAtt[m.id];
              const sc  = STATUS_STYLE[m.status] || STATUS_STYLE['Available'];
              return (
                <div key={m.id} className="grid px-3 py-2.5 items-center gap-2 hover:bg-muted/20"
                  style={{gridTemplateColumns:'90px 1fr 130px 150px 80px 100px'}}>
                  <div className="font-mono font-bold">{m.machine_code}</div>
                  <div>{m.machine_name||'—'}</div>
                  <div className="text-muted-foreground">{m.machine_type||'—'}</div>
                  <div>
                    {att
                      ? <span className="px-2 py-0.5 bg-sky-50 text-sky-700 rounded-full text-[10px] font-medium">{att.attachment_name}</span>
                      : <span className="text-muted-foreground">—</span>}
                  </div>
                  <div>
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium" style={{background:sc.bg,color:sc.text}}>
                      {m.status||'Available'}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { setChangeTarget(m); setSelectedAtt(assignments.find(a=>a.machine_id===m.id&&!a.released_date)?.attachment_id||''); }}
                      className="text-[10px] px-1.5 py-1 rounded border border-border hover:bg-muted">Attach</button>
                    <button onClick={() => openEditMachine(m)}
                      className="text-[10px] px-1.5 py-1 rounded border border-border hover:bg-muted">Edit</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Attachments Tab */}
      {tab === 'attachments' && (
        <div className="rounded-lg border border-border overflow-hidden text-[11px]">
          <div className="grid px-3 py-2 bg-muted/40 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wide gap-2"
            style={{gridTemplateColumns:'90px 1fr 130px 60px'}}>
            <div>Code</div><div>Name</div><div>Type</div><div></div>
          </div>
          <div className="divide-y divide-border">
            {attachments.length === 0 ? (
              <div className="py-8 text-center text-[12px] text-muted-foreground">No attachments yet</div>
            ) : attachments.map(a => (
              <div key={a.id} className="grid px-3 py-2.5 items-center gap-2 hover:bg-muted/20"
                style={{gridTemplateColumns:'90px 1fr 130px 60px'}}>
                <div className="font-mono font-bold">{a.attachment_code}</div>
                <div>{a.attachment_name}</div>
                <div className="text-muted-foreground">{a.attachment_type||'—'}</div>
                <div>
                  <button onClick={() => openEditAttachment(a)}
                    className="text-[10px] px-2 py-1 rounded border border-border hover:bg-muted">Edit</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
