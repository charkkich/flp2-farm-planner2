'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  supabase,
  type WorkOrder, type Worker, type Machine, type Attachment,
  type CropPlan, type FieldActivity,
  fmtDate, daysUntil, fmtDuration,
} from '@/lib/supabase';
import { useLang } from '@/components/providers';
import { translations } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';

// ── Types ─────────────────────────────────────────────────────────────────────
type WOEnriched = WorkOrder & {
  worker_name?: string;
  machine_name?: string;
  attachment_name?: string;
  cp_no?: string;
  area_m2_from_cp?: number | null;
  required_ready_date?: string | null;
  crop_name?: string | null;
};

type Section = 'in_progress' | 'overdue' | 'today' | 'upcoming';

const TASK_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  'Plowing':      { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' },
  'Harrowing':    { bg: '#f3e8ff', text: '#7c3aed', border: '#c4b5fd' },
  'Ridging':      { bg: '#fef9c3', text: '#a16207', border: '#fde68a' },
  'Re-Plowing':   { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' },
  'Re-Harrowing': { bg: '#fdf2f8', text: '#a21caf', border: '#f0abfc' },
  'Re-Ridging':   { bg: '#fff7ed', text: '#c2410c', border: '#fdba74' },
};

// ── RainEventModal ────────────────────────────────────────────────────────────
function RainEventModal({
  fieldCode, cpId, onClose, onSaved,
}: { fieldCode: string; cpId: string | null; onClose: () => void; onSaved: () => void }) {
  const { lang } = useLang();
  const dt = translations[lang].dailyTasks;
  const [intensity, setIntensity] = useState<'Light' | 'Moderate' | 'Heavy'>('Moderate');
  const [step, setStep] = useState<'intensity' | 'rework'>('intensity');
  const [saving, setSaving] = useState(false);
  const [reworkType, setReworkType] = useState('');

  async function recordRain(needsRework: boolean) {
    setSaving(true);
    // 1. Create rain event activity
    await supabase.from('field_activities').insert({
      field_code: fieldCode,
      cp_id: cpId || null,
      activity_type: 'Rain Event',
      activity_date: new Date().toISOString().split('T')[0],
      rain_intensity: intensity,
      requires_rework: needsRework,
      remarks: `${intensity} rain recorded`,
    });

    // 2. Create rework work order if needed
    if (needsRework && reworkType) {
      const today = new Date().toISOString().split('T')[0];
      await supabase.from('work_orders').insert({
        cp_id: cpId || null,
        field_code: fieldCode,
        task_type: reworkType,
        status: 'Planned',
        planned_date: today,
        remarks: `Rework after ${intensity} rain`,
      });
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌧</span>
            <h2 className="text-[13px] font-bold">{dt.rainImpact} — {fieldCode}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>

        {step === 'intensity' && (
          <div className="p-5 space-y-4">
            <div>
              <div className="text-[11px] font-medium text-muted-foreground mb-2">{dt.rainIntensity}</div>
              <div className="grid grid-cols-3 gap-2">
                {(['Light','Moderate','Heavy'] as const).map(v => (
                  <button key={v} onClick={() => setIntensity(v)}
                    className={[
                      'py-2.5 rounded-lg border text-[11px] font-medium transition-colors',
                      intensity === v
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-border text-muted-foreground hover:bg-muted/40',
                    ].join(' ')}>
                    {v === 'Light' ? `🌦 ${dt.rainLight}` : v === 'Moderate' ? `🌧 ${dt.rainModerate}` : `⛈ ${dt.rainHeavy}`}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => setStep('rework')}
              className="w-full py-2.5 rounded-lg bg-[#155d31] text-white text-[12px] font-medium">
              {dt.createRainEvent} →
            </button>
          </div>
        )}

        {step === 'rework' && (
          <div className="p-5 space-y-4">
            <div className="text-[12px] font-medium">{dt.needsRework}</div>
            <div>
              <div className="text-[11px] text-muted-foreground mb-2">{dt.reworkType}</div>
              <div className="grid grid-cols-3 gap-2">
                {['Re-Plowing','Re-Harrowing','Re-Ridging'].map(r => (
                  <button key={r} onClick={() => setReworkType(r)}
                    className={[
                      'py-2 rounded-lg border text-[10px] font-medium transition-colors',
                      reworkType === r
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'border-border text-muted-foreground hover:bg-muted/40',
                    ].join(' ')}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => recordRain(false)} disabled={saving}
                className="py-2.5 rounded-lg border border-border text-[11px] text-muted-foreground disabled:opacity-50">
                {dt.reworkNo}
              </button>
              <button onClick={() => recordRain(true)} disabled={saving || !reworkType}
                className="py-2.5 rounded-lg bg-amber-600 text-white text-[11px] font-medium disabled:opacity-50">
                {saving ? '…' : dt.reworkYes}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── StartTaskModal ────────────────────────────────────────────────────────────
function StartTaskModal({
  wo, machines, attachments, onClose, onStarted,
}: {
  wo: WOEnriched;
  machines: Machine[];
  attachments: Attachment[];
  onClose: () => void;
  onStarted: () => void;
}) {
  const { lang } = useLang();
  const dt = translations[lang].dailyTasks;
  const [machineId, setMachineId]     = useState(wo.assigned_machine_id || '');
  const [attachmentId, setAttachmentId] = useState(wo.assigned_attachment_id || '');
  const [saving, setSaving] = useState(false);

  async function handleStart() {
    setSaving(true);
    const now = new Date().toISOString();
    await supabase.from('work_orders').update({
      status: 'In Progress',
      actual_start: now,
      assigned_machine_id:    machineId    || null,
      assigned_attachment_id: attachmentId || null,
    }).eq('id', wo.id);

    // Record field activity
    await supabase.from('field_activities').insert({
      field_code:    wo.field_code,
      cp_id:         wo.cp_id,
      work_order_id: wo.id,
      activity_type: wo.task_type,
      activity_date: new Date().toISOString().split('T')[0],
      worker_id:     wo.assigned_worker_id,
      machine_id:    machineId    || null,
      attachment_id: attachmentId || null,
      area_m2:       wo.area_m2 || wo.area_m2_from_cp,
      remarks:       'Started',
    });
    setSaving(false);
    onStarted();
  }

  const tc = TASK_COLOR[wo.task_type] || TASK_COLOR['Plowing'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <span className="px-2 py-1 rounded-lg text-[11px] font-bold"
              style={{ background: tc.bg, color: tc.text }}>{wo.task_type}</span>
            <div>
              <div className="text-[13px] font-bold">{wo.field_code}</div>
              <div className="text-[10px] text-muted-foreground">{wo.cp_no} · {wo.crop_name}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <div className="p-5 space-y-3 text-[12px]">
          <div>
            <label className="block text-[10px] text-muted-foreground mb-1 font-medium">
              {dt.selectMachine}
            </label>
            <select value={machineId} onChange={e => setMachineId(e.target.value)}
              className="w-full h-9 px-2.5 rounded border border-border bg-background text-[11px] focus:outline-none focus:ring-1 focus:ring-[#155d31]">
              <option value="">{dt.selectMachine}</option>
              {machines.map(m => (
                <option key={m.id} value={m.id}>
                  {m.machine_code} — {m.machine_name || m.machine_type || ''}
                  {m.status !== 'Available' ? ` [${m.status}]` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-muted-foreground mb-1 font-medium">
              {dt.selectAttachment}
            </label>
            <select value={attachmentId} onChange={e => setAttachmentId(e.target.value)}
              className="w-full h-9 px-2.5 rounded border border-border bg-background text-[11px] focus:outline-none focus:ring-1 focus:ring-[#155d31]">
              <option value="">— {translations[lang].common.none} —</option>
              {attachments.map(a => (
                <option key={a.id} value={a.id}>
                  {a.attachment_name} ({a.attachment_type || a.attachment_code})
                </option>
              ))}
            </select>
          </div>
          {wo.area_m2_from_cp && (
            <div className="text-[10px] text-muted-foreground bg-muted/40 rounded px-2.5 py-1.5">
              📐 {dt.fieldArea}: {wo.area_m2_from_cp.toLocaleString()} m²
              {wo.required_ready_date && (
                <> · ⏰ {dt.requiredReady}: {fmtDate(wo.required_ready_date)}</>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose}
            className="flex-1 h-9 rounded border border-border text-[11px] text-muted-foreground">
            {translations[lang].common.cancel}
          </button>
          <button onClick={handleStart} disabled={saving}
            className="flex-1 h-9 rounded bg-[#155d31] text-white text-[12px] font-bold disabled:opacity-50">
            {saving ? '…' : `▶ ${dt.startWork}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Task Card ─────────────────────────────────────────────────────────────────
function TaskCard({
  wo, section, onStart, onComplete, onRain,
}: {
  wo: WOEnriched;
  section: Section;
  onStart: () => void;
  onComplete: () => void;
  onRain: () => void;
}) {
  const { lang } = useLang();
  const dt = translations[lang].dailyTasks;
  const tc = TASK_COLOR[wo.task_type] || TASK_COLOR['Plowing'];
  const dl = daysUntil(wo.required_ready_date || null);

  const urgencyColor =
    section === 'overdue'      ? '#dc2626' :
    section === 'in_progress'  ? '#1d4ed8' :
    dl !== null && dl <= 3     ? '#d97706' : '#15803d';

  const urgencyLabel =
    section === 'overdue'     ? `${dl !== null ? Math.abs(dl) : '?'}${dt.daysLate}` :
    section === 'in_progress' ? '▶' :
    dl !== null               ? `${dl}${dt.daysLeft}` : '—';

  const elapsedMin = wo.actual_start
    ? Math.round((Date.now() - new Date(wo.actual_start).getTime()) / 60000)
    : null;

  return (
    <div className={[
      'bg-card border rounded-xl p-3.5 space-y-2.5 transition-all',
      section === 'overdue'     ? 'border-red-300 dark:border-red-800 bg-red-50/30 dark:bg-red-950/20' :
      section === 'in_progress' ? 'border-blue-300 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/20' :
      'border-border',
    ].join(' ')}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold flex-shrink-0"
            style={{ background: tc.bg, color: tc.text, border: `1px solid ${tc.border}` }}>
            {wo.task_type}
          </span>
          <div className="min-w-0">
            <div className="font-mono font-bold text-[14px] leading-tight">{wo.field_code || '—'}</div>
            <div className="text-[10px] text-muted-foreground truncate">
              {wo.cp_no}{wo.crop_name ? ` · ${wo.crop_name}` : ''}
            </div>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[13px] font-bold" style={{ color: urgencyColor }}>{urgencyLabel}</div>
          {wo.required_ready_date && (
            <div className="text-[9px] text-muted-foreground">{fmtDate(wo.required_ready_date)}</div>
          )}
        </div>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
        {wo.area_m2_from_cp && (
          <span>📐 {wo.area_m2_from_cp.toLocaleString()} m²</span>
        )}
        {wo.planned_date && (
          <span>📅 {fmtDate(wo.planned_date)}</span>
        )}
        {wo.machine_name && (
          <span>🚜 {wo.machine_name}</span>
        )}
        {wo.attachment_name && (
          <span>🔧 {wo.attachment_name}</span>
        )}
        {elapsedMin !== null && (
          <span className="text-blue-600 font-medium">⏱ {fmtDuration(elapsedMin)}</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-0.5">
        {wo.status === 'Planned' && (
          <button onClick={onStart}
            className="flex-1 h-8 rounded-lg bg-[#155d31] text-white text-[11px] font-bold hover:bg-[#0f4424] transition-colors">
            ▶ {dt.startWork}
          </button>
        )}
        {wo.status === 'In Progress' && (
          <button onClick={onComplete}
            className="flex-1 h-8 rounded-lg bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-700 transition-colors">
            ✓ {dt.completeWork}
          </button>
        )}
        <button onClick={onRain}
          title="Record Rain Event"
          className="h-8 w-8 rounded-lg border border-border text-[14px] hover:bg-muted/40 flex items-center justify-center flex-shrink-0">
          🌧
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DailyTasksPage() {
  const { lang } = useLang();
  const dt = translations[lang].dailyTasks;
  const { toast } = useToast();

  const [workOrders,  setWorkOrders]  = useState<WOEnriched[]>([]);
  const [workers,     setWorkers]     = useState<Worker[]>([]);
  const [machines,    setMachines]    = useState<Machine[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [selectedWorker, setSelectedWorker] = useState('');
  const [startTarget,    setStartTarget]    = useState<WOEnriched | null>(null);
  const [rainTarget,     setRainTarget]     = useState<WOEnriched | null>(null);
  const [completing,     setCompleting]     = useState<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const load = useCallback(async () => {
    const [woRes, wRes, mRes, aRes, cpRes] = await Promise.all([
      supabase
        .from('work_orders')
        .select('*')
        .in('status', ['Planned', 'In Progress'])
        .order('planned_date', { ascending: true, nullsFirst: false }),
      supabase.from('workers').select('*').eq('is_active', true).order('worker_name'),
      supabase.from('machines').select('*').eq('is_active', true).order('machine_name'),
      supabase.from('attachments').select('*').eq('is_active', true).order('attachment_name'),
      supabase.from('crop_plans').select('id,cp_no,crop_name,area_m2,required_ready_date'),
    ]);

    const wMap  = Object.fromEntries((wRes.data  || []).map(w => [w.id, w.worker_name]));
    const mMap  = Object.fromEntries((mRes.data  || []).map(m => [m.id, m.machine_name || m.machine_code]));
    const aMap  = Object.fromEntries((aRes.data  || []).map(a => [a.id, a.attachment_name]));
    const cpMap = Object.fromEntries((cpRes.data || []).map((c: any) => [c.id, c]));

    const enriched = (woRes.data || []).map((o): WOEnriched => {
      const cp = o.cp_id ? cpMap[o.cp_id] : null;
      return {
        ...o,
        worker_name:      o.assigned_worker_id     ? wMap[o.assigned_worker_id]     : undefined,
        machine_name:     o.assigned_machine_id     ? mMap[o.assigned_machine_id]    : undefined,
        attachment_name:  o.assigned_attachment_id  ? aMap[o.assigned_attachment_id] : undefined,
        cp_no:            cp?.cp_no            || undefined,
        area_m2_from_cp:  cp?.area_m2          || null,
        required_ready_date: cp?.required_ready_date || null,
        crop_name:        cp?.crop_name        || null,
      };
    });

    setWorkOrders(enriched);
    setWorkers(wRes.data  || []);
    setMachines(mRes.data || []);
    setAttachments(aRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Filter by selected worker
  const filtered = useMemo(() => {
    let list = workOrders;
    if (selectedWorker) {
      list = list.filter(o => o.assigned_worker_id === selectedWorker);
    }
    return list;
  }, [workOrders, selectedWorker]);

  // Bucket into sections
  const sections = useMemo(() => {
    const inProgress: WOEnriched[] = [];
    const overdue:    WOEnriched[] = [];
    const today:      WOEnriched[] = [];
    const upcoming:   WOEnriched[] = [];

    filtered.forEach(wo => {
      if (wo.status === 'In Progress') { inProgress.push(wo); return; }
      if (!wo.planned_date) { today.push(wo); return; }
      if (wo.planned_date < todayStr) { overdue.push(wo); return; }
      if (wo.planned_date === todayStr) { today.push(wo); return; }
      upcoming.push(wo);
    });

    // Sort each section by urgency (required_ready_date)
    const byUrgency = (a: WOEnriched, b: WOEnriched) =>
      (a.required_ready_date || '9999').localeCompare(b.required_ready_date || '9999');

    return {
      inProgress: inProgress.sort(byUrgency),
      overdue:    overdue.sort(byUrgency),
      today:      today.sort(byUrgency),
      upcoming:   upcoming.sort(byUrgency).slice(0, 10),
    };
  }, [filtered, todayStr]);

  async function handleComplete(wo: WOEnriched) {
    setCompleting(wo.id);
    const now = new Date().toISOString();
    const startTime = wo.actual_start ? new Date(wo.actual_start).getTime() : null;
    const durMin = startTime ? Math.round((Date.now() - startTime) / 60000) : null;
    const area   = wo.area_m2 || wo.area_m2_from_cp || null;

    await supabase.from('work_orders').update({
      status:        'Completed',
      actual_finish: now,
      actual_date:   now.split('T')[0],
    }).eq('id', wo.id);

    // Update field_activity (mark the start activity as complete) or create new
    await supabase.from('field_activities').insert({
      field_code:      wo.field_code,
      cp_id:           wo.cp_id,
      work_order_id:   wo.id,
      activity_type:   wo.task_type,
      activity_date:   now.split('T')[0],
      worker_id:       wo.assigned_worker_id,
      machine_id:      wo.assigned_machine_id,
      attachment_id:   wo.assigned_attachment_id,
      area_m2:         area,
      duration_minutes: durMin,
      remarks:         durMin ? `Completed in ${Math.floor(durMin/60)}h ${durMin%60}m` : 'Completed',
    });

    const speed = (area && durMin && durMin > 0)
      ? Math.round(area / (durMin / 60))
      : null;

    toast({
      title: `✓ ${wo.field_code} ${wo.task_type} — Completed`,
      description: [
        durMin ? `Duration: ${Math.floor(durMin/60)}h ${durMin%60}m` : null,
        speed   ? `Speed: ${speed.toLocaleString()} m²/hr` : null,
      ].filter(Boolean).join(' · '),
    });

    setCompleting(null);
    load();
  }

  const totalActive = sections.inProgress.length + sections.overdue.length + sections.today.length;

  if (loading) return (
    <div className="p-4 animate-pulse space-y-3">
      <div className="h-10 w-64 bg-muted rounded-lg"/>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[...Array(6)].map((_,i) => <div key={i} className="h-32 bg-muted rounded-xl"/>)}
      </div>
    </div>
  );

  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-base font-bold">{dt.title}</h1>
          <p className="text-[11px] text-muted-foreground">
            {new Date().toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', { dateStyle: 'full' })}
            {' · '}{totalActive} {lang === 'th' ? 'งานรอดำเนินการ' : 'tasks pending'}
          </p>
        </div>
        {/* Worker selector */}
        <select value={selectedWorker} onChange={e => setSelectedWorker(e.target.value)}
          className="h-9 px-3 rounded-lg border border-border bg-card text-[12px] font-medium focus:outline-none focus:ring-1 focus:ring-[#155d31] min-w-[160px]">
          <option value="">👷 {dt.allWorkers}</option>
          {workers.map(w => (
            <option key={w.id} value={w.id}>{w.worker_name} ({w.worker_code || w.position || ''})</option>
          ))}
        </select>
      </div>

      {/* Summary chips */}
      <div className="flex gap-2 flex-wrap text-[11px]">
        {[
          { label: dt.inProgress, count: sections.inProgress.length, color: '#1d4ed8', bg: '#dbeafe' },
          { label: dt.overdue,    count: sections.overdue.length,    color: '#dc2626', bg: '#fee2e2' },
          { label: dt.today,      count: sections.today.length,      color: '#15803d', bg: '#dcfce7' },
          { label: dt.upcoming,   count: sections.upcoming.length,   color: '#6b7280', bg: '#f3f4f6' },
        ].map(s => (
          <div key={s.label} className="px-3 py-1.5 rounded-full flex items-center gap-1.5"
            style={{ background: s.bg, color: s.color }}>
            <span className="font-bold text-[13px]">{s.count}</span>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {totalActive === 0 && sections.upcoming.length === 0 && (
        <div className="py-16 text-center text-muted-foreground">
          <div className="text-4xl mb-3">✅</div>
          <div className="text-[13px] font-medium">{dt.noTasks}</div>
        </div>
      )}

      {/* ── In Progress ──────────────────────────────────────────────────────── */}
      {sections.inProgress.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"/>
            <h2 className="text-[12px] font-bold text-blue-600">{dt.inProgress}</h2>
            <span className="text-[10px] text-muted-foreground">({sections.inProgress.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sections.inProgress.map(wo => (
              <TaskCard key={wo.id} wo={wo} section="in_progress"
                onStart={() => setStartTarget(wo)}
                onComplete={() => handleComplete(wo)}
                onRain={() => setRainTarget(wo)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Overdue ──────────────────────────────────────────────────────────── */}
      {sections.overdue.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500"/>
            <h2 className="text-[12px] font-bold text-red-600">{dt.overdue}</h2>
            <span className="text-[10px] text-muted-foreground">({sections.overdue.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sections.overdue.map(wo => (
              <TaskCard key={wo.id} wo={wo} section="overdue"
                onStart={() => setStartTarget(wo)}
                onComplete={() => handleComplete(wo)}
                onRain={() => setRainTarget(wo)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Today ────────────────────────────────────────────────────────────── */}
      {sections.today.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500"/>
            <h2 className="text-[12px] font-bold text-green-700">{dt.today}</h2>
            <span className="text-[10px] text-muted-foreground">({sections.today.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sections.today.map(wo => (
              <TaskCard key={wo.id} wo={wo} section="today"
                onStart={() => setStartTarget(wo)}
                onComplete={() => handleComplete(wo)}
                onRain={() => setRainTarget(wo)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Upcoming ─────────────────────────────────────────────────────────── */}
      {sections.upcoming.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-400"/>
            <h2 className="text-[12px] font-bold text-muted-foreground">{dt.upcoming}</h2>
            <span className="text-[10px] text-muted-foreground">({sections.upcoming.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sections.upcoming.map(wo => (
              <TaskCard key={wo.id} wo={wo} section="upcoming"
                onStart={() => setStartTarget(wo)}
                onComplete={() => handleComplete(wo)}
                onRain={() => setRainTarget(wo)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      {startTarget && (
        <StartTaskModal
          wo={startTarget}
          machines={machines}
          attachments={attachments}
          onClose={() => setStartTarget(null)}
          onStarted={() => { setStartTarget(null); load(); }}
        />
      )}
      {rainTarget && (
        <RainEventModal
          fieldCode={rainTarget.field_code || ''}
          cpId={rainTarget.cp_id}
          onClose={() => setRainTarget(null)}
          onSaved={() => {
            setRainTarget(null);
            toast({ title: '🌧 Rain event recorded', description: `Field ${rainTarget.field_code}` });
            load();
          }}
        />
      )}
    </div>
  );
}
