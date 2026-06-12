import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── Types ───────────────────────────────────────────────────────────────────
export type CropPlanStatus = 'Planned' | 'Preparing' | 'Ready' | 'Planted' | 'Harvested';
export type FieldStatus    = 'Planned' | 'Preparing' | 'Ready' | 'Planted' | 'Harvested';
export type MachineStatus  = 'Available' | 'Working' | 'Maintenance';
export type PreparationStage = 'Plowing' | 'Harrowing' | 'Ridging' | null;
export type RiskLevel = 'Low' | 'Medium' | 'High';
export type TaskType = 'Plowing' | 'Harrowing' | 'Ridging' | 'Ready Inspection';
export type TaskStatus = 'Pending' | 'In Progress' | 'Completed' | 'Overdue' | 'Skipped';

export interface Field {
  id: string;
  field_code: string;
  area_m2: number | null;
  status: FieldStatus | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface CropPlan {
  id: string;
  cp_no: string | null;
  crop_name: string | null;
  field_code: string | null;
  rows_count: number | null;
  bed_width: number | null;
  plant_date: string | null;
  planned_plant_date: string | null;
  actual_plant_date: string | null;
  required_ready_date: string | null;
  status: CropPlanStatus;
  preparation_stage: PreparationStage;
  assigned_worker_id: string | null;
  assigned_machine_id: string | null;
  year: number | null;
  area_m2: number | null;
  created_at: string;
  updated_at: string | null;
}

export interface Worker {
  id: string;
  worker_code: string | null;
  worker_name: string;
  position: string | null;
  is_active: boolean;
  active: boolean | null;
  created_at: string;
}

export interface Machine {
  id: string;
  machine_code: string;
  machine_name: string | null;
  machine_type: string | null;
  status: MachineStatus;
  is_active: boolean;
  active: boolean | null;
  created_at: string;
}

export interface Attachment {
  id: string;
  attachment_code: string;
  attachment_name: string;
  attachment_type: string | null;
  is_active: boolean;
  created_at: string;
}

export interface MachineAssignment {
  id: string;
  machine_id: string;
  attachment_id: string;
  assigned_date: string;
  released_date: string | null;
  created_at: string;
}

export type WorkOrderStatus   = 'Planned' | 'In Progress' | 'Completed' | 'Cancelled';
export type WorkOrderTaskType = 'Plowing' | 'Harrowing' | 'Ridging'
                              | 'Re-Plowing' | 'Re-Harrowing' | 'Re-Ridging';

export interface WorkOrder {
  id: string;
  cp_id: string | null;
  field_code: string | null;
  task_type: WorkOrderTaskType;
  status: WorkOrderStatus;
  assigned_worker_id: string | null;
  assigned_machine_id: string | null;
  assigned_attachment_id: string | null;
  planned_date: string | null;
  actual_date: string | null;
  actual_start: string | null;
  actual_finish: string | null;
  area_m2: number | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export type ActivityType =
  | 'Plowing' | 'Harrowing' | 'Ridging'
  | 'Re-Plowing' | 'Re-Harrowing' | 'Re-Ridging'
  | 'Planting' | 'Harvest' | 'Rain Event' | 'Inspection' | 'Rework';

export type RainIntensity = 'Light' | 'Moderate' | 'Heavy';

export interface FieldActivity {
  id: string;
  field_code: string;
  cp_id: string | null;
  work_order_id: string | null;
  activity_type: ActivityType;
  activity_date: string;
  worker_id: string | null;
  machine_id: string | null;
  attachment_id: string | null;
  area_m2: number | null;
  duration_minutes: number | null;
  rain_intensity: RainIntensity | null;
  requires_rework: boolean;
  remarks: string | null;
  created_at: string;
}

export interface PreparationTask {
  id: string;
  crop_plan_id: string | null;
  task_type: TaskType | null;
  assigned_worker_id: string | null;
  assigned_machine_id: string | null;
  status: TaskStatus;
  scheduled_date: string | null;
  completed_date: string | null;
  notes: string | null;
  created_at: string;
}

// ─── Status colours ───────────────────────────────────────────────────────────
export const STATUS_COLORS: Record<CropPlanStatus, { bg: string; text: string; border: string }> = {
  Planned:   { bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1' },
  Preparing: { bg: '#fef3c7', text: '#d97706', border: '#fcd34d' },
  Ready:     { bg: '#dcfce7', text: '#15803d', border: '#86efac' },
  Planted:   { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' },
  Harvested: { bg: '#fdf4e7', text: '#92400e', border: '#d6b896' },
};

export const FIELD_STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  Planned:   { bg: '#f1f5f9', text: '#64748b', dot: '#94a3b8' },
  Preparing: { bg: '#fef9c3', text: '#a16207', dot: '#eab308' },
  Ready:     { bg: '#dcfce7', text: '#15803d', dot: '#22c55e' },
  Planted:   { bg: '#dbeafe', text: '#1d4ed8', dot: '#3b82f6' },
  Harvested: { bg: '#fdf4e7', text: '#78350f', dot: '#a16207' },
  Overdue:   { bg: '#fee2e2', text: '#b91c1c', dot: '#ef4444' },
  Empty:     { bg: '#f8fafc', text: '#94a3b8', dot: '#cbd5e1' },
};

export const RISK_COLORS: Record<RiskLevel, { bg: string; text: string }> = {
  Low:    { bg: '#dcfce7', text: '#15803d' },
  Medium: { bg: '#fef3c7', text: '#d97706' },
  High:   { bg: '#fee2e2', text: '#dc2626' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
export function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' });
}

export function fmtDateShort(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' });
}

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(iso + 'T00:00:00');
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function isOverdue(plan: CropPlan): boolean {
  if (['Planted', 'Harvested', 'Ready'].includes(plan.status)) return false;
  if (!plan.required_ready_date) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(plan.required_ready_date + 'T00:00:00') < today;
}

export function getEffectiveStatus(plan: CropPlan): string {
  if (isOverdue(plan)) return 'Overdue';
  return plan.status;
}

export function getPreparationProgress(plan: CropPlan): number {
  if (['Harvested', 'Planted'].includes(plan.status)) return 100;
  if (plan.status === 'Ready') return 100;
  if (plan.status === 'Preparing') {
    if (plan.preparation_stage === 'Ridging')   return 75;
    if (plan.preparation_stage === 'Harrowing') return 50;
    if (plan.preparation_stage === 'Plowing')   return 25;
    return 20;
  }
  return 0;
}

export function getRiskLevel(prob: number | null): RiskLevel {
  if (!prob) return 'Low';
  if (prob >= 70) return 'High';
  if (prob >= 40) return 'Medium';
  return 'Low';
}

export function getPlanRowColor(plan: CropPlan): string {
  if (isOverdue(plan)) return '#fff5f5';
  if (plan.status === 'Ready') return '#f0fdf4';
  return 'transparent';
}

export function getPlanPriority(plan: CropPlan): 'High' | 'Medium' | 'Low' {
  if (isOverdue(plan)) return 'High';
  const dl = daysUntil(plan.required_ready_date);
  if (dl !== null && dl <= 3) return 'High';
  if (dl !== null && dl <= 7) return 'Medium';
  return 'Low';
}

// ── Scheduling helpers ────────────────────────────────────────────────────────

/** Add days to a date string (YYYY-MM-DD), returns YYYY-MM-DD */
export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/** Later of two YYYY-MM-DD date strings */
export function laterOf(a: string, b: string): string {
  return a >= b ? a : b;
}

/**
 * Given a Required Ready Date, return auto-scheduled planned dates for the
 * three preparation tasks. Each task is pushed back if it would fall before
 * today.
 *
 * Buffer assumptions (conservative, field may vary):
 *   Ridging    must start ≤ RRD − 2 days
 *   Harrowing  must start ≤ RRD − 5 days
 *   Plowing    must start ≤ RRD − 9 days
 */
export function autoScheduleDates(requiredReadyDate: string): {
  plow: string; harrow: string; ridge: string;
} {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  const plow   = laterOf(todayStr, addDays(requiredReadyDate, -9));
  const harrow = laterOf(addDays(plow, 3),  addDays(requiredReadyDate, -5));
  const ridge  = laterOf(addDays(harrow, 2), addDays(requiredReadyDate, -2));

  return { plow, harrow, ridge };
}

/** Format duration in minutes → "1h 23m" */
export function fmtDuration(minutes: number | null): string {
  if (!minutes || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** m² → rai (1 rai = 1,600 m²) */
export function m2ToRai(m2: number | null): string {
  if (!m2) return '—';
  return `${(m2 / 1600).toFixed(2)} rai`;
}
