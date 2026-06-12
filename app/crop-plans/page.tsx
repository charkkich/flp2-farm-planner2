'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  supabase,
  type CropPlan, type Worker, type Machine, type FieldActivity,
  STATUS_COLORS, fmtDate, daysUntil, isOverdue, autoScheduleDates,
} from '@/lib/supabase';
import { useLang } from '@/components/providers';
import { translations } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';

const YEARS  = [2026, 2025, 2024, 2023];
const STAGES = ['Planned', 'Plowing', 'Harrowing', 'Ridging', 'Ready', 'Planted', 'Harvested'];

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ plan }: { plan: CropPlan }) {
  const stage =
    plan.status === 'Harvested' ? 'Harvested' :
    plan.status === 'Planted'   ? 'Planted'   :
    plan.status === 'Ready'     ? 'Ready'      :
    plan.status === 'Preparing' ? (plan.preparation_stage || 'Plowing') :
    'Planned';
  const idx = STAGES.indexOf(stage);
  const pct = Math.round(idx / (STAGES.length - 1) * 100);
  const bg  =
    plan.status === 'Harvested' ? '#a16207' :
    plan.status === 'Planted'   ? '#1d4ed8' :
    plan.status === 'Ready'     ? '#15803d' : '#d97706';
  return (
    <div className="flex items-center gap-1.5 w-full">
      <div className="flex-1 h-1.5 bg-muted rounded overflow-hidden">
        <div className="h-full rounded transition-all" style={{ width: `${pct}%`, background: bg }} />
      </div>
      <span className="text-[9px] text-muted-foreground w-14 flex-shrink-0 text-right truncate">{stage}</span>
    </div>
  );
}

