'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase, fmtDate, type WorkOrder, type Worker, type Machine, type Attachment, type Field, type CropPlan } from '@/lib/supabase';
import { useLang } from '@/components/providers';
import { translations } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';

const TASK_TYPES = ['Plowing', 'Harrowing', 'Ridging'] as const;
const WO_STATUSES = ['Planned', 'In Progress', 'Completed', 'Cancelled'] as const;

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  'Planned':     { bg: '#f1f5f9', text: '#475569' },
  'In Progress': { bg: '#fef3c7', text: '#d97706' },
  'Completed':   { bg: '#dcfce7', text: '#15803d' },
  'Cancelled':   { bg: '#fee2e2', text: '#dc2626' },
};

const TASK_STYLE: Record<string, { bg: string; text: string }> = {
  'Plowing':   { bg: '#dbeafe', text: '#1d4ed8' },
  'Harrowing': { bg: '#f3e8ff', text: '#7c3aed' },
  'Ridging':   { bg: '#fef9c3', text: '#a16207' },
};

type WOWithJoins = WorkOrder & {
  worker_name?: string;
  machine_name?: string;
  attachment_name?: string;
  cp_no?: string;
};

const EMPTY_FORM = {
  field_code: '',
  cp_id: '',
  task_type: 'Plowing' as typeof TASK_TYPES[number],
  status: 'Planned' as typeof WO_STATUSES[number],
  assigned_worker_id: '',
  assigned_machine_id: '',
  assigned_attachment_id: '',
  planned_date: '',
  actual_date: '',
  remarks: '',
};

