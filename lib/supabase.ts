import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================================
// Types matching FOMS v1.0 schema
// ============================================================

export type CropPlanStatus = 'Planned' | 'Preparing' | 'Ready' | 'Planted' | 'Harvested' | 'Overdue';
export type TaskType = 'Plowing' | 'Harrowing' | 'Ridging' | 'Ready Inspection';
export type TaskStatus = 'Pending' | 'In Progress' | 'Completed' | 'Overdue' | 'Skipped';
export type RiskLevel = 'Low' | 'Medium' | 'High';
export type InspectionResult = 'Pass' | 'Fail' | 'Rework';

export interface Field {
  id: string;
  field_code: string;
  area_m2: number | null;
  polygon: [number, number][] | null;
  center_lat: number | null;
  center_lng: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Worker {
  id: string;
  worker_name: string;
  position: string | null;
  active: boolean;
  created_at: string;
}

export interface Machine {
  id: string;
  machine_code: string;
  machine_name: string | null;
  machine_type: string | null;
  active: boolean;
  created_at: string;
}

export interface CropPlan {
  id: string;
  cp_no: string;
  crop_name: string | null;
  field_code: string | null;
  planned_plant_date: string | null;
  actual_plant_date: string | null;
  land_prep_date: string | null;
  removal_actual_date: string | null;
  required_ready_date: string | null;
  area_m2: number | null;
  status: CropPlanStatus;
  year: number | null;
  created_at: string;
  updated_at: string;
}

export interface PreparationTask {
  id: string;
  crop_plan_id: string;
  field_code: string | null;
  task_type: TaskType;
  planned_date: string | null;
  actual_date: string | null;
  status: TaskStatus;
  assigned_worker_id: string | null;
  assigned_machine_id: string | null;
  quality_score: number | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  // joins
  worker?: Worker;
  machine?: Machine;
}

export interface WeatherForecast {
  id: string;
  forecast_date: string;
  rain_probability: number | null;
  rainfall_mm: number | null;
  temp_min: number | null;
  temp_max: number | null;
  humidity: number | null;
  wind_speed: number | null;
  description: string | null;
  risk_level: RiskLevel;
  created_at: string;
}

export interface QualityInspection {
  id: string;
  task_id: string;
  inspector_name: string | null;
  inspection_date: string | null;
  quality_score: number | null;
  result: InspectionResult | null;
  comments: string | null;
  created_at: string;
}

// ============================================================
// Color helpers
// ============================================================

export const STATUS_COLORS: Record<CropPlanStatus, { bg: string; text: string; border: string }> = {
  Planned:    { bg: '#ede9fe', text: '#7c3aed', border: '#7c3aed' },
  Preparing:  { bg: '#e0f2fe', text: '#0369a1', border: '#0369a1' },
  Ready:      { bg: '#dcfce7', text: '#15803d', border: '#15803d' },
  Planted:    { bg: '#d1fae5', text: '#065f46', border: '#065f46' },
  Harvested:  { bg: '#f1f5f9', text: '#475569', border: '#475569' },
  Overdue:    { bg: '#fee2e2', text: '#dc2626', border: '#dc2626' },
};

export const RISK_COLORS: Record<RiskLevel, { bg: string; text: string }> = {
  Low:    { bg: '#dcfce7', text: '#15803d' },
  Medium: { bg: '#fef3c7', text: '#d97706' },
  High:   { bg: '#fee2e2', text: '#dc2626' },
};

export function getRiskLevel(prob: number | null): RiskLevel {
  if (!prob) return 'Low';
  if (prob >= 60) return 'High';
  if (prob >= 40) return 'Medium';
  return 'Low';
}

export function getPlanPriority(plan: CropPlan): 'High' | 'Medium' | 'Low' {
  const today = new Date();
  today.setHours(0,0,0,0);
  if (!plan.required_ready_date) return 'Low';
  const rrd = new Date(plan.required_ready_date + 'T00:00:00');
  const daysLeft = Math.round((rrd.getTime() - today.getTime()) / 86400000);
  if (daysLeft < 0 || plan.status === 'Overdue') return 'High';
  if (daysLeft <= 7) return 'High';
  if (daysLeft <= 14) return 'Medium';
  return 'Low';
}

export function getPlanRowColor(plan: CropPlan): string {
  const today = new Date(); today.setHours(0,0,0,0);
  if (plan.status === 'Overdue') return '#fee2e2';
  if (!plan.required_ready_date) return 'transparent';
  const rrd = new Date(plan.required_ready_date + 'T00:00:00');
  const daysLeft = Math.round((rrd.getTime() - today.getTime()) / 86400000);
  if (daysLeft < 0) return '#fee2e2';   // Red — overdue
  if (daysLeft <= 7) return '#fef3c7';  // Yellow — at risk
  return 'transparent';                  // Green/normal
}

export function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateShort(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(iso + 'T00:00:00');
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}