// ── Rain Event Modal (inline) ─────────────────────────────────────────────────
function RainModal({
  plan, onClose, onSaved,
}: { plan: CropPlan; onClose: () => void; onSaved: () => void }) {
  const { lang } = useLang();
  const dt = translations[lang].dailyTasks;
  const [intensity, setIntensity] = useState<'Light' | 'Moderate' | 'Heavy'>('Moderate');
  const [step,      setStep]      = useState<'intensity' | 'rework'>('intensity');
  const [reworkType, setReworkType] = useState('');
  const [saving, setSaving] = useState(false);

  async function recordRain(needsRework: boolean) {
    setSaving(true);
    await supabase.from('field_activities').insert({
      field_code:    plan.field_code,
      cp_id:         plan.id,
      activity_type: 'Rain Event',
      activity_date: new Date().toISOString().split('T')[0],
      rain_intensity: intensity,
      requires_rework: needsRework,
      remarks: `${intensity} rain on CP ${plan.cp_no}`,
    });
    if (needsRework && reworkType) {
      await supabase.from('work_orders').insert({
        cp_id:       plan.id,
        field_code:  plan.field_code,
        task_type:   reworkType,
        status:      'Planned',
        planned_date: new Date().toISOString().split('T')[0],
        remarks:     `Rework after ${intensity} rain`,
      });
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-[13px] font-bold">🌧 {dt.rainImpact} — {plan.field_code} / {plan.cp_no}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        {step === 'intensity' && (
          <div className="p-5 space-y-4">
            <div className="text-[11px] font-medium text-muted-foreground">{dt.rainIntensity}</div>
            <div className="grid grid-cols-3 gap-2">
              {(['Light', 'Moderate', 'Heavy'] as const).map(v => (
                <button key={v} onClick={() => setIntensity(v)}
                  className={['py-2.5 rounded-lg border text-[11px] font-medium transition-colors',
                    intensity === v ? 'bg-blue-600 text-white border-blue-600' : 'border-border text-muted-foreground hover:bg-muted/40'].join(' ')}>
                  {v === 'Light' ? `🌦 ${dt.rainLight}` : v === 'Moderate' ? `🌧 ${dt.rainModerate}` : `⛈ ${dt.rainHeavy}`}
                </button>
              ))}
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
            <div className="grid grid-cols-3 gap-2">
              {['Re-Plowing', 'Re-Harrowing', 'Re-Ridging'].map(r => (
                <button key={r} onClick={() => setReworkType(r)}
                  className={['py-2 rounded-lg border text-[10px] font-medium',
                    reworkType === r ? 'bg-amber-500 text-white border-amber-500' : 'border-border text-muted-foreground hover:bg-muted/40'].join(' ')}>
                  {r}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => recordRain(false)} disabled={saving}
                className="py-2.5 rounded-lg border border-border text-[11px] text-muted-foreground">
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

// ── Activity History Modal ────────────────────────────────────────────────────
function ActivityModal({
  plan, workers, machines, onClose,
}: { plan: CropPlan; workers: Worker[]; machines: Machine[]; onClose: () => void }) {
  const { lang } = useLang();
  const at = translations[lang].activity;
  const [activities, setActivities] = useState<FieldActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('field_activities')
      .select('*')
      .eq('field_code', plan.field_code || '')
      .order('activity_date', { ascending: false })
      .then(({ data }) => { setActivities(data || []); setLoading(false); });
  }, [plan.field_code]);

  const wMap = Object.fromEntries(workers.map(w => [w.id, w.worker_name]));
  const mMap = Object.fromEntries(machines.map(m => [m.id, m.machine_name || m.machine_code]));

  const typeColor: Record<string, string> = {
    'Plowing': '#dbeafe', 'Harrowing': '#f3e8ff', 'Ridging': '#fef9c3',
    'Rain Event': '#bfdbfe', 'Planting': '#dcfce7', 'Harvest': '#fdf4e7',
    'Re-Plowing': '#fee2e2', 'Re-Harrowing': '#fdf2f8', 'Re-Ridging': '#fff7ed',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-[13px] font-bold">{at.title}</h2>
            <p className="text-[10px] text-muted-foreground">{plan.field_code} · {plan.cp_no}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="animate-pulse space-y-2">
              {[...Array(4)].map((_,i) => <div key={i} className="h-12 bg-muted rounded"/>)}
            </div>
          ) : activities.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-[12px]">{at.noActivity}</div>
          ) : (
            <div className="space-y-2">
              {activities.map(a => (
                <div key={a.id} className="flex gap-3 text-[11px] rounded-lg border border-border p-2.5">
                  <div className="flex-shrink-0 w-16 text-[10px] text-muted-foreground">
                    {fmtDate(a.activity_date)}
                  </div>
                  <div className="flex-shrink-0">
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium"
                      style={{ background: typeColor[a.activity_type] || '#f1f5f9', color: '#1e293b' }}>
                      {a.activity_type}
                      {a.rain_intensity ? ` (${a.rain_intensity})` : ''}
                    </span>
                  </div>
                  <div className="flex-1 text-muted-foreground text-[10px] space-y-0.5">
                    {a.worker_id  && <div>👷 {wMap[a.worker_id]  || a.worker_id}</div>}
                    {a.machine_id && <div>🚜 {mMap[a.machine_id] || a.machine_id}</div>}
                    {a.area_m2    && <div>📐 {a.area_m2.toLocaleString()} m²</div>}
                    {a.duration_minutes && <div>⏱ {Math.floor(a.duration_minutes/60)}h {a.duration_minutes%60}m</div>}
                    {a.remarks    && <div className="italic">{a.remarks}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CropPlansPage() {
  const { lang } = useLang();
  const { toast } = useToast();

  const [plans,    setPlans]    = useState<CropPlan[]>([]);
  const [workers,  setWorkers]  = useState<Worker[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [year,     setYear]     = useState(2026);
  const [cropF,    setCropF]    = useState('all');
  const [fieldF,   setFieldF]   = useState('');
  const [statusF,  setStatusF]  = useState('all');
  const [editP,    setEditP]    = useState<CropPlan | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [rainPlan, setRainPlan] = useState<CropPlan | null>(null);
  const [histPlan, setHistPlan] = useState<CropPlan | null>(null);
  const [autoTasks, setAutoTasks] = useState(true);

  const [form, setForm] = useState({
    cp_no: '', crop_name: '', field_code: '', plant_date: '',
    status: 'Planned', preparation_stage: '',
    assigned_worker_id: '', assigned_machine_id: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: cp }, { data: w }, { data: m }] = await Promise.all([
      supabase.from('crop_plans').select('*').order('required_ready_date', { ascending: true, nullsFirst: false }),
      supabase.from('workers').select('*').eq('is_active', true).order('worker_name'),
      supabase.from('machines').select('*').eq('is_active', true).order('machine_code'),
    ]);
    setPlans(cp || []);
    setWorkers(w || []);
    setMachines(m || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const crops = useMemo(() =>
    Array.from(new Set(plans.map(p => p.crop_name).filter((c): c is string => c !== null))).sort(),
  [plans]);

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
        return (a.required_ready_date || '9999').localeCompare(b.required_ready_date || '9999');
      });
  }, [plans, year, cropF, fieldF, statusF]);

  const kpi = useMemo(() => {
    const y = plans.filter(p => p.year === year);
    return {
      total:     y.length,
      preparing: y.filter(p => p.status === 'Preparing').length,
      ready:     y.filter(p => p.status === 'Ready').length,
      planted:   y.filter(p => p.status === 'Planted').length,
      overdue:   y.filter(p => isOverdue(p)).length,
    };
  }, [plans, year]);

  // ── Calculate required ready date ──────────────────────────────────────────
  const rrd = useMemo(() => {
    if (!form.plant_date) return null;
    const d = new Date(form.plant_date + 'T00:00:00');
    d.setDate(d.getDate() - 14);
    return d.toISOString().split('T')[0];
  }, [form.plant_date]);

  // ── Save CP + auto-generate tasks ─────────────────────────────────────────
  async function save() {
    setSaving(true);
    const pd = form.plant_date || null;
    const requiredReadyDate = rrd;

    const payload: Record<string, unknown> = {
      cp_no:               form.cp_no || null,
      crop_name:           form.crop_name || null,
      field_code:          form.field_code || null,
      plant_date:          pd,
      planned_plant_date:  pd,
      required_ready_date: requiredReadyDate,
      status:              form.status,
      preparation_stage:   form.status === 'Preparing' ? (form.preparation_stage || null) : null,
      assigned_worker_id:  form.assigned_worker_id  || null,
      assigned_machine_id: form.assigned_machine_id || null,
    };
    if (!editP) payload.year = year;

    if (editP) {
      await supabase.from('crop_plans').update(payload).eq('id', editP.id);
      toast({ title: '✓ Crop Plan updated' });
    } else {
      // Insert CP and get ID
      const { data: newCP, error } = await supabase
        .from('crop_plans')
        .insert(payload)
        .select()
        .single();

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        setSaving(false);
        return;
      }

      // Auto-generate 3 preparation tasks
      if (autoTasks && requiredReadyDate && newCP) {
        const dates = autoScheduleDates(requiredReadyDate);
        const tasks = [
          { task_type: 'Plowing',   planned_date: dates.plow   },
          { task_type: 'Harrowing', planned_date: dates.harrow },
          { task_type: 'Ridging',   planned_date: dates.ridge  },
        ];
        await supabase.from('work_orders').insert(
          tasks.map(t => ({
            cp_id:      newCP.id,
            field_code: form.field_code || null,
            task_type:  t.task_type,
            status:     'Planned',
            planned_date: t.planned_date,
          }))
        );
        toast({
          title: `✓ CP ${form.cp_no || 'created'} + 3 tasks auto-scheduled`,
          description: `Plow: ${fmtDate(dates.plow)} · Harrow: ${fmtDate(dates.harrow)} · Ridge: ${fmtDate(dates.ridge)}`,
        });
      } else {
        toast({ title: `✓ Crop Plan created` });
      }
    }

    setSaving(false);
    setEditP(null);
    setCreating(false);
    load();
  }

  function openEdit(p: CropPlan) {
    setEditP(p);
    setCreating(false);
    setForm({
      cp_no:               p.cp_no || '',
      crop_name:           p.crop_name || '',
      field_code:          p.field_code || '',
      plant_date:          p.plant_date || p.planned_plant_date || '',
      status:              p.status,
      preparation_stage:   p.preparation_stage || '',
      assigned_worker_id:  p.assigned_worker_id || '',
      assigned_machine_id: p.assigned_machine_id || '',
    });
  }

  if (loading) return (
    <div className="p-4 animate-pulse space-y-2">
      {[...Array(10)].map((_, i) => <div key={i} className="h-10 bg-muted rounded" />)}
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-base font-bold">
            {lang === 'th' ? 'แผนปลูก' : 'Crop Plans'}
          </h1>
          <p className="text-[11px] text-muted-foreground">{filtered.length} shown</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="flex gap-1">
            {YEARS.map(y => (
              <button key={y} onClick={() => setYear(y)}
                className={['px-2.5 py-1 rounded text-[11px] border',
                  y === year ? 'bg-[#155d31] text-white border-[#155d31]' : 'border-border text-muted-foreground'].join(' ')}>
                {y}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              setCreating(true); setEditP(null);
              setForm({ cp_no: '', crop_name: '', field_code: '', plant_date: '', status: 'Planned', preparation_stage: '', assigned_worker_id: '', assigned_machine_id: '' });
            }}
            className="px-3 py-1.5 rounded bg-[#155d31] text-white text-[11px] font-medium">
            + {lang === 'th' ? 'เพิ่มแผน' : 'Add CP'}
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { l: lang === 'th' ? 'ทั้งหมด' : 'Total',    v: kpi.total,     c: 'text-foreground' },
          { l: lang === 'th' ? 'เตรียม'  : 'Preparing', v: kpi.preparing, c: 'text-amber-600' },
          { l: lang === 'th' ? 'พร้อม'   : 'Ready',     v: kpi.ready,     c: 'text-green-700' },
          { l: lang === 'th' ? 'ปลูกแล้ว': 'Planted',   v: kpi.planted,   c: 'text-blue-600' },
          { l: lang === 'th' ? 'ล่าช้า'  : 'Overdue',   v: kpi.overdue,   c: 'text-red-600' },
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
          <div className="text-[12px] font-semibold">
            {editP ? `Edit: ${editP.cp_no || 'CP'}` : (lang === 'th' ? 'แผนปลูกใหม่' : 'New Crop Plan')}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {([
              ['CP No', 'cp_no', 'text'],
              [lang === 'th' ? 'ชื่อพืช' : 'Crop Name', 'crop_name', 'text'],
              [lang === 'th' ? 'รหัสแปลง' : 'Field Code', 'field_code', 'text'],
              [lang === 'th' ? 'วันปลูก' : 'Plant Date', 'plant_date', 'date'],
            ] as [string, string, string][]).map(([l, k, tp]) => (
              <div key={k}>
                <label className="text-[11px] text-muted-foreground block mb-1">{l}</label>
                <input type={tp} value={(form as any)[k]}
                  onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                  className="w-full h-8 px-2 rounded border border-border bg-background text-[11px] focus:outline-none focus:ring-1 focus:ring-[#155d31]" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full h-8 px-2 rounded border border-border bg-background text-[11px]">
                {['Planned', 'Preparing', 'Ready', 'Planted', 'Harvested'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            {form.status === 'Preparing' && (
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">Stage</label>
                <select value={form.preparation_stage}
                  onChange={e => setForm(f => ({ ...f, preparation_stage: e.target.value }))}
                  className="w-full h-8 px-2 rounded border border-border bg-background text-[11px]">
                  <option value="">Select…</option>
                  {['Plowing', 'Harrowing', 'Ridging'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Worker</label>
              <select value={form.assigned_worker_id}
                onChange={e => setForm(f => ({ ...f, assigned_worker_id: e.target.value }))}
                className="w-full h-8 px-2 rounded border border-border bg-background text-[11px]">
                <option value="">— None —</option>
                {workers.map(w => <option key={w.id} value={w.id}>{w.worker_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Machine</label>
              <select value={form.assigned_machine_id}
                onChange={e => setForm(f => ({ ...f, assigned_machine_id: e.target.value }))}
                className="w-full h-8 px-2 rounded border border-border bg-background text-[11px]">
                <option value="">— None —</option>
                {machines.map(m => (
                  <option key={m.id} value={m.id}>{m.machine_code}{m.machine_name ? ` · ${m.machine_name}` : ''}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Auto-schedule preview */}
          {!editP && rrd && (
            <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold text-green-800 dark:text-green-400">
                  ⚡ {lang === 'th' ? 'สร้างงานอัตโนมัติ' : 'Auto-generate 3 preparation tasks'}
                </div>
                <label className="flex items-center gap-1.5 text-[10px] cursor-pointer">
                  <input type="checkbox" checked={autoTasks}
                    onChange={e => setAutoTasks(e.target.checked)} className="rounded" />
                  {lang === 'th' ? 'เปิดใช้' : 'Enable'}
                </label>
              </div>
              {autoTasks && (() => {
                const dates = autoScheduleDates(rrd);
                return (
                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    {[
                      { label: 'Plowing',   date: dates.plow,   color: '#1d4ed8' },
                      { label: 'Harrowing', date: dates.harrow, color: '#7c3aed' },
                      { label: 'Ridging',   date: dates.ridge,  color: '#a16207' },
                    ].map(t => (
                      <div key={t.label} className="text-center bg-white dark:bg-card rounded border border-green-200 dark:border-green-800 py-1.5">
                        <div className="font-semibold" style={{ color: t.color }}>{t.label}</div>
                        <div className="text-muted-foreground">{fmtDate(t.date)}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
              <div className="text-[10px] text-muted-foreground">
                {lang === 'th' ? `วันพร้อม: ${fmtDate(rrd)} (วันปลูก − 14 วัน)` : `Required Ready: ${fmtDate(rrd)} (plant date − 14 days)`}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="px-4 py-1.5 rounded bg-[#155d31] text-white text-[11px] font-medium disabled:opacity-50">
              {saving ? (lang === 'th' ? 'กำลังบันทึก…' : 'Saving…') : (lang === 'th' ? 'บันทึก' : 'Save')}
            </button>
            <button onClick={() => { setEditP(null); setCreating(false); }}
              className="px-4 py-1.5 rounded border border-border text-[11px]">
              {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <input placeholder="Field…" value={fieldF} onChange={e => setFieldF(e.target.value)}
          className="h-7 px-2 rounded border border-border bg-card text-[11px] w-28 focus:outline-none" />
        <select value={cropF} onChange={e => setCropF(e.target.value)}
          className="h-7 px-2 rounded border border-border bg-card text-[11px]">
          <option value="all">{lang === 'th' ? 'ทุกพืช' : 'All Crops'}</option>
          {crops.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {['all', 'Planned', 'Preparing', 'Ready', 'Planted', 'Harvested', 'Overdue'].map(s => (
          <button key={s} onClick={() => setStatusF(s)}
            className={['px-2 py-1 rounded text-[10px] border',
              statusF === s ? 'bg-[#155d31] text-white border-[#155d31]' : 'border-border text-muted-foreground'].join(' ')}>
            {s === 'all' ? (lang === 'th' ? 'ทั้งหมด' : 'All') : s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden text-[11px]">
        <div className="hidden lg:grid px-3 py-2 bg-muted/40 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wide gap-2"
          style={{ gridTemplateColumns: '100px 80px 140px 100px 110px 80px 170px 80px' }}>
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
                className={`grid px-3 py-2 items-center gap-2 hover:bg-muted/20 ${ov ? 'bg-red-50/30 dark:bg-red-950/20' : ''}`}
                style={{ gridTemplateColumns: '100px 80px 140px 100px 110px 80px 170px 80px' }}>
                <div className="font-mono text-[10px] font-medium">{p.cp_no || '—'}</div>
                <div className="font-mono">{p.field_code || '—'}</div>
                <div className="truncate">{p.crop_name || '—'}</div>
                <div className="text-[10px]">{fmtDate(p.plant_date || p.planned_plant_date)}</div>
                <div className="text-[10px]">
                  <div>{fmtDate(p.required_ready_date)}</div>
                  {dl !== null && !['Planted', 'Harvested', 'Ready'].includes(p.status) && (
                    <div className={`text-[9px] font-medium ${ov ? 'text-red-600' : dl <= 3 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                      {ov ? `${Math.abs(dl)}d late` : `${dl}d left`}
                    </div>
                  )}
                </div>
                <div>
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold"
                    style={{ background: ov ? '#fee2e2' : sc.bg, color: ov ? '#dc2626' : sc.text }}>
                    {effSt}
                  </span>
                </div>
                <div><ProgressBar plan={p} /></div>
                <div className="flex gap-1 flex-wrap">
                  <button onClick={() => openEdit(p)}
                    className="text-[10px] px-1.5 py-1 rounded border border-border hover:bg-muted">
                    {lang === 'th' ? 'แก้ไข' : 'Edit'}
                  </button>
                  <button onClick={() => setRainPlan(p)}
                    className="text-[10px] px-1.5 py-1 rounded border border-blue-200 text-blue-600 hover:bg-blue-50"
                    title="Rain Event">
                    🌧
                  </button>
                  <button onClick={() => setHistPlan(p)}
                    className="text-[10px] px-1.5 py-1 rounded border border-border hover:bg-muted"
                    title="Activity History">
                    📜
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rain modal */}
      {rainPlan && (
        <RainModal plan={rainPlan} onClose={() => setRainPlan(null)}
          onSaved={() => {
            toast({ title: `🌧 Rain event recorded — ${rainPlan.field_code}` });
            setRainPlan(null);
          }} />
      )}

      {/* Activity history modal */}
      {histPlan && (
        <ActivityModal plan={histPlan} workers={workers} machines={machines}
          onClose={() => setHistPlan(null)} />
      )}
    </div>
  );
}