export default function WorkOrdersPage() {
  const { lang } = useLang();
  const t = translations[lang];
  const wo = t.workOrders;
  const cm = t.common;
  const { toast } = useToast();

  const [orders, setOrders]     = useState<WOWithJoins[]>([]);
  const [workers, setWorkers]   = useState<Worker[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [fields, setFields]     = useState<Field[]>([]);
  const [cropPlans, setCropPlans] = useState<CropPlan[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTask,   setFilterTask]   = useState('all');
  const [search, setSearch]             = useState('');

  // Modal state
  const [showForm, setShowForm]       = useState(false);
  const [editId, setEditId]           = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  async function load() {
    const [woRes, wRes, mRes, aRes, fRes, cpRes] = await Promise.all([
      supabase.from('work_orders').select('*').order('planned_date', { ascending: false, nullsFirst: false }),
      supabase.from('workers').select('*').eq('is_active', true).order('worker_name'),
      supabase.from('machines').select('*').eq('is_active', true).order('machine_name'),
      supabase.from('attachments').select('*').eq('is_active', true).order('attachment_name'),
      supabase.from('fields').select('*').eq('is_active', true).order('field_code'),
      supabase.from('crop_plans').select('id,cp_no,field_code,crop_name').not('status', 'in', '("Harvested")').order('cp_no'),
    ]);

    const wMap = Object.fromEntries((wRes.data || []).map(w => [w.id, w.worker_name]));
    const mMap = Object.fromEntries((mRes.data || []).map(m => [m.id, m.machine_name || m.machine_code]));
    const aMap = Object.fromEntries((aRes.data || []).map(a => [a.id, a.attachment_name]));
    const cpMap = Object.fromEntries((cpRes.data || []).map(c => [c.id, c.cp_no]));

    const enriched = (woRes.data || []).map(o => ({
      ...o,
      worker_name:     o.assigned_worker_id     ? wMap[o.assigned_worker_id]     : undefined,
      machine_name:    o.assigned_machine_id     ? mMap[o.assigned_machine_id]    : undefined,
      attachment_name: o.assigned_attachment_id  ? aMap[o.assigned_attachment_id] : undefined,
      cp_no:           o.cp_id                   ? cpMap[o.cp_id]                 : undefined,
    }));

    setOrders(enriched as WOWithJoins[]);
    setWorkers(wRes.data || []);
    setMachines(mRes.data || []);
    setAttachments(aRes.data || []);
    setFields(fRes.data || []);
    setCropPlans((cpRes.data || []) as CropPlan[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // CP options for the selected field
  const cpOptions = useMemo(() => {
    if (!form.field_code) return cropPlans;
    return cropPlans.filter(c => c.field_code === form.field_code);
  }, [form.field_code, cropPlans]);

  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (filterStatus !== 'all' && o.status !== filterStatus) return false;
      if (filterTask   !== 'all' && o.task_type !== filterTask) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (o.field_code || '').toLowerCase().includes(q) ||
          (o.cp_no || '').toLowerCase().includes(q) ||
          (o.worker_name || '').toLowerCase().includes(q) ||
          (o.task_type || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [orders, filterStatus, filterTask, search]);

  function openNew() {
    setForm({ ...EMPTY_FORM });
    setEditId(null);
    setShowForm(true);
  }

  function openEdit(o: WOWithJoins) {
    setForm({
      field_code:             o.field_code || '',
      cp_id:                  o.cp_id || '',
      task_type:              o.task_type,
      status:                 o.status,
      assigned_worker_id:     o.assigned_worker_id || '',
      assigned_machine_id:    o.assigned_machine_id || '',
      assigned_attachment_id: o.assigned_attachment_id || '',
      planned_date:           o.planned_date || '',
      actual_date:            o.actual_date || '',
      remarks:                o.remarks || '',
    });
    setEditId(o.id);
    setShowForm(true);
  }

  async function handleSave() {
    setSaving(true);
    const payload = {
      field_code:             form.field_code   || null,
      cp_id:                  form.cp_id        || null,
      task_type:              form.task_type,
      status:                 form.status,
      assigned_worker_id:     form.assigned_worker_id     || null,
      assigned_machine_id:    form.assigned_machine_id    || null,
      assigned_attachment_id: form.assigned_attachment_id || null,
      planned_date:           form.planned_date  || null,
      actual_date:            form.actual_date   || null,
      remarks:                form.remarks       || null,
    };

    let error;
    if (editId) {
      ({ error } = await supabase.from('work_orders').update(payload).eq('id', editId));
    } else {
      ({ error } = await supabase.from('work_orders').insert(payload));
    }
    setSaving(false);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editId ? 'Updated' : 'Created' });
    setShowForm(false);
    load();
  }

  async function handleQuickStatus(id: string, newStatus: typeof WO_STATUSES[number]) {
    const updatePayload: Record<string, string | null> = { status: newStatus };
    if (newStatus === 'Completed') updatePayload.actual_date = new Date().toISOString().split('T')[0];
    await supabase.from('work_orders').update(updatePayload).eq('id', id);
    load();
  }

  async function handleDelete(id: string) {
    await supabase.from('work_orders').delete().eq('id', id);
    setConfirmDelete(null);
    load();
  }

  // CSV export
  function exportCSV() {
    const rows = filtered;
    const header = ['Field', 'CP No', 'Task Type', 'Status', 'Planned Date', 'Actual Date', 'Worker', 'Machine', 'Attachment', 'Remarks'];
    const lines = rows.map(o => [
      o.field_code || '', o.cp_no || '', o.task_type, o.status,
      o.planned_date || '', o.actual_date || '',
      o.worker_name || '', o.machine_name || '', o.attachment_name || '',
      (o.remarks || '').replace(/,/g, ';'),
    ].join(','));
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `work_orders_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  if (loading) return (
    <div className="p-4 animate-pulse space-y-3">
      <div className="h-8 w-52 bg-muted rounded"/>
      {[...Array(5)].map((_,i) => <div key={i} className="h-14 bg-muted rounded-lg"/>)}
    </div>
  );

  const stats = {
    total:      orders.length,
    planned:    orders.filter(o => o.status === 'Planned').length,
    inProgress: orders.filter(o => o.status === 'In Progress').length,
    completed:  orders.filter(o => o.status === 'Completed').length,
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-base font-bold">{wo.title}</h1>
          <p className="text-[11px] text-muted-foreground">
            {stats.total} total · {stats.planned} planned · {stats.inProgress} in progress · {stats.completed} completed
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV}
            className="h-8 px-3 rounded border border-border text-[11px] text-muted-foreground hover:text-foreground transition-colors">
            {cm.exportCSV}
          </button>
          <button onClick={openNew}
            className="h-8 px-3 rounded bg-[#155d31] text-white text-[11px] font-medium hover:bg-[#0f4424] transition-colors">
            + {wo.new}
          </button>
        </div>
      </div>

      {/* KPI chips */}
      <div className="flex gap-2 flex-wrap">
        {[
          { label: 'Planned',     count: stats.planned,    color: '#475569' },
          { label: 'In Progress', count: stats.inProgress, color: '#d97706' },
          { label: 'Completed',   count: stats.completed,  color: '#15803d' },
          { label: 'Cancelled',   count: orders.filter(o=>o.status==='Cancelled').length, color: '#dc2626' },
        ].map(s => (
          <div key={s.label} className="px-3 py-1.5 rounded-lg border border-border bg-card text-[11px] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{background: s.color}}/>
            <span className="text-muted-foreground">{s.label}</span>
            <span className="font-bold" style={{color: s.color}}>{s.count}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input type="text" placeholder={cm.search} value={search} onChange={e => setSearch(e.target.value)}
          className="h-7 px-2.5 rounded border border-border bg-card text-[11px] w-44 focus:outline-none focus:ring-1 focus:ring-[#155d31]"/>
        <div className="flex gap-1 flex-wrap">
          {['all', ...WO_STATUSES].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={['px-2 py-1 rounded text-[10px] border',
                filterStatus===s ? 'bg-[#155d31] text-white border-[#155d31]' : 'border-border text-muted-foreground'].join(' ')}>
              {s === 'all' ? cm.all : s}
            </button>
          ))}
        </div>
        <div className="flex gap-1 flex-wrap">
          {['all', ...TASK_TYPES].map(tt => (
            <button key={tt} onClick={() => setFilterTask(tt)}
              className={['px-2 py-1 rounded text-[10px] border',
                filterTask===tt ? 'bg-[#155d31] text-white border-[#155d31]' : 'border-border text-muted-foreground'].join(' ')}>
              {tt === 'all' ? cm.all : (lang === 'th' ? (translations.th.workOrders as any)[tt] : tt)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden text-[11px]">
        {/* Desktop header */}
        <div className="hidden lg:grid px-3 py-2 bg-muted/40 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wide"
          style={{gridTemplateColumns: '80px 90px 90px 100px 90px 110px 110px 110px 110px'}}>
          <div>{wo.field}</div>
          <div>{wo.cpNo}</div>
          <div>{wo.taskType}</div>
          <div>{t.common.status}</div>
          <div>{wo.plannedDate}</div>
          <div>{wo.worker}</div>
          <div>{wo.machine}</div>
          <div>{wo.attachment}</div>
          <div>{cm.actions}</div>
        </div>
        <div className="divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-[12px]">{cm.noData}</div>
          ) : filtered.map(o => {
            const ss = STATUS_STYLE[o.status] || STATUS_STYLE['Planned'];
            const ts = TASK_STYLE[o.task_type] || TASK_STYLE['Plowing'];
            return (
              <div key={o.id}>
                {/* Desktop */}
                <div className="hidden lg:grid px-3 py-2.5 items-center gap-2 hover:bg-muted/20"
                  style={{gridTemplateColumns: '80px 90px 90px 100px 90px 110px 110px 110px 110px'}}>
                  <div className="font-mono font-semibold">{o.field_code || '—'}</div>
                  <div className="text-muted-foreground text-[10px]">{o.cp_no || '—'}</div>
                  <div>
                    <span className="px-1.5 py-0.5 rounded-full text-[10px]" style={{background: ts.bg, color: ts.text}}>
                      {lang === 'th' ? (translations.th.workOrders as any)[o.task_type] : o.task_type}
                    </span>
                  </div>
                  <div>
                    <span className="px-1.5 py-0.5 rounded-full text-[10px]" style={{background: ss.bg, color: ss.text}}>
                      {lang === 'th' ? (translations.th.status as any)[o.status] || o.status : o.status}
                    </span>
                  </div>
                  <div className="text-muted-foreground">{fmtDate(o.planned_date)}</div>
                  <div className="truncate">{o.worker_name || <span className="text-muted-foreground/50">—</span>}</div>
                  <div className="truncate">{o.machine_name || <span className="text-muted-foreground/50">—</span>}</div>
                  <div className="truncate">{o.attachment_name || <span className="text-muted-foreground/50">—</span>}</div>
                  <div className="flex gap-1 flex-wrap">
                    {o.status === 'Planned' && (
                      <button onClick={() => handleQuickStatus(o.id, 'In Progress')}
                        className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 text-[9px] font-medium">
                        {wo.markProgress}
                      </button>
                    )}
                    {o.status === 'In Progress' && (
                      <button onClick={() => handleQuickStatus(o.id, 'Completed')}
                        className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200 text-[9px] font-medium">
                        {wo.markDone}
                      </button>
                    )}
                    <button onClick={() => openEdit(o)}
                      className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 text-[9px] font-medium">
                      {cm.edit}
                    </button>
                    {o.status !== 'Cancelled' && o.status !== 'Completed' && (
                      <button onClick={() => handleQuickStatus(o.id, 'Cancelled')}
                        className="px-1.5 py-0.5 rounded bg-red-50 text-red-600 hover:bg-red-100 text-[9px] font-medium">
                        {wo.cancel}
                      </button>
                    )}
                  </div>
                </div>

                {/* Mobile */}
                <div className="lg:hidden px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[12px]">{o.field_code || '—'}</span>
                    <span className="px-1.5 py-0.5 rounded-full text-[9px]" style={{background: ts.bg, color: ts.text}}>
                      {o.task_type}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-full text-[9px]" style={{background: ss.bg, color: ss.text}}>
                      {o.status}
                    </span>
                    <span className="ml-auto flex gap-1">
                      <button onClick={() => openEdit(o)} className="text-blue-500 text-[11px]">✎</button>
                    </span>
                  </div>
                  <div className="flex gap-3 text-[10px] text-muted-foreground mt-0.5 flex-wrap">
                    {o.cp_no && <span>{o.cp_no}</span>}
                    {o.planned_date && <span>📅 {fmtDate(o.planned_date)}</span>}
                    {o.worker_name && <span>👷 {o.worker_name}</span>}
                    {o.machine_name && <span>🚜 {o.machine_name}</span>}
                  </div>
                  <div className="flex gap-1 mt-1.5">
                    {o.status === 'Planned' && (
                      <button onClick={() => handleQuickStatus(o.id, 'In Progress')}
                        className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-[9px]">{wo.markProgress}</button>
                    )}
                    {o.status === 'In Progress' && (
                      <button onClick={() => handleQuickStatus(o.id, 'Completed')}
                        className="px-2 py-0.5 rounded bg-green-100 text-green-700 text-[9px]">{wo.markDone}</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-[13px] font-bold">{editId ? wo.edit : wo.new}</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
            </div>
            <div className="p-5 space-y-4 text-[12px]">
              {/* Field & CP */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-1 font-medium">{wo.field}</label>
                  <select value={form.field_code}
                    onChange={e => setForm(f => ({ ...f, field_code: e.target.value, cp_id: '' }))}
                    className="w-full h-8 px-2 rounded border border-border bg-background text-[11px] focus:outline-none focus:ring-1 focus:ring-[#155d31]">
                    <option value="">{wo.selectField}</option>
                    {fields.map(f => <option key={f.id} value={f.field_code}>{f.field_code}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-1 font-medium">{wo.cpNo}</label>
                  <select value={form.cp_id}
                    onChange={e => setForm(f => ({ ...f, cp_id: e.target.value }))}
                    className="w-full h-8 px-2 rounded border border-border bg-background text-[11px] focus:outline-none focus:ring-1 focus:ring-[#155d31]">
                    <option value="">{cm.none}</option>
                    {cpOptions.map(c => <option key={c.id} value={c.id}>{c.cp_no} ({c.crop_name})</option>)}
                  </select>
                </div>
              </div>

              {/* Task type & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-1 font-medium">{wo.taskType}</label>
                  <select value={form.task_type}
                    onChange={e => setForm(f => ({ ...f, task_type: e.target.value as typeof TASK_TYPES[number] }))}
                    className="w-full h-8 px-2 rounded border border-border bg-background text-[11px] focus:outline-none focus:ring-1 focus:ring-[#155d31]">
                    {TASK_TYPES.map(tt => (
                      <option key={tt} value={tt}>
                        {lang === 'th' ? (translations.th.workOrders as any)[tt] : tt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-1 font-medium">{t.common.status}</label>
                  <select value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as typeof WO_STATUSES[number] }))}
                    className="w-full h-8 px-2 rounded border border-border bg-background text-[11px] focus:outline-none focus:ring-1 focus:ring-[#155d31]">
                    {WO_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Planned / Actual dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-1 font-medium">{wo.plannedDate}</label>
                  <input type="date" value={form.planned_date}
                    onChange={e => setForm(f => ({ ...f, planned_date: e.target.value }))}
                    className="w-full h-8 px-2 rounded border border-border bg-background text-[11px] focus:outline-none focus:ring-1 focus:ring-[#155d31]"/>
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-1 font-medium">{wo.actualDate}</label>
                  <input type="date" value={form.actual_date}
                    onChange={e => setForm(f => ({ ...f, actual_date: e.target.value }))}
                    className="w-full h-8 px-2 rounded border border-border bg-background text-[11px] focus:outline-none focus:ring-1 focus:ring-[#155d31]"/>
                </div>
              </div>

              {/* Worker */}
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1 font-medium">{wo.worker}</label>
                <select value={form.assigned_worker_id}
                  onChange={e => setForm(f => ({ ...f, assigned_worker_id: e.target.value }))}
                  className="w-full h-8 px-2 rounded border border-border bg-background text-[11px] focus:outline-none focus:ring-1 focus:ring-[#155d31]">
                  <option value="">{wo.selectWorker}</option>
                  {workers.map(w => <option key={w.id} value={w.id}>{w.worker_name} ({w.worker_code})</option>)}
                </select>
              </div>

              {/* Machine (Tractor) */}
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1 font-medium">{wo.machine}</label>
                <select value={form.assigned_machine_id}
                  onChange={e => setForm(f => ({ ...f, assigned_machine_id: e.target.value, assigned_attachment_id: '' }))}
                  className="w-full h-8 px-2 rounded border border-border bg-background text-[11px] focus:outline-none focus:ring-1 focus:ring-[#155d31]">
                  <option value="">{wo.selectMachine}</option>
                  {machines.filter(m => !m.machine_type || m.machine_type.toLowerCase().includes('tractor') || m.machine_type.toLowerCase().includes('แทรกเตอร์')).map(m => (
                    <option key={m.id} value={m.id}>{m.machine_name || m.machine_code} [{m.status}]</option>
                  ))}
                  {/* Show all machines as fallback */}
                  {machines.filter(m => m.machine_type && !m.machine_type.toLowerCase().includes('tractor') && !m.machine_type.toLowerCase().includes('แทรกเตอร์')).map(m => (
                    <option key={m.id} value={m.id}>{m.machine_name || m.machine_code} ({m.machine_type})</option>
                  ))}
                </select>
              </div>

              {/* Attachment */}
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1 font-medium">{wo.attachment}</label>
                <select value={form.assigned_attachment_id}
                  onChange={e => setForm(f => ({ ...f, assigned_attachment_id: e.target.value }))}
                  className="w-full h-8 px-2 rounded border border-border bg-background text-[11px] focus:outline-none focus:ring-1 focus:ring-[#155d31]">
                  <option value="">{wo.selectAttachment}</option>
                  {attachments.map(a => (
                    <option key={a.id} value={a.id}>{a.attachment_name} ({a.attachment_type || a.attachment_code})</option>
                  ))}
                </select>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1 font-medium">{wo.remarks}</label>
                <textarea value={form.remarks} rows={2}
                  onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                  className="w-full px-2 py-1.5 rounded border border-border bg-background text-[11px] focus:outline-none focus:ring-1 focus:ring-[#155d31] resize-none"/>
              </div>
            </div>
            <div className="flex gap-2 justify-end px-5 py-4 border-t border-border">
              <button onClick={() => setShowForm(false)}
                className="h-8 px-4 rounded border border-border text-[11px] text-muted-foreground hover:text-foreground">
                {cm.cancel}
              </button>
              <button onClick={handleSave} disabled={saving}
                className="h-8 px-4 rounded bg-[#155d31] text-white text-[11px] font-medium disabled:opacity-50">
                {saving ? cm.saving : cm.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-card rounded-xl border border-border shadow-2xl p-6 w-80 text-center">
            <div className="text-3xl mb-3">🗑</div>
            <p className="text-[13px] font-medium mb-4">{wo.confirmDelete}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setConfirmDelete(null)}
                className="h-8 px-5 rounded border border-border text-[11px]">{cm.cancel}</button>
              <button onClick={() => handleDelete(confirmDelete)}
                className="h-8 px-5 rounded bg-red-600 text-white text-[11px]">{cm.delete}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
